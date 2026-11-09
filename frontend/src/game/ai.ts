// Heuristic AI for Belote Tunisienne bots.
// Strict TypeScript port of backend/bot_ai.py (strategy charter, June 2026):
// bidding benchmarks 90..130 + partner support, public-cards memory, trump
// drawing, master cashing, Tfaskira banking (dry 10), indirect signalling,
// endgame master play. Mandatory rules always apply via legalMoves().
import {
  cardPoints,
  legalMoves,
  PLAIN_STRENGTH,
  plainStr,
  rankOf,
  suitOf,
  SUITS,
  TRUMP_STRENGTH,
  trickWinner,
  trumpStr,
  type CurrentBid,
} from "./engine";
import type { BidEntry, TrickCard } from "./useGameSocket";

// same-colour partner suit used for the indirect call ("appel indirect")
const PAIRED_SUIT: Record<string, string> = { S: "C", C: "S", H: "D", D: "H" };

const strength = (card: string, trump: string | null) =>
  suitOf(card) === trump ? trumpStr(card) : plainStr(card);

/** Python-like min/max on lexicographic number[] keys; first wins ties. */
function pyMin(cards: string[], key: (c: string) => number[]): string {
  let best = cards[0];
  let bk = key(best);
  for (let i = 1; i < cards.length; i++) {
    const k = key(cards[i]);
    for (let j = 0; j < k.length; j++) {
      if (k[j] < bk[j]) {
        best = cards[i];
        bk = k;
        break;
      }
      if (k[j] > bk[j]) break;
    }
  }
  return best;
}

function pyMax(cards: string[], key: (c: string) => number[]): string {
  let best = cards[0];
  let bk = key(best);
  for (let i = 1; i < cards.length; i++) {
    const k = key(cards[i]);
    for (let j = 0; j < k.length; j++) {
      if (k[j] > bk[j]) {
        best = cards[i];
        bk = k;
        break;
      }
      if (k[j] < bk[j]) break;
    }
  }
  return best;
}

function weakest(cards: string[], trump: string | null): string {
  return pyMin(cards, (c) => [cardPoints(c, trump), strength(c, trump)]);
}

const suitLen = (hand: string[], s: string) =>
  hand.filter((c) => suitOf(c) === s).length;

// ---------------------------------------------------------------- memory

export interface BotMemory {
  played: Set<string>;
  voids: Record<number, Set<string>>;
  cuts: Record<number, Set<string>>;
  trumps_out: number;
}

export function buildMemory(
  history: TrickCard[] | null | undefined,
  trick: TrickCard[],
  trump: string | null,
): BotMemory {
  const hist = history && history.length ? history : [...trick];
  const played = new Set<string>();
  const voids: Record<number, Set<string>> = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() };
  const cuts: Record<number, Set<string>> = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() };
  for (let i = 0; i < hist.length; i += 4) {
    const chunk = hist.slice(i, i + 4);
    const lead = suitOf(chunk[0].card);
    for (const t of chunk) played.add(t.card);
    for (const t of chunk.slice(1)) {
      const s2 = suitOf(t.card);
      if (s2 !== lead) {
        voids[t.seat].add(lead);
        if (trump !== null && s2 === trump && lead !== trump) cuts[t.seat].add(lead);
      }
    }
  }
  let trumps_out = 0;
  if (trump !== null) for (const c of played) if (suitOf(c) === trump) trumps_out++;
  return { played, voids, cuts, trumps_out };
}

const aceSeen = (suit: string, mem: BotMemory, hand: string[]) =>
  mem.played.has("A" + suit) || hand.includes("A" + suit);

export function isMaster(
  card: string,
  hand: string[],
  mem: BotMemory,
  trump: string | null,
): boolean {
  const s = suitOf(card);
  const order = s === trump ? TRUMP_STRENGTH : PLAIN_STRENGTH;
  const mine = order[rankOf(card)];
  for (const r of Object.keys(order)) {
    if (order[r] > mine) {
      const h = r + s;
      if (!mem.played.has(h) && !hand.includes(h)) return false;
    }
  }
  return true;
}

