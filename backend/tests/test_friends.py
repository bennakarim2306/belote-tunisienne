"""Friends flow: request, list pending, accept, both see each other."""
import pytest
from conftest import API, auth_headers


@pytest.fixture(scope="module", autouse=True)
def _clean_friendship(http, tester1, tester2):
    """Reset any prior friendship between tester1 & tester2 before running."""
    # If they are already friends or a pending request exists, decline/remove via API.
    r = http.get(f"{API}/friends", headers=auth_headers(tester1["token"]))
    if r.status_code == 200:
        j = r.json()
        for lst in ("friends", "pending_received", "pending_sent"):
            for f in j.get(lst, []):
                if f["user_id"] == tester2["user"]["user_id"]:
                    # try tester1 or tester2 to decline (only recipient can respond)
                    for t in (tester1["token"], tester2["token"]):
                        http.post(f"{API}/friends/respond",
                                  json={"friendship_id": f["friendship_id"], "accept": False},
                                  headers=auth_headers(t))
    yield


def test_friend_full_flow(http, tester1, tester2):
    # tester1 sends request to tester2
    r = http.post(f"{API}/friends/request",
                  json={"user_id": tester2["user"]["user_id"]},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text

    # tester2 sees pending_received
    r = http.get(f"{API}/friends", headers=auth_headers(tester2["token"]))
    assert r.status_code == 200
    recv = r.json()["pending_received"]
    matching = [f for f in recv if f["user_id"] == tester1["user"]["user_id"]]
    assert matching, f"Expected pending request from tester1, got {recv}"
    friendship_id = matching[0]["friendship_id"]

    # tester1 sees pending_sent
    r = http.get(f"{API}/friends", headers=auth_headers(tester1["token"]))
    sent = r.json()["pending_sent"]
    assert any(f["user_id"] == tester2["user"]["user_id"] for f in sent)

    # tester2 accepts
    r = http.post(f"{API}/friends/respond",
                  json={"friendship_id": friendship_id, "accept": True},
                  headers=auth_headers(tester2["token"]))
    assert r.status_code == 200

    # Both see each other as friends
    for t in (tester1, tester2):
        r = http.get(f"{API}/friends", headers=auth_headers(t["token"]))
        friends = r.json()["friends"]
        other = tester2 if t is tester1 else tester1
        assert any(f["user_id"] == other["user"]["user_id"] for f in friends)


def test_duplicate_request_rejected(http, tester1, tester2):
    r = http.post(f"{API}/friends/request",
                  json={"user_id": tester2["user"]["user_id"]},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 400


def test_cannot_add_self(http, tester1):
    r = http.post(f"{API}/friends/request",
                  json={"user_id": tester1["user"]["user_id"]},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 400
