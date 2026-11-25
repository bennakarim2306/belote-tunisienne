#!/usr/bin/env node
// LOCAL-ONLY: shows the game-view windows that need an ONLINE game. The browser's
// WebSocket is replaced by a fake inside the page, which feeds the real game
// screen prepared states and events. No server, no account, no real player.
// Visual/interaction check of the client only: it does not test multiplayer.
//   node scripts/anime/smoke-online.js <baseUrl> <label> <outDir>
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
let failed = 0, total = 0;
const check = (n, ok, d = "") => { total++; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
fs.mkdirSync(outDir, { recursive: true });

const now = () => Date.now() / 1000;
const P = (seat, username, avatar_id, extra = {}) => ({ seat, user_id: seat === 0 ? "mock_user_1" : "u" + seat, username, avatar_id, is_bot: false, elo: 1000 + seat * 37, card_count: 6, missed: 0, ...extra });
const base = (over = {}) => ({
  game_id: "mock_game_1", phase: "playing", hand_number: 2, dealer: 1, turn: 0,
  players: [P(0, "demo_joueur", "av12"), P(1, "Slim", "av3"), P(2, "Zakia", "av2"), P(3, "Hichem", "av4", { is_bot: true })],
  my_seat: 0, hand: ["AS", "10S", "KH", "QH", "JD", "7C"], legal: ["AS", "10S"], trick: [{ seat: 3, card: "9S" }],
  last_trick: { winner_seat: 2, cards: [{ seat: 0, card: "8S" }, { seat: 1, card: "7S" }, { seat: 2, card: "JS" }, { seat: 3, card: "QS" }], points: 23 },
  trump: "H", contract: { seat: 1, team: 1, value: 110, suit: "H", capot: false, contre: false, surcontre: false },
  bids: [], match_scores: [120, 180], target: 500, match_type: "short", trick_counts: [1, 1], tricks_played: 2, can_contre: false, can_surcontre: false,
  belote: null, hand_result: null, ready_seats: [], hand_history: [], pause_req: null, paused: null, match_over: false, winner_team: null, cancelled: false,
  host_user_id: null, origin: "online", turn_deadline: now() + 40, turn_timeout: 45, elo_changes: null, ...over,
});

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("auth_token", JSON.stringify("mock-token")); } catch {}
    const Real = window.WebSocket;
    window.__sent = [];
    class Fake {
      constructor(url) { this.url = url; this.readyState = 0; window.__game = this; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); }, 30); }
      send(m) { window.__sent.push(m); }
      close() { this.readyState = 3; }
    }
    const Wrapped = function (url, proto) { return /\/api\/ws\/(game|sync)/.test(url) ? (/\/game\//.test(url) ? new Fake(url) : { close() {}, send() {} }) : new Real(url, proto); };
    Wrapped.OPEN = 1; Wrapped.CONNECTING = 0; Wrapped.CLOSED = 3; Wrapped.CLOSING = 2;
    window.WebSocket = Wrapped;
    window.__push = (state, events) => window.__game.onmessage({ data: JSON.stringify({ type: "update", state, events: events || [] }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const has = async (id) => (await page.locator(tid(id)).count()) > 0;
  const shot = (n) => page.screenshot({ path: path.join(outDir, `${label}-online-${n}.png`) });
  const push = async (over, events, wait = 450) => { await page.evaluate(([s, e]) => window.__push(s, e), [base(over), events]); await page.waitForTimeout(wait); };

  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(tid("resume-game-button")).waitFor({ timeout: 120000 });
  await page.waitForTimeout(800);
  await page.locator(tid("resume-game-button")).click();
  await page.locator(tid("game-loading")).waitFor({ timeout: 15000 }).catch(() => {});
  await shot("loading");
  await page.waitForFunction(() => window.__game && window.__game.readyState === 1, null, { timeout: 15000 });
  await push({}, [], 1200);
  if (await has("deal-animation")) await page.locator(tid("deal-animation")).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  check("game screen shows the prepared state", await has("seat-2"));
  await shot("table");

  for (const [name, ev, re] of [
    ["belote", { e: "belote", seat: 2, word: "belote" }, /Belote/],
    ["rebelote", { e: "belote", seat: 2, word: "rebelote" }, /Rebelote/],
    ["redeal", { e: "redeal" }, /nouvelle donne/],
    ["afk", { e: "afk_bot", seat: 1 }, /Slim/],
    ["pause-declined", { e: "pause_declined", seat: 1 }, /Pause/],
  ]) {
    await push({}, [ev]);
    const txt = await page.locator(tid("game-banner-text")).first().innerText().catch(() => "");
    check(`alert: ${name}`, re.test(txt), txt);
    await shot("alert-" + name);
    await page.waitForTimeout(2000);
  }

  await push({ pause_req: { seat: 1, required: [0, 2], accepts: [] } });
  check("pause request window", await has("pause-request-modal"));
  await shot("pause-request");
  await page.locator(tid("pause-accept-button")).click();
  check("accept is sent", (await page.evaluate(() => window.__sent.join(" "))).includes("pause_accept"));
  await push({ pause_req: { seat: 0, required: [1, 2], accepts: [] } }, [], 800);
  check("pause-sent pill", await has("pause-sent-pill"));
  await shot("pause-sent");
  await push({ paused: { seat: 1, until: now() + 170, reason: "request" } });
  check("pause overlay", await has("paused-overlay"));
  await shot("paused");
  await push({ paused: { seat: 1, until: now() + 100, reason: "disconnect" } });
  check("connection-lost overlay", await has("paused-overlay"));
  await shot("connection-lost");

  const afk = base().players; afk[0] = { ...afk[0], afk: true };
  await push({ players: afk });
  check("bot-replaced strip", await has("afk-resume-strip"));
  await shot("bot-replaced");

  await push({});
  await page.locator(tid("seat-avatar-2")).click();
  await page.waitForTimeout(900);
  check("player card", await has("player-card-modal"));
  await shot("player-card");
  await page.locator(tid("player-card-close")).click();
  await page.waitForTimeout(500);

  for (const [n, host] of [["guest", null], ["host", "mock_user_1"]]) {
    await push({ host_user_id: host, origin: host ? "private" : "online" });
    await page.locator(tid("quit-game-button")).click();
    await page.waitForTimeout(600);
    check(`quit confirmation (${n})`, (await has("quit-cancel-button")) && (await has("quit-confirm-button")));
    await shot("quit-" + n);
    await page.locator(tid("quit-cancel-button")).click();
    await page.waitForTimeout(600);
    check(`stay closes it (${n})`, !(await has("quit-cancel-button")));
  }

  const coachBase = { coach_mode: true, coach: { kind: "play", reason: "lead_master", card: "AS" } };
  await push(coachBase);
  console.log("note: coach bubble " + ((await has("coach-bubble")) ? "shown" : "NOT shown (hint key unknown here)"));
  await shot("coach");

  await push({ phase: "bidding", turn: 0, contract: null, trump: null, trick: [], last_trick: null, tricks_played: 0, legal: [], hand: ["AS", "10S", "KH", "QH", "JD", "7C", "8C", "9D"] }, [], 900);
  if (await has("bidding-panel")) {
    await page.locator(tid("bid-suit-S")).click();
    await page.locator(tid("bid-value-120")).click();
    await page.waitForTimeout(400);
    await shot("bidding");
    await page.locator(tid("bid-suit-H")).click();
    await page.waitForTimeout(300);
    await shot("bidding-hearts");
    await page.locator(tid("announce-bid-button")).click();
  }
  check("bid with the painted tiles is sent", (await page.evaluate(() => window.__sent.join(" "))).includes('"value":120,"suit":"H"'));
  await push({ phase: "bidding", turn: 1, contract: null, trump: null, trick: [], last_trick: null, tricks_played: 0, legal: [], hand: ["AS", "10S", "KH", "QH", "JD", "7C", "8C", "9D"] }, [], 600);
  if (await has("capot-float-button")) { await page.locator(tid("capot-float-button")).click(); await page.waitForTimeout(600); await shot("capot-dock"); }
  check("capot dock opens its suits", await has("capot-suit-S"));

  await push({ phase: "finished", cancelled: true });
  check("host-ended overlay", await has("cancelled-overlay"));
  await shot("host-ended");
  await push({ phase: "finished", match_over: true, winner_team: 0, match_scores: [510, 320], elo_changes: { mock_user_1: 18 } }, [], 1500);
  check("match end with ELO", (await has("match-end-overlay")) && (await has("elo-delta-badge")));
  await shot("match-end-elo");
  check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
