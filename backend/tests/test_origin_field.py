"""Verify new 'origin' + 'host_user_id' fields in game state.

Added in iteration_9 for ads/analytics: origin ∈ {'online','solo','private'}.
- Solo: POST /api/solo → state.origin == 'solo', host_user_id == creator.
- Private: rooms flow → state.origin == 'private', host_user_id == host.
- Online default: code-review only (see game_manager.create_game default='online').
"""
import asyncio
import json
import time

import pytest
import websockets

from conftest import API, UA, auth_headers


def _ws_url(game_id, token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/ws/game/{game_id}?token={token}"


async def _first_update(ws, timeout=15.0):
    end = time.time() + timeout
    while time.time() < end:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        if msg.get("type") == "update":
            return msg
    raise TimeoutError("no update received")


# ---------------- Solo ----------------

@pytest.mark.asyncio
async def test_solo_game_origin_solo(http, tester1):
    """POST /api/solo creates a game with origin='solo' and host_user_id set."""
    r = http.post(f"{API}/solo", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    game_id = r.json().get("game_id")
    assert game_id, f"no game_id in response: {r.text}"

    async with websockets.connect(
        _ws_url(game_id, tester1["token"]),
        additional_headers=[("User-Agent", UA)],
        open_timeout=15, close_timeout=5, max_size=2**22,
    ) as ws:
        msg = await _first_update(ws)
        state = msg["state"]
        assert state.get("origin") == "solo", \
            f"expected origin='solo', got {state.get('origin')!r}"
        assert state.get("host_user_id") == tester1["user"]["user_id"], \
            f"host_user_id mismatch: {state.get('host_user_id')!r} vs {tester1['user']['user_id']!r}"
        assert len(state.get("players", [])) == 4
        # 1 human + 3 bots
        humans = [p for p in state["players"] if not p.get("is_bot")]
        bots = [p for p in state["players"] if p.get("is_bot")]
        assert len(humans) == 1 and len(bots) == 3, \
            f"expected 1 human + 3 bots, got {len(humans)} + {len(bots)}"


# ---------------- Private room ----------------

@pytest.mark.asyncio
async def test_private_room_game_origin_private(http, tester1, tester2):
    """rooms flow: create → tester2 joins → host starts → state.origin == 'private'."""
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
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

    async with websockets.connect(
        _ws_url(game_id, tester1["token"]),
        additional_headers=[("User-Agent", UA)],
        open_timeout=15, close_timeout=5, max_size=2**22,
    ) as ws:
        msg = await _first_update(ws)
        state = msg["state"]
        assert state.get("origin") == "private", \
            f"expected origin='private', got {state.get('origin')!r}"
        assert state.get("host_user_id") == tester1["user"]["user_id"], \
            f"host_user_id mismatch: {state.get('host_user_id')!r}"
        assert len(state.get("players", [])) == 4
        # 2 humans + 2 bots (private rooms fill empty seats with bots on start)
        humans = [p for p in state["players"] if not p.get("is_bot")]
        assert len(humans) == 2, f"expected 2 humans, got {len(humans)}"


# ---------------- Online default (code review sanity) ----------------

def test_online_default_origin_in_source():
    """Sanity: game_manager.create_game default origin='online'."""
    import inspect

    from game_manager import GameManager
    sig = inspect.signature(GameManager.create_game)
    assert sig.parameters["origin"].default == "online", \
        f"default origin changed: {sig.parameters['origin'].default!r}"