function signals(card: string, hand: string[], mem: BotMemory, trump: string | null): boolean {
  const s = suitOf(card);
  const ps = PAIRED_SUIT[s];
  const target = ps !== trump ? ps : s;
  if (target === trump) return false;
  return hand.some(
    (c) => suitOf(c) === target && c !== card && isMaster(c, hand, mem, trump),
  );
}

function safeDiscard(
  legal: string[],
  hand: string[],
  mem: BotMemory,
  trump: string | null,
): string {
  let pool = legal.filter(
    (c) =>
      suitOf(c) !== trump &&
      rankOf(c) !== "A" &&
      !isMaster(c, hand, mem, trump) &&
      !(rankOf(c) === "10" && !aceSeen(suitOf(c), mem, hand)),
  );
  if (!pool.length) {
    pool = legal.filter((c) => suitOf(c) !== trump);
    if (!pool.length) pool = [...legal];
  }
  return pyMin(pool, (c) => [
    cardPoints(c, trump),
    suitLen(hand, suitOf(c)),
    signals(c, hand, mem, trump) ? 0 : 1,
    strength(c, trump),
  ]);
}

// ------------------------------------------------- team knowledge (v2)

export function partnerBidInfo(
  bids: BidEntry[] | null | undefined,
  seat: number,
  trump: string | null,
): { level: number; bid_trump: boolean } {
  const partner = (seat + 2) % 4;
  let level = 0;
  let bidTrump = false;
  for (const b of bids ?? []) {
    if (b.seat !== partner) continue;
    if (b.type === "bid" && b.suit === trump) {
      bidTrump = true;
      level = Math.max(level, b.value ?? 0);
    } else if (b.type === "capot" && b.suit === trump) {
      bidTrump = true;
      level = Math.max(level, 160);
    }
  }
  return { level, bid_trump: bidTrump };
}

export function partnerStrength(
  bids: BidEntry[] | null | undefined,
  seat: number,
  trump: string | null,
  hand: string[],
  mem: BotMemory,
): number {
  // Estimated partner trump strength 0..3 from the auction — NEVER cheating:
  // top trumps I hold or already played are excluded from what the partner
  // can still hold (their strength is then elsewhere).
  if (trump === null) return 0;
  const partner = (seat + 2) % 4;
  if (mem.voids[partner].has(trump)) return 0; // partner shown OUT of trump
  const info = partnerBidInfo(bids, seat, trump);
  if (!info.bid_trump) return 0;
  const jFree = !hand.includes("J" + trump) && !mem.played.has("J" + trump);
  const nFree = !hand.includes("9" + trump) && !mem.played.has("9" + trump);
  if (info.level >= 100 && jFree && nFree) return 3;
  if (info.level >= 90 && (jFree || nFree)) return 2;
  return 1;
}

export function trumpsLeft(mem: BotMemory, hand: string[], trump: string | null): number {
  if (trump === null) return 0;
  return 8 - mem.trumps_out - suitLen(hand, trump);
}

export function oppsMayHaveTrump(
  mem: BotMemory,
  seat: number,
  hand: string[],
  trump: string | null,
): boolean {
  if (trump === null || trumpsLeft(mem, hand, trump) <= 0) return false;
  const opps = [(seat + 1) % 4, (seat + 3) % 4];
  return !opps.every((o) => mem.voids[o].has(trump));
}

export function teamTrumpControl(
  hand: string[],
  mem: BotMemory,
  trump: string | null,
  seat: number,
  bids: BidEntry[] | null | undefined,
): boolean {
  if (trump === null) return false;
  if (hand.some((c) => suitOf(c) === trump && isMaster(c, hand, mem, trump))) {
    return true;
  }
  return partnerStrength(bids, seat, trump, hand, mem) >= 2;
}

