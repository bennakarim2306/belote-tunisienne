// Belote Tunisienne — pure game rules engine (no I/O).
// Faithful TypeScript port of backend/game_logic.py so Solo vs AI can run
// 100% offline. Property names intentionally mirror the Python snake_case
// fields: stateFor() must emit the exact shape the UI already consumes.
import type {
  BidEntry,
  GameEvent,
  GameState,
  HandHistoryEntry,
  HandResult,
  TrickCard,
} from "./useGameSocket";

export const SUITS = ["S", "H", "C", "D"];
export const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"];
export const TRUMP_STRENGTH: Record<string, number> = {
  "7": 0, "8": 1, Q: 2, K: 3, "10": 4, A: 5, "9": 6, J: 7,
};
export const PLAIN_STRENGTH: Record<string, number> = {
  "7": 0, "8": 1, "9": 2, J: 3, Q: 4, K: 5, "10": 6, A: 7,
};
export const TRUMP_POINTS: Record<string, number> = {
  J: 20, "9": 14, A: 11, "10": 10, K: 4, Q: 3, "8": 0, "7": 0,
};
export const PLAIN_POINTS: Record<string, number> = {
  A: 11, "10": 10, K: 4, Q: 3, J: 2, "9": 0, "8": 0, "7": 0,
};
export const BID_VALUES = [90, 100, 110, 120, 130, 140, 150, 160];

export const SURCONTRE_SECONDS = 5;
export const HAND_END_SECONDS = 30;
export const MATCH_END_SECONDS = 10;
export const TRICK_PAUSE = 1.8;

const now = () => Date.now() / 1000;

export const suitOf = (card: string) => card[card.length - 1];
export const rankOf = (card: string) => card.slice(0, -1);

export function cardPoints(card: string, trump: string | null): number {
  if (suitOf(card) === trump) return TRUMP_POINTS[rankOf(card)];
  return PLAIN_POINTS[rankOf(card)];
}

export const trumpStr = (card: string) => TRUMP_STRENGTH[rankOf(card)];
export const plainStr = (card: string) => PLAIN_STRENGTH[rankOf(card)];

/** 1-4 rounds down, 5-9 rounds up. */
export const roundScore = (x: number) => Math.floor((x + 5) / 10) * 10;

export function sortedHand(hand: string[], trump: string | null): string[] {
  return [...hand].sort((a, b) => {
    const sa = suitOf(a);
    const sb = suitOf(b);
    if (sa !== sb) return SUITS.indexOf(sa) - SUITS.indexOf(sb);
    const stA = sa === trump ? trumpStr(a) : plainStr(a);
    const stB = sb === trump ? trumpStr(b) : plainStr(b);
    return stB - stA;
  });
}

function maxBy<T>(arr: T[], key: (x: T) => number): T {
  let best = arr[0];
  let bestK = key(best);
  for (let i = 1; i < arr.length; i++) {
    const k = key(arr[i]);
    if (k > bestK) {
      best = arr[i];
      bestK = k;
    }
  }
  return best;
}

export function trickWinner(trick: TrickCard[], trump: string | null): number {
  const lead = suitOf(trick[0].card);
  const trumps = trick.filter((t) => suitOf(t.card) === trump);
  if (trumps.length) return maxBy(trumps, (t) => trumpStr(t.card)).seat;
  const follows = trick.filter((t) => suitOf(t.card) === lead);
  return maxBy(follows, (t) => plainStr(t.card)).seat;
}

/** Tunisian rules: follow suit; at trump must overtrump if possible.
 * If void in the led suit you must trump (couper) — EXCEPT when your
 * partner is currently winning the trick: then you may play any card
 * (fausse-carte / "Tfaskira"). Requires `seat` to detect the partner. */
