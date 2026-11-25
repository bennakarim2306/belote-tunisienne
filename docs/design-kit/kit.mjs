#!/usr/bin/env node
// Design kit tool (local, calls nothing on the internet).
//   node docs/design-kit/kit.mjs check                        every app image covered? every listed file there?
//   node docs/design-kit/kit.mjs prompts <theme.json>         ready prompts for a theme (stdout)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const kit = JSON.parse(fs.readFileSync(path.join(here, "kit.json"), "utf8"));
const root = path.join(here, "..", "..", "frontend", "assets", "anime");
const [cmd, arg] = process.argv.slice(2);
const toRe = (g) => new RegExp("^" + g.replace(/[.]/g, "\\.").replace(/\*/g, ".*") + "$");

if (cmd === "check") {
  const files = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
    .flatMap((d) => fs.readdirSync(path.join(root, d.name)).map((f) => `${d.name}/${f}`));
  const uncovered = files.filter((f) => !kit.elements.some((e) => e.files.some((g) => toRe(g).test(f))));
  const missing = kit.elements.flatMap((e) => e.files.filter((g) => !files.some((f) => toRe(g).test(f))).map((g) => `${e.id}: ${g}`));
  const noPrompt = kit.elements.filter((e) => !e.used && !e.usedIn).map((e) => e.id);
  console.log(`${kit.elements.length} elements, ${files.length} image files`);
  console.log("images not covered:", uncovered.length ? uncovered.join(", ") : "none");
  console.log("listed but missing:", missing.length ? missing.join(", ") : "none");
  console.log("without prompt:", noPrompt.length ? noPrompt.join(", ") : "none");
  process.exit(uncovered.length || missing.length || noPrompt.length ? 1 : 0);
} else if (cmd === "prompts") {
  const t = JSON.parse(fs.readFileSync(arg, "utf8"));
  const look = `Style: ${t.style}. Palette: ${t.palette}. Motifs: ${t.motifs}.`;
  console.log(`# ${t.name}: prompts\n\nGenerated from kit.json. Add your own wording per element where the theme needs it.\n`);
  for (const [id, s] of Object.entries(kit.sheets)) {
    const items = kit.elements.filter((e) => e.sheet === id);
    console.log(`## Sheet ${id} (${s.cols} columns, ${s.rows} rows)\n\n\`\`\`\nDraw ONE image: a sheet with ${items.length} separate elements for my card game, in ${s.cols} columns and ${s.rows} rows.\n${look}\n${kit.rules.sheet}\nOrder, left to right, top row first:\n${items.map((e, i) => `${i + 1}. ${e.role}`).join("\n")}\n\`\`\`\n`);
  }
  console.log("## Single images\n");
  for (const e of kit.elements.filter((x) => x.sheet === "single")) {
    const person = e.id.startsWith("avatar_");
    console.log(`### ${e.id}\n\n\`\`\`\n${e.role}. ${e.how}.\n${person ? `Character style: ${t.characters}.` : look}\n${kit.rules.single}${/slice/.test(e.how) ? " " + kit.rules.sliced : ""}\n\`\`\`\n`);
  }
  console.log(`## Stickers (one sheet per character, portrait attached)\n\n\`\`\`\n${kit.rules.stickers}\n\`\`\`\nThe 8 reactions: frontend/scripts/anime/sticker-prompts.json`);
} else {
  console.log("usage: kit.mjs check | prompts <theme.json>");
  process.exit(1);
}
