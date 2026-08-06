import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

import { SUIT_COLOR, SUIT_SYMBOL } from "@/src/components/PlayingCard";
import { GameState } from "@/src/game/useGameSocket";
import { TKey } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

const BID_VALUES = [90, 100, 110, 120, 130, 140, 150, 160];
const SUITS = ["S", "H", "C", "D"];

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
  const [capotOpen, setCapotOpen] = useState(false);

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

  // close the out-of-turn capot picker whenever the auction context changes
  useEffect(() => {
    setCapotOpen(false);
  }, [state.phase, state.turn, state.hand_number]);

  if (state.phase === "surcontre") {
    if (state.can_surcontre) {
      return (
        <Animated.View entering={FadeInUp} style={styles.panel} testID="surcontre-panel">
          <Text style={styles.panelTitle}>{t("opponentContred")}</Text>
          <SurcontreCountdown deadline={state.turn_deadline} />
          <View style={styles.actionRow}>
            <Pressable
              testID="surcontre-button"
              onPress={() => onAction({ action: "surcontre" })}
              style={[styles.bigAction, { backgroundColor: C.error }]}
            >
              <Text style={styles.bigActionText}>{t("surcontre")}</Text>
            </Pressable>
            <Pressable
              testID="decline-surcontre-button"
              onPress={() => onAction({ action: "decline_surcontre" })}
              style={[styles.bigAction, { backgroundColor: C.green }]}
            >
              <Text style={styles.bigActionText}>{t("playContract")}</Text>
            </Pressable>
          </View>
        </Animated.View>
      );
    }
    return (
      <Animated.View entering={FadeInUp} style={styles.panel}>
        <Text style={styles.panelTitle}>{t("waitingDecision")}</Text>
        <SurcontreCountdown deadline={state.turn_deadline} />
      </Animated.View>
    );
  }

  if (state.phase !== "bidding") return null;

  if (!myTurn) {
    // out-of-turn actions: contre (defending team) + capot (anyone, any time)
    return (
      <Animated.View entering={FadeInDown} style={styles.floatCol} pointerEvents="box-none">
        {capotOpen && (
          <Animated.View entering={FadeInDown} style={styles.capotSuitRow}>
            {SUITS.map((s) => (
              <Pressable
                key={s}
                testID={`capot-suit-${s}`}
                onPress={() => {
                  setCapotOpen(false);
                  onAction({ action: "capot", suit: s });
                }}
                style={styles.capotSuitBtn}
              >
                <Text style={[styles.capotSuitText, { color: s === "H" || s === "D" ? "#FF7A66" : "#FFFFFF" }]}>
                  {SUIT_SYMBOL[s]}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        )}
        <View style={styles.floatRow}>
          <Pressable
            testID="capot-float-button"
            onPress={() => setCapotOpen((v) => !v)}
            style={[styles.contreBtn, { backgroundColor: C.gold }]}
          >
            <Text style={[styles.contreBtnText, { color: "#1A1200" }]}>{t("capot")}</Text>
          </Pressable>
          {state.can_contre && (
            <Pressable
              testID="contre-button"
              onPress={() => onAction({ action: "contre" })}
              style={styles.contreBtn}
            >
              <Text style={styles.contreBtnText}>{t("contre")}</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  }

  const canAnnounce = suit !== null && value !== null && value >= minValue;

  return (
    <Animated.View
      entering={FadeInUp}
      style={[styles.panel, styles.panelTurn, glowStyle]}
      testID="bidding-panel"
    >
      <View style={styles.mainRow}>
        <View style={styles.suitGrid}>
          {SUITS.map((s) => (
            <Pressable
              key={s}
              testID={`bid-suit-${s}`}
              onPress={() => setSuit(s)}
              style={[styles.suitBtn, suit === s && styles.suitBtnActive]}
            >
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
                  disabled && { opacity: 0.3 },
                ]}
                disabled={disabled}
              >
                <Text style={[styles.valueText, value === v && { color: C.onBrand }]}>
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
          style={[styles.bigAction, { backgroundColor: C.bg3 }]}
        >
          <Text style={[styles.bigActionText, { color: C.ink }]}>{t("passBid")}</Text>
        </Pressable>
        <Pressable
          testID="capot-button"
          onPress={() => suit && onAction({ action: "capot", suit })}
          disabled={!suit}
          style={[styles.bigAction, { backgroundColor: C.gold, opacity: suit ? 1 : 0.4 }]}
        >
          <Text style={[styles.bigActionText, { color: "#1A1200" }]}>{t("capot")}</Text>
        </Pressable>
        {state.can_contre && (
          <Pressable
            testID="contre-button"
            onPress={() => onAction({ action: "contre" })}
            style={[styles.bigAction, { backgroundColor: C.error }]}
          >
            <Text style={styles.bigActionText}>{t("contre")}</Text>
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
          ]}
        >
          <Text style={styles.bigActionText}>
            {t("announce")}
            {canAnnounce ? ` ${value}${SUIT_SYMBOL[suit!]}` : ""}
          </Text>
        </Pressable>
      </View>
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
  floatCol: {
    alignItems: "flex-end",
    paddingRight: SP.lg,
    gap: SP.sm,
  },
  floatRow: {
    flexDirection: "row",
    gap: SP.sm,
  },
  capotSuitRow: {
    flexDirection: "row",
    gap: SP.sm,
    backgroundColor: "rgba(250,248,245,0.97)",
    borderRadius: R.pill,
    padding: SP.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  capotSuitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  capotSuitText: { fontSize: 19 },
  contreBtn: {
    backgroundColor: C.error,
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  contreBtnText: { fontFamily: F.display, fontSize: 12.5, color: C.onBrand },
});
