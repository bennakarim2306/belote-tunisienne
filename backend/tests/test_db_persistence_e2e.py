"""E2E test of the MongoDB-persisted live state: duo-vs-AI flow, rooms, solo.

Run: python tests/test_db_persistence_e2e.py
Uses the deployed external URL so requests traverse the real ingress.
"""
import asyncio
import json
import os
import sys

import httpx
import websockets

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8001") + "/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")

CREDS = [("tester1@belote.tn", "Belote123!", "Tester1"),
         ("tester2@belote.tn", "Belote123!", "Tester2")]

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(("✅" if cond else "❌") + f" {name} {detail if not cond else ''}")


async def login(hc, email, pw, username):
    r = await hc.post(f"{BASE}/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        r = await hc.post(f"{BASE}/auth/register",
                          json={"email": email, "password": pw, "username": username})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"]


async def ws_first_state(game_id, token):
    async with websockets.connect(f"{WS_BASE}/ws/game/{game_id}?token={token}",
                                  open_timeout=10) as ws:
        raw = await asyncio.wait_for(ws.recv(), timeout=10)
        return json.loads(raw)


async def main():
    async with httpx.AsyncClient(timeout=20) as hc:
        t1, u1 = await login(hc, *CREDS[0])
        t2, u2 = await login(hc, *CREDS[1])
        h1 = {"Authorization": f"Bearer {t1}"}
        h2 = {"Authorization": f"Bearer {t2}"}
        check("auth", bool(t1 and t2))

        # --- ensure friendship (needed for duo invite permission)
        r = await hc.get(f"{BASE}/friends", headers=h1)
        friends = r.json()
        if not any(f["user_id"] == u2["user_id"] for f in friends["friends"]):
            await hc.post(f"{BASE}/friends/request", headers=h1,
                          json={"user_id": u2["user_id"]})
            r = await hc.get(f"{BASE}/friends", headers=h2)
            for fr in r.json()["pending_received"]:
                if fr["user_id"] == u1["user_id"]:
                    await hc.post(f"{BASE}/friends/respond", headers=h2,
                                  json={"friendship_id": fr["friendship_id"],
                                        "accept": True})
        r = await hc.get(f"{BASE}/friends", headers=h1)
        check("friendship established",
              any(f["user_id"] == u2["user_id"] for f in r.json()["friends"]))

        # --- 1) DUO VS AI (the production bug scenario)
        r = await hc.post(f"{BASE}/matchmaking/duo/invite", headers=h1,
                          json={"to_user_id": u2["user_id"],
                                "match_type": "short", "mode": "vs_ai"})
        check("duo invite created", r.status_code == 200, r.text)
        invite_id = r.json().get("invite_id")

        # host polls status -> duo_pending
        r = await hc.get(f"{BASE}/matchmaking/status", headers=h1)
        check("host sees duo_pending", r.json().get("status") == "duo_pending",
              r.text)

        # invitee sees it in notifications
        r = await hc.get(f"{BASE}/notifications", headers=h2)
        check("invitee sees duo invite",
              any(v["invite_id"] == invite_id
                  for v in r.json().get("duo_invites", [])), r.text)

        # invitee accepts -> game created immediately (vs_ai)
        r = await hc.post(f"{BASE}/matchmaking/duo/{invite_id}/accept", headers=h2)
        check("invite accepted", r.status_code == 200, r.text)
        game_id = r.json().get("game_id")
        check("vs_ai game created on accept", bool(game_id), r.text)

        # HOST polls status -> must find the game (this was the bug)
        r = await hc.get(f"{BASE}/matchmaking/status", headers=h1)
        st = r.json()
        check("HOST finds game (bug fix)", st.get("status") == "found"
              and st.get("game_id") == game_id, r.text)

        # both connect over WS and receive a valid state
        s1 = await ws_first_state(game_id, t1)
        s2 = await ws_first_state(game_id, t2)
        check("host WS state", s1.get("type") == "update"
              and s1["state"]["my_seat"] == 0, json.dumps(s1)[:200])
        check("invitee WS state", s2.get("type") == "update"
              and s2["state"]["my_seat"] == 2, json.dumps(s2)[:200])
        check("2 bots seated", sum(p["is_bot"] for p in s1["state"]["players"]) == 2)

        # /games/current resolves from DB
        r = await hc.get(f"{BASE}/games/current", headers=h1)
        check("games/current finds live game", r.json().get("game_id") == game_id,
              r.text)

        # host cancels the game (leave) to clean up
        async with websockets.connect(
                f"{WS_BASE}/ws/game/{game_id}?token={t1}", open_timeout=10) as ws:
            await asyncio.wait_for(ws.recv(), timeout=10)
            await ws.send(json.dumps({"action": "leave"}))
            await asyncio.sleep(1)
        r = await hc.get(f"{BASE}/games/current", headers=h1)
        check("game cancelled cleans current", r.json().get("game_id") is None,
              r.text)

        # --- 2) PRIVATE ROOM flow
        r = await hc.post(f"{BASE}/rooms", headers=h1,
                          json={"match_type": "short"})
        check("room created", r.status_code == 200, r.text)
        code = r.json()["code"]
        r = await hc.post(f"{BASE}/rooms/{code}/join", headers=h2)
        check("friend joined room", r.status_code == 200
              and sum(1 for s in r.json()["seats"] if s) == 2, r.text)
        r = await hc.post(f"{BASE}/rooms/{code}/seat", headers=h2,
                          json={"seat": 2})
        check("seat moved", r.status_code == 200
              and r.json()["seats"][2]["user_id"] == u2["user_id"], r.text)
        r = await hc.post(f"{BASE}/rooms/{code}/start", headers=h1)
        check("room started", r.status_code == 200, r.text)
        room_game = r.json()["game_id"]
        r = await hc.get(f"{BASE}/rooms/{code}", headers=h2)
        check("room shows game_id", r.json().get("game_id") == room_game, r.text)
        s = await ws_first_state(room_game, t2)
        check("room game WS ok", s.get("type") == "update"
              and s["state"]["my_seat"] == 2, json.dumps(s)[:200])
        # cleanup: host cancels
        async with websockets.connect(
                f"{WS_BASE}/ws/game/{room_game}?token={t1}", open_timeout=10) as ws:
            await asyncio.wait_for(ws.recv(), timeout=10)
            await ws.send(json.dumps({"action": "leave"}))
            await asyncio.sleep(0.5)

        # --- 3) SOLO game + a bid action over WS
        r = await hc.post(f"{BASE}/solo", headers=h1, json={"match_type": "short"})
        check("solo created", r.status_code == 200, r.text)
        solo_id = r.json()["game_id"]
        async with websockets.connect(
                f"{WS_BASE}/ws/game/{solo_id}?token={t1}", open_timeout=10) as ws:
            raw = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            st = raw["state"]
            check("solo WS state", st["phase"] == "bidding", json.dumps(st)[:150])
            # wait until it's my turn in bidding then pass
            for _ in range(40):
                if st["phase"] == "bidding" and st["turn"] == st["my_seat"]:
                    break
                raw = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                if raw.get("type") == "update":
                    st = raw["state"]
            check("my bidding turn reached",
                  st["turn"] == st["my_seat"] and st["phase"] == "bidding")
            await ws.send(json.dumps({"action": "pass"}))
            raw = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            check("pass action committed", raw.get("type") == "update",
                  json.dumps(raw)[:150])
            await ws.send(json.dumps({"action": "leave"}))
            await asyncio.sleep(0.5)

        # --- 4) tutorial game (coach persisted through DB)
        r = await hc.post(f"{BASE}/tutorial/game", headers=h1)
        check("tutorial game created", r.status_code == 200, r.text)
        tut_id = r.json()["game_id"]
        s = await ws_first_state(tut_id, t1)
        check("coach_mode active", s["state"].get("coach_mode") is True,
              json.dumps(s["state"].keys().__iter__().__length_hint__()
                         if False else {k: s["state"].get(k)
                                        for k in ("coach_mode", "phase")}))
        async with websockets.connect(
                f"{WS_BASE}/ws/game/{tut_id}?token={t1}", open_timeout=10) as ws:
            await asyncio.wait_for(ws.recv(), timeout=10)
            await ws.send(json.dumps({"action": "leave"}))
            await asyncio.sleep(0.5)

        # --- 5) matchmaking queue join/status/leave
        r = await hc.post(f"{BASE}/matchmaking/join", headers=h1,
                          json={"match_type": "short"})
        check("queue join", r.status_code == 200, r.text)
        r = await hc.get(f"{BASE}/matchmaking/status", headers=h1)
        check("queue waiting", r.json().get("status") == "waiting", r.text)
        r = await hc.delete(f"{BASE}/matchmaking/leave", headers=h1)
        check("queue leave", r.status_code == 200, r.text)
        r = await hc.get(f"{BASE}/matchmaking/status", headers=h1)
        check("queue idle after leave", r.json().get("status") == "idle", r.text)

    print(f"\n=== {len(PASS)} passed, {len(FAIL)} failed ===")
    if FAIL:
        print("FAILED:", FAIL)
        sys.exit(1)


asyncio.run(main())
