"""Quick chat in game — whitelist, broadcast and rate limit."""
import asyncio
import json
import time

import pytest
import websockets

from conftest import API, UA, auth_headers


def _start_game(http, tester1):
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    code = r.json()["code"]
    r = http.post(f"{API}/rooms/{code}/start",
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    return r.json()["game_id"]


def _ws_url(game_id, token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/ws/game/{game_id}?token={token}"


async def _next_chat_event(ws, timeout=5.0):
    end = time.time() + timeout
    while time.time() < end:
        try:
            remaining = max(0.1, end - time.time())
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=remaining))
        except (asyncio.TimeoutError, TimeoutError):
            return None
        if msg.get("type") == "update":
            for ev in msg.get("events") or []:
                if ev.get("e") == "chat":
                    return ev
    return None


@pytest.mark.asyncio
async def test_chat_message_emoji_and_rate_limit(http, tester1):
    game_id = _start_game(http, tester1)
    url = _ws_url(game_id, tester1["token"])
    async with websockets.connect(url, additional_headers={"User-Agent": UA},
                                  open_timeout=15) as ws:
        # initial state
        await asyncio.wait_for(ws.recv(), timeout=10)

        # 1. valid predefined message is echoed back as a chat event
        await ws.send(json.dumps({"action": "chat", "kind": "msg", "value": "yezzi"}))
        ev = await _next_chat_event(ws)
        assert ev is not None, "chat msg event not received"
        assert ev["kind"] == "msg" and ev["msg"] == "yezzi"
        assert isinstance(ev["seat"], int)

        # 2. rate limit: an immediate second message is silently dropped
        await ws.send(json.dumps({"action": "chat", "kind": "emoji", "value": "🔥"}))
        ev = await _next_chat_event(ws, timeout=2.0)
        assert ev is None, "rate limit not enforced"

        # 3. after the cooldown, a valid emoji goes through
        await asyncio.sleep(1.6)
        await ws.send(json.dumps({"action": "chat", "kind": "emoji", "value": "🔥"}))
        ev = await _next_chat_event(ws)
        assert ev is not None and ev["kind"] == "emoji" and ev["msg"] == "🔥"

        # 4. non-whitelisted content is rejected (no event)
        await asyncio.sleep(1.6)
        await ws.send(json.dumps({"action": "chat", "kind": "msg",
                                  "value": "arbitrary free text"}))
        ev = await _next_chat_event(ws, timeout=2.0)
        assert ev is None, "non-whitelisted message must be dropped"
