// Anime Duel Redesign — local feature flag.
//
// OFF by default: without the flag the app renders exactly the original
// "Midnight Tunisian Café" look. Enable locally with
//   EXPO_PUBLIC_ANIME_THEME=1
// (in frontend/.env.local, or inline on the `expo start` command line).
//
// Expo inlines EXPO_PUBLIC_* at bundle time, so the reference below must stay
// a static `process.env.EXPO_PUBLIC_ANIME_THEME` member access.
// See docs/ANIME_DESIGN.md and docs/ANIME_TESTING.md.
const raw = process.env.EXPO_PUBLIC_ANIME_THEME;

export const ANIME_THEME_ENABLED = raw === "1" || raw === "true";


/**
 * Which character / court-card art set the anime theme uses:
 *   "v2" (default) caricature portraits + classic double-headed French courts
 *   "v1"           painted anime portraits + one large painted court figure
 * Switch locally with EXPO_PUBLIC_ANIME_ART=v1. Both sets ship in the bundle.
 */
export type AnimeArtSet = "v1" | "v2";
export const ANIME_ART_SET: AnimeArtSet =
  process.env.EXPO_PUBLIC_ANIME_ART === "v1" ? "v1" : "v2";