import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ArenaBackground, { arenaSideWidth } from "@/src/anime/components/ArenaBackground";
import ArenaMenuTile from "@/src/anime/components/ArenaMenuTile";
import TunisianFlagBanner from "@/src/anime/components/TunisianFlagBanner";
import { A } from "@/src/anime/tokens";
import Avatar from "@/src/components/Avatar";
import MenuButton from "@/src/components/MenuButton";
import { useI18n } from "@/src/i18n";
import { F, R, SP } from "@/src/theme";

// Visual layer of the home screen for the "Emerald Tunisian Anime Arena"
// theme: top bar + the 2×2 menu grid. It owns NO business logic — every
// action, label and live value comes from app/(tabs)/home.tsx, which keeps
// the modals, navigation and API calls exactly as in the original screen.

const SUITS = [
  { s: "♥", c: A.red },
  { s: "♠", c: A.ivory },
  { s: "♦", c: A.red },
  { s: "♣", c: A.ivory },
];

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
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) {
      setSize({ w: width, h: height });
    }
  };

  // soft pulsing glow on the hero tile (same behaviour as the original card)
  const glowPulse = useSharedValue(0);
  useEffect(() => {
    glowPulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [glowPulse]);
  const heroGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.3 + glowPulse.value * 0.45,
  }));

  // ---- responsive metrics (landscape phones → tablets) ----
  const { w, h } = size;
  // the grid sits between the two arches (their width is capped in ArenaBackground)
  const sideInset = Math.max(
    arenaSideWidth(w, h) + 6,
    Math.max(insets.left, insets.right),
    SP.lg,
  );
  const gridW = Math.min(w - sideInset * 2, 940);
  const tileW = Math.max(0, (gridW - SP.sm) / 2);
  const titleSize = clamp(tileW * 0.072, 15, 30);
  const descSize = clamp(tileW * 0.043, 11, 17);
  const iconBox = clamp(tileW * 0.19, 42, 80);
  const iconSize = iconBox * 0.5;
  const showLogo = w >= 780;
  const showFlag = w >= 700;
  const showGreeting = w >= 620;

  const us = currentGame ? currentGame.match_scores[currentGame.my_team] : 0;
  const them = currentGame ? currentGame.match_scores[1 - currentGame.my_team] : 0;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <ArenaBackground width={w} height={h} />

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
        <MenuButton buttonStyle={styles.menuBtn} iconColor={A.goldLight} />

        {showFlag && (
          <View style={styles.flagSlot} pointerEvents="none">
            <View style={styles.flagHang}>
              <TunisianFlagBanner width={40} />
            </View>
          </View>
        )}

        {showLogo && (
          <View style={styles.logo} pointerEvents="none" accessibilityRole="header">
            <Text style={styles.logoText} numberOfLines={1}>
              Belote
            </Text>
            <Text style={[styles.logoText, styles.logoText2]} numberOfLines={1}>
              Tunisienne
            </Text>
            <View style={styles.logoSuits}>
              {SUITS.map((d) => (
                <Text key={d.s} style={[styles.logoSuit, { color: d.c }]}>
                  {d.s}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.identity}>
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
            <Ionicons name="play-circle" size={22} color={A.emeraldInk} />
            <View style={styles.resumeTextWrap}>
              <Text style={styles.resumeTitle} numberOfLines={1}>
                {t("resumeGame")}
              </Text>
              <Text style={styles.resumeScore} numberOfLines={1} testID="resume-game-score">
                {t("us")} {us} · {them} {t("them")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={A.emeraldInk} />
          </Pressable>
        )}

        <View style={styles.eloPill} testID="home-elo-pill">
          <Ionicons name="flame" size={15} color={A.amber} />
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
          <Ionicons name="notifications" size={20} color={A.goldLight} />
          {notifCount > 0 && (
            <View style={styles.bellBadge} testID="notifications-badge">
              <Text style={styles.bellBadgeText}>{notifCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ---------- 2×2 menu grid (never a single column) ---------- */}
      <View style={[styles.content, { paddingHorizontal: sideInset }]}>
        <View style={styles.grid} testID="home-grid">
          <View style={styles.gridRow}>
            <Animated.View entering={FadeInUp.delay(40)} style={styles.gridItem}>
              <Animated.View style={[styles.heroGlow, heroGlowStyle]}>
                <ArenaMenuTile
                  variant="hero"
                  testID="play-online-card"
                  onPress={onPlayOnline}
                  iconTone="emerald"
                  icon={<Ionicons name="globe-outline" size={iconSize} color={A.goldLight} />}
                  title={t("playOnline")}
                  desc={t("playOnlineDesc")}
                  titleSize={titleSize}
                  descSize={descSize}
                  iconBox={iconBox}
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
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(70)} style={styles.gridItem}>
              <ArenaMenuTile
                variant="dark"
                testID="play-solo-card"
                onPress={onPlaySolo}
                iconTone="amber"
                icon={<Ionicons name="game-controller" size={iconSize} color="#2C1400" />}
                title={t("playVsAI")}
                desc={t("playVsAIDesc")}
                titleSize={titleSize}
                descSize={descSize}
                iconBox={iconBox}
                badge={t("trainingBadge")}
              />
            </Animated.View>
          </View>

          <View style={styles.gridRow}>
            <Animated.View entering={FadeInUp.delay(100)} style={styles.gridItem}>
              <ArenaMenuTile
                variant="dark"
                testID="learn-card"
                onPress={onLearn}
                iconTone="emerald"
                icon={<Ionicons name="school" size={iconSize} color={A.goldLight} />}
                title={t("tutorialTitle")}
                desc={t("tutorialDesc")}
                titleSize={titleSize}
                descSize={descSize}
                iconBox={iconBox}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(130)} style={styles.gridItem}>
              <ArenaMenuTile
                variant="dark"
                testID="private-game-card"
                onPress={onPrivate}
                iconTone="amber"
                icon={<Ionicons name="people" size={iconSize} color="#2C1400" />}
                title={t("privateParty")}
                desc={t("privatePartyDesc")}
                titleSize={titleSize}
                descSize={descSize}
                iconBox={iconBox}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const CONTROL_H = 44;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: A.emeraldDeep, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: SP.sm,
    gap: SP.sm,
  },
  menuBtn: {
    backgroundColor: "rgba(3,35,28,0.78)",
    borderWidth: 1.5,
    borderColor: A.gold,
  },
  // the banner hangs from the top edge and overlaps the grid area slightly
  flagSlot: { width: 40, height: CONTROL_H },
  flagHang: { position: "absolute", top: -SP.sm - 2, left: 0 },
  logo: { alignItems: "center", marginHorizontal: SP.xs },
  logoText: {
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 19,
    color: A.goldLight,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  logoText2: { marginTop: -2 },
  logoSuits: { flexDirection: "row", gap: 4, marginTop: -1 },
  logoSuit: { fontSize: 10, lineHeight: 12 },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minWidth: 0,
    height: CONTROL_H,
    paddingLeft: 2,
    paddingRight: SP.md,
    borderRadius: R.pill,
    backgroundColor: "rgba(3,35,28,0.72)",
    borderWidth: 1.5,
    borderColor: A.goldLine,
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
    paddingHorizontal: SP.md,
    borderRadius: R.pill,
    backgroundColor: A.mint,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    maxWidth: 220,
    flexShrink: 1,
  },
  resumeTextWrap: { flexShrink: 1, minWidth: 0 },
  resumeTitle: { fontFamily: F.display, fontSize: 12.5, lineHeight: 15, color: A.emeraldInk },
  resumeScore: { fontFamily: F.bold, fontSize: 11, lineHeight: 13, color: "rgba(3,35,28,0.8)" },
  eloPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: CONTROL_H - 2,
    paddingHorizontal: SP.lg,
    borderRadius: R.pill,
    backgroundColor: "rgba(3,35,28,0.78)",
    borderWidth: 1.5,
    borderColor: A.gold,
  },
  eloText: { fontFamily: F.serif, fontSize: 17, color: A.ivory },
  bellBtn: {
    width: CONTROL_H,
    height: CONTROL_H,
    borderRadius: CONTROL_H / 2,
    backgroundColor: "rgba(3,35,28,0.78)",
    borderWidth: 1.5,
    borderColor: A.gold,
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
  heroGlow: {
    flex: 1,
    borderRadius: 20,
    shadowColor: "#3BE3A2",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    elevation: 10,
  },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: A.mint },
  onlineText: { fontFamily: F.bold, fontSize: 12, color: A.mint },
});
