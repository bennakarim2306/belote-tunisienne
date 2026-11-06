"""Probe: arbitrary WS action names become new metric types (cardinality)."""
import asyncio, json, os, sys, uuid
import requests, websockets
from dotenv import load_dotenv
from pymongo import MongoClient
sys.path.insert(0, "/app/backend/tests")
from conftest import API, UA, TESTER1

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
s = requests.Session(); s.headers["User-Agent"] = UA
tok = s.post(f"{API}/auth/login", json={"email": TESTER1["email"], "password": TESTER1["password"]}).json()["token"]
h = {"Authorization": f"Bearer {tok}"}
gid = s.post(f"{API}/solo", json={"match_type": "short"}, headers=h).json()["game_id"]
tag = f"TEST_{uuid.uuid4().hex[:6]}"

async def main():
    url = API.replace("https://", "wss://") + f"/ws/game/{gid}?token={tok}"
    async with websockets.connect(url, additional_headers=[("User-Agent", UA)]) as ws:
        for i in range(5):
            await ws.send(json.dumps({"action": f"{tag}_{i}"}))
        await ws.send(json.dumps({"action": {"x": 1}}))  # non-string action
        await asyncio.sleep(2)
        print("ws still open:", ws.state.name if hasattr(ws, "state") else "?")
asyncio.run(main())
import time; time.sleep(17)
docs = list(db.server_metrics.find({"type": {"$regex": tag}}, {"_id": 1, "type": 1}))
print("new junk types created:", len(docs), [d["type"] for d in docs])
odd = list(db.server_metrics.find({"type": {"$regex": "^ws: \\{"}}, {"_id": 1, "type": 1}))
print("dict-action types:", [d["type"] for d in odd])
# cleanup only the docs this probe created
db.server_metrics.delete_many({"_id": {"$in": [d["_id"] for d in docs + odd]}})
db.live_games.update_one({"game_id": gid}, {"$set": {"phase": "finished"}})
