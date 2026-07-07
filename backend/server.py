"""Belote Tunisienne — FastAPI backend."""
import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import (APIRouter, FastAPI, HTTPException, Request, WebSocket,
                     WebSocketDisconnect)
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

from game_manager import GameManager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
SESSION_API = os.environ['EMERGENT_SESSION_API']

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api = APIRouter(prefix="/api")
manager = GameManager(db)

AVATAR_IDS = [f"av{i}" for i in range(1, 13)]
USER_PUBLIC = {"_id": 0, "password_hash": 0}


# ---------------- models ----------------

class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str = Field(min_length=3, max_length=20)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionBody(BaseModel):
    session_id: str


class UpdateProfileBody(BaseModel):
    avatar_id: Optional[str] = None
    username: Optional[str] = Field(default=None, min_length=3, max_length=20)


class MatchTypeBody(BaseModel):
    match_type: str = Field(pattern="^(short|long)$")
    turn_timer: bool = False


class FriendRequestBody(BaseModel):
    user_id: str


class DuoInviteBody(BaseModel):
    to_user_id: str
    match_type: str = "short"
    mode: str = "online"  # online (duo vs duo) | vs_ai


class FriendRespondBody(BaseModel):
    friendship_id: str
    accept: bool


class InviteBody(BaseModel):
    user_id: str
    seat: Optional[int] = Field(default=None, ge=0, le=3)


class SeatBody(BaseModel):
    seat: int = Field(ge=0, le=3)


# ---------------- auth helpers ----------------

def new_user_doc(email, username, name=None, provider="email", password_hash=None, picture=None):
    now = datetime.now(timezone.utc).isoformat()
    return {
        "user_id": f"u_{uuid.uuid4().hex[:12]}",
        "email": email.lower(),
        "username": username,
        "name": name or username,
        "picture": picture,
        "avatar_id": "av1",
        "auth_provider": provider,
        "password_hash": password_hash,
        "elo": 1000,
        "elo_duo": 1000,
        "games_played": 0,
        "wins": 0,
        "losses": 0,
        "stats": {"contracts_taken": 0, "contracts_made": 0, "belotes": 0,
                  "capots": 0, "points_scored": 0, "best_streak": 0, "current_streak": 0},
        "elo_history": [{"elo": 1000, "ts": now}],
        "elo_duo_history": [{"elo": 1000, "ts": now}],
        "created_at": now,
    }


async def create_session(user_id: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    token = jwt.encode({"sub": user_id, "exp": expires, "jti": uuid.uuid4().hex},
                       JWT_SECRET, algorithm="HS256")
    await db.user_sessions.insert_one({
        "session_token": token, "user_id": user_id,
        "expires_at": expires, "created_at": datetime.now(timezone.utc)})
    return token


async def store_google_session(user_id: str, session_token: str):
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {"user_id": user_id, "expires_at": expires,
                  "created_at": datetime.now(timezone.utc)}},
        upsert=True)


async def user_from_token(token: str):
    if not token:
        return None
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    exp = sess["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, USER_PUBLIC)


async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="not_authenticated")
    user = await user_from_token(auth[7:])
    if not user:
        raise HTTPException(status_code=401, detail="invalid_session")
    return user


def to_player(user):
    return {"user_id": user["user_id"], "username": user["username"],
            "avatar_id": user.get("avatar_id", "av1"), "is_bot": False,
            "elo": user.get("elo", 1000),
            "elo_duo": user.get("elo_duo", 1000)}


async def unique_username(base: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_]", "", base)[:14] or "joueur"
    candidate = base
    while await db.users.find_one({"username": candidate}, {"_id": 1}):
        candidate = f"{base}{uuid.uuid4().hex[:3]}"
    return candidate


# ---------------- auth routes ----------------

