"""Profile, stats, leaderboard, user search."""
from conftest import API, auth_headers


def test_update_avatar(http, tester1):
    r = http.put(f"{API}/users/me", json={"avatar_id": "av3"},
                 headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    assert r.json()["avatar_id"] == "av3"
    # Verify persistence via GET
    r2 = http.get(f"{API}/auth/me", headers=auth_headers(tester1["token"]))
    assert r2.json()["avatar_id"] == "av3"


def test_update_avatar_invalid(http, tester1):
    r = http.put(f"{API}/users/me", json={"avatar_id": "not_real"},
                 headers=auth_headers(tester1["token"]))
    assert r.status_code == 400


def test_stats_shape(http, tester1):
    r = http.get(f"{API}/users/me/stats", headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    j = r.json()
    assert "user" in j and "rank" in j and "win_rate" in j and "recent_matches" in j
    assert isinstance(j["recent_matches"], list)


def test_leaderboard(http, tester1):
    r = http.get(f"{API}/leaderboard", headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    j = r.json()
    assert isinstance(j.get("players"), list)
    assert j.get("my_rank", 0) >= 1
    if len(j["players"]) >= 2:
        elos = [p["elo"] for p in j["players"]]
        assert elos == sorted(elos, reverse=True)


def test_search_users(http, tester1, tester2):
    r = http.get(f"{API}/users/search", params={"q": "Tester"},
                 headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    results = r.json().get("results", [])
    # Tester1 must not see themselves; Tester2 should appear
    ids = [u["user_id"] for u in results]
    assert tester1["user"]["user_id"] not in ids
    assert tester2["user"]["user_id"] in ids
    for u in results:
        assert u["friend_status"] in ("none", "friends", "pending_sent", "pending_received")


def test_search_short_query(http, tester1):
    r = http.get(f"{API}/users/search", params={"q": "a"},
                 headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    assert r.json()["results"] == []
