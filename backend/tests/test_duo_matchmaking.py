"""Duo matchmaking — duo ONLY matches duo; separate duo ELO (elo_duo)."""
import os
import time
import uuid

import sys
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from game_manager import GameManager  # noqa: E402
from conftest import API, auth_headers  # noqa: E402

load_dotenv("/app/backend/.env")


def _p(uid, elo=1000, elo_duo=1000):
    return {"user_id": uid, "username": uid, "avatar_id": "av1",
            "is_bot": False, "elo": elo, "elo_duo": elo_duo}


def _entry(players, duo, ts=None):
    """Queue entry shaped exactly like the mm_queue documents."""
    now = time.time()
    return {"_id": f"q_{uuid.uuid4().hex[:10]}", "match_type": "short",
            "players": players, "user_ids": [p["user_id"] for p in players],
            "duo": duo, "ts": ts if ts is not None else now, "last_seen": now}


def _mgr(db=None):
    m = GameManager(db=db)
    m.schedule = lambda live: None       # no async driver in unit tests
    m._ensure_poller = lambda live: None
    return m


def _live_db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


# ---------------- grouping unit tests (pure, no DB) ----------------

def test_duo_matches_duo():
    m = _mgr()
    q = [_entry([_p("a1"), _p("a2")], duo=True),
         _entry([_p("b1"), _p("b2")], duo=True)]
    group = m._find_group(q, time.time())
    assert group is not None and all(e["duo"] for e in group)


def test_duo_never_matches_solos():
    m = _mgr()
    now = time.time()
    q = [_entry([_p("a1"), _p("a2")], duo=True, ts=now - 3600),
         _entry([_p("s1")], duo=False),
         _entry([_p("s2")], duo=False)]
    assert m._find_group(q, now) is None


def test_four_solos_still_match():
    m = _mgr()
    q = [_entry([_p(f"s{i}")], duo=False) for i in range(4)]
    group = m._find_group(q, time.time())
    assert group is not None and len(group) == 4


def test_duo_uses_duo_elo_average():
    m = _mgr()
    # solo ELOs wildly different, duo ELOs compatible -> must match
    q = [_entry([_p("a1", elo=2000, elo_duo=1000),
                 _p("a2", elo=300, elo_duo=1000)], duo=True),
         _entry([_p("b1", elo=1000, elo_duo=1040),
                 _p("b2", elo=1000, elo_duo=980)], duo=True)]
    assert m._find_group(q, time.time()) is not None


def test_duo_elo_gap_blocks_match():
    m = _mgr()
    # duo ELO averages 1000 vs 1600 -> outside the initial window
    q = [_entry([_p("a1", elo_duo=1000), _p("a2", elo_duo=1000)], duo=True),
         _entry([_p("b1", elo_duo=1600), _p("b2", elo_duo=1600)], duo=True)]
    assert m._find_group(q, time.time()) is None


# ---------------- DB-backed unit tests (real local Mongo) ----------------

async def test_make_match_duo_seats_and_duo_rating():
    m = _mgr(_live_db())
    ua = [f"a1_{uuid.uuid4().hex[:6]}", f"a2_{uuid.uuid4().hex[:6]}"]
    ub = [f"b1_{uuid.uuid4().hex[:6]}", f"b2_{uuid.uuid4().hex[:6]}"]
    group = [_entry([_p(ua[0], elo=1500, elo_duo=1010),
                     _p(ua[1], elo=900, elo_duo=990)], duo=True),
             _entry([_p(ub[0], elo_duo=1000), _p(ub[1], elo_duo=1000)],
                    duo=True)]
    await m._make_match(group, "short")
    # presence-confirmation flow: every player must accept before the game
    # is actually created
    for uid in ua + ub:
        assert await m.confirm_match(uid) is True
    matched = await m.db.mm_matched.find_one({"_id": ua[0]})
    assert matched, "matched ticket missing"
    gid = matched["game_id"]
    g = m.games[gid].game
    seat_of = {p["user_id"]: p["seat"] for p in g.players}
    assert seat_of[ua[0]] % 2 == seat_of[ua[1]] % 2, "duo must be teammates"
    assert seat_of[ub[0]] % 2 == seat_of[ub[1]] % 2
    assert getattr(g, "elo_mode", "solo") == "duo"
    # in-game elo values are the DUO ratings, not the solo ones
    elos = {p["user_id"]: p["elo"] for p in g.players}
    assert elos[ua[0]] == 1010 and elos[ua[1]] == 990
    assert getattr(g, "ranked", True) is True and g.origin == "online"
    # the game itself must be persisted for other processes
    assert await m.db.live_games.find_one({"_id": gid}) is not None
    # cleanup
    await m.db.live_games.delete_one({"_id": gid})
    for uid in ua + ub:
        await m.db.mm_matched.delete_one({"_id": uid})


async def test_leave_dissolves_duo_and_notifies_partner():
    m = _mgr(_live_db())
    a1, a2 = f"a1_{uuid.uuid4().hex[:6]}", f"a2_{uuid.uuid4().hex[:6]}"
    await m.join_queue_duo(_p(a1, elo_duo=9000), _p(a2, elo_duo=9000), "short")
    await m.leave_queue(a1)
    assert await m.db.mm_queue.find_one({"user_ids": a2}) is None
    st = await m.queue_status(a2)
    assert st["status"] == "duo_cancelled"
    assert (await m.queue_status(a2))["status"] == "idle"  # one-shot


