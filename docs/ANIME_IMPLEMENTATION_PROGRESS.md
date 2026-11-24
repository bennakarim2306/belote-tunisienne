# Anime Duel Redesign — Implementation Progress

Branch: `feature/anime-duel-redesign` (local only, created from `main` @ e956901, no upstream).
The GameFX branch `feature/gamefx-integration-phase6` (one local commit ahead of `main`) is **not**
part of this work and was not merged or modified.

| Stage | Scope | Status | Approval |
|---|---|---|---|
| 0 | Discovery and design audit | Done (2026-11-20) | — |
| 1 | Home screen only | Done, with painted assets | **Approved by Karim 2026-11-20** ("works! i tested!", tested on his Android phone) |
| 2 | Gameplay table | Started 2026-11-20 at his request: asset list and prompts in `docs/ANIME_ASSET_BRIEF_GAME.md`; waiting for the assets, no code yet | — |
| 3 | Quit dialog, profile, avatar picker | Not started | — |
| 4 | Asset finalization, cross-screen QA | Not started | — |

## Stage 0 — results

See `docs/ANIME_DESIGN.md` §1 (stack, screens, flows, constraints, reference-vs-code differences)
and `docs/ANIME_ASSET_MANIFEST.md`. Baseline checks are recorded in `docs/ANIME_TESTING.md` §2.

## Stage 1 — home screen

### Files

New:

- `frontend/src/anime/flags.ts`
- `frontend/src/anime/tokens.ts`
- `frontend/src/anime/components/ArenaBackground.tsx`
- `frontend/src/anime/components/ArenaMenuTile.tsx`
- `frontend/src/anime/components/TunisianFlagBanner.tsx`
- `frontend/src/anime/home/AnimeHomeMain.tsx`
- `frontend/scripts/anime/mock-backend.js` (dev only)
- `frontend/scripts/anime/smoke-home.js` (dev only)
- `docs/ANIME_*.md`, `docs/anime/screenshots/stage1/*.png`

Modified:

- `frontend/app/(tabs)/home.tsx` — imports the flag and renders `<AnimeHomeMain/>` instead of the
  original header + grid when the flag is on. Original JSX, handlers, modals and styles untouched.
- `frontend/src/components/MenuButton.tsx` — two optional props (`buttonStyle`, `iconColor`).

Not touched: backend, auth, ads (`src/ads/*`, `(tabs)/_layout.tsx`), game engine, i18n, `theme.ts`,
`package.json`, `app.json`, `.env.local`, any other screen.

### Tests run (2026-11-20, Windows, Node 22)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 6 errors, identical to the `main` baseline, none in changed/new files |
| `npx expo lint` | 0 errors, 1 warning, identical to baseline |
| `smoke-home.js`, flag **on** (web build, mock backend, Edge headless) | 54/54 checks passed |
| `smoke-home.js`, flag **off** | 54/54 checks passed, original look confirmed by screenshot |

### Screenshots (real output of the running app, web build, mock account data)

`docs/anime/screenshots/stage1/`: `anime-home-phone-844x390.png`, `anime-home-small-640x360.png`,
`anime-home-tall-915x412.png`, `anime-home-tablet-1280x800.png`, `anime-modal-online.png`,
`original-home-phone-844x390.png` (flag off).

### Incomplete / unverified

- **Not verified on Android or iOS.** No emulator image or device was available; the screenshots are
  from the web build (react-native-web). SVG pattern/gradient rendering, shadows/elevation, safe
  areas and performance still need a device pass.
- **Ad banner not exercised.** AdMob only exists in native builds; the container code is unchanged,
  but the home layout with a loaded banner has not been seen.
- **Background is placeholder vector art**, visibly simpler than the painted concept.
- The three home sheets (match type, private game, notifications) and the side-menu panel keep the
  original espresso styling.
- Wordmark is plain Playfair type, not the italic script lettering of the concept.
- Arabic and English strings not visually checked in the new tiles.
- The repo could not be compared with GitHub during this session (`git ls-remote` failed on a local
  SSL certificate error), so `main` is "as last pulled".

### Decisions made, open for correction

- Resume pill moved before the ELO and shows "Nous x · y Eux" from real scores (matches the
  original screenshot and the concept; `main` code had it one-line, after the ELO).
- "Ahla," greeting, "Entraînement" badge and live online count kept although the concept omits them.
- Flag is off by default so the branch behaves like `main` unless explicitly enabled.

## Stage 1, second pass — painted assets (2026-11-20)

Karim reviewed the first pass on his Android phone (Expo Go): layout correct, but flat next to the
concept because the art was drawn in code. He supplied five generated images (background, two
button panels, wordmark, flag banner). This pass wires them in.

- New: `frontend/assets/anime/home/*` (21 files), `src/anime/assets.ts`,
  `src/anime/components/NineSlice.tsx`, `scripts/anime/prepare-assets.ps1`, `docs/ANIME_ASSET_BRIEF.md`.
