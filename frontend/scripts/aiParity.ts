// Compares TS bot AI decisions against the Python reference (realistic
// decision trail recorded over full simulated hands).
import * as fs from "fs";
import { botBiddingAction, botPlay, shouldSurcontre } from "../src/game/ai";

const data = JSON.parse(fs.readFileSync("/tmp/ai_parity.json", "utf8"));
let bad = 0;
for (const p of data.plays) {
  const card = botPlay(p.hand, p.trick, p.trump, p.seat, p.history, p.bid_team);
  if (card !== p.out) {
    bad++;
    if (bad <= 5) console.error("PLAY MISMATCH", JSON.stringify(p), "ts:", card);
  }
}
for (const b of data.bids) {
  const act = botBiddingAction(b.hand, b.cb, b.seat, b.bids);
  const py = b.act;
  const same =
    act.type === py.type &&
    (act.value ?? null) === (py.value ?? null) &&
    (act.suit ?? null) === (py.suit ?? null);
  if (!same) {
    bad++;
    if (bad <= 5) console.error("BID MISMATCH", JSON.stringify(b), "ts:", JSON.stringify(act));
  }
}
for (const s of data.surs) {
  if (shouldSurcontre(s.hand, s.suit) !== s.out) {
    bad++;
    console.error("SURCONTRE MISMATCH", JSON.stringify(s));
  }
}
if (bad) {
  console.error(bad, "mismatches");
  process.exit(1);
}
console.log(
  "AI PARITY OK:",
  data.plays.length, "plays +",
  data.bids.length, "bids +",
  data.surs.length, "surcontres",
);
