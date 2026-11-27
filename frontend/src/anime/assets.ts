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
  source: require("../../assets/anime/home/logo_belote_tunisienne.webp") as ImageSourcePropType,
  aspect: 720 / 307,
};

export const FLAG_BANNER = {
  source: require("../../assets/anime/home/flag_banner.webp") as ImageSourcePropType,
  aspect: 240 / 405,
};

export const TILE_HERO: NineSliceSource = {
  tl: require("../../assets/anime/home/tile_hero_tl.webp"),
  t: require("../../assets/anime/home/tile_hero_t.webp"),
  tr: require("../../assets/anime/home/tile_hero_tr.webp"),
  l: require("../../assets/anime/home/tile_hero_l.webp"),
  c: require("../../assets/anime/home/tile_hero_c.webp"),
  r: require("../../assets/anime/home/tile_hero_r.webp"),
  bl: require("../../assets/anime/home/tile_hero_bl.webp"),
  b: require("../../assets/anime/home/tile_hero_b.webp"),
  br: require("../../assets/anime/home/tile_hero_br.webp"),
  corner: 30,
};

export const TILE_DARK: NineSliceSource = {
  tl: require("../../assets/anime/home/tile_dark_tl.webp"),
  t: require("../../assets/anime/home/tile_dark_t.webp"),
  tr: require("../../assets/anime/home/tile_dark_tr.webp"),
  l: require("../../assets/anime/home/tile_dark_l.webp"),
  c: require("../../assets/anime/home/tile_dark_c.webp"),
  r: require("../../assets/anime/home/tile_dark_r.webp"),
  bl: require("../../assets/anime/home/tile_dark_bl.webp"),
  b: require("../../assets/anime/home/tile_dark_b.webp"),
  br: require("../../assets/anime/home/tile_dark_br.webp"),
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
  source: require("../../assets/anime/game/table_top.webp") as ImageSourcePropType,
  aspect: 1200 / 566,
};
export const SEAT_FRAME = {
  source: require("../../assets/anime/game/seat_frame.webp") as ImageSourcePropType,
  aspect: 360 / 368,
  /** diameter of the transparent hole / frame width */
  hole: 0.717,
};
export const CARD_BACK = require("../../assets/anime/game/card_back.webp") as ImageSourcePropType;
export const BTN_ICON_GREEN = require("../../assets/anime/game/btn_icon_green.webp") as ImageSourcePropType;
export const BTN_ICON_RED = require("../../assets/anime/game/btn_icon_red.webp") as ImageSourcePropType;
export const HUD_CREST = {
  source: require("../../assets/anime/game/hud_crest.webp") as ImageSourcePropType,
  aspect: 180 / 107,
};

export const NAMEPLATE: HSliceSource = {
  l: require("../../assets/anime/game/nameplate_l.webp"),
  c: require("../../assets/anime/game/nameplate_c.webp"),
  r: require("../../assets/anime/game/nameplate_r.webp"),
  capRatio: 62 / 96,
};
export const BTN_GREEN: HSliceSource = {
  l: require("../../assets/anime/game/btn_green_l.webp"),
  c: require("../../assets/anime/game/btn_green_c.webp"),
  r: require("../../assets/anime/game/btn_green_r.webp"),
  capRatio: 92 / 120,
};
export const BTN_RED: HSliceSource = {
  l: require("../../assets/anime/game/btn_red_l.webp"),
  c: require("../../assets/anime/game/btn_red_c.webp"),
  r: require("../../assets/anime/game/btn_red_r.webp"),
  capRatio: 92 / 120,
};
export const BTN_DARK: HSliceSource = {
  l: require("../../assets/anime/game/btn_dark_l.webp"),
  c: require("../../assets/anime/game/btn_dark_c.webp"),
  r: require("../../assets/anime/game/btn_dark_r.webp"),
  capRatio: 92 / 120,
};

