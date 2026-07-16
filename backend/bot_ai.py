"""Heuristic AI for Belote Tunisienne bots.

Implements the strategy charter (user-provided, June 2026):
- bidding benchmarks 90..130 + partner support (+10/+20),
- memory of the hand built ONLY from publicly played cards,
- trump drawing when the team owns the contract,
- cashing masters, protecting unprotected tens, cheap wins,
- Tfaskira banking (dry 10 first) and indirect colour signalling,
- endgame master play.
The mandatory rules always win: every choice is made among legal_moves().
"""
from game_logic import (SUITS, TRUMP_STRENGTH, PLAIN_STRENGTH, legal_moves,
                        trick_winner, suit_of, rank_of, card_points,
                        trump_str, plain_str)

# same-colour partner suit used for the indirect call ("appel indirect")
PAIRED_SUIT = {"S": "C", "C": "S", "H": "D", "D": "H"}


def _strength(card, trump):
    return trump_str(card) if suit_of(card) == trump else plain_str(card)


def weakest(cards, trump):
    """Lowest card by points, ties broken by intrinsic strength."""
    return min(cards, key=lambda c: (card_points(c, trump), _strength(c, trump)))


def _suit_len(hand, s):
    return sum(1 for c in hand if suit_of(c) == s)


# ---------------------------------------------------------------- memory

def build_memory(history, trick, trump):
    """Track public information only (§5 of the charter): played cards,
    players void in a suit, players who already cut a suit, trumps out.
    `history` is the flat play order of the hand (completed tricks then the
    current one); falls back to the current trick for legacy callers."""
    hist = history if history else list(trick)
    played = set()
    voids = {0: set(), 1: set(), 2: set(), 3: set()}
    cuts = {0: set(), 1: set(), 2: set(), 3: set()}
    for i in range(0, len(hist), 4):
        chunk = hist[i:i + 4]
        lead = suit_of(chunk[0]["card"])
        for t in chunk:
            played.add(t["card"])
        for t in chunk[1:]:
            s2 = suit_of(t["card"])
            if s2 != lead:
                voids[t["seat"]].add(lead)
                if trump is not None and s2 == trump and lead != trump:
                    cuts[t["seat"]].add(lead)
    trumps_out = (sum(1 for c in played if suit_of(c) == trump)
                  if trump is not None else 0)
    return {"played": played, "voids": voids, "cuts": cuts,
            "trumps_out": trumps_out}


def _ace_seen(suit, mem, hand):
    a = "A" + suit
    return a in mem["played"] or a in hand


def is_master(card, hand, mem, trump):
    """True when every stronger card of the suit is already played or mine."""
    s = suit_of(card)
    order = TRUMP_STRENGTH if s == trump else PLAIN_STRENGTH
    mine = order[rank_of(card)]
    for r, st in order.items():
        if st > mine:
            h = r + s
            if h not in mem["played"] and h not in hand:
                return False
    return True


def _signals(card, hand, mem, trump):
    """Indirect call: discarding this card points the partner to the paired
    same-colour suit where I hold a master (the trump pair maps to itself)."""
    s = suit_of(card)
    ps = PAIRED_SUIT[s]
    target = ps if ps != trump else s
    if target == trump:
        return False
    return any(suit_of(c) == target and c != card
               and is_master(c, hand, mem, trump) for c in hand)


def _safe_discard(legal, hand, mem, trump):
    """Cheapest harmless card (§4 order): weak useless first, then shorten a
    suit, prefer a signalling card, keep masters/aces/unprotected tens."""
    pool = [c for c in legal
            if suit_of(c) != trump
            and rank_of(c) != "A"
            and not is_master(c, hand, mem, trump)
            and not (rank_of(c) == "10"
                     and not _ace_seen(suit_of(c), mem, hand))]
    if not pool:
        pool = [c for c in legal if suit_of(c) != trump] or list(legal)
    return min(pool, key=lambda c: (card_points(c, trump),
                                    _suit_len(hand, suit_of(c)),
                                    0 if _signals(c, hand, mem, trump) else 1,
                                    _strength(c, trump)))


