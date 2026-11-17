"""Admin stats dashboard (/api/admin/stats) + offline telemetry tests.

Verifies the BUG FIX: server `matches` are split by composition —
humans >= 2 -> "Parties en ligne (entre joueurs)", humans <= 1 -> "Parties contre
l'IA" (legacy server solo + tutorial), merged with offline telemetry.
Inserts TEST_ docs directly in Mongo, compares dashboard deltas, then deletes them.
"""
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from dotenv import load_dotenv
from pymongo import MongoClient

from conftest import API, auth_headers

load_dotenv("/app/backend/.env")
ADMIN_KEY = os.environ["FEEDBACK_ADMIN_KEY"]
_db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

TAG = f"TEST_adm_{uuid.uuid4().hex[:6]}"
PEAK_DAY = "2019-03-03"   # past day used for the "Record en 1 jour" check
AI_PEAK_DAY = "2019-04-04"  # past day stuffed with vs-AI games (must NOT become peak)


def _iso(days_ago):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def _match(humans, days_ago=1, ranked=False, hands=4, finished_at=None, uids=None):
    uids = uids or [f"{TAG}_u{i}" for i in range(humans)]
    players = [{"user_id": uids[i], "username": f"{TAG}_P{i}", "seat": i,
                "team": i % 2, "is_bot": False} for i in range(humans)]
    players += [{"user_id": f"bot_{i}", "username": f"Bot{i}", "seat": i,
                 "team": i % 2, "is_bot": True} for i in range(humans, 4)]
    return {"match_id": f"{TAG}_{uuid.uuid4().hex[:8]}", "game_id": TAG,
            "match_type": "short", "ranked": ranked, "players": players,
            "hands_played": hands, "finished_at": finished_at or _iso(days_ago)}


def _parse(html):
    """-> {section_title: {label: value}} (labels repeat across sections)."""
    out = {}
    for sec in re.split(r"<h2>", html)[1:]:
        title = sec.split("</h2>")[0].strip()
        cards = re.findall(r'<div class="val">(.*?)</div><div class="lbl">(.*?)</div>'
                           r'(?:<div class="sub">(.*?)</div>)?', sec)
        out[title] = {lbl: (val, sub) for val, lbl, sub in cards}
        out[title]["__raw"] = sec
    return out


def _num(v):
    return float(v[0]) if "." in v[0] else int(v[0])


ONLINE = "Parties en ligne (entre joueurs)"
AI = "Parties contre l'IA"


@pytest.fixture(scope="module")
def stats(http):
    def get():
        r = http.get(f"{API}/admin/stats", params={"key": ADMIN_KEY}, timeout=20)
        assert r.status_code == 200, r.text[:300]
        return _parse(r.text)
    return get


@pytest.fixture(scope="module")
def seeded(stats, http, tester1):
    before = stats()
    start_iso = datetime.now(timezone.utc).isoformat()
    t1 = tester1["user"]["user_id"]
    docs = [
        _match(4, days_ago=1, ranked=True, hands=6),          # online 4 humans (7d)
        _match(2, days_ago=2, ranked=False, hands=2),         # duo vs AI: 2 humans (7d)
        _match(3, days_ago=20, ranked=True, hands=4),         # online 30d not 7d
        _match(4, days_ago=60, ranked=True, hands=8),         # online old (total only)
        _match(1, days_ago=1, ranked=False, hands=3, uids=[t1]),  # legacy solo (30d)
        _match(1, days_ago=3, ranked=False, hands=5, uids=[t1]),  # tutorial coach (30d)
        _match(1, days_ago=90, ranked=False, hands=5),        # legacy solo old
    ]
    _db.matches.insert_many([dict(d) for d in docs])
    yield {"before": before, "t1": t1, "start_iso": start_iso}
    _db.matches.delete_many({"game_id": TAG})
    _db.offline_matches.delete_many({"user_id": t1, "finished_at": {"$gte": start_iso}})
    _db.offline_matches.delete_many({"user_id": {"$regex": f"^{TAG}"}})


