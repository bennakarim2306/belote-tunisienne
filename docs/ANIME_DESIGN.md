# Belote Tunisienne — Anime Duel Redesign: Design

Art direction: **Emerald Tunisian Anime Arena** (approved brief: `ANIME_REDESIGN_CLAUDE.md`).
Original anime-duel energy meets Tunisian emerald-and-gold architecture. Visual layer only:
no gameplay, backend, auth, ads or GameFX changes.

## 1. Stage 0 audit — what the app actually is

| Area | Finding |
|---|---|
| Stack | Expo SDK 54, React Native 0.81.5, React 19.1, expo-router 6 (typed routes), new architecture on, landscape-locked |
| Styling | Plain `StyleSheet` per screen + central tokens in `frontend/src/theme.ts` (`C`, `F`, `SP`, `R`, `shadow`, `glow`). No styling library |
| Fonts | Space Grotesk, Plus Jakarta Sans, Playfair Display (loaded in `app/_layout.tsx`). Ionicons via `@expo/vector-icons` |
| Graphics libs already installed | `react-native-svg`, `expo-linear-gradient`, `react-native-reanimated`, `expo-image`, `expo-blur` |
| Navigation | Root `Stack` → `(tabs)` group whose tab bar is replaced by a hamburger side menu (`MenuButton`); the tab bar slot only hosts the ad banner |
| Ads | `src/ads/*`: AdMob banner in the `(tabs)` tab-bar slot (`AdBanner`), interstitials, consent gate. Native builds only; nothing renders in Expo Go / web |
| i18n | `src/i18n.tsx`: fr / ar / en. All home labels come from it |
| Tests | No JS test runner in `frontend/package.json` (no jest). Available checks: `tsc --noEmit`, `expo lint`, engine scripts in `frontend/scripts/*.ts` |
| Instructions | No `CLAUDE.md` in the repo. `README.md` is a stub; `design_guidelines.json` describes the original "Midnight Tunisian Café" look |

### Screens and flows

| Route | File | Purpose | Redesign stage |
|---|---|---|---|
| `/` | `app/index.tsx` | Splash / auth redirect | later |
| `/auth` | `app/auth.tsx` | Email, Google (Emergent auth), Apple sign-in | later |
| `/(tabs)/home` | `app/(tabs)/home.tsx` | Top bar + 2×2 mode grid + 3 sheets (match type, private game, notifications) | **Stage 1** |
| `/(tabs)/leaderboard` | `app/(tabs)/leaderboard.tsx` | Ranking | later |
| `/(tabs)/friends` | `app/(tabs)/friends.tsx` | Friends, requests, invites | later |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | Identity, ELO solo/duo, rank, avatar picker, statistics, version | Stage 3 |
| `/matchmaking` | `app/matchmaking.tsx` | Online queue (solo / duo) | later |
| `/room/[code]`, `/join/[code]` | `app/room/[code].tsx`, `app/join/[code].tsx` | Private rooms, deep-link join | later |
| `/game/[id]` | `app/game/[id].tsx` + `src/components/game/*` | Table, HUD, bidding, hand end, quit dialog | Stage 2 (+ quit dialog Stage 3) |
| `/tutorial`, `/tutorial/[step]` | `app/tutorial/*` | Lessons | later |

Home flows (all preserved): online → match-type sheet (solo/duo, short/long) → `/matchmaking`;
vs AI → same sheet → local offline game `/game/[id]`; learn → `/tutorial`; private → join by code
or create (timer option) → `/room/[code]`; bell → notifications sheet (room invites, duo invites,
friend requests); resume pill → `/game/[id]`; hamburger → side menu.

### Reference sheets vs. code (code wins)

- Sheet 01 (home): the original screenshot shows a two-line resume pill ("Partie en cours / Nous 0 · 0 Eux")
  in the middle of the bar. `main` renders a one-line pill after the ELO. The anime bar follows the
  screenshot/concept placement and shows the scores from **real** data (`match_scores`, `my_team`).
- Concept numbers (1045, levels, IDs, win rates) are illustrative. Nothing from them is hard-coded.
- The concept drops "Ahla," the "Entraînement" badge and the live online count; the app has them, so they stay.
- Sheet 06 shows a "player list" that does not exist in the app (the original is the avatar picker). Not built.
- Sheets 02–05 (table A/B, quit dialog, profile) are for Stages 2–3 only.

## 2. Architecture of the redesign

```
frontend/src/anime/
  flags.ts                     ANIME_THEME_ENABLED  (EXPO_PUBLIC_ANIME_THEME=1, default OFF)
  tokens.ts                    palette `A`, goldGlow
  components/
    ArenaBackground.tsx        decorative SVG courtyard (placeholder art, pointerEvents none)
    ArenaMenuTile.tsx          reusable gold-trimmed tile (hero / dark)
    TunisianFlagBanner.tsx     decorative SVG banner
  home/
    AnimeHomeMain.tsx          top bar + 2×2 grid, presentation only
```

- **Switch:** `app/(tabs)/home.tsx` renders `<AnimeHomeMain/>` when the flag is on, otherwise the
  untouched original JSX. All state, handlers, modals, navigation and API calls stay in `home.tsx`.
- **No new dependencies, no native modules, no GameFX.**
- Shared tokens `F` (fonts), `SP`, `R` are reused from `src/theme.ts`; `C` is not modified.
- `MenuButton` gained two optional props (`buttonStyle`, `iconColor`); default rendering is unchanged.

## 3. Tokens (`src/anime/tokens.ts`)

| Token | Value | Use |
|---|---|---|
| `emeraldInk` | `#03231C` | vignette, text on mint |
| `emeraldDeep` | `#063F32` | wall base |
| `emeraldSurface` | `#095442` | raised panels |
| `emeraldBright` | `#0E7A5C` | hero highlights |
| `gold` / `goldLight` / `goldDark` | `#D6AC56` / `#F4D68C` / `#8A6A2B` | trim, titles, shadowed gold |
| `ivory` / `ivoryDim` | `#FFF5DF` / 82% | primary / secondary text |
| `ink` | `#17130E` | dark panels |
| `red` | `#D92932` | Tunisian-flag accent, badges (sparingly) |
| `amber` / `amberDeep` | `#FFA02E` / `#E96D00` | existing orange action blocks (kept) |
| `mint` | `#00E57A` | existing brand mint: resume pill, online state |

Typography: Playfair Display Bold for titles and the wordmark, Plus Jakarta Sans for body,
Space Grotesk for buttons/metrics. No new font files.

## 4. Home screen rules (non-negotiable)

- Four buttons in a **2×2 grid** in landscape: Jouer en ligne | Jouer contre l'IA on top,
  Apprendre à jouer | Partie privée below. Never a single column.
- Top bar: hamburger, (flag, wordmark when width allows), avatar + greeting + username,
  resume pill when a game exists, ELO, bell with badge.
- No large character on the home screen.
- Background art is decorative only and capped at 10.5% of the width per side so the grid keeps room.
- Responsive: wordmark hidden under 780dp width, flag under 700dp, greeting under 620dp;
  title/description/icon sizes scale with tile width; safe-area insets respected on all sides.
- States: press (scale 0.98 + brighter inner frame), hero glow pulse, `accessibilityRole="button"`
  and labels on every control.
- The ad banner stays in the same real container (`(tabs)/_layout.tsx` tab-bar slot), untouched.
