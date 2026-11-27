#!/usr/bin/env node
// LOCAL-ONLY: start screen and sign in / register with made-up server answers.
//   node scripts/anime/smoke-auth.js <baseUrl> <anime|original> <outDir>
// DESIGN=classic stores the old design first (build flag on). Google / Apple are
// only checked for presence (they open real sign-in pages).
const path = require("path");
const fs = require("fs");
const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const tid = (id) => `[data-testid="${id}"]`;
const anime = label === "anime";
let failed = 0, total = 0;
const check = (n, ok, d = "") => { total++; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); };
fs.mkdirSync(outDir, { recursive: true });
const USER = { user_id: "mock_user_1", email: "demo@example.test", username: "demo_joueur", avatar_id: "av12", elo: 1063, elo_duo: 1000, games_played: 12, wins: 7, losses: 5, stats: {}, elo_history: [], auth_provider: "mock" };

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const open = async (vp, lang, api, token = false, url = "/auth") => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    await ctx.addInitScript(([design, l, tok]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      if (tok) localStorage.setItem("auth_token", JSON.stringify("mock-token"));
      if (design) localStorage.setItem("design", JSON.stringify(design));
      if (l) localStorage.setItem("lang", JSON.stringify(l));
    }, [process.env.DESIGN, lang, token]);
    const page = await ctx.newPage();
    page.sent = []; page.errors = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    await page.route("**/api/**", async (r) => {
      const key = r.request().method() + " " + new URL(r.request().url()).pathname.replace("/api", "");
      if (!["GET", "OPTIONS"].includes(r.request().method())) page.sent.push(key + " " + (r.request().postData() || ""));
      if (!(key in api)) return r.fallback();
      const v = api[key];
      if (v === "hang") return;
      return r.fulfill({ status: v.__status || 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, contentType: "application/json", body: JSON.stringify(v) });
    });
    await page.goto(baseUrl + url, { waitUntil: "domcontentloaded", timeout: 180000 });
    const L = (id) => page.locator(tid(id)).first();
    const seen = async (id) => (await page.locator(tid(id)).count()) > 0;
    const inView = async (id) => { const b = await L(id).boundingBox().catch(() => null); return !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1; };
    const cut = (...ids) => page.evaluate((list) => list.flatMap((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].flatMap((e) => [e, ...e.querySelectorAll("*")]).filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).map((e) => e.textContent)).join(" | "), ids);
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${label}-auth-${n}-${vp.width}${lang ? "-" + lang : ""}.png`) });
    return { ctx, page, L, seen, inView, cut, shot };
  };
  const runs = [[{ width: 844, height: 390 }], [{ width: 640, height: 360 }], ...(anime ? [[{ width: 915, height: 412 }], [{ width: 640, height: 360 }, "ar"], [{ width: 640, height: 360 }, "en"]] : [])];
  for (const [vp, lang] of runs) {
    const tag = `[${vp.width}${lang ? " " + lang : ""}]`;
    { // start screen while the session is checked
      const s = await open(vp, lang, { "GET /auth/me": "hang" }, true, "/");
      await s.L("splash-loading").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(700); await s.shot("start");
      check(`${tag} start screen shown while the session is checked`, await s.inView("splash-loading"));
      await s.ctx.close();
    }
    { // sign in: empty, wrong, right
      const s = await open(vp, lang, { "POST /auth/login": { __status: 401, detail: "invalid_credentials" } });
      await s.L("auth-login-tab").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(800); await s.shot("login");
      check(`${tag} sign in: tabs, fields, button, Google in view`, (await s.inView("auth-login-tab")) && (await s.inView("auth-email-input")) && (await s.inView("auth-password-input")) && (await s.inView("auth-submit-button")) && (await s.inView("auth-google-button")));
      if (anime) { const c = await s.cut("auth-login-tab", "auth-register-tab", "auth-submit-button", "auth-google-button", "lang-ar-chip"); check(`${tag} sign in: no label cut off`, c === "", c); }
      await s.L("auth-submit-button").click(); await s.page.waitForTimeout(300);
      check(`${tag} empty fields: message, nothing sent`, (await s.seen("auth-error-text")) && !s.page.sent.length);
      await s.L("auth-email-input").fill("demo@example.test"); await s.L("auth-password-input").fill("wrong-demo");
      check(`${tag} typed text visible`, (await s.L("auth-email-input").inputValue()) === "demo@example.test");
      await s.L("auth-submit-button").click(); await s.page.waitForTimeout(700); await s.shot("error");
      check(`${tag} wrong password: sent, message in view`, s.page.sent.some((x) => x.startsWith("POST /auth/login") && x.includes("demo@example.test")) && (await s.inView("auth-error-text")));
      await s.ctx.close();
    }
    {
      const s = await open(vp, lang, { "POST /auth/login": { token: "mock-token", user: USER } });
      await s.L("auth-email-input").waitFor({ timeout: 60000 });
      await s.L("auth-email-input").fill("demo@example.test"); await s.L("auth-password-input").fill("demo-pass-1");
      await s.L("auth-submit-button").click(); await s.page.waitForURL(/\/home/, { timeout: 20000 }).catch(() => {});
      check(`${tag} right password: home opens`, /\/home/.test(s.page.url()), s.page.url());
      await s.ctx.close();
    }
    { // register
      const s = await open(vp, lang, { "POST /auth/register": { __status: 400, detail: "email_taken" } });
      await s.L("auth-register-tab").waitFor({ timeout: 60000 }); await s.L("auth-register-tab").click(); await s.L("auth-username-input").waitFor(); await s.page.waitForTimeout(400); await s.shot("register");
      check(`${tag} register: three fields`, (await s.seen("auth-username-input")) && (await s.seen("auth-email-input")) && (await s.seen("auth-password-input")));
      await s.L("auth-username-input").fill("nouveau"); await s.L("auth-email-input").fill("demo@example.test"); await s.L("auth-password-input").fill("abc");
      await s.L("auth-submit-button").scrollIntoViewIfNeeded(); await s.L("auth-submit-button").click(); await s.page.waitForTimeout(300);
      check(`${tag} short password: message, nothing sent`, (await s.seen("auth-error-text")) && !s.page.sent.length);
      await s.L("auth-password-input").fill("abcdef1"); await s.L("auth-submit-button").click(); await s.page.waitForTimeout(700); await s.shot("register-error");
      check(`${tag} taken e-mail: sent, message shown`, s.page.sent.some((x) => x.startsWith("POST /auth/register") && x.includes('"nouveau"')) && (await s.seen("auth-error-text")));
      await s.L("auth-error-text").scrollIntoViewIfNeeded();
      check(`${tag} register: message reachable`, await s.inView("auth-error-text"));
      if (!lang) { await s.L("lang-en-chip").scrollIntoViewIfNeeded(); await s.L("lang-en-chip").click(); await s.page.waitForTimeout(400);
        check(`${tag} language chip changes the texts`, /Sign|Log|Create/i.test(await s.L("auth-submit-button").innerText()), await s.L("auth-submit-button").innerText()); }
      check(`${tag} no page errors`, s.page.errors.length === 0, s.page.errors[0]);
      await s.ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label}${process.env.DESIGN ? ", " + process.env.DESIGN : ""})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