# ---- access control ----
class TestAccess:
    def test_no_key_forbidden(self, http):
        assert http.get(f"{API}/admin/stats", timeout=15).status_code == 403

    def test_wrong_key_forbidden(self, http):
        r = http.get(f"{API}/admin/stats", params={"key": "nope"}, timeout=15)
        assert r.status_code == 403

    def test_ok_html_sections(self, stats):
        s = stats()
        for sec in ("Joueurs", "En ce moment", ONLINE, AI):
            assert sec in s, f"missing section {sec}: {list(s)}"


# ---- telemetry endpoint ----
class TestTelemetry:
    def test_requires_auth(self, http):
        r = http.post(f"{API}/telemetry/offline-match",
                      json={"match_type": "short", "won": True, "hands_played": 3}, timeout=15)
        assert r.status_code == 401

    def test_persists(self, http, tester1, seeded):
        r = http.post(f"{API}/telemetry/offline-match",
                      json={"match_type": "long", "won": False, "hands_played": 7},
                      headers=auth_headers(tester1["token"]), timeout=15)
        assert r.status_code == 200 and r.json() == {"ok": True}
        doc = _db.offline_matches.find_one(
            {"user_id": seeded["t1"], "finished_at": {"$gte": seeded["start_iso"]}},
            {"_id": 0})
        assert doc and doc["match_type"] == "long" and doc["won"] is False
        assert doc["hands_played"] == 7

    def test_invalid_body_422(self, http, tester1):
        r = http.post(f"{API}/telemetry/offline-match", json={"hands_played": "abc"},
                      headers=auth_headers(tester1["token"]), timeout=15)
        assert r.status_code == 422


# ---- the bug fix: composition split ----
class TestCompositionSplit:
    def test_online_counts_only_multi_human(self, stats, seeded):
        b, a = seeded["before"][ONLINE], stats()[ONLINE]
        d = lambda k: _num(a[k]) - _num(b[k])
        assert d("Parties jouées (total)") == 4, "4 docs with >=2 humans inserted"
        assert d("Parties jouées (30 j)") == 3
        assert d("Parties jouées (7 j)") == 2

    def test_ai_counts_server_single_human(self, stats, seeded, http, tester1):
        # one offline telemetry match on top of the 3 server vs-AI docs
        http.post(f"{API}/telemetry/offline-match",
                  json={"match_type": "short", "won": True, "hands_played": 3},
                  headers=auth_headers(tester1["token"]), timeout=15)
        b, a = seeded["before"][AI], stats()[AI]
        d = lambda k: _num(a[k]) - _num(b[k])
        assert d("…dont via serveur") == 3
        off_delta = d("…dont hors-ligne")
        assert off_delta >= 1
        assert d("Parties jouées (total)") == 3 + off_delta
        assert _num(a["Parties jouées (total)"]) == (
            _num(a["…dont via serveur"]) + _num(a["…dont hors-ligne"]))

    def test_ai_30d_consistency(self, stats, seeded):
        s = stats()[AI]
        server_30 = _db.matches.count_documents({
            "finished_at": {"$gt": _iso(30)},
            "players": {"$not": {"$elemMatch": {"is_bot": False}}}}) + sum(
            1 for m in _db.matches.find({"finished_at": {"$gt": _iso(30)}}, {"players": 1})
            if sum(1 for p in m["players"] if p["is_bot"] is False) == 1)
        off_30 = _db.offline_matches.count_documents({"finished_at": {"$gt": _iso(30)}})
        assert _num(s["Parties jouées (30 j)"]) == server_30 + off_30

    def test_avg_hands_online_only(self, stats, seeded):
        online = [m for m in _db.matches.find({}, {"players": 1, "hands_played": 1})
                  if sum(1 for p in m["players"] if p["is_bot"] is False) >= 2]
        exp = round(sum(m["hands_played"] for m in online) / len(online), 1)
        assert _num(stats()[ONLINE]["Durée moyenne (manches)"]) == exp

    def test_ranked_matches_card(self, stats, seeded):
        exp = _db.matches.count_documents({"ranked": True})
        assert _num(stats()[ONLINE]["Parties classées (total)"]) == exp

    def test_peak_day_ignores_ai_games(self, stats, seeded):
        cur = _num(stats()[ONLINE]["Record en 1 jour"])
        extra = [_match(1, finished_at=f"{AI_PEAK_DAY}T10:00:00+00:00")
                 for _ in range(cur + 3)]
        extra += [_match(2, finished_at=f"{PEAK_DAY}T1{i % 10}:00:00+00:00")
                  for i in range(cur + 1)]
        _db.matches.insert_many(extra)
        val, sub = stats()[ONLINE]["Record en 1 jour"]
        assert sub == PEAK_DAY, f"peak day {sub} (AI-day must not win)"
        assert int(val) == cur + 1
        _db.matches.delete_many({"finished_at": {"$regex": f"^({PEAK_DAY}|{AI_PEAK_DAY})"},
                                 "game_id": TAG})

    def test_top5_includes_tester1(self, stats, seeded):
        raw = stats()[[k for k in seeded["before"] if k.startswith("Top 5")][0]]["__raw"]
        assert "Tester1" in raw


