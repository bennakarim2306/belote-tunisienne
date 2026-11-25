// Painted assets of the anime theme (home screen). Produced from the raw
// generated artwork by scripts/anime/prepare-assets.ps1 — see
// docs/ANIME_ASSET_MANIFEST.md for source, size and status of each file.
import { ImageSourcePropType } from "react-native";

import { ANIME_ART_SET } from "@/src/anime/flags";

export interface NineSliceSource {
  tl: ImageSourcePropType;
  t: ImageSourcePropType;
  tr: ImageSourcePropType;
  l: ImageSourcePropType;
  c: ImageSourcePropType;
  r: ImageSourcePropType;
  bl: ImageSourcePropType;
  b: ImageSourcePropType;
  br: ImageSourcePropType;
  /** on-screen size (dp) of one corner slice */
  corner: number;
}

/** Courtyard background and where its fixed features sit (source pixels). */
export const BG_ARENA = {
  source: require("../../assets/anime/home/bg_arena.jpg") as ImageSourcePropType,
  width: 1870,
  height: 841,
  /** x (from either edge) where arch, column and lantern end and the calm wall begins */
  sideFeatureEnd: 302,
};

export const LOGO = {
  source: require("../../assets/anime/home/logo_belote_tunisienne.png") as ImageSourcePropType,
  aspect: 720 / 307,
};

export const FLAG_BANNER = {
  source: require("../../assets/anime/home/flag_banner.png") as ImageSourcePropType,
  aspect: 240 / 405,
};

export const TILE_HERO: NineSliceSource = {
  tl: require("../../assets/anime/home/tile_hero_tl.png"),
  t: require("../../assets/anime/home/tile_hero_t.png"),
  tr: require("../../assets/anime/home/tile_hero_tr.png"),
  l: require("../../assets/anime/home/tile_hero_l.png"),
  c: require("../../assets/anime/home/tile_hero_c.png"),
  r: require("../../assets/anime/home/tile_hero_r.png"),
  bl: require("../../assets/anime/home/tile_hero_bl.png"),
  b: require("../../assets/anime/home/tile_hero_b.png"),
  br: require("../../assets/anime/home/tile_hero_br.png"),
  corner: 30,
};

export const TILE_DARK: NineSliceSource = {
  tl: require("../../assets/anime/home/tile_dark_tl.png"),
  t: require("../../assets/anime/home/tile_dark_t.png"),
  tr: require("../../assets/anime/home/tile_dark_tr.png"),
  l: require("../../assets/anime/home/tile_dark_l.png"),
  c: require("../../assets/anime/home/tile_dark_c.png"),
  r: require("../../assets/anime/home/tile_dark_r.png"),
  bl: require("../../assets/anime/home/tile_dark_bl.png"),
  b: require("../../assets/anime/home/tile_dark_b.png"),
  br: require("../../assets/anime/home/tile_dark_br.png"),
  corner: 44,
};

// ---------------------------------------------------------------------------
// Game table (Stage 2) — produced by scripts/anime/prepare-game-assets.ps1
// ---------------------------------------------------------------------------

/** Horizontal 3-slice: fixed end caps, stretchable centre. */
export interface HSliceSource {
  l: ImageSourcePropType;
  c: ImageSourcePropType;
  r: ImageSourcePropType;
  /** cap width / image height (caps scale with the rendered height) */
  capRatio: number;
}

export const BG_GAME = require("../../assets/anime/game/bg_game.jpg") as ImageSourcePropType;
export const TABLE_TOP = {
  source: require("../../assets/anime/game/table_top.png") as ImageSourcePropType,
  aspect: 1200 / 566,
};
export const SEAT_FRAME = {
  source: require("../../assets/anime/game/seat_frame.png") as ImageSourcePropType,
  aspect: 360 / 368,
  /** diameter of the transparent hole / frame width */
  hole: 0.717,
};
export const CARD_BACK = require("../../assets/anime/game/card_back.png") as ImageSourcePropType;
export const BTN_ICON_GREEN = require("../../assets/anime/game/btn_icon_green.png") as ImageSourcePropType;
export const BTN_ICON_RED = require("../../assets/anime/game/btn_icon_red.png") as ImageSourcePropType;
export const HUD_CREST = {
  source: require("../../assets/anime/game/hud_crest.png") as ImageSourcePropType,
  aspect: 180 / 107,
};

