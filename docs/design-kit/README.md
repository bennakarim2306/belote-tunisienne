# Design kit

Goal: make a new design (theme) without starting from zero.

- `kit.json`: every image of the design with its role (theme-neutral), format, files and the prompt used for the
  emerald theme (`used`, or `usedIn` = the document that holds it). `rules` are the general prompt rules,
  `sheets` the grids. Order inside a sheet = cell order.
- `theme.emerald.json`: style, palette, motifs and character style of the current design.
- `kit.mjs check`: every app image is covered, every listed file exists, every element has a prompt.
- `kit.mjs prompts <theme.json>`: prints ready prompts for a theme.

## New design, step by step

1. Copy `theme.emerald.json`, change style, palette, motifs, characters.
2. `node docs/design-kit/kit.mjs prompts docs/design-kit/theme.<name>.json > prompts.md`, refine the wording per element.
3. Generate (one conversation per family so the style holds), check every image for clipping and real transparency.
4. Cut and prepare with the scripts in `frontend/scripts/anime/` (`slice-sticker-sheet`, `seam-sticker-sheet` when parts
   touch, `prepare-*`).
5. Run the tests listed in `docs/ANIME_TESTING.md`.

## Limits today

- The app knows one design, chosen when the bundle is built (`EXPO_PUBLIC_ANIME_THEME`). Several designs side by side
  need a theme selected at run time, colours and slice measures per theme, and downloads instead of bundling everything.
- Colours in some components are written directly in code and still have to move into theme tokens.
- Selling designs also needs purchases, ownership per account on the server and the stores' in-app purchase rules.
- Image rights: the generated images need a licence check for commercial sale before anything is sold.
- The raw generated images are not in the repository; keep the originals.
- `bg_home` refers to a brief row, not the exact prompt. The prompts of the raw overview sheet are not stored.

When an image or prompt is added to the app, add it to `kit.json` in the same commit and run `check`.
