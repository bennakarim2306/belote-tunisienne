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
    assert len(room["seats"]) == 4
    assert sum(1 for s in room["seats"] if s) == 1

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
    assert sum(1 for s in r.json()["seats"] if s) == 2

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
    """New behaviour: humans-only queue. Solo user stays 'waiting' forever
    (until 3 more join or purge). We just verify join/status/leave shape."""
    http.delete(f"{API}/matchmaking/leave", headers=auth_headers(tester1["token"]))

    r = http.post(f"{API}/matchmaking/join", json={"match_type": "short"},
                  headers=auth_headers(tester1["token"]))
    assert r.status_code == 200

    r = http.get(f"{API}/matchmaking/status",
                 headers=auth_headers(tester1["token"]))
    assert r.status_code == 200
    st = r.json()
    assert st["status"] == "waiting", st
    assert st["found_count"] == 1
    assert st["elo_range"] == 100
    assert st["match_type"] == "short"
    assert st["players"] == []

    http.delete(f"{API}/matchmaking/leave", headers=auth_headers(tester1["token"]))
    st = http.get(f"{API}/matchmaking/status",
                  headers=auth_headers(tester1["token"])).json()
    assert st["status"] == "idle"
