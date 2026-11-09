"""Iteration 33 — Phase 2 realtime sync channel WS /api/ws/sync:
initial payload, bad token, instant friend push, mm_found, mm_update on duo
decline, ping/pong + presence, periodic refresh, and Phase 1 regressions."""
import asyncio
import json
import time
import uuid

import pytest
import requests
import websockets
from pymongo import MongoClient

from conftest import API, UA, auth_headers, TESTER1, TESTER2

mdb = MongoClient("mongodb://localhost:27017")["test_database"]
ADMIN_KEY = "belote-admin-7f3a9c2e"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json={"email": creds["email"],
                      "password": creds["password"]},
                      headers={"User-Agent": UA}, timeout=15)
    assert r.status_code == 200, r.text
    return {"token": r.json()["token"], "user": r.json()["user"]}


def _register(prefix="TEST_ws"):
    s = uuid.uuid4().hex[:8]
    body = {"email": f"{prefix.lower()}_{s}@belote.tn", "password": "Test1234!",
            "username": f"{prefix[:7]}{s[:6]}"}
    r = requests.post(f"{API}/auth/register", json=body,
                      headers={"User-Agent": UA}, timeout=15)
    assert r.status_code in (200, 201), r.text
    return {"token": r.json()["token"], "user": r.json()["user"]}


def _h(tok):
    return auth_headers(tok)


