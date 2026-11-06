"""Server-usage metrics (server_metrics.py) + admin dashboard 'Utilisation du serveur'.

Generates HTTP + WS traffic, waits for the 15s flush, then checks Mongo
`server_metrics` docs and the admin HTML tables.
"""
import asyncio
import html as htmllib
import json
import os
import re
import time

import pytest
import websockets
from dotenv import load_dotenv
from pymongo import MongoClient

from conftest import API, UA, auth_headers

load_dotenv("/app/backend/.env")
ADMIN_KEY = os.environ["FEEDBACK_ADMIN_KEY"]
_db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _admin(http, key=ADMIN_KEY):
    return http.get(f"{API}/admin/stats", params={"key": key}, timeout=30)


def _table_after(page, title):
    """Parse rows of the <table> following a heading containing title."""
    i = page.find(title)
    assert i >= 0, f"heading not found: {title}"
    j = page.find("</table>", i)
    chunk = page[i:j]
    rows = re.findall(r"<tr>(.*?)</tr>", chunk, re.S)
    out = []
    for r in rows:
        cells = [htmllib.unescape(c) for c in re.findall(r"<td>(.*?)</td>", r, re.S)]
        if cells:
            out.append(cells)
    return out


def _ws_url(game_id, token):
    return API.replace("https://", "wss://").replace("http://", "ws://") + \
        f"/ws/game/{game_id}?token={token}"


async def _ws_session(game_id, token):
    got = {"updates": 0, "pong": 0}
    async with websockets.connect(_ws_url(game_id, token),
                                  additional_headers=[("User-Agent", UA)],
                                  open_timeout=15, max_size=2**22) as ws:
        await ws.send(json.dumps({"action": "ping"}))
        await ws.send(json.dumps({"action": "ping"}))
        end = time.time() + 12
        acted = False
        while time.time() < end:
            try:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=4))
            except asyncio.TimeoutError:
                break
            if msg.get("type") == "pong":
                got["pong"] += 1
            if msg.get("type") == "update":
                got["updates"] += 1
                st = msg["state"]
                if not acted and st.get("turn") == st.get("my_seat") \
                        and st.get("phase") == "bidding":
                    await ws.send(json.dumps({"action": "pass"}))
                    acted = True
    return got


# ---- classification unit tests (pure function) ----
class TestClassify:
    def test_classify_paths(self):
        import sys
        sys.path.insert(0, "/app/backend")
        import server_metrics as sm
        assert sm.classify_path("/api/presence/pulse") == "présence (pulse/ping)"
        assert sm.classify_path("/api/matchmaking/join") == "matchmaking"
        assert sm.classify_path("/api/friends") == "amis"
        assert sm.classify_path("/api/rooms/x") == "salons privés"
        assert sm.classify_path("/api/auth/login") == "compte"
        assert sm.classify_path("/api/leaderboard") == "classement"
        assert sm.classify_path("/api/solo") == "création de partie"
        assert sm.classify_path("/api/games/current") == "reprise de partie"
        assert sm.classify_path("/api/feedback") == "feedback"
        assert sm.classify_path("/api/whatever") == "autre"
        assert sm.classify_path("/api/admin/stats") is None
        assert sm.classify_path("/api/ws/game/1") is None
        assert sm.classify_path("/health") is None


