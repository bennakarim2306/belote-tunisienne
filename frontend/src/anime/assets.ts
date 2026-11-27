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
  capRatio: 0.9,
};

/** Speech bubble: fixed caps and centred tail, stretchable body on both sides. */
export interface BubbleSliceSource {
  l: ImageSourcePropType;
  /** body left / right of the tail */
  m: ImageSourcePropType;
  mr: ImageSourcePropType;
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
  mr: require("../../assets/anime/ui/bubble_bid_mr.png"),
  tail: require("../../assets/anime/ui/bubble_bid_tail.png"),
  r: require("../../assets/anime/ui/bubble_bid_r.png"),
  capRatio: 28 / 96,
  tailRatio: 34 / 96,
  body: 0.885,
};
export const BUBBLE_CONTRACT: BubbleSliceSource | null = {
  l: require("../../assets/anime/ui/bubble_contract_l.png"),
  m: require("../../assets/anime/ui/bubble_contract_m.png"),
  mr: require("../../assets/anime/ui/bubble_contract_mr.png"),
  tail: require("../../assets/anime/ui/bubble_contract_tail.png"),
  r: require("../../assets/anime/ui/bubble_contract_r.png"),
  capRatio: 28 / 96,
  tailRatio: 34 / 96,
  body: 0.875,
};

// ---------------------------------------------------------------------------
// Alert / result emblems (2026-11-25). Painted by
// prepare-emblems.ps1 (null would show a coded icon).
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
  | "defeat"
  | "pause"
  | "connection"
  | "host"
  | "matchFound"
  | "roomClosed"
  | "declined";
export const EMBLEMS: Record<EmblemKind, ImageSourcePropType | null> = {
  belote: require("../../assets/anime/emblems/belote.png"),
  contre: require("../../assets/anime/emblems/contre.png"),
  surcontre: require("../../assets/anime/emblems/surcontre.png"),
  capot: require("../../assets/anime/emblems/capot.png"),
  redeal: require("../../assets/anime/emblems/redeal.png"),
  made: require("../../assets/anime/emblems/made.png"),
  failed: require("../../assets/anime/emblems/failed.png"),
  victory: require("../../assets/anime/emblems/victory.png"),
  defeat: require("../../assets/anime/emblems/defeat.png"),
  pause: require("../../assets/anime/emblems/pause.png"),
  connection: require("../../assets/anime/emblems/connection.png"),
  host: require("../../assets/anime/emblems/host.png"),
  matchFound: require("../../assets/anime/emblems/match_found.png"),
  roomClosed: require("../../assets/anime/emblems/room_closed.png"),
  declined: require("../../assets/anime/emblems/declined.png"),
};

/** place that still waits for a player */
export const EMPTY_PLAYER: ImageSourcePropType = require("../../assets/anime/emblems/empty_player.png");
/** empty lists */
export const EMPTY_FRIENDS: ImageSourcePropType = require("../../assets/anime/emblems/empty_friends.png");
export const EMPTY_RANKING: ImageSourcePropType = require("../../assets/anime/emblems/empty_ranking.png");
/** backgrounds of the screens outside home and the table */
export const BG_DUEL: ImageSourcePropType = require("../../assets/anime/bg/bg_duel.jpg");
export const BG_SALON: ImageSourcePropType = require("../../assets/anime/bg/bg_salon.jpg");
export const BG_HALL: ImageSourcePropType = require("../../assets/anime/bg/bg_hall.jpg");
export const BG_ENTRY: ImageSourcePropType = require("../../assets/anime/bg/bg_entry.jpg");
/** empty progress bar (3-slice); the fill is drawn by the app */
export const PROGRESS_TRACK: HSliceSource = {
  l: require("../../assets/anime/ui/progress_l.png"),
  c: require("../../assets/anime/ui/progress_c.png"),
  r: require("../../assets/anime/ui/progress_r.png"),
  capRatio: 130 / 126,
};
/** bidding tiles (suits and values) */
export const TILE_BID: ImageSourcePropType = require("../../assets/anime/emblems/tile.png");
export const TILE_BID_ON: ImageSourcePropType = require("../../assets/anime/emblems/tile_on.png");
/** seat badges */
export const BADGE_DEALER: ImageSourcePropType = require("../../assets/anime/emblems/badge_dealer.png");
export const BADGE_BOT: ImageSourcePropType = require("../../assets/anime/emblems/badge_bot.png");

