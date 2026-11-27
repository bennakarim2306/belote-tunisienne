#!/usr/bin/env node
// LOCAL-ONLY: ranking and friends with made-up server answers; checks what is
// shown and sent.   node scripts/anime/smoke-social.js <baseUrl> <anime|original> <outDir>
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
const p = (i, username, extra = {}) => ({ user_id: "u" + i, username, avatar_id: "av" + i, elo: 1000 + i * 21, elo_duo: 990 + i * 17, games_played: 10 + i, wins: i, ...extra });
const BOARD = Array.from({ length: 14 }, (_, i) => p((i % 11) + 1, ["Zakia", "Mongi", "Zohra", "Slim", "Hamma", "Baya", "Farhat", "Aziza", "Hichem", "Fatma", "Brahim"][i % 11] + (i > 10 ? i : ""), { user_id: "x" + i }));
BOARD[4] = { ...p(12, "demo_joueur"), user_id: "mock_user_1" };

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const open = async (vp, url, api, lang) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    await ctx.addInitScript(([design, l]) => {
      localStorage.setItem("auth_token", JSON.stringify("mock-token")); localStorage.setItem("design_notice_1_4_0", "true");
      if (design) localStorage.setItem("design", JSON.stringify(design));
      if (l) localStorage.setItem("lang", JSON.stringify(l));
    }, [process.env.DESIGN, lang]);
    const page = await ctx.newPage();
    page.sent = []; page.errors = []; page.asked = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    await page.route("**/api/**", async (r) => {
      const u = new URL(r.request().url());
      const key = r.request().method() + " " + u.pathname.replace("/api", "");
      if (r.request().method() === "GET") page.asked.push(key + u.search);
      else if (r.request().method() !== "OPTIONS") page.sent.push(key + " " + (r.request().postData() || ""));
      if (!(key in api)) return r.fallback();
      const body = typeof api[key] === "function" ? api[key](u) : api[key];
      return r.fulfill({ status: body.__status || 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(baseUrl + url, { waitUntil: "domcontentloaded", timeout: 180000 });
    const L = (id) => page.locator(tid(id)).first();
    const seen = async (id) => (await page.locator(tid(id)).count()) > 0;
    const inView = async (id) => { const b = await L(id).boundingBox().catch(() => null); return !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1; };
    const cut = (...ids) => page.evaluate((list) => list.flatMap((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].flatMap((e) => [e, ...e.querySelectorAll("*")]).filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).map((e) => e.textContent)).join(" | "), ids);
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${label}-social-${n}-${vp.width}${lang ? "-" + lang : ""}.png`) });
    return { ctx, page, L, seen, inView, cut, shot };
  };
  const runs = [[{ width: 844, height: 390 }], [{ width: 640, height: 360 }], ...(anime ? [[{ width: 915, height: 412 }], [{ width: 640, height: 360 }, "ar"], [{ width: 640, height: 360 }, "en"]] : [])];
  for (const [vp, lang] of runs) {
    const tag = `[${vp.width}${lang ? " " + lang : ""}]`;
    { // ranking
      const s = await open(vp, "/leaderboard", { "GET /leaderboard": (u) => ({ players: u.searchParams.get("mode") === "duo" ? BOARD.slice().reverse() : BOARD, my_rank: 5 }) }, lang);
      await s.L("leaderboard-row-1").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(800); await s.shot("ranking");
      check(`${tag} ranking: header, switch, my rank and first row in view`, (await s.inView("lb-mode-solo")) && (await s.inView("lb-mode-duo")) && (await s.inView("my-rank-card")) && (await s.inView("leaderboard-row-1")));
      if (anime) { const c = await s.cut("my-rank-card", "lb-mode-solo", "lb-mode-duo", "leaderboard-row-1"); check(`${tag} ranking: no label cut off`, c === "", c); }
      check(`${tag} ranking: places shown`, /1/.test(await s.L("leaderboard-row-1").innerText()) && /14/.test(await s.L("leaderboard-row-14").innerText()));
      await s.L("lb-mode-duo").click(); await s.page.waitForTimeout(800); await s.shot("ranking-duo");
      check(`${tag} ranking: duo asked from the server`, s.page.asked.some((x) => x.includes("/leaderboard?mode=duo")));
      check(`${tag} ranking: my row shows duo ELO`, (await s.L("my-rank-card").innerText()).includes("1000"));
      await s.L("leaderboard-row-14").scrollIntoViewIfNeeded(); await s.page.waitForTimeout(500); await s.shot("ranking-end");
      check(`${tag} ranking: list scrolls to the last row`, await s.inView("leaderboard-row-14"));
      check(`${tag} ranking: no page errors`, s.page.errors.length === 0, s.page.errors[0]);
      await s.ctx.close();
    }
    { // empty ranking
      const s = await open(vp, "/leaderboard", { "GET /leaderboard": { players: [], my_rank: null } }, lang);
      await s.L("my-rank-card").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(700); await s.shot("ranking-empty");
      check(`${tag} empty ranking: message shown`, (await s.page.getByText(/classement|ranking|الترتيب/i).count()) > 0);
      await s.ctx.close();
    }
    // friends
    const FR = { friends: [p(2, "Zakia", { online: true }), p(6, "Mongi"), p(9, "Zohra", { online: true }), p(3, "Slim"), p(8, "Hamma")], pending_received: [p(5, "Fatma", { friendship_id: "f1" })] };
    const fapi = {
      "GET /friends": FR,
      "GET /users/search": { results: [p(3, "Slim", { friend_status: "none" }), p(4, "Slimane", { friend_status: "pending_sent" }), p(7, "Salima", { friend_status: "friends" })] },
      "POST /friends/request": {}, "POST /friends/respond": {}, "POST /matchmaking/duo/invite": {},
      "GET /matchmaking/status": { status: "duo_pending", partner: p(2, "Zakia") },
    };
    {
      const s = await open(vp, "/friends", fapi, lang);
      await s.L("friend-row-Zakia").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(800); await s.shot("friends");
      check(`${tag} friends: header, filter, invite, search in view`, (await s.inView("friends-online-filter")) && (await s.inView("invite-friends-button")) && (await s.inView("friend-search-input")));
      if (anime) { const c = await s.cut("friends-online-filter", "invite-friends-button", "request-row-Fatma", "friend-row-Zakia"); check(`${tag} friends: no label cut off`, c === "", c); }
      check(`${tag} friends: request and presence shown`, (await s.seen("request-row-Fatma")) && (await s.seen("presence-Zakia-on")) && (await s.seen("presence-Mongi-off")));
      await s.L("friends-online-filter").click(); await s.page.waitForTimeout(400);
      check(`${tag} filter hides offline friends`, !(await s.seen("friend-row-Mongi")) && (await s.seen("friend-row-Zohra")));
      await s.L("friends-online-filter").click(); await s.page.waitForTimeout(300);
      await s.L("accept-request-Fatma").click(); await s.page.waitForTimeout(400);
      check(`${tag} accept request is sent`, s.page.sent.some((x) => x.startsWith("POST /friends/respond") && x.includes('"accept":true') && x.includes('"f1"')));
      await s.L("decline-request-Fatma").click(); await s.page.waitForTimeout(400);
      check(`${tag} decline request is sent`, s.page.sent.some((x) => x.startsWith("POST /friends/respond") && x.includes('"accept":false')));
      await s.L("invite-game-Zakia").scrollIntoViewIfNeeded(); await s.L("invite-game-Zakia").click(); await s.L("invite-game-modal").waitFor(); await s.page.waitForTimeout(700); await s.shot("invite");
      check(`${tag} invite window: both match types and both ways in view`, (await s.inView("invite-mt-short")) && (await s.inView("invite-mt-long")) && (await s.inView("invite-mode-online")) && (await s.inView("invite-mode-ai")));
      if (anime) { const c = await s.cut("invite-game-modal"); check(`${tag} invite window: no text cut off`, c === "", c); }
      await s.L("invite-mt-long").click(); await s.L("invite-mode-ai").click(); await s.page.waitForTimeout(800);
      check(`${tag} invite is sent with long match against the AI`, s.page.sent.some((x) => x.startsWith("POST /matchmaking/duo/invite") && x.includes('"match_type":"long"') && x.includes('"mode":"vs_ai"') && x.includes('"u2"')));
      check(`${tag} invite opens the waiting screen`, /matchmaking/.test(s.page.url()));
      check(`${tag} friends: no page errors`, s.page.errors.length === 0, s.page.errors[0]);
      await s.ctx.close();
    }
    {
      const s = await open(vp, "/friends", fapi, lang);
      await s.L("friend-search-input").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(500);
      await s.L("friend-search-input").fill("sli"); await s.L("search-result-Slim").waitFor({ timeout: 5000 }); await s.page.waitForTimeout(400); await s.shot("search");
      check(`${tag} search: typed text visible`, (await s.L("friend-search-input").inputValue()) === "sli");
      check(`${tag} search: asks the server`, s.page.asked.some((x) => x.includes("/users/search?q=sli")));
      await s.L("add-friend-Slim").click(); await s.page.waitForTimeout(300);
      check(`${tag} add is sent, message readable`, s.page.sent.some((x) => x.startsWith("POST /friends/request") && x.includes('"u3"')) && (await s.seen("friends-toast")));
      if (anime) check(`${tag} message text has its own colour`, await s.page.evaluate(() => { const e = document.querySelector('[data-testid="friends-toast"]'); const t = [...e.querySelectorAll("*")].find((x) => x.children.length === 0 && x.textContent.trim()); return !!t && getComputedStyle(t).color !== "rgb(253, 251, 249)"; }));
      await s.shot("toast");
      await s.L("friend-search-clear").click(); await s.page.waitForTimeout(400);
      check(`${tag} clear brings the list back`, await s.seen("friend-row-Zakia"));
      await s.L("invite-friends-button").click(); await s.L("share-sheet").waitFor({ timeout: 5000 });
      await s.page.waitForTimeout(800); await s.shot("share");
      check(`${tag} invite friends opens sharing`, await s.inView("share-native-button"), JSON.stringify(await s.L("share-native-button").boundingBox()));
      await s.ctx.close();
    }
    {
      const s = await open(vp, "/friends", { "GET /friends": { friends: [], pending_received: [] } }, lang);
      await s.L("friends-empty-state").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(600); await s.shot("friends-empty");
      check(`${tag} no friends: message in view`, await s.inView("friends-empty-state"));
      await s.ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label}${process.env.DESIGN ? ", " + process.env.DESIGN : ""})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
