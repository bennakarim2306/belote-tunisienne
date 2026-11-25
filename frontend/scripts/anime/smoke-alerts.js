#!/usr/bin/env node
// LOCAL-ONLY: forces the rare moments of a solo game and photographs them:
// Capot (announced by me), Contre + Sur-contre (a reckless 160 bid that bots
// contre) and Victoire (the SAVED demo game in the browser's storage is set to
// 490 points for us, then one hand is played). Same setup as smoke-game.js.
//   node scripts/anime/smoke-alerts.js <baseUrl> <label> <outDir>
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
let failed = 0, total = 0;
const check = (n, ok, d = "") => { total++; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
fs.mkdirSync(outDir, { recursive: true });

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem("auth_token", JSON.stringify("mock-token")); } catch {} });
  // every alert text is noted inside the page: polling from outside can miss one
  await ctx.addInitScript(() => {
    window.__alerts = new Set();
    const look = () => document.querySelectorAll('[data-testid="game-banner-text"]').forEach((e) => window.__alerts.add(e.textContent));
    new MutationObserver(look).observe(document, { childList: true, subtree: true, characterData: true });
  });
  const page = await ctx.newPage();
  const has = async (id) => (await page.locator(tid(id)).count()) > 0;
  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
  await page.locator(tid("play-solo-card")).waitFor({ timeout: 180000 });
  await page.waitForTimeout(800);
  return { ctx, page, has };
}
async function startSolo(page) {
  await page.locator(tid("play-solo-card")).click();
  await page.locator(tid("match-type-short")).click();
  await page.locator(tid("game-screen")).waitFor({ timeout: 30000 });
}
const shot = (page, n) => page.screenshot({ path: path.join(outDir, `${label}-force-${n}.png`) });
async function playTurn(page, has) {
  if (await has("surcontre-panel")) return void (await page.locator(tid("decline-surcontre-button")).click({ timeout: 1000 }).catch(() => {}));
  if (await has("bidding-panel")) return void (await page.locator(tid("pass-button")).click({ timeout: 1000 }).catch(() => {}));
  if (await has("your-turn-pill")) {
    const ids = await page.locator('[data-testid^="hand-card-"]').evaluateAll((e) => e.map((x) => x.getAttribute("data-testid")));
    for (const id of ids) {
      await page.locator(tid(id)).click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(160);
      if ((await page.locator('[data-testid^="hand-card-"]').count()) < ids.length) break;
    }
  }
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });

  // ---- Capot ----
  {
    const { ctx, page, has } = await open(browser);
    await startSolo(page);
    let ok = false;
    for (let i = 0; i < 200 && !ok; i++) {
      await page.waitForTimeout(200);
      if (!(await has("deal-animation")) && (await has("bidding-panel"))) {
        await page.locator(tid("bid-suit-S")).click();
        await page.locator(tid("capot-button")).first().click();
        await page.waitForTimeout(420);
        ok = /Capot/.test(await page.locator(tid("game-banner-text")).innerText().catch(() => ""));
        await shot(page, "capot");
        break;
      }
    }
    check("Capot alert", ok);
    await ctx.close();
  }

  // ---- Contre / Sur-contre ----
  {
    let contre = false, sur = false;
    for (let attempt = 0; attempt < 14 && !sur; attempt++) {
      const { ctx, page, has } = await open(browser);
      await startSolo(page);
      let bid = false;
      for (let i = 0; i < 130; i++) {
        await page.waitForTimeout(180);
        if (await has("deal-animation")) continue;
        if (!bid && (await has("bidding-panel"))) {
          await page.locator(tid("bid-suit-C")).click().catch(() => {});
          await page.locator(tid("bid-value-160")).click().catch(() => {});
          await page.locator(tid("announce-bid-button")).click().catch(() => {});
          bid = true;
          continue;
        }
        const txt = await page.locator(tid("game-banner-text")).first().innerText({ timeout: 100 }).catch(() => "");
        if (/^Contre/.test(txt) && !contre) { contre = true; await page.waitForTimeout(250); await shot(page, "contre"); }
        if (await has("surcontre-button")) {
          await shot(page, "surcontre-panel");
          await page.waitForTimeout(300);
          if (await page.evaluate(() => [...window.__alerts].some((t) => /^Contre/.test(t)))) { contre = true; await shot(page, "contre"); }
          await page.locator(tid("surcontre-button")).click();
          await page.waitForTimeout(420);
          sur = /Sur-contre/.test(await page.locator(tid("game-banner-text")).first().innerText().catch(() => ""));
          await shot(page, "surcontre");
          break;
        }
        if (bid && ((await has("your-turn-pill")) || (await has("trick-area")) && i > 110)) break;
      }
      await ctx.close();
    }
    check("Contre alert", contre);
    check("Sur-contre alert", sur);
  }

  // ---- Victoire ----
  {
    const { ctx, page, has } = await open(browser);
    await startSolo(page);
    for (let i = 0; i < 100 && ((await has("deal-animation")) || i < 12); i++) await page.waitForTimeout(250);
    await playTurn(page, has);
    await page.waitForTimeout(1200);
    await page.locator(tid("quit-game-button")).click();
    await page.waitForTimeout(1200);
    const patched = await page.evaluate(() => {
      const raw = localStorage.getItem("local_solo_game");
      if (!raw) return null;
      let hits = 0;
      const doc = JSON.parse(raw, (k, v) => (k === "match_scores" && Array.isArray(v) ? (hits++, [490, 0]) : v));
      localStorage.setItem("local_solo_game", JSON.stringify(doc));
      return hits;
    });
    check("saved demo game set to 490 points", !!patched, `fields ${patched}`);
    await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
    await page.locator(tid("resume-game-button")).waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.locator(tid("resume-game-button")).click();
    await page.locator(tid("game-screen")).waitFor({ timeout: 30000 });
    let end = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      await page.waitForTimeout(220);
      if (await has("match-end-overlay")) { end = true; break; }
      if (await has("hand-end-modal")) { await page.locator(tid("hand-continue-button")).click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(500); continue; }
      if (await has("deal-animation")) continue;
      await playTurn(page, has);
    }
    await page.waitForTimeout(1400);
    const res = end ? await page.locator(tid("match-result-text")).innerText() : "no end";
    check("Victoire screen", /Victoire/.test(res), res);
    await shot(page, "victory");
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