export function isSureMaster(
  card: string,
  hand: string[],
  mem: BotMemory,
  trump: string | null,
  seat: number,
): boolean {
  // Master of its suit AND no opponent can take it any more: a trump master,
  // all other trumps out, or both opponents known out of trump.
  if (!isMaster(card, hand, mem, trump)) return false;
  const s = suitOf(card);
  if (s === trump || trump === null) return true;
  if (trumpsLeft(mem, hand, trump) <= 0) return true;
  const opps = [(seat + 1) % 4, (seat + 3) % 4];
  return opps.every((o) => mem.voids[o].has(trump));
}

export function tricksWonByTeam(
  history: TrickCard[] | null | undefined,
  trump: string | null,
): [number, number] {
  const won: [number, number] = [0, 0];
  const hist = history ?? [];
  for (let i = 0; i + 3 < hist.length; i += 4) {
    const chunk = hist.slice(i, i + 4);
    won[trickWinner(chunk, trump) % 2] += 1;
  }
  return won;
}

export function capotPotential(
  hand: string[],
  mem: BotMemory,
  trump: string | null,
  seat: number,
  bids: BidEntry[] | null | undefined,
  history: TrickCard[] | null | undefined,
): boolean {
  // Taking ALL the tricks is plausible: opponents took none yet, the team
  // controls trump, and (almost) every side suit I hold is headed by a
  // master. Dies the moment an opponent wins a trick. Public info only.
  if (trump === null) return false;
  const won = tricksWonByTeam(history, trump);
  if (won[(seat + 1) % 2] > 0) return false;
  if (!teamTrumpControl(hand, mem, trump, seat, bids)) return false;
  let uncovered = 0;
  for (const s of SUITS) {
    if (s === trump) continue;
    const cards = hand.filter((c) => suitOf(c) === s);
    if (cards.length) {
      const top = pyMax(cards, (c) => [plainStr(c)]);
      if (!isMaster(top, hand, mem, trump)) uncovered++;
    }
  }
  const allowance = partnerStrength(bids, seat, trump, hand, mem) >= 2 ? 1 : 0;
  return uncovered <= allowance;
}

export function bestEndgameOrder(
  hand: string[],
  mem: BotMemory,
  trump: string | null,
  seat: number,
): string {
  // Exactly 2 cards left and I lead: compare both orders explicitly
  // (sure tricks, then securing the last trick (+10), then points kept) and
  // return the card to play FIRST.
  const [a, b] = [...hand].sort();

  const winChance = (card: string, trumpMasterLedBefore: boolean): number => {
    if (!isMaster(card, hand, mem, trump)) return 0;
    const s = suitOf(card);
    if (s === trump) return 2;
    let tl = trumpsLeft(mem, hand, trump);
    if (trumpMasterLedBefore && tl > 0) tl -= 1;
    const opps = [(seat + 1) % 4, (seat + 3) % 4];
    if (tl <= 0 || opps.every((o) => mem.voids[o].has(trump as string))) return 2;
    if (opps.some((o) => mem.voids[o].has(s) && !mem.voids[o].has(trump as string))) {
      return 0;
    }
    return 1;
  };

  const orderScore = (x: string, y: string): number[] => {
    const wx = winChance(x, false);
    const drained = trump !== null && suitOf(x) === trump && isMaster(x, hand, mem, trump);
    const wy = winChance(y, drained);
    const pts =
      (wx >= 1 ? cardPoints(x, trump) : 0) + (wy >= 1 ? cardPoints(y, trump) : 0);
    return [wx + wy, wy >= 2 ? 1 : 0, pts];
  };

  const sa = orderScore(a, b);
  const sb = orderScore(b, a);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] > sb[i]) return a;
    if (sa[i] < sb[i]) return b;
  }
  return a; // tie: same as Python's >=
}