def _sync_url(token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/ws/sync?token={token}"


class Chan:
    """Collects all messages of a sync WS in the background."""

    def __init__(self, token):
        self.token = token
        self.msgs = []

    async def __aenter__(self):
        self.ws = await websockets.connect(
            _sync_url(self.token), additional_headers=[("User-Agent", UA)],
            open_timeout=15)
        self.task = asyncio.create_task(self._reader())
        return self

    async def _reader(self):
        try:
            async for raw in self.ws:
                self.msgs.append((time.time(), json.loads(raw)))
        except Exception:
            pass

    async def wait_for(self, pred, timeout, since=0.0):
        end = time.time() + timeout
        while time.time() < end:
            for ts, m in self.msgs:
                if ts >= since and pred(m):
                    return ts, m
            await asyncio.sleep(0.05)
        return None, None

    async def __aexit__(self, *a):
        self.task.cancel()
        await self.ws.close()


def _del_friendship(a, b):
    mdb.friendships.delete_many({"$or": [
        {"requester_id": a, "recipient_id": b},
        {"requester_id": b, "recipient_id": a}]})


async def _leave_game(game_id, token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    try:
        async with websockets.connect(f"{base}/ws/game/{game_id}?token={token}",
                                      additional_headers=[("User-Agent", UA)],
                                      open_timeout=15) as ws:
            await asyncio.wait_for(ws.recv(), timeout=10)
            await ws.send(json.dumps({"action": "leave"}))
            await asyncio.sleep(1)
    except Exception:
        pass


@pytest.fixture(scope="module")
def t1():
    return _login(TESTER1)


@pytest.fixture(scope="module")
def t2():
    return _login(TESTER2)


# ---- BACKEND 1: connect + initial payload + bad token ----
async def test_initial_payload(t1):
    async with Chan(t1["token"]) as c:
        _, m = await c.wait_for(lambda m: m.get("type") == "sync", 5)
        assert m is not None, "no initial sync message"
        assert isinstance(m["h"], str) and len(m["h"]) == 12
        assert isinstance(m["online"], int) and isinstance(m["waiting"], int)
        d = m["data"]
        for k in ("friend_requests", "invites", "duo_invites", "current_game"):
            assert k in d
        # same digest as HTTP /sync
        r = requests.get(f"{API}/sync", headers=_h(t1["token"]), timeout=15).json()
        assert r["h"] == m["h"]


async def test_bad_token_rejected():
    code = None
    try:
        async with websockets.connect(_sync_url("bogus_token"),
                                      additional_headers=[("User-Agent", UA)],
                                      open_timeout=15) as ws:
            await asyncio.wait_for(ws.recv(), timeout=5)
    except websockets.exceptions.ConnectionClosed as e:
        code = e.rcvd.code if e.rcvd else None
    except websockets.exceptions.InvalidStatus as e:
        code = f"http_{e.response.status_code}"
    print("bad token close:", code)
    assert code in (4001, "http_403"), code


# ---- BACKEND 2: instant friend request push + decline push ----
async def test_friend_push(t1, t2):
    u1, u2 = t1["user"]["user_id"], t2["user"]["user_id"]
    _del_friendship(u1, u2)
    try:
        async with Chan(t1["token"]) as c:
            await c.wait_for(lambda m: m.get("type") == "sync", 5)
            t0 = time.time()
            r = requests.post(f"{API}/friends/request", json={"user_id": u1},
                              headers=_h(t2["token"]), timeout=15)
            assert r.status_code == 200, r.text
            ts, m = await c.wait_for(
                lambda m: m.get("type") == "sync" and any(
                    f["user_id"] == u2
                    for f in (m.get("data") or {}).get("friend_requests", [])),
                3, since=t0)
            assert m is not None, "friend request not pushed"
            print(f"friend push latency {ts - t0:.2f}s")
            assert ts - t0 < 2.5
            fid = next(f["friendship_id"] for f in m["data"]["friend_requests"]
                       if f["user_id"] == u2)
            t1s = time.time()
            r = requests.post(f"{API}/friends/respond",
                              json={"friendship_id": fid, "accept": False},
                              headers=_h(t1["token"]), timeout=15)
            assert r.status_code == 200, r.text
            ts, m = await c.wait_for(
                lambda m: m.get("type") == "sync" and "data" in m and not any(
                    f["user_id"] == u2 for f in m["data"]["friend_requests"]),
                3, since=t1s)
            assert m is not None, "decline push missing"
            print(f"decline push latency {ts - t1s:.2f}s")
    finally:
        _del_friendship(u1, u2)


# ---- BACKEND 3: instant mm_found ----
async def test_mm_found_push(t1):
    others = [_register("TEST_mm") for _ in range(3)]
    gid = None
    try:
        async with Chan(t1["token"]) as c:
            await c.wait_for(lambda m: m.get("type") == "sync", 5)
            r = requests.post(f"{API}/matchmaking/join", json={"match_type": "short"},
                              headers=_h(t1["token"]), timeout=15)
            assert r.status_code == 200, r.text
            for o in others:
                await asyncio.sleep(0.3)
                r = requests.post(f"{API}/matchmaking/join",
                                  json={"match_type": "short"},
                                  headers=_h(o["token"]), timeout=15)
                assert r.status_code == 200
            t0 = time.time()
            # presence-confirmation flow: mm_confirm first, everyone accepts,
            # then the game is created and mm_found is pushed
            _, conf = await c.wait_for(lambda m: m.get("type") == "mm_confirm",
                                       8, since=t0 - 2)
            assert conf is not None, \
                f"no mm_confirm; msgs={[x[1].get('type') for x in c.msgs]}"
            for acc in [t1] + others:
                r = requests.post(f"{API}/matchmaking/confirm",
                                  headers=_h(acc["token"]), timeout=15)
                assert r.status_code == 200
            ts, m = await c.wait_for(lambda m: m.get("type") == "mm_found", 8,
                                     since=t0 - 2)
            assert m is not None, f"no mm_found; msgs={[x[1].get('type') for x in c.msgs]}"
            gid = m["game_id"]
            print(f"mm_found latency {ts - t0:.2f}s game {gid}")
            assert ts - t0 < 3.5
            st = requests.get(f"{API}/matchmaking/status",
                              headers=_h(t1["token"]), timeout=15).json()
            assert st["status"] == "found" and st["game_id"] == gid, st
            # current_game should be pushed too
            _, s = await c.wait_for(
                lambda m: m.get("type") == "sync" and (m.get("data") or {}).get(
                    "current_game") and m["data"]["current_game"]["game_id"] == gid,
                3, since=t0 - 2)
            print("current_game pushed:", s is not None)
    finally:
        for a in [t1] + others:
            requests.delete(f"{API}/matchmaking/leave", headers=_h(a["token"]),
                            timeout=15)
        if gid:
            for a in [t1] + others:
                await _leave_game(gid, a["token"])
            # matchmaking games have no host: remove the test game doc by id
            # (the runtime driver stops on its next commit)
            mdb.live_games.delete_one({"_id": gid})


# ---- BACKEND 4: mm_update on duo decline ----
async def test_mm_update_on_duo_decline(t1, t2):
    u1, u2 = t1["user"]["user_id"], t2["user"]["user_id"]
    _del_friendship(u1, u2)
    requests.post(f"{API}/friends/request", json={"user_id": u2},
                  headers=_h(t1["token"]), timeout=15)
    fid = next(p["friendship_id"] for p in requests.get(
        f"{API}/friends", headers=_h(t2["token"]), timeout=15).json()["pending_received"]
        if p["user_id"] == u1)
    requests.post(f"{API}/friends/respond", json={"friendship_id": fid, "accept": True},
                  headers=_h(t2["token"]), timeout=15)
    try:
        async with Chan(t1["token"]) as c:
            await c.wait_for(lambda m: m.get("type") == "sync", 5)
            r = requests.post(f"{API}/matchmaking/duo/invite",
                              json={"to_user_id": u2, "match_type": "short",
                                    "mode": "vs_ai"}, headers=_h(t1["token"]), timeout=15)
            assert r.status_code == 200, r.text
            iid = r.json()["invite_id"]
            await asyncio.sleep(0.5)
            t0 = time.time()
            r = requests.post(f"{API}/matchmaking/duo/{iid}/decline",
                              headers=_h(t2["token"]), timeout=15)
            assert r.status_code == 200, r.text
            ts, m = await c.wait_for(lambda m: m.get("type") == "mm_update", 3,
                                     since=t0)
            assert m is not None, "no mm_update on decline"
            print(f"mm_update latency {ts - t0:.2f}s")
            st = requests.get(f"{API}/matchmaking/status",
                              headers=_h(t1["token"]), timeout=15).json()
            print("status after decline:", st.get("status"))
    finally:
        for a in (t1, t2):
            requests.delete(f"{API}/matchmaking/leave", headers=_h(a["token"]),
                            timeout=15)
        _del_friendship(u1, u2)


# ---- BACKEND 5: ping/pong + presence + periodic refresh ----
async def test_ping_pong_presence_refresh(t1, t2):
    mdb.users.update_one({"user_id": t1["user"]["user_id"]},
                         {"$set": {"last_active": 0}})
    async with Chan(t1["token"]) as c:
        _, first = await c.wait_for(lambda m: m.get("type") == "sync", 5)
        t0 = time.time()
        await c.ws.send(json.dumps({"action": "ping"}))
        ts, m = await c.wait_for(lambda m: m.get("type") == "pong", 3, since=t0)
        assert m is not None, "no pong"
        la = mdb.users.find_one({"user_id": t1["user"]["user_id"]})["last_active"]
        assert la > t0 - 5
        r = requests.get(f"{API}/sync", headers=_h(t2["token"]), timeout=15).json()
        assert r["online"] >= 1
        t1s = time.time()
        ts, m = await c.wait_for(lambda m: m.get("type") == "sync", 16, since=t1s)
        assert m is not None, "no periodic refresh in 16s"
        print(f"refresh after {ts - t1s:.1f}s, has data: {'data' in m}")
        assert "online" in m and "waiting" in m and "h" in m
        assert "data" not in m  # unchanged payload -> counters only


# ---- BACKEND 6: regressions ----
def test_regressions(t1):
    h = _h(t1["token"])
    r = requests.get(f"{API}/sync", headers=h, timeout=15)
    assert r.status_code == 200 and "data" in r.json()
    hh = r.json()["h"]
    r2 = requests.get(f"{API}/sync?h={hh}", headers=h, timeout=15).json()
    assert r2["h"] == hh and "data" not in r2 and "online" in r2
    n = requests.get(f"{API}/notifications", headers=h, timeout=15)
    assert n.status_code == 200
    assert {"friend_requests", "invites", "duo_invites"} <= set(n.json())
    p = requests.get(f"{API}/presence/pulse", headers=h, timeout=15)
    assert p.status_code == 200, p.text
    g = requests.get(f"{API}/games/current", headers=h, timeout=15)
    assert g.status_code == 200
    a = requests.get(f"{API}/admin/stats?key={ADMIN_KEY}", timeout=15)
    assert a.status_code == 200
    assert "Canaux sync connectés" in a.text
    bad = requests.get(f"{API}/admin/stats?key=wrong", timeout=15)
    assert bad.status_code in (401, 403)
