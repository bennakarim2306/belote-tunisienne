#!/usr/bin/env node
// LOCAL-ONLY: lesson list and lesson pages, every state, with checks of what is
// stored and sent.   node scripts/anime/smoke-tutorial.js <baseUrl> <anime|original> <outDir>
// DESIGN=classic stores the old design first (build flag on).
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
const anime = label === "anime";
let failed = 0, total = 0;
const check = (n, ok, d = "") => { total++; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); };
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const open = async (vp, url, progress, lang) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    await ctx.addInitScript(([design, l, pr]) => {
      if (sessionStorage.getItem("seeded")) return; // keep what the app stores across reloads
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("auth_token", JSON.stringify("mock-token")); localStorage.setItem("design_notice_1_4_0", "true");
      localStorage.setItem("tutorial_progress", String(pr));
      if (design) localStorage.setItem("design", JSON.stringify(design));
      if (l) localStorage.setItem("lang", JSON.stringify(l));
    }, [process.env.DESIGN, lang, progress]);
    const page = await ctx.newPage();
    page.sent = []; page.errors = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    await page.route("**/api/tutorial/game", (r) => { page.sent.push("POST /tutorial/game"); return r.fulfill({ status: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
    await page.goto(baseUrl + url, { waitUntil: "domcontentloaded", timeout: 180000 });
    const L = (id) => page.locator(tid(id)).first();
    const inView = async (id) => { const b = await L(id).boundingBox().catch(() => null); return !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1; };
    const cut = (...ids) => page.evaluate((list) => list.flatMap((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].flatMap((e) => [e, ...e.querySelectorAll("*")]).filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).map((e) => e.textContent)).join(" | "), ids);
    const stored = () => page.evaluate(() => localStorage.getItem("tutorial_progress"));
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${label}-tutorial-${n}-${vp.width}${lang ? "-" + lang : ""}.png`) });
    return { ctx, page, L, inView, cut, stored, shot };
  };
  const runs = [[{ width: 844, height: 390 }], [{ width: 640, height: 360 }], ...(anime ? [[{ width: 915, height: 412 }], [{ width: 640, height: 360 }, "ar"], [{ width: 640, height: 360 }, "en"]] : [])];
  for (const [vp, lang] of runs) {
    const tag = `[${vp.width}${lang ? " " + lang : ""}]`;
    { // fresh: only lesson 1 open
      const s = await open(vp, "/tutorial", 0, lang);
      await s.L("lesson-row-0").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(800); await s.shot("start");
      check(`${tag} start: back, progress and first lesson in view`, (await s.inView("tutorial-back")) && (await s.inView("tutorial-progress-text")) && (await s.inView("lesson-row-0")));
      if (anime) { const c = await s.cut("tutorial-progress-text", "lesson-row-0", "lesson-row-1"); check(`${tag} start: no text cut off`, c === "", c); }
      await s.L("lesson-row-1").click({ force: true }).catch(() => {}); await s.page.waitForTimeout(500);
      check(`${tag} start: lesson 2 locked`, new URL(s.page.url()).pathname.endsWith("/tutorial"), s.page.url());
      await s.L("final-game-row").scrollIntoViewIfNeeded(); await s.page.waitForTimeout(300); await s.shot("start-end");
      await s.L("final-game-row").click({ force: true }).catch(() => {}); await s.page.waitForTimeout(400);
      check(`${tag} start: final game locked`, !s.page.sent.length);
      await s.L("lesson-row-0").scrollIntoViewIfNeeded(); await s.L("lesson-row-0").click(); await s.L("lesson-title").waitFor({ timeout: 20000 }); await s.page.waitForTimeout(700); await s.shot("lesson1");
      check(`${tag} lesson: back, listen, title, OK in view`, (await s.inView("lesson-back")) && (await s.inView("listen-button")) && (await s.inView("lesson-title")) && (await s.inView("lesson-ok-button")));
      if (anime) { const c = await s.cut("listen-button", "lesson-ok-button", "lesson-title"); check(`${tag} lesson: no label cut off`, c === "", c); }
      const before = await s.L("listen-button").innerText();
      await s.L("listen-button").click(); await s.page.waitForTimeout(150);
      const during = await s.L("listen-button").innerText();
      check(`${tag} listen switches to stop`, during !== before, `${before} -> ${during}`);
      await s.page.waitForTimeout(300); await s.shot("listening");
      if (during !== before) { await s.L("listen-button").click(); await s.page.waitForTimeout(200); }
      check(`${tag} stop switches back`, (await s.L("listen-button").innerText()) === before);
      await s.L("lesson-ok-button").click(); await s.page.waitForTimeout(900);
      check(`${tag} OK stores progress 1 and opens lesson 2`, (await s.stored()) === "1" && /\/tutorial\/1/.test(s.page.url()), `${await s.stored()} ${s.page.url()}`);
      await s.L("lesson-back").click(); await s.L("lesson-row-0").waitFor({ timeout: 20000 }); await s.page.waitForTimeout(600);
      check(`${tag} back: list shows 1 done`, /1\s*\/\s*14|1\D+14/.test(await s.L("tutorial-progress-text").innerText()));
      check(`${tag} no page errors`, s.page.errors.length === 0, s.page.errors[0]);
      await s.ctx.close();
    }
    { // a lesson with a tip, Arabic aligned to the right
      const s = await open(vp, "/tutorial/2", 14, lang);
      await s.L("lesson-tip").waitFor({ timeout: 60000 }); await s.L("lesson-tip").scrollIntoViewIfNeeded(); await s.page.waitForTimeout(500); await s.shot("tip");
      check(`${tag} tip readable above OK`, await s.inView("lesson-tip"));
      if (lang === "ar") check(`${tag} Arabic text aligned right`, await s.page.evaluate(() => [...document.querySelectorAll('[data-testid="lesson-tip"] *')].some((e) => getComputedStyle(e).textAlign === "right")));
      await s.ctx.close();
    }
    { // locked lesson by link goes back to the list
      const s = await open(vp, "/tutorial/9", 3, lang);
      await s.L("lesson-row-0").waitFor({ timeout: 60000 });
      check(`${tag} locked lesson by link returns to the list`, /\/tutorial$/.test(new URL(s.page.url()).pathname));
      await s.ctx.close();
    }
    { // all done
      const s = await open(vp, "/tutorial", 14, lang);
      await s.L("lesson-row-13").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(500); await s.shot("done");
      await s.L("final-game-row").scrollIntoViewIfNeeded(); await s.page.waitForTimeout(400); await s.shot("done-end");
      if (anime) { const c = await s.cut("final-game-row", "lesson-row-13"); check(`${tag} done: no text cut off`, c === "", c); }
      await s.L("final-game-row").click(); await s.page.waitForTimeout(700);
      check(`${tag} done: final game starts`, s.page.sent.includes("POST /tutorial/game"));
      await s.L("lesson-row-13").click(); await s.L("lesson-title").waitFor({ timeout: 20000 });
      await s.L("lesson-ok-button").click(); await s.page.waitForTimeout(900);
      check(`${tag} last lesson OK returns to the list, progress kept`, (await s.stored()) === "14" && /\/tutorial$/.test(new URL(s.page.url()).pathname));
      await s.ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label}${process.env.DESIGN ? ", " + process.env.DESIGN : ""})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
