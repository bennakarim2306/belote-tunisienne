"""End of match: ELO updates (solo or duo rating), stats and match history."""
import uuid
from datetime import datetime, timezone

from live_utils import elo_delta


class EloStatsMixin:

    async def _finalize(self, live):
        if live.finalized:
            return
        live.finalized = True
        g = live.game
        # cross-process guard: only one server process may write ELO/history
        claim = await self.db.live_games.find_one_and_update(
            {"_id": g.game_id, "finalized": {"$ne": True}},
            {"$set": {"finalized": True}})
        if claim is None:
            return
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
        # duo games are rated on the separate duo ELO (players seeded with elo_duo)
        duo_rated = getattr(g, "elo_mode", "solo") == "duo"
        elo_field = "elo_duo" if duo_rated else "elo"
        history_field = "elo_duo_history" if duo_rated else "elo_history"
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
            new_elo = max(100, user.get(elo_field, 1000) + change)
            stats = user.get("stats", {})
            streak = (stats.get("current_streak", 0) + 1) if won else 0
            seat_st = g.seat_stats[p["seat"]]
            await self.db.users.update_one({"user_id": p["user_id"]}, {
                "$set": {
                    elo_field: new_elo,
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
                "$push": {history_field: {"$each": [{"elo": new_elo, "ts": now.isoformat()}],
                                          "$slice": -50}},
            })
        await self.db.matches.insert_one({
            "match_id": f"m_{uuid.uuid4().hex[:12]}",
            "game_id": g.game_id,
            "match_type": g.match_type,
            "ranked": True,
            "elo_mode": getattr(g, "elo_mode", "solo"),
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
