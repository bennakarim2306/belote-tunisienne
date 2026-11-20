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
