"""Iteration 33 FE helper: wait until tester1 is in the matchmaking queue (DB),
then join 3 fresh TEST_ accounts; writes join timestamp + game id to /tmp."""
import json
import sys
import time
import uuid

import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/backend/tests")
from conftest import API, UA  # noqa: E402

mdb = MongoClient("mongodb://localhost:27017")["test_database"]
T1 = mdb.users.find_one({"email": "tester1@belote.tn"})["user_id"]


def reg():
    s = uuid.uuid4().hex[:8]
    r = requests.post(f"{API}/auth/register", json={
        "email": f"test_fe33_{s}@belote.tn", "password": "Test1234!",
        "username": f"TEST_f{s[:6]}"}, headers={"User-Agent": UA}, timeout=15)
    return r.json()["token"]


toks = [reg() for _ in range(3)]
end = time.time() + 150
while time.time() < end and not mdb.mm_queue.find_one({"user_ids": T1}):
    time.sleep(0.3)
for t in toks:
    requests.post(f"{API}/matchmaking/join", json={"match_type": "short"},
                  headers={"Authorization": f"Bearer {t}", "User-Agent": UA},
                  timeout=15)
t4 = time.time()
gid = None
while time.time() < t4 + 15 and not gid:
    m = mdb.mm_matched.find_one({"_id": T1})
    gid = m and m.get("game_id")
    time.sleep(0.2)
json.dump({"t4": t4, "gid": gid, "toks": toks}, open("/tmp/iter33_mm.json", "w"))
print("filled at", t4, "game", gid)