# ---------------------------------------------------------------- bidding

def hand_bid_level(hand, suit):
    """Contract level per the charter benchmarks (0 = no bid):
    90: J or 9 + >=3 trumps + a side Ace | 100: J and 9 + >=3 trumps
    110: J and 9 + >=5 trumps | 120: idem + only 3 suits | 130: only 2."""
    n = _suit_len(hand, suit)
    has_j = ("J" + suit) in hand
    has_9 = ("9" + suit) in hand
    aces_out = sum(1 for c in hand
                   if rank_of(c) == "A" and suit_of(c) != suit)
    n_suits = len({suit_of(c) for c in hand})
    if has_j and has_9 and n >= 5:
        if n_suits <= 2:
            return 130
        if n_suits <= 3:
            return 120
        return 110
    if has_j and has_9 and n >= 3:
        return 100
    if (has_j or has_9) and n >= 3 and aces_out >= 1:
        return 90
    return 0


def best_bid(hand):
    best_suit, best_level = SUITS[0], 0
    for s in SUITS:
        lv = hand_bid_level(hand, s)
        if lv > best_level:
            best_suit, best_level = s, lv
    return best_suit, best_level


def should_contre(hand, trump, bid_value):
    if bid_value is None or bid_value < 100:
        return False
    has_j = ("J" + trump) in hand
    has_9 = ("9" + trump) in hand
    has_a = ("A" + trump) in hand
    n_trumps = _suit_len(hand, trump)
    return (has_j and n_trumps >= 2) or (has_9 and has_a)


def should_surcontre(hand, trump):
    return ("J" + trump) in hand and ("9" + trump) in hand


def bot_bidding_action(hand, current_bid, seat, bids=None):
    suit, level = best_bid(hand)
    if current_bid is None:
        if level >= 90:
            return {"type": "bid", "value": level, "suit": suit}
        return {"type": "pass"}
    value = current_bid.get("value")
    if value is None:  # announced capot ends the auction anyway
        return {"type": "pass"}
    if current_bid["seat"] % 2 != seat % 2:
        # opponents hold the contract: outbid with a stronger hand or contre
        if level > value and level <= 160:
            return {"type": "bid", "value": level, "suit": suit}
        if should_contre(hand, current_bid["suit"], value):
            return {"type": "contre"}
        return {"type": "pass"}
    if current_bid["seat"] == seat:
        return {"type": "pass"}
    # partner holds the contract — support once only (no raise ping-pong)
    if bids and any(b.get("seat") == seat and b.get("type") == "bid"
                    for b in bids):
        return {"type": "pass"}
    psuit = current_bid["suit"]
    support = ("J" + psuit) in hand or ("9" + psuit) in hand
    aces = sum(1 for c in hand
               if rank_of(c) == "A" and suit_of(c) != psuit)
    if support and aces >= 1 and value + 20 <= 160:
        return {"type": "bid", "value": value + 20, "suit": psuit}
    if support and value + 10 <= 160:
        return {"type": "bid", "value": value + 10, "suit": psuit}
    if suit != psuit and level > value and level <= 160:
        return {"type": "bid", "value": level, "suit": suit}
    return {"type": "pass"}


# ---------------------------------------------------------------- playing

