// Painted assets of the anime theme (home screen). Produced from the raw
// generated artwork by scripts/anime/prepare-assets.ps1 — see
// docs/ANIME_ASSET_MANIFEST.md for source, size and status of each file.
import { ImageSourcePropType } from "react-native";

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
export const AVATAR_PORTRAITS: Record<string, ImageSourcePropType> = {
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