export function legalMoves(
  hand: string[],
  trick: TrickCard[],
  trump: string | null,
  seat: number | null = null,
): string[] {
  if (!trick.length) return [...hand];
  const lead = suitOf(trick[0].card);
  const leadCards = hand.filter((c) => suitOf(c) === lead);
  const trumpsInTrick = trick.filter((t) => suitOf(t.card) === trump).map((t) => t.card);

  if (lead === trump) {
    if (leadCards.length) {
      if (trumpsInTrick.length) {
        const highest = maxBy(trumpsInTrick, trumpStr);
        const higher = leadCards.filter((c) => trumpStr(c) > trumpStr(highest));
        if (higher.length) return higher;
      }
      return leadCards;
    }
    return [...hand];
  }

  if (leadCards.length) return leadCards;

  // void in the led suit — Tfaskira: if the partner is currently master
  // of the trick, no obligation to cut, any card may be played.
  // Limit: with ONLY trumps in hand, Tfaskira cannot be used to under-trump
  // or refuse to climb — the normal trump obligation below applies
  // (must overtrump the winning trump when possible).
  if (seat !== null && trickWinner(trick, trump) === (seat + 2) % 4) {
    if (hand.some((c) => suitOf(c) !== trump)) return [...hand];
  }

  const myTrumps = hand.filter((c) => suitOf(c) === trump);
  if (myTrumps.length) {
    if (trumpsInTrick.length) {
      const highest = maxBy(trumpsInTrick, trumpStr);
      const higher = myTrumps.filter((c) => trumpStr(c) > trumpStr(highest));
      if (higher.length) return higher;
    }
    return myTrumps;
  }
  return [...hand];
}

/** True if the hand holds 7+ cards of the same suit — such a deal is void. */
export function sevenOfASuit(hand: string[]): boolean {
  return SUITS.some((s) => hand.filter((c) => suitOf(c) === s).length >= 7);
}

