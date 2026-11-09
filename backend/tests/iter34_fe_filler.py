"""Iteration 34 FE helper. Usage: python iter34_fe_filler.py accept|noaccept
accept  : 3 TEST_ accounts join once tester1 queues, confirm after 4s, then
          drive their seats via WS (seat of acc0 never acts -> 💤/🤖 badges)
          for PLAY_SECONDS, then finish the game in DB.
noaccept: 3 accounts join + confirm, tester1 (browser) must NOT accept; once
          the window expired they leave the queue. Log in /tmp/iter34_<mode>.json"""
import asyncio
import json
import sys
import time
import uuid

import requests
import websockets
from pymongo import MongoClient

sys.path.insert(0, "/app/backend/tests")
from conftest import API, UA  # noqa: E402

MODE = sys.argv[1]
PLAY_SECONDS = int(sys.argv[2]) if len(sys.argv) > 2 else 110
mdb = MongoClient("mongodb://localhost:27017")["test_database"]
T1 = mdb.users.find_one({"email": "tester1@belote.tn"})["user_id"]
LOG = {"mode": MODE, "steps": []}


def step(s):
    LOG["steps"].append((round(time.time(), 1), s))
    json.dump(LOG, open(f"/tmp/iter34_{MODE}.json", "w"), default=str)
    print(s, flush=True)


def H(t):
    return {"Authorization": f"Bearer {t}", "User-Agent": UA}


def reg():
    s = uuid.uuid4().hex[:8]
    r = requests.post(f"{API}/auth/register", json={
        "email": f"test_fe34_{s}@belote.tn", "password": "Test1234!",
        "username": f"TEST_f{s[:6]}"}, headers={"User-Agent": UA}, timeout=15)
    return r.json()["token"]


def st(t):
    return requests.get(f"{API}/matchmaking/status?v=2", headers=H(t), timeout=15).json()


async def drive(gid, toks):
    base = API.replace("https://", "wss://")
    target_tok = toks[0]

    async def one(tok):
        end0 = time.time() + PLAY_SECONDS
        while time.time() < end0:
            try:
                await one_conn(tok, end0)
            except websockets.ConnectionClosed:
                step("ws dropped (ingress 60s) -> reconnect")

    async def one_conn(tok, end):
        async with websockets.connect(f"{base}/ws/game/{gid}?token={tok}",
                                      additional_headers=[("User-Agent", UA)],
                                      max_size=2 ** 22) as ws:
            last = None
            while time.time() < end:
                try:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), 3))
                except asyncio.TimeoutError:
                    continue
                if msg.get("type") != "update":
                    continue
                s = msg["state"]
                me = s["my_seat"]
                if tok == target_tok:
                    for e in msg.get("events") or []:
                        if e.get("e") in ("afk_bot", "afk_back"):
                            step(f"event {e}")
                    step(f"players missed/afk: "
                         f"{[(p['seat'], p['missed'], p['afk']) for p in s['players']]}")
                    continue
                key = (s["hand_number"], s["phase"], s["turn"], len(s["bids"]),
                       len(s["trick"] or []), s["tricks_played"])
                if s["phase"] in ("bidding", "playing") and s["turn"] == me and key != last:
                    last = key
                    await asyncio.sleep(0.5)
                    if s["phase"] == "bidding":
                        await ws.send(json.dumps({"action": "pass"}))
                    elif s.get("legal"):
                        await ws.send(json.dumps({"action": "play", "card": s["legal"][0]}))
                if s["phase"] == "hand_end" and me not in (s.get("ready_seats") or []):
                    await ws.send(json.dumps({"action": "ready"}))
    res = await asyncio.gather(*(one(t) for t in toks), return_exceptions=True)
    step(f"drive ended: {[repr(r)[:200] for r in res]}")


toks = [reg() for _ in range(3)]
step("registered")
end = time.time() + 120
while time.time() < end and not mdb.mm_queue.find_one({"user_ids": T1}):
    time.sleep(0.3)
step(f"tester1 queued={bool(mdb.mm_queue.find_one({'user_ids': T1}))}")
for t in toks:
    requests.post(f"{API}/matchmaking/join", json={"match_type": "short"},
                  headers=H(t), timeout=15)
step("joined 3")
end = time.time() + 20
while time.time() < end and st(toks[0])["status"] != "confirm":
    time.sleep(1)
step(f"status acc0: {st(toks[0])}")
if MODE == "accept":
    time.sleep(4)
for t in toks:
    requests.post(f"{API}/matchmaking/confirm", headers=H(t), timeout=15)
step("3 confirmed")
if MODE == "accept":
    gid = None
    end = time.time() + 20
    while time.time() < end and not gid:
        m = mdb.mm_matched.find_one({"_id": T1})
        gid = m and m.get("game_id")
        time.sleep(0.5)
    step(f"game {gid}")
    if gid:
        asyncio.run(drive(gid, toks))
        mdb.live_games.delete_one({"_id": gid})
        step("game finished in DB")
else:
    end = time.time() + 20
    while time.time() < end and st(toks[0])["status"] != "waiting":
        time.sleep(1)
    step(f"after expiry acc0: {st(toks[0])}")
    for t in toks:
        requests.delete(f"{API}/matchmaking/leave", headers=H(t), timeout=15)
    step("3 left queue")
    time.sleep(4)
    q = mdb.mm_queue.find_one({"user_ids": T1})
    step(f"tester1 queue entry: {q and {'ts_age': round(time.time() - q['ts'])}}")
    ev = mdb.reliability_events.find_one({"user_id": T1, "kind": "no_accept"},
                                         sort=[("ts", -1)])
    step(f"tester1 last no_accept: {ev and ev['ts']}")
step("done")