// ---------------------------------------------------------------- bidding

export function handBidLevel(hand: string[], suit: string): number {
  const n = suitLen(hand, suit);
  const hasJ = hand.includes("J" + suit);
  const has9 = hand.includes("9" + suit);
  const acesOut = hand.filter((c) => rankOf(c) === "A" && suitOf(c) !== suit).length;
  const nSuits = new Set(hand.map(suitOf)).size;
  if (hasJ && has9 && n >= 5) {
    if (nSuits <= 2) return 130;
    if (nSuits <= 3) return 120;
    return 110;
  }
  if (hasJ && has9 && n >= 3) return 100;
  if ((hasJ || has9) && n >= 3 && acesOut >= 1) return 90;
  return 0;
}

export function bestBid(hand: string[]): { suit: string; level: number } {
  let bestSuit = SUITS[0];
  let bestLevel = 0;
  for (const s of SUITS) {
    const lv = handBidLevel(hand, s);
    if (lv > bestLevel) {
      bestSuit = s;
      bestLevel = lv;
    }
  }
  return { suit: bestSuit, level: bestLevel };
}

export function shouldContre(hand: string[], trump: string, bidValue: number | null): boolean {
  if (bidValue === null || bidValue === undefined || bidValue < 100) return false;
  const hasJ = hand.includes("J" + trump);
  const has9 = hand.includes("9" + trump);
  const hasA = hand.includes("A" + trump);
  const nTrumps = suitLen(hand, trump);
  return (hasJ && nTrumps >= 2) || (has9 && hasA);
}

export function shouldSurcontre(hand: string[], trump: string): boolean {
  return hand.includes("J" + trump) && hand.includes("9" + trump);
}

export interface BotBidAction {
  type: "bid" | "pass" | "contre";
  value?: number;
  suit?: string;
}

export function botBiddingAction(
  hand: string[],
  currentBid: CurrentBid | null,
  seat: number,
  bids?: BidEntry[] | null,
): BotBidAction {
  const { suit, level } = bestBid(hand);
  if (currentBid === null) {
    if (level >= 90) return { type: "bid", value: level, suit };
    return { type: "pass" };
  }
  const value = currentBid.value;
  if (value === null || value === undefined) return { type: "pass" }; // capot
  if (currentBid.seat % 2 !== seat % 2) {
    // opponents hold the contract: outbid with a stronger hand or contre
    if (level > value && level <= 160) return { type: "bid", value: level, suit };
    if (shouldContre(hand, currentBid.suit, value)) return { type: "contre" };
    return { type: "pass" };
  }
  if (currentBid.seat === seat) return { type: "pass" };
  // partner holds the contract — support once only (no raise ping-pong)
  if (bids && bids.some((b) => b.seat === seat && b.type === "bid")) {
    return { type: "pass" };
  }
  const psuit = currentBid.suit;
  const support = hand.includes("J" + psuit) || hand.includes("9" + psuit);
  const aces = hand.filter((c) => rankOf(c) === "A" && suitOf(c) !== psuit).length;
  if (support && aces >= 1 && value + 20 <= 160) {
    return { type: "bid", value: value + 20, suit: psuit };
  }
  if (support && value + 10 <= 160) {
    return { type: "bid", value: value + 10, suit: psuit };
  }
  if (suit !== psuit && level > value && level <= 160) {
    return { type: "bid", value: level, suit };
  }
  return { type: "pass" };
}

// ---------------------------------------------------------------- playing

