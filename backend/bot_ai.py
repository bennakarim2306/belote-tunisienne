"""Heuristic AI for Belote Tunisienne bots."""
from game_logic import (SUITS, TRUMP_POINTS, PLAIN_POINTS, legal_moves, trick_winner,
                        suit_of, rank_of, card_points, trump_str)


def evaluate_trump(hand, suit):
    trumps = [c for c in hand if suit_of(c) == suit]
    score = sum(TRUMP_POINTS[rank_of(c)] for c in trumps) + 5 * len(trumps)
    for c in hand:
        if suit_of(c) != suit:
            if rank_of(c) == "A":
                score += 11
            elif rank_of(c) == "10":
                score += 4
    return score


def best_bid(hand):
    best_suit, best_score = None, -1
    for s in SUITS:
        sc = evaluate_trump(hand, s)
        if sc > best_score:
            best_suit, best_score = s, sc
    max_bid = min(((60 + best_score) // 10) * 10, 160)
    return best_suit, max_bid


def should_contre(hand, trump, bid_value):
    if bid_value is None or bid_value < 100:
        return False
    has_j = ("J" + trump) in hand
    has_9 = ("9" + trump) in hand
    has_a = ("A" + trump) in hand
    n_trumps = len([c for c in hand if suit_of(c) == trump])
    return (has_j and n_trumps >= 2) or (has_9 and has_a)


def should_surcontre(hand, trump):
    return ("J" + trump) in hand and ("9" + trump) in hand


def bot_bidding_action(hand, current_bid, seat):
    suit, max_bid = best_bid(hand)
    if current_bid is None:
        if max_bid >= 90:
            return {"type": "bid", "value": 90, "suit": suit}
        return {"type": "pass"}
    bid_team = current_bid["seat"] % 2
    if bid_team != seat % 2:
        if should_contre(hand, current_bid["suit"], current_bid["value"]):
            return {"type": "contre"}
        next_val = current_bid["value"] + 10
        if next_val <= max_bid and next_val <= 160:
            return {"type": "bid", "value": next_val, "suit": suit}
        return {"type": "pass"}
    # partner (or self, impossible) holds the bid — raise only if clearly stronger
    if current_bid["seat"] != seat and suit != current_bid["suit"]:
        next_val = current_bid["value"] + 10
        if next_val + 10 <= max_bid and next_val <= 160:
            return {"type": "bid", "value": next_val, "suit": suit}
    return {"type": "pass"}


def bot_play(hand, trick, trump, seat):
    legal = legal_moves(hand, trick, trump, seat)
    if len(legal) == 1:
        return legal[0]

    if not trick:
        for c in legal:
            if suit_of(c) == trump and rank_of(c) == "J":
                return c
        for c in legal:
            if suit_of(c) != trump and rank_of(c) == "A":
                return c
        return min(legal, key=lambda c: card_points(c, trump))

    partner = (seat + 2) % 4
    current_winner = trick_winner(trick, trump)

    if current_winner == partner:
        # Prefer discarding a plain card (Tfaskira lets us keep our trumps)
        non_tr = [c for c in legal if suit_of(c) != trump]
        if len(trick) == 3:
            pool = non_tr or legal
            return max(pool, key=lambda c: card_points(c, trump))
        pool = non_tr or legal
        return min(pool, key=lambda c: card_points(c, trump))

    winning = [c for c in legal
               if trick_winner(trick + [{"seat": seat, "card": c}], trump) == seat]
    if winning:
        if len(trick) == 3:
            return min(winning, key=lambda c: card_points(c, trump))
        non_tr_win = [c for c in winning if suit_of(c) != trump]
        if non_tr_win:
            return max(non_tr_win, key=lambda c: card_points(c, trump))
        return min(winning, key=trump_str)
    return min(legal, key=lambda c: card_points(c, trump))
