"""Live game orchestration: WebSocket hub, bots, timers, matchmaking, private rooms."""
import asyncio
import logging
import random
import string
import time
import uuid
from datetime import datetime, timezone

import bot_ai
import game_logic as gl

logger = logging.getLogger(__name__)

BOT_NAMES = ["Ammar", "Salah", "Hédi", "Mabrouk", "Fatma", "Zohra",
             "Baya", "Moncef", "Habib", "Naïma", "Mongi", "Aziza"]
AVATAR_IDS = [f"av{i}" for i in range(1, 13)]
QUEUE_STALE_SECONDS = 12
DUO_WAIT_SECONDS = 120  # "wait" duo mode: prefer duo opponents for 2 minutes
DUO_INVITE_TTL = 120  # duo invites expire after 2 minutes
ELO_K = 32
DISCONNECT_GRACE = 4          # seconds before a lost socket triggers the auto-pause
DISCONNECT_PAUSE_SECONDS = 120  # network pause: bot substitutes after 2 min
ABANDONED_CLEANUP_SECONDS = 600  # rejoin window when nobody is connected


def elo_window(waited_seconds):
    """Accepted ELO gap: ±100 at start, widening by 50 every 5s of waiting."""
    return 100 + int(waited_seconds // 5) * 50


def make_bots(n, taken_names):
    pool = [b for b in BOT_NAMES if b not in taken_names] or BOT_NAMES
    names = random.sample(pool, min(n, len(pool)))
    while len(names) < n:
        names.append(random.choice(BOT_NAMES))
    return [{"user_id": f"bot_{uuid.uuid4().hex[:8]}", "username": name,
             "avatar_id": random.choice(AVATAR_IDS), "is_bot": True, "elo": 1000}
            for name in names]


def elo_delta(winner_avg, loser_avg):
    expected = 1 / (1 + 10 ** ((loser_avg - winner_avg) / 400))
    return max(1, round(ELO_K * (1 - expected)))


def room_code():
    return "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6))


class LiveGame:
    def __init__(self, game):
        self.game = game
        self.lock = asyncio.Lock()
        self.sockets = {}  # user_id -> set[WebSocket]
        self.pending_task = None
        self.finalized = False
        self.chat_last = {}  # seat -> last chat timestamp (rate limit)


CHAT_MSG_IDS = {"wellPlayed", "yezzi", "aychek", "luck", "yalla",
                "oops", "sahha", "thinking"}
CHAT_EMOJIS = {"😂", "😭", "😡", "🔥", "👏", "🤝", "😎", "🎉"}
CHAT_COOLDOWN = 1.5  # seconds between messages per player


class GameManager:
    def __init__(self, db):
        self.db = db
        self.games = {}  # game_id -> LiveGame
        self.queues = {"short": [], "long": []}  # entries {players[], duo, mode, ts}
        self.matched = {}  # user_id -> {game_id, ts}
        self.rooms = {}  # code -> room dict
        self.duo_invites = {}  # invite_id -> {from_player, to_user, match_type, mode, ts, status}
        self.duo_feedback = {}  # user_id -> {"status", "ts"} one-shot info (declined/cancelled)

    # ================= games =================

    def create_game(self, humans, match_type, shuffle=True, ranked=True, turn_timeout=30,
                    host_user_id=None, origin="online"):
        players = list(humans)
        bots = make_bots(4 - len(players), {p["username"] for p in players})
        players += bots
        if shuffle:
            random.shuffle(players)
        game_id = f"g_{uuid.uuid4().hex[:12]}"
        game = gl.BeloteGame(game_id, players, match_type, turn_timeout=turn_timeout)
        game.ranked = ranked
        game.host_user_id = host_user_id
        game.origin = origin
        live = LiveGame(game)
        self.games[game_id] = live
        self.schedule(live)
        return game_id

    async def connect(self, game_id, user_id, ws):
        live = self.games.get(game_id)
        if not live:
            return None
        live.sockets.setdefault(user_id, set()).add(ws)
        seat = live.game.seat_of(user_id)
        rejoined = False
        resumed = None
        async with live.lock:
            g = live.game
            if seat is not None and g.players[seat].get("left"):
                g.players[seat]["left"] = False
                rejoined = True
            # the player whose network drop paused the game is back: resume now
            if (seat is not None and g.paused
                    and g.paused.get("reason") == "disconnect"
                    and g.paused["seat"] == seat):
                resumed = g.resume(None)
        await self._send(ws, live.game.state_for(seat), [])
        events = ([{"e": "rejoined", "seat": seat}] if rejoined else []) + (resumed or [])
        if events:
            await self.broadcast(live, events)
            self.schedule(live)
        return live

    def disconnect(self, game_id, user_id, ws):
        live = self.games.get(game_id)
        if not live:
            return
        conns = live.sockets.get(user_id)
        if conns:
            conns.discard(ws)
            if not conns:
                live.sockets.pop(user_id, None)
        g = live.game
        if g.phase == "finished":
            return
        seat = g.seat_of(user_id)
        if (seat is not None and user_id not in live.sockets
                and not g.players[seat].get("left") and live.sockets):
            # a seated human dropped while others are still connected
            asyncio.create_task(self._handle_disconnect(game_id, user_id))
        if not live.sockets:
            asyncio.create_task(self._cleanup_if_abandoned(game_id))

    async def _handle_disconnect(self, game_id, user_id):
        """After a short grace period, pause the game and tell the other players."""
        await asyncio.sleep(DISCONNECT_GRACE)
        live = self.games.get(game_id)
        if not live or user_id in live.sockets or not live.sockets:
            return
        g = live.game
        seat = g.seat_of(user_id)
        if seat is None or g.players[seat].get("left"):
            return
        async with live.lock:
            if (user_id in live.sockets or g.paused
                    or g.phase not in ("bidding", "playing", "surcontre")):
                return
            events = g.pause_disconnect(seat, DISCONNECT_PAUSE_SECONDS)
            await self.broadcast(live, events)
        self.schedule(live)

    async def _cleanup_if_abandoned(self, game_id):
        await asyncio.sleep(ABANDONED_CLEANUP_SECONDS)
        live = self.games.get(game_id)
        if live and not live.sockets:
            if live.pending_task and not live.pending_task.done():
                live.pending_task.cancel()
            self.games.pop(game_id, None)
            logger.info("game %s abandoned, removed", game_id)

    async def _send(self, ws, state, events):
        try:
            await ws.send_json({"type": "update", "state": state, "events": events})
        except Exception:
            pass

    async def broadcast(self, live, events):
        for user_id, conns in list(live.sockets.items()):
            seat = live.game.seat_of(user_id)
            state = live.game.state_for(seat)
            for ws in list(conns):
                await self._send(ws, state, events)

    async def handle_action(self, game_id, user_id, msg, ws):
        live = self.games.get(game_id)
        if not live:
            await ws.send_json({"type": "error", "message": "game_not_found"})
            return
        g = live.game
        seat = g.seat_of(user_id)
        if seat is None:
            await ws.send_json({"type": "error", "message": "not_in_game"})
            return
        action = msg.get("action")
        try:
            async with live.lock:
                if g.paused and action in ("bid", "pass", "capot", "contre",
                                           "surcontre", "decline_surcontre", "play"):
                    raise ValueError("paused")
                if action == "bid":
                    events = g.apply_bid(seat, int(msg.get("value", 0)), msg.get("suit"))
                elif action == "pass":
                    events = g.apply_pass(seat)
                elif action == "capot":
                    events = g.apply_capot(seat, msg.get("suit"))
                elif action == "contre":
                    events = g.apply_contre(seat)
                elif action == "surcontre":
                    events = g.apply_surcontre(seat)
                elif action == "decline_surcontre":
                    events = g.apply_decline_surcontre(seat)
                elif action == "play":
                    events = g.apply_play(seat, msg.get("card"))
                elif action == "ready":
                    events = g.apply_ready(seat)
                elif action == "pause_request":
                    required = [p["seat"] for p in g.players
                                if not p["is_bot"] and not p.get("left")
                                and p["seat"] != seat and p["user_id"] in live.sockets]
                    events = g.request_pause(seat, required)
                elif action == "pause_accept":
                    events = g.accept_pause(seat)
                elif action == "pause_decline":
                    events = g.decline_pause(seat)
                elif action == "resume":
                    events = g.resume(seat)
                elif action == "chat":
                    kind = msg.get("kind")
                    value = msg.get("value")
                    valid = ((kind == "msg" and value in CHAT_MSG_IDS)
                             or (kind == "emoji" and value in CHAT_EMOJIS))
                    now = time.time()
                    if not valid or now - live.chat_last.get(seat, 0) < CHAT_COOLDOWN:
                        return
                    live.chat_last[seat] = now
                    events = [{"e": "chat", "seat": seat, "kind": kind, "msg": value}]
                elif action == "leave":
                    if g.host_user_id == user_id and g.phase != "finished":
                        # the creator ends the game for everyone (no ELO impact)
                        g.phase = "finished"
                        g.match_over = True
                        g.cancelled = True
                        g.paused = None
                        g.pause_req = None
                        g.version += 1
                        events = [{"e": "game_cancelled", "seat": seat}]
                        asyncio.create_task(self._delayed_remove(g.game_id, 60))
                    else:
                        g.players[seat]["left"] = True
                        events = [{"e": "left", "seat": seat}]
                else:
                    return
                await self.broadcast(live, events)
                if action == "ready" and g.phase == "hand_end":
                    # only connected humans are required (a dropped player
                    # must not block the table for 2 minutes)
                    required = [p["seat"] for p in g.players
                                if not p["is_bot"] and not p.get("left")
                                and p["user_id"] in live.sockets]
                    if required and all(s in g.ready_seats for s in required):
                        await self._advance_hand_end(live)
            self.schedule(live)
        except ValueError as err:
            await ws.send_json({"type": "error", "message": str(err)})

    # ================= automatic driver (bots, timers) =================

    def schedule(self, live):
        if live.pending_task and not live.pending_task.done():
            live.pending_task.cancel()
        live.pending_task = asyncio.create_task(self._auto(live, live.game.version))

    async def _advance_hand_end(self, live):
        """Move on from hand_end (all players ready or deadline). Lock must be held."""
        g = live.game
        if g.match_over:
            g.phase = "finished"
            g.version += 1
            await self._finalize(live)
            await self.broadcast(live, [{"e": "match_end",
                                         "winner_team": g.winner_team}])
            asyncio.create_task(self._delayed_remove(g.game_id, 600))
            return
        events = g.next_hand()
        await self.broadcast(live, events)

    async def _auto(self, live, version):
        try:
            g = live.game
            now = time.time()

            if g.phase == "finished":
                return

            if g.paused:
                await asyncio.sleep(max(0.5, g.paused["until"] - now))
                async with live.lock:
                    if g.version != version or not g.paused:
                        return
                    expired = dict(g.paused)
                    events = g.resume(None)
                    if expired.get("reason") == "disconnect":
                        s = expired["seat"]
                        uid = g.players[s]["user_id"]
                        if uid not in live.sockets and not g.players[s].get("left"):
                            # still offline after the pause: a bot takes over
                            g.players[s]["left"] = True
                            events.append({"e": "left", "seat": s})
                    await self.broadcast(live, events)
                self.schedule(live)
                return

            if g.phase == "hand_end":
                await asyncio.sleep(max(0.5, g.turn_deadline - now))
                async with live.lock:
                    if g.version != version or g.phase != "hand_end":
                        return
                    await self._advance_hand_end(live)
                if g.phase != "finished":
                    self.schedule(live)
                return

            if g.phase == "surcontre":
                team = g.current_bid["seat"] % 2
                seats = [team, team + 2]
                bot_seat = next((s for s in seats if g.players[s]["is_bot"] or
                                 g.players[s].get("left")), None)
                if bot_seat is not None:
                    await asyncio.sleep(random.uniform(1.5, 2.5))
                else:
                    if not g.turn_timeout:
                        return  # untimed game: wait for a human decision
                    await asyncio.sleep(max(0.5, g.turn_deadline - now))
                    bot_seat = seats[0]
                async with live.lock:
                    if g.version != version or g.phase != "surcontre":
                        return
                    if g.players[bot_seat]["is_bot"] and bot_ai.should_surcontre(
                            g.hands[bot_seat], g.current_bid["suit"]):
                        events = g.apply_surcontre(bot_seat)
                    else:
                        events = g.apply_decline_surcontre(bot_seat)
                    await self.broadcast(live, events)
                self.schedule(live)
                return

            if g.phase not in ("bidding", "playing"):
                return

            actor = g.turn
            player = g.players[actor]
            pause = max(0, g.pause_until - now)
            is_auto = player["is_bot"] or player.get("left") or (
                player["user_id"] not in live.sockets and not live.sockets)
            if player["is_bot"] or player.get("left"):
                delay = pause + random.uniform(1.0, 2.0)
            else:
                if not g.turn_timeout:
                    return  # untimed game: no auto-play for connected humans
                delay = max(0.5, g.turn_deadline - now)
            await asyncio.sleep(delay)
            async with live.lock:
                if g.version != version or g.phase not in ("bidding", "playing"):
                    return
                events = self._auto_move(g, actor, forced_human=not (
                    player["is_bot"] or player.get("left")))
                await self.broadcast(live, events)
            self.schedule(live)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("auto driver error for game %s", live.game.game_id)

    def _auto_move(self, g, seat, forced_human=False):
        if g.phase == "bidding":
            if forced_human:
                return g.apply_pass(seat)
            act = bot_ai.bot_bidding_action(g.hands[seat], g.current_bid, seat)
            if act["type"] == "bid":
                try:
                    return g.apply_bid(seat, act["value"], act["suit"])
                except ValueError:
                    return g.apply_pass(seat)
            if act["type"] == "contre":
                try:
                    return g.apply_contre(seat)
                except ValueError:
                    return g.apply_pass(seat)
            return g.apply_pass(seat)
        # playing
        if forced_human:
            legal = gl.legal_moves(g.hands[seat], g.trick, g.trump, seat)
            card = min(legal, key=lambda c: gl.card_points(c, g.trump))
        else:
            card = bot_ai.bot_play(g.hands[seat], g.trick, g.trump, seat)
        return g.apply_play(seat, card)

    async def _delayed_remove(self, game_id, delay):
        await asyncio.sleep(delay)
        self.games.pop(game_id, None)

    # ================= end of match: elo + stats =================

    async def _finalize(self, live):
        if live.finalized:
            return
        live.finalized = True
        g = live.game
        winner = g.winner_team
        now = datetime.now(timezone.utc)
        if not getattr(g, "ranked", True):
            # solo/training games: no ELO, no stats
            g.elo_changes = {}
            await self.db.matches.insert_one({
                "match_id": f"m_{uuid.uuid4().hex[:12]}",
                "game_id": g.game_id,
                "match_type": g.match_type,
                "ranked": False,
                "target": g.target,
                "players": [{"user_id": p["user_id"], "username": p["username"],
                             "seat": p["seat"], "team": p["seat"] % 2, "is_bot": p["is_bot"]}
                            for p in g.players],
                "scores": list(g.match_scores),
                "winner_team": winner,
                "hands_played": g.hand_number,
                "elo_changes": {},
                "finished_at": now.isoformat(),
            })
            return
        team_elos = [
            (g.players[0]["elo"] + g.players[2]["elo"]) / 2,
            (g.players[1]["elo"] + g.players[3]["elo"]) / 2,
        ]
        delta = elo_delta(team_elos[winner], team_elos[1 - winner])
        g.elo_changes = {}
        for p in g.players:
            team = p["seat"] % 2
            change = delta if team == winner else -delta
            g.elo_changes[p["user_id"]] = change
            if p["is_bot"]:
                continue
            user = await self.db.users.find_one({"user_id": p["user_id"]}, {"_id": 0})
            if not user:
                continue
            won = team == winner
            new_elo = max(100, user.get("elo", 1000) + change)
            stats = user.get("stats", {})
            streak = (stats.get("current_streak", 0) + 1) if won else 0
            seat_st = g.seat_stats[p["seat"]]
            await self.db.users.update_one({"user_id": p["user_id"]}, {
                "$set": {
                    "elo": new_elo,
                    "stats.current_streak": streak,
                    "stats.best_streak": max(stats.get("best_streak", 0), streak),
                },
                "$inc": {
                    "games_played": 1,
                    "wins": 1 if won else 0,
                    "losses": 0 if won else 1,
                    "stats.contracts_taken": seat_st["contracts_taken"],
                    "stats.contracts_made": seat_st["contracts_made"],
                    "stats.belotes": seat_st["belotes"],
                    "stats.capots": seat_st["capots"],
                    "stats.points_scored": g.match_scores[team],
                },
                "$push": {"elo_history": {"$each": [{"elo": new_elo, "ts": now.isoformat()}],
                                          "$slice": -50}},
            })
        await self.db.matches.insert_one({
            "match_id": f"m_{uuid.uuid4().hex[:12]}",
            "game_id": g.game_id,
            "match_type": g.match_type,
            "ranked": True,
            "target": g.target,
            "players": [{"user_id": p["user_id"], "username": p["username"],
                         "seat": p["seat"], "team": p["seat"] % 2, "is_bot": p["is_bot"]}
                        for p in g.players],
            "scores": list(g.match_scores),
            "winner_team": winner,
            "hands_played": g.hand_number,
            "elo_changes": g.elo_changes,
            "finished_at": now.isoformat(),
        })

    # ================= matchmaking (ELO-based, real players only) =================
    # Queue entries: {"players": [p] or [p1, p2], "duo": bool,
    #                 "mode": None | "wait" | "duo_only" | "fill",
    #                 "ts": float, "last_seen": float}
    # Duo modes: "wait" = prefer duo opponents for DUO_WAIT_SECONDS then accept
    # solos; "duo_only" = only duo opponents; "fill" = anyone right away.

    def join_queue(self, player, match_type):
        self.leave_queue(player["user_id"])
        self.matched.pop(player["user_id"], None)
        now = time.time()
        self.queues[match_type].append({"players": [player], "duo": False,
                                        "mode": None, "ts": now, "last_seen": now})

    def join_queue_duo(self, p1, p2, match_type, mode):
        for p in (p1, p2):
            self.leave_queue(p["user_id"])
            self.matched.pop(p["user_id"], None)
            self.duo_feedback.pop(p["user_id"], None)
        now = time.time()
        self.queues[match_type].append({"players": [p1, p2], "duo": True,
                                        "mode": mode, "ts": now, "last_seen": now})

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
        self.join_queue_duo(inv["from_player"], to_player,
                            inv["match_type"], inv["mode"])
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
        return sum(p["elo"] for p in e["players"]) / len(e["players"])

    @staticmethod
    def _duo_allows(entry, other_is_duo, now):
        """Whether `entry` accepts being matched with a duo/solo counterpart now."""
        if not entry["duo"] or other_is_duo:
            return True
        mode = entry["mode"]
        if mode == "fill":
            return True
        if mode == "wait":
            return now - entry["ts"] >= DUO_WAIT_SECONDS
        return False  # duo_only

    def _mutually_allowed(self, a, b, now):
        return (self._duo_allows(a, b["duo"], now)
                and self._duo_allows(b, a["duo"], now))

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
                if len(e["players"]) > remaining:
                    continue
                if not self._mutually_allowed(me, e, now):
                    continue
                window = min(my_window, elo_window(now - e["ts"]))
                if abs(self._entry_elo(e) - my_elo) <= window:
                    for p in e["players"]:
                        compatible.append({"username": p["username"],
                                           "avatar_id": p["avatar_id"],
                                           "elo": p["elo"]})
            compatible = compatible[:remaining]
            res = {"status": "waiting", "waited": round(waited), "match_type": mt,
                   "elo_range": my_window, "players": compatible,
                   "found_count": len(me["players"]) + len(compatible)}
            if me["duo"]:
                partner = next(p for p in me["players"] if p["user_id"] != user_id)
                res["duo"] = {
                    "partner": {"username": partner["username"],
                                "avatar_id": partner["avatar_id"],
                                "elo": partner["elo"]},
                    "mode": me["mode"],
                    "duo_wait_remaining": (max(0, DUO_WAIT_SECONDS - int(waited))
                                           if me["mode"] == "wait" else None),
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
        """Pick entries totalling exactly 4 players, mutually compatible."""
        duos = sorted([e for e in q if e["duo"]], key=lambda e: e["ts"])
        solos = sorted([e for e in q if not e["duo"]], key=lambda e: e["ts"])
        # 1) duo vs duo (always the preferred pairing)
        for i, a in enumerate(duos):
            for b in duos[i + 1:]:
                if self._elo_ok([a, b], now):
                    return [a, b]
        # 2) duo + two solos, when the duo's mode currently accepts solos
        for d in duos:
            if not self._duo_allows(d, False, now):
                continue
            for i, s1 in enumerate(solos):
                for s2 in solos[i + 1:]:
                    if self._elo_ok([d, s1, s2], now):
                        return [d, s1, s2]
        # 3) four solos (balanced on individual ELO)
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
        solos = [e for e in batch if not e["duo"]]
        if len(duos) == 2:
            a, b = duos
            # duo partners on the same team (seats 0&2 vs 1&3)
            seats = [a["players"][0], b["players"][0],
                     a["players"][1], b["players"][1]]
        elif len(duos) == 1:
            d = duos[0]
            s = [e["players"][0] for e in solos]
            seats = [d["players"][0], s[0], d["players"][1], s[1]]
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

    # ================= private rooms =================

    def create_room(self, host_player, match_type, turn_timer=False):
        code = room_code()
        while code in self.rooms:
            code = room_code()
        self.rooms[code] = {"code": code, "host_id": host_player["user_id"],
                            "seats": [host_player, None, None, None],
                            "reservations": {}, "match_type": match_type,
                            "turn_timer": bool(turn_timer),
                            "started": False, "game_id": None, "created": time.time()}
        return self.rooms[code]

    def get_room(self, code):
        return self.rooms.get(code.upper())

    def join_room(self, code, player):
        room = self.get_room(code)
        if not room:
            raise ValueError("room_not_found")
        if room["started"]:
            raise ValueError("room_started")
        if any(p and p["user_id"] == player["user_id"] for p in room["seats"]):
            return room
        free = [i for i, p in enumerate(room["seats"]) if p is None]
        if not free:
            raise ValueError("room_full")
        wanted = room["reservations"].pop(player["user_id"], None)
        seat = wanted if wanted in free else free[0]
        room["seats"][seat] = player
        return room

    def move_seat(self, code, user_id, seat):
        room = self.get_room(code)
        if not room:
            raise ValueError("room_not_found")
        if room["started"]:
            raise ValueError("room_started")
        cur = next((i for i, p in enumerate(room["seats"])
                    if p and p["user_id"] == user_id), None)
        if cur is None:
            raise ValueError("not_in_room")
        if seat == cur:
            return room
        if room["seats"][seat] is not None:
            raise ValueError("seat_taken")
        room["seats"][seat] = room["seats"][cur]
        room["seats"][cur] = None
        return room

    def reserve_seat(self, code, user_id, seat):
        room = self.get_room(code)
        if room is not None and seat is not None:
            room["reservations"][user_id] = seat

    def leave_room(self, code, user_id):
        room = self.get_room(code)
        if not room:
            return
        room["seats"] = [None if (p and p["user_id"] == user_id) else p
                         for p in room["seats"]]
        if not any(room["seats"]) or (room["host_id"] == user_id and not room["started"]):
            self.rooms.pop(room["code"], None)

    def start_room(self, code, user_id):
        room = self.get_room(code)
        if not room:
            raise ValueError("room_not_found")
        if room["host_id"] != user_id:
            raise ValueError("not_host")
        if room["started"]:
            return room["game_id"]
        humans = [p for p in room["seats"] if p]
        bots = make_bots(4 - len(humans), {p["username"] for p in humans})
        seats = list(room["seats"])
        bi = 0
        for i in range(4):
            if seats[i] is None:
                seats[i] = bots[bi]
                bi += 1
        game_id = self.create_game(seats, room["match_type"], shuffle=False,
                                   turn_timeout=30 if room.get("turn_timer") else None,
                                   host_user_id=room["host_id"], origin="private")
        room["started"] = True
        room["game_id"] = game_id
        asyncio.create_task(self._delayed_remove_room(room["code"], 300))
        return game_id

    async def _delayed_remove_room(self, code, delay):
        await asyncio.sleep(delay)
        self.rooms.pop(code, None)
