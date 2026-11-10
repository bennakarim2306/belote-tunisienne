"""ELO-based matchmaking queues and duo invites (duo vs duo strictly).

All queue/invite/match state lives in MongoDB (mm_queue, mm_matched,
mm_duo_invites, mm_feedback) so that ANY server process — and a freshly
restarted one — can serve any request. The matching pass itself runs behind a
short Mongo lease so only one process matches at a time."""
import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone

from pymongo import ReturnDocument

from live_utils import elo_window, make_bots
from push import (maybe_send_match_found_push, maybe_send_peak_hour_push,
                  maybe_send_queue_push)

import sync_channel

logger = logging.getLogger(__name__)

QUEUE_STALE_SECONDS = 60  # tolerate app backgrounding (frozen JS timers)
DUO_INVITE_TTL = 120  # duo invites expire after 2 minutes
MATCHED_TTL = 600     # "found" tickets stay readable for 10 minutes
FEEDBACK_TTL = 30
MM_LOCK_TTL = 6
CONFIRM_SECONDS = 30  # window to press "Accept" when a match is found
CONFIRM_GRACE = 2     # extra server-side slack before sweeping


class MatchmakingMixin:
    """Queue docs: {_id, match_type, players: [p] or [p1, p2], user_ids,
                    duo: bool, ts, last_seen}
    Duos ONLY match other duos (duo vs duo); solos only match solos.
    Duo rating uses each player's separate duo ELO (elo_duo), averaged."""

    # ---------- queues ----------

    async def join_queue(self, player, match_type, priority=False):
        await self.leave_queue(player["user_id"])
        await self.db.mm_matched.delete_one({"_id": player["user_id"]})
        now = time.time()
        # priority rejoin (after a failed confirmation): a modest head start —
        # 30 s of virtual wait keeps the ELO window sane while moving them up
        ts = now - 30 if priority else now
        await self.db.mm_queue.insert_one({
            "_id": f"q_{uuid.uuid4().hex[:10]}", "match_type": match_type,
            "players": [player], "user_ids": [player["user_id"]],
            "duo": False, "ts": ts, "last_seen": now})

    async def join_queue_duo(self, p1, p2, match_type):
        for p in (p1, p2):
            await self.leave_queue(p["user_id"])
            await self.db.mm_matched.delete_one({"_id": p["user_id"]})
            await self.db.mm_feedback.delete_one({"_id": p["user_id"]})
        now = time.time()
        await self.db.mm_queue.insert_one({
            "_id": f"q_{uuid.uuid4().hex[:10]}", "match_type": match_type,
            "players": [p1, p2], "user_ids": [p1["user_id"], p2["user_id"]],
            "duo": True, "ts": now, "last_seen": now})

    async def leave_queue(self, user_id):
        """Remove the whole entry containing the user (dissolves a duo)."""
        rows = await self.db.mm_queue.find({"user_ids": user_id}).to_list(10)
        for e in rows:
            res = await self.db.mm_queue.delete_one({"_id": e["_id"]})
            if res.deleted_count and e["duo"]:
                for p in e["players"]:
                    if p["user_id"] != user_id:
                        await self._set_feedback(p["user_id"], "duo_cancelled")
                        await sync_channel.push_event([p["user_id"]],
                                                      {"type": "mm_update"})
        # leaving during a confirmation window = explicit cancel (no blame)
        await self.db.mm_pending.update_many(
            {"humans": user_id}, {"$addToSet": {"cancelled": user_id}})

    async def clear_matched(self, user_id):
        await self.db.mm_matched.delete_one({"_id": user_id})

    async def _set_feedback(self, user_id, status):
        await self.db.mm_feedback.replace_one(
            {"_id": user_id},
            {"_id": user_id, "status": status, "ts": time.time()}, upsert=True)

    async def _set_matched(self, user_ids, game_id):
        now = time.time()
        for uid in user_ids:
            await self.db.mm_matched.replace_one(
                {"_id": uid}, {"_id": uid, "game_id": game_id, "ts": now},
                upsert=True)
        # Phase 2: instant push to connected players (opponent found!)
        await sync_channel.push_event(
            user_ids, {"type": "mm_found", "game_id": game_id})
        await sync_channel.notify_users(user_ids)

    # ---------- duo invites ----------

    async def create_duo_invite(self, from_player, to_user, match_type, mode):
        await self.cancel_duo_invite(from_player["user_id"])
        # a new search invalidates any previous "found" ticket / feedback
        await self.db.mm_matched.delete_one({"_id": from_player["user_id"]})
        await self.db.mm_feedback.delete_one({"_id": from_player["user_id"]})
        iid = f"di_{uuid.uuid4().hex[:10]}"
        await self.db.mm_duo_invites.insert_one({
            "_id": iid, "invite_id": iid, "from_player": from_player,
            "to_user": to_user, "match_type": match_type,
            "mode": mode, "ts": time.time(), "status": "pending"})
        return iid

    async def pending_duo_invites_for(self, user_id):
        return await self.db.mm_duo_invites.find(
            {"to_user.user_id": user_id, "status": "pending",
             "ts": {"$gt": time.time() - DUO_INVITE_TTL}}).to_list(10)

    async def accept_duo_invite(self, invite_id, to_player):
        # atomic take: only one accept can consume the invite
        inv = await self.db.mm_duo_invites.find_one_and_delete(
            {"_id": invite_id, "status": "pending",
             "to_user.user_id": to_player["user_id"],
             "ts": {"$gt": time.time() - DUO_INVITE_TTL}})
        if not inv:
            return None
        if inv["mode"] == "vs_ai":
            # duo vs AI: create the training game right away (humans seats 0&2)
            p1 = inv["from_player"]
            for p in (p1, to_player):
                await self.leave_queue(p["user_id"])
                await self.db.mm_matched.delete_one({"_id": p["user_id"]})
                await self.db.mm_feedback.delete_one({"_id": p["user_id"]})
            bots = make_bots(2, {p1["username"], to_player["username"]})
            game_id = await self.create_game([p1, bots[0], to_player, bots[1]],
                                             inv["match_type"], shuffle=False,
                                             ranked=False, turn_timeout=None,
                                             host_user_id=p1["user_id"],
                                             origin="solo")
            await self._set_matched([p1["user_id"], to_player["user_id"]], game_id)
            inv["game_id"] = game_id
            return inv
        await self.join_queue_duo(inv["from_player"], to_player, inv["match_type"])
        # instant update for the inviter's waiting screen (now in the queue)
        await sync_channel.push_event([inv["from_player"]["user_id"]],
                                      {"type": "mm_update"})
        return inv

    async def decline_duo_invite(self, invite_id, user_id):
        inv = await self.db.mm_duo_invites.find_one_and_delete(
            {"_id": invite_id, "to_user.user_id": user_id, "status": "pending"})
        if inv:
            await self._set_feedback(inv["from_player"]["user_id"], "duo_declined")
            await sync_channel.push_event([inv["from_player"]["user_id"]],
                                          {"type": "mm_update"})

    async def cancel_duo_invite(self, from_user_id):
        await self.db.mm_duo_invites.delete_many(
            {"from_player.user_id": from_user_id, "status": "pending"})

    # ---------- status & matching ----------

    @staticmethod
    def _entry_elo(e):
        """Solo entries use the solo ELO; duo entries use the duo-ELO average."""
        if e["duo"]:
            return sum(p.get("elo_duo", 1000) for p in e["players"]) / 2
        return e["players"][0]["elo"]

    async def queue_status(self, user_id, v=1):
        now = time.time()
        m = await self.db.mm_matched.find_one(
            {"_id": user_id, "ts": {"$gt": now - MATCHED_TTL}})
        if m:
            return {"status": "found", "game_id": m["game_id"]}
        # match found, waiting for everyone to confirm presence
        pm = await self.db.mm_pending.find_one({"humans": user_id})
        if pm:
            others = [{"username": p["username"], "avatar_id": p["avatar_id"],
                       "elo": p.get("elo", 1000)}
                      for e in pm["entries"] for p in e["players"]
                      if p["user_id"] != user_id]
            if v < 2:
                # old app versions have no Accept button: actively polling
                # during the window counts as acceptance (nobody is punished
                # for not having updated)
                await self.confirm_match(user_id)
                return {"status": "waiting", "waited": 0,
                        "match_type": pm["match_type"], "elo_range": 0,
                        "players": others, "found_count": 4}
            return {"status": "confirm", "match_type": pm["match_type"],
                    "remaining": max(0, round(pm["ts"] + CONFIRM_SECONDS - now)),
                    "accepted": len(pm["accepted"]),
                    "total": len(pm["humans"]),
                    "me_accepted": user_id in pm["accepted"],
                    "players": others, "found_count": 4}
        fb = await self.db.mm_feedback.find_one_and_delete({"_id": user_id})
        if fb and now - fb["ts"] < FEEDBACK_TTL:
            return {"status": fb["status"]}
        me = await self.db.mm_queue.find_one({"user_ids": user_id})
        if me:
            mt = me["match_type"]
            await self.db.mm_queue.update_one({"_id": me["_id"]},
                                              {"$set": {"last_seen": now}})
            q = await self.db.mm_queue.find({"match_type": mt}).to_list(200)
            waited = now - me["ts"]
            my_window = elo_window(waited)
            my_elo = self._entry_elo(me)
            remaining = 4 - len(me["players"])
            compatible = []
            for e in q:
                if e["_id"] == me["_id"] or len(compatible) >= remaining:
                    continue
                if e["duo"] != me["duo"]:  # duo vs duo / solo vs solo only
                    continue
                window = min(my_window, elo_window(now - e["ts"]))
                if abs(self._entry_elo(e) - my_elo) <= window:
                    for p in e["players"]:
                        compatible.append({"username": p["username"],
                                           "avatar_id": p["avatar_id"],
                                           "elo": (p.get("elo_duo", 1000)
                                                   if me["duo"] else p["elo"])})
            compatible = compatible[:remaining]
            res = {"status": "waiting", "waited": round(waited), "match_type": mt,
                   "elo_range": my_window, "players": compatible,
                   "found_count": len(me["players"]) + len(compatible)}
            if me["duo"]:
                partner = next(p for p in me["players"] if p["user_id"] != user_id)
                res["duo"] = {
                    "partner": {"username": partner["username"],
                                "avatar_id": partner["avatar_id"],
                                "elo": partner.get("elo_duo", 1000)},
                }
            return res
        # launcher waiting for the invited partner to accept
        inv = await self.db.mm_duo_invites.find_one(
            {"from_player.user_id": user_id, "status": "pending",
             "ts": {"$gt": now - DUO_INVITE_TTL}})
        if inv:
            return {"status": "duo_pending", "invite_id": inv["invite_id"],
                    "match_type": inv["match_type"], "mode": inv["mode"],
                    "partner": inv["to_user"]}
        return {"status": "idle"}

    async def _acquire_lock(self, name, ttl):
        """Short Mongo lease so a single process runs the matching pass.
        The current owner renews freely; others take over once it expires."""
        owner = getattr(self, "_mm_owner", None)
        if owner is None:
            owner = self._mm_owner = uuid.uuid4().hex
        now = time.time()
        res = await self.db.locks.find_one_and_update(
            {"_id": name, "$or": [{"owner": owner}, {"expires": {"$lt": now}}]},
            {"$set": {"expires": now + ttl, "owner": owner}})
        if res is not None:
            return True
        try:
            await self.db.locks.insert_one(
                {"_id": name, "expires": now + ttl, "owner": owner})
            return True
        except Exception:
            return False

    async def matchmaking_loop(self):
        while True:
            try:
                await asyncio.sleep(2)
                if not await self._acquire_lock("matchmaking", MM_LOCK_TTL):
                    continue
                now = time.time()
                # expired one-shot data
                await self.db.mm_matched.delete_many({"ts": {"$lt": now - MATCHED_TTL}})
                await self.db.mm_feedback.delete_many({"ts": {"$lt": now - FEEDBACK_TTL}})
                await self.db.mm_duo_invites.delete_many({"ts": {"$lt": now - DUO_INVITE_TTL}})
                # purge entries whose members stopped polling
                stale = await self.db.mm_queue.find(
                    {"last_seen": {"$lt": now - QUEUE_STALE_SECONDS}}).to_list(200)
                for e in stale:
                    res = await self.db.mm_queue.delete_one({"_id": e["_id"]})
                    if res.deleted_count and e["duo"]:
                        for p in e["players"]:
                            await self._set_feedback(p["user_id"], "duo_cancelled")
                # expire confirmation windows (requeue/remove players)
                await self._sweep_pending_confirms(now)
                for mt in ("short", "long"):
                    q = await self.db.mm_queue.find({"match_type": mt}).to_list(200)
                    while True:
                        group = self._find_group(q, now)
                        if not group:
                            break
                        for e in group:
                            q.remove(e)
                            await self.db.mm_queue.delete_one({"_id": e["_id"]})
                        await self._make_match(group, mt)
                # entice recently-active players when the queue is stuck waiting
                try:
                    await maybe_send_queue_push(self.db)
                except Exception:
                    logger.exception("queue push nudge error")
                # daily peak-hour rally push (21:00 Tunisia)
                try:
                    await maybe_send_peak_hour_push(self.db)
                except Exception:
                    logger.exception("peak hour push error")
                # sweep leftover live data (any process may have crashed)
                await self.db.live_games.delete_many(
                    {"phase": "finished", "updated_at": {"$lt": now - 900}})
                await self.db.live_games.delete_many(
                    {"updated_at": {"$lt": now - 1800}})
                await self.db.live_rooms.delete_many(
                    {"started": True, "started_at": {"$lt": now - 300}})
                await self.db.live_rooms.delete_many(
                    {"created": {"$lt": now - 21600}})
            except Exception:
                logger.exception("matchmaking loop error")

    def _elo_ok(self, entries, now):
        elos = [self._entry_elo(e) for e in entries]
        allowed = min(elo_window(now - e["ts"]) for e in entries)
        return max(elos) - min(elos) <= allowed

    def _find_group(self, q, now):
        """Pick entries totalling exactly 4 players: duo+duo, or 4 solos."""
        duos = sorted([e for e in q if e["duo"]], key=lambda e: e["ts"])
        solos = sorted([e for e in q if not e["duo"]], key=lambda e: e["ts"])
        # 1) duo vs duo (duos never mix with solos)
        for i, a in enumerate(duos):
            for b in duos[i + 1:]:
                if self._elo_ok([a, b], now):
                    return [a, b]
        # 2) four solos (balanced on individual ELO)
        if len(solos) >= 4:
            entries = sorted(solos, key=lambda e: e["players"][0]["elo"])
            for i in range(len(entries) - 3):
                window = entries[i:i + 4]
                spread = (window[-1]["players"][0]["elo"]
                          - window[0]["players"][0]["elo"])
                allowed = min(elo_window(now - e["ts"]) for e in window)
                if spread <= allowed:
                    return window
        return None

    async def _make_match(self, batch, match_type):
        """A full table was found: every player must confirm presence within
        CONFIRM_SECONDS before the game actually starts (absent players are
        filtered out instead of paralysing the table)."""
        humans = [p["user_id"] for e in batch for p in e["players"]]
        mid = f"pm_{uuid.uuid4().hex[:10]}"
        await self.db.mm_pending.insert_one({
            "_id": mid, "match_type": match_type, "ts": time.time(),
            "entries": [{"players": e["players"], "user_ids": e["user_ids"],
                         "duo": e["duo"], "ts": e["ts"]} for e in batch],
            "humans": humans, "accepted": [], "cancelled": []})
        await sync_channel.push_event(
            humans, {"type": "mm_confirm", "remaining": CONFIRM_SECONDS})
        # players whose app is backgrounded get a push notification
        try:
            await maybe_send_match_found_push(self.db, humans)
        except Exception:
            logger.exception("match found push error")
        logger.info("pending match %s awaiting confirmation (%s)", mid, humans)

    async def confirm_match(self, user_id):
        """Mark the player as confirmed; start the game once everyone did."""
        pm = await self.db.mm_pending.find_one_and_update(
            {"humans": user_id},
            {"$addToSet": {"accepted": user_id}},
            return_document=ReturnDocument.AFTER)
        if not pm:
            return False
        if set(pm["humans"]) <= set(pm["accepted"]):
            # atomic take: only one caller creates the game
            taken = await self.db.mm_pending.find_one_and_delete({"_id": pm["_id"]})
            if taken:
                await self._create_confirmed_match(taken["entries"],
                                                   taken["match_type"])
        return True

    async def _sweep_pending_confirms(self, now):
        """Expire confirmation windows: confirmed entries rejoin at the head
        of the queue, silent players are removed (and counted)."""
        expired = await self.db.mm_pending.find(
            {"ts": {"$lt": now - CONFIRM_SECONDS - CONFIRM_GRACE}}).to_list(50)
        for pm in expired:
            taken = await self.db.mm_pending.find_one_and_delete({"_id": pm["_id"]})
            if not taken:
                continue
            accepted = set(taken["accepted"])
            cancelled = set(taken.get("cancelled") or [])
            requeued, removed = [], []
            for e in taken["entries"]:
                members = [p["user_id"] for p in e["players"]]
                if all(m in accepted and m not in cancelled for m in members):
                    # everyone in this entry confirmed: head of the queue
                    # (original ts kept = oldest = served first)
                    await self.db.mm_queue.insert_one({
                        "_id": f"q_{uuid.uuid4().hex[:10]}",
                        "match_type": taken["match_type"],
                        "players": e["players"], "user_ids": members,
                        "duo": e["duo"], "ts": e["ts"], "last_seen": now})
                    requeued += members
                    continue
                for m in members:
                    if m in cancelled:
                        continue  # explicit cancel: no blame, no requeue
                    if m in accepted:  # duo partner let down by the other
                        await self._set_feedback(m, "duo_cancelled")
                        await sync_channel.push_event([m], {"type": "mm_update"})
                    else:
                        removed.append(m)
                        await self._set_feedback(m, "removed_confirm")
                        await self.db.reliability_events.insert_one(
                            {"ts": datetime.now(timezone.utc),
                             "user_id": m, "kind": "no_accept"})
            if requeued:
                await sync_channel.push_event(requeued, {"type": "mm_update"})
            if removed:
                await sync_channel.push_event(removed, {"type": "mm_update"})
            logger.info("pending match %s expired: requeued=%s removed=%s",
                        taken["_id"], requeued, removed)

    async def _create_confirmed_match(self, batch, match_type):
        duos = [e for e in batch if e["duo"]]
        if len(duos) == 2:
            a, b = duos
            # duo partners on the same team (seats 0&2 vs 1&3);
            # duo games are rated on each player's separate duo ELO
            seats = [dict(p, elo=p.get("elo_duo", 1000))
                     for p in (a["players"][0], b["players"][0],
                               a["players"][1], b["players"][1])]
            game_id = await self.create_game(seats, match_type, shuffle=False,
                                             elo_mode="duo")
        else:
            players = sorted((e["players"][0] for e in batch),
                             key=lambda p: p["elo"], reverse=True)
            # balanced teams: strongest + weakest (seats 0 & 2) vs the two middles
            seats = [players[0], players[1], players[3], players[2]]
            game_id = await self.create_game(seats, match_type, shuffle=False)
        await self._set_matched([p["user_id"] for e in batch
                                 for p in e["players"]], game_id)
        logger.info("match created %s (duo=%d, elo %s)", game_id, len(duos),
                    [p["elo"] for p in seats])
