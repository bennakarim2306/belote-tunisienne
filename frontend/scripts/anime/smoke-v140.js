#!/usr/bin/env node
// LOCAL-ONLY: checks for version 1.4.0: the one-time design message, and the
// windows whose list must scroll (score history, notifications).
//   node scripts/anime/smoke-v140.js <baseUrl> <anime|original> <outDir>
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
const anime = label === "anime";
let failed = 0, total = 0;
const check = (n, ok, d = "") => { total++; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); };
fs.mkdirSync(outDir, { recursive: true });
const HAND = (n) => ({ hand_number: n, contract: { value: 90 + (n % 8) * 10, suit: "SHDC"[n % 4], seat: n % 4, team: n % 2 }, success: n % 3 !== 0, hand_scores: [n * 10, 160 - n * 10], match_scores: [n * 80, n * 70] });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const open = async (vp, lang, seen, design) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    await ctx.addInitScript(([l, sn, d]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("auth_token", JSON.stringify("mock-token"));
      if (sn) localStorage.setItem("design_notice_1_4_0", "true");
      if (l) localStorage.setItem("lang", JSON.stringify(l));
      if (d) localStorage.setItem("design", JSON.stringify(d));
    }, [lang, seen, design]);
    const page = await ctx.newPage();
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.locator(tid("home-screen")).waitFor({ timeout: 120000 });
    await page.waitForTimeout(1600);
    const L = (id) => page.locator(tid(id)).first();
    const seenId = async (id) => (await page.locator(tid(id)).count()) > 0;
    const inView = async (id) => { const b = await L(id).boundingBox().catch(() => null); return !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1; };
    return { ctx, page, L, seenId, inView, shot: (n) => page.screenshot({ path: path.join(outDir, `${label}-v140-${n}-${vp.width}${lang ? "-" + lang : ""}.png`) }) };
  };
  const runs = anime ? [[{ width: 844, height: 390 }], [{ width: 640, height: 360 }], [{ width: 640, height: 360 }, "ar"], [{ width: 640, height: 360 }, "en"]] : [[{ width: 844, height: 390 }]];
  for (const [vp, lang] of runs) {
    const tag = `[${vp.width}${lang ? " " + lang : ""}]`;
    // one-time message
    const s = await open(vp, lang, false);
    if (anime) {
      await s.L("design-notice").waitFor({ timeout: 5000 }).catch(() => {});
      await s.shot("notice");
      check(`${tag} message shown on first start`, await s.seenId("design-notice"));
      check(`${tag} message and button in view`, (await s.inView("design-notice-ok")));
      await s.page.mouse.click(5, 5); await s.page.waitForTimeout(300);
      check(`${tag} tap outside does not skip it`, await s.seenId("design-notice"));
      await s.L("design-notice-ok").click(); await s.page.waitForTimeout(500);
      check(`${tag} button closes it and it is remembered`, !(await s.seenId("design-notice")) && (await s.page.evaluate(() => localStorage.getItem("design_notice_1_4_0"))) === "true");
      await s.page.reload({ waitUntil: "domcontentloaded" }); await s.L("home-screen").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(1800);
      check(`${tag} not shown again`, !(await s.seenId("design-notice")));
    } else {
      check(`${tag} original: no message`, !(await s.seenId("design-notice")));
    }
    // notifications: tap inside keeps it open, outside closes it
    await s.L("notifications-bell").click(); await s.L("notifications-panel").waitFor(); await s.page.waitForTimeout(700);
    const box = await s.L("notifications-panel").boundingBox();
    await s.page.mouse.click(box.x + box.width / 2, box.y + 30); await s.page.waitForTimeout(300);
    check(`${tag} tap inside notifications keeps them open`, await s.seenId("notifications-panel"));
    await s.page.mouse.click(4, vp.height / 2); await s.page.waitForTimeout(800);
    check(`${tag} tap outside closes notifications`, !(await s.seenId("notifications-panel")));
    check(`${tag} no page errors`, s.page.errors.length === 0, s.page.errors[0]);
    await s.ctx.close();
  }
  if (anime) {
    const s = await open({ width: 844, height: 390 }, null, false, "classic");
    check("old design by toggle: no message", !(await s.seenId("design-notice")));
    await s.ctx.close();
  }
  // score history: long list scrolls, tap inside keeps it, close works
  {
    const vp = { width: 844, height: 390 };
    const s = await open(vp, null, true);
    await s.L("play-solo-card").click(); await s.L("match-type-short").click(); await s.L("game-screen").waitFor({ timeout: 30000 });
    await s.page.waitForTimeout(2500);
    await s.page.evaluate((hands) => { const raw = localStorage.getItem("local_solo_game"); if (raw) { const g = JSON.parse(raw); g.doc.hand_history = hands; localStorage.setItem("local_solo_game", JSON.stringify(g)); } }, Array.from({ length: 14 }, (_, i) => HAND(i + 1)));
    await s.page.reload({ waitUntil: "domcontentloaded" }); await s.L("game-screen").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(3500);
    await s.L("match-score-header").click(); await s.L("score-history-modal").waitFor({ timeout: 5000 }); await s.page.waitForTimeout(600);
    const before = await s.L("score-history-scroll").evaluate((e) => { const sc = e.scrollHeight > e.clientHeight ? e : e.querySelector("div"); return { h: sc.scrollHeight, c: sc.clientHeight }; });
    const sb = await s.L("score-history-scroll").boundingBox();
    await s.page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await s.page.mouse.wheel(0, 600); await s.page.waitForTimeout(500);
    const top = await s.L("score-history-scroll").evaluate((e) => e.scrollTop || (e.querySelector("div") || e).scrollTop);
    await s.shot("history");
    check("score history: 14 hands make the list longer than the window", before.h > before.c, JSON.stringify(before));
    check("score history: the list scrolls", top > 0, `scrollTop ${top}`);
    await s.page.mouse.click(sb.x + sb.width / 2, sb.y + 20); await s.page.waitForTimeout(300);
    check("score history: tap inside keeps it open", await s.seenId("score-history-modal"));
    await s.L("score-history-close").click(); await s.page.waitForTimeout(600);
    check("score history: close button closes it", !(await s.seenId("score-history-modal")));
    check("game: no page errors", s.page.errors.length === 0, s.page.errors[0]);
    await s.ctx.close();
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
