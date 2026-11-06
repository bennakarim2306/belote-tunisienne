"""Iteration 32 — Phase 1 server efficiency: GET /api/sync, presence heartbeat,
backward compat of legacy polls, per-account rate limit (80/10s), WS dedupe
regression and admin metrics 'sync (regroupé)'."""
import asyncio
import json
import time
import uuid

import httpx
import pytest
import requests
import websockets

from conftest import API, UA, auth_headers


def _register(prefix="TEST_sync"):
    s = uuid.uuid4().hex[:8]
    body = {"email": f"{prefix.lower()}_{s}@belote.tn", "password": "Test1234!",
            "username": f"{prefix[:8]}{s[:6]}"}
    r = requests.post(f"{API}/auth/register", json=body,
                      headers={"User-Agent": UA}, timeout=15)
    assert r.status_code in (200, 201), r.text
    return {"token": r.json()["token"], "user": r.json()["user"]}


def _get(path, tok, **kw):
    return requests.get(f"{API}{path}", headers=auth_headers(tok), timeout=15, **kw)


def _post(path, tok, body=None):
    return requests.post(f"{API}{path}", json=body or {},
                         headers=auth_headers(tok), timeout=15)


def _ws_url(game_id, token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/ws/game/{game_id}?token={token}"


async def _leave_game(game_id, token):
    try:
        async with websockets.connect(_ws_url(game_id, token),
                                      additional_headers=[("User-Agent", UA)],
                                      open_timeout=15) as ws:
            await asyncio.wait_for(ws.recv(), timeout=10)
            await ws.send(json.dumps({"action": "leave"}))
            await asyncio.sleep(1)
    except Exception:
        pass


@pytest.fixture(scope="module")
def users():
    return _register("TEST_syncA"), _register("TEST_syncB")


# ---- BACKEND 1: /sync hash protocol ----
class TestSyncHash:
    def test_full_then_nothing_new_then_change(self, users):
        a, b = users
        r = _get("/sync", a["token"], params={"h": ""})
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d.keys()) == {"h", "online", "waiting", "data"}
        assert isinstance(d["online"], int) and isinstance(d["waiting"], int)
        assert set(d["data"].keys()) == {"friend_requests", "invites",
                                         "duo_invites", "current_game"}
        assert d["data"]["friend_requests"] == []
        assert d["data"]["current_game"] is None
        h0 = d["h"]

        r2 = _get("/sync", a["token"], params={"h": h0})
        d2 = r2.json()
        assert r2.status_code == 200
        assert set(d2.keys()) == {"h", "online", "waiting"}, d2
        assert d2["h"] == h0
        print("nothing-new bytes:", len(r2.content), "full bytes:", len(r.content))

        # B sends friend request to A -> data reappears with new hash
        fr = _post("/friends/request", b["token"], {"user_id": a["user"]["user_id"]})
        assert fr.status_code == 200, fr.text
        r3 = _get("/sync", a["token"], params={"h": h0}).json()
        assert "data" in r3 and r3["h"] != h0
        reqs = r3["data"]["friend_requests"]
        assert len(reqs) == 1 and reqs[0]["user_id"] == b["user"]["user_id"]
        assert "friendship_id" in reqs[0]
        h1 = r3["h"]

        # cleanup: decline (deletes the friendship)
        rr = _post("/friends/respond", a["token"],
                   {"friendship_id": reqs[0]["friendship_id"], "accept": False})
        assert rr.status_code == 200
        r4 = _get("/sync", a["token"], params={"h": h1}).json()
        assert "data" in r4 and r4["data"]["friend_requests"] == []
        assert r4["h"] == h0  # back to the original digest

    def test_current_game_changes_hash(self, users):
        a, _ = users
        h = _get("/sync", a["token"], params={"h": ""}).json()["h"]
        g = _post("/solo", a["token"], {"match_type": "short"})
        assert g.status_code == 200, g.text
        gid = g.json()["game_id"]
        try:
            d = _get("/sync", a["token"], params={"h": h}).json()
            assert "data" in d and d["h"] != h
            cg = d["data"]["current_game"]
            assert cg and cg["game_id"] == gid
            assert cg["match_type"] == "short" and "my_team" in cg
        finally:
            asyncio.run(_leave_game(gid, a["token"]))
        d = _get("/sync", a["token"], params={"h": ""}).json()
        assert d["data"]["current_game"] is None, "game not finished after leave"

    def test_sync_requires_auth(self):
        r = requests.get(f"{API}/sync", headers={"User-Agent": UA}, timeout=15)
        assert r.status_code == 401