// ---------------------------------------------------------------------------
// Home view icons (2026-11-25), prepare-emblems.ps1 -Folder icons
// ---------------------------------------------------------------------------
export const ICONS = {
  online: require("../../assets/anime/icons/online.png") as ImageSourcePropType,
  solo: require("../../assets/anime/icons/solo.png") as ImageSourcePropType,
  learn: require("../../assets/anime/icons/learn.png") as ImageSourcePropType,
  privateGame: require("../../assets/anime/icons/private.png") as ImageSourcePropType,
  bell: require("../../assets/anime/icons/bell.png") as ImageSourcePropType,
  elo: require("../../assets/anime/icons/elo.png") as ImageSourcePropType,
  resume: require("../../assets/anime/icons/resume.png") as ImageSourcePropType,
  menu: require("../../assets/anime/icons/menu.png") as ImageSourcePropType,
  alone: require("../../assets/anime/icons/alone.png") as ImageSourcePropType,
  duo: require("../../assets/anime/icons/duo.png") as ImageSourcePropType,
  quick: require("../../assets/anime/icons/quick.png") as ImageSourcePropType,
  normal: require("../../assets/anime/icons/normal.png") as ImageSourcePropType,
  timer: require("../../assets/anime/icons/timer.png") as ImageSourcePropType,
  checkOff: require("../../assets/anime/icons/check_off.png") as ImageSourcePropType,
  checkOn: require("../../assets/anime/icons/check_on.png") as ImageSourcePropType,
  arrow: require("../../assets/anime/icons/arrow.png") as ImageSourcePropType,
  home: require("../../assets/anime/icons/home.png") as ImageSourcePropType,
  ranking: require("../../assets/anime/icons/ranking.png") as ImageSourcePropType,
  friends: require("../../assets/anime/icons/friends.png") as ImageSourcePropType,
  profile: require("../../assets/anime/icons/profile.png") as ImageSourcePropType,
  search: require("../../assets/anime/icons/search.png") as ImageSourcePropType,
  addFriend: require("../../assets/anime/icons/add_friend.png") as ImageSourcePropType,
  close: require("../../assets/anime/icons/close.png") as ImageSourcePropType,
  invite: require("../../assets/anime/icons/invite.png") as ImageSourcePropType,
  back: require("../../assets/anime/icons/back.png") as ImageSourcePropType,
  share: require("../../assets/anime/icons/share.png") as ImageSourcePropType,
  link: require("../../assets/anime/icons/link.png") as ImageSourcePropType,
  more: require("../../assets/anime/icons/more.png") as ImageSourcePropType,
  star: require("../../assets/anime/icons/star.png") as ImageSourcePropType,
  sitHere: require("../../assets/anime/icons/sit_here.png") as ImageSourcePropType,
  hourglass: require("../../assets/anime/icons/hourglass.png") as ImageSourcePropType,
  info: require("../../assets/anime/icons/info.png") as ImageSourcePropType,
  lessonTrump: require("../../assets/anime/icons/lesson_trump.png") as ImageSourcePropType,
  lessonValues: require("../../assets/anime/icons/lesson_values.png") as ImageSourcePropType,
  lessonDeal: require("../../assets/anime/icons/lesson_deal.png") as ImageSourcePropType,
  lessonBidding: require("../../assets/anime/icons/lesson_bidding.png") as ImageSourcePropType,
  lessonFollow: require("../../assets/anime/icons/lesson_follow.png") as ImageSourcePropType,
  lessonCut: require("../../assets/anime/icons/lesson_cut.png") as ImageSourcePropType,
  lessonTfaskira: require("../../assets/anime/icons/lesson_tfaskira.png") as ImageSourcePropType,
  lessonScoring: require("../../assets/anime/icons/lesson_scoring.png") as ImageSourcePropType,
  lessonReadBids: require("../../assets/anime/icons/lesson_read_bids.png") as ImageSourcePropType,
  lessonPlayWell: require("../../assets/anime/icons/lesson_play_well.png") as ImageSourcePropType,
  tip: require("../../assets/anime/icons/tip.png") as ImageSourcePropType,
  lock: require("../../assets/anime/icons/lock.png") as ImageSourcePropType,
  done: require("../../assets/anime/icons/done.png") as ImageSourcePropType,
  speaker: require("../../assets/anime/icons/speaker.png") as ImageSourcePropType,
  stop: require("../../assets/anime/icons/stop.png") as ImageSourcePropType,
  chevronDown: require("../../assets/anime/icons/chevron_down.png") as ImageSourcePropType,
  medalGold: require("../../assets/anime/icons/medal_gold.png") as ImageSourcePropType,
  medalSilver: require("../../assets/anime/icons/medal_silver.png") as ImageSourcePropType,
  medalBronze: require("../../assets/anime/icons/medal_bronze.png") as ImageSourcePropType,
  medalPlain: require("../../assets/anime/icons/medal_plain.png") as ImageSourcePropType,
  dotOnline: require("../../assets/anime/icons/dot_online.png") as ImageSourcePropType,
  dotOffline: require("../../assets/anime/icons/dot_offline.png") as ImageSourcePropType,
  accept: require("../../assets/anime/icons/accept.png") as ImageSourcePropType,
  heart: require("../../assets/anime/icons/heart.png") as ImageSourcePropType,
  avatarMirror: require("../../assets/anime/icons/avatar_mirror.png") as ImageSourcePropType,
  statistics: require("../../assets/anime/icons/statistics.png") as ImageSourcePropType,
  soundOn: require("../../assets/anime/icons/sound_on.png") as ImageSourcePropType,
  soundOff: require("../../assets/anime/icons/sound_off.png") as ImageSourcePropType,
  design: require("../../assets/anime/icons/design.png") as ImageSourcePropType,
  language: require("../../assets/anime/icons/language.png") as ImageSourcePropType,
  feedback: require("../../assets/anime/icons/feedback.png") as ImageSourcePropType,
  privacy: require("../../assets/anime/icons/privacy.png") as ImageSourcePropType,
  logout: require("../../assets/anime/icons/logout.png") as ImageSourcePropType,
  delete: require("../../assets/anime/icons/delete.png") as ImageSourcePropType,
  external: require("../../assets/anime/icons/external.png") as ImageSourcePropType,
  warning: require("../../assets/anime/icons/warning.png") as ImageSourcePropType,
  statGames: require("../../assets/anime/icons/stat_games.png") as ImageSourcePropType,
  statWinrate: require("../../assets/anime/icons/stat_winrate.png") as ImageSourcePropType,
  statContracts: require("../../assets/anime/icons/stat_contracts.png") as ImageSourcePropType,
  statStreak: require("../../assets/anime/icons/stat_streak.png") as ImageSourcePropType,
  moodSad: require("../../assets/anime/icons/mood_sad.png") as ImageSourcePropType,
  moodNeutral: require("../../assets/anime/icons/mood_neutral.png") as ImageSourcePropType,
  moodLove: require("../../assets/anime/icons/mood_love.png") as ImageSourcePropType,
  podium: require("../../assets/anime/icons/podium.png") as ImageSourcePropType,
  switchOff: require("../../assets/anime/icons/switch_off.png") as ImageSourcePropType,
  switchOn: require("../../assets/anime/icons/switch_on.png") as ImageSourcePropType,
};
