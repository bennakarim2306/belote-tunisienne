"""Improvement Pack 2 backend tests:
- Rejoin (leave+reconnect) flow (P0)
- Disconnect auto-pause (grace ~4s + broadcast 'paused'/'resumed')
- Host cancel (private + solo) → game_cancelled + games/current cleared
- GET /api/notifications aggregation (friend_requests + invites)
- Private room seats: initial state, move, seat_taken, reserved seat, non-host invite-with-seat
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


async def _recv_updates(ws, timeout, stop_when=None):
    """Collect update/error messages until stop_when returns True or timeout."""
    updates = []
    end = time.time() + timeout
    while time.time() < end:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=max(0.2, end - time.time()))
        except asyncio.TimeoutError:
            break
        except websockets.ConnectionClosed:
            break
        msg = json.loads(raw)
        updates.append(msg)
        if stop_when and stop_when(msg):
            return updates
    return updates


def _fresh_user(http):
    creds = {"email": f"pack2_{uuid.uuid4().hex[:8]}@belote.tn",
             "password": "Belote123!",
             "username": f"pk{uuid.uuid4().hex[:6]}"}
    return _ensure(http, creds)


async def _cancel_current_game(http, tok):
    """If the user is stuck in prior test games, cancel them all as host (or leave)."""
    for _ in range(6):
        r = http.get(f"{API}/games/current", headers=auth_headers(tok))
        gid = r.json().get("game_id") if r.status_code == 200 else None
        if not gid:
            return
        try:
            async with websockets.connect(_ws_url(gid, tok),
                                          additional_headers=[("User-Agent", UA)],
                                          open_timeout=10) as ws:
                await asyncio.wait_for(ws.recv(), timeout=10)
                await ws.send(json.dumps({"action": "leave"}))
                await asyncio.sleep(0.4)
        except Exception:
            return


# ============================================================
# P0: Non-host rejoin
# ============================================================

@pytest.mark.asyncio
async def test_rejoin_non_host_via_ws(http, tester1, tester2):
    """tester2 (non-host) leaves + disconnects → tester1 sees 'left' event and bot plays.
    tester2 reconnects → receives state, 'rejoined' event broadcast to both, left cleared."""
    # Fresh private room by tester1
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    code = r.json()["code"]

    # tester2 joins
    r = http.post(f"{API}/rooms/{code}/join",
                  headers=auth_headers(tester2["token"]))
    assert r.status_code == 200

    # start
    r = http.post(f"{API}/rooms/{code}/start",
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    game_id = r.json()["game_id"]

    async with websockets.connect(
        _ws_url(game_id, tester1["token"]),
        additional_headers=[("User-Agent", UA)], open_timeout=15
    ) as ws1:
        # first update for host
        _ = await asyncio.wait_for(ws1.recv(), timeout=15)

        # tester2 connects, sends leave, disconnects
        ws2 = await websockets.connect(
            _ws_url(game_id, tester2["token"]),
            additional_headers=[("User-Agent", UA)], open_timeout=15
        )
        _ = await asyncio.wait_for(ws2.recv(), timeout=15)  # initial state
        await ws2.send(json.dumps({"action": "leave"}))
        await asyncio.sleep(0.5)
        await ws2.close()

        # host should see 'left' event
        saw_left = False
        end = time.time() + 6
        while time.time() < end and not saw_left:
            msgs = await _recv_updates(ws1, timeout=2)
            for m in msgs:
                for ev in m.get("events", []):
                    if ev.get("e") == "left":
                        saw_left = True
        assert saw_left, "host never received 'left' event after tester2 leave"

        # GET /api/games/current for tester2 → returns the game_id
        r = http.get(f"{API}/games/current",
                     headers=auth_headers(tester2["token"]))
        assert r.status_code == 200
        assert r.json().get("game_id") == game_id, r.json()

        # tester2 reconnects
        ws2b = await websockets.connect(
            _ws_url(game_id, tester2["token"]),
            additional_headers=[("User-Agent", UA)], open_timeout=15
        )
        # first update contains state
        first = json.loads(await asyncio.wait_for(ws2b.recv(), timeout=15))
        assert first["type"] == "update"
        my_seat = first["state"]["my_seat"]
        # players[my_seat].left flag NOT present in serialized state — we check via rejoined broadcast
        # Wait a bit and also check that host sees 'rejoined' event
        saw_rejoined_host = False
        end = time.time() + 5
        while time.time() < end and not saw_rejoined_host:
            msgs = await _recv_updates(ws1, timeout=2)
            for m in msgs:
                for ev in m.get("events", []):
                    if ev.get("e") == "rejoined" and ev.get("seat") == my_seat:
                        saw_rejoined_host = True
        assert saw_rejoined_host, "host never saw 'rejoined' event"

        await ws2b.close()


# ============================================================
# Disconnect auto-pause
# ============================================================

@pytest.mark.asyncio
async def test_disconnect_auto_pause_and_resume(http, tester1, tester2):
    """tester2 socket drops abruptly → tester1 sees 'paused' with reason 'disconnect'
    within ~grace(4s)+2s; tester2 reconnects → 'resumed', paused=null."""
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    code = r.json()["code"]
    http.post(f"{API}/rooms/{code}/join",
              headers=auth_headers(tester2["token"]))
    r = http.post(f"{API}/rooms/{code}/start",
                  headers=auth_headers(tester1["token"]))
    game_id = r.json()["game_id"]

    async with websockets.connect(
        _ws_url(game_id, tester1["token"]),
        additional_headers=[("User-Agent", UA)], open_timeout=15
    ) as ws1:
        _ = await asyncio.wait_for(ws1.recv(), timeout=15)

        ws2 = await websockets.connect(
            _ws_url(game_id, tester2["token"]),
            additional_headers=[("User-Agent", UA)], open_timeout=15
        )
        first2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=15))
        tester2_seat = first2["state"]["my_seat"]

        # Abrupt drop (no leave)
        await ws2.close()

        # Wait up to 10s for 'paused' event with reason 'disconnect'
        saw_paused = False
        paused_state = None
        end = time.time() + 12
        while time.time() < end and not saw_paused:
            msgs = await _recv_updates(ws1, timeout=2)
            for m in msgs:
                for ev in m.get("events", []):
                    if ev.get("e") == "paused":
                        saw_paused = True
                        paused_state = m.get("state", {}).get("paused")
        assert saw_paused, "host never saw 'paused' event after tester2 abrupt disconnect"
        assert paused_state is not None, "state.paused not populated"
        assert paused_state.get("reason") == "disconnect"
        assert paused_state.get("seat") == tester2_seat
        # until roughly now + DISCONNECT_PAUSE_SECONDS (60s)
        assert paused_state.get("until", 0) - time.time() > 30

        # tester1 tries an action while paused → should error 'paused'
        # Use a benign action like pause_request (server rejects with 'paused' for gameplay actions,
        # for others it raises other errors). Try 'pass' if we happen to be bidding turn:
        # simpler: send bid – if not turn or paused, we should get an error
        await ws1.send(json.dumps({"action": "pass"}))
        got_paused_err = False
        end2 = time.time() + 3
        while time.time() < end2 and not got_paused_err:
            try:
                raw = await asyncio.wait_for(ws1.recv(), timeout=2)
            except asyncio.TimeoutError:
                break
            m = json.loads(raw)
            if m.get("type") == "error" and m.get("message") == "paused":
                got_paused_err = True
        assert got_paused_err, "gameplay action during pause should return error 'paused'"

        # tester2 reconnects → 'resumed'
        ws2b = await websockets.connect(
            _ws_url(game_id, tester2["token"]),
            additional_headers=[("User-Agent", UA)], open_timeout=15
        )
        saw_resumed = False
        end = time.time() + 6
        while time.time() < end and not saw_resumed:
            for w in (ws1, ws2b):
                try:
                    raw = await asyncio.wait_for(w.recv(), timeout=1)
                except (asyncio.TimeoutError, websockets.ConnectionClosed):
                    continue
                m = json.loads(raw)
                if m.get("type") == "update":
                    if m.get("state", {}).get("paused") is None:
                        for ev in m.get("events", []):
                            if ev.get("e") == "resumed":
                                saw_resumed = True
                                break
        assert saw_resumed, "did not see 'resumed' event after tester2 reconnected"
        await ws2b.close()


# ============================================================
# Host cancel — private room & solo
# ============================================================

@pytest.mark.asyncio
async def test_host_cancel_private_room(http, tester1, tester2):
    """Host tester1 sends {action:'leave'} → both see 'game_cancelled', phase finished,
    cancelled=true, winner_team=null; GET /api/games/current returns null; no ELO."""
    # Clean stale games from prior tests
    await _cancel_current_game(http, tester1["token"])
    await _cancel_current_game(http, tester2["token"])

    # capture ELOs
    me1_before = http.get(f"{API}/auth/me",
                          headers=auth_headers(tester1["token"])).json()
    me2_before = http.get(f"{API}/auth/me",
                          headers=auth_headers(tester2["token"])).json()

    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    code = r.json()["code"]
    http.post(f"{API}/rooms/{code}/join",
              headers=auth_headers(tester2["token"]))
    r = http.post(f"{API}/rooms/{code}/start",
                  headers=auth_headers(tester1["token"]))
    game_id = r.json()["game_id"]

    ws1 = await websockets.connect(_ws_url(game_id, tester1["token"]),
                                   additional_headers=[("User-Agent", UA)], open_timeout=15)
    ws2 = await websockets.connect(_ws_url(game_id, tester2["token"]),
                                   additional_headers=[("User-Agent", UA)], open_timeout=15)
    _ = json.loads(await asyncio.wait_for(ws1.recv(), timeout=15))
    _ = json.loads(await asyncio.wait_for(ws2.recv(), timeout=15))

    await ws1.send(json.dumps({"action": "leave"}))

    cancelled_seen = {1: False, 2: False}
    final_state = {}
    end = time.time() + 6
    while time.time() < end and not (cancelled_seen[1] and cancelled_seen[2]):
        for idx, w in ((1, ws1), (2, ws2)):
            try:
                raw = await asyncio.wait_for(w.recv(), timeout=1)
            except (asyncio.TimeoutError, websockets.ConnectionClosed):
                continue
            m = json.loads(raw)
            if m.get("type") == "update":
                for ev in m.get("events", []):
                    if ev.get("e") == "game_cancelled":
                        cancelled_seen[idx] = True
                        final_state[idx] = m["state"]

    await ws1.close()
    await ws2.close()

    assert cancelled_seen[1] and cancelled_seen[2], f"game_cancelled not delivered to both: {cancelled_seen}"
    for idx in (1, 2):
        st = final_state[idx]
        assert st["phase"] == "finished", st["phase"]
        assert st.get("cancelled") is True, st.get("cancelled")
        assert st.get("winner_team") is None

    # games/current returns null for both (cancelled game removed from live map)
    for tok in (tester1["token"], tester2["token"]):
        r = http.get(f"{API}/games/current", headers=auth_headers(tok))
        assert r.status_code == 200
        # The cancelled game_id must no longer be current for either player.
        current = r.json().get("game_id")
        assert current != game_id, (
            f"cancelled game {game_id} still returned by games/current: {current}")

    # No ELO change
    me1_after = http.get(f"{API}/auth/me",
                        headers=auth_headers(tester1["token"])).json()
    me2_after = http.get(f"{API}/auth/me",
                        headers=auth_headers(tester2["token"])).json()
    assert me1_after["elo"] == me1_before["elo"], (me1_before["elo"], me1_after["elo"])
    assert me2_after["elo"] == me2_before["elo"]
    assert me1_after["games_played"] == me1_before["games_played"]


@pytest.mark.asyncio
async def test_host_cancel_solo(http, tester1):
    """Solo creator {action:'leave'} → game_cancelled, no ELO/stats change."""
    await _cancel_current_game(http, tester1["token"])
    me_before = http.get(f"{API}/auth/me",
                         headers=auth_headers(tester1["token"])).json()

    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15) as ws:
        _ = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
        await ws.send(json.dumps({"action": "leave"}))

        cancelled = False
        end = time.time() + 5
        while time.time() < end and not cancelled:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                break
            m = json.loads(raw)
            if m.get("type") == "update":
                for ev in m.get("events", []):
                    if ev.get("e") == "game_cancelled":
                        cancelled = True
                        assert m["state"]["phase"] == "finished"
                        assert m["state"].get("cancelled") is True
        assert cancelled, "solo host leave did not produce game_cancelled"

    r = http.get(f"{API}/games/current",
                 headers=auth_headers(tester1["token"]))
    assert r.json().get("game_id") != game_id, r.json()

    me_after = http.get(f"{API}/auth/me",
                       headers=auth_headers(tester1["token"])).json()
    assert me_after["elo"] == me_before["elo"]


# ============================================================
# GET /api/notifications
# ============================================================

def test_notifications_friend_requests_and_invites(http, tester1):
    """Fresh user sends friend request to tester1 + invites him to a fresh room.
    Both must appear in tester1's /api/notifications."""
    # Fresh user
    tok, fresh = _fresh_user(http)

    # Send friend request → tester1
    r = http.post(f"{API}/friends/request",
                  json={"user_id": tester1["user"]["user_id"]},
                  headers=auth_headers(tok))
    assert r.status_code == 200, r.text

    # Fresh user creates a room and invites tester1
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tok))
    code = r.json()["code"]
    r = http.post(f"{API}/rooms/{code}/invite",
                  json={"user_id": tester1["user"]["user_id"]},
                  headers=auth_headers(tok))
    assert r.status_code == 200, r.text

    r = http.get(f"{API}/notifications",
                 headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    body = r.json()
    assert "friend_requests" in body and "invites" in body

    fr_matches = [f for f in body["friend_requests"]
                  if f.get("user_id") == fresh["user_id"]]
    assert fr_matches, f"friend request from fresh user not in notifications: {body}"
    entry = fr_matches[0]
    assert "friendship_id" in entry and "username" in entry and "avatar_id" in entry

    inv_matches = [i for i in body["invites"] if i.get("room_code") == code]
    assert inv_matches, f"invite from fresh user not in notifications: {body}"

    # Cleanup: dismiss friendship + invite
    http.post(f"{API}/friends/respond",
              json={"friendship_id": entry["friendship_id"], "accept": False},
              headers=auth_headers(tester1["token"]))
    http.post(f"{API}/rooms/{code}/leave", headers=auth_headers(tok))


# ============================================================
# Private room seats (5-item scenario)
# ============================================================

@pytest.mark.asyncio
async def test_room_seat_flow_full(http, tester1, tester2):
    """POST /rooms → seats[0]=host, 1..3=null; move host to seat 3;
    moving to occupied seat → seat_taken; host invite reserves seat 1;
    invitee join lands on seat 1; non-host invite with seat → 403;
    start_room → game players match seat positions."""
    await _cancel_current_game(http, tester1["token"])
    await _cancel_current_game(http, tester2["token"])

    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    room = r.json()
    code = room["code"]
    seats = room["seats"]
    assert seats[0] and seats[0]["user_id"] == tester1["user"]["user_id"]
    assert seats[1] is None and seats[2] is None and seats[3] is None

    # Move host to seat 3
    r = http.post(f"{API}/rooms/{code}/seat", json={"seat": 3},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    seats = r.json()["seats"]
    assert seats[0] is None
    assert seats[3] and seats[3]["user_id"] == tester1["user"]["user_id"]

    # Occupied seat scenario: put tester2 in and try to move host onto him
    r = http.post(f"{API}/rooms/{code}/join",
                  headers=auth_headers(tester2["token"]))
    assert r.status_code == 200
    seats = r.json()["seats"]
    tester2_seat = next(i for i, p in enumerate(seats)
                        if p and p["user_id"] == tester2["user"]["user_id"])
    r = http.post(f"{API}/rooms/{code}/seat", json={"seat": tester2_seat},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 400
    assert r.json().get("detail") == "seat_taken"

    # Non-host invite WITH seat → 403 (tester2 tries)
    fresh_tok, fresh = _fresh_user(http)
    r = http.post(f"{API}/rooms/{code}/invite",
                  json={"user_id": fresh["user_id"], "seat": 2},
                  headers=auth_headers(tester2["token"]))
    assert r.status_code == 403, (r.status_code, r.text)

    # Clean tester2 to reset seat 1 reservation flow
    http.post(f"{API}/rooms/{code}/leave", headers=auth_headers(tester2["token"]))
    # Host invites fresh user to seat 1
    r = http.post(f"{API}/rooms/{code}/invite",
                  json={"user_id": fresh["user_id"], "seat": 1},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text

    # Fresh joins → lands on seat 1
    r = http.post(f"{API}/rooms/{code}/join",
                  headers=auth_headers(fresh_tok))
    assert r.status_code == 200
    seats = r.json()["seats"]
    assert seats[1] and seats[1]["user_id"] == fresh["user_id"], seats

    # Start room → game players match seat positions, bots fill empty (seats 0 and 2)
    r = http.post(f"{API}/rooms/{code}/start",
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15) as ws:
        first = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
        players = first["state"]["players"]
        by_seat = {p["seat"]: p for p in players}
        assert by_seat[1]["user_id"] == fresh["user_id"], by_seat[1]
        assert by_seat[3]["user_id"] == tester1["user"]["user_id"], by_seat[3]
        assert by_seat[0]["is_bot"] and by_seat[2]["is_bot"], by_seat
        # Cleanup: host cancels
        await ws.send(json.dumps({"action": "leave"}))
        await asyncio.sleep(0.5)
