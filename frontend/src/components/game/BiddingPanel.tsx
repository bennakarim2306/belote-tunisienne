import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeInUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  BTN_DARK,
  BTN_GREEN,
  BTN_RED,
  HUD_PANEL,
  TILE_BID,
  TILE_BID_ON,
} from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import NineSlice from "@/src/anime/components/NineSlice";
import { ANIME_THEME_ENABLED } from "@/src/anime/flags";
import { SUIT_COLOR, SUIT_SYMBOL } from "@/src/components/PlayingCard";
import { GameState } from "@/src/game/useGameSocket";
import { TKey } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

const BID_VALUES = [90, 100, 110, 120, 130, 140, 150, 160];
const SUITS = ["S", "H", "C", "D"];

// ---- anime theme helpers (visual only; no-ops when the flag is off) ----
const ANIME = ANIME_THEME_ENABLED;
/** painted button background; the Pressable around it stays the control */
const paint = (slices: typeof BTN_GREEN) => (ANIME ? <HSlice slices={slices} /> : null);
/** painted bidding tile; a chosen suit keeps an ivory plate so its colour stays true */
const paintTile = (on: boolean, plate = false) =>
  ANIME ? (
    <>
      <Image source={on ? TILE_BID_ON : TILE_BID} resizeMode="stretch" fadeDuration={0} style={styles.tileImg} />
      {on && plate && <View style={styles.tilePlate} />}
    </>
  ) : null;
/** painted panel background */
const paintPanel = () => (ANIME ? <NineSlice slices={HUD_PANEL} corner={20} /> : null);

interface Props {
  state: GameState;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  onAction: (msg: Record<string, unknown>) => void;
}

// Shrinking golden bar showing the 5s reaction window after a contre.
function SurcontreCountdown({ deadline }: { deadline: number }) {
  const frac = useSharedValue(1);
  useEffect(() => {
    if (!deadline) return;
    const remaining = Math.max(0, deadline - Date.now() / 1000);
    frac.value = Math.min(1, remaining / 5);
    frac.value = withTiming(0, { duration: remaining * 1000, easing: Easing.linear });
  }, [deadline, frac]);
  const style = useAnimatedStyle(() => ({ width: `${frac.value * 100}%` }));
  if (!deadline) return null;
  return (
    <View style={styles.cdTrack} testID="surcontre-countdown">
      <Animated.View style={[styles.cdFill, style]} />
    </View>
  );
}

