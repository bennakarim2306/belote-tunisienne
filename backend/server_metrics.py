"""Lightweight app <-> server event metrics for the admin dashboard.

Every API request and WebSocket message is counted in memory, then flushed to
MongoDB every FLUSH_SECONDS as one document per (minute, event type):
    {bucket: "2026-06-18T14:32", ts: datetime, type: "présence",
     n: 42, users: [user_id, ...]}
A TTL index keeps 7 days of data. The admin stats page aggregates these into
"events per player per minute per type".
"""
import asyncio
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

FLUSH_SECONDS = 15
RETENTION_SECONDS = 7 * 86400

_pending = {}      # (bucket, type) -> [count, set(user_ids)]
_token_users = {}  # session token -> user_id (filled by user_from_token)
_manager = None    # GameManager, for live WS connection counts


def set_manager(manager):
    global _manager
    _manager = manager


def active_ws_connections():
    if _manager is None:
        return 0
    return sum(len(conns) for live in _manager.games.values()
               for conns in live.sockets.values())


def note_token(token, user_id):
    if len(_token_users) > 5000:  # safety cap
        _token_users.clear()
    _token_users[token] = user_id


def user_for_token(token):
    return _token_users.get(token)


# ---- per-account rate limit (fixed window) ----
RATE_LIMIT = 80     # max requests per account per window
RATE_WINDOW = 10.0  # seconds

_rate = {}  # user_id -> [window_start, count]


def rate_limited(user_id):
    now = time.time()
    st = _rate.get(user_id)
    if st is None or now - st[0] >= RATE_WINDOW:
        if len(_rate) > 10000:  # safety cap
            _rate.clear()
        _rate[user_id] = [now, 1]
        return False
    st[1] += 1
    return st[1] > RATE_LIMIT


def record(ev_type, user_id=None):
    """Count one event (sync, in-memory — called from the event loop)."""
    bucket = time.strftime("%Y-%m-%dT%H:%M", time.gmtime())
    ent = _pending.get((bucket, ev_type))
    if ent is None:
        ent = _pending[(bucket, ev_type)] = [0, set()]
    ent[0] += 1
    # anonymous events are tracked as the "_anon" pseudo player so the
    # per-player-per-minute rate stays honest (excluded from player counts)
    ent[1].add(user_id or "_anon")


# the only WS actions the game runtime understands — anything else from a
# client is lumped into "ws: autre" so bad clients cannot flood the collection
KNOWN_WS_ACTIONS = {"ping", "bid", "pass", "capot", "contre", "surcontre",
                    "decline_surcontre", "play", "ready", "pause_request",
                    "pause_accept", "pause_decline", "resume", "chat", "leave"}


def record_ws(action, user_id):
    record(f"ws: {action}" if action in KNOWN_WS_ACTIONS else "ws: autre",
           user_id)


# HTTP path -> event type shown on the dashboard (first prefix match wins)
_PREFIXES = [
    ("/api/sync", "sync (regroupé)"),
    ("/api/presence", "présence (pulse/ping)"),
    ("/api/matchmaking", "matchmaking"),
    ("/api/friends", "amis"),
    ("/api/notifications", "amis"),
    ("/api/users/search", "amis"),
    ("/api/rooms", "salons privés"),
    ("/api/invites", "salons privés"),
    ("/api/auth", "compte"),
    ("/api/users/me", "compte"),
    ("/api/leaderboard", "classement"),
    ("/api/telemetry", "télémétrie"),
    ("/api/solo", "création de partie"),
    ("/api/tutorial", "création de partie"),
    ("/api/games", "reprise de partie"),
    ("/api/register-push", "push"),
    ("/api/feedback", "feedback"),
]


def classify_path(path):
    """Event type for an HTTP path — None means 'do not count' (admin, WS)."""
    if not path.startswith("/api") or path.startswith("/api/admin") \
            or path.startswith("/api/ws"):
        return None
    for prefix, ev_type in _PREFIXES:
        if path.startswith(prefix):
            return ev_type
    return "autre"


async def flush(db):
    global _pending
    if not _pending:
        return
    batch, _pending = _pending, {}
    from pymongo import UpdateOne
    ops = []
    for (bucket, ev_type), (n, users) in batch.items():
        ts = datetime.strptime(bucket, "%Y-%m-%dT%H:%M").replace(
            tzinfo=timezone.utc)
        update = {"$inc": {"n": n}, "$setOnInsert": {"ts": ts}}
        if users:
            update["$addToSet"] = {"users": {"$each": list(users)}}
        ops.append(UpdateOne({"bucket": bucket, "type": ev_type},
                             update, upsert=True))
    try:
        await db.server_metrics.bulk_write(ops, ordered=False)
    except Exception:
        # merge the batch back so a transient DB error loses nothing
        for key, (n, users) in batch.items():
            ent = _pending.get(key)
            if ent is None:
                _pending[key] = [n, users]
            else:
                ent[0] += n
                ent[1] |= users
        raise


async def metrics_loop(db):
    try:
        await db.server_metrics.create_index(
            "ts", expireAfterSeconds=RETENTION_SECONDS)
        await db.server_metrics.create_index(
            [("bucket", 1), ("type", 1)], unique=True)
    except Exception:
        logger.exception("server_metrics index creation failed")
    while True:
        await asyncio.sleep(FLUSH_SECONDS)
        try:
            await flush(db)
        except Exception:
            logger.exception("server_metrics flush failed")
