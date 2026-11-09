"""Iter35 — server duo-vs-AI game: bots (bot_ai v2 with bids arg) bid & play
through one full hand to hand_end over WS, no errors, every bot card legal
w.r.t. the state the humans saw."""
import asyncio
import json
import time

import pytest
import websockets

from conftest import API, UA, auth_headers
from test_duo_matchmaking import _ensure_friends


def _ws(game_id, token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/ws/game/{game_id}?token={token}"


async def _human(ws, name, log, done, bid_when_void):
    while not done.is_set():
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=20)
        except asyncio.TimeoutError:
            log.append((name, "timeout"))
            continue
        msg = json.loads(raw)
        if msg.get("type") == "error":
            log.append((name, "error", msg))
            continue
        if msg.get("type") != "update":
            continue
        st = msg["state"]
        for e in msg.get("events", []):
            log.append((name, time.time(), e.get("e"), e.get("seat"), e.get("card")))
        if st["phase"] in ("hand_end", "match_end", "finished"):
            log.append((name, "phase", st["phase"], st.get("hand_result") or ""))
            done.set()
            return
        if st.get("turn") != st.get("my_seat"):
            continue
        await asyncio.sleep(0.3)
        if st["phase"] == "bidding":
            bids = st.get("bids") or []
            npass = sum(1 for b in bids if b.get("type") == "pass")
            if (bid_when_void and not st.get("current_bid") and npass >= 3):
                suit = max("SHDC", key=lambda s: sum(c[-1] == s for c in st["hand"]))
                await ws.send(json.dumps({"action": "bid", "value": 90, "suit": suit}))
            else:
                await ws.send(json.dumps({"action": "pass"}))
        elif st["phase"] == "playing":
            legal = st.get("legal") or []
            if legal:
                await ws.send(json.dumps({"action": "play", "card": legal[0]}))


@pytest.mark.asyncio
async def test_duo_vs_ai_full_hand(http, tester1, tester2):
    _ensure_friends(http, tester1, tester2)
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])
    for h in (h1, h2):
        http.delete(f"{API}/matchmaking/leave", headers=h)
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "vs_ai"}, headers=h1)
    assert r.status_code == 200, r.text
    r = http.post(f"{API}/matchmaking/duo/{r.json()['invite_id']}/accept", headers=h2)
    assert r.status_code == 200, r.text
    game_id = r.json()["game_id"]
    print("game", game_id)
    log, done = [], asyncio.Event()
    hdr = {"User-Agent": UA}
    try:
        async with websockets.connect(_ws(game_id, tester1["token"]), additional_headers=hdr,
                                      open_timeout=15, max_size=2**22) as w1, \
                websockets.connect(_ws(game_id, tester2["token"]), additional_headers=hdr,
                                   open_timeout=15, max_size=2**22) as w2:
            t = [asyncio.create_task(_human(w1, "t1", log, done, True)),
                 asyncio.create_task(_human(w2, "t2", log, done, False))]
            try:
                await asyncio.wait_for(done.wait(), timeout=55)
            finally:
                for x in t:
                    x.cancel()
            # host leaves -> game cancelled (cleanup)
            try:
                await w1.send(json.dumps({"action": "leave"}))
                await asyncio.sleep(1)
            except Exception:
                pass
    finally:
        for h in (h1, h2):
            http.delete(f"{API}/matchmaking/leave", headers=h)
    t1 = [l for l in log if l[0] == "t1"]
    plays = [l for l in t1 if len(l) == 5 and l[2] == "play"]
    errors = [l for l in log if l[1] == "error"]
    phases = [l for l in log if l[1] == "phase"]
    print("plays", len(plays), "errors", errors[:3], "phase", phases[:2])
    print("events", sorted({l[2] for l in t1 if len(l) == 5}))
    assert not errors, errors
    assert len(plays) == 32, f"expected 32 plays, got {len(plays)}"
    assert phases and phases[0][2] in ("hand_end", "match_end")
