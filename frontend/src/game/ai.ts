// Heuristic AI for Belote Tunisienne bots.
// Faithful TypeScript port of backend/bot_ai.py.
import {
  cardPoints,
  legalMoves,
  plainStr,
  rankOf,
  suitOf,
  SUITS,
  TRUMP_POINTS,
  trickWinner,
  trumpStr,
  type CurrentBid,
} from "./engine";
import type { TrickCard } from "./useGameSocket";

const strength = (card: string, trump: string) =>
  suitOf(card) === trump ? trumpStr(card) : plainStr(card);

function minByKey(cards: string[], key: (c: string) => number): string {
  let best = cards[0];
  let bestK = key(best);
  for (let i = 1; i < cards.length; i++) {
    const k = key(cards[i]);
    if (k < bestK) {
      best = cards[i];
      bestK = k;
    }
  }
  return best;
}

function maxByKey(cards: string[], key: (c: string) => number): string {
  let best = cards[0];
  let bestK = key(best);
  for (let i = 1; i < cards.length; i++) {
    const k = key(cards[i]);
    if (k > bestK) {
      best = cards[i];
      bestK = k;
    }
  }
  return best;
}

/** Lowest card by points, ties broken by intrinsic strength (points ≤ 20,
 * strength ≤ 7 so the composite key preserves the (points, strength) order). */
function weakest(cards: string[], trump: string): string {
  return minByKey(cards, (c) => cardPoints(c, trump) * 10 + strength(c, trump));
}

export function evaluateTrump(hand: string[], suit: string): number {
  const trumps = hand.filter((c) => suitOf(c) === suit);
  let score = trumps.reduce((s, c) => s + TRUMP_POINTS[rankOf(c)], 0) + 5 * trumps.length;
  for (const c of hand) {
    if (suitOf(c) !== suit) {
      if (rankOf(c) === "A") score += 11;
      else if (rankOf(c) === "10") score += 4;
    }
  }
  return score;
}

export function bestBid(hand: string[]): { suit: string; maxBid: number } {
  let bestSuit = SUITS[0];
  let bestScore = -1;
  for (const s of SUITS) {
    const sc = evaluateTrump(hand, s);
    if (sc > bestScore) {
      bestSuit = s;
      bestScore = sc;
    }
  }
  const maxBid = Math.min(Math.floor((60 + bestScore) / 10) * 10, 160);
  return { suit: bestSuit, maxBid };
}

export function shouldContre(hand: string[], trump: string, bidValue: number | null): boolean {
  if (bidValue === null || bidValue < 100) return false;
  const hasJ = hand.includes("J" + trump);
  const has9 = hand.includes("9" + trump);
  const hasA = hand.includes("A" + trump);
  const nTrumps = hand.filter((c) => suitOf(c) === trump).length;
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
): BotBidAction {
  const { suit, maxBid } = bestBid(hand);
  if (currentBid === null) {
    if (maxBid >= 90) return { type: "bid", value: 90, suit };
    return { type: "pass" };
  }
  const bidTeam = currentBid.seat % 2;
  if (bidTeam !== seat % 2) {
    if (shouldContre(hand, currentBid.suit, currentBid.value)) return { type: "contre" };
    const nextVal = currentBid.value! + 10;
    if (nextVal <= maxBid && nextVal <= 160) return { type: "bid", value: nextVal, suit };
    return { type: "pass" };
  }
  // partner (or self, impossible) holds the bid — raise only if clearly stronger
  if (currentBid.seat !== seat && suit !== currentBid.suit) {
    const nextVal = currentBid.value! + 10;
    if (nextVal + 10 <= maxBid && nextVal <= 160) return { type: "bid", value: nextVal, suit };
  }
  return { type: "pass" };
}

export function botPlay(
  hand: string[],
  trick: TrickCard[],
  trump: string,
  seat: number,
): string {
  const legal = legalMoves(hand, trick, trump, seat);
  if (legal.length === 1) return legal[0];

  if (!trick.length) {
    for (const c of legal) {
      if (suitOf(c) === trump && rankOf(c) === "J") return c;
    }
    for (const c of legal) {
      if (suitOf(c) !== trump && rankOf(c) === "A") return c;
    }
    return weakest(legal, trump);
  }

  const partner = (seat + 2) % 4;
  const currentWinner = trickWinner(trick, trump);

  if (currentWinner === partner) {
    // Prefer discarding a plain card (Tfaskira lets us keep our trumps)
    const nonTr = legal.filter((c) => suitOf(c) !== trump);
    const pool = nonTr.length ? nonTr : legal;
    if (trick.length === 3) {
      return maxByKey(pool, (c) => cardPoints(c, trump));
    }
    return weakest(pool, trump);
  }

  const winning = legal.filter(
    (c) => trickWinner([...trick, { seat, card: c }], trump) === seat,
  );
  if (winning.length) {
    if (trick.length === 3) return weakest(winning, trump);
    const nonTrWin = winning.filter((c) => suitOf(c) !== trump);
    if (nonTrWin.length) return maxByKey(nonTrWin, (c) => cardPoints(c, trump));
    return minByKey(winning, trumpStr);
  }
  return weakest(legal, trump);
}