export const NAMEPLATE: HSliceSource = {
  l: require("../../assets/anime/game/nameplate_l.png"),
  c: require("../../assets/anime/game/nameplate_c.png"),
  r: require("../../assets/anime/game/nameplate_r.png"),
  capRatio: 62 / 96,
};
export const BTN_GREEN: HSliceSource = {
  l: require("../../assets/anime/game/btn_green_l.png"),
  c: require("../../assets/anime/game/btn_green_c.png"),
  r: require("../../assets/anime/game/btn_green_r.png"),
  capRatio: 92 / 120,
};
export const BTN_RED: HSliceSource = {
  l: require("../../assets/anime/game/btn_red_l.png"),
  c: require("../../assets/anime/game/btn_red_c.png"),
  r: require("../../assets/anime/game/btn_red_r.png"),
  capRatio: 92 / 120,
};
export const BTN_DARK: HSliceSource = {
  l: require("../../assets/anime/game/btn_dark_l.png"),
  c: require("../../assets/anime/game/btn_dark_c.png"),
  r: require("../../assets/anime/game/btn_dark_r.png"),
  capRatio: 92 / 120,
};

export const HUD_PANEL: NineSliceSource = {
  tl: require("../../assets/anime/game/hud_panel_tl.png"),
  t: require("../../assets/anime/game/hud_panel_t.png"),
  tr: require("../../assets/anime/game/hud_panel_tr.png"),
  l: require("../../assets/anime/game/hud_panel_l.png"),
  c: require("../../assets/anime/game/hud_panel_c.png"),
  r: require("../../assets/anime/game/hud_panel_r.png"),
  bl: require("../../assets/anime/game/hud_panel_bl.png"),
  b: require("../../assets/anime/game/hud_panel_b.png"),
  br: require("../../assets/anime/game/hud_panel_br.png"),
  corner: 22,
};

/** Anime portraits for the 12 existing avatar ids (same identities as src/avatars.ts). */
const AVATAR_PORTRAITS_V1: Record<string, ImageSourcePropType> = {
  av1: require("../../assets/anime/avatars/av1.jpg"),
  av2: require("../../assets/anime/avatars/av2.jpg"),
  av3: require("../../assets/anime/avatars/av3.jpg"),
  av4: require("../../assets/anime/avatars/av4.jpg"),
  av5: require("../../assets/anime/avatars/av5.jpg"),
  av6: require("../../assets/anime/avatars/av6.jpg"),
  av7: require("../../assets/anime/avatars/av7.jpg"),
  av8: require("../../assets/anime/avatars/av8.jpg"),
  av9: require("../../assets/anime/avatars/av9.jpg"),
  av10: require("../../assets/anime/avatars/av10.jpg"),
  av11: require("../../assets/anime/avatars/av11.jpg"),
  av12: require("../../assets/anime/avatars/av12.jpg"),
};
/** Art set v2: comedy caricature portraits, same 12 identities. */
const AVATAR_PORTRAITS_V2: Record<string, ImageSourcePropType> = {
  av1: require("../../assets/anime/avatars-v2/av1.jpg"),
  av2: require("../../assets/anime/avatars-v2/av2.jpg"),
  av3: require("../../assets/anime/avatars-v2/av3.jpg"),
  av4: require("../../assets/anime/avatars-v2/av4.jpg"),
  av5: require("../../assets/anime/avatars-v2/av5.jpg"),
  av6: require("../../assets/anime/avatars-v2/av6.jpg"),
  av7: require("../../assets/anime/avatars-v2/av7.jpg"),
  av8: require("../../assets/anime/avatars-v2/av8.jpg"),
  av9: require("../../assets/anime/avatars-v2/av9.jpg"),
  av10: require("../../assets/anime/avatars-v2/av10.jpg"),
  av11: require("../../assets/anime/avatars-v2/av11.jpg"),
  av12: require("../../assets/anime/avatars-v2/av12.jpg"),
};

/** Portraits of the active art set (EXPO_PUBLIC_ANIME_ART). */
export const AVATAR_PORTRAITS: Record<string, ImageSourcePropType> =
  ANIME_ART_SET === "v1" ? AVATAR_PORTRAITS_V1 : AVATAR_PORTRAITS_V2;
// ---------------------------------------------------------------------------
// Cards — blank face + court figures (ranks, suits and pips stay vector)
// ---------------------------------------------------------------------------
export const CARD_FACE = require("../../assets/anime/cards/card_face.png") as ImageSourcePropType;
/** one upright waist-up figure per court rank; aspect = width / height */
export const COURT_FIGURES: Record<string, { source: ImageSourcePropType; aspect: number }> = {
  J: { source: require("../../assets/anime/cards/court_jack.png"), aspect: 360 / 395 },
  Q: { source: require("../../assets/anime/cards/court_queen.png"), aspect: 360 / 359 },
  K: { source: require("../../assets/anime/cards/court_king.png"), aspect: 360 / 360 },
};

/** Art set v2: classic French court halves (upper half, mirrored in the card). */
export const CLASSIC_COURTS: Record<string, { source: ImageSourcePropType; aspect: number }> = {
  J: { source: require("../../assets/anime/cards/classic_jack.png"), aspect: 420 / 379 },
  Q: { source: require("../../assets/anime/cards/classic_queen.png"), aspect: 420 / 361 },
  K: { source: require("../../assets/anime/cards/classic_king.png"), aspect: 420 / 331 },
};

