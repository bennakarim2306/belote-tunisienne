# Anime Duel Redesign — Testing

Everything here is local. Nothing pushes, deploys or touches the production backend.

## 1. Turn the redesign on / off

The flag is `EXPO_PUBLIC_ANIME_THEME` (read in `frontend/src/anime/flags.ts`). **Default: off.**

- On: add `EXPO_PUBLIC_ANIME_THEME=1` to `frontend/.env.local` (git-ignored), or set it inline.
- Off: remove the line or set it to `0`. The original screen renders unchanged.
- Expo inlines `EXPO_PUBLIC_*` at bundle time: restart Metro after changing it
  (`npx expo start --clear` if the old look sticks).

PowerShell, from `frontend/`:

```powershell
$env:EXPO_PUBLIC_ANIME_THEME = "1"; npx expo start
```

## 2. Automated checks

From `frontend/`:

```powershell
npx tsc --noEmit
npx expo lint
```

Baseline on `main` (e956901), before any change: `tsc` reports 6 errors
(`app/room/[code].tsx` ×3, `src/components/game/TrickArea.tsx` ×2, `src/i18n.tsx` ×1), lint reports
0 errors and 1 warning (`app/game/[id].tsx:382`). The redesign must not add to either.
There is no JS unit-test runner in this project.

## 3. Home screen smoke test + screenshots (web build, mock data)

Runs the real app code in a browser against a **local mock backend** with fake demo data
(`demo_joueur`, ELO 1063, 3 online, one game in progress). No real account is used.

Terminal 1 — mock backend:

```powershell
node scripts/anime/mock-backend.js
```

Terminal 2 — app with the redesign on (use `"0"` and another port for the original look):

```powershell
$env:EXPO_PUBLIC_BACKEND_URL = "http://127.0.0.1:8787"; $env:EXPO_PUBLIC_ANIME_THEME = "1"; $env:CI = "1"; npx expo start --web --port 8090
```

Terminal 3 — smoke test. `playwright-core` is not a project dependency; point `PLAYWRIGHT_CORE`
at any existing copy. It drives the installed Microsoft Edge.

```powershell
$env:PLAYWRIGHT_CORE = "<path to>\node_modules\playwright-core"; node scripts/anime/smoke-home.js http://localhost:8090 anime ..\docs\anime\screenshots\stage1
```

What it asserts, at 844×390, 640×360, 915×412, 740×340 and 1280×800:

- the four tiles form a 2×2 grid (online | IA on top, apprendre | privée below), equal sizes, inside the viewport, each side ≥ 76px;
- the top bar keeps menu button, avatar, ELO pill, bell and the resume pill;
- labels and live values come from the app (username, ELO, online count, scores, "Entraînement");
- Jouer en ligne and Jouer contre l'IA open the match-type sheet; Partie privée opens join/create, and Créer leads to the timer option;
- the bell opens notifications, the hamburger opens the side menu with 4 destinations;
- Apprendre à jouer navigates to `/tutorial`; the resume pill navigates to `/game/<id>`.

Note: with `CI=1` Metro does not watch files; restart it after editing code.

## 4. Manual checks on a device (not yet done — see progress doc)

1. Development build or Expo Go on Android and iOS, landscape, flag on.
2. Home: arches, lanterns and lattice render; no clipped text; notch/safe areas respected on both sides.
3. Tap each of the four tiles, the bell, the hamburger and (with an unfinished game) the resume pill.
4. In a native build: the AdMob banner still loads at the bottom in its usual slot and the grid shrinks to make room.
5. Switch language to Arabic and English in the profile: labels still fit.
6. Flag off: the original home is back, pixel-for-pixel.

## 5. Game table smoke test + screenshots (web build)

Same three terminals as section 3 (add `--offline` to `expo start` if it exits with "Body is unusable").
The script starts "Jouer contre l'IA" and plays one real hand against the bots on the app's own
offline engine:

```powershell
$env:PLAYWRIGHT_CORE = "<path to>\node_modules\playwright-core"; node scripts/anime/smoke-game.js http://localhost:8090 anime ..\docs\anime\screenshots\stage2
```

It asserts: exactly 8 valid, distinct cards dealt; 4 seats; score header with live text; quit, sound
and chat controls; the bidding panel appears on my turn and a bid can be announced; the contract chip
appears; cards can be played; never more than 8 cards in hand or 4 in a trick; the hand reaches its
end screen; quit returns home; and the table renders at 640×360, 915×412 and 1280×800.
Run it against the flag-off server too: the same 24 checks must pass with the original look.

## 6. Art sets

`EXPO_PUBLIC_ANIME_ART=v1` shows the painted portraits and painted court figures; anything else (default)
shows art set v2 (caricature portraits, classic double-headed courts). Restart Metro with `--clear` after
changing it. Run `smoke-game.js` for each set.

## Windows opened from home

Start the mock with `MOCK_NOTIFS=1`, then `node scripts/anime/smoke-windows.js <url> <anime|original> <outDir>`.
Run the browser tests one at a time.

`smoke-bots.js <url> <anime|original> <outDir>` starts 12 offline games and checks the bots' names and portraits.
`smoke-match.js` needs up to 5 minutes.

`smoke-design.js <url> <anime|original> <outDir>` tests the design switch (there and back, restart, saved game, no network,
hanging network, storage failure). It answers the external portrait requests itself, so portraits are plain green there.

`smoke-lobby.js <url> <anime|original> <outDir>`: matchmaking, private room, join, share and their windows (`DESIGN=classic` tests
the old design chosen by the toggle). `shoot-views.js <url> <outDir>` photographs all views outside home and table.

`smoke-tutorial.js <url> <anime|original> <outDir>`: lesson list and pages, progress stored, listen / stop, locked lessons, final game.

`smoke-social.js <url> <anime|original> <outDir>`: ranking (solo / duo, scrolling, empty) and friends (filter, requests, search, add,
invite to a game, share, empty).

`smoke-profile.js <url> <anime|original> <outDir>`: head card, avatar choice saved, statistics, chart, sound switch stored, design
switch, language, feedback (mood, text, sent, thanks), delete window (cancel, confirm), log out.
