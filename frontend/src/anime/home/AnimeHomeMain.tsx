import React, { useState } from "react";
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BTN_GREEN,
  BTN_ICON_GREEN,
  CHAT_CHIP,
  FLAG_BANNER,
  ICONS,
  LOGO,
  TITLE_RIBBON,
} from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import ArenaBackground, { arenaContentInset } from "@/src/anime/components/ArenaBackground";
import ArenaMenuTile from "@/src/anime/components/ArenaMenuTile";
import { A } from "@/src/anime/tokens";
import Avatar from "@/src/components/Avatar";
import MenuButton from "@/src/components/MenuButton";
import { useI18n } from "@/src/i18n";
import { F, SP } from "@/src/theme";

// Visual layer of the home screen for the "Emerald Tunisian Anime Arena"
// theme: top bar + the 2×2 menu grid. It owns NO business logic — every
// action, label and live value comes from app/(tabs)/home.tsx, which keeps
// the modals, navigation and API calls exactly as in the original screen.

export interface AnimeHomeMainProps {
  username?: string;
  avatarId?: string;
  elo: number;
  onlineNow: number;
  notifCount: number;
  /** unfinished game shortcut — null hides the pill (same rule as original) */
  currentGame: { match_scores: [number, number]; my_team: number } | null;
  onResume: () => void;
  onOpenNotifications: () => void;
  onPlayOnline: () => void;
  onPlaySolo: () => void;
  onLearn: () => void;
  onPrivate: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const CONTROL_H = 44;
const LOGO_H = 46;
const FLAG_W = 34;

export default function AnimeHomeMain({
  username,
  avatarId,
  elo,
  onlineNow,
  notifCount,
  currentGame,
  onResume,
  onOpenNotifications,
  onPlayOnline,
  onPlaySolo,
  onLearn,
  onPrivate,
}: AnimeHomeMainProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [gridH, setGridH] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) {
      setSize({ w: width, h: height });
    }
  };
  const onGridLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (Math.abs(height - gridH) > 0.5) setGridH(height);
  };

  // ---- responsive metrics (landscape phones → tablets) ----
  const { w, h } = size;
  // the grid starts where the painted arch/column/lantern end, but never
  // gives up more than 17% of the width per side
  const sideInset = Math.max(
    Math.min(arenaContentInset(w, h) + 4, w * 0.17),
    Math.max(insets.left, insets.right),
    SP.lg,
  );
  const gridW = Math.min(w - sideInset * 2, 940);
  const tileW = Math.max(0, (gridW - SP.sm) / 2);
  const tileH = Math.max(0, (gridH - SP.sm) / 2);
  const titleSize = clamp(tileW * 0.066, 15, 30);
  const descSize = clamp(tileW * 0.044, 11, 17);
  const iconBox = clamp(tileW * 0.21, 50, 100);
  const showLogo = w >= 780;
  const showFlag = w >= 700;
  const showGreeting = w >= 620;

  const us = currentGame ? currentGame.match_scores[currentGame.my_team] : 0;
  const them = currentGame ? currentGame.match_scores[1 - currentGame.my_team] : 0;

  const tileSizes = { titleSize, descSize, iconBox, tileHeight: tileH };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <ArenaBackground />

      {/* ---------- top bar ---------- */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SP.sm,
            paddingLeft: Math.max(insets.left, SP.lg),
            paddingRight: Math.max(insets.right, SP.lg),
          },
        ]}
      >
        <MenuButton
          buttonStyle={styles.menuBtn}
          icon={
            <>
              <Image source={BTN_ICON_GREEN} style={styles.btnBg} fadeDuration={0} />
              <Image source={ICONS.menu} style={styles.btnIcon} fadeDuration={0} />
            </>
          }
        />

        {showFlag && (
          <View style={styles.flagSlot} pointerEvents="none">
            <Image
              source={FLAG_BANNER.source}
              resizeMode="contain"
              fadeDuration={0}
              style={[styles.flagImg, { top: -(insets.top + SP.sm) }]}
            />
          </View>
        )}

        {showLogo && (
          <Image
            source={LOGO.source}
            resizeMode="contain"
            fadeDuration={0}
            accessibilityRole="image"
            accessibilityLabel="Belote Tunisienne"
            style={styles.logoImg}
          />
        )}

        <View style={styles.identity}>
          <HSlice slices={CHAT_CHIP} />
          <Avatar avatarId={avatarId} size={36} ringColor={A.gold} ringWidth={2} testID="home-user-avatar" />
          <View style={styles.identityText}>
            {showGreeting && <Text style={styles.hello}>{t("hello")},</Text>}
            <Text style={styles.username} numberOfLines={1}>
              {username}
            </Text>
          </View>
        </View>

        <View style={styles.spacer} />

        {currentGame && (
          <Pressable
            testID="resume-game-button"
            onPress={onResume}
            accessibilityRole="button"
            accessibilityLabel={t("resumeGame")}
            style={({ pressed }) => [styles.resumeBtn, pressed && { opacity: 0.85 }]}
          >
            <HSlice slices={BTN_GREEN} />
            <Image source={ICONS.resume} style={styles.resumeIcon} fadeDuration={0} />
            <View style={styles.resumeTextWrap}>
              <Text style={styles.resumeTitle} numberOfLines={1}>
                {t("resumeGame")}
              </Text>
              <Text style={styles.resumeScore} numberOfLines={1} testID="resume-game-score">
                {t("us")} {us} · {them} {t("them")}
              </Text>
            </View>
          </Pressable>
        )}

        <View style={styles.eloPill} testID="home-elo-pill">
          <HSlice slices={CHAT_CHIP} />
          <Image source={ICONS.elo} style={styles.eloIcon} fadeDuration={0} />
          <Text style={styles.eloText}>{elo}</Text>
        </View>

        <Pressable
          testID="notifications-bell"
          onPress={onOpenNotifications}
          accessibilityRole="button"
          accessibilityLabel={t("notifications")}
          hitSlop={8}
          style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.85 }]}
        >
          <Image source={BTN_ICON_GREEN} style={styles.btnBg} fadeDuration={0} />
          <Image source={ICONS.bell} style={styles.btnIcon} fadeDuration={0} />
          {notifCount > 0 && (
            <View style={styles.bellBadge} testID="notifications-badge">
              <Text style={styles.bellBadgeText}>{notifCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ---------- 2×2 menu grid (never a single column) ---------- */}
      <View style={[styles.content, { paddingHorizontal: sideInset }]}>
        <View style={styles.grid} testID="home-grid" onLayout={onGridLayout}>
          <View style={styles.gridRow}>
            <Animated.View entering={FadeInUp.delay(40)} style={styles.gridItem}>
              <ArenaMenuTile
                variant="hero"
                pulse
                testID="play-online-card"
                onPress={onPlayOnline}
                icon={ICONS.online}
                title={t("playOnline")}
                desc={t("playOnlineDesc")}
                {...tileSizes}
                footer={
                  onlineNow > 0 ? (
                    <View style={styles.onlineRow}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineText} testID="online-now-count" numberOfLines={1}>
                        {t("onlineCount", { n: onlineNow })}
                      </Text>
                    </View>
                  ) : null
                }
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(70)} style={styles.gridItem}>
              <ArenaMenuTile
                variant="dark"
                testID="play-solo-card"
                onPress={onPlaySolo}
                icon={ICONS.solo}
                title={t("playVsAI")}
                desc={t("playVsAIDesc")}
                {...tileSizes}
                footer={
                  // under the description so it can never cover the title
                  <View style={styles.trainingBadge}>
                    <HSlice slices={TITLE_RIBBON} />
                    <Text style={styles.trainingBadgeText} numberOfLines={1}>
                      {t("trainingBadge")}
                    </Text>
                  </View>
                }
              />
            </Animated.View>
          </View>

          <View style={styles.gridRow}>
            <Animated.View entering={FadeInUp.delay(100)} style={styles.gridItem}>
              <ArenaMenuTile
                variant="dark"
                testID="learn-card"
                onPress={onLearn}
                icon={ICONS.learn}
                title={t("tutorialTitle")}
                desc={t("tutorialDesc")}
                {...tileSizes}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(130)} style={styles.gridItem}>
              <ArenaMenuTile
                variant="dark"
                testID="private-game-card"
                onPress={onPrivate}
                icon={ICONS.privateGame}
                title={t("privateParty")}
                desc={t("privatePartyDesc")}
                {...tileSizes}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: A.emeraldDeep, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: SP.sm,
    gap: SP.sm,
  },
  menuBtn: { width: 46, height: 46, backgroundColor: "transparent", borderWidth: 0, borderRadius: 0 },
  btnBg: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", resizeMode: "stretch" },
  btnIcon: { width: 28, height: 28, resizeMode: "contain" },
  // the banner hangs from the very top edge and dips slightly into the grid area
  flagSlot: { width: FLAG_W, height: CONTROL_H },
  flagImg: {
    position: "absolute",
    left: 0,
    width: FLAG_W,
    height: FLAG_W / FLAG_BANNER.aspect,
  },
  logoImg: {
    height: LOGO_H,
    width: LOGO_H * LOGO.aspect,
    marginHorizontal: 2,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minWidth: 0,
    height: CONTROL_H + 4,
    paddingLeft: 4,
    paddingRight: 20,
  },
  identityText: { marginLeft: SP.sm, flexShrink: 1, minWidth: 0 },
  hello: { fontFamily: F.text, fontSize: 10.5, lineHeight: 12, color: A.ivoryDim },
  username: { fontFamily: F.bold, fontSize: 15, lineHeight: 18, color: A.ivory },
  spacer: { flex: 1, minWidth: 0 },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: CONTROL_H,
    paddingLeft: 18,
    paddingRight: 28,
    maxWidth: 240,
    flexShrink: 1,
  },
  resumeIcon: { width: 32, height: 32, resizeMode: "contain" },
  resumeTextWrap: { flexShrink: 1, minWidth: 0 },
  resumeTitle: { fontFamily: F.display, fontSize: 12.5, lineHeight: 15, color: A.ivory },
  resumeScore: { fontFamily: F.bold, fontSize: 11, lineHeight: 13, color: A.goldLight },
  eloPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: CONTROL_H - 2,
    paddingLeft: 14,
    paddingRight: 20,
  },
  eloIcon: { width: 24, height: 24, resizeMode: "contain" },
  eloText: { fontFamily: F.serif, fontSize: 17, color: A.ivory },
  bellBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: A.red,
    borderWidth: 1,
    borderColor: A.goldLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: { fontFamily: F.extra, fontSize: 10.5, color: "#FFF" },
  content: {
    flex: 1,
    paddingTop: SP.xs,
    paddingBottom: SP.md,
    alignItems: "center",
  },
  grid: { flex: 1, gap: SP.sm, width: "100%", maxWidth: 940 },
  gridRow: { flex: 1, flexDirection: "row", gap: SP.sm },
  gridItem: { flex: 1 },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: A.mint },
  onlineText: { fontFamily: F.bold, fontSize: 12, color: A.mint },
  trainingBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    marginLeft: -4,
    height: 22,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  trainingBadgeText: { fontFamily: F.bold, fontSize: 10, color: A.goldLight },
});
