#!/usr/bin/env node
// LOCAL-ONLY smoke test + screenshot capture for the home screen (web build).
// Requires: the mock backend (scripts/anime/mock-backend.js) and an
// `expo start --web` pointed at it. See docs/ANIME_TESTING.md.
//
//   node scripts/anime/smoke-home.js <baseUrl> <label> <outDir>
//
// playwright-core is NOT a project dependency (none was added). Point
// PLAYWRIGHT_CORE at any existing copy; the script drives the installed
// Microsoft Edge (channel "msedge"), so no browser download is needed.
const path = require("path");
const fs = require("fs");

const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] =
  process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");

const VIEWPORTS = [
  { name: "phone-844x390", width: 844, height: 390 },
  { name: "small-640x360", width: 640, height: 360 },
  { name: "tall-915x412", width: 915, height: 412 },
  { name: "wide-740x340", width: 740, height: 340 },
  { name: "tablet-1280x800", width: 1280, height: 800 },
];

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const tid = (id) => `[data-testid="${id}"]`;

async function gridChecks(page, vp) {
  const ids = ["play-online-card", "play-solo-card", "learn-card", "private-game-card"];
  const b = {};
  for (const id of ids) b[id] = await page.locator(tid(id)).boundingBox();
  const [on, so, le, pr] = ids.map((i) => b[i]);
  // 5px tolerance: the original hero card sits inside a 2px glow border
  const near = (a, c) => Math.abs(a - c) <= 5;
  const ok =
    on && so && le && pr &&
    near(on.y, so.y) && near(le.y, pr.y) && near(on.x, le.x) && near(so.x, pr.x) &&
    on.x < so.x && on.y < le.y &&
    near(on.width, so.width) && near(le.width, pr.width) && near(on.width, le.width);
  check(`[${vp.name}] 2x2 grid: online|IA on top, apprendre|privée below`, !!ok,
    ok ? `tile ${Math.round(on.width)}x${Math.round(on.height)}` : JSON.stringify(b));
  const minTap = Math.min(on.width, on.height, le.height);
  check(`[${vp.name}] tiles are comfortable tap targets (>=76px)`, minTap >= 76, `min side ${Math.round(minTap)}`);
  const inside = [on, so, le, pr].every((r) => r.x >= 0 && r.x + r.width <= vp.width + 1 && r.y + r.height <= vp.height + 1);
  check(`[${vp.name}] grid fully inside the viewport`, inside);
  for (const id of ["menu-button", "home-user-avatar", "home-elo-pill", "notifications-bell", "resume-game-button"]) {
    const r = await page.locator(tid(id)).boundingBox();
    check(`[${vp.name}] top bar keeps ${id}`, !!r && r.x >= 0 && r.x + r.width <= vp.width + 1);
  }
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    // fake session for the MOCK backend only (never a real credential)
    await ctx.addInitScript(() => {
      try { localStorage.setItem("auth_token", JSON.stringify("mock-token")); } catch {}
    });
    const page = await ctx.newPage();
    await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
    await page.locator(tid("home-grid")).waitFor({ timeout: 120000 });
    await page.locator(tid("resume-game-button")).waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500); // entering animations + avatar image
    await gridChecks(page, vp);
    await page.screenshot({ path: path.join(outDir, `${label}-home-${vp.name}.png`) });

    if (vp.name === "phone-844x390") {
      // tap the scrim (top-left corner) once the open animation has settled
      const closeModal = async () => {
        await page.waitForTimeout(700);
        await page.mouse.click(6, 6);
        await page.waitForTimeout(700);
      };
      // user data comes from the (mock) account, not from hard-coded mockup text
      const body = await page.locator(tid("home-screen")).innerText();
      check("live values rendered (username, ELO, online count, score)",
        body.includes("demo_joueur") && body.includes("1063") && /3 joueur/.test(body) && /Nous 0 · 0 Eux|Partie en cours/.test(body));
      for (const txt of ["Jouer en ligne", "Jouer contre l'IA", "Apprendre à jouer", "Partie privée", "Entraînement"]) {
        check(`label present: ${txt}`, body.includes(txt));
      }

      await page.locator(tid("play-online-card")).click();
      await page.locator(tid("match-type-short")).waitFor({ timeout: 5000 });
      check("Jouer en ligne → match-type sheet with solo/duo switch",
        await page.locator(tid("online-mode-duo")).isVisible());
      await page.screenshot({ path: path.join(outDir, `${label}-modal-online.png`) });
      await closeModal();

      await page.locator(tid("play-solo-card")).click();
      await page.locator(tid("match-type-long")).waitFor({ timeout: 5000 });
      check("Jouer contre l'IA → match-type sheet", true);
      await closeModal();

      await page.locator(tid("private-game-card")).click();
      await page.locator(tid("private-game-modal")).waitFor({ timeout: 5000 });
      check("Partie privée → join/create sheet", await page.locator(tid("join-code-input")).isVisible());
      await page.locator(tid("create-party-button")).click();
      await page.locator(tid("room-timer-toggle")).waitFor({ timeout: 5000 });
      check("Partie privée → Créer → timer option + match type", true);
      await closeModal();

      await page.locator(tid("notifications-bell")).click();
      await page.locator(tid("notifications-panel")).waitFor({ timeout: 5000 });
      check("bell → notifications panel", true);
      await closeModal();

      await page.locator(tid("menu-button")).click();
      await page.locator(tid("side-menu")).waitFor({ timeout: 5000 });
      check("hamburger → side menu with 4 destinations",
        (await page.locator('[data-testid^="menu-item-"]').count()) === 4);
      await page.mouse.click(vp.width - 10, vp.height - 10);
      await page.waitForTimeout(450);

      await page.locator(tid("learn-card")).click();
      await page.waitForURL(/\/tutorial/, { timeout: 8000 });
      check("Apprendre à jouer → /tutorial", true);
      await page.goBack();
      await page.locator(tid("home-grid")).waitFor({ timeout: 10000 });

      await page.locator(tid("resume-game-button")).click();
      await page.waitForURL(/\/game\/mock_game_1/, { timeout: 8000 });
      check("Partie en cours → /game/<id>", true);
    }
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed (${label}, ${baseUrl})`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("SMOKE ERROR", e);
  process.exit(2);
});