# ---- per-player averages (recomputed independently from DB) ----
class TestAverages:
    def _all30(self):
        per = {}
        for m in _db.matches.find({"finished_at": {"$gt": _iso(30)}}, {"players": 1}):
            hum = [p for p in m["players"] if p["is_bot"] is False]
            for p in hum:
                r = per.setdefault(p["user_id"], {"on": 0, "ai": 0})
                r["on" if len(hum) >= 2 else "ai"] += 1
        return per

    def test_online_avg_per_player(self, stats, seeded):
        per = [r["on"] for r in self._all30().values() if r["on"] > 0]
        exp = round(sum(per) / len(per), 1) if per else 0
        assert _num(stats()[ONLINE]["Moyenne par joueur (30 j)"]) == exp

    def test_ai_avg_per_player(self, stats, seeded):
        c = {u: r["ai"] for u, r in self._all30().items() if r["ai"] > 0}
        for o in _db.offline_matches.find({"finished_at": {"$gt": _iso(30)}}):
            c[o["user_id"]] = c.get(o["user_id"], 0) + 1
        exp = round(sum(c.values()) / len(c), 1) if c else 0
        assert _num(stats()[AI]["Moyenne par joueur (30 j)"]) == exp


# ---- robustness: legacy/malformed match docs must not 500 the dashboard ----
class TestRobustness:
    def test_match_without_players_field(self, http, seeded):
        _db.matches.insert_one({"match_id": f"{TAG}_np", "game_id": TAG,
                                "finished_at": _iso(1), "hands_played": 1})
        try:
            r = http.get(f"{API}/admin/stats", params={"key": ADMIN_KEY}, timeout=20)
            assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        finally:
            _db.matches.delete_one({"match_id": f"{TAG}_np"})


# ---- "En ce moment": parties en cours must reflect ACTIVE games only ----
class TestLiveGamesNow:
    SECTION = "En ce moment"
    LABEL = "Parties en cours (serveur)"

    def test_counts_only_recently_active_unfinished(self, stats):
        before = int(stats()[self.SECTION][self.LABEL][0])
        now = time.time()
        base = {"state": {}, "version": 1, "user_ids": [], "events": [], "conn": {}}
        docs = [
            # active unfinished -> counted
            {"_id": f"{TAG}_g_fresh", "phase": "playing", "updated_at": now, **base},
            # abandoned 5 min ago (not yet swept) -> NOT counted ("0 connectés
            # mais 2 parties en cours" bug reported by the owner)
            {"_id": f"{TAG}_g_stale", "phase": "playing",
             "updated_at": now - 300, **base},
            # finished -> NOT counted
            {"_id": f"{TAG}_g_done", "phase": "finished", "updated_at": now, **base},
        ]
        _db.live_games.insert_many(docs)
        try:
            after = int(stats()[self.SECTION][self.LABEL][0])
            assert after == before + 1, f"expected {before}+1, got {after}"
        finally:
            _db.live_games.delete_many({"_id": {"$regex": f"^{TAG}_g_"}})

    def test_sweep_removes_docs_without_updated_at(self):
        _db.live_games.insert_one(
            {"_id": f"{TAG}_g_noupd", "phase": "playing", "state": {},
             "version": 1, "user_ids": [], "events": [], "conn": {}})
        deadline = time.time() + 15
        gone = False
        while time.time() < deadline:
            if _db.live_games.find_one({"_id": f"{TAG}_g_noupd"}) is None:
                gone = True
                break
            time.sleep(1)
        _db.live_games.delete_many({"_id": f"{TAG}_g_noupd"})
        assert gone, "sweep did not delete live_games doc missing updated_at"
