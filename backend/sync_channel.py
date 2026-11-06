"""Phase 2 — per-player realtime notification channel.

Each logged-in client keeps ONE lightweight WebSocket (WS /api/ws/sync).
The server pushes:
  - {"type": "sync", "h": ..., "online": n, "waiting": n, "data": {...}?}
    (same shape as GET /api/sync; "data" only when the payload changed for
    that socket)
  - {"type": "mm_found", "game_id": ...}  -> opponent found, join instantly
  - {"type": "mm_update"}                 -> matchmaking status changed
Endpoints call notify_users()/push_event() after any change that affects a
player; a slow per-connection refresh covers changes made by another process.
While the channel is healthy the client does zero HTTP polling.
"""
import logging

import server_metrics

logger = logging.getLogger(__name__)

REFRESH_SECONDS = 12  # per-connection safety refresh (counters + missed events)

_conns = {}       # user_id -> set[WebSocket]
_snapshot = None  # async fn(uid) -> {"h", "online", "waiting", "data"}


def configure(snapshot_fn):
    global _snapshot
    _snapshot = snapshot_fn


def connection_count():
    return sum(len(s) for s in _conns.values())


def register(user_id, ws):
    _conns.setdefault(user_id, set()).add(ws)


def unregister(user_id, ws):
    s = _conns.get(user_id)
    if s:
        s.discard(ws)
        if not s:
            _conns.pop(user_id, None)


async def _send(ws, payload):
    try:
        await ws.send_json(payload)
        return True
    except Exception:
        return False


async def push_sync(user_id):
    """Recompute the sync payload for a connected user and push it; sockets
    that already hold the same payload only get the tiny counters update."""
    conns = _conns.get(user_id)
    if not conns or _snapshot is None:
        return
    snap = await _snapshot(user_id)
    for ws in list(conns):
        msg = {"type": "sync", "h": snap["h"],
               "online": snap["online"], "waiting": snap["waiting"]}
        if getattr(ws, "_sync_h", None) != snap["h"]:
            msg["data"] = snap["data"]
        if await _send(ws, msg):
            ws._sync_h = snap["h"]
            server_metrics.record("ws-sync: envoi", user_id)


async def notify_users(user_ids):
    """Instant push to every listed user connected to THIS process."""
    for uid in set(user_ids):
        if uid in _conns:
            try:
                await push_sync(uid)
            except Exception:
                logger.exception("sync push failed for %s", uid)


async def push_event(user_ids, event):
    """Push a raw event (mm_found / mm_update) to the listed users."""
    for uid in set(user_ids):
        for ws in list(_conns.get(uid, ())):
            if await _send(ws, event):
                server_metrics.record("ws-sync: envoi", uid)