@api.post("/auth/register")
async def register(body: RegisterBody):
    if await db.users.find_one({"email": body.email.lower()}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="email_taken")
    if await db.users.find_one({"username": body.username}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="username_taken")
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = new_user_doc(body.email, body.username, provider="email", password_hash=pw_hash)
    await db.users.insert_one(dict(user))
    token = await create_session(user["user_id"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.post("/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    if not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    token = await create_session(user["user_id"])
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionBody):
    async with httpx.AsyncClient(timeout=15) as hc:
        resp = await hc.get(SESSION_API, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="invalid_session_id")
    data = resp.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, USER_PUBLIC)
    if not user:
        username = await unique_username(data.get("name", email.split("@")[0]))
        user = new_user_doc(email, username, name=data.get("name"),
                            provider="google", picture=data.get("picture"))
        await db.users.insert_one(dict(user))
        user.pop("password_hash", None)
        user.pop("_id", None)
    session_token = data["session_token"]
    await store_google_session(user["user_id"], session_token)
    return {"token": session_token, "user": user}


@api.get("/auth/me")
async def me(request: Request):
    user = await get_current_user(request)
    return user


@api.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        await db.user_sessions.delete_one({"session_token": auth[7:]})
    return {"ok": True}


# ---------------- profile / stats ----------------

@api.put("/users/me")
async def update_me(body: UpdateProfileBody, request: Request):
    user = await get_current_user(request)
    updates = {}
    if body.avatar_id:
        if body.avatar_id not in AVATAR_IDS:
            raise HTTPException(status_code=400, detail="invalid_avatar")
        updates["avatar_id"] = body.avatar_id
    if body.username and body.username != user["username"]:
        if await db.users.find_one({"username": body.username}, {"_id": 1}):
            raise HTTPException(status_code=400, detail="username_taken")
        updates["username"] = body.username
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    return await db.users.find_one({"user_id": user["user_id"]}, USER_PUBLIC)


@api.get("/users/me/stats")
async def my_stats(request: Request):
    user = await get_current_user(request)
    games = user.get("games_played", 0)
    wins = user.get("wins", 0)
    rank = await db.users.count_documents({"elo": {"$gt": user.get("elo", 1000)}}) + 1
    recent = await db.matches.find(
        {"players.user_id": user["user_id"]}, {"_id": 0}
    ).sort("finished_at", -1).to_list(10)
    return {
        "user": user,
        "rank": rank,
        "win_rate": round(100 * wins / games) if games else 0,
        "recent_matches": recent,
    }


@api.get("/leaderboard")
async def leaderboard(request: Request, mode: str = "solo"):
    user = await get_current_user(request)
    field = "elo_duo" if mode == "duo" else "elo"
    top = await db.users.find({}, USER_PUBLIC).sort(
        [(field, -1), ("wins", -1)]).to_list(50)
    my_rank = await db.users.count_documents(
        {field: {"$gt": user.get(field, 1000)}}) + 1
    return {"players": top, "my_rank": my_rank, "me": user}


@api.get("/users/search")
async def search_users(q: str, request: Request):
    user = await get_current_user(request)
    if len(q.strip()) < 2:
        return {"results": []}
    pattern = re.escape(q.strip())
    results = await db.users.find(
        {"username": {"$regex": pattern, "$options": "i"},
         "user_id": {"$ne": user["user_id"]}},
        {"_id": 0, "user_id": 1, "username": 1, "avatar_id": 1, "elo": 1}
    ).to_list(10)
    for r in results:
        fr = await db.friendships.find_one({
            "$or": [{"requester_id": user["user_id"], "recipient_id": r["user_id"]},
                    {"requester_id": r["user_id"], "recipient_id": user["user_id"]}]
        }, {"_id": 0})
        if not fr:
            r["friend_status"] = "none"
        elif fr["status"] == "accepted":
            r["friend_status"] = "friends"
        elif fr["requester_id"] == user["user_id"]:
            r["friend_status"] = "pending_sent"
        else:
            r["friend_status"] = "pending_received"
    return {"results": results}


# ---------------- friends ----------------

async def user_brief(user_id):
    b = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "user_id": 1, "username": 1, "avatar_id": 1, "elo": 1,
         "elo_duo": 1})
    if b:
        b["elo_duo"] = b.get("elo_duo") or 1000
    return b


@api.get("/friends")
async def list_friends(request: Request):
    user = await get_current_user(request)
    uid = user["user_id"]
    rows = await db.friendships.find(
        {"$or": [{"requester_id": uid}, {"recipient_id": uid}]}, {"_id": 0}).to_list(200)
    friends, received, sent = [], [], []
    for fr in rows:
        other_id = fr["recipient_id"] if fr["requester_id"] == uid else fr["requester_id"]
        other = await user_brief(other_id)
        if not other:
            continue
        entry = {"friendship_id": fr["friendship_id"], **other}
        if fr["status"] == "accepted":
            friends.append(entry)
        elif fr["requester_id"] == uid:
            sent.append(entry)
        else:
            received.append(entry)
    return {"friends": friends, "pending_received": received, "pending_sent": sent}


