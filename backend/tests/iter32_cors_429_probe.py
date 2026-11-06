"""Iteration 32: check whether 429 responses carry CORS headers (web client)."""
import asyncio
import uuid

import httpx
import requests

from conftest import API, UA, auth_headers

s = uuid.uuid4().hex[:6]
u = requests.post(f"{API}/auth/register", json={"email": f"test_cors_{s}@belote.tn",
                  "password": "Test1234!", "username": f"TEST_c{s}"},
                  headers={"User-Agent": UA}).json()
h = {**auth_headers(u["token"]), "Origin": "https://example.com"}


async def main():
    async with httpx.AsyncClient(timeout=30, headers=h) as c:
        rs = await asyncio.gather(*[c.get(f"{API}/sync") for _ in range(95)])
    ok = next(r for r in rs if r.status_code == 200)
    lim = next((r for r in rs if r.status_code == 429), None)
    print("200 ACAO:", ok.headers.get("access-control-allow-origin"))
    print("429 ACAO:", lim.headers.get("access-control-allow-origin") if lim else "no 429")

asyncio.run(main())
