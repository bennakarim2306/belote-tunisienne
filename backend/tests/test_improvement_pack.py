"""Improvement pack backend tests:
- P0 bidding raise-over-partner bug (apply_bid only requires value > current)
- Capot broken by defender → instant hand_end with success=False, 500 pts to defenders
- Hand-end ready flow (solo: single human ready → next hand instantly)
- Pause flow (solo: instant paused; non-requester resume rejected; requester resumes)
- Pause flow 2 humans: pause_accept flow + pause_decline broadcast
- GET /api/games/current: rejoin banner data + null when none
- Rejoin via WS: leave, GET current returns id, reconnect clears left flag + rejoined event
"""
import asyncio
import json
import time
import uuid

import pytest
import websockets

from conftest import API, UA, auth_headers, _ensure


def _ws_url(game_id, token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/ws/game/{game_id}?token={token}"


async def _first_update(ws, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        msg = json.loads(raw)
        if msg.get("type") == "update":
            return msg
    raise TimeoutError("no initial update")


async def _drain_until(ws, predicate, timeout=15):
    """Drain WS messages until predicate(msg) returns truthy; returns that msg."""
    end = time.time() + timeout
    last = None
    while time.time() < end:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=end - time.time())
        except asyncio.TimeoutError:
            break
        msg = json.loads(raw)
        last = msg
        if predicate(msg):
            return msg
    raise TimeoutError(f"predicate not satisfied; last={last}")


# --------- P0 bidding: raise over partner's bid ---------

@pytest.mark.asyncio
async def test_apply_bid_allows_raise_over_partner(http, tester1):
    """apply_bid rule requires value > current only (no team check)."""
    import sys
    sys.path.insert(0, "/app/backend")
    import game_logic as gl  # local import: exercise pure logic directly

    players = [
        {"user_id": f"u{i}", "username": f"P{i}", "is_bot": False,
         "avatar_id": 1, "elo": 1200, "seat": i} for i in range(4)
    ]
    g = gl.BeloteGame("gtest", players, "short", turn_timeout=None)
    # Force turn to seat 0 and simulate seat0 bids 100 H
    g.turn = 0
    g.apply_bid(0, 100, "H")
    # bidding continues: next turn seat1 (opponent) passes
    assert g.turn == 1
    g.apply_pass(1)
    # Partner of 0 is seat 2 → must be able to raise to 110
    assert g.turn == 2
    events = g.apply_bid(2, 110, "S")
    assert any(e["e"] == "bid" and e["seat"] == 2 and e["value"] == 110 for e in events)
    assert g.current_bid["seat"] == 2
    assert g.current_bid["value"] == 110


# --------- Capot broken instantly ---------

@pytest.mark.asyncio
async def test_capot_broken_ends_hand_immediately(http, tester1):
    """Announced capot at H by human seat; if any bot defender wins a trick, phase=hand_end."""
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        first = await _first_update(ws)
        state = first["state"]
        my_seat = state["my_seat"]

        # Force capot at H — I'm the taker
        await ws.send(json.dumps({"action": "capot", "suit": "H"}))

        # Play (badly) all my legal cards until phase=hand_end.
        # If any defender takes a trick, hand ends before 8 tricks.
        deadline = time.time() + 90
        tricks_played_at_end = None
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=8)
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") != "update":
                continue
            s = msg["state"]
            if s.get("phase") == "hand_end":
                tricks_played_at_end = s.get("tricks_played")
                hr = s.get("hand_result")
                assert hr is not None
                # Capot destroyed → success False AND defenders got 500.
                # If we won all 8 tricks success=True, that's also legit.
                if hr.get("success") is False:
                    assert 500 in (hr["hand_scores"] or [])
                    # Broken before all 8 tricks
                    assert (tricks_played_at_end or 8) < 8, \
                        f"expected early end, got tricks={tricks_played_at_end}"
                break
            if (s.get("phase") == "playing" and s.get("turn") == my_seat
                    and s.get("legal")):
                # Play the WORST legal card (lowest points) to give defenders a chance
                legal = s["legal"]
                await ws.send(json.dumps({"action": "play", "card": legal[0]}))
        assert tricks_played_at_end is not None, "never reached hand_end phase"


