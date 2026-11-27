#!/usr/bin/env node
// LOCAL-ONLY: uses matchmaking, private room, join, share and their windows with
// made-up server answers and checks what is shown and what is sent.
//   node scripts/anime/smoke-lobby.js <baseUrl> <anime|original> <outDir>
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
const p = (i, username, extra = {}) => ({ user_id: "u" + i, username, avatar_id: "av" + i, elo: 1000 + i * 21, elo_duo: 990 + i * 17, ...extra });
const FRIENDS = { friends: [p(2, "Zakia"), p(6, "Mongi"), p(9, "Zohra"), p(3, "Slim"), p(8, "Hamma")], pending_received: [] };
const ROOM = (host) => ({ code: "DEMO42", host_id: host, match_type: "long", turn_timer: true, started: false, game_id: null, players: [],
  seats: [{ user_id: "mock_user_1", username: "demo_joueur", avatar_id: "av12" }, { user_id: "u2", username: "Zakia", avatar_id: "av2" }, null, null] });

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
    page.sent = []; page.errors = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    await page.route("**/api/**", async (r) => {
      const key = r.request().method() + " " + new URL(r.request().url()).pathname.replace("/api", "");
      if (r.request().method() !== "GET" && r.request().method() !== "OPTIONS") page.sent.push(key + " " + (r.request().postData() || ""));
      if (!(key in api)) return r.fallback();
      const body = typeof api[key] === "function" ? api[key]() : api[key];
      return r.fulfill({ status: body.__status || 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(baseUrl + url, { waitUntil: "domcontentloaded", timeout: 180000 });
    const L = (id) => page.locator(tid(id)).first();
    const seen = async (id) => (await page.locator(tid(id)).count()) > 0;
    const inView = async (id) => { const b = await L(id).boundingBox().catch(() => null); return !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1; };
    const free = async (...ids) => { // none of these may overlap another
      const bs = []; for (const id of ids) bs.push([id, await L(id).boundingBox()]);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const [a, b] = [bs[i][1], bs[j][1]];
        if (a && b && a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1) return `${bs[i][0]} / ${bs[j][0]}`;
      }
      return "";
    };
    // texts inside these elements must not be cut off (names may be)
    const cut = (...ids) => page.evaluate((list) => list.flatMap((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].flatMap((e) => [e, ...e.querySelectorAll("*")]).filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).map((e) => e.textContent)).join(" | "), ids);
    const shot = (n) => page.screenshot({ path: path.join(outDir, `${label}-lobby-${n}-${vp.width}${lang ? "-" + lang : ""}.png`) });
    return { ctx, page, L, seen, inView, free, shot, cut };
  };
  const mm = (status, extra = {}) => ({ "GET /matchmaking/status": status, "POST /matchmaking/join": {}, "POST /matchmaking/confirm": {}, "DELETE /matchmaking/leave": {}, ...extra });
  const three = [p(2, "Zakia"), p(6, "Mongi"), p(9, "Zohra")];

  const runs = [[{ width: 844, height: 390 }], [{ width: 640, height: 360 }], ...(anime ? [[{ width: 915, height: 412 }], [{ width: 640, height: 360 }, "ar"], [{ width: 640, height: 360 }, "en"]] : [])];
  for (const [vp, lang] of runs) {
    const tag = `[${vp.width}${lang ? " " + lang : ""}]`;
    { // search + share + cancel
      const s = await open(vp, "/matchmaking?type=short", mm({ status: "waiting", players: [p(2, "Zakia")], elo_range: 150 }), lang);
      await s.L("matchmaking-player-Zakia").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(700);
      await s.shot("search");
      if (anime) {
        check(`${tag} search: everything in view`, (await s.inView("matchmaking-status-text")) && (await s.inView("matchmaking-slots")) && (await s.inView("invite-friends-button")) && (await s.inView("cancel-search-button")) && (await s.inView("matchmaking-elo-range")));
        check(`${tag} search: nothing overlaps`, (await s.free("matchmaking-status-text", "matchmaking-slots", "matchmaking-elo-range", "invite-friends-button", "cancel-search-button")) === "", await s.free("matchmaking-status-text", "matchmaking-slots", "matchmaking-elo-range", "invite-friends-button", "cancel-search-button"));
      }
      check(`${tag} search joined the queue`, s.page.sent.some((x) => x.startsWith("POST /matchmaking/join") && x.includes('"match_type":"short"')));
      await s.L("invite-friends-button").click(); await s.L("share-sheet").waitFor(); await s.page.waitForTimeout(700); await s.shot("share");
      for (const c of ["whatsapp", "facebook", "instagram", "copy"]) if (!(await s.inView("share-" + c))) check(`${tag} share: ${c} in view`, false);
      check(`${tag} share: all ways and more options in view`, await s.inView("share-native-button"));
      await s.L("share-copy").click(); await s.page.waitForTimeout(300);
      check(`${tag} share: copy gives feedback`, await s.seen("share-feedback"));
      await s.page.mouse.click(6, 6); await s.page.waitForTimeout(700);
      check(`${tag} share: tap outside closes`, !(await s.seen("share-sheet")));
      await s.L("cancel-search-button").click(); await s.page.waitForTimeout(500);
      check(`${tag} cancel leaves the queue`, s.page.sent.some((x) => x.startsWith("DELETE /matchmaking/leave")));
      check(`${tag} search: no page errors`, s.page.errors.length === 0, s.page.errors[0]);
      await s.ctx.close();
    }
    { // confirm
      const st = { status: "confirm", remaining: 25, accepted: 1, total: 4, me_accepted: false, players: three };
      const s = await open(vp, "/matchmaking?type=short", mm(() => st, { "POST /matchmaking/confirm": () => { st.me_accepted = true; st.accepted = 2; return {}; } }), lang);
      await s.L("matchmaking-accept-button").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(600); await s.shot("confirm");
      if (anime) {
        const o = await s.free("matchmaking-status-text", "matchmaking-slots", "matchmaking-accept-button", "matchmaking-elo-range", "cancel-search-button");
        check(`${tag} confirm: accept in view, nothing overlaps`, (await s.inView("matchmaking-accept-button")) && o === "", o);
      }
      await s.L("matchmaking-accept-button").click(); await s.L("matchmaking-confirm-wait").waitFor({ timeout: 5000 });
      check(`${tag} accept is sent and waits for the others`, s.page.sent.some((x) => x.startsWith("POST /matchmaking/confirm")));
      await s.ctx.close();
    }
    { // removed: warning
      let first = true;
      const s = await open(vp, "/matchmaking?type=short", mm(() => (first ? ((first = false), { status: "removed_confirm" }) : { status: "waiting", players: [], elo_range: 100 })), lang);
      await s.L("matchmaking-warn").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(900); await s.shot("warning");
      if (anime) { const o = await s.free("matchmaking-slots", "matchmaking-warn", "matchmaking-elo-range", "cancel-search-button"); check(`${tag} warning readable, nothing overlaps`, (await s.inView("matchmaking-warn")) && o === "", o); }
      check(`${tag} warning: rejoins with priority`, s.page.sent.some((x) => x.includes('"priority":true')));
      await s.ctx.close();
    }
    { // duo
      const s = await open(vp, "/matchmaking?type=short&duo=1&mode=online", mm({ status: "waiting", players: [], elo_range: 100, duo: { partner: p(2, "Zakia") } }), lang);
      await s.L("duo-mode-chip").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(500); await s.shot("duo");
      check(`${tag} duo: partner shown`, await s.seen("matchmaking-duo-partner"));
      if (anime) { const c = await s.cut("duo-mode-chip", "matchmaking-elo-range", "matchmaking-players-count", "matchmaking-status-text", "invite-friends-button", "cancel-search-button"); check(`${tag} duo: no text cut off`, c === "", c); }
      if (anime) check(`${tag} duo: chips in view`, (await s.inView("duo-mode-chip")) && (await s.inView("matchmaking-elo-range")));
      check(`${tag} duo does not join the solo queue`, !s.page.sent.some((x) => x.startsWith("POST /matchmaking/join")));
      await s.ctx.close();
    }
    { // duo against the AI, partner pending: 2 places
      const s = await open(vp, "/matchmaking?type=short&duo=1&mode=vs_ai", mm({ status: "duo_pending", partner: p(2, "Zakia") }), lang);
      await s.L("matchmaking-duo-partner").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(500); await s.shot("vsai");
      check(`${tag} duo against the AI: no ELO range`, !(await s.seen("matchmaking-elo-range")));
      await s.ctx.close();
    }
    for (const status of ["duo_declined", "duo_cancelled", "duo_expired"]) {
      const s = await open(vp, "/matchmaking?type=short&duo=1&mode=online", mm({ status }), lang);
      await s.L("duo-end-message").waitFor({ timeout: 60000 });
      check(`${tag} ${status}: message in view`, await s.inView("duo-end-message"));
      await s.ctx.close();
    }
    { // room as host
      const s = await open(vp, "/room/DEMO42", { "GET /rooms/DEMO42": ROOM("mock_user_1"), "GET /friends": FRIENDS, "POST /rooms/DEMO42/invite": {}, "POST /rooms/DEMO42/seat": ROOM("mock_user_1"), "POST /rooms/DEMO42/start": { __status: 500 }, "POST /rooms/DEMO42/leave": {} }, lang);
      await s.L("start-game-button").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(700); await s.shot("room");
      if (anime) { const c = await s.cut("share-code-button", "invite-friends-button", "start-game-button", "room-code-text"); check(`${tag} room: no label cut off`, c === "", c); }
      if (anime) check(`${tag} room: code, buttons and 4 seats in view`, (await s.inView("room-code-text")) && (await s.inView("share-code-button")) && (await s.inView("invite-friends-button")) && (await s.inView("start-game-button")) && (await s.inView("room-seat-0")) && (await s.inView("room-seat-3")));
      await s.L("room-seat-2").scrollIntoViewIfNeeded(); await s.L("room-seat-2").click(); await s.L("seat-action-modal").waitFor(); await s.page.waitForTimeout(600); await s.shot("seat");
      check(`${tag} host: seat choice in view`, (await s.inView("seat-sit-button")) && (await s.inView("seat-invite-button")));
      await s.L("seat-sit-button").click(); await s.page.waitForTimeout(600);
      check(`${tag} host: sit here is sent`, s.page.sent.some((x) => x.startsWith("POST /rooms/DEMO42/seat") && x.includes('"seat":2')));
      await s.L("room-seat-3").scrollIntoViewIfNeeded(); await s.L("room-seat-3").click(); await s.L("seat-invite-button").click(); await s.L("invite-friend-Zakia").waitFor(); await s.page.waitForTimeout(700); await s.shot("invite");
      await s.L("invite-send-Zakia").click(); await s.page.waitForTimeout(500);
      check(`${tag} host: invite to the seat is sent and marked`, s.page.sent.some((x) => x.startsWith("POST /rooms/DEMO42/invite") && x.includes('"user_id":"u2"') && x.includes('"seat":3')) && !(await s.seen("invite-send-Zakia")));
      await s.L("invite-send-Hamma").scrollIntoViewIfNeeded();
      check(`${tag} invite list scrolls to the last friend`, await s.inView("invite-send-Hamma"));
      await s.page.mouse.click(6, 6); await s.page.waitForTimeout(700);
      check(`${tag} invite window closes`, !(await s.seen("invite-friend-Zakia")));
      await s.L("start-game-button").scrollIntoViewIfNeeded(); await s.L("start-game-button").click(); await s.page.waitForTimeout(500);
      check(`${tag} start is sent`, s.page.sent.some((x) => x.startsWith("POST /rooms/DEMO42/start")));
      await s.L("room-leave-button").click(); await s.page.waitForTimeout(500);
      check(`${tag} back leaves the room`, s.page.sent.some((x) => x.startsWith("POST /rooms/DEMO42/leave")));
      check(`${tag} room: no page errors`, s.page.errors.length === 0, s.page.errors[0]);
      await s.ctx.close();
    }
    { // room as guest
      const s = await open(vp, "/room/DEMO42", { "GET /rooms/DEMO42": ROOM("u2"), "POST /rooms/DEMO42/seat": ROOM("u2") }, lang);
      await s.L("room-seat-3").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(600); await s.shot("guest");
      check(`${tag} guest: no start button`, !(await s.seen("start-game-button")));
      await s.L("room-seat-3").scrollIntoViewIfNeeded(); await s.L("room-seat-3").click(); await s.page.waitForTimeout(500);
      check(`${tag} guest: tap on a free seat moves directly`, s.page.sent.some((x) => x.startsWith("POST /rooms/DEMO42/seat") && x.includes('"seat":3')) && !(await s.seen("seat-action-modal")));
      const before = s.page.sent.length; await s.L("room-seat-1").click({ force: true }).catch(() => {}); await s.page.waitForTimeout(300);
      check(`${tag} guest: taken seat does nothing`, s.page.sent.length === before);
      await s.ctx.close();
    }
    { // closed room by link
      const s = await open(vp, "/join/DEMO42", { "POST /rooms/DEMO42/join": { __status: 404, detail: "gone" } }, lang);
      await s.L("join-error").waitFor({ timeout: 60000 }); await s.page.waitForTimeout(400); await s.shot("closed");
      check(`${tag} join: closed message and button in view`, (await s.inView("join-error")) && (await s.inView("join-back-home")));
      await s.L("join-back-home").click(); await s.L("home-screen").waitFor({ timeout: 20000 });
      check(`${tag} join: back to home`, true);
      await s.ctx.close();
    }
    { // join works
      const s = await open(vp, "/join/DEMO42", { "POST /rooms/DEMO42/join": {}, "GET /rooms/DEMO42": ROOM("u2") }, lang);
      await s.L("room-screen").waitFor({ timeout: 60000 });
      check(`${tag} join: opens the room`, true);
      await s.ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${total - failed}/${total} checks passed (${label}${process.env.DESIGN ? ", " + process.env.DESIGN : ""})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SMOKE ERROR", e); process.exit(2); });
