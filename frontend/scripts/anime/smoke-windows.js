#!/usr/bin/env node
// LOCAL-ONLY: opens and uses every window reachable from home, with screenshots.
// Needs mock-backend.js started with MOCK_NOTIFS=1.
//   node scripts/anime/smoke-windows.js <baseUrl> <label> <outDir>
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
let failed = 0, total = 0;
const check = (n, ok, d = "") => { total++; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const vp of [{ width: 844, height: 390 }, { width: 640, height: 360 }]) {
    const tag = `${vp.width}`;
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { try { localStorage.setItem("auth_token", JSON.stringify("mock-token")); } catch {} });
    const page = await ctx.newPage();
    const errors = [], posts = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => { if (r.method() === "POST") posts.push(r.url().replace(/.*\/api/, "") + " " + (r.postData() || "")); });
    const L = (id) => page.locator(tid(id));
    const has = async (id) => (await L(id).count()) > 0;
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${label}-win-${n}-${tag}.png`) });
    const inView = async (id) => { const b = await L(id).boundingBox(); return !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1; };
    const close = async () => { await page.waitForTimeout(500); await page.mouse.click(4, vp.height / 2); await page.waitForTimeout(650); };
    const home = async () => { await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 180000 }); await L("home-grid").waitFor({ timeout: 120000 }); await page.waitForTimeout(1200); };
    await home();

    // private game
    await L("private-game-card").click(); await L("private-game-modal").waitFor(); await page.waitForTimeout(700);
    check(`[${tag}] private game: input, join and create visible`, (await inView("join-code-input")) && (await inView("join-room-button")) && (await inView("create-party-button")));
    await L("join-code-input").fill("demo42"); await page.waitForTimeout(200);
    check(`[${tag}] code is upper-cased`, (await L("join-code-input").inputValue()) === "DEMO42");
    await shot("private");
    await L("create-party-button").click(); await L("room-timer-toggle").waitFor(); await page.waitForTimeout(700);
    await shot("create");
    await L("room-timer-toggle").click(); await page.waitForTimeout(300); await shot("create-timer");
    check(`[${tag}] create: both match types visible`, (await inView("match-type-short")) && (await inView("match-type-long")));
    await L("match-type-long").click(); await page.waitForTimeout(900);
    check(`[${tag}] create sends long + timer`, posts.some((p) => p.startsWith("/rooms ") && p.includes('"match_type":"long"') && p.includes('"turn_timer":true')), posts.filter((p) => p.startsWith("/rooms")).join(" "));
    await home();

    // online: alone / duo
    await L("play-online-card").click(); await L("online-mode-duo").waitFor(); await page.waitForTimeout(700);
    await shot("online");
    check(`[${tag}] online: both match types visible`, (await inView("match-type-short")) && (await inView("match-type-long")));
    await L("online-mode-duo").click(); await L("duo-setup").waitFor(); await page.waitForTimeout(900);
    const n0 = posts.length;
    await L("match-type-short").scrollIntoViewIfNeeded(); await L("match-type-short").click(); await page.waitForTimeout(500);
    check(`[${tag}] duo without partner starts nothing`, posts.length === n0 && (await has("duo-setup")));
    await L("duo-search-input").scrollIntoViewIfNeeded();
    await shot("duo");
    check(`[${tag}] duo: candidates listed`, (await has("duo-candidate-Zakia")) && (await has("duo-candidate-Zohra")));
    await L("duo-search-input").fill("zo"); await page.waitForTimeout(300); await shot("duo-search");
    check(`[${tag}] search filters by name`, (await has("duo-candidate-Zohra")) && !(await has("duo-candidate-Zakia")));
    await L("duo-search-input").fill(""); await page.waitForTimeout(200);
    await L("duo-online-filter").click(); await page.waitForTimeout(300);
    check(`[${tag}] online filter hides offline players`, !(await has("duo-candidate-Mongi")));
    await L("duo-candidate-Zakia").click(); await page.waitForTimeout(300); await shot("duo-selected");
    await L("match-type-short").scrollIntoViewIfNeeded(); await L("match-type-short").click(); await page.waitForTimeout(900);
    check(`[${tag}] duo invite sent`, posts.some((p) => p.includes("/matchmaking/duo/invite") && p.includes('"to_user_id":"u2"')));
    await home();

    // solo
    await L("play-solo-card").click(); await L("match-type-long").waitFor(); await page.waitForTimeout(600);
    await close();
    check(`[${tag}] tap outside closes the window`, !(await has("match-type-long")));

    // notifications
    await L("notifications-bell").click(); await L("notifications-panel").waitFor(); await page.waitForTimeout(800);
    await shot("notifications");
    check(`[${tag}] three notifications listed`, (await has("notif-invite-DEMO42")) && (await has("notif-duo-d1")) && (await has("notif-friend-Fatma_demo")));
    await L("notif-friend-accept-Fatma_demo").scrollIntoViewIfNeeded(); await L("notif-friend-accept-Fatma_demo").click(); await page.waitForTimeout(500);
    check(`[${tag}] friend accept sent`, posts.some((p) => p.includes("/friends/respond") && p.includes('"accept":true')));
    await L("notif-duo-decline-d1").scrollIntoViewIfNeeded(); await L("notif-duo-decline-d1").click(); await page.waitForTimeout(400);
    check(`[${tag}] duo decline sent`, posts.some((p) => p.includes("/matchmaking/duo/d1/decline")));
    await close();

    // side menu
    await L("menu-button").click(); await L("side-menu").waitFor(); await page.waitForTimeout(700);
    await shot("menu");
    check(`[${tag}] side menu: all four entries visible`, (await inView("menu-item-home")) && (await inView("menu-item-leaderboard")) && (await inView("menu-item-friends")) && (await inView("menu-item-profile")));
    await L("menu-item-friends").click(); await page.waitForURL(/\/friends/, { timeout: 8000 }).catch(() => {});
    check(`[${tag}] side menu navigates`, /\/friends/.test(page.url()));
    check(`[${tag}] no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