function lead(
  hand: string[],
  legal: string[],
  trump: string | null,
  seat: number,
  mem: BotMemory,
  bidTeam: number | null,
  bids: BidEntry[] | null = null,
  history: TrickCard[] | null = null,
): string {
  const partner = (seat + 2) % 4;
  const opps = [(seat + 1) % 4, (seat + 3) % 4];
  const masters = legal.filter((c) => isMaster(c, hand, mem, trump));

  // §6 endgame: on the very last tricks the ORDER of the cards matters
  if (hand.length === 2 && legal.length === 2) {
    return bestEndgameOrder(hand, mem, trump, seat);
  }
  if (hand.length <= 3 && masters.length) {
    // drain the last opponent trump FIRST when it frees a side master
    const trumpMasters = masters.filter((c) => suitOf(c) === trump);
    const vulnerable = masters.filter(
      (c) => suitOf(c) !== trump && !isSureMaster(c, hand, mem, trump, seat),
    );
    if (trumpMasters.length && vulnerable.length && oppsMayHaveTrump(mem, seat, hand, trump)) {
      return pyMax(trumpMasters, (c) => [trumpStr(c)]);
    }
    // otherwise cash the sure masters first, highest points
    const sure = masters.filter((c) => isSureMaster(c, hand, mem, trump, seat));
    const pool = sure.length ? sure : masters;
    return pyMax(pool, (c) => [cardPoints(c, trump), strength(c, trump)]);
  }

  const capotMode = capotPotential(hand, mem, trump, seat, bids, history);

  // §3 keep drawing trump while the team controls it and the opponents may
  // still hold some — protects our future side masters. No blind rule:
  // requires depth (J / 3+ trumps), a side master to protect, or capot mode.
  if (trump !== null && (capotMode || (bidTeam !== null && bidTeam === seat % 2))) {
    const myTrumps = hand.filter((c) => suitOf(c) === trump);
    const trumpMasters = myTrumps.filter((c) => isMaster(c, hand, mem, trump));
    if (trumpMasters.length && oppsMayHaveTrump(mem, seat, hand, trump)) {
      const sideToProtect = hand.some(
        (c) =>
          suitOf(c) !== trump &&
          isMaster(c, hand, mem, trump) &&
          !isSureMaster(c, hand, mem, trump, seat),
      );
      if (
        hand.includes("J" + trump) ||
        myTrumps.length >= 3 ||
        sideToProtect ||
        capotMode
      ) {
        return pyMax(trumpMasters, (c) => [trumpStr(c)]);
      }
    }
    // §2 team trump control read from the auction: even weak at trump, open
    // a small one toward the strong partner so the opponents spend theirs
    if (
      !trumpMasters.length &&
      myTrumps.length >= 2 &&
      oppsMayHaveTrump(mem, seat, hand, trump) &&
      partnerStrength(bids, seat, trump, hand, mem) >= 2
    ) {
      const small = myTrumps.filter((c) => rankOf(c) !== "J" && rankOf(c) !== "9");
      if (small.length) return pyMin(small, (c) => [trumpStr(c)]);
    }
  }

  // capot mode: secure every trick — sure masters before anything else
  if (capotMode && masters.length) {
    const sure = masters.filter((c) => isSureMaster(c, hand, mem, trump, seat));
    if (sure.length) {
      return pyMax(sure, (c) => [cardPoints(c, trump), strength(c, trump)]);
    }
  }

  // cash a side master in a suit no opponent can ruff
  const safeMasters = masters.filter(
    (c) =>
      suitOf(c) !== trump &&
      !opps.some((o) => mem.voids[o].has(suitOf(c)) || mem.cuts[o].has(suitOf(c))),
  );
  if (safeMasters.length) {
    return pyMax(safeMasters, (c) => [cardPoints(c, trump)]);
  }

  // §2 replay a suit the partner ruffs (unless an opponent may overruff)
  if (trump !== null) {
    const ordered = [...legal].sort((a, b) => {
      const ka = cardPoints(a, trump) - cardPoints(b, trump);
      return ka !== 0 ? ka : strength(a, trump) - strength(b, trump);
    });
    for (const c of ordered) {
      const s = suitOf(c);
      if (s === trump) continue;
      if (
        (mem.cuts[partner].has(s) || mem.voids[partner].has(s)) &&
        !opps.some((o) => mem.voids[o].has(s))
      ) {
        return c;
      }
    }
  }

  return safeDiscard(legal, hand, mem, trump);
}

