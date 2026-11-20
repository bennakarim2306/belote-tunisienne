// Design tokens — "Emerald Tunisian Anime Arena".
// Only used when ANIME_THEME_ENABLED is on; the original tokens in
// src/theme.ts are left untouched. Fonts, spacing and radii are shared with
// the original theme (F, SP, R) so no new font files are needed.
export const A = {
  // emerald family
  emeraldInk: "#03231C", // darkest — vignette, deep shadows
  emeraldDeep: "#063F32", // base wall
  emeraldSurface: "#095442", // raised panels
  emeraldBright: "#0E7A5C", // highlights / hero panel
  jade: "#18A77C", // glow accents
  // gold family
  goldDark: "#8A6A2B", // gold in shadow
  gold: "#D6AC56", // primary trim
  goldLight: "#F4D68C", // lit edges, titles
  goldLine: "rgba(214,172,86,0.65)",
  goldFaint: "rgba(214,172,86,0.28)",
  // neutrals
  ivory: "#FFF5DF", // primary text
  ivoryDim: "rgba(255,245,223,0.82)", // secondary text
  ink: "#17130E", // near-black brown
  inkPanel: "rgba(23,19,14,0.88)", // dark panel fill over the arena
  // accents
  red: "#D92932", // Tunisian-flag red — used sparingly
  amber: "#FFA02E", // existing copper/orange action blocks (kept)
  amberDeep: "#E96D00",
  mint: "#00E57A", // existing brand mint (resume pill, online state)
  // townscape through the arches
  sky: "#BFE3E0",
  skyWarm: "#F6E7C1",
  townWhite: "#F7F4EA",
  townBlue: "#2F7FB8",
};

/** Soft gold glow for framed panels. */
export const goldGlow = {
  shadowColor: A.gold,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 6,
};
