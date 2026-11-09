"""Live game runtime: WebSocket hub, player actions, bot/timer auto-driver.

MongoDB (live_games) is the source of truth for game state: every mutation is
committed with an optimistic version check, and a light poller synchronises
processes so any server process/worker can serve any player (multi-process
deployments, restarts). Each process keeps a local LiveGame cache holding its
own sockets, lock and driver tasks."""
import asyncio
import json
import logging
import random
import time

import bot_ai
import coach
import game_logic as gl
import server_metrics

logger = logging.getLogger(__name__)

DISCONNECT_GRACE = 4          # seconds before a lost socket triggers the auto-pause
DISCONNECT_PAUSE_SECONDS = 30  # network pause: bot substitutes after 30 s (seat stays reclaimable)
AFK_MISSED_TURNS = 3  # consecutive missed turns before the bot takes over
ABANDONED_CLEANUP_SECONDS = 600  # local cache eviction when nobody is connected
POLL_INTERVAL = 0.5           # cross-process sync cadence
CONN_FRESH_SECONDS = 20       # doc heartbeat freshness = "connected somewhere"

CHAT_MSG_IDS = {"wellPlayed", "yezzi", "aychek", "luck", "yalla",
                "oops", "sahha", "thinking"}
CHAT_EMOJIS = {"😂", "😭", "😡", "🔥", "👏", "🤝", "😎", "🎉"}
CHAT_COOLDOWN = 1.5  # seconds between messages per player


class StaleGameError(Exception):
    """Another process advanced the game first; local state was reloaded."""


class LiveGame:
    def __init__(self, game):
        self.game = game
        self.lock = asyncio.Lock()
        self.sockets = {}  # user_id -> set[WebSocket] (THIS process only)
        self.pending_task = None
        self.poll_task = None
        self.finalized = False
        self.chat_last = {}  # seat -> last chat timestamp (rate limit)
        self.saved_version = game.version  # version currently persisted in Mongo
        self.last_socket_at = time.time()


