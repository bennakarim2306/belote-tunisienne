# Design switch in the profile — plan

Requested by Karim on 2026-11-25: a toggle in the profile to go back to the old design, with a loading animation while
the design changes. Status: parts A and B implemented on 2026-11-25 (browser only, nothing measured on a phone yet); part C comes with the profile.

## Where we are

- The design is chosen when the app is built: `ANIME_THEME_ENABLED` in `src/anime/flags.ts`.
- 15 files read the flag. Seven of them copy it into a file-level `const ANIME` (home, game, DuoSetup, BiddingPanel,
  HandEndModal, PlayerSeat, MenuButton), and VictoryCelebration fixes its colours from it. These
  copies can never change while the app runs.
- Both designs are already in the same code and both sets of images ship in the app, so nothing has to be downloaded for
  the new design. `assets/anime` is 26 MB today.
- The ORIGINAL design uses images from the internet: the DiceBear portraits and one Pexels background. Going back can
  therefore take longer than going forward, and needs a connection the first time, exactly as the original does today.
- React Compiler is off, AsyncStorage and the splash screen are already in the app. No new package is needed.

## How it will work

1. **Two levels.** The build flag stays the master switch. Build flag off: no toggle, app identical to the original.
   Build flag on: the new design is the default and the player may switch.
2. **Stored as a design name, not yes / no** (`"emerald"` or `"classic"`), on the device only. Further designs can be
   added later. No backend change.
3. **Read before the first screen.** The choice is loaded while the splash screen is still visible, so the wrong design
   never flashes. If it cannot be read, the default is used.
4. **Live switch, no app restart.** Screens read the design through one hook (`useDesign()`), code outside screens
   (`avatars.ts`, `useLocalGame.ts`) through one getter. Nothing is remounted, so login, navigation, notifications and
   the ads container stay as they are.
5. **Rule from now on:** no new file-level `const ANIME`. Home steps 3 and 4 and the profile use the hook.

## The change, as the player sees it

1. Profile, next to "Sound effects": a toggle "New design", French / Arabic / English.
2. A full-screen overlay fades in: logo, a card turning once, a progress bar filled by the real number of images
   prepared. No wobble. Taps and the back button are ignored while it is open.
3. Behind it, the images of the target design needed first (home, table, portraits, cards) are prepared. Minimum 0.8 s
   so it does not flicker; after 8 s it continues anyway and remaining images load as usual.
4. The choice is saved, the design swaps under the overlay, the overlay fades out. The player is still in the profile.
5. If saving fails, the design changes for now and a message says it was not saved.

The toggle exists only in the profile, which cannot be opened from the game table, matchmaking or a room screen. A saved
offline game keeps its score and its bot names; only portraits and table change.

## Order of work

| Part | Content | When |
|---|---|---|
| A. Foundation | store, hook, splash loading; convert the 15 files; no visible change | after home step 2 is approved, before step 3 |
| B. Toggle + loading | overlay, image preparation, toggle in the current profile, texts in 3 languages | right after A, needs approval |
| C. Profile redesign | painted toggle and painted loading screen | with the profile step |

No new images are needed for A and B (existing logo, card back, window frame).

## Tests

- All existing browser tests in both designs, by build flag (as today) and by saved choice.
- New test: switch there and back three times, at 844x390 and 640x360; every screen afterwards; reload keeps the choice;
  no network; storage failure; taps during the overlay; resume a saved offline game in the other design; ads container
  not remounted.
- Phone (Karim): time of the first and second switch in both directions, memory on an older phone.

## Decisions (Karim, 2026-11-25)

1. The new design is the default.
2. Parts A and B now, before home step 3.

## Code

`src/anime/design.ts` (store, `useAnime()`, `isAnime()`), `src/anime/DesignSwitchOverlay.tsx` (loading animation), `app/_layout.tsx`
(read at start), `app/(tabs)/profile.tsx` (toggle). Test: `scripts/anime/smoke-design.js`.

The hook is called `useAnime()`. When a third design arrives, screens need a design-specific image table instead of yes / no.
