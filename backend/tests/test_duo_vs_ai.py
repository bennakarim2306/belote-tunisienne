"""Duo vs AI — invite mode 'vs_ai' creates the training game immediately."""
import json

import websockets

from conftest import API, UA, auth_headers
from test_duo_matchmaking import _ensure_friends


async def test_duo_vs_ai_flow(http, tester1, tester2):
    _ensure_friends(http, tester1, tester2)
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])
    # clear any matchmaking residue from previous tests (matched lives 120s)
    for h in (h1, h2):
        http.delete(f"{API}/matchmaking/leave", headers=h)

    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "vs_ai"}, headers=h1)
    assert r.status_code == 200, r.text
    invite_id = r.json()["invite_id"]

    # launcher pending
    st = http.get(f"{API}/matchmaking/status", headers=h1).json()
    assert st["status"] == "duo_pending" and st["mode"] == "vs_ai"

    # invitee notification carries the vs_ai mode
    notif = http.get(f"{API}/notifications", headers=h2).json()
    inv = next(d for d in notif["duo_invites"] if d["invite_id"] == invite_id)
    assert inv["mode"] == "vs_ai"

    # accept -> game created immediately, game_id returned
    r = http.post(f"{API}/matchmaking/duo/{invite_id}/accept", headers=h2)
    assert r.status_code == 200
    game_id = r.json()["game_id"]
    assert game_id

    # launcher discovers it via status polling
    st = http.get(f"{API}/matchmaking/status", headers=h1).json()
    assert st["status"] == "found" and st["game_id"] == game_id

    # verify composition over WS: 2 humans partners (same seat parity), 2 bots
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    async with websockets.connect(
            f"{base}/ws/game/{game_id}?token={tester1['token']}",
            additional_headers={"User-Agent": UA}, open_timeout=15) as ws:
        state = json.loads(await ws.recv())["state"]
        players = state["players"]
        humans = [p for p in players if not p["is_bot"]]
        bots = [p for p in players if p["is_bot"]]
        assert len(humans) == 2 and len(bots) == 2
        assert humans[0]["seat"] % 2 == humans[1]["seat"] % 2, "duo must be partners"
        assert bots[0]["seat"] % 2 == bots[1]["seat"] % 2
        assert state["origin"] == "solo"
        assert state["host_user_id"] == tester1["user"]["user_id"]

    # cleanup: both leave
    for h in (h1, h2):
        http.delete(f"{API}/matchmaking/leave", headers=h)
