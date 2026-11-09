"""Player feedback (POST /api/feedback -> Mongo 'feedback' + Resend email).

WARNING: every successful POST sends a REAL email to the owner. This file
sends at most 2 (1 anonymous + 1 Tester1). Run sparingly.
"""
import os
import time

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

from conftest import API, UA, TESTER1, _ensure

H = {"User-Agent": UA, "Content-Type": "application/json"}
_benv = dotenv_values("/app/backend/.env")


@pytest.fixture(scope="module")
def fb_db():
    c = MongoClient(_benv["MONGO_URL"])
    yield c[_benv["DB_NAME"]]
    c.close()


@pytest.fixture(scope="module")
def t1_token():
    s = requests.Session()
    tok, _ = _ensure(s, TESTER1)
    return tok


def _latest(db, **flt):
    return db.feedback.find_one(flt, {"_id": 0}, sort=[("created_at", -1)])


# validation: no email sent, no cooldown consumed
class TestFeedbackValidation:
    def test_bad_mood_400(self):
        r = requests.post(f"{API}/feedback", json={"mood": "xxx"}, headers=H, timeout=15)
        assert r.status_code == 400
        assert r.json()["detail"] == "bad_mood"

    def test_missing_mood_422(self):
        r = requests.post(f"{API}/feedback", json={"message": "x"}, headers=H, timeout=15)
        assert r.status_code == 422


# anonymous feedback -> doc username 'invité', status emailed
class TestFeedbackAnonymous:
    def test_anonymous_feedback_persisted(self, fb_db):
        msg = f"TEST_anon_{int(time.time())}"
        r = requests.post(f"{API}/feedback", json={
            "mood": "neutral", "message": msg, "lang": "fr",
            "platform": "web", "app_version": "1.0.0"}, headers=H, timeout=30)
        if r.status_code == 429:
            pytest.skip("anonymous cooldown active (shared ingress IP bucket)")
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        doc = _latest(fb_db, message=msg)
        assert doc is not None
        assert doc["username"] == "invité"
        assert doc["user_id"] is None and doc["user_email"] is None
        assert doc["mood"] == "neutral" and doc["lang"] == "fr"
        assert doc["status"] == "emailed", doc["status"]
        assert doc.get("resend_id")


# authenticated feedback + per-user anti-spam
class TestFeedbackAuth:
    def test_auth_feedback_and_antispam(self, fb_db, t1_token):
        hh = {**H, "Authorization": f"Bearer {t1_token}"}
        msg = f"TEST_auth_{int(time.time())}"
        r = requests.post(f"{API}/feedback", json={
            "mood": "love", "message": msg, "lang": "en",
            "platform": "web", "app_version": "1.0.0"}, headers=hh, timeout=30)
        if r.status_code == 429:
            pytest.skip("Tester1 cooldown active (sent < 120s ago)")
        assert r.status_code == 200, r.text
        doc = _latest(fb_db, message=msg)
        assert doc["username"] == "Tester1"
        assert doc["user_email"] == TESTER1["email"]
        assert doc["user_id"]
        assert doc["status"] == "emailed", doc["status"]
        # immediate 2nd send -> 429 feedback_too_soon, no new doc
        r2 = requests.post(f"{API}/feedback", json={
            "mood": "sad", "message": msg + "_again"}, headers=hh, timeout=15)
        assert r2.status_code == 429
        assert r2.json()["detail"] == "feedback_too_soon"
        assert fb_db.feedback.find_one({"message": msg + "_again"}) is None


# regression: stats endpoint
class TestStatsRegression:
    def test_users_me_stats(self, t1_token):
        r = requests.get(f"{API}/users/me/stats",
                         headers={**H, "Authorization": f"Bearer {t1_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict) and r.json()
