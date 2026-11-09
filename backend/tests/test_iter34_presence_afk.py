"""Iteration 34 — match-found confirmation, old-client auto-accept, expiry
requeue/removal, 20s/10s turn timers, AFK bot relay + resume_seat, admin
reliability cards. Uses fresh TEST_ accounts (ELO 1000)."""
import asyncio
import json
import os
import time
import uuid

import pytest
import requests
import websockets
from pymongo import MongoClient
from dotenv import load_dotenv

from conftest import API, UA, auth_headers

load_dotenv("/app/backend/.env")
_db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
ADMIN_KEY = "belote-admin-7f3a9c2e"


def _reg(tag):
    s = uuid.uuid4().hex[:8]
    r = requests.post(f"{API}/auth/register", json={
        "email": f"test_it34_{tag}_{s}@belote.tn", "password": "Test1234!",
        "username": f"TEST_{tag}{s[:4]}"}, headers={"User-Agent": UA}, timeout=15)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    return {"token": d["token"], "uid": d["user"]["user_id"]}


def _join(a, priority=False):
    r = requests.post(f"{API}/matchmaking/join",
                      json={"match_type": "short", "priority": priority},
                      headers=auth_headers(a["token"]), timeout=15)
    assert r.status_code == 200, r.text


def _status(a, v=2):
    url = f"{API}/matchmaking/status" + (f"?v={v}" if v else "")
    r = requests.get(url, headers=auth_headers(a["token"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _confirm(a):
    r = requests.post(f"{API}/matchmaking/confirm",
                      headers=auth_headers(a["token"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _leave(a):
    requests.delete(f"{API}/matchmaking/leave",
                    headers=auth_headers(a["token"]), timeout=15)


def _finish_game(gid):
    # deleting the doc stops the in-memory driver on its next commit
    # (setting phase=finished is overwritten by the runtime)
    _db.live_games.delete_one({"_id": gid})


def _wait_all(accs, pred, timeout=20, v=2, interval=1.0):
    end = time.time() + timeout
    last = {}
    while time.time() < end:
        for i, a in enumerate(accs):
            if i not in last or not pred(last[i]):
                last[i] = _status(a, v)
        if all(pred(last[i]) for i in range(len(accs))):
            return last
        time.sleep(interval)
    return last


def _make_game():
    accs = [_reg(f"g{i}") for i in range(4)]
    for a in accs:
        _join(a)
    _wait_all(accs, lambda s: s["status"] == "confirm", timeout=20)
    for a in accs:
        _confirm(a)
    st = _wait_all(accs, lambda s: s["status"] == "found", timeout=10)
    gids = {st[i].get("game_id") for i in st}
    assert len(gids) == 1 and None not in gids, st
    return accs, gids.pop()


# BACKEND 1 — confirmation flow (v=2 clients)
def test_confirm_flow_new_clients():
    accs = [_reg(f"c{i}") for i in range(4)]
    gid = None
    try:
        for a in accs:
            _join(a)
        st = _wait_all(accs, lambda s: s["status"] == "confirm", timeout=20)
        for i, s in st.items():
            assert s["status"] == "confirm", s
            assert 0 <= s["remaining"] <= 10
            assert s["total"] == 4 and s["me_accepted"] is False
            assert len(s["players"]) == 3
        _confirm(accs[0])
        s0 = _status(accs[0])
        assert s0["status"] == "confirm" and s0["me_accepted"] is True
        assert s0["accepted"] == 1
        for a in accs[1:]:
            assert _confirm(a)["ok"] is True
        st = _wait_all(accs, lambda s: s["status"] == "found", timeout=8)
        gids = {s.get("game_id") for s in st.values()}
        assert len(gids) == 1 and None not in gids, st
        gid = gids.pop()
        assert _db.live_games.find_one({"_id": gid}) is not None
        assert _db.mm_pending.count_documents({"humans": accs[0]["uid"]}) == 0
    finally:
        if gid:
            _finish_game(gid)
        for a in accs:
            _leave(a)


# BACKEND 2 — old clients (no v param) auto-accept by polling
def test_old_client_auto_accept():
    accs = [_reg(f"o{i}") for i in range(4)]
    gid = None
    try:
        for a in accs:
            _join(a)
        t0 = time.time()
        st = _wait_all(accs, lambda s: s["status"] == "found", timeout=15, v=None)
        print("old-client found after", round(time.time() - t0, 1), "s")
        gids = {s.get("game_id") for s in st.values()}
        assert len(gids) == 1 and None not in gids, st
        gid = gids.pop()
        assert _db.live_games.find_one({"_id": gid}) is not None
    finally:
        if gid:
            _finish_game(gid)
        for a in accs:
            _leave(a)


# BACKEND 3 — expiry: acceptors requeued at head, silent removed + no_accept
def test_confirm_expiry_requeue_and_remove():
    accs = [_reg(f"e{i}") for i in range(4)]
    try:
        for a in accs:
            _join(a)
        orig_ts = {a["uid"]: _db.mm_queue.find_one({"user_ids": a["uid"]})["ts"]
                   for a in accs}
        _wait_all(accs, lambda s: s["status"] == "confirm", timeout=20)
        _confirm(accs[0])
        _confirm(accs[1])
        time.sleep(15)
        for a in accs[:2]:
            s = _status(a)
            assert s["status"] == "waiting", s
            q = _db.mm_queue.find_one({"user_ids": a["uid"]})
            assert q is not None and abs(q["ts"] - orig_ts[a["uid"]]) < 0.01
        for a in accs[2:]:
            s = _status(a)
            assert s["status"] == "removed_confirm", s
            assert _status(a)["status"] == "idle"  # one-shot
            assert _db.mm_queue.find_one({"user_ids": a["uid"]}) is None
            assert _db.reliability_events.find_one(
                {"user_id": a["uid"], "kind": "no_accept"}) is not None
        for a in accs[:2]:
            assert _db.reliability_events.find_one(
                {"user_id": a["uid"], "kind": "no_accept"}) is None
    finally:
        for a in accs:
            _leave(a)


def _ws_url(gid, token):
    base = API.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/ws/game/{gid}?token={token}"


# BACKEND 4+5 — 20s/10s timers, 3 misses -> bot relay, resume_seat
@pytest.mark.asyncio
async def test_turn_timers_afk_relay_and_resume():
    accs, gid = _make_game()
    log = {"target_turns": [], "other_turns": [], "events": [],
           "afk_turn_durations": []}
    target = {"seat": None}
    states = {}
    done = asyncio.Event()
    try:
        conns = [await websockets.connect(_ws_url(gid, a["token"]),
                                          additional_headers=[("User-Agent", UA)],
                                          open_timeout=15, max_size=2 ** 22)
                 for a in accs]

        async def reader(ws, idx):
            last_turn_key = None
            afk_turn_start = None
            while not done.is_set():
                try:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
                except asyncio.TimeoutError:
                    continue
                if msg.get("type") != "update":
                    continue
                s = msg["state"]
                states[idx] = s
                me = s["my_seat"]
                if target["seat"] is None:
                    target["seat"] = s["turn"]
                    assert s["turn_timeout"] == 20, s["turn_timeout"]
                tseat = target["seat"]
                if me == tseat:
                    for e in msg.get("events") or []:
                        log["events"].append((time.time(), e))
                key = (s["hand_number"], s["phase"], s["turn"], len(s["bids"]),
                       len(s["trick"] or []), s["tricks_played"])
                if s["phase"] in ("bidding", "playing") and s["turn"] == me \
                        and key != last_turn_key:
                    last_turn_key = key
                    rem = s["turn_deadline"] - time.time()
                    tp = s["players"][me]
                    if me == tseat:
                        log["target_turns"].append(
                            (round(rem, 1), tp["missed"], tp["afk"]))
                        if tp["afk"]:
                            afk_turn_start = time.time()
                    else:
                        log["other_turns"].append(round(rem, 1))
                        await asyncio.sleep(0.4)
                        if s["phase"] == "bidding":
                            await ws.send(json.dumps({"action": "pass"}))
                        elif s.get("legal"):
                            await ws.send(json.dumps(
                                {"action": "play", "card": s["legal"][0]}))
                if me == tseat and afk_turn_start and s["turn"] != me:
                    log["afk_turn_durations"].append(
                        round(time.time() - afk_turn_start, 2))
                    afk_turn_start = None
                if me != tseat and s["phase"] == "hand_end" \
                        and me not in (s.get("ready_seats") or []):
                    await ws.send(json.dumps({"action": "ready"}))
                if me != tseat and s["phase"] == "surcontre" and s["can_surcontre"]:
                    await ws.send(json.dumps({"action": "decline_surcontre"}))

        tasks = [asyncio.create_task(reader(ws, i)) for i, ws in enumerate(conns)]
        # wait for target to become afk and play a few relayed moves
        end = time.time() + 150
        while time.time() < end:
            await asyncio.sleep(1)
            if len(log["afk_turn_durations"]) >= 2:
                break
        print("target turns (rem, missed, afk):", log["target_turns"])
        print("other turns rem:", log["other_turns"][:12])
        print("afk move durations:", log["afk_turn_durations"])
        print("events:", [e for _, e in log["events"]
                          if e.get("e") in ("afk_bot", "afk_back")])
        tt = log["target_turns"]
        assert tt and 17 <= tt[0][0] <= 23 and tt[0][1] == 0, tt
        reduced = [r for r, m, afk in tt if m >= 1 and not afk]
        assert reduced and all(r <= 11 for r in reduced), tt
        assert all(r >= 15 for r in log["other_turns"][:10]), log["other_turns"]
        tseat = target["seat"]
        tidx = [i for i in states if states[i]["my_seat"] == tseat][0]
        ts = states[tidx]["players"][tseat]
        assert ts["afk"] is True and ts["missed"] >= 3, ts
        assert any(e.get("e") == "afk_bot" and e.get("seat") == tseat
                   for _, e in log["events"])
        assert log["afk_turn_durations"] and \
            all(d < 4 for d in log["afk_turn_durations"]), log["afk_turn_durations"]
        # resume the seat
        await conns[tidx].send(json.dumps({"action": "resume_seat"}))
        t0 = time.time()
        while time.time() - t0 < 8:
            await asyncio.sleep(0.5)
            p = states[tidx]["players"][tseat]
            if not p["afk"] and p["missed"] == 0:
                break
        p = states[tidx]["players"][tseat]
        assert p["afk"] is False and p["missed"] == 0, p
        assert any(e.get("e") == "afk_back" and e.get("seat") == tseat
                   for _, e in log["events"])
        done.set()
        for t in tasks:
            t.cancel()
        for ws in conns:
            await ws.close()
    finally:
        done.set()
        _finish_game(gid)


# BACKEND 6 — admin dashboard reliability cards
def test_admin_reliability_cards():
    r = requests.get(f"{API}/admin/stats?key={ADMIN_KEY}",
                     headers={"User-Agent": UA}, timeout=20)
    assert r.status_code == 200
    html = r.text
    assert "Fiabilité des joueurs" in html
    for label in ("manqu", "relais", "acceptation"):
        assert label.lower() in html.lower(), label
    assert _db.reliability_events.count_documents({"kind": "no_accept"}) > 0
    assert _db.reliability_events.count_documents({"kind": "missed_turn"}) > 0
