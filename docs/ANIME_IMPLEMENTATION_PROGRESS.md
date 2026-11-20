# Anime Duel Redesign — Implementation Progress

Branch: `feature/anime-duel-redesign` (local only, created from `main` @ e956901, no upstream).
The GameFX branch `feature/gamefx-integration-phase6` (one local commit ahead of `main`) is **not**
part of this work and was not merged or modified.

| Stage | Scope | Status | Approval |
|---|---|---|---|
| 0 | Discovery and design audit | Done (2026-11-20) | — |
| 1 | Home screen only | Implemented, **awaiting visual approval** | pending |
| 2 | Gameplay table | Not started (blocked on Stage 1 approval) | — |
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

## Safety log

No `git push`, no remote branch, no pull request, no GitHub write, no Emergent/Expo/EAS deployment,
no store submission, no backend or production change. The standalone GameFX repository was not opened.