# ---- end-to-end: traffic -> flush -> mongo + dashboard ----
class TestServerMetricsE2E:
    @pytest.fixture(scope="class")
    def traffic(self, http, tester1):
        h = auth_headers(tester1["token"])
        uid = tester1["user"]["user_id"]
        before = {d["type"]: d["n"] for d in _db.server_metrics.aggregate([
            {"$group": {"_id": "$type", "n": {"$sum": "$n"}}},
            {"$project": {"type": "$_id", "n": 1}}])}
        for _ in range(3):
            assert http.get(f"{API}/presence/pulse", headers=h, timeout=15).status_code == 200
        for _ in range(2):
            assert http.get(f"{API}/leaderboard", headers=h, timeout=15).status_code == 200
            assert http.get(f"{API}/friends", headers=h, timeout=15).status_code == 200
        # admin must NOT be counted
        _admin(http)
        r = http.post(f"{API}/solo", json={"match_type": "short"}, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        gid = r.json()["game_id"]
        ws = asyncio.run(_ws_session(gid, tester1["token"]))
        time.sleep(17)
        after = {d["type"]: d["n"] for d in _db.server_metrics.aggregate([
            {"$group": {"_id": "$type", "n": {"$sum": "$n"}}},
            {"$project": {"type": "$_id", "n": 1}}])}
        yield {"before": before, "after": after, "uid": uid, "ws": ws,
               "gid": gid, "h": h}
        # cleanup the live solo game (mark finished, it is TEST traffic of tester1)
        _db.live_games.update_one({"game_id": gid}, {"$set": {"phase": "finished"}})

    def test_ws_received(self, traffic):
        assert traffic["ws"]["pong"] >= 2, traffic["ws"]
        assert traffic["ws"]["updates"] >= 1, traffic["ws"]

    def test_mongo_http_counters_incremented(self, traffic):
        b, a = traffic["before"], traffic["after"]
        assert a.get("présence (pulse/ping)", 0) - b.get("présence (pulse/ping)", 0) >= 3
        assert a.get("classement", 0) - b.get("classement", 0) >= 2
        assert a.get("amis", 0) - b.get("amis", 0) >= 2
        assert a.get("création de partie", 0) - b.get("création de partie", 0) >= 1

    def test_mongo_ws_counters_incremented(self, traffic):
        b, a = traffic["before"], traffic["after"]
        assert a.get("ws: connexion", 0) - b.get("ws: connexion", 0) >= 1
        assert a.get("ws: ping", 0) - b.get("ws: ping", 0) >= 2

    def test_ws_state_sent_counted(self, traffic):
        b, a = traffic["before"], traffic["after"]
        assert a.get("ws: état envoyé", 0) - b.get("ws: état envoyé", 0) >= 1, \
            f"ws: état envoyé not counted: {a.get('ws: état envoyé')} vs {b.get('ws: état envoyé')}"

    def test_admin_not_counted(self, traffic):
        types = _db.server_metrics.distinct("type")
        assert not any("admin" in t for t in types)

    def test_per_player_attribution(self, traffic):
        uid = traffic["uid"]
        for t in ("présence (pulse/ping)", "classement", "amis", "ws: connexion", "ws: ping"):
            doc = _db.server_metrics.find_one({"type": t, "users": uid})
            assert doc, f"user not attributed for type {t}"

    def test_doc_shape(self, traffic):
        doc = _db.server_metrics.find_one({"type": "classement"}, sort=[("ts", -1)])
        assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$", doc["bucket"])
        assert isinstance(doc["n"], int) and doc["n"] > 0
        assert isinstance(doc["users"], list)
        assert doc["ts"] is not None

    def test_admin_page_usage_section(self, http, traffic):
        r = _admin(http)
        assert r.status_code == 200
        page = r.text
        for s in ["Utilisation du serveur", "Connexions WS actives", "Événements (60 min)",
                  "Événements (24 h)", "Parties IA via serveur (24 h)", "Base de données (Mo)",
                  "Parties serveur par composition (total)",
                  "Évts/min", "Évts/joueur/min", "Joueurs"]:
            assert s in htmllib.unescape(page), f"missing: {s}"
        rows60 = _table_after(page, "60 dernières minutes")
        types = {r[0]: r for r in rows60}
        for t in ("présence (pulse/ping)", "classement", "amis", "ws: connexion",
                  "ws: ping", "création de partie"):
            assert t in types, f"{t} missing in 60 min table: {list(types)}"
            assert int(types[t][1]) > 0
            assert types[t][3] != "—" and int(types[t][3]) >= 1, f"players for {t}: {types[t]}"
        rows24 = _table_after(page, "24 dernières heures")
        assert len(rows24) >= len(rows60)
        comp = _table_after(page, "Parties serveur par composition")
        assert comp and all(c[1].isdigit() for c in comp if len(c) == 2)

    def test_admin_regression_sections(self, http):
        page = htmllib.unescape(_admin(http).text)
        for s in ["<h2>Joueurs</h2>", "En ce moment", "Parties en ligne (entre joueurs)",
                  "Parties contre l'IA", "Top 5 joueurs"]:
            assert s in page, f"missing section {s}"

    def test_admin_invalid_key(self, http):
        assert _admin(http, "wrong").status_code in (401, 403)
        assert http.get(f"{API}/admin/stats", timeout=15).status_code in (401, 403, 422)


# ---- regression: auth + matchmaking + CORS through middleware ----
class TestRegressionSmoke:
    def test_login_and_mm(self, http, tester2):
        h = auth_headers(tester2["token"])
        assert http.get(f"{API}/auth/me", headers=h, timeout=15).status_code == 200
        r = http.post(f"{API}/matchmaking/join", json={"match_type": "short"}, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        r = http.get(f"{API}/matchmaking/status", headers=h, timeout=15)
        assert r.status_code == 200 and isinstance(r.json(), dict)
        r = http.delete(f"{API}/matchmaking/leave", headers=h, timeout=15)
        assert r.status_code == 200

    def test_cors_preflight(self, http):
        r = http.options(f"{API}/auth/login", headers={
            "Origin": "https://example.com", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"}, timeout=15)
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") in ("*", "https://example.com")

    def test_unauth_401_still_counted_no_crash(self, http):
        r = http.get(f"{API}/friends", timeout=15)
        assert r.status_code == 401
