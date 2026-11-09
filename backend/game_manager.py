"""GameManager facade: composes the live-game runtime, ELO/stats persistence,
matchmaking queues and private rooms. See game_runtime.py, elo_stats.py,
matchmaking.py and rooms.py for the implementations.

All shared live state (games, rooms, queues, invites) is persisted in MongoDB
so any server process can serve any request; self.games is only a per-process
cache of sockets + state."""
import random
import uuid

import game_logic as gl
from elo_stats import EloStatsMixin
from game_runtime import GameRuntimeMixin, LiveGame
from live_utils import make_bots
from matchmaking import MatchmakingMixin
from rooms import RoomsMixin


class GameManager(GameRuntimeMixin, EloStatsMixin, MatchmakingMixin, RoomsMixin):
    def __init__(self, db):
        self.db = db
        self.games = {}  # game_id -> LiveGame (local cache; truth = live_games)

    async def create_game(self, humans, match_type, shuffle=True, ranked=True,
                          turn_timeout=20, host_user_id=None, origin="online",
                          elo_mode="solo", coach=False):
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
        game.elo_mode = elo_mode
        if coach:
            game.coach = True
        live = LiveGame(game)
        self.games[game_id] = live
        await self._insert_game_doc(live)
        self.schedule(live)
        self._ensure_poller(live)
        return game_id
