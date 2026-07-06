"""Duo matchmaking — queue logic unit tests + invite flow via API."""
import time
import uuid

import pytest

import sys
sys.path.insert(0, "/app/backend")
from game_manager import GameManager, DUO_WAIT_SECONDS  # noqa: E402
from conftest import API, auth_headers  # noqa: E402


def _p(uid, elo=1000):
    return {"user_id": uid, "username": uid, "avatar_id": "av1",
            "is_bot": False, "elo": elo}


def _mgr():
    m = GameManager(db=None)
    m.schedule = lambda live: None  # don't spawn the async driver in unit tests
    return m


# ---------------- queue / grouping unit tests ----------------

def test_duo_vs_duo_preferred_over_solos():
    m = _mgr()
    m.join_queue_duo(_p("a1"), _p("a2"), "short", "fill")
    m.join_queue(_p("s1"), "short")
    m.join_queue(_p("s2"), "short")
    m.join_queue_duo(_p("b1"), _p("b2"), "short", "duo_only")
    group = m._find_group(m.queues["short"], time.time())
    assert group is not None
    assert all(e["duo"] for e in group), "duo-vs-duo must be preferred"


def test_duo_wait_mode_blocks_solos_for_2_minutes_then_fills():
    m = _mgr()
    m.join_queue_duo(_p("a1"), _p("a2"), "short", "wait")
    m.join_queue(_p("s1"), "short")
    m.join_queue(_p("s2"), "short")
    now = time.time()
    assert m._find_group(m.queues["short"], now) is None, \
        "wait-mode duo must not match solos before 2 minutes"
    # simulate 2 minutes of waiting
    duo_entry = next(e for e in m.queues["short"] if e["duo"])
    duo_entry["ts"] = now - DUO_WAIT_SECONDS - 1
    group = m._find_group(m.queues["short"], now)
    assert group is not None and sum(len(e["players"]) for e in group) == 4


def test_duo_only_mode_never_matches_solos():
    m = _mgr()
    m.join_queue_duo(_p("a1"), _p("a2"), "short", "duo_only")
    m.join_queue(_p("s1"), "short")
    m.join_queue(_p("s2"), "short")
    now = time.time()
    duo_entry = next(e for e in m.queues["short"] if e["duo"])
    duo_entry["ts"] = now - 3600  # even after an hour
    assert m._find_group(m.queues["short"], now) is None


def test_duo_fill_mode_matches_solos_immediately():
    m = _mgr()
    m.join_queue_duo(_p("a1"), _p("a2"), "short", "fill")
    m.join_queue(_p("s1"), "short")
    m.join_queue(_p("s2"), "short")
    group = m._find_group(m.queues["short"], time.time())
    assert group is not None


def test_four_solos_still_match():
    m = _mgr()
    for i in range(4):
        m.join_queue(_p(f"s{i}"), "short")
    group = m._find_group(m.queues["short"], time.time())
    assert group is not None and len(group) == 4


def test_duo_elo_average_used():
    m = _mgr()
    # duo avg = 1000 even with a large internal spread
    m.join_queue_duo(_p("a1", 800), _p("a2", 1200), "short", "fill")
    m.join_queue(_p("s1", 1010), "short")
    m.join_queue(_p("s2", 990), "short")
    assert m._find_group(m.queues["short"], time.time()) is not None


async def test_make_match_seats_duo_as_partners():
    m = _mgr()
    m.join_queue_duo(_p("a1"), _p("a2"), "short", "fill")
    m.join_queue(_p("s1"), "short")
    m.join_queue(_p("s2"), "short")
    group = m._find_group(m.queues["short"], time.time())
    m._make_match(group, "short")
    gid = m.matched["a1"]["game_id"]
    g = m.games[gid].game
    seat_of = {p["user_id"]: p["seat"] for p in g.players}
    assert seat_of["a1"] % 2 == seat_of["a2"] % 2, "duo must be teammates"
    assert seat_of["s1"] % 2 == seat_of["s2"] % 2
    assert g.origin == "online" and getattr(g, "ranked", True) is True


def test_leave_dissolves_duo_and_notifies_partner():
    m = _mgr()
    m.join_queue_duo(_p("a1"), _p("a2"), "short", "wait")
    m.leave_queue("a1")
    assert m.queues["short"] == []
    st = m.queue_status("a2")
    assert st["status"] == "duo_cancelled"
    # one-shot: second read falls back to idle
    assert m.queue_status("a2")["status"] == "idle"


def test_queue_status_duo_fields():
    m = _mgr()
    m.join_queue_duo(_p("a1"), _p("a2"), "short", "wait")
    st = m.queue_status("a1")
    assert st["status"] == "waiting"
    assert st["duo"]["partner"]["username"] == "a2"
    assert st["duo"]["mode"] == "wait"
    assert 0 < st["duo"]["duo_wait_remaining"] <= DUO_WAIT_SECONDS
    assert st["found_count"] == 2


def test_solo_status_does_not_list_incompatible_duo():
    m = _mgr()
    m.join_queue_duo(_p("a1"), _p("a2"), "short", "duo_only")
    m.join_queue(_p("s1"), "short")
    st = m.queue_status("s1")
    assert st["players"] == [], "duo_only duo must not appear for a solo player"


# ---------------- invite flow via API ----------------