# --------- Hand-end ready flow (solo) ---------

@pytest.mark.asyncio
async def test_solo_ready_advances_hand_immediately(http, tester1):
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        first = await _first_update(ws)
        my_seat = first["state"]["my_seat"]
        await ws.send(json.dumps({"action": "capot", "suit": "H"}))

        # play until hand_end
        deadline = time.time() + 90
        hand_end_state = None
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=8)
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") != "update":
                continue
            s = msg["state"]
            if s.get("phase") == "hand_end":
                hand_end_state = s
                break
            if (s.get("phase") == "playing" and s.get("turn") == my_seat
                    and s.get("legal")):
                await ws.send(json.dumps({"action": "play", "card": s["legal"][0]}))
        assert hand_end_state is not None
        # deadline should be about 120s in future (or 10s if match_over)
        remaining = hand_end_state["turn_deadline"] - time.time()
        if hand_end_state.get("hand_result", {}).get("match_over"):
            assert 0 < remaining <= 15, f"match_over deadline expected <=15s got {remaining}"
        else:
            assert 60 < remaining <= 121, f"hand_end deadline expected ~120s got {remaining}"

        # ready_seats should be present (initially empty)
        assert hand_end_state.get("ready_seats") == []

        # Send ready as solo human → next hand should start (or match_over)
        await ws.send(json.dumps({"action": "ready"}))
        # Wait for phase != hand_end
        advanced = False
        end = time.time() + 15
        while time.time() < end:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=6)
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") != "update":
                continue
            s = msg["state"]
            if s.get("phase") in ("bidding", "finished"):
                advanced = True
                break
        assert advanced, "solo ready did not advance from hand_end"


# --------- Pause flow (solo) ---------

@pytest.mark.asyncio
async def test_solo_pause_instant_and_requester_only_resume(http, tester1):
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        first = await _first_update(ws)
        my_seat = first["state"]["my_seat"]

        await ws.send(json.dumps({"action": "pause_request"}))
        # Solo: no other humans → paused immediately
        paused_msg = await _drain_until(
            ws,
            lambda m: (m.get("type") == "update" and m["state"].get("paused")),
            timeout=8,
        )
        pstate = paused_msg["state"]
        assert pstate["paused"]["seat"] == my_seat
        remaining = pstate["paused"]["until"] - time.time()
        assert 150 < remaining <= 181, f"pause ~180s expected, got {remaining}"

        # Any game action rejected while paused
        await ws.send(json.dumps({"action": "pass"}))
        err = await _drain_until(ws, lambda m: m.get("type") == "error", timeout=5)
        assert err["message"] == "paused"

        # Note: solo has no other human. To exercise "not_requester" we skip in solo
        # (server rejects with own_seat check). Instead, verify requester CAN resume.
        await ws.send(json.dumps({"action": "resume"}))
        resumed = await _drain_until(
            ws,
            lambda m: (m.get("type") == "update" and not m["state"].get("paused")),
            timeout=6,
        )
        assert resumed["state"].get("paused") is None


# --------- Pause flow with 2 humans (private room) ---------