async def test_queue_status_duo_fields():
    m = _mgr(_live_db())
    a1, a2 = f"a1_{uuid.uuid4().hex[:6]}", f"a2_{uuid.uuid4().hex[:6]}"
    await m.join_queue_duo(_p(a1, elo_duo=9000), _p(a2, elo_duo=9234), "short")
    st = await m.queue_status(a1)
    assert st["status"] == "waiting"
    assert st["duo"]["partner"]["username"] == a2
    assert st["duo"]["partner"]["elo"] == 9234  # duo ELO displayed
    assert st["found_count"] == 2
    await m.leave_queue(a1)


async def test_solo_status_never_lists_duos():
    m = _mgr(_live_db())
    a1, a2 = f"a1_{uuid.uuid4().hex[:6]}", f"a2_{uuid.uuid4().hex[:6]}"
    s1 = f"s1_{uuid.uuid4().hex[:6]}"
    await m.join_queue_duo(_p(a1, elo_duo=9000), _p(a2, elo_duo=9000), "short")
    await m.join_queue(_p(s1, elo=9000), "short")
    assert (await m.queue_status(s1))["players"] == []
    st = await m.queue_status(a1)
    assert st["players"] == []  # and duos never list solos
    await m.leave_queue(s1)
    await m.leave_queue(a1)


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

    r = http.get(f"{API}/matchmaking/duo/candidates", headers=h1)
    assert r.status_code == 200
    all_c = r.json()["friends"] + r.json()["recent"]
    assert any(c["user_id"] == tester2["user"]["user_id"] for c in all_c)

    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "online"}, headers=h1)
    assert r.status_code == 200, r.text
    invite_id = r.json()["invite_id"]

    st = http.get(f"{API}/matchmaking/status", headers=h1).json()
    assert st["status"] == "duo_pending"
    assert st["partner"]["user_id"] == tester2["user"]["user_id"]

    notif = http.get(f"{API}/notifications", headers=h2).json()
    assert any(d["invite_id"] == invite_id for d in notif.get("duo_invites", []))

    r = http.post(f"{API}/matchmaking/duo/{invite_id}/accept", headers=h2)
    assert r.status_code == 200
    st1 = http.get(f"{API}/matchmaking/status", headers=h1).json()
    st2 = http.get(f"{API}/matchmaking/status", headers=h2).json()
    assert st1["status"] == "waiting" and "duo" in st1
    assert st2["status"] == "waiting"
    assert st1["duo"]["partner"]["username"] == tester2["user"]["username"]

    http.delete(f"{API}/matchmaking/leave", headers=h1)
    st2 = http.get(f"{API}/matchmaking/status", headers=h2).json()
    assert st2["status"] == "duo_cancelled"


def test_duo_invite_decline_flow(http, tester1, tester2):
    _ensure_friends(http, tester1, tester2)
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "online"}, headers=h1)
    invite_id = r.json()["invite_id"]
    http.post(f"{API}/matchmaking/duo/{invite_id}/decline", headers=h2)
    st = http.get(f"{API}/matchmaking/status", headers=h1).json()
    assert st["status"] == "duo_declined"
    http.delete(f"{API}/matchmaking/leave", headers=h1)


def test_duo_invite_rejects_old_modes(http, tester1, tester2):
    _ensure_friends(http, tester1, tester2)
    h1 = auth_headers(tester1["token"])
    for bad in ("wait", "duo_only", "fill"):
        r = http.post(f"{API}/matchmaking/duo/invite",
                      json={"to_user_id": tester2["user"]["user_id"],
                            "match_type": "short", "mode": bad}, headers=h1)
        assert r.status_code == 400


def test_duo_invite_requires_relationship(http, tester1):
    h1 = auth_headers(tester1["token"])
    stranger = {"email": f"str_{uuid.uuid4().hex[:8]}@belote.tn",
                "password": "Belote123!",
                "username": f"Str{uuid.uuid4().hex[:6]}"}
    r = http.post(f"{API}/auth/register", json=stranger)
    assert r.status_code in (200, 201)
    sid = r.json()["user"]["user_id"]
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": sid, "match_type": "short", "mode": "online"},
                  headers=h1)
    assert r.status_code == 403


def test_full_duo_vs_duo_match_created(http, tester1, tester2):
    """duo(t1,t2) + duo(t3,t4) -> matched together via the live loop."""
    _ensure_friends(http, tester1, tester2)
    h1, h2 = auth_headers(tester1["token"]), auth_headers(tester2["token"])
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
    r = http.post(f"{API}/friends/request",
                  json={"user_id": extra[1]["user"]["user_id"]}, headers=h3)
    assert r.status_code == 200
    pend = http.get(f"{API}/friends", headers=h4).json()["pending_received"]
    fid = pend[0]["friendship_id"]
    http.post(f"{API}/friends/respond",
              json={"friendship_id": fid, "accept": True}, headers=h4)

    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": tester2["user"]["user_id"],
                        "match_type": "short", "mode": "online"}, headers=h1)
    iid = r.json()["invite_id"]
    http.post(f"{API}/matchmaking/duo/{iid}/accept", headers=h2)
    r = http.post(f"{API}/matchmaking/duo/invite",
                  json={"to_user_id": extra[1]["user"]["user_id"],
                        "match_type": "short", "mode": "online"}, headers=h3)
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
        time.sleep(2)
    assert game_id, "duo vs duo match was not created in time"
