// Offline engine stress test: simulates full bot-vs-bot matches through the
// exact code paths the local driver uses, asserting core Belote invariants.
import { botBiddingAction, botPlay, shouldSurcontre } from "../src/game/ai";
import { BeloteEngine, type EnginePlayerInfo } from "../src/game/engine";

let checks = 0;
function assert(cond: boolean, msg: string, extra?: unknown) {
  checks++;
  if (!cond) {
    console.error("ASSERTION FAILED:", msg, extra ?? "");
    process.exit(1);
  }
}

function players(): EnginePlayerInfo[] {
  return [0, 1, 2, 3].map((i) => ({
    user_id: `p${i}`,
    username: `P${i}`,
    avatar_id: "av1",
    is_bot: i !== 0,
    elo: 1000,
  }));
}

const stats = {
  matches: 0, hands: 0, redeals: 0, contres: 0, surcontres: 0,
  capotsAnnounced: 0, capotsMade: 0, belotes: 0, fails: 0, humanRandomMoves: 0,
};

function playMatch(matchType: "short" | "long", humanRandom: boolean): void {
  const g = new BeloteEngine(`local_${matchType}_test`, players(), matchType, null);
  let guard = 0;
  while (!g.match_over && g.phase !== "finished") {
    if (++guard > 20000) {
      assert(false, "match did not terminate", { phase: g.phase, scores: g.match_scores });
    }
    if (g.phase === "bidding" || g.phase === "playing") {
      const seat = g.turn!;
      assert(seat !== null && seat >= 0 && seat < 4, "valid turn seat");
      if (g.phase === "bidding") {
        // seat 0 as pseudo-human: sometimes random bids to exercise error paths
        if (humanRandom && seat === 0 && Math.random() < 0.3) {
          stats.humanRandomMoves++;
          try {
            const v = [90, 100, 110, 160][Math.floor(Math.random() * 4)];
            g.applyBid(0, v, ["S", "H", "C", "D"][Math.floor(Math.random() * 4)]);
            continue;
          } catch {
            /* illegal (too low): fall through to bot action */
          }
        }
        const act = botBiddingAction(g.hands[seat], g.current_bid, seat);
        if (act.type === "bid") {
          try {
            g.applyBid(seat, act.value!, act.suit!);
          } catch {
            g.applyPass(seat);
          }
        } else if (act.type === "contre") {
          try {
            g.applyContre(seat);
            stats.contres++;
          } catch {
            g.applyPass(seat);
          }
        } else {
          const evs = g.applyPass(seat);
          if (evs.some((e) => e.e === "redeal")) stats.redeals++;
        }
      } else {
        const legal = g.stateFor(seat).legal;
        // engine must agree the played card is legal
        let card: string;
        if (humanRandom && seat === 0) {
          const l = g.hands[seat].filter(() => true);
          card = botPlay(g.hands[seat], g.trick, g.trump!, seat);
          assert(l.includes(card), "bot card from hand");
        } else {
          card = botPlay(g.hands[seat], g.trick, g.trump!, seat);
        }
        assert(legal.includes(card), "botPlay returns a legal card", { card, legal });
        const evs = g.applyPlay(seat, card);
        if (evs.some((e) => e.e === "belote")) stats.belotes++;
      }
    } else if (g.phase === "surcontre") {
      const team = g.current_bid!.seat % 2;
      const botSeat = [team, team + 2].find((s) => g.players[s].is_bot)!;
      if (shouldSurcontre(g.hands[botSeat], g.current_bid!.suit) || Math.random() < 0.4) {
        g.applySurcontre(botSeat);
        stats.surcontres++;
      } else {
        g.applyDeclineSurcontre(botSeat);
      }
    } else if (g.phase === "hand_end") {
      const hr = g.hand_result!;
      stats.hands++;
      if (!hr.success) stats.fails++;
      if (hr.contract.capot) stats.capotsAnnounced++;
      if (hr.capot_team !== null) stats.capotsMade++;
      // ----- invariants -----
      if (g.tricks_played === 8) {
        assert(
          hr.raw_points[0] + hr.raw_points[1] === 162,
          "full hand raw points sum to 162",
          hr.raw_points,
        );
      }
      assert(g.trick_counts[0] + g.trick_counts[1] === g.tricks_played, "trick counts");
      assert(hr.hand_scores[0] >= 0 && hr.hand_scores[1] >= 0, "non-negative scores");
      const att = hr.contract.team;
      if (!hr.contract.capot && !hr.contract.contre && !hr.contract.surcontre &&
          hr.capot_team === null && !hr.success) {
        assert(
          hr.hand_scores[1 - att] >= 160,
          "failed contract gives defenders >= 160",
          hr.hand_scores,
        );
      }
      if (hr.contract.contre && !hr.contract.surcontre && !hr.contract.capot) {
        assert(
          hr.hand_scores[0] + hr.hand_scores[1] === 320 ||
            hr.hand_scores[0] + hr.hand_scores[1] === 340,
          "contre gives 320 (+20 belote)",
          hr.hand_scores,
        );
      }
      assert(
        g.match_scores[0] ===
          g.hand_history.reduce((s, h) => s + h.hand_scores[0], 0) &&
          g.match_scores[1] ===
            g.hand_history.reduce((s, h) => s + h.hand_scores[1], 0),
        "match scores are the sum of hand scores",
      );
      // ready flow
      g.applyReady(0);
      assert(g.ready_seats.includes(0), "ready registered");
      if (g.match_over) {
        g.phase = "finished";
        break;
      }
      g.nextHand();
      assert(g.phase === "bidding" && g.hands.every((h) => h.length === 8), "fresh deal");
    }
  }
  assert(g.match_over, "match over");
  assert(
    Math.max(g.match_scores[0], g.match_scores[1]) >= g.target,
    "winner reached target",
    g.match_scores,
  );
  assert(g.winner_team === (g.match_scores[0] > g.match_scores[1] ? 0 : 1), "winner team");
  // serialization round-trip mid/end state
  const doc = g.toDoc();
  const g2 = BeloteEngine.fromDoc(doc);
  assert(
    JSON.stringify(g2.stateFor(0)) === JSON.stringify(g.stateFor(0)),
    "toDoc/fromDoc round trip preserves state",
  );
  stats.matches++;
}

// pause flow smoke test
{
  const g = new BeloteEngine("local_short_p", players(), "short", null);
  const evs = g.requestPause(0, []);
  assert(evs.some((e) => e.e === "paused"), "pause activates with no required seats");
  assert(g.stateFor(0).paused !== null, "state shows paused");
  g.resume(0);
  assert(g.paused === null, "resumed");
}

for (let i = 0; i < 60; i++) playMatch("short", i % 2 === 0);
for (let i = 0; i < 10; i++) playMatch("long", false);

console.log("ALL OK —", checks, "assertions");
console.log(stats);