export default function BiddingPanel({ state, t, onAction }: Props) {
  const [suit, setSuit] = useState<string | null>(null);
  const [value, setValue] = useState<number | null>(null);

  const myTurn = state.phase === "bidding" && state.turn === state.my_seat;
  const minValue = state.contract?.value ? state.contract.value + 10 : 90;

  // pulsing golden border = "it's your turn" indicator (replaces the old text)
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (myTurn) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [myTurn, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      pulse.value,
      [0, 1],
      ["rgba(255,184,0,0.35)", "#FFD34D"],
    ),
    shadowOpacity: 0.25 + pulse.value * 0.55,
    shadowRadius: 6 + pulse.value * 8,
  }));

  // a previously selected value that fell below the new minimum (e.g. after the
  // partner raised) must be cleared, otherwise it silently blocks "Annoncer"
  useEffect(() => {
    if (value !== null && value < minValue) setValue(null);
  }, [minValue, value]);

  // fresh hand: reset any leftover selection
  useEffect(() => {
    setSuit(null);
    setValue(null);
  }, [state.hand_number]);

  if (state.phase === "surcontre") {
    if (state.can_surcontre) {
      return (
        <Animated.View entering={FadeInUp} style={[styles.panel, ANIME && styles.panelAnime]} testID="surcontre-panel">
          {paintPanel()}
          <Text style={styles.panelTitle}>{t("opponentContred")}</Text>
          <SurcontreCountdown deadline={state.turn_deadline} />
          <View style={styles.actionRow}>
            <Pressable
              testID="surcontre-button"
              onPress={() => onAction({ action: "surcontre" })}
              style={[styles.bigAction, { backgroundColor: C.error }, ANIME && styles.btnAnime]}
            >
              {paint(BTN_RED)}
              <Text style={[styles.bigActionText, ANIME && styles.btnTextAnime]}>{t("surcontre")}</Text>
            </Pressable>
            <Pressable
              testID="decline-surcontre-button"
              onPress={() => onAction({ action: "decline_surcontre" })}
              style={[styles.bigAction, { backgroundColor: C.green }, ANIME && styles.btnAnime]}
            >
              {paint(BTN_GREEN)}
              <Text style={[styles.bigActionText, ANIME && styles.btnTextAnime]}>{t("playContract")}</Text>
            </Pressable>
          </View>
        </Animated.View>
      );
    }
    return (
      <Animated.View entering={FadeInUp} style={[styles.panel, ANIME && styles.panelAnime]}>
        {paintPanel()}
        <Text style={styles.panelTitle}>{t("waitingDecision")}</Text>
        <SurcontreCountdown deadline={state.turn_deadline} />
      </Animated.View>
    );
  }

  if (state.phase !== "bidding") return null;

  // out-of-turn actions (contre/capot) live in the DeclareDock, bottom right
  if (!myTurn) return null;

  const canAnnounce = suit !== null && value !== null && value >= minValue;

  return (
    <Animated.View
      entering={FadeInUp}
      style={[styles.panel, styles.panelTurn, glowStyle, ANIME && styles.panelAnimeTurn]}
      testID="bidding-panel"
    >
      {paintPanel()}
      <View style={styles.mainRow}>
        <View style={styles.suitGrid}>
          {SUITS.map((s) => (
            <Pressable
              key={s}
              testID={`bid-suit-${s}`}
              onPress={() => setSuit(s)}
              accessibilityState={{ selected: suit === s }}
              style={[styles.suitBtn, suit === s && styles.suitBtnActive, ANIME && styles.tileAnime]}
            >
              {paintTile(suit === s, true)}
              <Text style={[styles.suitText, { color: SUIT_COLOR[s] }]}>
                {SUIT_SYMBOL[s]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.valueGrid}>
          {BID_VALUES.map((v) => {
            const disabled = v < minValue;
            return (
              <Pressable
                key={v}
                testID={`bid-value-${v}`}
                onPress={() => !disabled && setValue(v)}
                style={[
                  styles.valueChip,
                  value === v && styles.valueChipActive,
                  ANIME && styles.tileAnime,
                  disabled && { opacity: 0.3 },
                ]}
                disabled={disabled}
              >
                {paintTile(value === v)}
                <Text
                  style={[
                    styles.valueText,
                    value === v && { color: C.onBrand },
                    ANIME && (value === v ? styles.tileTextOn : styles.tileText),
                  ]}
                >
                  {v}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          testID="pass-button"
          onPress={() => onAction({ action: "pass" })}
          style={[styles.bigAction, { backgroundColor: C.bg3 }, ANIME && styles.btnAnime]}
        >
          {paint(BTN_DARK)}
          <Text style={[styles.bigActionText, { color: C.ink }, ANIME && styles.btnTextAnime]}>{t("passBid")}</Text>
        </Pressable>
        <Pressable
          testID="capot-button"
          onPress={() => suit && onAction({ action: "capot", suit })}
          disabled={!suit}
          style={[styles.bigAction, { backgroundColor: C.gold, opacity: suit ? 1 : 0.4 }, ANIME && styles.btnAnime]}
        >
          {paint(BTN_GREEN)}
          <Text style={[styles.bigActionText, { color: "#1A1200" }, ANIME && styles.btnTextAnime]}>{t("capot")}</Text>
        </Pressable>
        {state.can_contre && (
          <Pressable
            testID="contre-button"
            onPress={() => onAction({ action: "contre" })}
            style={[styles.bigAction, { backgroundColor: C.error }, ANIME && styles.btnAnime]}
          >
            {paint(BTN_RED)}
            <Text style={[styles.bigActionText, ANIME && styles.btnTextAnime]}>{t("contre")}</Text>
          </Pressable>
        )}
        <Pressable
          testID="announce-bid-button"
          onPress={() =>
            canAnnounce && onAction({ action: "bid", value, suit })
          }
          disabled={!canAnnounce}
          style={[
            styles.bigAction,
            { backgroundColor: C.brand, opacity: canAnnounce ? 1 : 0.4 },
            ANIME && styles.btnAnime,
            ANIME && styles.btnAnnounceAnime,
          ]}
        >
          {paint(BTN_GREEN)}
          <Text style={[styles.bigActionText, ANIME && styles.btnTextAnime]}>
            {t("announce")}
            {canAnnounce ? ` ${value}${SUIT_SYMBOL[suit!]}` : ""}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Out-of-turn auction actions (contre + capot), docked bottom-right above the
// "last trick"/chat buttons in a bordered block so they never cover a player.
export function DeclareDock({ state, t, onAction }: Props) {
  const [capotOpen, setCapotOpen] = useState(false);

  // close the capot suit picker only when the auction context truly changes —
  // not on every bot move, or a slow player keeps losing the open picker
  useEffect(() => {
    setCapotOpen(false);
  }, [state.phase, state.hand_number]);

  const myTurn = state.phase === "bidding" && state.turn === state.my_seat;
  if (state.phase !== "bidding" || myTurn) return null;

  return (
    <Animated.View entering={FadeInDown} style={[styles.dock, ANIME && styles.dockAnime]} testID="declare-dock">
      {paintPanel()}
      {capotOpen && (
        <Animated.View entering={FadeInDown} style={[styles.dockSuitRow, ANIME && { backgroundColor: "transparent" }]}>
          {SUITS.map((s) => (
            <Pressable
              key={s}
              testID={`capot-suit-${s}`}
              onPress={() => {
                setCapotOpen(false);
                onAction({ action: "capot", suit: s });
              }}
              style={[styles.dockSuitBtn, ANIME && styles.tileAnime]}
            >
              {paintTile(false)}
              <Text
                style={[
                  styles.dockSuitText,
                  { color: s === "H" || s === "D" ? "#FF7A66" : "#FFFFFF" },
                  ANIME && { color: SUIT_COLOR[s] },
                ]}
              >
                {SUIT_SYMBOL[s]}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
      <Pressable
        testID="capot-float-button"
        onPress={() => setCapotOpen((v) => !v)}
        style={[styles.dockBtn, { backgroundColor: C.gold }, ANIME && styles.btnAnime]}
      >
        {paint(BTN_GREEN)}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.dockBtnText, { color: "#1A1200" }, ANIME && styles.btnTextAnime]}
        >
          {t("capot")}
        </Text>
      </Pressable>
      {state.can_contre && (
        <Pressable
          testID="contre-button"
          onPress={() => onAction({ action: "contre" })}
          style={[styles.dockBtn, { backgroundColor: C.error }, ANIME && styles.btnAnime]}
        >
          {paint(BTN_RED)}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[styles.dockBtnText, ANIME && styles.btnTextAnime]}
          >
            {t("contre")}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "rgba(28,23,20,0.97)",
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borderStrong,
    padding: SP.sm,
    marginHorizontal: SP.md,
    width: "94%",
    maxWidth: 420,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  cdTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,184,0,0.18)",
    overflow: "hidden",
    marginBottom: 6,
  },
  cdFill: { height: 4, borderRadius: 2, backgroundColor: "#FFB800" },
  panelTurn: {
    borderWidth: 2,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
  },
  panelTitle: {
    fontFamily: F.display,
    fontSize: 11,
    color: C.ink,
    textAlign: "center",
    marginBottom: 4,
  },
  mainRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  suitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 44 * 2 + 6,
    gap: 6,
  },
  suitBtn: {
    width: 44,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  suitBtnActive: { borderColor: C.brand, backgroundColor: "#E8FFF3" },
  suitText: { fontSize: 19 },
  valueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 44 * 4 + 6 * 3,
    gap: 6,
  },
  valueChip: {
    height: 36,
    width: 44,
    borderRadius: R.sm,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  valueChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  valueText: { fontFamily: F.extra, fontSize: 13, color: C.ink },
  actionRow: {
    flexDirection: "row",
    gap: SP.xs,
    marginTop: 6,
  },
  bigAction: {
    flex: 1,
    height: 34,
    borderRadius: R.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP.sm,
  },
  bigActionText: { fontFamily: F.display, fontSize: 12, color: C.onBrand },
  dock: {
    width: "100%",
    backgroundColor: "rgba(10,8,2,0.85)",
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.6)",
    padding: 6,
    gap: 6,
    alignItems: "stretch",
  },
  dockBtn: {
    height: 32,
    borderRadius: R.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP.sm,
  },
  dockBtnText: { fontFamily: F.display, fontSize: 12.5, color: C.onBrand },
  dockSuitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(250,248,245,0.97)",
    borderRadius: R.pill,
    padding: 4,
  },
  dockSuitBtn: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  dockSuitText: { fontSize: 16 },
  // ---- anime theme ----
  tileAnime: { backgroundColor: "transparent", borderWidth: 0, borderColor: "transparent", borderRadius: 0 },
  tileImg: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  tilePlate: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 8,
    right: 8,
    borderRadius: 6,
    backgroundColor: "#FFF5DF",
  },
  tileText: { color: "#17130E" },
  tileTextOn: { color: "#FFF5DF" },
  panelAnime: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    padding: SP.md,
  },
  // my-turn panel keeps its pulsing gold border (the "your turn" signal)
  panelAnimeTurn: { backgroundColor: "transparent", padding: SP.md, borderRadius: 14 },
  dockAnime: { backgroundColor: "transparent", borderWidth: 0, padding: 9 },
  btnAnime: { backgroundColor: "transparent", paddingHorizontal: 6 },
  // "Annoncer 110♥" needs more room than the one-word buttons
  btnAnnounceAnime: { flex: 1.45 },
  btnTextAnime: {
    color: "#FFF5DF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
