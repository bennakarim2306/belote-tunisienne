"""Fausse-carte / Tfaskira rule — unit tests on legal_moves.

Rule: a player void in the (non-trump) led suit must normally cut with a
trump. EXCEPTION (Tfaskira): if, at the moment they must play, their
partner is currently winning the trick, they may play any card.
Applies in 3rd position (partner led and still wins) and 4th position
(partner wins before they play). Never in 2nd position. Does not change
the obligation to climb at trump when trump is led.
"""
from game_logic import legal_moves

TRUMP = "S"  # spades are trump in all scenarios below


def t(*plays):
    """Build a trick: t((seat, card), ...)."""
    return [{"seat": s, "card": c} for s, c in plays]


# ---------- 3rd position ----------

def test_third_position_partner_winning_allows_any_card():
    # P0 (partner of P2) leads AC and wins; P1 followed lower; P2 void in clubs.
    hand = ["7S", "JS", "8H", "10D"]
    trick = t((0, "AC"), (1, "9C"))
    legal = legal_moves(hand, trick, TRUMP, seat=2)
    assert sorted(legal) == sorted(hand)  # Tfaskira: no obligation to cut


def test_third_position_opponent_trumped_must_overtrump():
    # P1 (opponent) cut with 8S and is winning -> P2 must overtrump.
    hand = ["7S", "JS", "8H", "10D"]
    trick = t((0, "AC"), (1, "8S"))
    legal = legal_moves(hand, trick, TRUMP, seat=2)
    assert sorted(legal) == sorted(["JS"])  # only the higher trump


def test_third_position_partner_led_but_opponent_wins_plain():
    # P0 (partner) led 9C but P1 played AC and is winning -> must cut.
    hand = ["7S", "8H", "10D"]
    trick = t((0, "9C"), (1, "AC"))
    legal = legal_moves(hand, trick, TRUMP, seat=2)
    assert legal == ["7S"]


# ---------- 4th position ----------

def test_fourth_position_partner_winning_allows_any_card():
    # P1 (partner of P3) played the winning club -> P3 void may play anything.
    hand = ["7S", "QH", "7D"]
    trick = t((0, "10C"), (1, "AC"), (2, "7C"))
    legal = legal_moves(hand, trick, TRUMP, seat=3)
    assert sorted(legal) == sorted(hand)


def test_fourth_position_partner_trumped_and_wins_allows_any_card():
    # Partner (P1) cut with a trump and is master -> Tfaskira also applies.
    hand = ["JS", "QH", "7D"]
    trick = t((0, "AC"), (1, "8S"), (2, "7C"))
    legal = legal_moves(hand, trick, TRUMP, seat=3)
    assert sorted(legal) == sorted(hand)


def test_fourth_position_opponent_winning_must_cut():
    # P2 (opponent) is winning with AC -> P3 void must cut.
    hand = ["7S", "QH", "7D"]
    trick = t((0, "10C"), (1, "9C"), (2, "AC"))
    legal = legal_moves(hand, trick, TRUMP, seat=3)
    assert legal == ["7S"]


def test_fourth_position_opponent_overtrumped_partner():
    # Partner (P1) cut with 8S but P2 overtrumped with 9S -> opponent is
    # master, P3 must overtrump if possible.
    hand = ["JS", "7S", "QH"]
    trick = t((0, "AC"), (1, "8S"), (2, "9S"))
    legal = legal_moves(hand, trick, TRUMP, seat=3)
    assert legal == ["JS"]


# ---------- 2nd position: never Tfaskira ----------

def test_second_position_void_must_cut():
    # Only the opponent leader has played -> partner cannot be winning.
    hand = ["7S", "QH", "7D"]
    trick = t((1, "AC"),)
    legal = legal_moves(hand, trick, TRUMP, seat=2)
    assert legal == ["7S"]


# ---------- unchanged rules ----------

def test_must_follow_suit_even_if_partner_winning():
    # Tfaskira only applies when VOID in the led suit.
    hand = ["8C", "7S", "QH"]
    trick = t((0, "AC"), (1, "9C"))
    legal = legal_moves(hand, trick, TRUMP, seat=2)
    assert legal == ["8C"]


def test_trump_led_must_climb_even_if_partner_winning():
    # When trump is led, the obligation to overtrump remains.
    hand = ["JS", "7S", "QH"]
    trick = t((0, "AS"), (1, "8S"))
    legal = legal_moves(hand, trick, TRUMP, seat=2)
    assert legal == ["JS"]


def test_void_no_trumps_plays_anything():
    hand = ["QH", "7D", "8H"]
    trick = t((0, "9C"), (1, "AC"))
    legal = legal_moves(hand, trick, TRUMP, seat=2)
    assert sorted(legal) == sorted(hand)


def test_partner_winning_but_cannot_overtrump_still_free():
    # Partner wins; player only has a small trump — Tfaskira means the
    # small trump is NOT forced.
    hand = ["7S", "8H"]
    trick = t((0, "AC"), (1, "9C"))
    legal = legal_moves(hand, trick, TRUMP, seat=2)
    assert sorted(legal) == sorted(hand)
