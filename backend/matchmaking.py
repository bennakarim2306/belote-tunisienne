"""ELO-based matchmaking queues and duo invites (duo vs duo strictly)."""
import asyncio
import logging
import time
import uuid

from live_utils import elo_window, make_bots

logger = logging.getLogger(__name__)

QUEUE_STALE_SECONDS = 12
DUO_INVITE_TTL = 120  # duo invites expire after 2 minutes


class MatchmakingMixin:
    """Queue entries: {"players": [p] or [p1, p2], "duo": bool,
                       "ts": float, "last_seen": float}
    Duos ONLY match other duos (duo vs duo); solos only match solos.
    Duo rating uses each player's separate duo ELO (elo_duo), averaged."""

    def join_queue(self, player, match_type):
        self.leave_queue(player["user_id"])
        self.matched.pop(player["user_id"], None)
        now = time.time()
        self.queues[match_type].append({"players": [player], "duo": False,
                                        "ts": now, "last_seen": now})

    def join_queue_duo(self, p1, p2, match_type):
        for p in (p1, p2):
            self.leave_queue(p["user_id"])
            self.matched.pop(p["user_id"], None)
            self.duo_feedback.pop(p["user_id"], None)
        now = time.time()
        self.queues[match_type].append({"players": [p1, p2], "duo": True,
                                        "ts": now, "last_seen": now})

    def leave_queue(self, user_id):
        """Remove the whole entry containing the user (dissolves a duo)."""
        for q in self.queues.values():
            for e in list(q):
                if any(p["user_id"] == user_id for p in e["players"]):
                    q.remove(e)
                    if e["duo"]:
                        for p in e["players"]:
                            if p["user_id"] != user_id:
                                self.duo_feedback[p["user_id"]] = {
                                    "status": "duo_cancelled", "ts": time.time()}

    # ---------- duo invites ----------

    def create_duo_invite(self, from_player, to_user, match_type, mode):
        self.cancel_duo_invite(from_player["user_id"])
        iid = f"di_{uuid.uuid4().hex[:10]}"
        self.duo_invites[iid] = {"invite_id": iid, "from_player": from_player,
                                 "to_user": to_user, "match_type": match_type,
                                 "mode": mode, "ts": time.time(), "status": "pending"}
        return iid

    def _purge_duo_invites(self):
        now = time.time()
        for iid in [i for i, v in self.duo_invites.items()
                    if now - v["ts"] > DUO_INVITE_TTL]:
            self.duo_invites.pop(iid, None)

    def pending_duo_invites_for(self, user_id):
        self._purge_duo_invites()
        return [v for v in self.duo_invites.values()
                if v["to_user"]["user_id"] == user_id and v["status"] == "pending"]

    def accept_duo_invite(self, invite_id, to_player):
        self._purge_duo_invites()
        inv = self.duo_invites.get(invite_id)
        if (not inv or inv["status"] != "pending"
                or inv["to_user"]["user_id"] != to_player["user_id"]):
            return None
        self.duo_invites.pop(invite_id, None)
        if inv["mode"] == "vs_ai":
            # duo vs AI: create the training game right away (humans seats 0&2)
            p1 = inv["from_player"]
            for p in (p1, to_player):
                self.leave_queue(p["user_id"])
                self.matched.pop(p["user_id"], None)
                self.duo_feedback.pop(p["user_id"], None)
            bots = make_bots(2, {p1["username"], to_player["username"]})
            game_id = self.create_game([p1, bots[0], to_player, bots[1]],
                                       inv["match_type"], shuffle=False,
                                       ranked=False, turn_timeout=None,
                                       host_user_id=p1["user_id"], origin="solo")
            now = time.time()
            for uid in (p1["user_id"], to_player["user_id"]):
                self.matched[uid] = {"game_id": game_id, "ts": now}
            inv["game_id"] = game_id
            return inv
        self.join_queue_duo(inv["from_player"], to_player, inv["match_type"])
        return inv

    def decline_duo_invite(self, invite_id, user_id):
        inv = self.duo_invites.get(invite_id)
        if inv and inv["to_user"]["user_id"] == user_id and inv["status"] == "pending":
            self.duo_invites.pop(invite_id, None)
            self.duo_feedback[inv["from_player"]["user_id"]] = {
                "status": "duo_declined", "ts": time.time()}

    def cancel_duo_invite(self, from_user_id):
        for iid, v in list(self.duo_invites.items()):
            if v["from_player"]["user_id"] == from_user_id and v["status"] == "pending":
                self.duo_invites.pop(iid, None)

    # ---------- status & matching ----------

    @staticmethod
    def _entry_elo(e):
        """Solo entries use the solo ELO; duo entries use the duo-ELO average."""
        if e["duo"]:
            return sum(p.get("elo_duo", 1000) for p in e["players"]) / 2
        return e["players"][0]["elo"]

    def queue_status(self, user_id):
        m = self.matched.get(user_id)
        if m:
            return {"status": "found", "game_id": m["game_id"]}
        fb = self.duo_feedback.pop(user_id, None)
        if fb and time.time() - fb["ts"] < 30:
            return {"status": fb["status"]}
        now = time.time()
        for mt, q in self.queues.items():
            me = next((e for e in q
                       if any(p["user_id"] == user_id for p in e["players"])), None)
            if not me:
                continue
            me["last_seen"] = now
            waited = now - me["ts"]
            my_window = elo_window(waited)
            my_elo = self._entry_elo(me)
            remaining = 4 - len(me["players"])
            compatible = []
            for e in q:
                if e is me or len(compatible) >= remaining:
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
        self._purge_duo_invites()
        inv = next((v for v in self.duo_invites.values()
                    if v["from_player"]["user_id"] == user_id
                    and v["status"] == "pending"), None)
        if inv:
            return {"status": "duo_pending", "invite_id": inv["invite_id"],
                    "match_type": inv["match_type"], "mode": inv["mode"],
                    "partner": inv["to_user"]}
        return {"status": "idle"}

    async def matchmaking_loop(self):
        while True:
            try:
                await asyncio.sleep(2)
                now = time.time()
                for uid in [u for u, m in self.matched.items() if now - m["ts"] > 120]:
                    self.matched.pop(uid, None)
                for mt, q in self.queues.items():
                    # purge entries whose members stopped polling
                    q[:] = [e for e in q if now - e["last_seen"] <= QUEUE_STALE_SECONDS]
                    while True:
                        group = self._find_group(q, now)
                        if not group:
                            break
                        for e in group:
                            q.remove(e)
                        self._make_match(group, mt)
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

    def _make_match(self, batch, match_type):
        duos = [e for e in batch if e["duo"]]
        if len(duos) == 2:
            a, b = duos
            # duo partners on the same team (seats 0&2 vs 1&3);
            # duo games are rated on each player's separate duo ELO
            seats = [dict(p, elo=p.get("elo_duo", 1000))
                     for p in (a["players"][0], b["players"][0],
                               a["players"][1], b["players"][1])]
            game_id = self.create_game(seats, match_type, shuffle=False)
            self.games[game_id].game.elo_mode = "duo"
        else:
            players = sorted((e["players"][0] for e in batch),
                             key=lambda p: p["elo"], reverse=True)
            # balanced teams: strongest + weakest (seats 0 & 2) vs the two middles
            seats = [players[0], players[1], players[3], players[2]]
            game_id = self.create_game(seats, match_type, shuffle=False)
        now = time.time()
        for e in batch:
            for p in e["players"]:
                self.matched[p["user_id"]] = {"game_id": game_id, "ts": now}
        logger.info("match created %s (duo=%d, elo %s)", game_id, len(duos),
                    [p["elo"] for p in seats])