def _ensure_friends(http, tester1, tester2):
    r = http.post(f"{API}/friends/request",
                  json={"user_id": tester2["user"]["user_id"]},
                  headers=auth_headers(tester1["token"]))
    if r.status_code == 200:
        r2 = http.get(f"{API}/friends", headers=auth_headers(tester2["token"]))
        pend = r2.json().get("pending_received", [])
        fid = next((p["friendship_id"] for p in pend
                    if p["user_id"] == tester1["user"]["user_id"]), None)
        if fid:
            http.post(f"{API}/friends/respond",
                      json={"friendship_id": fid, "accept": True},
                      headers=auth_headers(tester2["token"]))


def test_duo_invite_accept_flow(http, tester1, tester2):
    _ensure_friends(http, tester1, tester2)
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])

    # candidates: tester2 must be invitable by tester1
    r = http.get(f"{API}/matchmaking/duo/candidates", headers=h1)
    assert r.status_code == 200
    all_c = r.json()["friends"] + r.json()["recent"]
    assert any(c["user_id"] == tester2["user"]["user_id"] for c in all_c)

    # invite
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "duo_only"}, headers=h1)
    assert r.status_code == 200, r.text
    invite_id = r.json()["invite_id"]

    # launcher sees pending
    st = http.get(f"{API}/matchmaking/status", headers=h1).json()
    assert st["status"] == "duo_pending"
    assert st["partner"]["user_id"] == tester2["user"]["user_id"]

    # invitee sees it in notifications
    notif = http.get(f"{API}/notifications", headers=h2).json()
    assert any(d["invite_id"] == invite_id for d in notif.get("duo_invites", []))

    # accept -> both waiting as duo
    r = http.post(f"{API}/matchmaking/duo/{invite_id}/accept", headers=h2)
    assert r.status_code == 200
    st1 = http.get(f"{API}/matchmaking/status", headers=h1).json()
    st2 = http.get(f"{API}/matchmaking/status", headers=h2).json()
    assert st1["status"] == "waiting" and st1["duo"]["mode"] == "duo_only"
    assert st2["status"] == "waiting"
    assert st1["duo"]["partner"]["username"] == tester2["user"]["username"]

    # launcher cancels -> partner informed once
    http.delete(f"{API}/matchmaking/leave", headers=h1)
    st2 = http.get(f"{API}/matchmaking/status", headers=h2).json()
    assert st2["status"] == "duo_cancelled"


def test_duo_invite_decline_flow(http, tester1, tester2):
    _ensure_friends(http, tester1, tester2)
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "wait"}, headers=h1)
    invite_id = r.json()["invite_id"]
    http.post(f"{API}/matchmaking/duo/{invite_id}/decline", headers=h2)
    st = http.get(f"{API}/matchmaking/status", headers=h1).json()
    assert st["status"] == "duo_declined"
    # cleanup
    http.delete(f"{API}/matchmaking/leave", headers=h1)


def test_duo_invite_requires_relationship(http, tester1):
    h1 = auth_headers(tester1["token"])
    stranger = {"email": f"str_{uuid.uuid4().hex[:8]}@belote.tn",
                "password": "Belote123!",
                "username": f"Str{uuid.uuid4().hex[:6]}"}
    r = http.post(f"{API}/auth/register", json=stranger)
    assert r.status_code in (200, 201)
    sid = r.json()["user"]["user_id"]
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": sid, "match_type": "short", "mode": "fill"},
                  headers=h1)
    assert r.status_code == 403


def test_full_duo_vs_duo_match_created(http, tester1, tester2):
    """duo(t1,t2) duo_only + duo(t3,t4) fill -> matched together, partners seated."""
    _ensure_friends(http, tester1, tester2)
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])
    # two fresh accounts for the second duo
    extra = []
    for _ in range(2):
        creds = {"email": f"duo_{uuid.uuid4().hex[:8]}@belote.tn",
                 "password": "Belote123!",
                 "username": f"Duo{uuid.uuid4().hex[:6]}"}
        r = http.post(f"{API}/auth/register", json=creds)
        assert r.status_code in (200, 201)
        extra.append(r.json())
    h3 = auth_headers(extra[0]["token"])
    h4 = auth_headers(extra[1]["token"])
    # t3 and t4 become friends so they can duo
    r = http.post(f"{API}/friends/request",
                  json={"user_id": extra[1]["user"]["user_id"]}, headers=h3)
    assert r.status_code == 200
    pend = http.get(f"{API}/friends", headers=h4).json()["pending_received"]
    fid = pend[0]["friendship_id"]
    http.post(f"{API}/friends/respond",
              json={"friendship_id": fid, "accept": True}, headers=h4)

    # duo 1 (duo_only)
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "duo_only"}, headers=h1)
    iid = r.json()["invite_id"]
    http.post(f"{API}/matchmaking/duo/{iid}/accept", headers=h2)
    # duo 2 (fill)
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": extra[1]["user"]["user_id"],
                        "match_type": "short", "mode": "fill"}, headers=h3)
    iid2 = r.json()["invite_id"]
    http.post(f"{API}/matchmaking/duo/{iid2}/accept", headers=h4)

    game_id = None
    deadline = time.time() + 40
    while time.time() < deadline:
        sts = [http.get(f"{API}/matchmaking/status", headers=h).json()
               for h in (h1, h2, h3, h4)]
        if all(s.get("status") == "found" for s in sts):
            game_id = sts[0]["game_id"]
            assert all(s["game_id"] == game_id for s in sts)
            break
        # keep entries alive (status polls refresh last_seen)
        time.sleep(2)
    assert game_id, "duo vs duo match was not created in time"
