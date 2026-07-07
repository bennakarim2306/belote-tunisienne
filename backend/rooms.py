"""Private rooms: create/join/seats, then start a game (bots fill empty seats)."""
import asyncio
import time

from live_utils import make_bots, room_code


class RoomsMixin:

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
