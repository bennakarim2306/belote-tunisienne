"""Belote Tunisienne — pure game rules engine (no I/O)."""
import random
import time

SUITS = ["S", "H", "C", "D"]
RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"]
TRUMP_STRENGTH = {"7": 0, "8": 1, "Q": 2, "K": 3, "10": 4, "A": 5, "9": 6, "J": 7}
PLAIN_STRENGTH = {"7": 0, "8": 1, "9": 2, "J": 3, "Q": 4, "K": 5, "10": 6, "A": 7}
TRUMP_POINTS = {"J": 20, "9": 14, "A": 11, "10": 10, "K": 4, "Q": 3, "8": 0, "7": 0}
PLAIN_POINTS = {"A": 11, "10": 10, "K": 4, "Q": 3, "J": 2, "9": 0, "8": 0, "7": 0}
BID_VALUES = [90, 100, 110, 120, 130, 140, 150, 160]

TURN_SECONDS = 30
SURCONTRE_SECONDS = 15
HAND_END_SECONDS = 30        # players confirm with a "ready" button, auto-validated after 30s
MATCH_END_SECONDS = 10       # shorter wait before revealing the match result
PAUSE_MAX_SECONDS = 180      # accepted pause auto-resumes after 3 min
TRICK_PAUSE = 1.8


def suit_of(card: str) -> str:
    return card[-1]


def rank_of(card: str) -> str:
    return card[:-1]


def card_points(card: str, trump: str) -> int:
    if suit_of(card) == trump:
        return TRUMP_POINTS[rank_of(card)]
    return PLAIN_POINTS[rank_of(card)]


def trump_str(card: str) -> int:
    return TRUMP_STRENGTH[rank_of(card)]


def plain_str(card: str) -> int:
    return PLAIN_STRENGTH[rank_of(card)]