function shuffle<T>(a: T[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

export interface EnginePlayerInfo {
  user_id: string;
  username: string;
  avatar_id: string;
  is_bot: boolean;
  elo: number;
}

interface SeatedPlayer extends EnginePlayerInfo {
  seat: number;
  left: boolean;
}

export interface CurrentBid {
  seat: number;
  value: number | null;
  suit: string;
  capot: boolean;
}

interface SeatStats {
  contracts_taken: number;
  contracts_made: number;
  belotes: number;
  capots: number;
}

/** Authoritative state machine for one match (multiple hands to target score). */
export class BeloteEngine {
  game_id: string;
  players: SeatedPlayer[];
  match_type: string;
  turn_timeout: number | null;
  target: number;
  match_scores: [number, number];
  hand_number: number;
  dealer: number;
  version: number;
  phase: "bidding" | "surcontre" | "playing" | "hand_end" | "finished";
  match_over: boolean;
  winner_team: number | null;
  cancelled: boolean;
  host_user_id: string | null;
  origin: "online" | "solo" | "private";
  elo_changes: Record<string, number> | null;
  seat_stats: Record<number, SeatStats>;
  pause_until: number;
  turn_deadline: number;
  hand_history: HandHistoryEntry[];

  // per-hand fields (initialised by _deal)
  hands!: string[][];
  turn!: number | null;
  bids!: BidEntry[];
  current_bid!: CurrentBid | null;
  pass_count!: number;
  contre!: { seat: number } | null;
  surcontre!: { seat: number } | null;
  trump!: string | null;
  trick!: TrickCard[];
  play_history!: TrickCard[];
  last_trick!: { winner_seat: number; cards: TrickCard[]; points: number } | null;
  tricks_played!: number;
  trick_counts!: [number, number];
  team_points!: [number, number];
  belote_seat!: number | null;
  belote_played!: number;
  hand_result!: HandResult | null;
  ready_seats!: number[];
  pause_req!: { seat: number; required: number[]; accepts: number[] } | null;
  paused!: {
    seat: number;
    until: number;
    remaining: number | null;
    reason: "request" | "disconnect";
  } | null;

  constructor(
    gameId: string,
    players: EnginePlayerInfo[],
    matchType: string,
    turnTimeout: number | null = null,
  ) {
    this.game_id = gameId;
    this.players = players.map((p, i) => ({ ...p, seat: i, left: false }));
    this.match_type = matchType;
    this.turn_timeout = turnTimeout;
    this.target = matchType === "short" ? 500 : 1000;
    this.match_scores = [0, 0];
    this.hand_number = 0;
    this.dealer = Math.floor(Math.random() * 4);
    this.version = 0;
    this.phase = "bidding";
    this.match_over = false;
    this.winner_team = null;
    this.cancelled = false;
    this.host_user_id = null;
    this.origin = "solo";
    this.elo_changes = null;
    this.seat_stats = {};
    for (let s = 0; s < 4; s++) {
      this.seat_stats[s] = { contracts_taken: 0, contracts_made: 0, belotes: 0, capots: 0 };
    }
    this.pause_until = 0;
    this.turn_deadline = 0;
    this.hand_history = [];
    this._deal(false);
  }

  // ---------- setup ----------

  private _turnDeadlineTs(extra = 0): number {
    if (!this.turn_timeout) return 0;
    return now() + extra + this.turn_timeout;
  }

  private _deal(rotate: boolean): void {
    if (rotate) this.dealer = (this.dealer + 1) % 4;
    this.hand_number += 1;
    const deck: string[] = [];
    for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
    shuffle(deck);
    let hands = [0, 1, 2, 3].map((i) => deck.slice(i * 8, (i + 1) * 8));
    // Rule: if a player receives 7+ cards of the same suit, the deal is
    // void — reshuffle and redeal, SAME dealer (no rotation).
    while (hands.some(sevenOfASuit)) {
      shuffle(deck);
      hands = [0, 1, 2, 3].map((i) => deck.slice(i * 8, (i + 1) * 8));
    }
    this.hands = hands;
    this.phase = "bidding";
    this.turn = (this.dealer + 1) % 4;
    this.bids = [];
    this.current_bid = null;
    this.pass_count = 0;
    this.contre = null;
    this.surcontre = null;
    this.trump = null;
    this.trick = [];
    this.play_history = []; // flat play order of the hand (bot memory)
    this.last_trick = null;
    this.tricks_played = 0;
    this.trick_counts = [0, 0];
    this.team_points = [0, 0];
    this.belote_seat = null;
    this.belote_played = 0;
    this.hand_result = null;
    this.pause_until = 0;
    this.ready_seats = [];
    this.pause_req = null;
    this.paused = null;
    this.turn_deadline = this._turnDeadlineTs();
    this.version += 1;
  }

  // ---------- bidding ----------

  applyBid(seat: number, value: number, suit: string): GameEvent[] {
    if (this.phase !== "bidding") throw new Error("not_bidding");
    if (this.turn !== seat) throw new Error("not_your_turn");
    if (!BID_VALUES.includes(value) || !SUITS.includes(suit)) throw new Error("invalid_bid");
    if (this.current_bid && this.current_bid.value !== null && value <= this.current_bid.value) {
      throw new Error("bid_too_low");
    }
    this.current_bid = { seat, value, suit, capot: false };
    this.bids.push({ seat, type: "bid", value, suit });
    this.pass_count = 0;
    this.turn = (seat + 1) % 4;
    this.turn_deadline = this._turnDeadlineTs();
    this.version += 1;
    return [{ e: "bid", seat, value, suit }];
  }

  applyPass(seat: number): GameEvent[] {
    if (this.phase !== "bidding") throw new Error("not_bidding");
    if (this.turn !== seat) throw new Error("not_your_turn");
    this.bids.push({ seat, type: "pass" });
    this.pass_count += 1;
    this.version += 1;
    const events: GameEvent[] = [{ e: "pass", seat }];
    if (this.current_bid === null) {
      if (this.pass_count >= 4) {
        this._deal(true);
        events.push({ e: "redeal" });
        return events;
      }
    } else if (this.pass_count >= 3) {
      events.push(...this._startPlaying());
      return events;
    }
    this.turn = (seat + 1) % 4;
    this.turn_deadline = this._turnDeadlineTs();
    return events;
  }

  /** Announced capot — allowed out of turn, ends bidding, cannot be contred. */
  applyCapot(seat: number, suit: string): GameEvent[] {
    if (this.phase !== "bidding") throw new Error("not_bidding");
    if (!SUITS.includes(suit)) throw new Error("invalid_bid");
    if (this.current_bid?.capot) throw new Error("capot_already");
    this.current_bid = { seat, value: null, suit, capot: true };
    this.bids.push({ seat, type: "capot", suit });
    this.version += 1;
    const events: GameEvent[] = [{ e: "capot", seat, suit }];
    events.push(...this._startPlaying());
    return events;
  }

  /** Allowed out of turn, by the defending team, during bidding. */
  applyContre(seat: number): GameEvent[] {
    if (this.phase !== "bidding") throw new Error("not_bidding");
    if (!this.current_bid || this.current_bid.capot) throw new Error("nothing_to_contre");
    if (seat % 2 === this.current_bid.seat % 2) throw new Error("own_team");
    if (this.contre) throw new Error("already_contred");
    this.contre = { seat };
    this.bids.push({ seat, type: "contre" });
    this.phase = "surcontre";
    this.turn = null;
    // 5s reaction window (surcontre or ignore) — applies in ALL games,
    // timed or not
    this.turn_deadline = now() + SURCONTRE_SECONDS;
    this.version += 1;
    return [{ e: "contre", seat }];
  }

  applySurcontre(seat: number): GameEvent[] {
    if (this.phase !== "surcontre") throw new Error("not_surcontre");
    if (seat % 2 !== this.current_bid!.seat % 2) throw new Error("not_your_team");
    this.surcontre = { seat };
    this.bids.push({ seat, type: "surcontre" });
    this.version += 1;
    const events: GameEvent[] = [{ e: "surcontre", seat }];
    events.push(...this._startPlaying());
    return events;
  }

  applyDeclineSurcontre(seat: number): GameEvent[] {
    if (this.phase !== "surcontre") throw new Error("not_surcontre");
    if (seat % 2 !== this.current_bid!.seat % 2) throw new Error("not_your_team");
    this.version += 1;
    return this._startPlaying();
  }

  private _startPlaying(): GameEvent[] {
    this.phase = "playing";
    this.trump = this.current_bid!.suit;
    this.turn = (this.dealer + 1) % 4;
    this.turn_deadline = this._turnDeadlineTs();
    // detect Belote-Rebelote holder (K + Q of trump in one hand)
    for (let s = 0; s < 4; s++) {
      if (this.hands[s].includes("K" + this.trump) && this.hands[s].includes("Q" + this.trump)) {
        this.belote_seat = s;
        break;
      }
    }
    this.version += 1;
    return [{ e: "play_start", trump: this.trump }];
  }

  // ---------- playing ----------

  applyPlay(seat: number, card: string): GameEvent[] {
    if (this.phase !== "playing") throw new Error("not_playing");
    if (this.turn !== seat) throw new Error("not_your_turn");
    if (!this.hands[seat].includes(card)) throw new Error("card_not_in_hand");
    const legal = legalMoves(this.hands[seat], this.trick, this.trump, seat);
    if (!legal.includes(card)) throw new Error("illegal_move");
    const events: GameEvent[] = [];
    if (
      seat === this.belote_seat &&
      suitOf(card) === this.trump &&
      (rankOf(card) === "K" || rankOf(card) === "Q")
    ) {
      this.belote_played += 1;
      const word = this.belote_played === 1 ? "belote" : "rebelote";
      events.push({ e: "belote", seat, word });
    }
    this.hands[seat] = this.hands[seat].filter((c) => c !== card);
    this.trick.push({ seat, card });
    this.play_history.push({ seat, card });
    events.push({ e: "play", seat, card });
    this.version += 1;

    if (this.trick.length === 4) {
      const winner = trickWinner(this.trick, this.trump);
      const pts = this.trick.reduce((sum, t) => sum + cardPoints(t.card, this.trump), 0);
      const team = winner % 2;
      this.trick_counts[team] += 1;
      this.team_points[team] += pts;
      this.tricks_played += 1;
      this.last_trick = { winner_seat: winner, cards: this.trick, points: pts };
      this.trick = [];
      events.push({ e: "trick_end", winner_seat: winner });
      if (this.tricks_played === 8) {
        this.team_points[team] += 10; // dix de der
        events.push(...this._scoreHand());
      } else if (this.current_bid!.capot && team !== this.current_bid!.seat % 2) {
        // announced capot destroyed by a defender's trick: end the hand now
        events.push(...this._scoreHand());
      } else {
        this.turn = winner;
        this.pause_until = now() + TRICK_PAUSE;
        this.turn_deadline = this._turnDeadlineTs(TRICK_PAUSE);
      }
    } else {
      this.turn = (seat + 1) % 4;
      this.turn_deadline = this._turnDeadlineTs();
    }
    return events;
  }

  // ---------- scoring ----------

  private _scoreHand(): GameEvent[] {
    const cb = this.current_bid!;
    const att = cb.seat % 2;
    const dfd = 1 - att;
    const beloteTeam = this.belote_seat !== null ? this.belote_seat % 2 : null;
    const raw: [number, number] = [this.team_points[0], this.team_points[1]];
    let capotTeam: number | null = null;
    if (this.trick_counts[0] === 8) capotTeam = 0;
    else if (this.trick_counts[1] === 8) capotTeam = 1;

    const attTotal = raw[att] + (beloteTeam === att ? 20 : 0);
    const scores: [number, number] = [0, 0];
    let success: boolean;

    if (cb.capot) {
      success = capotTeam === att;
      scores[success ? att : dfd] = 500;
    } else if (this.surcontre) {
      success = attTotal >= cb.value! - 5;
      scores[success ? att : dfd] = 640;
    } else if (this.contre) {
      success = attTotal >= cb.value! - 5;
      scores[success ? att : dfd] = 320;
    } else if (capotTeam !== null) {
      success = capotTeam === att;
      scores[capotTeam] = 250;
    } else {
      const needed = cb.value! - 5;
      success = attTotal >= needed;
      if (success) {
        scores[att] = roundScore(attTotal);
        scores[dfd] = roundScore(raw[dfd] + (beloteTeam === dfd ? 20 : 0));
      } else {
        scores[att] = beloteTeam === att ? 20 : 0;
        scores[dfd] = roundScore(160 + (beloteTeam === dfd ? 20 : 0));
      }
    }

    // belote bonus on top of fixed-value results
    if (
      beloteTeam !== null &&
      (cb.capot || this.contre || this.surcontre || (capotTeam !== null && !cb.capot))
    ) {
      scores[beloteTeam] += 20;
    }

    // stats
    this.seat_stats[cb.seat].contracts_taken += 1;
    if (success) this.seat_stats[cb.seat].contracts_made += 1;
    if (this.belote_seat !== null) this.seat_stats[this.belote_seat].belotes += 1;
    if (capotTeam !== null) {
      this.seat_stats[capotTeam].capots += 1;
      this.seat_stats[capotTeam + 2].capots += 1;
    }

    this.match_scores[0] += scores[0];
    this.match_scores[1] += scores[1];
    if (
      Math.max(this.match_scores[0], this.match_scores[1]) >= this.target &&
      this.match_scores[0] !== this.match_scores[1]
    ) {
      this.match_over = true;
      this.winner_team = this.match_scores[0] > this.match_scores[1] ? 0 : 1;
    }

    const contract = {
      seat: cb.seat,
      team: att,
      value: cb.value,
      suit: cb.suit,
      capot: cb.capot,
      contre: !!this.contre,
      surcontre: !!this.surcontre,
    };
    this.hand_result = {
      contract,
      success,
      raw_points: raw,
      belote_team: beloteTeam,
      capot_team: capotTeam,
      hand_scores: scores,
      match_scores: [this.match_scores[0], this.match_scores[1]],
      match_over: this.match_over,
      winner_team: this.winner_team,
    };
    this.hand_history.push({
      hand_number: this.hand_number,
      contract: { ...contract },
      success,
      hand_scores: [scores[0], scores[1]],
      match_scores: [this.match_scores[0], this.match_scores[1]],
    });
    this.phase = "hand_end";
    this.turn = null;
    this.ready_seats = [];
    this.pause_req = null;
    this.paused = null;
    this.turn_deadline = now() + (this.match_over ? MATCH_END_SECONDS : HAND_END_SECONDS);
    this.version += 1;
    return [{ e: "hand_end" }];
  }

  nextHand(): GameEvent[] {
    this._deal(true);
    return [{ e: "next_hand" }];
  }

  /** A player confirms they finished reading the hand result. */
  applyReady(seat: number): GameEvent[] {
    if (this.phase !== "hand_end") throw new Error("not_hand_end");
    if (!this.ready_seats.includes(seat)) {
      this.ready_seats.push(seat);
      this.version += 1;
    }
    return [{ e: "ready", seat }];
  }

  // ---------- pause ----------

  requestPause(seat: number, requiredSeats: number[]): GameEvent[] {
    if (this.phase !== "bidding" && this.phase !== "playing") throw new Error("cannot_pause");
    if (this.pause_req || this.paused) throw new Error("pause_pending");
    this.pause_req = { seat, required: [...requiredSeats], accepts: [] };
    this.version += 1;
    const events: GameEvent[] = [{ e: "pause_request", seat }];
    if (!this.pause_req.required.length) events.push(...this._activatePause());
    return events;
  }

  private _activatePause(): GameEvent[] {
    const seat = this.pause_req!.seat;
    let remaining: number | null = null;
    if (this.turn_timeout && this.turn_deadline) {
      remaining = Math.max(3, this.turn_deadline - now());
    }
    this.paused = { seat, until: now() + 180, remaining, reason: "request" };
    this.pause_req = null;
    this.version += 1;
    return [{ e: "paused", seat }];
  }

  /** seat=null → auto-resume by the driver; otherwise requester only. */
  resume(seat: number | null = null): GameEvent[] {
    if (!this.paused) throw new Error("not_paused");
    if (seat !== null && seat !== this.paused.seat) throw new Error("not_requester");
    const remaining = this.paused.remaining;
    if (remaining && this.turn_timeout) this.turn_deadline = now() + remaining;
    this.paused = null;
    this.version += 1;
    return [{ e: "resumed" }];
  }

  // ---------- persistence ----------

  toDoc(): Record<string, unknown> {
    return JSON.parse(JSON.stringify({ ...this }));
  }

  static fromDoc(doc: Record<string, unknown>): BeloteEngine {
    const g = Object.assign(Object.create(BeloteEngine.prototype), doc) as BeloteEngine;
    if (!g.play_history) g.play_history = []; // docs saved before this field
    return g;
  }

  // ---------- serialization ----------

  stateFor(seat: number): GameState {
    const cb = this.current_bid;
    let contract = null;
    if (cb) {
      contract = {
        seat: cb.seat,
        team: cb.seat % 2,
        value: cb.value,
        suit: cb.suit,
        capot: cb.capot,
        contre: !!this.contre,
        surcontre: !!this.surcontre,
      };
    }
    const myHand = sortedHand(this.hands[seat], this.trump);
    let legal: string[] = [];
    if (this.phase === "playing" && this.turn === seat) {
      legal = legalMoves(this.hands[seat], this.trick, this.trump, seat);
    }
    const canContre =
      this.phase === "bidding" &&
      cb !== null &&
      !cb.capot &&
      this.contre === null &&
      seat % 2 !== cb.seat % 2;
    const canSurcontre = this.phase === "surcontre" && seat % 2 === cb!.seat % 2;
    return {
      game_id: this.game_id,
      phase: this.phase,
      hand_number: this.hand_number,
      dealer: this.dealer,
      turn: this.turn,
      players: this.players.map((p) => ({
        seat: p.seat,
        user_id: p.user_id,
        username: p.username,
        avatar_id: p.avatar_id,
        is_bot: p.is_bot,
        elo: p.elo,
        card_count: this.hands[p.seat].length,
      })),
      my_seat: seat,
      hand: myHand,
      legal,
      trick: this.trick,
      last_trick: this.last_trick,
      trump: this.trump,
      contract,
      bids: this.bids.slice(-8),
      match_scores: this.match_scores,
      target: this.target,
      match_type: this.match_type,
      trick_counts: this.trick_counts,
      tricks_played: this.tricks_played,
      can_contre: canContre,
      can_surcontre: canSurcontre,
      belote:
        this.belote_played > 0 ? { seat: this.belote_seat!, played: this.belote_played } : null,
      hand_result: this.hand_result,
      ready_seats: this.ready_seats,
      hand_history: this.hand_history,
      pause_req: this.pause_req,
      paused: this.paused
        ? { seat: this.paused.seat, until: this.paused.until, reason: this.paused.reason }
        : null,
      match_over: this.match_over,
      winner_team: this.winner_team,
      cancelled: this.cancelled,
      host_user_id: this.host_user_id,
      origin: this.origin,
      turn_deadline: this.turn_deadline,
      turn_timeout: this.turn_timeout,
      elo_changes: this.elo_changes,
    };
  }
}
