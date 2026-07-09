"""Private rooms: create/join/seats, then start a game (bots fill empty seats).

Rooms live in MongoDB (live_rooms) so any server process can serve any request.
Writes use a version field with optimistic retry; stale rooms are swept by the
matchmaking loop."""
import time

from pymongo.errors import DuplicateKeyError

from live_utils import make_bots, room_code


class RoomsMixin:

    async def create_room(self, host_player, match_type, turn_timer=False):
        while True:
            code = room_code()
            room = {"_id": code, "code": code, "host_id": host_player["user_id"],
                    "seats": [host_player, None, None, None],
                    "reservations": {}, "match_type": match_type,
                    "turn_timer": bool(turn_timer),
                    "started": False, "game_id": None,
                    "created": time.time(), "version": 0}
            try:
                await self.db.live_rooms.insert_one(room)
                return room
            except DuplicateKeyError:
                continue  # code collision: draw another one

    async def get_room(self, code):
        return await self.db.live_rooms.find_one({"_id": code.upper()})

    async def _save_room(self, room):
        """Optimistic save; False when someone else changed the room first."""
        prev = room["version"]
        room["version"] = prev + 1
        res = await self.db.live_rooms.replace_one(
            {"_id": room["_id"], "version": prev}, room)
        return res.matched_count > 0

    async def join_room(self, code, player):
        for _ in range(3):
            room = await self.get_room(code)
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
            if await self._save_room(room):
                return room
        raise ValueError("try_again")

    async def move_seat(self, code, user_id, seat):
        for _ in range(3):
            room = await self.get_room(code)
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
            if await self._save_room(room):
                return room
        raise ValueError("try_again")

    async def reserve_seat(self, code, user_id, seat):
        if seat is None:
            return
        await self.db.live_rooms.update_one(
            {"_id": code.upper()},
            {"$set": {f"reservations.{user_id}": seat}, "$inc": {"version": 1}})

    async def leave_room(self, code, user_id):
        for _ in range(3):
            room = await self.get_room(code)
            if not room:
                return
            room["seats"] = [None if (p and p["user_id"] == user_id) else p
                             for p in room["seats"]]
            if (not any(room["seats"])
                    or (room["host_id"] == user_id and not room["started"])):
                await self.db.live_rooms.delete_one({"_id": room["_id"]})
                return
            if await self._save_room(room):
                return

    async def start_room(self, code, user_id):
        for _ in range(3):
            room = await self.get_room(code)
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
            game_id = await self.create_game(
                seats, room["match_type"], shuffle=False,
                turn_timeout=30 if room.get("turn_timer") else None,
                host_user_id=room["host_id"], origin="private")
            room["started"] = True
            room["game_id"] = game_id
            room["started_at"] = time.time()
            if await self._save_room(room):
                return game_id
            # lost the save race (someone joined at the same instant): the game
            # we just created is orphaned — drop it and retry from fresh state
            await self.db.live_games.delete_one({"_id": game_id})
            orphan = self.games.pop(game_id, None)
            if orphan:
                for t in (orphan.pending_task, orphan.poll_task):
                    if t and not t.done():
                        t.cancel()
        raise ValueError("try_again")
