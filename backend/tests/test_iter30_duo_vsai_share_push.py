"""Iteration 30 — duo vs AI waiting screen data, Play Store share link, peak-hour push apostrophes."""
import asyncio
import json
import re
import sys
from datetime import datetime, timezone

sys.path.insert(0, "/app/backend")
import push  # noqa: E402
from conftest import API, auth_headers
from test_duo_matchmaking import _ensure_friends

FRONT = "/app/frontend"
PLAY_URL = "https://play.google.com/store/apps/details?id=com.emergent.cardtableorient.b0nhgs"


# --- Bug 1: duo vs AI pending status feeds the 2-slot waiting screen ---
def test_duo_vs_ai_pending_status(http, tester1, tester2):
    _ensure_friends(http, tester1, tester2)
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])
    for h in (h1, h2):
        http.delete(f"{API}/matchmaking/leave", headers=h)
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "vs_ai"}, headers=h1)
    assert r.status_code == 200, r.text
    invite_id = r.json()["invite_id"]
    try:
        st = http.get(f"{API}/matchmaking/status", headers=h1).json()
        assert st["status"] == "duo_pending"
        assert st["mode"] == "vs_ai"
        assert st["partner"]["username"] == tester2["user"]["username"]
    finally:
        http.post(f"{API}/matchmaking/duo/{invite_id}/decline", headers=h2)
        for h in (h1, h2):
            http.delete(f"{API}/matchmaking/leave", headers=h)


def test_duo_online_pending_status_mode(http, tester1, tester2):
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])
    for h in (h1, h2):
        http.delete(f"{API}/matchmaking/leave", headers=h)
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "online"}, headers=h1)
    assert r.status_code == 200, r.text
    invite_id = r.json()["invite_id"]
    try:
        st = http.get(f"{API}/matchmaking/status", headers=h1).json()
        assert st["status"] == "duo_pending"
        assert st.get("mode") == "online"
    finally:
        http.post(f"{API}/matchmaking/duo/{invite_id}/decline", headers=h2)
        for h in (h1, h2):
            http.delete(f"{API}/matchmaking/leave", headers=h)


# --- Bug 2: share link = Play Store, room deep links unchanged ---
def test_share_constants():
    src = open(f"{FRONT}/src/share.ts").read()
    assert PLAY_URL in src
    assert re.search(r"roomLink\s*=\s*\(code: string\)\s*=>\s*`\$\{WEB_APP_URL\}/join/\$\{code\}`", src)
    assert "WEB_APP_URL = process.env.EXPO_PUBLIC_BACKEND_URL" in src
    app = json.load(open(f"{FRONT}/app.json"))["expo"]
    assert PLAY_URL.endswith(app["android"]["package"])


def test_share_queue_msg_has_link_placeholder_all_langs():
    src = open(f"{FRONT}/src/i18n.tsx").read()
    msgs = re.findall(r'shareQueueMsg:\s*"([^"]*)"', src)
    assert len(msgs) == 3
    for m in msgs:
        assert "{link}" in m
    totals = re.findall(r'playersCount:\s*"([^"]*)"', src)
    assert len(totals) == 3 and all("{n}" in s and "{total}" in s for s in totals)
    assert len(re.findall(r"duoVsAiHint:", src)) == 3


# --- Bug 3: peak-hour push message uses U+2019 (no '&#x27;' after escaping) ---
class _Coll:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.doc = None

    async def find_one(self, q):
        return self.doc

    async def update_one(self, q, u, upsert=False):
        self.doc = {"_id": q["_id"], **u["$set"]}

    def find(self, q, proj=None):
        rows = self.rows

        class _C:
            async def to_list(self, n):
                return rows
        return _C()


class _DB:
    def __init__(self):
        self.kv = _Coll()
        self.users = _Coll([{"user_id": "u1"}, {"user_id": "u2"}])


def test_peak_push_message_apostrophes(monkeypatch):
    sent = []

    async def fake_send(recipients, data, idempotency_key=None):
        sent.append(data)
    monkeypatch.setattr(push, "send_push", fake_send)
    monkeypatch.setattr(push, "PEAK_HOUR_UTC", datetime.now(timezone.utc).hour)
    db = _DB()
    asyncio.run(push.maybe_send_peak_hour_push(db))
    assert len(sent) == 1
    msg = sent[0]["message"]
    assert "'" not in msg and "\u2019" in msg
    assert msg.startswith("C\u2019est l\u2019heure")
    # idempotent same day
    asyncio.run(push.maybe_send_peak_hour_push(db))
    assert len(sent) == 1
