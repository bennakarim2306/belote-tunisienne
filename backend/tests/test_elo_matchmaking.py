"""ELO-based matchmaking (humans only, no bot fill) + private-room bot regression."""
import asyncio
import json
import time

import pytest
import requests
import websockets

from conftest import API, UA, auth_headers, _ensure


# ---------- helpers ----------

MM_USERS = [
    {"email": f"mm{i}@belote.tn", "password": "Belote123!", "username": f"Mm{i}"}
    for i in range(1, 5)
]


def _mm_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "User-Agent": UA})
    return s


@pytest.fixture(scope="module")
def mm_clients():
    """4 registered users mm1..mm4, each with own session + token."""
    clients = []
    for creds in MM_USERS:
        s = _mm_session()
        token, user = _ensure(s, creds)
        # leave any stale queue state before starting
        s.delete(f"{API}/matchmaking/leave", headers=auth_headers(token))
        clients.append({"http": s, "token": token, "user": user})
    yield clients
    # cleanup queue state
    for c in clients:
        try:
            c["http"].delete(f"{API}/matchmaking/leave", headers=auth_headers(c["token"]))
        except Exception:
            pass


def _status(client):
    r = client["http"].get(f"{API}/matchmaking/status",
                           headers=auth_headers(client["token"]))
    assert r.status_code == 200, r.text
    return r.json()


def _join(client):
    r = client["http"].post(f"{API}/matchmaking/join", json={"match_type": "short"},
                            headers=auth_headers(client["token"]))
    assert r.status_code == 200, r.text


def _leave(client):
    client["http"].delete(f"{API}/matchmaking/leave",
                          headers=auth_headers(client["token"]))


# ---------- 1. Four humans get matched into the same game ----------

def test_matchmaking_4_humans_same_game_id(mm_clients):
    for c in mm_clients:
        _leave(c)

    # first user joins and polls -> should show waiting with found_count 1
    _join(mm_clients[0])
    st = _status(mm_clients[0])
    assert st["status"] == "waiting", st
    assert st["found_count"] == 1
    assert st["elo_range"] == 100
    assert isinstance(st["players"], list) and len(st["players"]) == 0

    # user 2 joins
    _join(mm_clients[1])
    time.sleep(0.5)
    st = _status(mm_clients[0])
    assert st["status"] == "waiting"
    assert st["found_count"] == 2, st
    assert len(st["players"]) == 1
    other = st["players"][0]
    for key in ("username", "avatar_id", "elo"):
        assert key in other, other

    # user 3
    _join(mm_clients[2])
    time.sleep(0.5)
    st = _status(mm_clients[0])
    assert st["found_count"] == 3, st

    # user 4 -> matchmaking loop runs every 2s, so wait up to ~5s for match
    _join(mm_clients[3])
    game_ids = {}
    deadline = time.time() + 8
    while time.time() < deadline:
        time.sleep(1.0)
        # poll everyone to keep them "alive"
        for i, c in enumerate(mm_clients):
            st = _status(c)
            if st["status"] == "found":
                game_ids[i] = st["game_id"]
        if len(game_ids) == 4:
            break
    assert len(game_ids) == 4, f"not all matched: {game_ids}"
    unique = set(game_ids.values())
    assert len(unique) == 1, f"expected one game_id, got: {unique}"
    gid = next(iter(unique))
    assert gid.startswith("g_"), gid

    # persist for the next test module-scope via attribute
    test_matchmaking_4_humans_same_game_id.game_id = gid
    test_matchmaking_4_humans_same_game_id.tokens = [c["token"] for c in mm_clients]


# ---------- 2. Game from matchmaking has 4 humans (no bots) ----------

@pytest.mark.asyncio
async def test_matchmaking_game_has_no_bots(mm_clients):
    gid = getattr(test_matchmaking_4_humans_same_game_id, "game_id", None)
    tokens = getattr(test_matchmaking_4_humans_same_game_id, "tokens", None)
    if not gid or not tokens:
        pytest.skip("prior matchmaking test did not produce a game_id")

    ws_base = API.replace("https://", "wss://").replace("http://", "ws://")
    url = f"{ws_base}/ws/game/{gid}?token={tokens[0]}"
    async with websockets.connect(url, additional_headers={"User-Agent": UA},
                                  open_timeout=10) as ws:
        # wait for first update
        end = time.time() + 8
        state = None
        while time.time() < end:
            raw = await asyncio.wait_for(ws.recv(), timeout=6)
            msg = json.loads(raw)
            if msg.get("type") == "update":
                state = msg["state"]
                break
        assert state, "no update received from WS"
        assert len(state["players"]) == 4
        for p in state["players"]:
            assert p["is_bot"] is False, f"bot found in mm game: {p}"


# ---------- 3. ELO window widens over time ----------

def test_elo_range_grows_over_time(mm_clients):
    solo = mm_clients[0]
    # make sure everyone else is out of the queue so no accidental match
    for c in mm_clients[1:]:
        _leave(c)
    _leave(solo)

    _join(solo)
    st = _status(solo)
    assert st["status"] == "waiting"
    assert st["elo_range"] == 100, st

    # keep polling (once every ~3s) to stay in the queue, but wait ~11s total
    t0 = time.time()
    while time.time() - t0 < 11:
        time.sleep(3)
        st = _status(solo)  # also refreshes last_seen
        assert st["status"] == "waiting", st
    st = _status(solo)
    assert st["status"] == "waiting"
    assert st["elo_range"] >= 200, st
    _leave(solo)

    st = _status(solo)
    assert st["status"] == "idle", st


# ---------- 4. Stale purge: no polling for >12s -> back to idle ----------

def test_stale_purge_returns_idle(mm_clients):
    solo = mm_clients[0]
    _leave(solo)
    _join(solo)
    st = _status(solo)
    assert st["status"] == "waiting"

    # stop polling for 15s (queue_stale = 12s, loop tick 2s)
    time.sleep(15)

    st = _status(solo)
    assert st["status"] == "idle", f"expected idle after purge, got {st}"


# ---------- 5. Private-room bot regression ----------

def test_private_room_still_fills_with_bots(mm_clients):
    host = mm_clients[0]
    r = host["http"].post(f"{API}/rooms", json={"match_type": "short"},
                          headers=auth_headers(host["token"]))
    assert r.status_code == 200, r.text
    code = r.json()["code"]

    r = host["http"].post(f"{API}/rooms/{code}/start",
                          headers=auth_headers(host["token"]))
    assert r.status_code == 200, r.text
    gid = r.json()["game_id"]
    assert gid.startswith("g_")

    # check via WS state
    async def _fetch_state():
        ws_base = API.replace("https://", "wss://").replace("http://", "ws://")
        url = f"{ws_base}/ws/game/{gid}?token={host['token']}"
        async with websockets.connect(url, additional_headers={"User-Agent": UA},
                                      open_timeout=10) as ws:
            end = time.time() + 8
            while time.time() < end:
                raw = await asyncio.wait_for(ws.recv(), timeout=6)
                msg = json.loads(raw)
                if msg.get("type") == "update":
                    return msg["state"]
            return None

    state = asyncio.get_event_loop().run_until_complete(_fetch_state()) \
        if False else asyncio.new_event_loop().run_until_complete(_fetch_state())
    assert state is not None, "no WS update"
    bots = [p for p in state["players"] if p["is_bot"]]
    humans = [p for p in state["players"] if not p["is_bot"]]
    assert len(humans) == 1, humans
    assert len(bots) == 3, bots
