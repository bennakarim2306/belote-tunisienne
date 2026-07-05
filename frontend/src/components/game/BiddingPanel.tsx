import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

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

export default function BiddingPanel({ state, t, onAction }: Props) {
  const [suit, setSuit] = useState<string | null>(null);
  const [value, setValue] = useState<number | null>(null);

  const myTurn = state.phase === "bidding" && state.turn === state.my_seat;
  const minValue = state.contract?.value ? state.contract.value + 10 : 90;

  if (state.phase === "surcontre") {
    if (state.can_surcontre) {
      return (
        <Animated.View entering={FadeInUp} style={styles.panel} testID="surcontre-panel">
          <Text style={styles.panelTitle}>{t("opponentContred")}</Text>
          <View style={styles.actionRow}>
            <Pressable
              testID="surcontre-button"
              onPress={() => onAction({ action: "surcontre" })}
              style={[styles.bigAction, { backgroundColor: C.error }]}
            >
              <Text style={styles.bigActionText}>{t("surcontre")} ×4</Text>
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
      </Animated.View>
    );
  }

  if (state.phase !== "bidding") return null;

  if (!myTurn) {
    if (state.can_contre) {
      return (
        <Animated.View entering={FadeInDown} style={styles.contreFloat}>
          <Pressable
            testID="contre-button"
            onPress={() => onAction({ action: "contre" })}
            style={styles.contreBtn}
          >
            <Text style={styles.contreBtnText}>{t("contre")} ×2</Text>
          </Pressable>
        </Animated.View>
      );
    }
    return null;
  }

  const canAnnounce = suit !== null && value !== null && value >= minValue;

  return (
    <Animated.View entering={FadeInUp} style={styles.panel} testID="bidding-panel">
      <Text style={styles.panelTitle}>{t("yourTurn")}</Text>

      <View style={styles.suitRow}>
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.valueRow}
        style={{ maxHeight: 56 }}
      >
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
      </ScrollView>

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
          <Text style={[styles.bigActionText, { color: C.ink }]}>{t("capot")}</Text>
        </Pressable>
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
      {state.can_contre && (
        <Pressable
          testID="contre-button"
          onPress={() => onAction({ action: "contre" })}
          style={[styles.contreBtn, { alignSelf: "center", marginTop: SP.sm }]}
        >
          <Text style={styles.contreBtnText}>{t("contre")} ×2</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "rgba(250,248,245,0.97)",
    borderRadius: R.lg,
    padding: SP.lg,
    marginHorizontal: SP.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  panelTitle: {
    fontFamily: F.display,
    fontSize: 16,
    color: C.ink,
    textAlign: "center",
    marginBottom: SP.md,
  },
  suitRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SP.md,
    marginBottom: SP.md,
  },
  suitBtn: {
    width: 52,
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.cream,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  suitBtnActive: { borderColor: C.brand, backgroundColor: "#FBEFE9" },
  suitText: { fontSize: 28 },
  valueRow: { gap: SP.sm, paddingHorizontal: SP.xs },
  valueChip: {
    height: 40,
    minWidth: 56,
    borderRadius: R.pill,
    backgroundColor: C.cream,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP.md,
    flexShrink: 0,
  },
  valueChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  valueText: { fontFamily: F.extra, fontSize: 16, color: C.ink },
  actionRow: {
    flexDirection: "row",
    gap: SP.sm,
    marginTop: SP.md,
  },
  bigAction: {
    flex: 1,
    height: 50,
    borderRadius: R.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP.sm,
  },
  bigActionText: { fontFamily: F.display, fontSize: 14, color: C.onBrand },
  contreFloat: {
    position: "absolute",
    bottom: 8,
    right: SP.lg,
  },
  contreBtn: {
    backgroundColor: C.error,
    borderRadius: R.pill,
    paddingHorizontal: SP.xl,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  contreBtnText: { fontFamily: F.display, fontSize: 15, color: C.onBrand },
});
