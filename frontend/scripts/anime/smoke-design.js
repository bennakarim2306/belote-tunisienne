#!/usr/bin/env node
// LOCAL-ONLY: the design switch in the profile (docs/ANIME_DESIGN_SWITCH_PLAN.md).
//   node scripts/anime/smoke-design.js <baseUrl> <anime|original> <outDir>
// "original" = build flag off: the toggle must not exist at all.
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
let failed = 0, total = 0;
const check = (n, ok, d = "") => { total++; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); };
fs.mkdirSync(outDir, { recursive: true });
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const open = async (vp, { net = "ok", design, breakStorage } = {}) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    await ctx.addInitScript(([d, broken]) => {
      try {
        localStorage.setItem("auth_token", JSON.stringify("mock-token"));
        if (d && !sessionStorage.getItem("seeded")) { localStorage.setItem("design", d); sessionStorage.setItem("seeded", "1"); }
      } catch {}
      if (broken) {
        const real = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (k === "design") throw new Error("full"); return real.call(this, k, v); };
      }
      // remembers whether a painted background was ever put on the page
      window.__painted = false;
      const look = () => { if (document.documentElement && /bg_arena/.test(document.documentElement.innerHTML)) window.__painted = true; };
      new MutationObserver(look).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style"] });
    }, [design, breakStorage]);
    const page = await ctx.newPage();
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    for (const glob of ["**://api.dicebear.com/**", "**://images.pexels.com/**"]) {
      await page.route(glob, (r) => net === "ok" ? r.fulfill({ status: 200, contentType: "image/png", headers: { "Access-Control-Allow-Origin": "*" }, body: PIXEL }) : net === "off" ? r.abort() : undefined);
    }
    await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.locator(tid("play-solo-card")).waitFor({ timeout: 120000 });
    await page.waitForTimeout(800);
    return { ctx, page };
  };
  const painted = (page) => page.evaluate(() => {
    const home = document.querySelector('[data-testid="home-screen"]');
    return !!home && /bg_arena/.test(home.innerHTML);
  });
  const stored = (page) => page.evaluate(() => localStorage.getItem("design"));
  const toProfile = async (page) => {
    await page.locator(tid("menu-button") + ":visible").first().click();
    await page.locator(tid("menu-item-profile")).click();
    await page.locator(tid("profile-screen")).waitFor();
    await page.waitForTimeout(700);
  };
  const flip = async (page, shotName) => {
    const toggle = page.locator(tid("design-toggle"));
    await toggle.scrollIntoViewIfNeeded();
    const t0 = Date.now();
    await toggle.click();
    await page.locator(tid("design-switch-overlay")).waitFor({ timeout: 5000 });
    if (shotName) { await page.waitForTimeout(450); await page.screenshot({ path: path.join(outDir, `${label}-design-${shotName}.png`) }); }
    await page.locator(tid("design-switch-overlay")).waitFor({ state: "detached", timeout: 20000 });
    return Date.now() - t0;
  };

  if (label !== "anime") {
    const { ctx, page } = await open({ width: 844, height: 390 }, { design: '"emerald"' });
    check("flag off: original home even with a stored choice", !(await painted(page)));
    await toProfile(page);
    check("flag off: no toggle in the profile", (await page.locator(tid("design-toggle")).count()) === 0);
    check("flag off: sound toggle still there", (await page.locator(tid("sound-toggle")).count()) === 1);
    check("flag off: painted home never appeared", !(await page.evaluate(() => window.__painted)));
    check("no page errors", page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
    await ctx.close();
  } else {
    for (const vp of [{ width: 844, height: 390 }, { width: 640, height: 360 }]) {
      const tag = `[${vp.width}]`;
      const { ctx, page } = await open(vp);
      check(`${tag} first start: new design`, (await painted(page)) && (await stored(page)) === null);

      // a real offline game in the new design, left half-way
      await page.locator(tid("play-solo-card")).click();
      await page.locator(tid("match-type-short")).click();
      await page.locator(tid("game-screen")).waitFor({ timeout: 30000 });
      await page.waitForTimeout(2500);
      const save = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("local_solo_game")); return s && s.id + " " + s.doc.players.map((p) => p.username + p.avatar_id).join(","); });
      const before = await save();
      await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
      await page.locator(tid("play-solo-card")).waitFor({ timeout: 60000 });
      await page.waitForTimeout(800);

      await toProfile(page);
      await page.evaluate(() => { for (const id of ["home-screen", "profile-screen"]) document.querySelector(`[data-testid="${id}"]`).__mark = 1; });
      await page.screenshot({ path: path.join(outDir, `${label}-design-profile-${vp.width}.png`) });
      const toggle = page.locator(tid("design-toggle"));
      await toggle.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(outDir, `${label}-design-toggle-${vp.width}.png`) });
      // to classic, with taps and Escape while it is running
      await toggle.click();
      await page.locator(tid("design-switch-overlay")).waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, `${label}-design-overlay-${vp.width}.png`) });
      await page.keyboard.press("Escape");
      await page.mouse.click(vp.width / 2, vp.height / 2);
      await page.mouse.click(vp.width - 60, vp.height / 2);
      check(`${tag} loading screen stays closed during taps and Escape`, (await page.locator(tid("design-switch-overlay")).count()) === 1);
      await page.locator(tid("design-switch-overlay")).waitFor({ state: "detached", timeout: 20000 });
      check(`${tag} choice saved`, (await stored(page)) === '"classic"', String(await stored(page)));
      check(`${tag} still in the profile, nothing remounted`, await page.evaluate(() =>
        ["home-screen", "profile-screen"].every((id) => document.querySelector(`[data-testid="${id}"]`)?.__mark === 1)));
      check(`${tag} home is the original design now`, !(await painted(page)));
      await page.screenshot({ path: path.join(outDir, `${label}-design-profile-classic-${vp.width}.png`) });

      // reload: choice kept, new design never flashes
      await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
      await page.locator(tid("play-solo-card")).waitFor({ timeout: 60000 });
      await page.waitForTimeout(1200);
      check(`${tag} after a restart: original, no flash of the new design`, !(await painted(page)) && !(await page.evaluate(() => window.__painted)));
      await page.screenshot({ path: path.join(outDir, `${label}-design-home-classic-${vp.width}.png`) });

      // same saved game in the other design
      await page.locator(tid("resume-game-button")).first().click().catch(() => {});
      const inGame = await page.locator(tid("game-screen")).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(1500);
      const after = await save();
      check(`${tag} saved game resumes in the original design`, inGame && before === after && !(await page.evaluate(() => /bg_game/.test(document.body.innerHTML))), `${before} | ${after}`);
      await page.screenshot({ path: path.join(outDir, `${label}-design-game-classic-${vp.width}.png`) });
      await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
      await page.locator(tid("play-solo-card")).waitFor({ timeout: 60000 });
      await page.waitForTimeout(800);

      // there and back again
      await toProfile(page);
      const times = [];
      for (let i = 0; i < 5; i++) times.push(await flip(page, i === 0 ? `to-new-${vp.width}` : undefined));
      check(`${tag} five more switches, ends in the new design`, (await painted(page)) && (await stored(page)) === '"emerald"', times.join(" / ") + " ms");
      await page.locator(tid("profile-screen") + " " + tid("menu-button")).click();
      await page.locator(tid("menu-item-home")).click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(outDir, `${label}-design-home-back-${vp.width}.png`) });
      check(`${tag} home usable after switching`, (await page.locator(tid("play-online-card")).count()) === 1);
      check(`${tag} no page errors`, page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
      await ctx.close();
    }

    const vp = { width: 844, height: 390 };
    { // no network: the original design loads its images from the internet
      const { ctx, page } = await open(vp, { net: "off" });
      await toProfile(page);
      const ms = await flip(page);
      check("no network: switch to the original still works", (await stored(page)) === '"classic"' && !(await painted(page)), `${ms} ms`);
      check("no network: no page errors", page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
      await ctx.close();
    }
    { // network that never answers
      const { ctx, page } = await open(vp, { net: "hang" });
      await toProfile(page);
      const ms = await flip(page);
      check("hanging network: ends on its own within 10 s", ms < 10000 && (await stored(page)) === '"classic"', `${ms} ms`);
      await ctx.close();
    }
    { // storage full
      const { ctx, page } = await open(vp, { breakStorage: true });
      await toProfile(page);
      await page.locator(tid("design-toggle")).scrollIntoViewIfNeeded();
      await page.locator(tid("design-toggle")).click();
      const msg = await page.getByText("pas pu être enregistré").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
      await page.screenshot({ path: path.join(outDir, `${label}-design-notsaved.png`) });
      await page.locator(tid("design-switch-overlay")).waitFor({ state: "detached", timeout: 20000 });
      check("storage failure: design changes and the player is told", msg && !(await painted(page)) && (await stored(page)) === null);
      await ctx.close();
    }
    { // a name this version does not know
      const { ctx, page } = await open(vp, { design: '"ruby"' });
      check("unknown stored design: default is used", await painted(page));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
