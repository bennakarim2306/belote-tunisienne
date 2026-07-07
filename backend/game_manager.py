"""GameManager facade: composes the live-game runtime, ELO/stats persistence,
matchmaking queues and private rooms. See game_runtime.py, elo_stats.py,
matchmaking.py and rooms.py for the implementations."""
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
        self.games = {}  # game_id -> LiveGame
        self.queues = {"short": [], "long": []}  # entries {players[], duo, ts}
        self.matched = {}  # user_id -> {game_id, ts}
        self.rooms = {}  # code -> room dict
        self.duo_invites = {}  # invite_id -> {from_player, to_user, match_type, mode, ts, status}
        self.duo_feedback = {}  # user_id -> {"status", "ts"} one-shot info (declined/cancelled)

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
