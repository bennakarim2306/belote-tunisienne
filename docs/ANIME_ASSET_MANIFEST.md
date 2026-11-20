# Anime Duel Redesign — Asset Manifest

Status legend: **placeholder** = original but temporary, to be replaced after approval ·
**final** = approved for release · **existing** = already in the app, unchanged.

| Asset | Where | Source / license | Size | Use | Status |
|---|---|---|---|---|---|
| Arena courtyard background (arches, columns, zellige band, lanterns, palms, medina, star lattice) | `frontend/src/anime/components/ArenaBackground.tsx` | Original vector drawing authored in code for this project (react-native-svg). No third-party art, no AI-generated raster | 0 KB binary (code only) | Home background, decorative | **placeholder** — flat vector, not the painted quality of the concept. Replace with a painted/licensed background in Stage 4 |
| Tunisian flag banner | `frontend/src/anime/components/TunisianFlagBanner.tsx` | Original vector drawing of the national flag emblem, authored in code | code only | Top bar decoration | **placeholder** (acceptable as final if approved) |
| "Belote Tunisienne" wordmark | text in `AnimeHomeMain.tsx` | Playfair Display Bold (already bundled, SIL OFL) | — | Top bar | **placeholder** — set in type, not a drawn logo |
| Tile ornaments (inner frame, corner studs, dividers) | `ArenaMenuTile.tsx` | Plain RN views | — | Menu tiles | final candidate |
| Icons (globe, game-controller, school, people, menu, bell, flame, play) | `@expo/vector-icons` Ionicons | Existing dependency (MIT) | — | Same icons as the original screen | **existing** |
| Player avatars | `frontend/src/avatars.ts` (DiceBear "big-smile", remote) | Existing production avatars | — | Top bar avatar | **existing — not replaced.** Anime portraits need an agreed set first (brief §6) |
| Fonts | `frontend/assets/fonts/*` | Existing | — | — | **existing** |

Not supplied / still needed for later stages: painted home background, anime character
portraits, card back/frame art, table surface art. None of the concept collage images are
used as assets in the app; they are styling references only.
