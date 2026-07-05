"""Private rooms + matchmaking flow."""
import time
import pytest
from conftest import API, auth_headers


def test_room_create_get(http, tester1):
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    room = r.json()
    assert room["match_type"] == "short"
    assert not room["started"]
    assert len(room["code"]) == 6
    assert room["host_id"] == tester1["user"]["user_id"]
    assert len(room["players"]) == 1

    r2 = http.get(f"{API}/rooms/{room['code']}", headers=auth_headers(tester1["token"]))
    assert r2.status_code == 200
    assert r2.json()["code"] == room["code"]


def test_room_join_invite_start(http, tester1, tester2):
    r = http.post(f"{API}/rooms", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    room = r.json()

    # tester2 joins
    r = http.post(f"{API}/rooms/{room['code']}/join",
                  headers=auth_headers(tester2["token"]))
    assert r.status_code == 200
    assert len(r.json()["players"]) == 2

    # tester1 invites tester2 (already in but exercises route)
    r = http.post(f"{API}/rooms/{room['code']}/invite",
                  json={"user_id": tester2["user"]["user_id"]},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200

    # invite: create separate player, then invite them so pending shows up
    # (we only have 2 tester accounts, so verify /invites/pending returns list)
    r = http.get(f"{API}/invites/pending",
                 headers=auth_headers(tester2["token"]))
    assert r.status_code == 200
    assert isinstance(r.json()["invites"], list)

    # host starts (bots fill remaining seats)
    r = http.post(f"{API}/rooms/{room['code']}/start",
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200, r.text
    assert r.json()["game_id"].startswith("g_")


def test_non_host_cannot_start(http, tester1, tester2):
    r = http.post(f"{API}/rooms", json={"match_type": "long"},
                  headers=auth_headers(tester1["token"]))
    room = r.json()
    http.post(f"{API}/rooms/{room['code']}/join",
              headers=auth_headers(tester2["token"]))
    r = http.post(f"{API}/rooms/{room['code']}/start",
                  headers=auth_headers(tester2["token"]))
    assert r.status_code == 400


def test_matchmaking_join_status_leave(http, tester1):
    # ensure clean state
    http.delete(f"{API}/matchmaking/leave", headers=auth_headers(tester1["token"]))

    r = http.post(f"{API}/matchmaking/join", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200

    # immediate status: waiting
    r = http.get(f"{API}/matchmaking/status",
                 headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    st = r.json()
    assert st["status"] in ("waiting", "found")

    # wait up to 20s for match (bots fill after ~10s)
    game_id = None
    for _ in range(20):
        time.sleep(1.5)
        r = http.get(f"{API}/matchmaking/status",
                     headers=auth_headers(tester1["token"]))
        st = r.json()
        if st.get("status") == "found":
            game_id = st.get("game_id")
            break
    assert game_id and game_id.startswith("g_"), f"never matched: {st}"

    # clean up
    http.delete(f"{API}/matchmaking/leave", headers=auth_headers(tester1["token"]))