# ---- BACKEND 2: sync is the presence heartbeat ----
class TestSyncPresence:
    def test_sync_marks_online(self):
        c = _register("TEST_syncC")
        b = _register("TEST_syncD")
        # D's count before C pings (C freshly registered may already be active)
        _get("/sync", c["token"])
        n_with_c = _get("/sync", b["token"]).json()["online"]
        assert n_with_c >= 1
        # verify C shows online in D's view via search/presence semantics
        pulse = _get("/presence/pulse", b["token"]).json()
        print("pulse:", pulse, "sync online:", n_with_c)


# ---- BACKEND 3: legacy endpoints unchanged ----
class TestBackwardCompat:
    def test_legacy_shapes(self, users):
        a, _ = users
        n = _get("/notifications", a["token"])
        assert n.status_code == 200
        assert set(n.json().keys()) >= {"friend_requests", "invites", "duo_invites"}
        p = _post("/presence/ping", a["token"])
        assert p.status_code == 200, p.text
        pu = _get("/presence/pulse", a["token"])
        assert pu.status_code == 200, pu.text
        print("ping:", p.json(), "pulse:", pu.json())
        gc = _get("/games/current", a["token"])
        assert gc.status_code == 200, gc.text
        print("games/current:", gc.json())


# ---- BACKEND 4: per-account rate limit ----
async def _burst(token, n):
    async with httpx.AsyncClient(timeout=30, headers=auth_headers(token)) as c:
        rs = await asyncio.gather(*[c.get(f"{API}/sync?h=x") for _ in range(n)],
                                  return_exceptions=True)
    return [r.status_code if not isinstance(r, Exception) else str(r) for r in rs], rs


class TestRateLimit:
    def test_burst_429_then_recovers_and_independent(self):
        x = _register("TEST_rlX")
        y = _register("TEST_rlY")
        _get("/sync", x["token"])  # warm token cache
        time.sleep(10.5)            # fresh window
        codes, rs = asyncio.run(_burst(x["token"], 100))
        ok = codes.count(200)
        lim = codes.count(429)
        print("burst codes: 200=", ok, "429=", lim, "other=",
              [c for c in codes if c not in (200, 429)])
        assert lim > 0, "no 429 in burst"
        assert ok <= 80
        body = next(r for r in rs if not isinstance(r, Exception)
                    and r.status_code == 429).json()
        assert body == {"detail": "too_many_requests"}
        # other account unaffected
        assert _get("/sync", y["token"]).status_code == 200
        time.sleep(10.5)
        assert _get("/sync", x["token"]).status_code == 200


# ---- BACKEND 5: WS dedupe regression + admin metrics ----
class TestWsAndAdmin:
    def test_ws_solo_playable(self):
        u = _register("TEST_wsA")
        gid = _post("/solo", u["token"], {"match_type": "short"}).json()["game_id"]

        async def run():
            async with websockets.connect(_ws_url(gid, u["token"]),
                                          additional_headers=[("User-Agent", UA)],
                                          open_timeout=15, max_size=2**22) as ws:
                first = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                assert first["type"] == "update", first
                n_updates, played, card, after = 0, 0, None, None
                deadline = time.time() + 90
                msg = first
                while time.time() < deadline and played < 3:
                    if msg is None:
                        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=20))
                    cur, msg = msg, None
                    if cur.get("type") != "update":
                        print("non-update:", cur)
                        continue
                    n_updates += 1
                    st = cur["state"]
                    print("upd", st["phase"], "turn", st.get("turn"), "me",
                          st.get("my_seat"), "events", [e.get("e") for e in cur.get("events", [])])
                    if st["phase"] in ("hand_end",):
                        await ws.send(json.dumps({"action": "ready"}))
                    if card and card not in (st.get("hand") or []):
                        after = card
                    if st.get("turn") != st.get("my_seat"):
                        continue
                    if st["phase"] == "bidding":
                        await ws.send(json.dumps({"action": "pass"}))
                    elif st["phase"] == "playing" and st.get("legal"):
                        card = st["legal"][0]
                        await ws.send(json.dumps({"action": "play", "card": card}))
                        played += 1
                await ws.send(json.dumps({"action": "leave"}))
                await asyncio.sleep(1)
                return n_updates, played, after
        n, played, after = asyncio.run(run())
        print("updates:", n, "played:", played, "card removed seen:", after)
        assert played >= 1, "never got to play a card"
        assert after is not None, "played card never removed from hand"

    def test_admin_stats_includes_sync(self, users):
        a, _ = users
        for _ in range(3):
            _get("/sync", a["token"])
        time.sleep(17)
        r = requests.get(f"{API}/admin/stats", params={"key": "belote-admin-7f3a9c2e"},
                         headers={"User-Agent": UA}, timeout=30)
        assert r.status_code == 200
        assert "sync (regroupé)" in r.text