def _lead(hand, legal, trump, seat, mem, bid_team):
    partner = (seat + 2) % 4
    opps = [(seat + 1) % 4, (seat + 3) % 4]
    masters = [c for c in legal if is_master(c, hand, mem, trump)]

    # §6 endgame: cash the guaranteed tricks
    if len(hand) <= 3 and masters:
        return max(masters, key=lambda c: (card_points(c, trump),
                                           _strength(c, trump)))

    # §3 draw trumps when my team owns the contract and I'm strong at trump
    if trump is not None and bid_team is not None and bid_team == seat % 2:
        my_trumps = [c for c in hand if suit_of(c) == trump]
        opp_may_have = ((8 - mem["trumps_out"] - len(my_trumps)) > 0
                        and not all(trump in mem["voids"][o] for o in opps))
        trump_masters = [c for c in my_trumps
                         if is_master(c, hand, mem, trump)]
        if (opp_may_have and trump_masters
                and (("J" + trump) in hand or len(my_trumps) >= 3)):
            return max(trump_masters, key=trump_str)

    # cash a side master in a suit no opponent can ruff
    safe_masters = [c for c in masters if suit_of(c) != trump and not any(
        suit_of(c) in mem["voids"][o] or suit_of(c) in mem["cuts"][o]
        for o in opps)]
    if safe_masters:
        return max(safe_masters, key=lambda c: card_points(c, trump))

    # §2 replay a suit the partner ruffs (unless an opponent may overruff)
    if trump is not None:
        for c in sorted(legal, key=lambda c: (card_points(c, trump),
                                              _strength(c, trump))):
            s = suit_of(c)
            if s == trump:
                continue
            if ((s in mem["cuts"][partner] or s in mem["voids"][partner])
                    and not any(s in mem["voids"][o] for o in opps)):
                return c

    return _safe_discard(legal, hand, mem, trump)


def _tfaskira(hand, legal, trick, trump, mem, opps_to_play, lead_suit, seat):
    """Partner currently wins the trick: bank points when the trick is safe
    (dry 10 first), otherwise throw the cheapest harmless card."""
    partner = (seat + 2) % 4
    pc = next(t["card"] for t in trick if t["seat"] == partner)
    if len(trick) == 3:
        secure = True
    elif suit_of(pc) == trump:
        secure = is_master(pc, hand, mem, trump)
    else:
        secure = (is_master(pc, hand, mem, trump)
                  and not any(lead_suit in mem["voids"][o]
                              for o in opps_to_play))
    if secure:
        bankable = [c for c in legal if suit_of(c) != trump
                    and card_points(c, trump) > 0
                    and not is_master(c, hand, mem, trump)]
        if bankable:
            # highest points; the dry ten (shortest suit) goes first
            return max(bankable, key=lambda c: (card_points(c, trump),
                                                -_suit_len(hand, suit_of(c))))
    return _safe_discard(legal, hand, mem, trump)


def bot_play(hand, trick, trump, seat, history=None, bid_team=None):
    legal = legal_moves(hand, trick, trump, seat)
    if len(legal) == 1:
        return legal[0]
    mem = build_memory(history, trick, trump)
    partner = (seat + 2) % 4

    if not trick:
        return _lead(hand, legal, trump, seat, mem, bid_team)

    played_seats = {t["seat"] for t in trick}
    opps_to_play = [s for s in range(4) if s not in played_seats
                    and s != seat and s % 2 != seat % 2]
    lead_suit = suit_of(trick[0]["card"])

    if trick_winner(trick, trump) == partner:
        return _tfaskira(hand, legal, trick, trump, mem,
                         opps_to_play, lead_suit, seat)

    winning = [c for c in legal
               if trick_winner(trick + [{"seat": seat, "card": c}],
                               trump) == seat]
    if winning:
        if len(trick) == 3:
            # last to speak: the cheapest card that takes it (§2)
            return weakest(winning, trump)
        # never spend a ten whose Ace is still out (§2)
        safe = [c for c in winning
                if not (suit_of(c) != trump and rank_of(c) == "10"
                        and not _ace_seen(suit_of(c), mem, hand))]
        if safe:
            cut_risk = any(lead_suit in mem["voids"][o] for o in opps_to_play)
            masters = [c for c in safe if suit_of(c) != trump
                       and is_master(c, hand, mem, trump) and not cut_risk]
            if masters:
                return max(masters, key=lambda c: card_points(c, trump))
            if all(suit_of(c) == trump for c in safe):
                return min(safe, key=trump_str)  # cheapest (over)ruff
            return weakest([c for c in safe if suit_of(c) != trump], trump)
    return _safe_discard(legal, hand, mem, trump)
