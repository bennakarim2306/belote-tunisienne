// Design tokens — "Midnight Tunisian Café × E-sport"
// Deep espresso surfaces, electric mint + lantern copper glow. No blues/purples.
export const C = {
  bg: "#120F0D", // deep espresso / obsidian
  bg2: "#1C1714", // surface secondary
  bg3: "#26201B", // surface tertiary
  card: "#1C1714", // elevated card surface
  ink: "#FDFBF9", // primary text on dark
  ink2: "#EDE0D3", // secondary text
  ink3: "#A08D7C", // muted text
  brand: "#00E57A", // electric mint
  brand2: "#FF7B00", // lantern copper
  brand3: "#C23B22", // terracotta
  onBrand: "#051A10", // dark ink on mint / gold
  cream: "#FDFBF9", // light — text & icons over felt/dark
  green: "#00E57A",
  felt: "#0F4D33", // table felt
  feltDark: "#082A1D", // table felt edge / screens
  gold: "#FFB800", // lantern gold
  warning: "#FFB800",
  error: "#FF4444",
  border: "#2E241E",
  borderStrong: "#4A3B30",
  scrim: "rgba(4,3,2,0.74)",
  glowMint: "rgba(0,229,122,0.45)",
  glowCopper: "rgba(255,123,0,0.45)",
  goldSoft: "#E9C46A", // aged gold — ornate text & icons
  goldLine: "rgba(233,196,106,0.55)", // gilded borders
  goldFaint: "rgba(233,196,106,0.22)", // ornamental frames / dividers
};

export const F = {
  display: "SpaceGrotesk", // headings & buttons (gaming display)
  text: "Jakarta", // body
  bold: "JakartaBold",
  extra: "SpaceGroteskMedium", // metrics, scores, codes
  serif: "Playfair", // classic café-lux headings (home cards, table chrome)
  serifSemi: "PlayfairSemi",
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const R = { sm: 6, md: 12, lg: 20, pill: 999 };

export const PATTERN_BG =
  "https://images.pexels.com/photos/30310074/pexels-photo-30310074.jpeg?auto=compress&cs=tinysrgb&w=1080";

export const shadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 6,
};

// Neon glow for flashy gaming accents (buttons, active rings, CTA cards)
export const glow = (color: string) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.65,
  shadowRadius: 14,
  elevation: 10,
});
