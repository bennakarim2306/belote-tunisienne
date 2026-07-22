"""Rule: a deal giving any player 7+ cards of the same suit is void —
cards are reshuffled and redealt by the SAME dealer."""
import game_logic as gl


def _players():
    return [{"user_id": f"u{i}", "username": f"P{i}", "avatar_id": 0,
             "is_bot": True, "elo": 1000} for i in range(4)]


# ---------- helper ----------

def test_seven_of_a_suit_detection():
    assert gl.seven_of_a_suit(
        ["7H", "8H", "9H", "10H", "JH", "QH", "KH", "7C"])  # 7 hearts
    assert gl.seven_of_a_suit(
        ["7S", "8S", "9S", "10S", "JS", "QS", "KS", "AS"])  # 8 spades
    assert not gl.seven_of_a_suit(
        ["7H", "8H", "9H", "10H", "JH", "QH", "7C", "8C"])  # only 6 hearts


# ---------- redeal behaviour ----------

BAD_ORDER = [r + s for s in gl.SUITS for r in gl.RANKS]      # 8 of a suit each
GOOD_ORDER = [r + s for r in gl.RANKS for s in gl.SUITS]     # 2 per suit each


def test_void_deal_reshuffled_same_dealer(monkeypatch):
    calls = {"n": 0}

    def fake_shuffle(deck):
        calls["n"] += 1
        deck[:] = BAD_ORDER if calls["n"] == 1 else GOOD_ORDER

    monkeypatch.setattr(gl.random, "shuffle", fake_shuffle)
    g = gl.BeloteGame("t", _players(), "short", turn_timeout=None)
    # first (void) deal was rejected and redealt
    assert calls["n"] >= 2
    assert not any(gl.seven_of_a_suit(h) for h in g.hands)
    # still one single hand (no extra hand consumed by the redeal)
    assert g.hand_number == 1
    assert g.phase == "bidding"


def test_valid_deal_not_reshuffled(monkeypatch):
    calls = {"n": 0}

    def fake_shuffle(deck):
        calls["n"] += 1
        deck[:] = GOOD_ORDER

    monkeypatch.setattr(gl.random, "shuffle", fake_shuffle)
    gl.BeloteGame("t", _players(), "short", turn_timeout=None)
    assert calls["n"] == 1


def test_next_hand_keeps_dealer_rotation_intact(monkeypatch):
    # The void-deal reshuffle must never touch the dealer: rotation is
    # decided once per hand, before dealing.
    calls = {"n": 0}

    def fake_shuffle(deck):
        calls["n"] += 1
        deck[:] = BAD_ORDER if calls["n"] % 2 == 1 else GOOD_ORDER

    monkeypatch.setattr(gl.random, "shuffle", fake_shuffle)
    g = gl.BeloteGame("t", _players(), "short", turn_timeout=None)
    dealer_before = g.dealer
    # 4 passes with no bid -> redeal rotates the dealer exactly once,
    # even though the first shuffle of the new hand is void.
    for _ in range(4):
        g.apply_pass(g.turn)
    assert g.dealer == (dealer_before + 1) % 4
    assert not any(gl.seven_of_a_suit(h) for h in g.hands)
