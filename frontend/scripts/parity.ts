// Compares the TS engine helpers against reference outputs from the Python engine.
import * as fs from "fs";
import { cardPoints, legalMoves, roundScore, trickWinner } from "../src/game/engine";

const data = JSON.parse(fs.readFileSync("/tmp/parity_cases.json", "utf8"));
let bad = 0;
for (const c of data.cases) {
  const legal = [...legalMoves(c.hand, c.trick, c.trump, c.seat)].sort();
  if (JSON.stringify(legal) !== JSON.stringify(c.legal)) {
    bad++;
    console.error("LEGAL MISMATCH", c, "ts:", legal);
  }
  if (c.trick.length) {
    const w = trickWinner(c.trick, c.trump);
    if (w !== c.winner) {
      bad++;
      console.error("WINNER MISMATCH", c, "ts:", w);
    }
  }
  const pts = [...c.trick.map((t: { card: string }) => t.card), ...c.hand].reduce(
    (s: number, card: string) => s + cardPoints(card, c.trump),
    0,
  );
  if (pts !== c.pts) {
    bad++;
    console.error("POINTS MISMATCH", c, "ts:", pts);
  }
}
for (const r of data.rounds) {
  if (roundScore(r.x) !== r.r) {
    bad++;
    console.error("ROUND MISMATCH", r, roundScore(r.x));
  }
}
if (bad) {
  console.error(bad, "mismatches");
  process.exit(1);
}
console.log("PARITY OK:", data.cases.length, "cases +", data.rounds.length, "round-score checks");