// ---------------------------------------------------------------------------
// In-game windows and labels (2026-11-23). Each slot is swapped for Karim's
// painted image once delivered; until then it points at an existing asset or
// is null, and the component falls back to a coded look.
// ---------------------------------------------------------------------------
/** dialog frame for score history, quick chat, last trick (9-slice) */
export const MODAL_FRAME: NineSliceSource = {
  tl: require("../../assets/anime/ui/modal_frame_tl.png"),
  t: require("../../assets/anime/ui/modal_frame_t.png"),
  tr: require("../../assets/anime/ui/modal_frame_tr.png"),
  l: require("../../assets/anime/ui/modal_frame_l.png"),
  c: require("../../assets/anime/ui/modal_frame_c.png"),
  r: require("../../assets/anime/ui/modal_frame_r.png"),
  bl: require("../../assets/anime/ui/modal_frame_bl.png"),
  b: require("../../assets/anime/ui/modal_frame_b.png"),
  br: require("../../assets/anime/ui/modal_frame_br.png"),
  corner: 40,
};
/** title cartouche (3-slice) */
export const TITLE_RIBBON: HSliceSource = {
  l: require("../../assets/anime/ui/title_ribbon_l.png"),
  c: require("../../assets/anime/ui/title_ribbon_c.png"),
  r: require("../../assets/anime/ui/title_ribbon_r.png"),
  capRatio: 0.72,
};
/** score-history row plaque (3-slice) */
export const SCORE_ROW: HSliceSource | null = {
  l: require("../../assets/anime/ui/score_row_l.png"),
  c: require("../../assets/anime/ui/score_row_c.png"),
  r: require("../../assets/anime/ui/score_row_r.png"),
  capRatio: 0.625,
};
/** quick-chat phrase button (3-slice) */
export const CHAT_CHIP: HSliceSource = {
  l: require("../../assets/anime/ui/chat_chip_l.png"),
  c: require("../../assets/anime/ui/chat_chip_c.png"),
  r: require("../../assets/anime/ui/chat_chip_r.png"),
  capRatio: 0.55,
};
/** quick-chat emoji tile (square) */
export const EMOJI_TILE: ImageSourcePropType = require("../../assets/anime/ui/emoji_tile.png");
/** laurel + crown over the card that won the last trick */
export const WINNER_CREST: ImageSourcePropType | null = require("../../assets/anime/ui/winner_crest.png");
/** "À toi de jouer !" scroll banner (3-slice) */
export const TURN_BANNER: HSliceSource | null = {
  l: require("../../assets/anime/ui/turn_banner_l.png"),
  c: require("../../assets/anime/ui/turn_banner_c.png"),
  r: require("../../assets/anime/ui/turn_banner_r.png"),
  capRatio: 0.58,
};

/** Speech bubble: fixed caps and centred tail, stretchable body on both sides. */
export interface BubbleSliceSource {
  l: ImageSourcePropType;
  m: ImageSourcePropType;
  tail: ImageSourcePropType;
  r: ImageSourcePropType;
  /** cap width / height, tail width / height */
  capRatio: number;
  tailRatio: number;
  /** fraction of the height taken by the body (below it: only the tail) */
  body: number;
}
export const BUBBLE_BID: BubbleSliceSource | null = {
  l: require("../../assets/anime/ui/bubble_bid_l.png"),
  m: require("../../assets/anime/ui/bubble_bid_m.png"),
  tail: require("../../assets/anime/ui/bubble_bid_tail.png"),
  r: require("../../assets/anime/ui/bubble_bid_r.png"),
  capRatio: 28 / 96,
  tailRatio: 34 / 96,
  body: 0.885,
};
export const BUBBLE_CONTRACT: BubbleSliceSource | null = {
  l: require("../../assets/anime/ui/bubble_contract_l.png"),
  m: require("../../assets/anime/ui/bubble_contract_m.png"),
  tail: require("../../assets/anime/ui/bubble_contract_tail.png"),
  r: require("../../assets/anime/ui/bubble_contract_r.png"),
  capRatio: 28 / 96,
  tailRatio: 34 / 96,
  body: 0.875,
};

// ---------------------------------------------------------------------------
// Alert / result emblems (2026-11-25). null = coded icon until the painted
// emblem is delivered.
// ---------------------------------------------------------------------------
export type EmblemKind =
  | "belote"
  | "contre"
  | "surcontre"
  | "capot"
  | "redeal"
  | "made"
  | "failed"
  | "victory"
  | "defeat";
export const EMBLEMS: Record<EmblemKind, ImageSourcePropType | null> = {
  belote: null,
  contre: null,
  surcontre: null,
  capot: null,
  redeal: null,
  made: null,
  failed: null,
  victory: null,
  defeat: null,
};
