"""Emergent managed push notifications (SuprSend relay).

- POST /api/register-push : device token registration (relayed upstream)
- send_push()             : server-side trigger helper
- maybe_send_queue_push() : matchmaking nudge — when players wait in the online
  queue, entice other recently-active users to come and play.
"""
import logging
import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger("push")

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

push_router = APIRouter(prefix="/api")


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str  # "android" | "ios"
    device_token: str


@push_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    resp = await _client.post("/api/v1/push/users/register", json=body.model_dump())
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    return {"status": "registered"}


async def send_push(recipients, data, idempotency_key=None):
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


# ---------------- matchmaking queue nudge ----------------

QUEUE_WAIT_BEFORE_NUDGE = 45        # someone must be genuinely waiting (s)
GLOBAL_NUDGE_COOLDOWN = 30 * 60     # min delay between two nudge campaigns (s)
USER_NUDGE_COOLDOWN = 24 * 3600     # max 1 nudge per user per day (s)
ACTIVE_WINDOW = 14 * 24 * 3600      # only users active in the last 14 days


async def maybe_send_queue_push(db):
    """Called from the matchmaking loop tick (lock already held)."""
    now = time.time()
    entries = await db.mm_queue.find({}, {"ts": 1, "players.user_id": 1}).to_list(200)
    if not entries:
        return
    longest_wait = now - min(e["ts"] for e in entries)
    if longest_wait < QUEUE_WAIT_BEFORE_NUDGE:
        return
    # global cooldown so a stuck queue doesn't spam every tick
    kv = await db.kv.find_one({"_id": "queue_push_nudge"})
    if kv and now - kv.get("last", 0) < GLOBAL_NUDGE_COOLDOWN:
        return
    waiting_ids = {p["user_id"] for e in entries for p in e["players"]}
    n_waiting = len(waiting_ids)
    # users currently in a live game must not be nudged
    in_game = set()
    async for g in db.live_games.find({"phase": {"$ne": "finished"}}, {"user_ids": 1}):
        in_game.update(g.get("user_ids") or [])
    rows = await db.users.find(
        {"last_active": {"$gt": now - ACTIVE_WINDOW},
         "user_id": {"$nin": list(waiting_ids | in_game)},
         "$or": [{"mm_push_at": {"$exists": False}},
                 {"mm_push_at": {"$lt": now - USER_NUDGE_COOLDOWN}}]},
        {"user_id": 1},
    ).to_list(100)
    recipients = [r["user_id"] for r in rows]
    if not recipients:
        return
    await db.kv.update_one({"_id": "queue_push_nudge"},
                           {"$set": {"last": now}}, upsert=True)
    if n_waiting == 1:
        message = "Un joueur attend une partie en ligne — viens compléter la table ! 🎴"
    else:
        message = (f"{n_waiting} joueurs attendent une partie en ligne — "
                   "viens compléter la table ! 🎴")
    try:
        await send_push(
            recipients=recipients,
            data={"title": "Belote Tunisienne", "message": message,
                  "action_url": "/"},
            idempotency_key=f"queue_nudge_{int(now)}",
        )
        await db.users.update_many({"user_id": {"$in": recipients}},
                                   {"$set": {"mm_push_at": now}})
        logger.info("queue nudge push sent to %d users (%d waiting)",
                    len(recipients), n_waiting)
    except Exception as e:
        logger.warning("queue nudge push failed (non-blocking): %s", e)