export const HUD_PANEL: NineSliceSource = {
  tl: require("../../assets/anime/game/hud_panel_tl.webp"),
  t: require("../../assets/anime/game/hud_panel_t.webp"),
  tr: require("../../assets/anime/game/hud_panel_tr.webp"),
  l: require("../../assets/anime/game/hud_panel_l.webp"),
  c: require("../../assets/anime/game/hud_panel_c.webp"),
  r: require("../../assets/anime/game/hud_panel_r.webp"),
  bl: require("../../assets/anime/game/hud_panel_bl.webp"),
  b: require("../../assets/anime/game/hud_panel_b.webp"),
  br: require("../../assets/anime/game/hud_panel_br.webp"),
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
export const CARD_FACE = require("../../assets/anime/cards/card_face.webp") as ImageSourcePropType;
/** one upright waist-up figure per court rank; aspect = width / height */
export const COURT_FIGURES: Record<string, { source: ImageSourcePropType; aspect: number }> = {
  J: { source: require("../../assets/anime/cards/court_jack.webp"), aspect: 360 / 395 },
  Q: { source: require("../../assets/anime/cards/court_queen.webp"), aspect: 360 / 359 },
  K: { source: require("../../assets/anime/cards/court_king.webp"), aspect: 360 / 360 },
};

/** Art set v2: classic French court halves (upper half, mirrored in the card). */
export const CLASSIC_COURTS: Record<string, { source: ImageSourcePropType; aspect: number }> = {
  J: { source: require("../../assets/anime/cards/classic_jack.webp"), aspect: 420 / 379 },
  Q: { source: require("../../assets/anime/cards/classic_queen.webp"), aspect: 420 / 361 },
  K: { source: require("../../assets/anime/cards/classic_king.webp"), aspect: 420 / 331 },
};

// ---------------------------------------------------------------------------
// In-game windows and labels (2026-11-23). Each slot is swapped for Karim's
// painted image once delivered; until then it points at an existing asset or
// is null, and the component falls back to a coded look.
// ---------------------------------------------------------------------------
/** dialog frame for score history, quick chat, last trick (9-slice) */
export const MODAL_FRAME: NineSliceSource = {
  tl: require("../../assets/anime/ui/modal_frame_tl.webp"),
  t: require("../../assets/anime/ui/modal_frame_t.webp"),
  tr: require("../../assets/anime/ui/modal_frame_tr.webp"),
  l: require("../../assets/anime/ui/modal_frame_l.webp"),
  c: require("../../assets/anime/ui/modal_frame_c.webp"),
  r: require("../../assets/anime/ui/modal_frame_r.webp"),
  bl: require("../../assets/anime/ui/modal_frame_bl.webp"),
  b: require("../../assets/anime/ui/modal_frame_b.webp"),
  br: require("../../assets/anime/ui/modal_frame_br.webp"),
  corner: 40,
};
/** title cartouche (3-slice) */
export const TITLE_RIBBON: HSliceSource = {
  l: require("../../assets/anime/ui/title_ribbon_l.webp"),
  c: require("../../assets/anime/ui/title_ribbon_c.webp"),
  r: require("../../assets/anime/ui/title_ribbon_r.webp"),
  capRatio: 0.72,
};
/** score-history row plaque (3-slice) */
export const SCORE_ROW: HSliceSource | null = {
  l: require("../../assets/anime/ui/score_row_l.webp"),
  c: require("../../assets/anime/ui/score_row_c.webp"),
  r: require("../../assets/anime/ui/score_row_r.webp"),
  capRatio: 0.625,
};
/** quick-chat phrase button (3-slice) */
export const CHAT_CHIP: HSliceSource = {
  l: require("../../assets/anime/ui/chat_chip_l.webp"),
  c: require("../../assets/anime/ui/chat_chip_c.webp"),
  r: require("../../assets/anime/ui/chat_chip_r.webp"),
  capRatio: 0.55,
};
/** quick-chat emoji tile (square) */
export const EMOJI_TILE: ImageSourcePropType = require("../../assets/anime/ui/emoji_tile.webp");
/** laurel + crown over the card that won the last trick */
export const WINNER_CREST: ImageSourcePropType | null = require("../../assets/anime/ui/winner_crest.webp");
/** "À toi de jouer !" scroll banner (3-slice) */
export const TURN_BANNER: HSliceSource | null = {
  l: require("../../assets/anime/ui/turn_banner_l.webp"),
  c: require("../../assets/anime/ui/turn_banner_c.webp"),
  r: require("../../assets/anime/ui/turn_banner_r.webp"),
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
  l: require("../../assets/anime/ui/bubble_bid_l.webp"),
  m: require("../../assets/anime/ui/bubble_bid_m.webp"),
  mr: require("../../assets/anime/ui/bubble_bid_mr.webp"),
  tail: require("../../assets/anime/ui/bubble_bid_tail.webp"),
  r: require("../../assets/anime/ui/bubble_bid_r.webp"),
  capRatio: 28 / 96,
  tailRatio: 34 / 96,
  body: 0.885,
};
export const BUBBLE_CONTRACT: BubbleSliceSource | null = {
  l: require("../../assets/anime/ui/bubble_contract_l.webp"),
  m: require("../../assets/anime/ui/bubble_contract_m.webp"),
  mr: require("../../assets/anime/ui/bubble_contract_mr.webp"),
  tail: require("../../assets/anime/ui/bubble_contract_tail.webp"),
  r: require("../../assets/anime/ui/bubble_contract_r.webp"),
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
  belote: require("../../assets/anime/emblems/belote.webp"),
  contre: require("../../assets/anime/emblems/contre.webp"),
  surcontre: require("../../assets/anime/emblems/surcontre.webp"),
  capot: require("../../assets/anime/emblems/capot.webp"),
  redeal: require("../../assets/anime/emblems/redeal.webp"),
  made: require("../../assets/anime/emblems/made.webp"),
  failed: require("../../assets/anime/emblems/failed.webp"),
  victory: require("../../assets/anime/emblems/victory.webp"),
  defeat: require("../../assets/anime/emblems/defeat.webp"),
  pause: require("../../assets/anime/emblems/pause.webp"),
  connection: require("../../assets/anime/emblems/connection.webp"),
  host: require("../../assets/anime/emblems/host.webp"),
  matchFound: require("../../assets/anime/emblems/match_found.webp"),
  roomClosed: require("../../assets/anime/emblems/room_closed.webp"),
  declined: require("../../assets/anime/emblems/declined.webp"),
};

/** place that still waits for a player */
export const EMPTY_PLAYER: ImageSourcePropType = require("../../assets/anime/emblems/empty_player.webp");
/** empty lists */
export const EMPTY_FRIENDS: ImageSourcePropType = require("../../assets/anime/emblems/empty_friends.webp");
export const EMPTY_RANKING: ImageSourcePropType = require("../../assets/anime/emblems/empty_ranking.webp");
/** backgrounds of the screens outside home and the table */
export const BG_DUEL: ImageSourcePropType = require("../../assets/anime/bg/bg_duel.jpg");
export const BG_SALON: ImageSourcePropType = require("../../assets/anime/bg/bg_salon.jpg");
export const BG_HALL: ImageSourcePropType = require("../../assets/anime/bg/bg_hall.jpg");
export const BG_ENTRY: ImageSourcePropType = require("../../assets/anime/bg/bg_entry.jpg");
/** empty progress bar (3-slice); the fill is drawn by the app */
export const PROGRESS_TRACK: HSliceSource = {
  l: require("../../assets/anime/ui/progress_l.webp"),
  c: require("../../assets/anime/ui/progress_c.webp"),
  r: require("../../assets/anime/ui/progress_r.webp"),
  capRatio: 130 / 126,
};
/** bidding tiles (suits and values) */
export const TILE_BID: ImageSourcePropType = require("../../assets/anime/emblems/tile.webp");
export const TILE_BID_ON: ImageSourcePropType = require("../../assets/anime/emblems/tile_on.webp");
/** seat badges */
export const BADGE_DEALER: ImageSourcePropType = require("../../assets/anime/emblems/badge_dealer.webp");
export const BADGE_BOT: ImageSourcePropType = require("../../assets/anime/emblems/badge_bot.webp");

// ---------------------------------------------------------------------------
// Home view icons (2026-11-25), prepare-emblems.ps1 -Folder icons
// ---------------------------------------------------------------------------
export const ICONS = {
  online: require("../../assets/anime/icons/online.webp") as ImageSourcePropType,
  solo: require("../../assets/anime/icons/solo.webp") as ImageSourcePropType,
  learn: require("../../assets/anime/icons/learn.webp") as ImageSourcePropType,
  privateGame: require("../../assets/anime/icons/private.webp") as ImageSourcePropType,
  bell: require("../../assets/anime/icons/bell.webp") as ImageSourcePropType,
  elo: require("../../assets/anime/icons/elo.webp") as ImageSourcePropType,
  resume: require("../../assets/anime/icons/resume.webp") as ImageSourcePropType,
  menu: require("../../assets/anime/icons/menu.webp") as ImageSourcePropType,
  alone: require("../../assets/anime/icons/alone.webp") as ImageSourcePropType,
  duo: require("../../assets/anime/icons/duo.webp") as ImageSourcePropType,
  quick: require("../../assets/anime/icons/quick.webp") as ImageSourcePropType,
  normal: require("../../assets/anime/icons/normal.webp") as ImageSourcePropType,
  timer: require("../../assets/anime/icons/timer.webp") as ImageSourcePropType,
  checkOff: require("../../assets/anime/icons/check_off.webp") as ImageSourcePropType,
  checkOn: require("../../assets/anime/icons/check_on.webp") as ImageSourcePropType,
  arrow: require("../../assets/anime/icons/arrow.webp") as ImageSourcePropType,
  home: require("../../assets/anime/icons/home.webp") as ImageSourcePropType,
  ranking: require("../../assets/anime/icons/ranking.webp") as ImageSourcePropType,
  friends: require("../../assets/anime/icons/friends.webp") as ImageSourcePropType,
  profile: require("../../assets/anime/icons/profile.webp") as ImageSourcePropType,
  search: require("../../assets/anime/icons/search.webp") as ImageSourcePropType,
  addFriend: require("../../assets/anime/icons/add_friend.webp") as ImageSourcePropType,
  close: require("../../assets/anime/icons/close.webp") as ImageSourcePropType,
  invite: require("../../assets/anime/icons/invite.webp") as ImageSourcePropType,
  back: require("../../assets/anime/icons/back.webp") as ImageSourcePropType,
  share: require("../../assets/anime/icons/share.webp") as ImageSourcePropType,
  link: require("../../assets/anime/icons/link.webp") as ImageSourcePropType,
  more: require("../../assets/anime/icons/more.webp") as ImageSourcePropType,
  star: require("../../assets/anime/icons/star.webp") as ImageSourcePropType,
  sitHere: require("../../assets/anime/icons/sit_here.webp") as ImageSourcePropType,
  hourglass: require("../../assets/anime/icons/hourglass.webp") as ImageSourcePropType,
  info: require("../../assets/anime/icons/info.webp") as ImageSourcePropType,
  lessonTrump: require("../../assets/anime/icons/lesson_trump.webp") as ImageSourcePropType,
  lessonValues: require("../../assets/anime/icons/lesson_values.webp") as ImageSourcePropType,
  lessonDeal: require("../../assets/anime/icons/lesson_deal.webp") as ImageSourcePropType,
  lessonBidding: require("../../assets/anime/icons/lesson_bidding.webp") as ImageSourcePropType,
  lessonFollow: require("../../assets/anime/icons/lesson_follow.webp") as ImageSourcePropType,
  lessonCut: require("../../assets/anime/icons/lesson_cut.webp") as ImageSourcePropType,
  lessonTfaskira: require("../../assets/anime/icons/lesson_tfaskira.webp") as ImageSourcePropType,
  lessonScoring: require("../../assets/anime/icons/lesson_scoring.webp") as ImageSourcePropType,
  lessonReadBids: require("../../assets/anime/icons/lesson_read_bids.webp") as ImageSourcePropType,
  lessonPlayWell: require("../../assets/anime/icons/lesson_play_well.webp") as ImageSourcePropType,
  tip: require("../../assets/anime/icons/tip.webp") as ImageSourcePropType,
  lock: require("../../assets/anime/icons/lock.webp") as ImageSourcePropType,
  done: require("../../assets/anime/icons/done.webp") as ImageSourcePropType,
  speaker: require("../../assets/anime/icons/speaker.webp") as ImageSourcePropType,
  stop: require("../../assets/anime/icons/stop.webp") as ImageSourcePropType,
  chevronDown: require("../../assets/anime/icons/chevron_down.webp") as ImageSourcePropType,
  medalGold: require("../../assets/anime/icons/medal_gold.webp") as ImageSourcePropType,
  medalSilver: require("../../assets/anime/icons/medal_silver.webp") as ImageSourcePropType,
  medalBronze: require("../../assets/anime/icons/medal_bronze.webp") as ImageSourcePropType,
  medalPlain: require("../../assets/anime/icons/medal_plain.webp") as ImageSourcePropType,
  dotOnline: require("../../assets/anime/icons/dot_online.webp") as ImageSourcePropType,
  dotOffline: require("../../assets/anime/icons/dot_offline.webp") as ImageSourcePropType,
  accept: require("../../assets/anime/icons/accept.webp") as ImageSourcePropType,
  heart: require("../../assets/anime/icons/heart.webp") as ImageSourcePropType,
  avatarMirror: require("../../assets/anime/icons/avatar_mirror.webp") as ImageSourcePropType,
  statistics: require("../../assets/anime/icons/statistics.webp") as ImageSourcePropType,
  soundOn: require("../../assets/anime/icons/sound_on.webp") as ImageSourcePropType,
  soundOff: require("../../assets/anime/icons/sound_off.webp") as ImageSourcePropType,
  design: require("../../assets/anime/icons/design.webp") as ImageSourcePropType,
  language: require("../../assets/anime/icons/language.webp") as ImageSourcePropType,
  feedback: require("../../assets/anime/icons/feedback.webp") as ImageSourcePropType,
  privacy: require("../../assets/anime/icons/privacy.webp") as ImageSourcePropType,
  logout: require("../../assets/anime/icons/logout.webp") as ImageSourcePropType,
  delete: require("../../assets/anime/icons/delete.webp") as ImageSourcePropType,
  external: require("../../assets/anime/icons/external.webp") as ImageSourcePropType,
  warning: require("../../assets/anime/icons/warning.webp") as ImageSourcePropType,
  statGames: require("../../assets/anime/icons/stat_games.webp") as ImageSourcePropType,
  statWinrate: require("../../assets/anime/icons/stat_winrate.webp") as ImageSourcePropType,
  statContracts: require("../../assets/anime/icons/stat_contracts.webp") as ImageSourcePropType,
  statStreak: require("../../assets/anime/icons/stat_streak.webp") as ImageSourcePropType,
  moodSad: require("../../assets/anime/icons/mood_sad.webp") as ImageSourcePropType,
  moodNeutral: require("../../assets/anime/icons/mood_neutral.webp") as ImageSourcePropType,
  moodLove: require("../../assets/anime/icons/mood_love.webp") as ImageSourcePropType,
  podium: require("../../assets/anime/icons/podium.webp") as ImageSourcePropType,
  switchOff: require("../../assets/anime/icons/switch_off.webp") as ImageSourcePropType,
  switchOn: require("../../assets/anime/icons/switch_on.webp") as ImageSourcePropType,
};
