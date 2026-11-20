# Anime Duel Redesign — Asset Brief (Stage 1, home screen)

Painted image assets needed to reach the approved concept. The code keeps doing layout, text,
live numbers and touch handling; the images supply the painted look.

## Rules for every asset

- **No text, no numbers, no icons, no avatar, no UI** baked into any image. Labels are rendered
  by the app (French, Arabic, English) and values are live.
- **One asset per file**, not a full-screen mockup. A flattened screenshot cannot be used.
- Same style for all: original anime background-painting look, emerald and jade walls, antique
  gold trim, warm lantern light, Tunisian horseshoe arches and zellige mosaics. No Yu-Gi-Oh!
  frames, characters or logos. No people.
- PNG. Transparent background wherever marked "transparent".
- Drop the files in `frontend/assets/anime/home/` with the file names below.

## Assets

| # | File | What it is | Size (px) | Transparent | Notes |
|---|---|---|---|---|---|
| 1 | `bg_arena.png` | Full home background: emerald courtyard wall with mosaic pattern, a gilded horseshoe arch with column, hanging lantern and palm leaves at the **far left and far right edges**, tiled floor at the bottom | 2400 × 1080 | no | Keep the centre 76% of the width calm and dark (only wall pattern): the four buttons sit there. Keep the top 20% calm and darker: the top bar sits there. It is cropped on narrower screens, so nothing important in the outer 4% |
| 2 | `tile_hero.png` | Empty emerald button panel with glowing jade-green rim and thin gold inner line, rounded corners, small ornamental corners | 1040 × 480 | yes | Completely empty inside. Used for "Jouer en ligne" |
| 3 | `tile_dark.png` | Empty near-black brown button panel with polished gold rim and small ornamental corners | 1040 × 480 | yes | Completely empty inside. Used for the other three buttons. Same outer shape as #2 |
| 4 | `flag_banner.png` | Hanging cloth banner with the Tunisian flag (red field, white disc, red crescent and star), slight fabric folds, gold rod on top | 300 × 520 | yes | Flag emblem must be correct and unmirrored |
| 5 | `logo_belote_tunisienne.png` | Wordmark "Belote Tunisienne" in gold italic lettering on two lines, small laurel branches left and right, four suit symbols ♥ ♠ ♦ ♣ underneath | 900 × 420 | yes | The only asset that contains text. Check the spelling exactly |
| 6 | `pill_frame.png` | Empty dark-emerald pill/capsule frame with thin gold rim | 600 × 160 | yes | Used behind username and ELO. Empty inside |
| 7 | `btn_round_frame.png` | Empty round dark-emerald button with gold rim | 200 × 200 | yes | Used behind the bell |
| 8 | `btn_square_frame.png` | Empty rounded-square dark-emerald button with gold rim | 200 × 200 | yes | Used behind the menu button |

Optional, later: icon wells (emerald glass square, amber square) if the current ones should be painted too.

## Prompt starter (adapt per row)

> Original anime-style game UI asset, painted, high detail. [ROW DESCRIPTION]. Palette: deep emerald
> #063F32, jade, antique gold #D6AC56 and light gold #F4D68C, warm ivory, near-black brown #17130E.
> Tunisian architecture motifs (horseshoe arches, zellige mosaic). No text, no letters, no numbers,
> no characters, no people, no icons. [Transparent background, isolated object, front view.] Exact
> canvas [W × H].

## What happens after delivery

Each file is checked (size, transparency, no stray text), recorded in
`docs/ANIME_ASSET_MANIFEST.md` with its source and license, compressed, and wired into the
existing components behind the same feature flag. Panels #2, #3, #6 are stretched with fixed
corners, so their corner ornaments must stay inside the outer 12% of each side.
