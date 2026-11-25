#!/usr/bin/env node
// LOCAL-ONLY: starts several offline games and checks the bots' identities.
//   node scripts/anime/smoke-bots.js <baseUrl> <anime|original> <outDir>
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
const GAMES = 12;

// the catalogue is read from the app's own source, not copied here
const src = fs.readFileSync(path.join(__dirname, "../../src/avatars.ts"), "utf8");
const NAME = Object.fromEntries([...src.matchAll(/id: "(av\d+)", name: "[^"]+", seed: "([^"]+)"/g)].map((m) => [m[1], m[2]]));

let failed = 0, total = 0;
const check = (n, ok, d = "") => { total++; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); };
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const games = [], errors = [], cut = new Set(), shownWrong = [];
  for (let i = 0; i < GAMES; i++) {
    const ctx = await browser.newContext({ viewport: { width: i % 2 ? 640 : 844, height: i % 2 ? 360 : 390 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { try { localStorage.setItem("auth_token", JSON.stringify("mock-token")); } catch {} });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.locator(tid("play-solo-card")).waitFor({ timeout: 120000 });
    await page.waitForTimeout(600);
    await page.locator(tid("play-solo-card")).click();
    await page.locator(tid("match-type-short")).click();
    await page.locator(tid("game-screen")).waitFor({ timeout: 30000 });
    await page.waitForTimeout(900);
    const players = await page.evaluate(() => {
      const raw = localStorage.getItem("local_solo_game");
      return raw ? JSON.parse(raw).doc.players : null;
    });
    if (!players) { check(`game ${i + 1}: saved game found`, false); await ctx.close(); continue; }
    games.push(players);
    for (const b of players.filter((p) => p.is_bot)) {
      const boxes = await page.getByText(b.username, { exact: true }).evaluateAll((els) => els.map((e) => [e.scrollWidth, e.clientWidth]));
      if (!boxes.length) shownWrong.push(b.username);
      if (boxes.some(([s, c]) => c > 0 && s > c + 1)) cut.add(b.username);
    }
    if (i < 2) await page.screenshot({ path: path.join(outDir, `${label}-bots-${i + 1}.png`) });
    await ctx.close();
  }
  await browser.close();
  const bots = games.flatMap((g) => g.filter((p) => p.is_bot));
  console.log(games.map((g) => g.map((p) => `${p.username}(${p.avatar_id})`).join(" ")).join("\n"));
  check(`${GAMES} games started, 3 bots each`, games.length === GAMES && bots.length === GAMES * 3);
  check("three different names in every game", games.every((g) => new Set(g.map((p) => p.username)).size === 4));
  check("bot names are shown on the table", shownWrong.length === 0, shownWrong.join(" "));
  check("no name is cut off", cut.size === 0, [...cut].join(" "));
  if (label === "anime") {
    check("every bot has its character's name", bots.every((b) => NAME[b.avatar_id] === b.username));
    check("three different characters, never the player's own", games.every((g) => new Set(g.map((p) => p.avatar_id)).size === 4));
    check("seen characters vary between games", new Set(bots.map((b) => b.avatar_id)).size >= 8, `${new Set(bots.map((b) => b.avatar_id)).size} of 11`);
  }
  check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log(`\n${total - failed}/${total} checks passed (${label})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
