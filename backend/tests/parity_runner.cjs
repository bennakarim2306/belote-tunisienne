// Parity runner: executes the SAME bot scenarios on the TypeScript engine
// (frontend/src/game/ai.ts) and prints the decisions as JSON, so the Python
// test can assert both engines take identical decisions on identical deals.
// Usage: node parity_runner.cjs <scenarios.json>
const fs = require("fs");
const path = require("path");
const { transform } = require("/app/frontend/node_modules/sucrase");

require.extensions[".ts"] = (m, filename) => {
  const src = fs.readFileSync(filename, "utf8");
  const { code } = transform(src, {
    transforms: ["typescript", "imports"],
    disableESTransforms: true,
  });
  m._compile(code, filename);
};
// useGameSocket.ts imports react etc. — ai.ts only type-imports it (stripped)
const ai = require("/app/frontend/src/game/ai.ts");

const scenarios = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = {};
for (const [name, sc] of Object.entries(scenarios)) {
  const mem = ai.buildMemory(sc.history || [], sc.trick || [], sc.trump);
  const res = {};
  res.play = ai.botPlay(
    sc.hand,
    sc.trick || [],
    sc.trump,
    sc.seat,
    sc.history || [],
    sc.bid_team === undefined ? null : sc.bid_team,
    sc.bids || null,
  );
  res.partner_strength = ai.partnerStrength(sc.bids || null, sc.seat, sc.trump, sc.hand, mem);
  res.capot = ai.capotPotential(sc.hand, mem, sc.trump, sc.seat, sc.bids || null, sc.history || []);
  res.sure = {};
  for (const c of sc.hand) {
    res.sure[c] = [
      ai.isMaster(c, sc.hand, mem, sc.trump),
      ai.isSureMaster(c, sc.hand, mem, sc.trump, sc.seat),
    ];
  }
  res.trumps_left = ai.trumpsLeft(mem, sc.hand, sc.trump);
  res.control = ai.teamTrumpControl(sc.hand, mem, sc.trump, sc.seat, sc.bids || null);
  out[name] = res;
}
process.stdout.write(JSON.stringify(out));
