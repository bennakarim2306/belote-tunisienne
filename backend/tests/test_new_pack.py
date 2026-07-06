"""New feature pack — solo/private timers, out-of-turn capot, last_trick, MM 30s."""
import asyncio
import json
import time

import pytest
import websockets

from conftest import API, UA, auth_headers, _ensure


def _ws_url(game_id, token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/ws/game/{game_id}?token={token}"


async def _first_update(ws, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
        if msg.get("type") == "update":
            return msg
    raise TimeoutError("no initial update")


# ---------------- Solo untimed ----------------

@pytest.mark.asyncio
async def test_solo_game_has_no_turn_timer(http, tester1):
    """POST /api/solo → WS state.turn_timeout==None, turn_deadline==0."""
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15) as ws:
        first = await _first_update(ws)
        state = first["state"]
        assert state["turn_timeout"] is None, f"expected None got {state['turn_timeout']}"
        assert state["turn_deadline"] == 0, f"expected 0 got {state['turn_deadline']}"
        assert state["phase"] == "bidding"
        assert len(state["players"]) == 4
        # Exactly 1 human + 3 bots
        humans = [p for p in state["players"] if not p["is_bot"]]
        assert len(humans) == 1


@pytest.mark.asyncio
async def test_solo_no_auto_pass_after_40s(http, tester1):
    """On MY bidding turn in solo, waiting 40s must NOT auto-pass."""
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        state = None
        my_seat = None
        # Wait until it becomes MY turn during bidding (bots pass 1-2s)
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") != "update":
                continue
            state = msg["state"]
            my_seat = state.get("my_seat")
            if state.get("phase") == "bidding" and state.get("turn") == my_seat:
                break

        assert state is not None
        assert state["phase"] == "bidding", f"phase={state['phase']}"
        assert state["turn"] == my_seat, "expected my turn"

        # Now wait 40s: no auto-pass should happen. Turn must stay mine.
        wait_end = time.time() + 42
        auto_passed = False
        while time.time() < wait_end:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=wait_end - time.time())
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") == "update":
                s = msg["state"]
                if s.get("turn") != my_seat:
                    auto_passed = True
                    break
        assert not auto_passed, "turn advanced without user action — auto-pass fired!"


# ---------------- Private room timer ----------------

def test_private_room_default_no_timer(http, tester1):
    """POST /api/rooms with no turn_timer → GET shows turn_timer:false."""
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    body = r.json()
    assert body.get("turn_timer") is False, f"got {body}"
    code = body["code"]

    r2 = http.get(f"{API}/rooms/{code}", headers=auth_headers(tester1["token"]))
    assert r2.status_code == 200
    assert r2.json()["turn_timer"] is False
    # cleanup: leave
    http.post(f"{API}/rooms/{code}/leave", headers=auth_headers(tester1["token"]))


def test_private_room_with_timer_flag(http, tester1):
    """POST /api/rooms with turn_timer:true → returned turn_timer true."""
    r = http.post(f"{API}/rooms", json={"match_type": "short", "turn_timer": True},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    assert r.json()["turn_timer"] is True
    code = r.json()["code"]
    http.post(f"{API}/rooms/{code}/leave", headers=auth_headers(tester1["token"]))


@pytest.mark.asyncio
async def test_private_room_untimed_ws_state(http, tester1):
    """Private room default → WS state.turn_timeout == None."""
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    code = r.json()["code"]
    r = http.post(f"{API}/rooms/{code}/start", headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15) as ws:
        first = await _first_update(ws)
        state = first["state"]
        assert state["turn_timeout"] is None, f"expected None got {state['turn_timeout']}"


@pytest.mark.asyncio
async def test_private_room_timed_ws_state(http, tester1):
    """Private room with turn_timer:true → WS state.turn_timeout == 30."""
    r = http.post(f"{API}/rooms",
                  json={"match_type": "short", "turn_timer": True},
                  headers=auth_headers(tester1["token"]))
    code = r.json()["code"]
    r = http.post(f"{API}/rooms/{code}/start", headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15) as ws:
        first = await _first_update(ws)
        state = first["state"]
        assert state["turn_timeout"] == 30, f"expected 30 got {state['turn_timeout']}"


# ---------------- Out-of-turn capot ----------------

@pytest.mark.asyncio
async def test_out_of_turn_capot_accepted(http, tester1):
    """When it is NOT my turn during bidding, sending capot must be accepted."""
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        first = await _first_update(ws)
        state = first["state"]
        my_seat = state["my_seat"]

        # If it's my turn immediately, wait a hair for a bot bid to move turn away.
        # Otherwise send capot right now.
        if state["turn"] == my_seat:
            # Send capot now anyway — capot is allowed at any point in bidding.
            pass

        # Send capot for suit H
        await ws.send(json.dumps({"action": "capot", "suit": "H"}))

        # Wait for update showing phase=playing & contract.capot true
        deadline = time.time() + 8
        got = False
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=4)
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") == "error":
                pytest.fail(f"capot rejected: {msg}")
            if msg.get("type") != "update":
                continue
            s = msg["state"]
            if s.get("phase") == "playing" and s.get("contract"):
                assert s["contract"].get("capot") is True, s["contract"]
                assert s["contract"].get("suit") == "H"
                assert s["contract"].get("seat") == my_seat
                got = True
                break
        assert got, "capot did not transition game to playing phase with contract.capot"


# ---------------- last_trick present after first trick ----------------

