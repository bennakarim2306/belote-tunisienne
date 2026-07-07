"""Shared helpers for live games: bots, ELO math, room codes."""
import random
import uuid

BOT_NAMES = ["Ammar", "Salah", "Hédi", "Mabrouk", "Fatma", "Zohra",
             "Baya", "Moncef", "Habib", "Naïma", "Mongi", "Aziza"]
AVATAR_IDS = [f"av{i}" for i in range(1, 13)]
ELO_K = 32


def elo_window(waited_seconds):
    """Accepted ELO gap: ±100 at start, widening by 50 every 5s of waiting."""
    return 100 + int(waited_seconds // 5) * 50


def elo_delta(winner_avg, loser_avg):
    expected = 1 / (1 + 10 ** ((loser_avg - winner_avg) / 400))
    return max(1, round(ELO_K * (1 - expected)))


def make_bots(n, taken_names):
    pool = [b for b in BOT_NAMES if b not in taken_names] or BOT_NAMES
    names = random.sample(pool, min(n, len(pool)))
    while len(names) < n:
        names.append(random.choice(BOT_NAMES))
    return [{"user_id": f"bot_{uuid.uuid4().hex[:8]}", "username": name,
             "avatar_id": random.choice(AVATAR_IDS), "is_bot": True, "elo": 1000}
            for name in names]


def room_code():
    return "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6))