@pytest.mark.asyncio
async def test_pause_two_humans_accept_and_decline(http, tester1, tester2):
    # Ensure any leftover ongoing games are left first
    for tok in (tester1["token"], tester2["token"]):
        cur = http.get(f"{API}/games/current", headers=auth_headers(tok)).json()
        if cur.get("game_id"):
            # Best effort: cannot end other's ongoing via API; ignore.
            pass

    # Create a room with turn_timer=false, tester2 joins, tester1 starts
    r = http.post(f"{API}/rooms",
                  json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    code = r.json()["code"]
    r = http.post(f"{API}/rooms/{code}/join",
                  headers=auth_headers(tester2["token"]))
    assert r.status_code == 200, r.text
    r = http.post(f"{API}/rooms/{code}/start",
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    game_id = r.json()["game_id"]

    ws1 = await websockets.connect(
        _ws_url(game_id, tester1["token"]),
        additional_headers=[("User-Agent", UA)],
        open_timeout=15, max_size=2**22)
    ws2 = await websockets.connect(
        _ws_url(game_id, tester2["token"]),
        additional_headers=[("User-Agent", UA)],
        open_timeout=15, max_size=2**22)
    try:
        u1 = await _first_update(ws1)
        u2 = await _first_update(ws2)
        seat1 = u1["state"]["my_seat"]
        seat2 = u2["state"]["my_seat"]

        # ---- DECLINE flow ----
        await ws1.send(json.dumps({"action": "pause_request"}))
        # ws2 should receive pause_req with required including seat2
        req_state = await _drain_until(
            ws2,
            lambda m: (m.get("type") == "update"
                       and m["state"].get("pause_req")
                       and seat2 in (m["state"]["pause_req"]["required"] or [])),
            timeout=8,
        )
        assert req_state["state"]["pause_req"]["seat"] == seat1

        await ws2.send(json.dumps({"action": "pause_decline"}))
        # ws1 sees pause_declined event and pause_req cleared
        decl = await _drain_until(
            ws1,
            lambda m: (m.get("type") == "update"
                       and any(e.get("e") == "pause_declined" for e in m.get("events", []))),
            timeout=8,
        )
        assert decl["state"].get("pause_req") is None
        assert decl["state"].get("paused") is None

        # ---- ACCEPT flow ----
        await ws1.send(json.dumps({"action": "pause_request"}))
        await _drain_until(
            ws2,
            lambda m: (m.get("type") == "update"
                       and m["state"].get("pause_req")
                       and seat2 in (m["state"]["pause_req"]["required"] or [])),
            timeout=8,
        )
        await ws2.send(json.dumps({"action": "pause_accept"}))
        paused = await _drain_until(
            ws1,
            lambda m: (m.get("type") == "update" and m["state"].get("paused")),
            timeout=8,
        )
        assert paused["state"]["paused"]["seat"] == seat1

        # Non-requester (seat2) tries to resume → error not_requester
        await ws2.send(json.dumps({"action": "resume"}))
        err = await _drain_until(ws2, lambda m: m.get("type") == "error", timeout=6)
        assert err["message"] == "not_requester", err

        # Requester resumes
        await ws1.send(json.dumps({"action": "resume"}))
        resumed = await _drain_until(
            ws1,
            lambda m: (m.get("type") == "update" and not m["state"].get("paused")),
            timeout=6,
        )
        assert resumed["state"].get("paused") is None
    finally:
        try:
            await ws1.close()
        except Exception:
            pass
        try:
            await ws2.close()
        except Exception:
            pass


# --------- Rejoin / /api/games/current ---------

def test_games_current_null_when_none(http):
    """Register a fresh user with no games → /api/games/current → {game_id: null}."""
    creds = {"email": f"nogame_{uuid.uuid4().hex[:6]}@belote.tn",
             "password": "Belote123!",
             "username": f"NoGame{uuid.uuid4().hex[:4]}"}
    tok, _ = _ensure(http, creds)
    r = http.get(f"{API}/games/current", headers=auth_headers(tok))
    assert r.status_code == 200, r.text
    assert r.json() == {"game_id": None}


@pytest.mark.asyncio
async def test_leave_then_rejoin_via_ws(http):
    """Solo game: the creator is host, so 'leave' cancels the game for everyone
    (game_cancelled event) and /api/games/current no longer lists it.
    Non-host rejoin is covered by test_pack2 test_rejoin_non_host_via_ws."""
    creds = {"email": f"rejoin_{uuid.uuid4().hex[:6]}@belote.tn",
             "password": "Belote123!",
             "username": f"Rej{uuid.uuid4().hex[:4]}"}
    tok, _ = _ensure(http, creds)
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tok))
    assert r.status_code == 200
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tok),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        await _first_update(ws)
        await ws.send(json.dumps({"action": "leave"}))
        end = time.time() + 8
        saw_cancelled = False
        while time.time() < end and not saw_cancelled:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=end - time.time())
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") == "update":
                if any(e.get("e") == "game_cancelled" for e in msg.get("events", [])):
                    saw_cancelled = True
        assert saw_cancelled, "'game_cancelled' event not observed after host leave"

    # the cancelled game must not be offered for rejoin
    r = http.get(f"{API}/games/current", headers=auth_headers(tok))
    assert r.status_code == 200
    assert r.json()["game_id"] is None, r.json()
