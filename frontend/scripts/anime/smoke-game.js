#!/usr/bin/env node
// LOCAL-ONLY smoke test + screenshots for the GAME TABLE (web build).
// Plays one real hand against the 3 bots on the app's own offline engine
// ("Jouer contre l'IA"), so no backend game is needed — only the mock backend
// for the fake login. See docs/ANIME_TESTING.md.
//
//   node scripts/anime/smoke-game.js <baseUrl> <label> <outDir>
const path = require("path");
const fs = require("fs");

const [baseUrl = "http://localhost:8090", label = "anime", outDir = "./anime-shots"] =
  process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const tid = (id) => `[data-testid="${id}"]`;
const CARD_RE = /^hand-card-(7|8|9|10|J|Q|K|A)[SHDC]$/;

async function startSoloGame(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("auth_token", JSON.stringify("mock-token")); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
  await page.locator(tid("play-solo-card")).waitFor({ timeout: 120000 });
  await page.waitForTimeout(800);
  await page.locator(tid("play-solo-card")).click();
  await page.locator(tid("match-type-short")).click();
  await page.waitForURL(/\/game\//, { timeout: 15000 });
  await page.locator(tid("game-screen")).waitFor({ timeout: 30000 });
  return { ctx, page };
}
const handIds = (page) =>
  page.locator('[data-testid^="hand-card-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
const waitDealt = async (page) => {
  await page.locator(tid("deal-animation")).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const shot = (page, name) => page.screenshot({ path: path.join(outDir, `${label}-game-${name}.png`) });
  const browser = await chromium.launch({ channel: "msedge", headless: true });

  // ---------- full hand at 844×390 ----------
  const vp = { width: 844, height: 390 };
  const { ctx, page } = await startSoloGame(browser, vp);
  await page.waitForTimeout(700);
  await shot(page, "1-dealing");
  await waitDealt(page);

  let hand = await handIds(page);
  check("8 cards dealt to the local player", hand.length === 8, `hand ${hand.length}`);
  check("hand cards are valid, distinct Belote cards (7–A, 4 suits)",
    hand.every((h) => CARD_RE.test(h)) && new Set(hand).size === hand.length, hand.join(" "));
  for (const s of [0, 1, 2, 3]) check(`seat ${s} is on the table`, await page.locator(tid(`seat-${s}`)).count() === 1);
  check("score header shows", await page.locator(tid("match-score-header")).isVisible());
  for (const id of ["quit-game-button", "mute-button", "chat-button"]) {
    check(`control present: ${id}`, await page.locator(tid(id)).isVisible());
  }
  const headerText = await page.locator(tid("match-score-header")).innerText();
  check("score header carries live text (Nous / Eux / 500 pts)", /Nous/.test(headerText) && /Eux/.test(headerText) && /500/.test(headerText), headerText.replace(/\s+/g, " "));

  // quick chat sheet opens and closes
  await page.locator(tid("chat-button")).click();
  await page.locator(tid("chat-panel")).waitFor({ timeout: 5000 });
  await page.waitForTimeout(700);
  check("quick chat opens with emojis and phrases",
    (await page.locator('[data-testid^="chat-emoji-"]').count()) >= 4 &&
    (await page.locator('[data-testid^="chat-msg-"]').count()) >= 4);
  await shot(page, "7-chat");
  await page.mouse.click(8, 8);
  await page.waitForTimeout(700);
  check("quick chat closes", (await page.locator(tid("chat-panel")).count()) === 0);

  // a phrase is sent and shown at my seat (EXPECT_STICKER=1: as my character's sticker)
  await page.locator(tid("chat-button")).click();
  await page.locator(tid("chat-msg-wellPlayed")).click();
  await page.waitForTimeout(900);
  if (process.env.EXPECT_STICKER === "1") {
    check("sent phrase shows as my sticker with its text",
      (await page.locator('[data-testid^="chat-sticker-"]').count()) === 1 &&
      /Bien jou/.test(await page.locator('[data-testid^="chat-sticker-"]').innerText()));
    await shot(page, "9-sticker");
  } else {
    check("sent phrase shows at my seat", (await page.locator('[data-testid^="chat-bubble-"], [data-testid^="chat-sticker-"]').count()) >= 1);
  }
  await page.waitForTimeout(3800);

  let bidShot = false, playShot = false, played = 0, announced = false, sawContract = false, handEnd = false;
  let trickShot = false;
  let maxHand = hand.length, maxTrick = 0;
  for (let i = 0; i < 260 && !handEnd; i++) {
    await page.waitForTimeout(450);
    if (await page.locator(tid("hand-end-modal")).count()) { handEnd = true; break; }
    if (await page.locator(tid("match-end-overlay")).count()) { handEnd = true; break; }
    // a fresh deal (everybody passed) may replay the deal animation
    if (await page.locator(tid("deal-animation")).count()) { await waitDealt(page); continue; }
    hand = await handIds(page);
    maxHand = Math.max(maxHand, hand.length);
    const trickCards = await page.locator(`${tid("trick-area")} svg`).count();
    maxTrick = Math.max(maxTrick, trickCards);

    if (await page.locator(tid("bidding-panel")).count()) {
      if (!bidShot) { await shot(page, "2-bidding"); bidShot = true; }
      if (!announced) {
        await page.locator(tid("bid-suit-H")).click();
        const values = page.locator('[data-testid^="bid-value-"]');
        const n = await values.count();
        for (let k = 0; k < n; k++) {
          const v = values.nth(k);
          if ((await v.getAttribute("aria-disabled")) !== "true") { await v.click(); break; }
        }
        await page.waitForTimeout(200);
        await shot(page, "3-bid-selected");
        await page.locator(tid("announce-bid-button")).click();
        announced = true;
      } else {
        await page.locator(tid("pass-button")).click();
      }
      continue;
    }
    if (await page.locator(tid("surcontre-panel")).count()) {
      await page.locator(tid("decline-surcontre-button")).click();
      continue;
    }
    if (await page.locator(tid("contract-chip")).count()) sawContract = true;
    if (await page.locator(tid("your-turn-pill")).count()) {
      if (!playShot && played >= 1) { await shot(page, "4-playing"); playShot = true; }
      if (!trickShot && played >= 1 && (await page.locator(tid("last-trick-button")).count())) {
        await page.locator(tid("last-trick-button")).click();
        await page.locator(tid("last-trick-modal")).waitFor({ timeout: 5000 });
        await page.waitForTimeout(500);
        check("last trick shows 4 cards and marks the winner",
          (await page.locator(`${tid("last-trick-modal")} svg`).count()) >= 4 &&
          (await page.locator(tid("last-trick-winner-card")).count()) === 1);
        await shot(page, "6-last-trick");
        await page.locator(tid("last-trick-close-button")).click();
        await page.waitForTimeout(500);
        trickShot = true;
        continue;
      }
      const before = hand.length;
      for (const id of hand) {
        await page.locator(tid(id)).click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(250);
        if ((await handIds(page)).length < before) { played++; break; }
      }
    }
  }
  check("bidding panel appeared on my turn and a bid could be announced", announced);
  check("contract chip appeared after the auction", sawContract);
  check("cards could be played from the hand", played >= 1, `${played} cards played`);
  check("never more than 8 cards in hand", maxHand <= 8, `max ${maxHand}`);
  check("never more than 4 cards in a trick", maxTrick <= 4, `max ${maxTrick}`);
  check("the hand reached its end screen", handEnd, `after ${played} plays`);
  if (handEnd) {
    await page.waitForTimeout(900);
    await shot(page, "5-hand-end");
  }
  // quit goes back home (solo: direct, game auto-saved)
  if (await page.locator(tid("hand-continue-button")).count()) {
    await page.locator(tid("hand-continue-button")).click().catch(() => {});
    await page.waitForTimeout(600);
  }
  // score history lists the finished hand
  await waitDealt(page);
  await page.locator(tid("match-score-header")).click({ timeout: 5000 }).catch(() => {});
  if (await page.locator(tid("score-history-modal")).count()) {
    await page.waitForTimeout(500);
    const histText = await page.locator(tid("score-history-modal")).innerText();
    check("score history lists the finished hand", /Donne 1/.test(histText), histText.replace(/\s+/g, " ").slice(0, 90));
    await shot(page, "8-score-history");
    await page.locator(tid("score-history-close")).click();
    await page.waitForTimeout(500);
  } else {
    check("score history opens from the score header", false);
  }
  if (await page.locator(tid("quit-game-button")).count()) {
    await page.locator(tid("quit-game-button")).click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1200);
    check("quit button leaves the table", !/\/game\//.test(page.url()), page.url());
  }
  await ctx.close();

  // ---------- first deal at other sizes ----------
  for (const v of [{ width: 640, height: 360 }, { width: 915, height: 412 }, { width: 1280, height: 800 }]) {
    const g = await startSoloGame(browser, v);
    await waitDealt(g.page);
    await g.page.waitForTimeout(600);
    const n = (await handIds(g.page)).length;
    check(`[${v.width}x${v.height}] table renders with 8 cards and 4 seats`,
      n === 8 && (await g.page.locator('[data-testid^="seat-avatar-"]').count()) === 4);
    const fan = await g.page.locator(tid("hand-fan")).boundingBox();
    check(`[${v.width}x${v.height}] hand fan inside the viewport`, !!fan && fan.x >= 0 && fan.x + fan.width <= v.width + 1 && fan.y + fan.height <= v.height + 1);
    await shot(g.page, `size-${v.width}x${v.height}`);
    await g.ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed (${label}, ${baseUrl})`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("SMOKE ERROR", e);
  process.exit(2);
});