- Rewritten: `ArenaBackground.tsx` (painted image, "cover"), `ArenaMenuTile.tsx` (9-slice painted
  frame + code glow), `AnimeHomeMain.tsx` (logo and flag images, grid inset derived from the background).
- Removed: `TunisianFlagBanner.tsx` (vector) and the vector background.
- Fixed: the "Entraînement" badge covered the end of "Jouer contre l'IA" on his phone; it now sits
  under the description.
- Checks: `tsc` 6 errors (baseline, none in changed files), lint 0 errors / 1 baseline warning,
  smoke test 54/54 with the flag on and 54/54 with it off. Screenshots in
  `docs/anime/screenshots/stage1/` were retaken (web build, mock data).
- Still unverified: this second pass on a real device (9-slice seams, image memory, glow on Android),
  the AdMob banner layout in a native build, Arabic/English strings. On tablets the arches are
  cropped out of the background. Licence of the generated images to be confirmed by Karim.
- Status: **awaiting Karim's visual approval of the home screen.**

## Stage 2 — game table (2026-11-20)

Karim supplied 11 table assets and 12 character portraits. Implemented behind the same flag.

- New: `frontend/assets/anime/game/*`, `frontend/assets/anime/avatars/*`, `src/anime/components/HSlice.tsx`,
  `src/anime/game/TableBackdrop.tsx`, `scripts/anime/prepare-game-assets.ps1`, `scripts/anime/smoke-game.js`;
  game section in `src/anime/assets.ts`.
- Modified (every change guarded by `ANIME_THEME_ENABLED`, original rendering untouched when off):
  - `app/game/[id].tsx`: painted backdrop instead of gradient/pattern; painted icon buttons (quit, pause,
    sound, chat), "Dernier pli" button, score header and contract chip. A red dot on the contract chip
    replaces the original red border meaning "their contract".
  - `src/components/game/PlayerSeat.tsx`: painted medallion frame, name plaque, card-back fan with the
    real card count; turn ring enlarged to stay visible around the frame.
  - `src/components/game/BiddingPanel.tsx`: painted panel and buttons (Passer dark, Capot/Annoncer/Jouer
    green, Contrer/Surcontrer red). The pulsing gold "your turn" border is kept.
  - `src/components/game/DealAnimation.tsx`: painted card back.
  - `src/avatars.ts` + `src/components/Avatar.tsx` + one line in `app/(tabs)/profile.tsx`: new
    `avatarSource(id)`; with the flag on the 12 avatar ids show the painted portraits everywhere,
    with it off the DiceBear images exactly as before.
- Not touched: engine, AI, sockets, rules, card faces (`PlayingCard.tsx`), hand fan, trick area logic,
  ads, backend.
- Checks: `tsc` 6 errors (baseline, none in changed files), lint 0 errors / 1 baseline warning.
  `smoke-game.js` (one full real hand vs bots): 24/24 with the flag on, 24/24 with it off.
  `smoke-home.js` regression: 54/54 on and off. Screenshots in `docs/anime/screenshots/stage2/`.
- Unverified / open:
  - Not yet seen on a phone (frames, 3-slice seams, image memory, Android rendering).
  - Online games (server bots and real players, timers, pause, chat bubbles) were not played; only the
    offline solo engine was exercised.
  - Bot names and bot avatars are picked independently at random (existing behaviour in
    `useLocalGame.ts` and on the server), so a bot called "Aziza" can now show a man's portrait. Needs a
    decision from Karim; not changed.
  - Hand-end, match-end, last-trick, score-history, pause, chat and quit windows keep the original style
    (quit dialog is Stage 3).
  - `hud_crest.png` is prepared but unused.
- Status: **awaiting Karim's visual approval of the game table.**

## Stage 2 addition — card design (2026-11-20)

Requested by Karim: queen as an Arabic dancer, jack as an original young adventurer, king as a sultan.

- `src/components/PlayingCard.tsx` (flag-guarded): painted ivory face under the vector content; court
  cards show one large upright painted figure instead of the mirrored vector bust; face-down cards use
  the painted back. Indices, pips, number cards, aces and the gold trump border are unchanged vector.
  Karim asked about whole-body figures; agreed direction is waist-up, one figure, not mirrored.
- New assets in `frontend/assets/anime/cards/`; `prepare-game-assets.ps1` handles them and no longer
  aborts when an existing output file is locked.
- Bidding buttons: label padding reduced so "Annoncer 100♥" stays on one line.
- Checks: `tsc` baseline, lint baseline, `smoke-game.js` 24/24 on and 24/24 off.
- Unverified: `react-native-svg` `<Image>` inside the card SVG is confirmed on web only; it must be
  checked on Android and iOS (if it fails there, the fallback is a normal image layer under the SVG).
## Art set v2 — caricature characters + classic courts (2026-11-23)

Requested by Karim: comedy caricature manga characters, and classic French Valet / Dame / Roi.

