#!/usr/bin/env node
// LOCAL-ONLY: profile, avatar choice, statistics, settings, feedback and delete
// windows with made-up server answers.   node scripts/anime/smoke-profile.js <baseUrl> <anime|original> <outDir>
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
const ME = { user_id: "mock_user_1", email: "demo@example.test", username: "demo_joueur", avatar_id: "av12", elo: 1063, elo_duo: 1010, games_played: 12, wins: 7, losses: 5,
  stats: { contracts_taken: 9, contracts_made: 6, belotes: 3, capots: 1, best_streak: 4 }, elo_history: [1000, 1012, 1003, 1021, 1040, 1032, 1063].map((elo) => ({ elo })), auth_provider: "mock" };

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const open = async (vp, lang, extra = {}) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    await ctx.addInitScript(([design, l]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("auth_token", JSON.stringify("mock-token"));
      if (design) localStorage.setItem("design", JSON.stringify(design));
      if (l) localStorage.setItem("lang", JSON.stringify(l));
    }, [process.env.DESIGN, lang]);
    const page = await ctx.newPage();
    page.sent = []; page.errors = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    let me = { ...ME };
    const api = {
      "GET /auth/me": () => me,
      "GET /users/me/stats": { rank: 4, win_rate: 58 },
      "PUT /users/me": (body) => { me = { ...me, ...JSON.parse(body || "{}") }; return me; },
      "POST /feedback": {},
      "DELETE /users/me": {},
      ...extra,
    };
    await page.route("**/api/**", async (r) => {
      const key = r.request().method() + " " + new URL(r.request().url()).pathname.replace("/api", "");
      if (!["GET", "OPTIONS"].includes(r.request().method())) page.sent.push(key + " " + (r.request().postData() || ""));
      if (!(key in api)) return r.fallback();
      const body = typeof api[key] === "function" ? api[key](r.request().postData()) : api[key];
      return r.fulfill({ status: body.__status || 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" }, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(baseUrl + "/profile", { waitUntil: "domcontentloaded", timeout: 180000 });
    const L = (id) => page.locator(tid(id)).first();
    const seen = async (id) => (await page.locator(tid(id)).count()) > 0;
    const inView = async (id) => { const b = await L(id).boundingBox().catch(() => null); return !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1; };
    const cut = (...ids) => page.evaluate((list) => list.flatMap((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].flatMap((e) => [e, ...e.querySelectorAll("*")]).filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).map((e) => e.textContent)).join(" | "), ids);
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${label}-profile-${n}-${vp.width}${lang ? "-" + lang : ""}.png`) });
    const scrollTo = async (id) => { await L(id).scrollIntoViewIfNeeded(); await page.waitForTimeout(250); };
    return { ctx, page, L, seen, inView, cut, shot, scrollTo };
  };
  const runs = [[{ width: 844, height: 390 }], [{ width: 640, height: 360 }], ...(anime ? [[{ width: 915, height: 412 }], [{ width: 640, height: 360 }, "ar"], [{ width: 640, height: 360 }, "en"]] : [])];
  for (const [vp, lang] of runs) {
    const tag = `[${vp.width}${lang ? " " + lang : ""}]`;
    {
      const s = await open(vp, lang);
      await s.L("profile-username").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(900); await s.shot("top");
      check(`${tag} head card: name and values in view`, (await s.inView("profile-username")) && (await s.inView("profile-elo-badge")) && (await s.inView("profile-elo-duo-badge")));
      if (anime) { const c = await s.cut("profile-elo-badge", "profile-elo-duo-badge", "toggle-avatars", "toggle-stats"); check(`${tag} head card: nothing cut off`, c === "", c); }
      check(`${tag} values shown`, /1063/.test(await s.L("profile-elo-badge").innerText()) && /1010/.test(await s.L("profile-elo-duo-badge").innerText()));
      await s.L("toggle-avatars").click(); await s.L("avatar-option-av3").waitFor(); await s.page.waitForTimeout(400); await s.shot("avatars");
      await s.L("avatar-option-av3").click(); await s.page.waitForTimeout(600);
      check(`${tag} avatar choice is saved`, s.page.sent.some((x) => x.startsWith("PUT /users/me") && x.includes('"av3"')));
      await s.L("toggle-avatars").click(); await s.page.waitForTimeout(300);
      await s.L("toggle-stats").click(); await s.L("stats-grid").waitFor(); await s.scrollTo("stats-grid"); await s.shot("stats");
      check(`${tag} 9 statistics with values`, (await s.page.locator('[data-testid^="stat-"]').count()) === 9 && /58%/.test(await s.L("stat-winrate").innerText()));
      if (anime) { const c = await s.cut("stats-grid"); check(`${tag} statistics: nothing cut off`, c === "", c); }
      await s.scrollTo("elo-chart"); await s.shot("chart");
      check(`${tag} ELO chart shown`, await s.inView("elo-chart"));
      await s.L("toggle-stats").scrollIntoViewIfNeeded(); await s.L("toggle-stats").click(); await s.page.waitForTimeout(300);
      await s.scrollTo("sound-toggle"); await s.shot("settings");
      const sound0 = await s.page.evaluate(() => localStorage.getItem("sound_enabled"));
      await s.L("sound-toggle").click(); await s.page.waitForTimeout(400);
      check(`${tag} sound switch is stored`, (await s.page.evaluate(() => localStorage.getItem("sound_enabled"))) === "0", `${sound0}`);
      await s.L("sound-toggle").click(); await s.page.waitForTimeout(300);
      check(`${tag} sound switch back on`, (await s.page.evaluate(() => localStorage.getItem("sound_enabled"))) === "1");
      if (anime) check(`${tag} design switch present and on`, (await s.seen("design-toggle")) && (await s.page.evaluate(() => { const e = document.querySelector("[data-testid=\"design-toggle\"]"); return e && (e.getAttribute("aria-checked") ?? e.getAttribute("aria-pressed") ?? e.getAttribute("aria-selected")); })) !== "false");
      await s.scrollTo("language-en-option"); await s.L(lang === "en" ? "language-fr-option" : "language-en-option").click(); await s.page.waitForTimeout(500);
      const t1 = await s.L("toggle-stats").innerText();
      check(`${tag} language change applies`, lang === "en" ? /Statistiques/.test(t1) : /Statistics/.test(t1), t1);
      await s.L(lang ? `language-${lang}-option` : "language-fr-option").click(); await s.page.waitForTimeout(300);
      await s.scrollTo("app-version-text"); await s.shot("bottom");
      check(`${tag} bottom: logout, delete, version reachable`, (await s.inView("logout-button")) && (await s.inView("delete-account-button")) && (await s.inView("app-version-text")));
      // delete window: cancel
      await s.L("delete-account-button").click(); await s.L("delete-account-modal").waitFor(); await s.page.waitForTimeout(500); await s.shot("delete");
      check(`${tag} delete window: both buttons in view`, (await s.inView("delete-cancel-button")) && (await s.inView("delete-confirm-button")));
      if (anime) { const c = await s.cut("delete-account-modal"); check(`${tag} delete window: nothing cut off`, c === "", c); }
      await s.L("delete-cancel-button").click(); await s.page.waitForTimeout(500);
      check(`${tag} cancel deletes nothing`, !(await s.seen("delete-account-modal")) && !s.page.sent.some((x) => x.startsWith("DELETE")));
      // feedback
      await s.scrollTo("feedback-entry"); await s.L("feedback-entry").click(); await s.L("feedback-modal").waitFor(); await s.page.waitForTimeout(500); await s.shot("feedback");
      check(`${tag} feedback: moods, field, buttons in view`, (await s.inView("mood-sad")) && (await s.inView("mood-love")) && (await s.inView("feedback-message-input")) && (await s.inView("feedback-send-button")));
      await s.L("feedback-send-button").click({ force: true }); await s.page.waitForTimeout(300);
      check(`${tag} feedback: nothing sent without a mood`, !s.page.sent.some((x) => x.startsWith("POST /feedback")));
      await s.L("mood-love").click(); await s.L("feedback-message-input").fill("Très beau design"); await s.page.waitForTimeout(200);
      check(`${tag} feedback: typed text visible`, (await s.L("feedback-message-input").inputValue()) === "Très beau design");
      await s.shot("feedback-filled");
      await s.L("feedback-send-button").click(); await s.L("feedback-thanks").waitFor({ timeout: 5000 }); await s.page.waitForTimeout(400); await s.shot("thanks");
      check(`${tag} feedback sent with mood and text`, s.page.sent.some((x) => x.startsWith("POST /feedback") && x.includes('"love"') && x.includes("Très beau design")));
      // the original button has no height in a browser (flex: 0), so it is pressed directly
      await s.L("feedback-close-button").evaluate((e) => e.click()); await s.page.waitForTimeout(400);
      check(`${tag} thanks window closes`, !(await s.seen("feedback-modal")));
      check(`${tag} no page errors`, s.page.errors.length === 0, s.page.errors[0]);
      await s.ctx.close();
    }
    if (!lang) { // delete for real, and log out
      const s = await open(vp, lang);
      await s.L("profile-username").waitFor({ timeout: 60000 }); await s.scrollTo("delete-account-button");
      await s.L("delete-account-button").click(); await s.L("delete-confirm-button").click(); await s.page.waitForURL(/\/auth/, { timeout: 10000 }).catch(() => {});
      check(`${tag} delete confirmed: sent, back to sign in`, s.page.sent.some((x) => x.startsWith("DELETE /users/me")) && /\/auth/.test(s.page.url()));
      await s.ctx.close();
      const s2 = await open(vp, lang);
      await s2.L("profile-username").waitFor({ timeout: 60000 }); await s2.scrollTo("logout-button");
      await s2.L("logout-button").click(); await s2.page.waitForURL(/\/auth/, { timeout: 10000 }).catch(() => {});
      check(`${tag} logout: back to sign in`, /\/auth/.test(s2.page.url()));
      await s2.ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label}${process.env.DESIGN ? ", " + process.env.DESIGN : ""})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
