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
