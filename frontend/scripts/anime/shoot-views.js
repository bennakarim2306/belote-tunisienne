#!/usr/bin/env node
// LOCAL-ONLY: photographs every view outside home and the game table, in every
// state, with made-up server answers (nothing reaches a real server).
//   node scripts/anime/shoot-views.js <baseUrl> <outDir> [width height]
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", outDir = "./views", W = "844", H = "390"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
fs.mkdirSync(outDir, { recursive: true });

const p = (i, username, extra = {}) => ({ user_id: "u" + i, username, avatar_id: "av" + i, elo: 1000 + i * 21, elo_duo: 990 + i * 17, games_played: 10 + i, wins: i, ...extra });
const FRIENDS = { friends: [p(2, "Zakia", { online: true }), p(6, "Mongi"), p(9, "Zohra", { online: true })], pending_received: [p(5, "Fatma", { friendship_id: "f1" })] };
const ROOM = (host) => ({ code: "DEMO42", host_id: host, match_type: "short", turn_timer: true, started: false, game_id: null, players: [],
  seats: [{ user_id: "mock_user_1", username: "demo_joueur", avatar_id: "av12" }, { user_id: "u2", username: "Zakia", avatar_id: "av2" }, null, null] });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  let n = 0;
  const failed = [];
  const view = async (name, { url, api = {}, token = true, storage = {} }, act) => {
    const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
    await ctx.addInitScript(([tok, st]) => {
      if (tok) localStorage.setItem("auth_token", JSON.stringify("mock-token"));
      for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v);
    }, [token, storage]);
    const page = await ctx.newPage();
    await page.route("**/api/**", async (r) => {
      const u = new URL(r.request().url()).pathname.replace("/api", "");
      const key = r.request().method() + " " + u;
      if (!(key in api)) return r.fallback();
      const v = api[key];
      if (v === "hang") return;
      const body = typeof v === "function" ? v() : v;
      return r.fulfill({ status: body && body.__status ? body.__status : 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, contentType: "application/json", body: JSON.stringify(body) });
    });
    const L = (id) => page.locator(tid(id)).first();
    const snap = async (s) => { await page.waitForTimeout(700); n++; await page.screenshot({ path: path.join(outDir, `${name}-${s}.png`) }); };
    try {
      await page.goto(baseUrl + url, { waitUntil: "domcontentloaded", timeout: 180000 });
      await act({ page, L, snap });
    } catch (e) {
      failed.push(name + ": " + String(e).split("\n")[0]);
      await page.screenshot({ path: path.join(outDir, `ERROR-${name}.png`) }).catch(() => {});
    }
    await ctx.close();
  };
  const ready = (L, id) => L(id).waitFor({ timeout: 60000 });

  // A  entry
  await view("A1-start", { url: "/", api: { "GET /auth/me": "hang" } }, async ({ L, snap }) => { await ready(L, "splash-loading"); await snap("loading"); });
  await view("A2-auth", { url: "/auth", token: false, api: { "POST /auth/login": { __status: 401, detail: "invalid_credentials" } } }, async ({ L, snap }) => {
    await ready(L, "auth-login-tab"); await snap("login");
    await L("auth-email-input").fill("demo@example.test"); await L("auth-password-input").fill("wrong-demo"); await L("auth-submit-button").click(); await snap("error");
    await L("auth-register-tab").click(); await snap("register");
  });

  // B  matchmaking
  const mm = (status) => ({ "GET /matchmaking/status": status, "POST /matchmaking/join": {}, "POST /matchmaking/confirm": {} });
  await view("B1-search", { url: "/matchmaking?type=short", api: mm({ status: "waiting", players: [], elo_range: 100 }) }, async ({ L, snap }) => { await ready(L, "matchmaking-slots"); await snap("empty"); });
  await view("B2-search", { url: "/matchmaking?type=short", api: mm({ status: "waiting", players: [p(2, "Zakia"), p(6, "Mongi")], elo_range: 150 }) }, async ({ L, snap }) => { await ready(L, "matchmaking-slots"); await snap("two-found"); await L("invite-friends-button").click(); await snap("share"); });
  await view("B3-confirm", { url: "/matchmaking?type=short", api: mm({ status: "confirm", remaining: 25, accepted: 1, total: 4, me_accepted: false, players: [p(2, "Zakia"), p(6, "Mongi"), p(9, "Zohra")] }) }, async ({ L, snap }) => { await ready(L, "matchmaking-accept-button"); await snap("accept"); });
  await view("B4-confirm", { url: "/matchmaking?type=short", api: mm({ status: "confirm", remaining: 25, accepted: 3, total: 4, me_accepted: true, players: [p(2, "Zakia"), p(6, "Mongi"), p(9, "Zohra")] }) }, async ({ L, snap }) => { await ready(L, "matchmaking-confirm-wait"); await snap("waiting-others"); });
  await view("B5-duo", { url: "/matchmaking?type=short&duo=1&mode=online", api: mm({ status: "duo_pending", partner: p(2, "Zakia") }) }, async ({ L, snap }) => { await ready(L, "matchmaking-duo-partner"); await snap("partner-pending"); });
  await view("B6-duo", { url: "/matchmaking?type=short&duo=1&mode=online", api: mm({ status: "waiting", players: [], elo_range: 100, duo: { partner: p(2, "Zakia") } }) }, async ({ L, snap }) => { await ready(L, "duo-mode-chip"); await snap("duo-search"); });
  await view("B7-duo", { url: "/matchmaking?type=short&duo=1&mode=online", api: mm({ status: "duo_declined" }) }, async ({ L, snap }) => { await ready(L, "duo-end-message"); await snap("declined"); });
  await view("B8-found", { url: "/matchmaking?type=short", api: mm({ status: "removed_confirm" }) }, async ({ L, snap }) => { await ready(L, "matchmaking-warn"); await snap("warning"); });

  // C  private room
  const room = (host, extra = {}) => ({ "GET /rooms/DEMO42": ROOM(host), "GET /friends": FRIENDS, "POST /rooms/DEMO42/invite": {}, ...extra });
  await view("C1-room", { url: "/room/DEMO42", api: room("mock_user_1") }, async ({ page, L, snap }) => {
    await ready(L, "start-game-button"); await snap("host");
    await L("room-seat-2").click(); await snap("seat-choice");
    await L("seat-invite-button").click(); await page.waitForTimeout(500); await L("invite-send-Zakia").click(); await snap("invite-friends");
  });
  await view("C2-room", { url: "/room/DEMO42", api: room("u2") }, async ({ L, snap }) => { await ready(L, "room-seat-2"); await snap("guest"); await L("share-code-button").click(); await snap("share"); });
  await view("C3-room", { url: "/room/DEMO42", api: { "GET /rooms/DEMO42": { __status: 404, detail: "gone" } } }, async ({ L, snap }) => { await ready(L, "room-screen"); await snap("closed"); });
  await view("C4-join", { url: "/join/DEMO42", api: { "POST /rooms/DEMO42/join": "hang" } }, async ({ L, snap }) => { await ready(L, "join-screen"); await snap("joining"); });
  await view("C5-join", { url: "/join/DEMO42", api: { "POST /rooms/DEMO42/join": { __status: 404, detail: "gone" } } }, async ({ L, snap }) => { await ready(L, "join-error"); await snap("closed"); });

  // D  tutorial
  for (const [tag, k] of [["start", "0"], ["middle", "5"], ["done", "14"]])
    await view("D1-lessons", { url: "/tutorial", storage: { tutorial_progress: k } }, async ({ page, L, snap }) => {
      await ready(L, "lesson-row-0"); await snap(tag);
      if (k !== "0") { await page.locator(tid("final-game-row")).scrollIntoViewIfNeeded(); await snap(tag + "-end"); }
    });
  await view("D2-lesson", { url: "/tutorial/2", storage: { tutorial_progress: "14" } }, async ({ page, L, snap }) => {
    await ready(L, "lesson-title"); await snap("top");
    if (await page.locator(tid("lesson-tip")).count()) { await page.locator(tid("lesson-tip")).scrollIntoViewIfNeeded(); await snap("tip"); }
  });

  // E  ranking
  const lb = { "GET /leaderboard": { players: [p(2, "Zakia"), p(6, "Mongi"), p(9, "Zohra"), { ...p(12, "demo_joueur"), user_id: "mock_user_1" }, p(3, "Slim"), p(8, "Hamma")], my_rank: 4 } };
  await view("E1-ranking", { url: "/leaderboard", api: lb }, async ({ L, snap }) => { await ready(L, "leaderboard-row-1"); await snap("solo"); await L("lb-mode-duo").click(); await snap("duo"); });
  await view("E2-ranking", { url: "/leaderboard", api: { "GET /leaderboard": { players: [], my_rank: null } } }, async ({ L, snap }) => { await ready(L, "my-rank-card"); await snap("empty"); });

  // F  friends
  const fr = { "GET /friends": FRIENDS, "GET /users/search": { results: [p(3, "Slim", { friend_status: "none" }), p(4, "Slimane", { friend_status: "pending_sent" }), p(7, "Salima", { friend_status: "friends" })] }, "POST /friends/request": {} };
  await view("F1-friends", { url: "/friends", api: fr }, async ({ page, L, snap }) => {
    await ready(L, "friend-row-Zakia"); await snap("list");
    await page.locator(tid("invite-game-Zakia")).scrollIntoViewIfNeeded(); await L("invite-game-Zakia").click(); await snap("invite-window");
  });
  await view("F2-friends", { url: "/friends", api: fr }, async ({ page, L, snap }) => {
    await ready(L, "friend-search-input"); await L("friend-search-input").fill("sli"); await page.waitForTimeout(900); await snap("search");
    await L("add-friend-Slim").click(); await snap("sent");
  });
  await view("F3-friends", { url: "/friends", api: { "GET /friends": { friends: [], pending_received: [] } } }, async ({ L, snap }) => { await ready(L, "friends-empty-state"); await snap("empty"); });

  // G  profile
  const me = { "GET /users/me/stats": { rank: 4, win_rate: 58 }, "POST /feedback": {},
    "GET /auth/me": { user_id: "mock_user_1", email: "demo@example.test", username: "demo_joueur", avatar_id: "av12", elo: 1063, elo_duo: 1010, games_played: 12, wins: 7, losses: 5,
      stats: { contracts_taken: 9, contracts_made: 6, belotes: 3, capots: 1, best_streak: 4 }, elo_history: [1000, 1012, 1003, 1021, 1040, 1032, 1063].map((elo) => ({ elo })), auth_provider: "mock" } };
  await view("G1-profile", { url: "/profile", api: me }, async ({ page, L, snap }) => {
    await ready(L, "profile-username"); await snap("top");
    await L("toggle-avatars").click(); await snap("avatars"); await L("toggle-avatars").click();
    await L("toggle-stats").click(); await page.waitForTimeout(400); await page.locator(tid("stats-grid")).scrollIntoViewIfNeeded(); await snap("stats");
    if (await page.locator(tid("elo-chart")).count()) { await page.locator(tid("elo-chart")).scrollIntoViewIfNeeded(); await snap("chart"); }
    await L("toggle-stats").scrollIntoViewIfNeeded(); await L("toggle-stats").click();
    await page.locator(tid("sound-toggle")).scrollIntoViewIfNeeded(); await snap("settings");
    await page.locator(tid("app-version-text")).scrollIntoViewIfNeeded(); await snap("bottom");
    await L("delete-account-button").click(); await snap("delete-window"); await L("delete-cancel-button").click(); await page.waitForTimeout(500);
    await L("feedback-entry").scrollIntoViewIfNeeded(); await L("feedback-entry").click(); await snap("feedback");
    await L("mood-love").click(); await L("feedback-send-button").click(); await snap("feedback-thanks");
  });
  await browser.close();
  console.log(`${n} pictures, ${failed.length} views failed`);
  failed.forEach((f) => console.log("  " + f));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("SHOOT ERROR", e); process.exit(2); });
