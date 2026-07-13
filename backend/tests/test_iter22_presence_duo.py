"""Iteration 22 tests: presence heartbeat + duo invite (vs_ai) flow."""
import time
import uuid
import pytest
import requests

from conftest import API, UA, auth_headers


# ---- helpers ----
def _friend_ids(headers):
    r = requests.get(f"{API}/friends", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _ensure_friends(t1, t2):
    """Make sure tester1 and tester2 are accepted friends."""
    h1 = auth_headers(t1["token"])
    h2 = auth_headers(t2["token"])
    data = _friend_ids(h1)
    if any(f["user_id"] == t2["user"]["user_id"] for f in data["friends"]):
        return
    # Send request tester1 -> tester2 (or reuse existing pending)
    r = requests.post(f"{API}/friends/request",
                      json={"user_id": t2["user"]["user_id"]},
                      headers=h1, timeout=15)
    # 400 already_exists is ok
    # Find pending request on tester2 side
    d2 = _friend_ids(h2)
    pending = [x for x in d2["pending_received"]
               if x["user_id"] == t1["user"]["user_id"]]
    if pending:
        fid = pending[0]["friendship_id"]
        r = requests.post(f"{API}/friends/respond",
                          json={"friendship_id": fid, "accept": True},
                          headers=h2, timeout=15)
        assert r.status_code == 200


# ---- Presence tests ----

class TestPresence:
    def test_ping_returns_ok(self, tester1):
        r = requests.post(f"{API}/presence/ping", json={},
                          headers=auth_headers(tester1["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_ping_requires_auth(self):
        r = requests.post(f"{API}/presence/ping", json={},
                          headers={"User-Agent": UA,
                                   "Content-Type": "application/json"}, timeout=15)
        assert r.status_code in (401, 403)


class TestFriendsOnlineField:
    def test_friend_online_true_after_ping(self, tester1, tester2):
        _ensure_friends(tester1, tester2)
        # tester2 pings -> tester1 should see tester2 as online
        r = requests.post(f"{API}/presence/ping", json={},
                          headers=auth_headers(tester2["token"]), timeout=15)
        assert r.status_code == 200
        data = _friend_ids(auth_headers(tester1["token"]))
        entry = next((f for f in data["friends"]
                      if f["user_id"] == tester2["user"]["user_id"]), None)
        assert entry is not None, "tester2 not in friends list"
        assert "online" in entry
        assert entry["online"] is True, f"expected online True, got {entry}"

    def test_friend_online_false_when_stale(self, tester1, tester2):
        """Directly stale tester2's last_active in Mongo, then verify online=False."""
        from pymongo import MongoClient
        import os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        client = MongoClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        # Set last_active to 5 minutes ago
        db.users.update_one({"user_id": tester2["user"]["user_id"]},
                            {"$set": {"last_active": time.time() - 300}})
        data = _friend_ids(auth_headers(tester1["token"]))
        entry = next((f for f in data["friends"]
                      if f["user_id"] == tester2["user"]["user_id"]), None)
        assert entry is not None
        assert entry["online"] is False, f"expected online False, got {entry}"
        client.close()


class TestDuoCandidatesOnline:
    def test_candidates_include_online_field(self, tester1, tester2):
        _ensure_friends(tester1, tester2)
        # ping tester2 to be online
        requests.post(f"{API}/presence/ping", json={},
                      headers=auth_headers(tester2["token"]), timeout=15)
        r = requests.get(f"{API}/matchmaking/duo/candidates",
                         headers=auth_headers(tester1["token"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "friends" in data
        entry = next((f for f in data["friends"]
                      if f["user_id"] == tester2["user"]["user_id"]), None)
        assert entry is not None, "tester2 missing in duo candidates"
        assert "online" in entry
        assert entry["online"] is True


# ---- Duo invite vs_ai ----

class TestDuoInviteVsAI:
    def test_invite_accept_creates_vs_ai_game(self, tester1, tester2):
        _ensure_friends(tester1, tester2)
        # cancel any prior invite from tester1
        requests.delete(f"{API}/matchmaking/leave",
                        headers=auth_headers(tester1["token"]), timeout=15)

        # tester1 invites tester2 to vs_ai short match
        r = requests.post(f"{API}/matchmaking/duo/invite",
                          json={"to_user_id": tester2["user"]["user_id"],
                                "match_type": "short", "mode": "vs_ai"},
                          headers=auth_headers(tester1["token"]), timeout=15)
        assert r.status_code == 200, r.text
        invite_id = r.json().get("invite_id")
        assert invite_id and invite_id.startswith("di_")

        # tester2 sees it in notifications
        n = requests.get(f"{API}/notifications",
                        headers=auth_headers(tester2["token"]), timeout=15)
        assert n.status_code == 200
        duo_invs = n.json()["duo_invites"]
        assert any(d["invite_id"] == invite_id for d in duo_invs), \
            f"invite {invite_id} not in tester2 notifications: {duo_invs}"

        # tester2 accepts
        r = requests.post(f"{API}/matchmaking/duo/{invite_id}/accept",
                          headers=auth_headers(tester2["token"]), timeout=15)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert payload["ok"] is True
        assert payload["mode"] == "vs_ai"
        assert payload["match_type"] == "short"
        game_id = payload["game_id"]
        assert game_id, "vs_ai accept should return game_id"

        # Verify both players can query game state via matchmaking status "found"
        for tt in (tester1, tester2):
            s = requests.get(f"{API}/matchmaking/status",
                             headers=auth_headers(tt["token"]), timeout=15)
            assert s.status_code == 200
            body = s.json()
            assert body.get("status") == "found", f"status for {tt['user']['username']}: {body}"
            assert body.get("game_id") == game_id

    def test_invite_bad_mode(self, tester1, tester2):
        r = requests.post(f"{API}/matchmaking/duo/invite",
                          json={"to_user_id": tester2["user"]["user_id"],
                                "match_type": "short", "mode": "invalid"},
                          headers=auth_headers(tester1["token"]), timeout=15)
        assert r.status_code == 400

    def test_invite_self_forbidden(self, tester1):
        r = requests.post(f"{API}/matchmaking/duo/invite",
                          json={"to_user_id": tester1["user"]["user_id"],
                                "match_type": "short", "mode": "vs_ai"},
                          headers=auth_headers(tester1["token"]), timeout=15)
        assert r.status_code == 400
