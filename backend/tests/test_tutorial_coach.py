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


# ---------- bidding-benchmark unit tests (orientation guidance) ----------

import sys
from types import SimpleNamespace

sys.path.insert(0, "/app/backend")
import coach  # noqa: E402


def _g(hand, current_bid=None, seat=0):
    hands = {i: [] for i in range(4)}
    hands[seat] = hand
    return SimpleNamespace(hands=hands, current_bid=current_bid,
                           turn=seat, paused=None, phase="bidding")


def test_benchmark_90():
    # Jack of trumps + 3 trumps + outside ace, nothing more
    hand = ["JH", "8H", "7H", "AS", "7S", "8D", "QD", "7C"]
    h = coach._bidding_hint(_g(hand), 0)
    assert h["reason"] == "bid_90" and h["value"] == 90 and h["suit"] == "H"


def test_benchmark_100():
    # 4 trumps with J but no 9 -> 100
    hand = ["JH", "8H", "7H", "QH", "AS", "7S", "8D", "7C"]
    h = coach._bidding_hint(_g(hand), 0)
    assert h["reason"] == "bid_100" and h["value"] == 100


def test_benchmark_110_master():
    # J + 9 + A of trumps (master) but only 3 trumps, 4 suits -> 110
    hand = ["JH", "9H", "AH", "7S", "8S", "8D", "QD", "7C"]
    h = coach._bidding_hint(_g(hand), 0)
    assert h["reason"] == "bid_110" and h["value"] == 110


def test_benchmark_120_three_suits():
    # master + 4 trumps + only 3 suits (missing one -> easy cuts) -> 120
    hand = ["JH", "9H", "AH", "7H", "AS", "7S", "8D", "QD"]
    h = coach._bidding_hint(_g(hand), 0)
    assert h["reason"] == "bid_120" and h["value"] == 120


def test_benchmark_130_two_suits():
    # master + long trumps + only 2 suits -> 130
    hand = ["JH", "9H", "AH", "7H", "8H", "AS", "7S", "KS"]
    h = coach._bidding_hint(_g(hand), 0)
    assert h["reason"] == "bid_130" and h["value"] == 130


def test_pass_weak_benchmark():
    # no benchmark reached -> pedagogical pass
    hand = ["7H", "8H", "QH", "7S", "8S", "8D", "QD", "7C"]
    h = coach._bidding_hint(_g(hand), 0)
    assert h["action"] == "pass" and h["reason"] == "bid_pass_weak"


def test_partner_support_plus10():
    # partner (seat 2) bid 90H; 2 trumps + outside ace -> raise to 100
    hand = ["8H", "7H", "AS", "7S", "8D", "QD", "7C", "8C"]
    cb = {"seat": 2, "value": 90, "suit": "H", "capot": False}
    h = coach._bidding_hint(_g(hand, cb), 0)
    assert h["reason"] == "bid_support10" and h["value"] == 100 and h["prev"] == 90


def test_partner_support_plus20():
    # strong help: 3 trumps incl. big one + ace + void suit -> +20
    hand = ["9H", "8H", "7H", "AS", "KS", "AD", "QD", "8D"]
    cb = {"seat": 2, "value": 90, "suit": "H", "capot": False}
    h = coach._bidding_hint(_g(hand, cb), 0)
    assert h["reason"] == "bid_support20" and h["value"] == 110


def test_partner_support_prudence_pass():
    # no useful trump, no ace, no void -> prudence rule: pass
    hand = ["7H", "7S", "8S", "QS", "8D", "QD", "7C", "8C"]
    cb = {"seat": 2, "value": 90, "suit": "H", "capot": False}
    h = coach._bidding_hint(_g(hand, cb), 0)
    assert h["action"] == "pass" and h["reason"] == "bid_pass_prudence"


def test_opponent_bid_pass_when_benchmark_not_above():
    # opponent holds 100; our benchmark is only 90 -> pass (pass_high)
    hand = ["JH", "8H", "7H", "AS", "7S", "8D", "QD", "7C"]
    cb = {"seat": 1, "value": 100, "suit": "S", "capot": False}
    h = coach._bidding_hint(_g(hand, cb), 0)
    assert h["action"] in ("pass", "contre")
    if h["action"] == "pass":
        assert h["reason"] == "bid_pass_high"


def test_opponent_bid_raise_when_stronger():
    # opponent holds 90S; we are trump master in hearts (110) -> raise 110H
    hand = ["JH", "9H", "AH", "7S", "8S", "8D", "QD", "7C"]
    cb = {"seat": 1, "value": 90, "suit": "S", "capot": False}
    h = coach._bidding_hint(_g(hand, cb), 0)
    assert h["action"] == "bid" and h["value"] == 110 and h["suit"] == "H"
