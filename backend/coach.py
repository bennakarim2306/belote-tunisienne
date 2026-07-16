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
    """Orientation guidance for bidding (not fixed rules — the learner stays free):
    looks at trump strength/count, outside aces, number of suits (cut potential)
    and the partner's bid, then recommends a level per the classic benchmarks:
    90 / 100 / 110 (trump master) / 120 (3 suits) / 130 (2 suits), partner
    support +10/+20, and the prudence rule (never raise just to talk)."""
    hand = g.hands[seat]
    cb = g.current_bid
    partner = (seat + 2) % 4

    # --- partner holds the current bid: support logic (+10 / +20 / pass) ---
    if cb and cb["seat"] == partner and not cb.get("capot"):
        n_trump, big_trump, aces_out, has_void = _support_features(hand, cb["suit"])
        if cb["value"] >= 110:
            # partner already announces trump mastery: only add what you can
            # actually deliver — an Ace (sure trick) or a cut. +20 demands an
            # extremely strong helping hand (Ace + cut + extra force).
            strong = aces_out >= 1 and has_void and (big_trump or aces_out >= 2)
            raise_by = 20 if strong else (10 if (aces_out >= 1 or has_void) else 0)
        else:
            concrete = big_trump or aces_out >= 1 or has_void
            score = min(n_trump, 3) + (2 if big_trump else 0) + aces_out + (1 if has_void else 0)
            raise_by = 20 if score >= 5 else (10 if (score >= 2 and concrete) else 0)
        value = cb["value"] + raise_by
        if raise_by and value <= 160:
            return {"kind": "bid", "action": "bid", "value": value, "suit": cb["suit"],
                    "n": n_trump, "prev": cb["value"],
                    "reason": "bid_support20" if raise_by == 20 else "bid_support10"}
        return {"kind": "bid", "action": "pass", "reason": "bid_pass_prudence"}

    # --- own-hand evaluation against the 90..130 benchmarks ---
    best = _evaluate_hand_bid(hand)
    if cb:
        if not cb.get("capot") and best and best[0] > cb["value"]:
            level, suit, reason, n_trump = best
            return {"kind": "bid", "action": "bid", "value": level, "suit": suit,
                    "n": n_trump, "reason": reason}
        act = bot_ai.bot_bidding_action(hand, cb, seat)
        if act["type"] == "contre":
            # defenders make it fall when the attackers stay under value-5:
            # with 162 points in play they must gather 168-value points
            # (e.g. 68 vs a 100 contract), +20 more if attackers hold Belote.
            need = 168 - cb["value"]
            return {"kind": "bid", "action": "contre", "suit": cb["suit"],
                    "value": cb["value"], "need": need, "need_belote": need + 20,
                    "reason": "bid_contre"}
        return {"kind": "bid", "action": "pass", "reason": "bid_pass_high"}
    if best:
        level, suit, reason, n_trump = best
        return {"kind": "bid", "action": "bid", "value": level, "suit": suit,
                "n": n_trump, "reason": reason}
    return {"kind": "bid", "action": "pass", "reason": "bid_pass_weak"}


def _support_features(hand, trump):
    """Features used to judge how much help we bring to the partner's contract."""
    n_trump = sum(1 for c in hand if gl.suit_of(c) == trump)
    big_trump = any(r + trump in hand for r in ("J", "9", "A"))
    aces_out = sum(1 for c in hand
                   if gl.rank_of(c) == "A" and gl.suit_of(c) != trump)
    non_trump_suits = [s for s in gl.SUITS if s != trump]
    has_void = any(all(gl.suit_of(c) != s for c in hand) for s in non_trump_suits)
    return n_trump, big_trump, aces_out, has_void


def _evaluate_hand_bid(hand):
    """Best (level, suit, reason, trump_count) per the orientation benchmarks,
    or None when the hand doesn't reach the 90 benchmark."""
    n_suits = sum(1 for s in gl.SUITS if any(gl.suit_of(c) == s for c in hand))
    best = None
    for s in gl.SUITS:
        n = sum(1 for c in hand if gl.suit_of(c) == s)
        if n == 0:
            continue
        has_j = ("J" + s) in hand
        has_9 = ("9" + s) in hand
        if not (has_j or has_9):
            # strict rule: never advise a contract without the Jack or the 9
            # of trumps — whatever the length, it stays a passing suit
            continue
        has_a = ("A" + s) in hand
        aces_out = sum(1 for c in hand
                       if gl.rank_of(c) == "A" and gl.suit_of(c) != s)
        # "trump master": J + 9 + one extra force (A of trump or real length)
        master = has_j and has_9 and (has_a or n >= 4)
        level = reason = None
        if master and n >= 4 and n_suits <= 2:
            level, reason = 130, "bid_130"
        elif master and n >= 4 and n_suits <= 3:
            level, reason = 120, "bid_120"
        elif master:
            level, reason = 110, "bid_110"
        elif (has_j or has_9) and n >= 4:
            level, reason = 100, "bid_100"
        elif (has_j or has_9) and n >= 3 and aces_out >= 1:
            level, reason = 90, "bid_90"
        if level and (best is None or level > best[0]):
            best = (level, s, reason, n)
    return best


def _play_hint(g, seat):
    hand = g.hands[seat]
    legal = gl.legal_moves(hand, g.trick, g.trump, seat)
    card = bot_ai.bot_play(hand, g.trick, g.trump, seat,
                           getattr(g, "play_history", None),
                           g.current_bid["seat"] % 2 if g.current_bid else None)
    if card not in legal:
        card = legal[0]
    if len(legal) == 1:
        return {"kind": "play", "card": card, "reason": "forced"}

    if not g.trick:  # leading the trick
        cb = g.current_bid
        defending = cb is not None and cb["seat"] % 2 != seat % 2
        if defending and gl.suit_of(card) == g.trump:
            # never advise opening trumps against the opponents' contract:
            # trumps must be kept to cut — unless the hand holds nothing else
            plain = [c for c in legal if gl.suit_of(c) != g.trump]
            if plain:
                aces = [c for c in plain if gl.rank_of(c) == "A"]
                if aces:
                    return {"kind": "play", "card": aces[0], "reason": "lead_ace"}
                return {"kind": "play", "card": bot_ai.weakest(plain, g.trump),
                        "reason": "lead_low_def"}
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
