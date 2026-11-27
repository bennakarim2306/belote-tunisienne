#!/usr/bin/env node
// LOCAL-ONLY: plays a whole solo match (500 points) on the offline engine and
// photographs every alert, the pause overlay, the end of a hand and the end of
// the match. Same setup as smoke-game.js.
//   node scripts/anime/smoke-match.js <baseUrl> <label> <outDir>
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
let failed = 0, total = 0;
const check = (name, ok, detail = "") => {
  total++; if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem("auth_token", JSON.stringify("mock-token")); localStorage.setItem("design_notice_1_4_0", "true"); } catch {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot({ path: path.join(outDir, `${label}-match-${n}.png`) });
  const has = async (id) => (await page.locator(tid(id)).count()) > 0;
  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
  await page.locator(tid("play-solo-card")).waitFor({ timeout: 180000 });
  await page.waitForTimeout(800);
  await page.locator(tid("play-solo-card")).click();
  await page.locator(tid("match-type-short")).click();
  await page.locator(tid("game-screen")).waitFor({ timeout: 30000 });

  const alerts = new Set();
  let hands = 0, paused = false, matchEnd = false, lastSig = "", cornerNote = false, lastChange = Date.now();
  const t0 = Date.now();
  while (Date.now() - t0 < 25 * 60000) {
    await page.waitForTimeout(220);
    // stall guard: nothing on screen changed for 60 s -> keep evidence and stop
    const sig = await page.locator(tid("game-screen")).innerText().catch(() => "");
    if (sig !== lastSig) { lastSig = sig; lastChange = Date.now(); }
    else if (Date.now() - lastChange > 60000) {
      await shot("stalled");
      console.log("STALLED: " + sig.replace(/\s+/g, " ").slice(0, 300));
      console.log("visible: " + (await page.locator("[data-testid]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-testid")))].join(" "))).slice(0, 700));
      break;
    }
    if (await has("match-end-overlay")) { matchEnd = true; break; }
    const banner = page.locator(tid("game-banner-text"));
    if (await banner.count()) {
      const text = (await banner.first().innerText().catch(() => "")).trim();
      if (text && !alerts.has(text)) {
        alerts.add(text);
        await page.waitForTimeout(330);
        await shot("alert-" + text.normalize("NFD").replace(/[^A-Za-z]+/g, "").slice(0, 18));
      }
    }
    if (await has("hand-end-modal")) {
      hands++;
      if (hands <= 3) { await page.waitForTimeout(600); await shot(`hand-end-${hands}`); }
      await page.locator(tid("hand-continue-button")).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      continue;
    }
    if (await has("deal-animation")) continue;
    if (!paused && (await has("your-turn-pill")) && (await has("pause-request-button"))) {
      paused = true;
      await page.locator(tid("pause-request-button")).click();
      await page.waitForTimeout(900);
      if (await has("paused-overlay")) {
        await shot("paused");
        check("pause overlay opens and resumes", true);
        await page.locator(tid("pause-resume-button")).click();
        await page.waitForTimeout(700);
        check("pause overlay closes", !(await has("paused-overlay")));
      } else check("pause overlay opens", false);
      continue;
    }
    if (await has("bidding-panel")) {
      // first hand: pass every time; later: bid sometimes so contracts vary
      if (hands % 2 === 1) {
        await page.locator(tid("bid-suit-H")).click({ timeout: 1500 }).catch(() => {});
        for (const v of [90, 100, 110]) {
          const el = page.locator(tid(`bid-value-${v}`));
          if ((await el.count()) && (await el.getAttribute("aria-disabled")) !== "true") { await el.click({ timeout: 1500 }).catch(() => {}); break; }
        }
        await page.locator(tid("announce-bid-button")).click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(250);
      }
      if (await has("bidding-panel")) await page.locator(tid("pass-button")).click({ timeout: 1500 }).catch(() => {});
      continue;
    }
    if (await has("surcontre-panel")) { await page.locator(tid("decline-surcontre-button")).click({ timeout: 1500 }).catch(() => {}); continue; }
    if (await has("your-turn-pill")) {
      const ids = await page.locator('[data-testid^="hand-card-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
      for (const id of ids) {
        // centre tap like smoke-game.js: in the tilted fan a corner tap can land on the neighbour
        await page.locator(tid(id)).click({ timeout: 1200 }).catch((e) => {
          const why = e.message.split("\n").find((l) => /intercepts/.test(l));
          if (why && !cornerNote) { cornerNote = true; console.log("note: a centre tap was covered: " + why.trim().slice(0, 160)); }
        });
        await page.waitForTimeout(160);
        const now = await page.locator('[data-testid^="hand-card-"]').count();
        if (now < ids.length) break;
      }
    }
  }
  check("match reached its end screen", matchEnd, `${hands} hands, ${Math.round((Date.now() - t0) / 1000)}s`);
  if (matchEnd) {
    await page.waitForTimeout(1300);
    await shot("end");
    check("result text shown", /Victoire|Défaite/.test(await page.locator(tid("match-result-text")).innerText()), await page.locator(tid("match-result-text")).innerText());
    check("replay and home buttons present", (await has("replay-button")) && (await has("back-home-button")));
    await page.locator(tid("back-home-button")).click();
    await page.waitForTimeout(1500);
    check("back home leaves the table", !/\/game\//.test(page.url()), page.url());
  }
  check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log("alerts seen: " + [...alerts].join(" / "));
  console.log(`\n${total - failed}/${total} checks passed (${label})`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
