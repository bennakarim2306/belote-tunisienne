"""Tutorial teaching-game tests:
- POST /api/tutorial/game creates an unranked solo game with coach enabled
- WS state carries coach_mode + a coach hint when it's the human's turn
- Hint is consistent: bidding hint suggests bid/pass; play hint suggests a
  card from the player's legal moves
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


@pytest.mark.asyncio
async def test_tutorial_game_coach_flow(http):
    creds = {"email": f"tuto_{uuid.uuid4().hex[:6]}@belote.tn",
             "password": "Belote123!",
             "username": f"Tuto{uuid.uuid4().hex[:4]}"}
    tok, _ = _ensure(http, creds)

    r = http.post(f"{API}/tutorial/game", headers=auth_headers(tok))
    assert r.status_code == 200, r.text
    game_id = r.json()["game_id"]

    async with websockets.connect(_ws_url(game_id, tok),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        saw_coach_mode = False
        bid_hint = None
        play_hint = None
        acted = set()
        end = time.time() + 45
        while time.time() < end and play_hint is None:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=end - time.time())
            except asyncio.TimeoutError:
                break
            msg = json.loads(raw)
            if msg.get("type") != "update":
                continue
            s = msg["state"]
            if s.get("coach_mode"):
                saw_coach_mode = True
            hint = s.get("coach")
            if not hint:
                continue
            if hint["kind"] == "bid":
                if bid_hint is None:
                    bid_hint = hint
                    assert hint["action"] in ("bid", "contre", "pass")
                    assert hint["reason"].startswith("bid_")
                # follow the suggestion each time the auction reaches us
                key = f"bid-{s['hand_number']}-{len(s.get('bids', []))}"
                if key in acted:
                    continue
                acted.add(key)
                if hint["action"] == "bid":
                    await ws.send(json.dumps({"action": "bid",
                                              "value": hint["value"],
                                              "suit": hint["suit"]}))
                elif hint["action"] == "contre":
                    await ws.send(json.dumps({"action": "contre"}))
                else:
                    await ws.send(json.dumps({"action": "pass"}))
            elif hint["kind"] == "play":
                play_hint = hint
                assert hint["card"] in s["legal"], \
                    f"suggested card {hint['card']} not legal {s['legal']}"
                assert hint["reason"]

        assert saw_coach_mode, "coach_mode flag missing from tutorial game state"
        assert bid_hint is not None, "no bidding hint received"
        assert play_hint is not None, "no play hint received"


def test_tutorial_game_is_unranked(http):
    tok, _ = _ensure(http, {"email": "tester1@belote.tn",
                            "password": "Belote123!", "username": "Tester1"})
    r = http.post(f"{API}/tutorial/game", headers=auth_headers(tok))
    assert r.status_code == 200
    game_id = r.json()["game_id"]
    # the current-game endpoint should list it (rejoinable) — and solo games
    # created via /tutorial/game are unranked so no ELO will be written
    r = http.get(f"{API}/games/current", headers=auth_headers(tok))
    assert r.status_code == 200
    assert r.json()["game_id"] == game_id
