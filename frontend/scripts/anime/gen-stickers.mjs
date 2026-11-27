#!/usr/bin/env node
// LOCAL dev script: generates the quick-chat stickers through the OpenAI Images
// API instead of copy-pasting prompts into ChatGPT by hand.
//
//   $env:OPENAI_API_KEY = "<your key>"      (set it yourself; never commit it)
//   node scripts/anime/gen-stickers.mjs av3 av4 ...      generate these characters
//   node scripts/anime/gen-stickers.mjs --all-missing     every character without stickers yet
//   node scripts/anime/gen-stickers.mjs av3 --dry-run     print the prompts, call nothing
//
// Options: --quality low|medium|high (default medium)  --model <name> (default gpt-image-1)
//          --force (regenerate files that already exist)
// Each image is generated from the character's caricature portrait
// (scripts/anime/.refs/portraits/avN.png) and saved as
// scripts/anime/.generated/<avN>/<n>_<msgId>.png — then run prepare-stickers.ps1.
// Costs are billed to the API key's account; see OpenAI's pricing page.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, "sticker-prompts.json"), "utf8"));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const DRY = flag("--dry-run");
const FORCE = flag("--force");
const QUALITY = opt("--quality", "medium");
const MODEL = opt("--model", "gpt-image-1");
const optValues = new Set([opt("--quality", ""), opt("--model", "")]);
const stickersDir = path.join(here, "..", "..", "assets", "anime", "stickers");

let targets = args.filter((a) => /^av\d{1,2}$/.test(a) && !optValues.has(a));
if (flag("--all-missing")) {
  targets = Object.keys(cfg.characters).filter(
    (av) => !fs.existsSync(path.join(stickersDir, `${av}_wellPlayed.png`)),
  );
}
if (!targets.length) {
  console.error("Name characters (e.g. av3 av4) or pass --all-missing.");
  process.exit(1);
}
const key = process.env.OPENAI_API_KEY;
if (!DRY && !key) {
  console.error("OPENAI_API_KEY is not set in this terminal.");
  process.exit(1);
}

const fill = (s, c) => {
  const f = c.pronoun === "f";
  return s
    .replaceAll("{name}", c.name)
    .replaceAll("{look}", c.look)
    .replaceAll("{him}", f ? "her" : "him")
    .replaceAll("{his}", f ? "her" : "his")
    .replaceAll("{he}", f ? "she" : "he");
};

async function generate(promptText, portraitPath, outPath) {
  const form = new FormData();
  form.append("model", MODEL);
  form.append("prompt", promptText);
  form.append("size", "1024x1024");
  form.append("quality", QUALITY);
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("n", "1");
  const bytes = fs.readFileSync(portraitPath);
  form.append("image[]", new Blob([bytes], { type: "image/png" }), path.basename(portraitPath));
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (res.ok) {
      const json = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new Error("no image in the response");
      fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
      return;
    }
    const body = await res.text();
    // retry rate limits and server errors; stop on anything else (bad key, policy, billing)
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const wait = 15000 * attempt;
      console.log(`   HTTP ${res.status}, retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

let made = 0, skipped = 0, failed = 0;
for (const av of targets) {
  const c = cfg.characters[av];
  if (!c) { console.error(`unknown character ${av}`); failed++; continue; }
  const portrait = path.join(here, ".refs", "portraits", `${av}.png`);
  if (!fs.existsSync(portrait)) { console.error(`${av}: portrait missing at ${portrait}`); failed++; continue; }
  const outDir = path.join(here, ".generated", av);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n${av} — ${c.name}`);
  for (const [i, r] of cfg.reactions.entries()) {
    const out = path.join(outDir, `${i + 1}_${r.id}.png`);
    if (fs.existsSync(out) && !FORCE) { console.log(`  ${i + 1} ${r.id}: exists, skipped`); skipped++; continue; }
    const promptText = fill(cfg.setup, c) + fill(r.text, c);
    if (DRY) { console.log(`  ${i + 1} ${r.id}: ${promptText}`); continue; }
    process.stdout.write(`  ${i + 1} ${r.id}: generating... `);
    try {
      await generate(promptText, portrait, out);
      console.log("ok");
      made++;
    } catch (e) {
      console.log(`FAILED (${e.message})`);
      failed++;
      if (/HTTP 40[13]/.test(e.message)) { console.error("Stopping: check the API key / account."); process.exit(2); }
    }
  }
}
console.log(`\nDone: ${made} generated, ${skipped} skipped, ${failed} failed.`);
if (!DRY && made) {
  console.log("Next, for each character:");
  for (const av of targets) {
    console.log(`  powershell.exe -ExecutionPolicy Bypass -File scripts\\anime\\prepare-stickers.ps1 -SourceDir scripts\\anime\\.generated\\${av} -Avatar ${av}`);
  }
}