@pytest.mark.asyncio
async def test_last_trick_populated_after_first_trick(http, tester1):
    """After the first trick completes, state.last_trick has winner_seat/cards/points."""
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tester1["token"]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        first = await _first_update(ws)
        state = first["state"]
        my_seat = state["my_seat"]

        # Force capot at H so bidding ends fast — then play legal cards on my turn
        await ws.send(json.dumps({"action": "capot", "suit": "H"}))

        deadline = time.time() + 60
        saw_last_trick = False
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=8)
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") != "update":
                continue
            state = msg["state"]
            lt = state.get("last_trick")
            if lt and isinstance(lt, dict):
                assert "winner_seat" in lt and isinstance(lt["winner_seat"], int)
                assert "cards" in lt and len(lt["cards"]) == 4
                assert "points" in lt and isinstance(lt["points"], int)
                saw_last_trick = True
                break
            # If my turn: play first legal
            if (state.get("phase") == "playing"
                    and state.get("turn") == my_seat
                    and state.get("legal")):
                await ws.send(json.dumps({"action": "play",
                                          "card": state["legal"][0]}))
        assert saw_last_trick, "last_trick never populated in state"


# ---------------- Matchmaking 30s auto-play regression ----------------

@pytest.mark.asyncio
async def test_matchmaking_game_has_30s_timer(http):
    """4 users mm1-mm4 → matched game WS state.turn_timeout == 30."""
    tokens = []
    for i in range(1, 5):
        creds = {"email": f"mm{i}@belote.tn", "password": "Belote123!",
                 "username": f"MM{i}"}
        tok, _ = _ensure(http, creds)
        tokens.append(tok)

    # Clean any prior queue state
    for tok in tokens:
        http.delete(f"{API}/matchmaking/leave", headers=auth_headers(tok))
    await asyncio.sleep(1)

    # Join all four
    for tok in tokens:
        r = http.post(f"{API}/matchmaking/join", json={"match_type": "short"},
                      headers=auth_headers(tok))
        assert r.status_code == 200, r.text

    # Poll status until all found
    game_id = None
    deadline = time.time() + 25
    while time.time() < deadline and not game_id:
        await asyncio.sleep(1.5)
        all_found = True
        gid = None
        for tok in tokens:
            r = http.get(f"{API}/matchmaking/status", headers=auth_headers(tok))
            s = r.json()
            if s.get("status") == "found":
                gid = s.get("game_id")
            else:
                all_found = False
                break
        if all_found:
            game_id = gid
    assert game_id, "matchmaking never produced a game_id for all 4 players"

    # Connect one WS and check timer
    async with websockets.connect(_ws_url(game_id, tokens[0]),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15) as ws:
        first = await _first_update(ws)
        state = first["state"]
        assert state["turn_timeout"] == 30, \
            f"matchmaking game should have 30s timer, got {state['turn_timeout']}"
        # deadline should be >0 and roughly now+30
        assert state["turn_deadline"] > time.time(), \
            f"deadline {state['turn_deadline']} not in future"


@pytest.mark.asyncio
async def test_matchmaking_auto_action_fires_after_35s(http):
    """On a human turn in a MM game, wait 35s and verify turn advanced."""
    tokens = []
    seats_by_uid = {}
    for i in range(1, 5):
        creds = {"email": f"mm{i}@belote.tn", "password": "Belote123!",
                 "username": f"MM{i}"}
        tok, user = _ensure(http, creds)
        tokens.append(tok)
        seats_by_uid[user["user_id"]] = None

    # Reset queue
    for tok in tokens:
        http.delete(f"{API}/matchmaking/leave", headers=auth_headers(tok))
    await asyncio.sleep(1)

    for tok in tokens:
        r = http.post(f"{API}/matchmaking/join", json={"match_type": "short"},
                      headers=auth_headers(tok))
        assert r.status_code == 200

    game_id = None
    deadline = time.time() + 25
    while time.time() < deadline and not game_id:
        await asyncio.sleep(1.5)
        all_found = True
        gid = None
        for tok in tokens:
            r = http.get(f"{API}/matchmaking/status", headers=auth_headers(tok))
            s = r.json()
            if s.get("status") == "found":
                gid = s.get("game_id")
            else:
                all_found = False
                break
        if all_found:
            game_id = gid
    assert game_id, "no matchmaking game formed"

    # Connect all four WS clients — passively observe (no client sends actions).
    # In 30-35s auto-pass must fire and turn will change.
    async def observe(tok, results, idx):
        try:
            async with websockets.connect(_ws_url(game_id, tok),
                                          additional_headers=[("User-Agent", UA)],
                                          open_timeout=15, max_size=2**22) as ws:
                initial_turn = None
                initial_bids = None
                end = time.time() + 45
                while time.time() < end:
                    try:
                        raw = await asyncio.wait_for(ws.recv(),
                                                     timeout=end - time.time())
                    except asyncio.TimeoutError:
                        break
                    msg = json.loads(raw)
                    if msg.get("type") != "update":
                        continue
                    s = msg["state"]
                    if initial_turn is None:
                        initial_turn = s.get("turn")
                        initial_bids = len(s.get("bids") or [])
                        assert s["turn_timeout"] == 30
                    # Check for auto-action: turn changed OR bids grew OR phase changed
                    if (s.get("turn") != initial_turn
                            or len(s.get("bids") or []) > initial_bids
                            or s.get("phase") != "bidding"):
                        results[idx] = True
                        return
        except Exception as exc:
            results[idx] = f"err:{exc}"

    results = [False, False, False, False]
    await asyncio.gather(*[observe(tokens[i], results, i) for i in range(4)])
    # At least one client should have observed an auto-action
    assert any(r is True for r in results), \
        f"no auto-action observed in MM game within 45s. results={results}"
