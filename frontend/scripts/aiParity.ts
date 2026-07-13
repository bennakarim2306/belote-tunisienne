// Compares TS bot AI decisions against the Python reference.
import * as fs from "fs";
import { botBiddingAction, botPlay } from "../src/game/ai";

const data = JSON.parse(fs.readFileSync("/tmp/ai_parity.json", "utf8"));
let bad = 0;
for (const p of data.plays) {
  const card = botPlay(p.hand, p.trick, p.trump, p.seat);
  if (card !== p.card) {
    bad++;
    console.error("PLAY MISMATCH", p, "ts:", card);
  }
}
for (const b of data.bids) {
  const act = botBiddingAction(b.hand, b.cb, b.seat);
  const py = b.act;
  const same =
    act.type === py.type &&
    (act.value ?? null) === (py.value ?? null) &&
    (act.suit ?? null) === (py.suit ?? null);
  if (!same) {
    bad++;
    console.error("BID MISMATCH", b, "ts:", act);
  }
}
if (bad) {
  console.error(bad, "mismatches");
  process.exit(1);
}
console.log("AI PARITY OK:", data.plays.length, "plays +", data.bids.length, "bids");
