"""Probe: how long does a game WS stay open through the ingress (idle vs pinging)?"""
import asyncio
import json
import sys
import time

import requests
import websockets

sys.path.insert(0, "/app/backend/tests")
from conftest import API, UA, TESTER1  # noqa: E402

tok = requests.post(f"{API}/auth/login", json={"email": TESTER1["email"], "password": TESTER1["password"]},
                    headers={"User-Agent": UA}).json()["token"]
gid = requests.post(f"{API}/solo", json={"match_type": "short"},
                    headers={"Authorization": f"Bearer {tok}", "User-Agent": UA}).json()["game_id"]
base = API.replace("https://", "wss://")


async def probe(name, ping_interval, app_ping):
    t0 = time.time()
    try:
        async with websockets.connect(f"{base}/ws/game/{gid}?token={tok}",
                                      additional_headers=[("User-Agent", UA)],
                                      ping_interval=ping_interval, max_size=2 ** 22) as ws:
            while time.time() - t0 < 95:
                try:
                    await asyncio.wait_for(ws.recv(), 5)
                except asyncio.TimeoutError:
                    if app_ping:
                        await ws.send(json.dumps({"action": "noop"}))
            return f"{name}: open for {round(time.time() - t0)}s (no drop)"
    except Exception as e:
        return f"{name}: dropped after {round(time.time() - t0, 1)}s {e!r}"


async def main():
    print(await asyncio.gather(probe("default-ping", 20, False),
                               probe("no-ping", None, False),
                               probe("app-msg-5s", None, True)))
    async with websockets.connect(f"{base}/ws/game/{gid}?token={tok}",
                                  additional_headers=[("User-Agent", UA)]) as ws:
        await ws.send(json.dumps({"action": "leave"}))
        await asyncio.sleep(1)

asyncio.run(main())
