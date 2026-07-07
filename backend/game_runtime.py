"""Live game runtime: WebSocket hub, player actions, bot/timer auto-driver."""
import asyncio
import logging
import random
import time

import bot_ai
import game_logic as gl

logger = logging.getLogger(__name__)

DISCONNECT_GRACE = 4          # seconds before a lost socket triggers the auto-pause
DISCONNECT_PAUSE_SECONDS = 120  # network pause: bot substitutes after 2 min
ABANDONED_CLEANUP_SECONDS = 600  # rejoin window when nobody is connected

CHAT_MSG_IDS = {"wellPlayed", "yezzi", "aychek", "luck", "yalla",
                "oops", "sahha", "thinking"}
CHAT_EMOJIS = {"😂", "😭", "😡", "🔥", "👏", "🤝", "😎", "🎉"}
CHAT_COOLDOWN = 1.5  # seconds between messages per player


class LiveGame:
    def __init__(self, game):
        self.game = game
        self.lock = asyncio.Lock()
        self.sockets = {}  # user_id -> set[WebSocket]
        self.pending_task = None
        self.finalized = False
        self.chat_last = {}  # seat -> last chat timestamp (rate limit)


class GameRuntimeMixin:
    """WebSocket connections, action handling and the automatic driver."""

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