function tfaskira(
  hand: string[],
  legal: string[],
  trick: TrickCard[],
  trump: string | null,
  mem: BotMemory,
  oppsToPlay: number[],
  leadSuit: string,
  seat: number,
  capotMode = false,
): string {
  const partner = (seat + 2) % 4;
  const pc = trick.find((t) => t.seat === partner)!.card;
  let secure: boolean;
  if (trick.length === 3) secure = true;
  else if (suitOf(pc) === trump) secure = isMaster(pc, hand, mem, trump);
  else {
    secure =
      isMaster(pc, hand, mem, trump) &&
      !oppsToPlay.some((o) => mem.voids[o].has(leadSuit));
  }
  if (secure) {
    const bankable = legal.filter(
      (c) =>
        suitOf(c) !== trump &&
        cardPoints(c, trump) > 0 &&
        !isMaster(c, hand, mem, trump),
    );
    if (bankable.length) {
      // highest points; the dry ten (shortest suit) goes first
      return pyMax(bankable, (c) => [cardPoints(c, trump), -suitLen(hand, suitOf(c))]);
    }
  }
  if (capotMode && !secure) {
    // a capot tolerates zero lost tricks: overtake the partner if we can
    const winning = legal.filter(
      (c) => trickWinner([...trick, { seat, card: c }], trump) === seat,
    );
    if (winning.length) return weakest(winning, trump);
  }
  return safeDiscard(legal, hand, mem, trump);
}

export function botPlay(
  hand: string[],
  trick: TrickCard[],
  trump: string,
  seat: number,
  history?: TrickCard[] | null,
  bidTeam: number | null = null,
  bids: BidEntry[] | null = null,
): string {
  const legal = legalMoves(hand, trick, trump, seat);
  if (legal.length === 1) return legal[0];
  const mem = buildMemory(history, trick, trump);
  const partner = (seat + 2) % 4;

  if (!trick.length) {
    return lead(hand, legal, trump, seat, mem, bidTeam, bids, history ?? null);
  }

  const playedSeats = new Set(trick.map((t) => t.seat));
  const oppsToPlay = [0, 1, 2, 3].filter(
    (s) => !playedSeats.has(s) && s !== seat && s % 2 !== seat % 2,
  );
  const leadSuit = suitOf(trick[0].card);

  if (trickWinner(trick, trump) === partner) {
    const capotMode = capotPotential(hand, mem, trump, seat, bids, history);
    return tfaskira(hand, legal, trick, trump, mem, oppsToPlay, leadSuit, seat,
      capotMode);
  }

  const winning = legal.filter(
    (c) => trickWinner([...trick, { seat, card: c }], trump) === seat,
  );
  if (winning.length) {
    if (trick.length === 3) {
      // last to speak: the cheapest card that takes it (§2)
      return weakest(winning, trump);
    }
    // never spend a ten whose Ace is still out (§2)
    const safe = winning.filter(
      (c) => !(suitOf(c) !== trump && rankOf(c) === "10" && !aceSeen(suitOf(c), mem, hand)),
    );
    if (safe.length) {
      const cutRisk = oppsToPlay.some((o) => mem.voids[o].has(leadSuit));
      const masters = safe.filter(
        (c) => suitOf(c) !== trump && isMaster(c, hand, mem, trump) && !cutRisk,
      );
      if (masters.length) return pyMax(masters, (c) => [cardPoints(c, trump)]);
      if (safe.every((c) => suitOf(c) === trump)) {
        return pyMin(safe, (c) => [trumpStr(c)]); // cheapest (over)ruff
      }
      return weakest(safe.filter((c) => suitOf(c) !== trump), trump);
    }
  }
  return safeDiscard(legal, hand, mem, trump);
}
