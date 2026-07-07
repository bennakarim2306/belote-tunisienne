"""Coach engine for the tutorial teaching game.

Reuses the bot heuristics to suggest the next action for the human seat and
derives a pedagogical reason code; the frontend translates reason codes into
FR/EN/Tunisian-Arabic texts and animates the suggested card."""
import bot_ai
import game_logic as gl


def hint_for(g, seat):
    """Suggestion for the given seat, or None when it's not their move."""
    if g.paused or g.turn != seat:
        return None
    if g.phase == "bidding":
        return _bidding_hint(g, seat)
    if g.phase == "playing":
        return _play_hint(g, seat)
    return None


def _bidding_hint(g, seat):
    hand = g.hands[seat]
    act = bot_ai.bot_bidding_action(hand, g.current_bid, seat)
    if act["type"] == "bid":
        suit = act["suit"]
        has_j = ("J" + suit) in hand
        has_9 = ("9" + suit) in hand
        reason = "bid_j9" if (has_j and has_9) else ("bid_jack" if has_j else "bid_long")
        return {"kind": "bid", "action": "bid", "value": act["value"],
                "suit": suit, "reason": reason}
    if act["type"] == "contre":
        return {"kind": "bid", "action": "contre",
                "suit": g.current_bid["suit"], "reason": "bid_contre"}
    return {"kind": "bid", "action": "pass",
            "reason": "bid_pass_high" if g.current_bid else "bid_pass_weak"}


def _play_hint(g, seat):
    hand = g.hands[seat]
    legal = gl.legal_moves(hand, g.trick, g.trump, seat)
    card = bot_ai.bot_play(hand, g.trick, g.trump, seat)
    if card not in legal:
        card = legal[0]
    if len(legal) == 1:
        return {"kind": "play", "card": card, "reason": "forced"}

    if not g.trick:  # leading the trick
        if gl.suit_of(card) == g.trump:
            reason = "lead_trump"
        elif gl.rank_of(card) == "A":
            reason = "lead_ace"
        else:
            reason = "lead_low"
        return {"kind": "play", "card": card, "reason": reason}

    led = gl.suit_of(g.trick[0]["card"])
    has_led = any(gl.suit_of(c) == led for c in hand)
    has_trump = any(gl.suit_of(c) == g.trump for c in hand)
    partner = (seat + 2) % 4
    winner = gl.trick_winner(g.trick, g.trump)

    if winner == partner:
        if gl.card_points(card, g.trump) >= 10:
            reason = "feed_partner"
        elif (led != g.trump and not has_led and has_trump
                and gl.suit_of(card) != g.trump):
            reason = "tfaskira_save"
        else:
            reason = "save_low"
        return {"kind": "play", "card": card, "reason": reason}

    wins = gl.trick_winner(g.trick + [{"seat": seat, "card": card}], g.trump) == seat
    if wins:
        if gl.suit_of(card) == g.trump and led != g.trump:
            already_cut = any(gl.suit_of(x["card"]) == g.trump for x in g.trick)
            reason = "overcut" if already_cut else "cut_win"
        else:
            reason = "win_high"
    else:
        reason = "follow_low" if has_led else "discard_low"
    return {"kind": "play", "card": card, "reason": reason}