def round_score(x: int) -> int:
    """1-4 rounds down, 5-9 rounds up."""
    return ((x + 5) // 10) * 10


def sorted_hand(hand, trump):
    def key(c):
        s = suit_of(c)
        strength = trump_str(c) if s == trump else plain_str(c)
        return (SUITS.index(s), -strength)
    return sorted(hand, key=key)


def trick_winner(trick, trump) -> int:
    lead = suit_of(trick[0]["card"])
    trumps = [t for t in trick if suit_of(t["card"]) == trump]
    if trumps:
        return max(trumps, key=lambda t: trump_str(t["card"]))["seat"]
    follows = [t for t in trick if suit_of(t["card"]) == lead]
    return max(follows, key=lambda t: plain_str(t["card"]))["seat"]


def legal_moves(hand, trick, trump, seat=None):
    """Tunisian rules: follow suit; at trump must overtrump if possible.
    If void in the led suit you must trump (couper) — EXCEPT when your
    partner is currently winning the trick: then you may play any card
    (fausse-carte / "Tfaskira"). Requires `seat` to detect the partner."""
    if not trick:
        return list(hand)
    lead = suit_of(trick[0]["card"])
    lead_cards = [c for c in hand if suit_of(c) == lead]
    trumps_in_trick = [t["card"] for t in trick if suit_of(t["card"]) == trump]

    if lead == trump:
        if lead_cards:
            if trumps_in_trick:
                highest = max(trumps_in_trick, key=trump_str)
                higher = [c for c in lead_cards if trump_str(c) > trump_str(highest)]
                if higher:
                    return higher
            return lead_cards
        return list(hand)

    if lead_cards:
        return lead_cards

    # void in the led suit — Tfaskira: if the partner is currently master
    # of the trick, no obligation to cut, any card may be played.
    if seat is not None and trick_winner(trick, trump) == (seat + 2) % 4:
        return list(hand)

    my_trumps = [c for c in hand if suit_of(c) == trump]
    if my_trumps:
        if trumps_in_trick:
            highest = max(trumps_in_trick, key=trump_str)
            higher = [c for c in my_trumps if trump_str(c) > trump_str(highest)]
            if higher:
                return higher
        return my_trumps
    return list(hand)


class BeloteGame:
    """Authoritative state machine for one match (multiple hands to target score)."""

    def __init__(self, game_id, players, match_type, turn_timeout=30):
        # players: list of 4 dicts {user_id, username, avatar_id, is_bot, elo}, index == seat
        self.game_id = game_id
        self.players = [dict(p, seat=i, left=False) for i, p in enumerate(players)]
        self.match_type = match_type
        self.turn_timeout = turn_timeout  # seconds per move, None = unlimited
        self.target = 1000 if match_type == "short" else 2000
        self.match_scores = [0, 0]
        self.hand_number = 0
        self.dealer = random.randrange(4)
        self.version = 0
        self.phase = "bidding"
        self.match_over = False
        self.winner_team = None
        self.cancelled = False
        self.host_user_id = None  # set for private/solo games: their creator
        self.origin = "online"  # "online" | "solo" | "private" — for ads/analytics
        self.elo_changes = None
        self.seat_stats = {s: {"contracts_taken": 0, "contracts_made": 0,
                               "belotes": 0, "capots": 0} for s in range(4)}
        self.pause_until = 0.0
        self.turn_deadline = 0.0
        self.hand_history = []
        self._deal(rotate=False)

    # ---------- setup ----------

    def _turn_deadline_ts(self, extra=0.0):
        if not self.turn_timeout:
            return 0.0
        return time.time() + extra + self.turn_timeout


    def _deal(self, rotate=True):
        if rotate:
            self.dealer = (self.dealer + 1) % 4
        self.hand_number += 1
        deck = [r + s for s in SUITS for r in RANKS]
        random.shuffle(deck)
        self.hands = [deck[i * 8:(i + 1) * 8] for i in range(4)]
        self.phase = "bidding"
        self.turn = (self.dealer + 1) % 4
        self.bids = []
        self.current_bid = None
        self.pass_count = 0
        self.contre = None
        self.surcontre = None
        self.trump = None
        self.trick = []
        self.last_trick = None
        self.tricks_played = 0
        self.trick_counts = [0, 0]
        self.team_points = [0, 0]
        self.belote_seat = None
        self.belote_played = 0
        self.hand_result = None
        self.pause_until = 0.0
        self.ready_seats = []
        self.pause_req = None
        self.paused = None
        self.turn_deadline = self._turn_deadline_ts()
        self.version += 1

    def seat_of(self, user_id):
        for p in self.players:
            if p["user_id"] == user_id:
                return p["seat"]
        return None

    # ---------- bidding ----------

    def apply_bid(self, seat, value, suit):
        if self.phase != "bidding":
            raise ValueError("not_bidding")
        if self.turn != seat:
            raise ValueError("not_your_turn")
        if value not in BID_VALUES or suit not in SUITS:
            raise ValueError("invalid_bid")
        if self.current_bid and value <= self.current_bid["value"]:
            raise ValueError("bid_too_low")
        self.current_bid = {"seat": seat, "value": value, "suit": suit, "capot": False}
        self.bids.append({"seat": seat, "type": "bid", "value": value, "suit": suit})
        self.pass_count = 0
        self.turn = (seat + 1) % 4
        self.turn_deadline = self._turn_deadline_ts()
        self.version += 1
        return [{"e": "bid", "seat": seat, "value": value, "suit": suit}]

    def apply_pass(self, seat):
        if self.phase != "bidding":
            raise ValueError("not_bidding")
        if self.turn != seat:
            raise ValueError("not_your_turn")
        self.bids.append({"seat": seat, "type": "pass"})
        self.pass_count += 1
        self.version += 1
        events = [{"e": "pass", "seat": seat}]
        if self.current_bid is None:
            if self.pass_count >= 4:
                self._deal(rotate=True)
                events.append({"e": "redeal"})
                return events
        elif self.pass_count >= 3:
            events += self._start_playing()
            return events
        self.turn = (seat + 1) % 4
        self.turn_deadline = self._turn_deadline_ts()
        return events

    def apply_capot(self, seat, suit):
        """Announced capot — allowed out of turn, ends bidding, cannot be contred."""
        if self.phase != "bidding":
            raise ValueError("not_bidding")
        if suit not in SUITS:
            raise ValueError("invalid_bid")
        if self.current_bid and self.current_bid.get("capot"):
            raise ValueError("capot_already")
        self.current_bid = {"seat": seat, "value": None, "suit": suit, "capot": True}
        self.bids.append({"seat": seat, "type": "capot", "suit": suit})
        self.version += 1
        events = [{"e": "capot", "seat": seat, "suit": suit}]
        events += self._start_playing()
        return events

    def apply_contre(self, seat):
        """Allowed out of turn, by the defending team, during bidding."""
        if self.phase != "bidding":
            raise ValueError("not_bidding")
        if not self.current_bid or self.current_bid.get("capot"):
            raise ValueError("nothing_to_contre")
        if seat % 2 == self.current_bid["seat"] % 2:
            raise ValueError("own_team")
        if self.contre:
            raise ValueError("already_contred")
        self.contre = {"seat": seat}
        self.bids.append({"seat": seat, "type": "contre"})
        self.phase = "surcontre"
        self.turn = None
        self.turn_deadline = (time.time() + SURCONTRE_SECONDS) if self.turn_timeout else 0.0
        self.version += 1
        return [{"e": "contre", "seat": seat}]

    def apply_surcontre(self, seat):
        if self.phase != "surcontre":
            raise ValueError("not_surcontre")
        if seat % 2 != self.current_bid["seat"] % 2:
            raise ValueError("not_your_team")
        self.surcontre = {"seat": seat}
        self.bids.append({"seat": seat, "type": "surcontre"})
        self.version += 1
        events = [{"e": "surcontre", "seat": seat}]
        events += self._start_playing()
        return events

    def apply_decline_surcontre(self, seat):
        if self.phase != "surcontre":
            raise ValueError("not_surcontre")
        if seat % 2 != self.current_bid["seat"] % 2:
            raise ValueError("not_your_team")
        self.version += 1
        return self._start_playing()

    def _start_playing(self):
        self.phase = "playing"
        self.trump = self.current_bid["suit"]
        self.turn = (self.dealer + 1) % 4
        self.turn_deadline = self._turn_deadline_ts()
        # detect Belote-Rebelote holder (K + Q of trump in one hand)
        for s in range(4):
            if ("K" + self.trump) in self.hands[s] and ("Q" + self.trump) in self.hands[s]:
                self.belote_seat = s
                break
        self.version += 1
        return [{"e": "play_start", "trump": self.trump}]

    # ---------- playing ----------

    def apply_play(self, seat, card):
        if self.phase != "playing":
            raise ValueError("not_playing")
        if self.turn != seat:
            raise ValueError("not_your_turn")
        if card not in self.hands[seat]:
            raise ValueError("card_not_in_hand")
        legal = legal_moves(self.hands[seat], self.trick, self.trump, seat)
        if card not in legal:
            raise ValueError("illegal_move")
        events = []
        if seat == self.belote_seat and suit_of(card) == self.trump and rank_of(card) in ("K", "Q"):
            self.belote_played += 1
            word = "belote" if self.belote_played == 1 else "rebelote"
            events.append({"e": "belote", "seat": seat, "word": word})
        self.hands[seat].remove(card)
        self.trick.append({"seat": seat, "card": card})
        events.append({"e": "play", "seat": seat, "card": card})
        self.version += 1

        if len(self.trick) == 4:
            winner = trick_winner(self.trick, self.trump)
            pts = sum(card_points(t["card"], self.trump) for t in self.trick)
            team = winner % 2
            self.trick_counts[team] += 1
            self.team_points[team] += pts
            self.tricks_played += 1
            self.last_trick = {"winner_seat": winner, "cards": self.trick, "points": pts}
            self.trick = []
            events.append({"e": "trick_end", "winner_seat": winner})
            if self.tricks_played == 8:
                self.team_points[team] += 10  # dix de der
                events += self._score_hand()
            elif self.current_bid["capot"] and team != self.current_bid["seat"] % 2:
                # announced capot destroyed by a defender's trick: end the hand now
                events += self._score_hand()
            else:
                self.turn = winner
                self.pause_until = time.time() + TRICK_PAUSE
                self.turn_deadline = self._turn_deadline_ts(extra=TRICK_PAUSE)
        else:
            self.turn = (seat + 1) % 4
            self.turn_deadline = self._turn_deadline_ts()
        return events

    # ---------- scoring ----------

    def _score_hand(self):
        cb = self.current_bid
        att = cb["seat"] % 2
        dfd = 1 - att
        belote_team = (self.belote_seat % 2) if self.belote_seat is not None else None
        raw = list(self.team_points)
        capot_team = None
        if self.trick_counts[0] == 8:
            capot_team = 0
        elif self.trick_counts[1] == 8:
            capot_team = 1

        att_total = raw[att] + (20 if belote_team == att else 0)
        scores = [0, 0]
        success = None

        if cb["capot"]:
            success = capot_team == att
            scores[att if success else dfd] = 500
        elif self.surcontre:
            success = att_total >= (cb["value"] - 5)
            scores[att if success else dfd] = 640
        elif self.contre:
            success = att_total >= (cb["value"] - 5)
            scores[att if success else dfd] = 320
        elif capot_team is not None:
            success = capot_team == att
            scores[capot_team] = 250
        else:
            needed = cb["value"] - 5
            success = att_total >= needed
            if success:
                scores[att] = round_score(att_total)
                scores[dfd] = round_score(raw[dfd] + (20 if belote_team == dfd else 0))
            else:
                scores[att] = 20 if belote_team == att else 0
                scores[dfd] = round_score(160 + (20 if belote_team == dfd else 0))

        # belote bonus on top of fixed-value results
        if belote_team is not None and (cb["capot"] or self.contre or self.surcontre or
                                        (capot_team is not None and not cb["capot"])):
            scores[belote_team] += 20

        # stats
        self.seat_stats[cb["seat"]]["contracts_taken"] += 1
        if success:
            self.seat_stats[cb["seat"]]["contracts_made"] += 1
        if self.belote_seat is not None:
            self.seat_stats[self.belote_seat]["belotes"] += 1
        if capot_team is not None:
            for s in (capot_team, capot_team + 2):
                self.seat_stats[s]["capots"] += 1

        self.match_scores[0] += scores[0]
        self.match_scores[1] += scores[1]
        if max(self.match_scores) >= self.target and self.match_scores[0] != self.match_scores[1]:
            self.match_over = True
            self.winner_team = 0 if self.match_scores[0] > self.match_scores[1] else 1

        self.hand_result = {
            "contract": {"seat": cb["seat"], "team": att, "value": cb["value"],
                         "suit": cb["suit"], "capot": cb["capot"],
                         "contre": bool(self.contre), "surcontre": bool(self.surcontre)},
            "success": success,
            "raw_points": raw,
            "belote_team": belote_team,
            "capot_team": capot_team,
            "hand_scores": scores,
            "match_scores": list(self.match_scores),
            "match_over": self.match_over,
            "winner_team": self.winner_team,
        }
        self.hand_history.append({
            "hand_number": self.hand_number,
            "contract": dict(self.hand_result["contract"]),
            "success": success,
            "hand_scores": list(scores),
            "match_scores": list(self.match_scores),
        })
        self.phase = "hand_end"
        self.turn = None
        self.ready_seats = []
        self.pause_req = None
        self.paused = None
        self.turn_deadline = time.time() + (
            MATCH_END_SECONDS if self.match_over else HAND_END_SECONDS)
        self.version += 1
        return [{"e": "hand_end"}]

    def next_hand(self):
        self._deal(rotate=True)
        return [{"e": "next_hand"}]

    def apply_ready(self, seat):
        """A player confirms they finished reading the hand result."""
        if self.phase != "hand_end":
            raise ValueError("not_hand_end")
        if seat not in self.ready_seats:
            self.ready_seats.append(seat)
            self.version += 1
        return [{"e": "ready", "seat": seat}]

    # ---------- pause ----------

    def request_pause(self, seat, required_seats):
        """Ask for a break; every human in required_seats must accept."""
        if self.phase not in ("bidding", "playing"):
            raise ValueError("cannot_pause")
        if self.pause_req or self.paused:
            raise ValueError("pause_pending")
        self.pause_req = {"seat": seat, "required": list(required_seats), "accepts": []}
        self.version += 1
        events = [{"e": "pause_request", "seat": seat}]
        if not self.pause_req["required"]:
            events += self._activate_pause()
        return events

    def accept_pause(self, seat):
        if not self.pause_req:
            raise ValueError("no_pause_request")
        if seat not in self.pause_req["required"]:
            raise ValueError("not_required")
        if seat not in self.pause_req["accepts"]:
            self.pause_req["accepts"].append(seat)
        self.version += 1
        events = [{"e": "pause_accept", "seat": seat}]
        if set(self.pause_req["required"]) <= set(self.pause_req["accepts"]):
            events += self._activate_pause()
        return events

    def decline_pause(self, seat):
        if not self.pause_req:
            raise ValueError("no_pause_request")
        if seat not in self.pause_req["required"]:
            raise ValueError("not_required")
        requester = self.pause_req["seat"]
        self.pause_req = None
        self.version += 1
        return [{"e": "pause_declined", "seat": seat, "requester": requester}]

    def _activate_pause(self):
        seat = self.pause_req["seat"]
        remaining = None
        if self.turn_timeout and self.turn_deadline:
            remaining = max(3.0, self.turn_deadline - time.time())
        self.paused = {"seat": seat, "until": time.time() + PAUSE_MAX_SECONDS,
                       "remaining": remaining, "reason": "request"}
        self.pause_req = None
        self.version += 1
        return [{"e": "paused", "seat": seat, "reason": "request"}]

    def pause_disconnect(self, seat, duration):
        """Auto-pause because a player lost their network connection."""
        if self.paused:
            raise ValueError("already_paused")
        remaining = None
        if self.turn_timeout and self.turn_deadline:
            remaining = max(3.0, self.turn_deadline - time.time())
        self.pause_req = None
        self.paused = {"seat": seat, "until": time.time() + duration,
                       "remaining": remaining, "reason": "disconnect"}
        self.version += 1
        return [{"e": "paused", "seat": seat, "reason": "disconnect"}]

    def resume(self, seat=None):
        """seat=None → auto-resume by the server; otherwise requester only."""
        if not self.paused:
            raise ValueError("not_paused")
        if seat is not None and seat != self.paused["seat"]:
            raise ValueError("not_requester")
        remaining = self.paused.get("remaining")
        if remaining and self.turn_timeout:
            self.turn_deadline = time.time() + remaining
        self.paused = None
        self.version += 1
        return [{"e": "resumed"}]

    # ---------- serialization ----------

    def state_for(self, seat):
        cb = self.current_bid
        contract = None
        if cb:
            contract = {"seat": cb["seat"], "team": cb["seat"] % 2, "value": cb["value"],
                        "suit": cb["suit"], "capot": cb["capot"],
                        "contre": bool(self.contre), "surcontre": bool(self.surcontre)}
        my_hand = sorted_hand(self.hands[seat], self.trump) if seat is not None else []
        legal = []
        if self.phase == "playing" and self.turn == seat:
            legal = legal_moves(self.hands[seat], self.trick, self.trump, seat)
        can_contre = (self.phase == "bidding" and cb is not None and not cb["capot"]
                      and self.contre is None and seat is not None
                      and seat % 2 != cb["seat"] % 2)
        can_surcontre = (self.phase == "surcontre" and seat is not None
                         and seat % 2 == cb["seat"] % 2)
        return {
            "game_id": self.game_id,
            "phase": self.phase,
            "hand_number": self.hand_number,
            "dealer": self.dealer,
            "turn": self.turn,
            "players": [{"seat": p["seat"], "user_id": p["user_id"], "username": p["username"],
                         "avatar_id": p["avatar_id"], "is_bot": p["is_bot"], "elo": p["elo"],
                         "card_count": len(self.hands[p["seat"]])} for p in self.players],
            "my_seat": seat,
            "hand": my_hand,
            "legal": legal,
            "trick": self.trick,
            "last_trick": self.last_trick,
            "trump": self.trump,
            "contract": contract,
            "bids": self.bids[-8:],
            "match_scores": self.match_scores,
            "target": self.target,
            "match_type": self.match_type,
            "trick_counts": self.trick_counts,
            "tricks_played": self.tricks_played,
            "can_contre": can_contre,
            "can_surcontre": can_surcontre,
            "belote": ({"seat": self.belote_seat, "played": self.belote_played}
                       if self.belote_played > 0 else None),
            "hand_result": self.hand_result,
            "ready_seats": self.ready_seats,
            "hand_history": self.hand_history,
            "pause_req": self.pause_req,
            "paused": ({"seat": self.paused["seat"], "until": self.paused["until"],
                        "reason": self.paused.get("reason", "request")}
                       if self.paused else None),
            "match_over": self.match_over,
            "winner_team": self.winner_team,
            "cancelled": self.cancelled,
            "host_user_id": self.host_user_id,
            "origin": self.origin,
            "turn_deadline": self.turn_deadline,
            "turn_timeout": self.turn_timeout,
            "elo_changes": self.elo_changes,
        }
