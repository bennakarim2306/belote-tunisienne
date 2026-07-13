"""WS smoke: both players can connect to vs_ai duo game after accept."""
import json
import asyncio
import os
import pytest
import requests
import websockets
from dotenv import load_dotenv

from conftest import API, auth_headers

load_dotenv("/app/frontend/.env")
WS_BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].replace("https://", "wss://").replace("http://", "ws://").rstrip("/")


async def _connect_and_get_state(game_id, token):
    url = f"{WS_BASE}/api/ws/game/{game_id}?token={token}"
    async with websockets.connect(url, additional_headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }) as ws:
        # Server usually pushes a state or hello on connect
        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
        except asyncio.TimeoutError:
            msg = None
        return msg


@pytest.mark.asyncio
async def test_duo_vs_ai_both_ws_connect(tester1, tester2):
    # Ensure friendship
    requests.get(f"{API}/friends", headers=auth_headers(tester1["token"]), timeout=10)
    # Cancel any existing
    requests.delete(f"{API}/matchmaking/leave",
                    headers=auth_headers(tester1["token"]), timeout=10)
    r = requests.post(f"{API}/matchmaking/duo/invite",
                      json={"to_user_id": tester2["user"]["user_id"],
                            "match_type": "short", "mode": "vs_ai"},
                      headers=auth_headers(tester1["token"]), timeout=10)
    assert r.status_code == 200, r.text
    invite_id = r.json()["invite_id"]
    r = requests.post(f"{API}/matchmaking/duo/{invite_id}/accept",
                      headers=auth_headers(tester2["token"]), timeout=10)
    assert r.status_code == 200
    game_id = r.json()["game_id"]

    m1 = await _connect_and_get_state(game_id, tester1["token"])
    m2 = await _connect_and_get_state(game_id, tester2["token"])
    assert m1 is not None, "tester1 got no WS message"
    assert m2 is not None, "tester2 got no WS message"
    # Should be JSON state / bidding announce, not close
    for m in (m1, m2):
        data = json.loads(m) if isinstance(m, str) else m
        assert isinstance(data, dict)
        assert data.get("type") != "error", f"error message: {data}"
