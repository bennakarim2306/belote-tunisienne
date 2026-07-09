"""Cross-process test: two independent server processes sharing MongoDB.

Simulates production multi-worker routing: the host talks to process A
(port 8001) while the invitee talks to process B (port 8002). This is the
exact scenario behind the "Partie introuvable" bug.

Run: uvicorn server:app --port 8002  (in background), then this script.
"""
import asyncio
import json
import sys

import httpx
import websockets

A = "http://localhost:8001/api"   # process A (host side)
B = "http://localhost:8002/api"   # process B (invitee side)
WSA = "ws://localhost:8001/api"
WSB = "ws://localhost:8002/api"

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(("✅" if cond else "❌") + f" {name} {detail if not cond else ''}")


async def login(hc, base, email):
    r = await hc.post(f"{base}/auth/login",
                      json={"email": email, "password": "Belote123!"})
    d = r.json()
    return d["token"], d["user"]


async def main():
    async with httpx.AsyncClient(timeout=20) as hc:
        t1, u1 = await login(hc, A, "tester1@belote.tn")
        t2, u2 = await login(hc, B, "tester2@belote.tn")
        h1 = {"Authorization": f"Bearer {t1}"}
        h2 = {"Authorization": f"Bearer {t2}"}

        # host invites on process A
        r = await hc.post(f"{A}/matchmaking/duo/invite", headers=h1,
                          json={"to_user_id": u2["user_id"],
                                "match_type": "short", "mode": "vs_ai"})
        check("invite via A", r.status_code == 200, r.text)
        iid = r.json()["invite_id"]

        # invitee sees + accepts on process B
        r = await hc.get(f"{B}/notifications", headers=h2)
        check("invite visible on B",
              any(v["invite_id"] == iid for v in r.json()["duo_invites"]), r.text)
        r = await hc.post(f"{B}/matchmaking/duo/{iid}/accept", headers=h2)
        game_id = r.json().get("game_id")
        check("accept on B creates game", bool(game_id), r.text)

        # HOST polls process A -> must find the game (the bug)
        r = await hc.get(f"{A}/matchmaking/status", headers=h1)
        st = r.json()
        check("HOST on A finds game", st.get("status") == "found"
              and st.get("game_id") == game_id, r.text)

        # host WS on A, invitee WS on B — game was created by B's process
        ws1 = await websockets.connect(
            f"{WSA}/ws/game/{game_id}?token={t1}", open_timeout=10)
        s1 = json.loads(await asyncio.wait_for(ws1.recv(), timeout=10))
        check("host WS on A gets state (game born on B)",
              s1.get("type") == "update" and s1["state"]["my_seat"] == 0,
              json.dumps(s1)[:200])

        ws2 = await websockets.connect(
            f"{WSB}/ws/game/{game_id}?token={t2}", open_timeout=10)
        s2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=10))
        check("invitee WS on B gets state", s2.get("type") == "update", "")

        # drive both humans: tester2 passes when it's his turn; the host
        # bids 90 at his turn. Bots act on their own (untimed game).
        async def drive(ws, state):
            """Return latest state; act if it's this player's turn."""
            if state["phase"] == "bidding" and state["turn"] == state["my_seat"]:
                return True, state
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout=20))
            if m.get("type") == "update":
                return False, m["state"]
            return False, state

        st1, st2 = s1["state"], s2["state"]
        host_bid_sent = False
        for _ in range(60):
            if st2["phase"] == "bidding" and st2["turn"] == st2["my_seat"]:
                await ws2.send(json.dumps({"action": "pass"}))
                m = json.loads(await asyncio.wait_for(ws2.recv(), timeout=10))
                if m.get("type") == "update":
                    st2 = m["state"]
                continue
            if st1["phase"] == "bidding" and st1["turn"] == st1["my_seat"]:
                cur = st1.get("contract")
                bid_value = (cur["value"] + 10) if cur else 90
                await ws1.send(json.dumps(
                    {"action": "bid", "value": bid_value,
                     "suit": st1["hand"][0][-1]}))
                host_bid_sent = True
                break
            done = False
            recv1 = asyncio.create_task(ws1.recv())
            recv2 = asyncio.create_task(ws2.recv())
            finished, pending = await asyncio.wait(
                [recv1, recv2], timeout=20,
                return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()
            for t in finished:
                m = json.loads(t.result())
                if m.get("type") == "update":
                    if t is recv1:
                        st1 = m["state"]
                    else:
                        st2 = m["state"]
                    done = True
            if not done:
                break
        check("host bid sent from A", host_bid_sent)

        # B must observe the host's bid through the Mongo poller
        seen = False
        try:
            for _ in range(20):
                m = json.loads(await asyncio.wait_for(ws2.recv(), timeout=10))
                if m.get("type") == "update":
                    bids = m["state"].get("bids", [])
                    if any(b.get("seat") == 0 and b.get("value") == bid_value
                           for b in bids if isinstance(b, dict)):
                        seen = True
                        break
        except asyncio.TimeoutError:
            pass
        check("bid made on A visible on B (cross-process sync)", seen)

        # host cancels for cleanup
        await ws1.send(json.dumps({"action": "leave"}))
        await asyncio.sleep(1)
        await ws1.close()
        await ws2.close()

        # room created on A must be joinable via B
        r = await hc.post(f"{A}/rooms", headers=h1, json={"match_type": "short"})
        code = r.json()["code"]
        r = await hc.post(f"{B}/rooms/{code}/join", headers=h2)
        check("room from A joinable on B", r.status_code == 200, r.text)
        await hc.post(f"{A}/rooms/{code}/leave", headers=h1)  # host leave deletes

    print(f"\n=== {len(PASS)} passed, {len(FAIL)} failed ===")
    if FAIL:
        print("FAILED:", FAIL)
        sys.exit(1)


asyncio.run(main())