class GameRuntimeMixin:
    """WebSocket connections, action handling and the automatic driver."""

    # ---------- persistence (MongoDB is the source of truth) ----------

    def _game_doc(self, g):
        return {
            "state": g.to_doc(),
            "version": g.version,
            "phase": g.phase,
            "user_ids": [p["user_id"] for p in g.players if not p["is_bot"]],
            "updated_at": time.time(),
        }

    async def _insert_game_doc(self, live):
        g = live.game
        await self.db.live_games.insert_one({
            "_id": g.game_id, **self._game_doc(g),
            "created_at": time.time(), "events": [], "conn": {}})
        live.saved_version = g.version

    async def _commit(self, live, events):
        """Persist the mutation then notify local sockets. Raises StaleGameError
        (after reloading the remote truth) if another process advanced first."""
        g = live.game
        update = {"$set": self._game_doc(g)}
        if events:
            update["$push"] = {"events": {"$each": [{"seq": g.version,
                                                     "items": events}],
                                          "$slice": -40}}
        res = await self.db.live_games.update_one(
            {"_id": g.game_id, "version": live.saved_version}, update)
        if res.matched_count == 0:
            full = await self.db.live_games.find_one({"_id": g.game_id})
            if full:
                live.game = gl.BeloteGame.from_doc(full["state"])
                live.saved_version = live.game.version
                await self.broadcast(live, [])
            else:
                # deleted everywhere (cancelled/swept): stop the local driver
                g.phase = "finished"
            raise StaleGameError()
        live.saved_version = g.version
        await self.broadcast(live, events)

    async def _load_live(self, game_id):
        """Local cache or MongoDB: any process can serve any game."""
        live = self.games.get(game_id)
        if live:
            return live
        doc = await self.db.live_games.find_one({"_id": game_id})
        if not doc:
            return None
        live = self.games.get(game_id)  # a concurrent load may have won
        if live:
            return live
        live = LiveGame(gl.BeloteGame.from_doc(doc["state"]))
        live.finalized = bool(doc.get("finalized"))
        self.games[game_id] = live
        self.schedule(live)
        self._ensure_poller(live)
        return live

    def _ensure_poller(self, live):
        if live.poll_task is None or live.poll_task.done():
            live.poll_task = asyncio.create_task(
                self._poll_loop(live.game.game_id))

    async def _poll_loop(self, game_id):
        """Cross-process sync: pick up moves committed by other server
        processes, heartbeat local connections, evict abandoned caches."""
        last_hb = 0.0
        while True:
            await asyncio.sleep(POLL_INTERVAL)
            live = self.games.get(game_id)
            if live is None:
                return
            try:
                now = time.time()
                if not live.sockets:
                    if now - live.last_socket_at > ABANDONED_CLEANUP_SECONDS:
                        if live.pending_task and not live.pending_task.done():
                            live.pending_task.cancel()
                        self.games.pop(game_id, None)
                        logger.info("game %s abandoned locally, cache evicted",
                                    game_id)
                        return
                elif now - last_hb > 10:
                    last_hb = now
                    hb = {f"conn.{uid}": now for uid in live.sockets}
                    hb["updated_at"] = now
                    await self.db.live_games.update_one({"_id": game_id},
                                                        {"$set": hb})
                head = await self.db.live_games.find_one({"_id": game_id},
                                                         {"version": 1})
                if head is None:
                    # removed everywhere (cancelled / swept): drop local cache
                    if live.pending_task and not live.pending_task.done():
                        live.pending_task.cancel()
                    self.games.pop(game_id, None)
                    return
                if head["version"] > live.game.version:
                    full = await self.db.live_games.find_one({"_id": game_id})
                    async with live.lock:
                        if full["version"] <= live.game.version:
                            continue
                        prev = live.game.version
                        live.game = gl.BeloteGame.from_doc(full["state"])
                        live.saved_version = live.game.version
                        events = [it for b in full.get("events", [])
                                  if b["seq"] > prev for it in b.get("items", [])]
                        await self.broadcast(live, events)
                    self.schedule(live)
            except asyncio.CancelledError:
                return
            except Exception:
                logger.exception("poll loop error for game %s", game_id)

    async def _human_present(self, live):
        """user_ids of humans connected on ANY server process (doc heartbeats)."""
        present = set(live.sockets)
        doc = await self.db.live_games.find_one(
            {"_id": live.game.game_id}, {"conn": 1})
        now = time.time()
        for uid, ts in (doc or {}).get("conn", {}).items():
            if ts and now - ts < CONN_FRESH_SECONDS:
                present.add(uid)
        return present

    async def _mark_conn(self, game_id, user_id, value):
        try:
            await self.db.live_games.update_one(
                {"_id": game_id}, {"$set": {f"conn.{user_id}": value}})
        except Exception:
            pass

    # ---------- coach ----------

    def _coach_state(self, g, seat):
        """Game state + coach payload for tutorial (coach-mode) games."""
        state = g.state_for(seat)
        if (getattr(g, "coach", False) and seat is not None
                and not g.players[seat]["is_bot"]):
            state["coach_mode"] = True
            hint = coach.hint_for(g, seat)
            if hint:
                state["coach"] = hint
        return state

    # ---------- connections ----------

    async def connect(self, game_id, user_id, ws):
        live = await self._load_live(game_id)
        if not live:
            return None
        live.sockets.setdefault(user_id, set()).add(ws)
        live.last_socket_at = time.time()
        self._ensure_poller(live)
        await self._mark_conn(game_id, user_id, time.time())
        seat = live.game.seat_of(user_id)
        events = []
        async with live.lock:
            g = live.game
            seat = g.seat_of(user_id)
            if seat is not None and g.players[seat].get("left"):
                g.players[seat]["left"] = False
                g.version += 1
                events.append({"e": "rejoined", "seat": seat})
            # the player whose network drop paused the game is back: resume now
            if (seat is not None and g.paused
                    and g.paused.get("reason") == "disconnect"
                    and g.paused["seat"] == seat):
                events += g.resume(None)
            if events:
                try:
                    await self._commit(live, events)
                except StaleGameError:
                    events = []
        state = self._coach_state(live.game, seat)
        await self._send(ws, state, [])
        try:
            ws._bt_state_h = hash(json.dumps(state, sort_keys=True, default=str))
        except Exception:
            pass
        if events:
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
        live.last_socket_at = time.time()
        if user_id not in live.sockets:
            asyncio.create_task(self._mark_conn(game_id, user_id, 0.0))
        g = live.game
        if g.phase == "finished":
            return
        seat = g.seat_of(user_id)
        if (seat is not None and user_id not in live.sockets
                and not g.players[seat].get("left") and live.sockets):
            # a seated human dropped while others are still connected
            asyncio.create_task(self._handle_disconnect(game_id, user_id))

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
        # reconnected on another server process?
        present = await self._human_present(live)
        if user_id in present:
            return
        async with live.lock:
            g = live.game
            if (user_id in live.sockets or g.paused
                    or g.phase not in ("bidding", "playing", "surcontre")):
                return
            events = g.pause_disconnect(seat, DISCONNECT_PAUSE_SECONDS)
            try:
                await self._commit(live, events)
            except StaleGameError:
                return
        self.schedule(live)

    async def _send(self, ws, state, events):
        try:
            await ws.send_json({"type": "update", "state": state, "events": events})
        except Exception:
            pass

    async def broadcast(self, live, events):
        for user_id, conns in list(live.sockets.items()):
            seat = live.game.seat_of(user_id)
            state = self._coach_state(live.game, seat)
            state_h = hash(json.dumps(state, sort_keys=True, default=str))
            sent = False
            for ws in list(conns):
                # no events and this socket already holds the exact same
                # state: skip the redundant send (poller resyncs, reloads)
                if not events and getattr(ws, "_bt_state_h", None) == state_h:
                    continue
                try:
                    ws._bt_state_h = state_h
                except Exception:
                    pass
                await self._send(ws, state, events)
                sent = True
            if sent:
                server_metrics.record("ws: état envoyé", user_id)

    # ---------- player actions ----------

    async def handle_action(self, game_id, user_id, msg, ws):
        live = await self._load_live(game_id)
        if not live:
            await ws.send_json({"type": "error", "message": "game_not_found"})
            return
        seat = live.game.seat_of(user_id)
        if seat is None:
            await ws.send_json({"type": "error", "message": "not_in_game"})
            return
        action = msg.get("action")
        try:
            async with live.lock:
                g = live.game
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
                elif action == "resume_seat":
                    # the relayed/absent player takes their seat back — only
                    # valid while a bot actually relays (afk/left), otherwise
                    # it could be abused to reset the missed-turn counter
                    p = g.players[seat]
                    if not (p.get("afk") or p.get("left")):
                        return
                    p["afk"] = False
                    p["left"] = False
                    p["missed"] = 0
                    g.version += 1
                    events = [{"e": "afk_back", "seat": seat}]
                elif action == "ready":
                    events = g.apply_ready(seat)
                elif action == "pause_request":
                    present = await self._human_present(live)
                    required = [p["seat"] for p in g.players
                                if not p["is_bot"] and not p.get("left")
                                and p["seat"] != seat and p["user_id"] in present]
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
                    g.version += 1  # committed so other processes relay the chat
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
                        g.version += 1
                        events = [{"e": "left", "seat": seat}]
                else:
                    return
                if action in ("bid", "pass", "capot", "contre", "surcontre",
                              "decline_surcontre", "play", "ready"):
                    # acting in time proves presence: reset the missed-turn
                    # streak and hand the seat back if a bot was relaying
                    p = g.players[seat]
                    if p.get("missed") or p.get("afk"):
                        was_afk = p.get("afk")
                        p["missed"] = 0
                        p["afk"] = False
                        if was_afk:
                            events.append({"e": "afk_back", "seat": seat})
                await self._commit(live, events)
                if action == "ready" and g.phase == "hand_end":
                    # only connected humans are required (a dropped player
                    # must not block the table for 2 minutes)
                    present = await self._human_present(live)
                    required = [p["seat"] for p in g.players
                                if not p["is_bot"] and not p.get("left")
                                and p["user_id"] in present]
                    if required and all(s in g.ready_seats for s in required):
                        await self._advance_hand_end(live)
            self.schedule(live)
        except StaleGameError:
            await ws.send_json({"type": "error", "message": "try_again"})
            self.schedule(live)
        except ValueError as err:
            await ws.send_json({"type": "error", "message": str(err)})

    # ---------- automatic driver (bots, timers) ----------

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
            await self._commit(live, [{"e": "match_end",
                                       "winner_team": g.winner_team}])
            asyncio.create_task(self._delayed_remove(g.game_id, 600))
            return
        events = g.next_hand()
        await self._commit(live, events)

    async def _auto(self, live, version):
        try:
            g = live.game
            now = time.time()

            if g.phase == "finished":
                return

            if g.paused:
                await asyncio.sleep(max(0.5, g.paused["until"] - now))
                present = await self._human_present(live)
                async with live.lock:
                    g = live.game
                    if g.version != version or not g.paused:
                        return
                    expired = dict(g.paused)
                    events = g.resume(None)
                    if expired.get("reason") == "disconnect":
                        s = expired["seat"]
                        uid = g.players[s]["user_id"]
                        if uid not in present and not g.players[s].get("left"):
                            # still offline after the pause: a bot takes over
                            g.players[s]["left"] = True
                            events.append({"e": "left", "seat": s})
                    await self._commit(live, events)
                self.schedule(live)
                return

            if g.phase == "hand_end":
                await asyncio.sleep(max(0.5, g.turn_deadline - now))
                async with live.lock:
                    g = live.game
                    if g.version != version or g.phase != "hand_end":
                        return
                    await self._advance_hand_end(live)
                if live.game.phase != "finished":
                    self.schedule(live)
                return

            if g.phase == "surcontre":
                team = g.current_bid["seat"] % 2
                seats = [team, team + 2]
                holder = g.current_bid["seat"]
                holder_gone = g.players[holder]["is_bot"] or g.players[holder].get("left")
                if holder_gone:
                    # bot (or absent) contract holder decides quickly
                    bot_seat = holder
                    await asyncio.sleep(random.uniform(1.5, 2.5))
                else:
                    # human contract holder: full 5s reaction window, then
                    # the contre is ignored automatically
                    await asyncio.sleep(max(0.5, g.turn_deadline - now))
                    bot_seat = seats[0]
                async with live.lock:
                    g = live.game
                    if g.version != version or g.phase != "surcontre":
                        return
                    if g.players[bot_seat]["is_bot"] and bot_ai.should_surcontre(
                            g.hands[bot_seat], g.current_bid["suit"]):
                        events = g.apply_surcontre(bot_seat)
                    else:
                        events = g.apply_decline_surcontre(bot_seat)
                    await self._commit(live, events)
                self.schedule(live)
                return

            if g.phase not in ("bidding", "playing"):
                return

            actor = g.turn
            player = g.players[actor]
            pause = max(0, g.pause_until - now)
            # last trick: nobody has a choice (1 card each) — throw
            # automatically, one card per second, in play order (humans too)
            last_trick_auto = g.phase == "playing" and len(g.hands[actor]) == 1
            if last_trick_auto:
                delay = pause + 1.0
            elif player["is_bot"] or player.get("left") or player.get("afk"):
                # bots and relayed seats play quickly (~1 s, readable pace)
                delay = pause + (random.uniform(1.0, 2.0) if player["is_bot"]
                                 else random.uniform(0.8, 1.3))
            else:
                if not g.turn_timeout:
                    return  # untimed game: no auto-play for connected humans
                delay = max(0.5, g.turn_deadline - now)
            await asyncio.sleep(delay)
            async with live.lock:
                g = live.game
                if g.version != version or g.phase not in ("bidding", "playing"):
                    return
                forced = not (player["is_bot"] or player.get("left")
                              or player.get("afk"))
                events = self._auto_move(g, actor, forced_human=forced)
                if forced:
                    # the human let their turn expire
                    p = g.players[actor]
                    p["missed"] = p.get("missed", 0) + 1
                    self._reliability(p["user_id"], "missed_turn")
                    if p["missed"] >= AFK_MISSED_TURNS and not p.get("afk"):
                        p["afk"] = True  # bot relays from now on
                        events.append({"e": "afk_bot", "seat": actor})
                        self._reliability(p["user_id"], "bot_takeover")
                await self._commit(live, events)
            self.schedule(live)
        except asyncio.CancelledError:
            pass
        except StaleGameError:
            # another process played this move first: realign on its state
            self.schedule(live)
        except Exception:
            logger.exception("auto driver error for game %s", live.game.game_id)

    def _reliability(self, user_id, kind):
        """Fire-and-forget counter for the admin dashboard (absences)."""
        from datetime import datetime, timezone
        fut = asyncio.ensure_future(self.db.reliability_events.insert_one(
            {"ts": datetime.now(timezone.utc), "user_id": user_id,
             "kind": kind}))
        fut.add_done_callback(lambda f: f.exception())  # never raise

    def _auto_move(self, g, seat, forced_human=False):
        if g.phase == "bidding":
            if forced_human:
                return g.apply_pass(seat)
            act = bot_ai.bot_bidding_action(g.hands[seat], g.current_bid, seat,
                                            g.bids)
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
            card = bot_ai.bot_play(g.hands[seat], g.trick, g.trump, seat,
                                   getattr(g, "play_history", None),
                                   g.current_bid["seat"] % 2
                                   if g.current_bid else None)
        return g.apply_play(seat, card)

    async def _delayed_remove(self, game_id, delay):
        await asyncio.sleep(delay)
        live = self.games.pop(game_id, None)
        if live:
            for t in (live.pending_task, live.poll_task):
                if t and not t.done():
                    t.cancel()
        try:
            await self.db.live_games.delete_one({"_id": game_id})
        except Exception:
            pass
