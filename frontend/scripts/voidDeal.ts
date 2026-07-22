// Quick checks for the void-deal rule (7+ cards of one suit) in the TS engine.
import { BeloteEngine, sevenOfASuit } from "../src/game/engine";

let bad = 0;
const chk = (cond: boolean, msg: string) => {
  if (!cond) {
    bad++;
    console.error("FAIL:", msg);
  }
};

chk(sevenOfASuit(["7H", "8H", "9H", "10H", "JH", "QH", "KH", "7C"]), "7 hearts detected");
chk(sevenOfASuit(["7S", "8S", "9S", "10S", "JS", "QS", "KS", "AS"]), "8 spades detected");
chk(!sevenOfASuit(["7H", "8H", "9H", "10H", "JH", "QH", "7C", "8C"]), "6 hearts is fine");

// statistical: many fresh deals never contain a void hand
const players = [0, 1, 2, 3].map((i) => ({
  user_id: `u${i}`, username: `P${i}`, avatar_id: 0, is_bot: true, elo: 1000,
}));
for (let k = 0; k < 3000; k++) {
  const g = new BeloteEngine(`t${k}`, players as any, "short", null);
  const hands: string[][] = (g as any).hands;
  chk(!hands.some(sevenOfASuit), `deal ${k} contains a void hand`);
}

if (bad) {
  console.error(`${bad} failures`);
  process.exit(1);
}
console.log("VOID-DEAL RULE OK (helper + 3000 deals)");