@api.post("/friends/request")
async def friend_request(body: FriendRequestBody, request: Request):
    user = await get_current_user(request)
    if body.user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="cannot_add_self")
    target = await db.users.find_one({"user_id": body.user_id}, {"_id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")
    existing = await db.friendships.find_one({
        "$or": [{"requester_id": user["user_id"], "recipient_id": body.user_id},
                {"requester_id": body.user_id, "recipient_id": user["user_id"]}]})
    if existing:
        raise HTTPException(status_code=400, detail="already_exists")
    await db.friendships.insert_one({
        "friendship_id": f"f_{uuid.uuid4().hex[:12]}",
        "requester_id": user["user_id"], "recipient_id": body.user_id,
        "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}


@api.post("/friends/respond")
async def friend_respond(body: FriendRespondBody, request: Request):
    user = await get_current_user(request)
    fr = await db.friendships.find_one(
        {"friendship_id": body.friendship_id, "recipient_id": user["user_id"]}, {"_id": 0})
    if not fr:
        raise HTTPException(status_code=404, detail="request_not_found")
    if body.accept:
        await db.friendships.update_one({"friendship_id": body.friendship_id},
                                        {"$set": {"status": "accepted"}})
    else:
        await db.friendships.delete_one({"friendship_id": body.friendship_id})
    return {"ok": True}


@api.get("/notifications")
async def notifications(request: Request):
    """Aggregated pending notifications: friend requests + game invites."""
    user = await get_current_user(request)
    uid = user["user_id"]
    fr_rows = await db.friendships.find(
        {"recipient_id": uid, "status": "pending"}, {"_id": 0}).to_list(20)
    friend_requests = []
    for fr in fr_rows:
        other = await user_brief(fr["requester_id"])
        if other:
            friend_requests.append({"friendship_id": fr["friendship_id"], **other})
    inv_rows = await db.invites.find(
        {"to_user_id": uid, "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    invites = []
    for inv in inv_rows:
        room = manager.get_room(inv["room_code"])
        if room and not room["started"]:
            invites.append(inv)
    duo_invites = [{"invite_id": v["invite_id"],
                    "from_user": {"user_id": v["from_player"]["user_id"],
                                  "username": v["from_player"]["username"],
                                  "avatar_id": v["from_player"]["avatar_id"]},
                    "match_type": v["match_type"], "mode": v["mode"]}
                   for v in manager.pending_duo_invites_for(uid)]
    return {"friend_requests": friend_requests, "invites": invites,
            "duo_invites": duo_invites}


# ---------------- matchmaking ----------------

@api.post("/matchmaking/join")
async def mm_join(body: MatchTypeBody, request: Request):
    user = await get_current_user(request)
    manager.join_queue(to_player(user), body.match_type)
    return {"ok": True}


@api.get("/matchmaking/status")
async def mm_status(request: Request):
    user = await get_current_user(request)
    return manager.queue_status(user["user_id"])


@api.delete("/matchmaking/leave")
async def mm_leave(request: Request):
    user = await get_current_user(request)
    manager.leave_queue(user["user_id"])
    manager.cancel_duo_invite(user["user_id"])
    manager.matched.pop(user["user_id"], None)
    return {"ok": True}


# ---------------- duo matchmaking ----------------

async def _recent_coplayer_ids(uid: str, limit_matches: int = 3):
    """Human players seen in my last N finished matches."""
    rows = await db.matches.find(
        {"players.user_id": uid}, {"_id": 0, "players": 1, "finished_at": 1}
    ).sort("finished_at", -1).to_list(limit_matches)
    ids = []
    for m in rows:
        for p in m["players"]:
            if not p.get("is_bot") and p["user_id"] != uid and p["user_id"] not in ids:
                ids.append(p["user_id"])
    return ids


async def _friend_ids(uid: str):
    rows = await db.friendships.find(
        {"status": "accepted",
         "$or": [{"requester_id": uid}, {"recipient_id": uid}]},
        {"_id": 0}).to_list(200)
    return [r["recipient_id"] if r["requester_id"] == uid else r["requester_id"]
            for r in rows]


@api.get("/matchmaking/duo/candidates")
async def duo_candidates(request: Request):
    """Who can I invite as duo partner: friends + last-3-games co-players."""
    user = await get_current_user(request)
    uid = user["user_id"]
    fids = await _friend_ids(uid)
    friends = []
    for fid in fids:
        b = await user_brief(fid)
        if b:
            friends.append({**b, "friend_status": "friends"})
    recent = []
    for rid in await _recent_coplayer_ids(uid):
        if rid in fids:
            continue
        b = await user_brief(rid)
        if not b:
            continue
        fr = await db.friendships.find_one({
            "$or": [{"requester_id": uid, "recipient_id": rid},
                    {"requester_id": rid, "recipient_id": uid}]}, {"_id": 0})
        b["friend_status"] = "none" if not fr else (
            "friends" if fr["status"] == "accepted" else "pending")
        recent.append(b)
    return {"friends": friends, "recent": recent}


@api.post("/matchmaking/duo/invite")
async def duo_invite(body: DuoInviteBody, request: Request):
    user = await get_current_user(request)
    uid = user["user_id"]
    if body.mode not in ("online", "vs_ai"):
        raise HTTPException(status_code=400, detail="bad_mode")
    if body.match_type not in ("short", "long"):
        raise HTTPException(status_code=400, detail="bad_match_type")
    if body.to_user_id == uid:
        raise HTTPException(status_code=400, detail="cannot_invite_self")
    target = await user_brief(body.to_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")
    allowed = (body.to_user_id in await _friend_ids(uid)
               or body.to_user_id in await _recent_coplayer_ids(uid))
    if not allowed:
        raise HTTPException(status_code=403, detail="not_allowed")
    invite_id = manager.create_duo_invite(to_player(user), target,
                                          body.match_type, body.mode)
    return {"invite_id": invite_id}


@api.post("/matchmaking/duo/{invite_id}/accept")
async def duo_accept(invite_id: str, request: Request):
    user = await get_current_user(request)
    inv = manager.accept_duo_invite(invite_id, to_player(user))
    if not inv:
        raise HTTPException(status_code=404, detail="invite_gone")
    return {"ok": True, "match_type": inv["match_type"], "mode": inv["mode"],
            "game_id": inv.get("game_id")}


@api.post("/matchmaking/duo/{invite_id}/decline")
async def duo_decline(invite_id: str, request: Request):
    user = await get_current_user(request)
    manager.decline_duo_invite(invite_id, user["user_id"])
    return {"ok": True}


# ---------------- solo vs AI ----------------

@api.post("/solo")
async def create_solo(body: MatchTypeBody, request: Request):
    user = await get_current_user(request)
    game_id = manager.create_game([to_player(user)], body.match_type,
                                  shuffle=False, ranked=False, turn_timeout=None,
                                  host_user_id=user["user_id"], origin="solo")
    return {"game_id": game_id}


@api.post("/tutorial/game")
async def create_tutorial_game(request: Request):
    """Final teaching game of the tutorial: solo vs 3 AIs with the coach on."""
    user = await get_current_user(request)
    game_id = manager.create_game([to_player(user)], "short",
                                  shuffle=False, ranked=False, turn_timeout=None,
                                  host_user_id=user["user_id"], origin="solo")
    manager.games[game_id].game.coach = True
    return {"game_id": game_id}


@api.get("/games/current")
async def current_game(request: Request):
    """Ongoing (non-finished) live game the user is seated in — for rejoining.
    Newest first: a freshly started game takes precedence over older left-over ones."""
    user = await get_current_user(request)
    for game_id, live in reversed(list(manager.games.items())):
        g = live.game
        if g.phase == "finished":
            continue
        me = next((p for p in g.players
                   if p["user_id"] == user["user_id"] and not p["is_bot"]), None)
        if me:
            return {"game_id": game_id, "match_type": g.match_type,
                    "phase": g.phase, "hand_number": g.hand_number,
                    "match_scores": g.match_scores, "target": g.target,
                    "my_team": me["seat"] % 2}
    return {"game_id": None}


# ---------------- private rooms ----------------

def room_public(room):
    return {"code": room["code"], "host_id": room["host_id"],
            "match_type": room["match_type"], "started": room["started"],
            "turn_timer": room.get("turn_timer", False),
            "game_id": room["game_id"],
            "seats": [None if p is None else
                      {"user_id": p["user_id"], "username": p["username"],
                       "avatar_id": p["avatar_id"], "elo": p["elo"]}
                      for p in room["seats"]]}


@api.post("/rooms")
async def create_room(body: MatchTypeBody, request: Request):
    user = await get_current_user(request)
    room = manager.create_room(to_player(user), body.match_type, body.turn_timer)
    return room_public(room)


@api.get("/rooms/{code}")
async def get_room(code: str, request: Request):
    await get_current_user(request)
    room = manager.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="room_not_found")
    return room_public(room)


@api.post("/rooms/{code}/join")
async def join_room(code: str, request: Request):
    user = await get_current_user(request)
    try:
        room = manager.join_room(code, to_player(user))
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    return room_public(room)


@api.post("/rooms/{code}/leave")
async def leave_room(code: str, request: Request):
    user = await get_current_user(request)
    manager.leave_room(code, user["user_id"])
    return {"ok": True}


@api.post("/rooms/{code}/seat")
async def change_seat(code: str, body: SeatBody, request: Request):
    user = await get_current_user(request)
    try:
        room = manager.move_seat(code, user["user_id"], body.seat)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    return room_public(room)


@api.post("/rooms/{code}/start")
async def start_room(code: str, request: Request):
    user = await get_current_user(request)
    try:
        game_id = manager.start_room(code, user["user_id"])
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    return {"game_id": game_id}


@api.post("/rooms/{code}/invite")
async def invite_to_room(code: str, body: InviteBody, request: Request):
    user = await get_current_user(request)
    room = manager.get_room(code)
    if not room or room["started"]:
        raise HTTPException(status_code=404, detail="room_not_found")
    if not any(p and p["user_id"] == user["user_id"] for p in room["seats"]):
        raise HTTPException(status_code=403, detail="not_in_room")
    if body.seat is not None and room["host_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="not_host")
    await db.invites.update_one(
        {"room_code": room["code"], "to_user_id": body.user_id},
        {"$set": {"invite_id": f"i_{uuid.uuid4().hex[:12]}",
                  "room_code": room["code"], "to_user_id": body.user_id,
                  "match_type": room["match_type"],
                  "from_user": {"user_id": user["user_id"], "username": user["username"],
                                "avatar_id": user.get("avatar_id", "av1")},
                  "status": "pending",
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True)
    manager.reserve_seat(room["code"], body.user_id, body.seat)
    return {"ok": True}


@api.get("/invites/pending")
async def pending_invites(request: Request):
    user = await get_current_user(request)
    rows = await db.invites.find(
        {"to_user_id": user["user_id"], "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    valid = []
    for inv in rows:
        room = manager.get_room(inv["room_code"])
        if room and not room["started"]:
            valid.append(inv)
        else:
            await db.invites.update_one({"invite_id": inv["invite_id"]},
                                        {"$set": {"status": "expired"}})
    return {"invites": valid}


@api.post("/invites/{invite_id}/dismiss")
async def dismiss_invite(invite_id: str, request: Request):
    user = await get_current_user(request)
    await db.invites.update_one(
        {"invite_id": invite_id, "to_user_id": user["user_id"]},
        {"$set": {"status": "dismissed"}})
    return {"ok": True}


# ---------------- websocket ----------------

@app.websocket("/api/ws/game/{game_id}")
async def ws_game(websocket: WebSocket, game_id: str):
    token = websocket.query_params.get("token", "")
    user = await user_from_token(token)
    if not user:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    live = await manager.connect(game_id, user["user_id"], websocket)
    if not live:
        await websocket.send_json({"type": "error", "message": "game_not_found"})
        await websocket.close(code=4004)
        return
    try:
        while True:
            msg = await websocket.receive_json()
            if msg.get("action") == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            await manager.handle_action(game_id, user["user_id"], msg, websocket)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("ws error")
    finally:
        manager.disconnect(game_id, user["user_id"], websocket)


@api.get("/")
async def root():
    return {"message": "Belote Tunisienne API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index([("elo", -1)])
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.friendships.create_index([("requester_id", 1), ("recipient_id", 1)])
    await db.invites.create_index([("to_user_id", 1), ("status", 1)])
    # backfill duo ELO for accounts created before the solo/duo split
    await db.users.update_many(
        {"$or": [{"elo_duo": {"$exists": False}}, {"elo_duo": None}]},
        {"$set": {"elo_duo": 1000, "elo_duo_history": []}})
    await db.users.create_index([("elo_duo", -1)])
    asyncio.create_task(manager.matchmaking_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