- New switch `EXPO_PUBLIC_ANIME_ART` in `src/anime/flags.ts`: `v2` (default) or `v1` (previous painted set).
  Both sets are in the bundle; nothing from v1 was removed.
- `src/anime/assets.ts`: `AVATAR_PORTRAITS` now picks v1 or v2; new `CLASSIC_COURTS`.
- `src/components/PlayingCard.tsx`: `ClassicCourtFace` — thin gilt frame, painted upper half standing on
  the centre line, the same half rotated 180° below, small vector suit pip beside the head. Corner
  indices (V / D / R), pips and number cards unchanged.
- `BiddingPanel.tsx`: the Annoncer button is wider in anime mode so "Annoncer 110♥" fits on one line.
- Checks: `tsc` baseline (6), lint baseline (0 errors, 1 warning). `smoke-game.js` 24/24 for v2, v1 and
  flag off; `smoke-home.js` 54/54 for v2.
- Still unverified on a phone (SVG image rendering in cards on Android/iOS, see previous section).
- Same three figures for all four suits; a real French deck has 12 distinct courts (possible follow-up).
- Bot name / portrait mismatch is more visible with caricatures (e.g. bot "Baya" with Docteur Hichem's face);
  still waiting for Karim's decision.
## Game view windows and labels (2026-11-23)

Karim approved art set v2 on his phone ("matches my expectations") and asked for four game-view parts to be
redesigned: score history, quick chat, last trick, the "À toi de jouer !" banner and the bid/contract bubbles.
Prompts for 9 images were sent; the code is built first with stand-ins so the images only need to be swapped.

- `src/anime/assets.ts`: slots `MODAL_FRAME`, `TITLE_RIBBON`, `SCORE_ROW`, `CHAT_CHIP`, `EMOJI_TILE`,
  `WINNER_CREST`, `TURN_BANNER`, `BUBBLE_BID`, `BUBBLE_CONTRACT` — currently existing assets or `null`
  (coded fallback). Replace each with the painted file when delivered.
- New `src/anime/game/AnimeUI.tsx`: window frame, title ribbon, painted button.
- `app/game/[id].tsx` (flag-guarded): score history, quick chat and last trick use the painted window,
  ribbon title and painted "Fermer"; trick winner gets a gold glow and a crest; turn banner styling.
  New testID `last-trick-winner-card` (both modes).
- `src/components/game/PlayerSeat.tsx` (flag-guarded): bid bubble (dark emerald) and contract bubble (gold)
  with a tail toward the avatar; painted bubble images take over when delivered.
- `scripts/anime/smoke-game.js` now also opens the chat, the last trick and the score history: 28/28 with
  the flag on, 28/28 off. `tsc` baseline, lint baseline.
- Status: stand-ins in place, **waiting for Karim's 9 images**.
- Update 2026-11-23: the 9 images arrived and are wired in (ssets/anime/ui/, BubbleSlice.tsx for the
  bubbles). Window frame re-sliced with full edges to remove seams from its gradient. Score-row text inset
  from the end ornaments; winner crest enlarged. smoke-game.js 28/28 on, 28/28 off; smoke-home.js 54/54.
  **Awaiting Karim's review on the phone.**
## Chat stickers (2026-11-23)

Karim's request: quick-chat phrases shown as stickers of the sender's own character with the right
reaction, the existing text in a manga bubble in the user's language; texts must not change.

- Step 1 done: Mokhtar le Malin (av12), 8 stickers.
- New: `src/anime/game/ChatSticker.tsx` (sticker + manga bubble), generated `src/anime/stickers.ts`,
  `scripts/anime/prepare-stickers.ps1`.
- `app/game/[id].tsx` (flag-guarded): chat events keep the message id; `stickerFor(seat)` picks the
  sender's sticker; phrase buttons in the quick-chat sheet show my own sticker; my seat sits above the
  hand fan so my sticker bubble is not hidden; stickers stay 3.6 s instead of 2.8 s.
- `PlayerSeat.tsx`: `chatSticker` / `stickerSide` props; falls back to the old text bubble when the sender's
  character has no stickers yet (and for emojis).
- i18n texts unchanged. `mock-backend.js` accepts `MOCK_AVATAR`. `smoke-game.js` sends a phrase and, with
  `EXPECT_STICKER=1`, checks the sticker: 29/29 on (avatar av12), 29/29 off.
- 2026-11-24: all 12 characters done (av4–av11 from one 4x2 sheet each, cut by slice-sticker-sheet.ps1). Full check: 96/96 stickers present, smoke-game.js 29/29 on and off, smoke-home.js 54/54 on and off, tsc/lint baseline. Stickers total 12.6 MB (compression pass needed before release).
## Safety log

No `git push`, no remote branch, no pull request, no GitHub write, no Emergent/Expo/EAS deployment,
no store submission, no backend or production change. The standalone GameFX repository was not opened.
