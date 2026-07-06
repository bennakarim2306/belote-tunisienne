import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { SUIT_COLOR, SUIT_SYMBOL } from "@/src/components/PlayingCard";
import ChunkyButton from "@/src/components/ChunkyButton";
import { GameState, HandResult } from "@/src/game/useGameSocket";
import { TKey } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

type TFunc = (key: TKey, vars?: Record<string, string | number>) => string;

function useCountdown(deadline: number) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.round(deadline - Date.now() / 1000)),
  );
  useEffect(() => {
    const iv = setInterval(() => {
      setRemaining(Math.max(0, Math.round(deadline - Date.now() / 1000)));
    }, 500);
    return () => clearInterval(iv);
  }, [deadline]);
  return remaining;
}

export function HandEndModal({
  result,
  mySeat,
  deadline,
  t,
}: {
  result: HandResult;
  mySeat: number;
  deadline: number;
  t: TFunc;
}) {
  const remaining = useCountdown(deadline);
  const myTeam = mySeat % 2;
  const otherTeam = 1 - myTeam;
  const c = result.contract;

  const teamLabel = (team: number) => (team === myTeam ? t("us") : t("them"));

  return (
    <View style={styles.scrim} testID="hand-end-modal">
      <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.card}>
        <Text style={styles.contractLine}>
          {t("contract")} : {c.capot ? t("capot") : c.value}
          <Text style={{ color: SUIT_COLOR[c.suit] }}> {SUIT_SYMBOL[c.suit]}</Text>
          {c.surcontre ? ` · ${t("surcontred")}` : c.contre ? ` · ${t("contred")}` : ""}
          {" — "}
          {teamLabel(c.team)}
        </Text>
        <View
          style={[
            styles.resultBadge,
            { backgroundColor: result.success ? C.green : C.error },
          ]}
          testID="hand-result-badge"
        >
          <Ionicons
            name={result.success ? "checkmark-circle" : "close-circle"}
            size={18}
            color={C.cream}
          />
          <Text style={styles.resultBadgeText}>
            {result.capot_team !== null
              ? t("capotLine")
              : result.success
                ? t("contractMade")
                : t("contractFailed")}
          </Text>
        </View>

        <View style={styles.scoreTable}>
          <View style={styles.scoreHeaderRow}>
            <Text style={styles.scoreHeaderCell}></Text>
            <Text style={[styles.scoreHeaderCell, styles.teamName]}>{teamLabel(myTeam)}</Text>
            <Text style={[styles.scoreHeaderCell, styles.teamName]}>{teamLabel(otherTeam)}</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>{t("points")}</Text>
            <Text style={styles.scoreCell}>{result.raw_points[myTeam]}</Text>
            <Text style={styles.scoreCell}>{result.raw_points[otherTeam]}</Text>
          </View>
          {result.belote_team !== null && (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{t("beloteBonus")}</Text>
              <Text style={styles.scoreCell}>
                {result.belote_team === myTeam ? "+20" : "—"}
              </Text>
              <Text style={styles.scoreCell}>
                {result.belote_team === otherTeam ? "+20" : "—"}
              </Text>
            </View>
          )}
          <View style={[styles.scoreRow, styles.scoreRowFinal]}>
            <Text style={[styles.scoreLabel, { fontFamily: F.extra }]}>
              {t("handScores")}
            </Text>
            <Text style={[styles.scoreCell, styles.scoreCellFinal]}>
              {result.hand_scores[myTeam]}
            </Text>
            <Text style={[styles.scoreCell, styles.scoreCellFinal]}>
              {result.hand_scores[otherTeam]}
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>{t("matchScore")}</Text>
            <Text style={[styles.scoreCell, { color: C.brand }]}>
              {result.match_scores[myTeam]}
            </Text>
            <Text style={[styles.scoreCell, { color: C.brand }]}>
              {result.match_scores[otherTeam]}
            </Text>
          </View>
        </View>

        {!result.match_over && (
          <Text style={styles.countdown}>{t("nextHandIn", { n: remaining })}</Text>
        )}
      </Animated.View>
    </View>
  );
}

export function MatchEndOverlay({
  state,
  myUserId,
  t,
  onHome,
}: {
  state: GameState;
  myUserId: string;
  t: TFunc;
  onHome: () => void;
}) {
  const myTeam = state.my_seat % 2;
  const won = state.winner_team === myTeam;
  const eloDelta = state.elo_changes?.[myUserId] ?? 0;

  return (
    <View style={styles.scrim} testID="match-end-overlay">
      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.card}>
        <Animated.View entering={FadeIn.delay(200)}>
          <Ionicons
            name={won ? "trophy" : "sad-outline"}
            size={64}
            color={won ? C.gold : C.ink3}
            style={{ alignSelf: "center" }}
          />
        </Animated.View>
        <Text style={[styles.victoryText, { color: won ? C.green : C.error }]} testID="match-result-text">
          {won ? t("victory") : t("defeat")}
        </Text>
        <Text style={styles.finalLabel}>{t("finalScore")}</Text>
        <Text style={styles.finalScore}>
          {t("us")} {state.match_scores[myTeam]} — {state.match_scores[1 - myTeam]}{" "}
          {t("them")}
        </Text>
        {eloDelta !== 0 && (
          <View
            style={[
              styles.eloDelta,
              { backgroundColor: eloDelta > 0 ? "#E4F2E5" : "#FBE9EB" },
            ]}
            testID="elo-delta-badge"
          >
            <Ionicons
              name={eloDelta > 0 ? "trending-up" : "trending-down"}
              size={18}
              color={eloDelta > 0 ? C.green : C.error}
            />
            <Text
              style={[
                styles.eloDeltaText,
                { color: eloDelta > 0 ? C.green : C.error },
              ]}
            >
              {eloDelta > 0 ? "+" : ""}
              {eloDelta} ELO
            </Text>
          </View>
        )}
        <ChunkyButton
          testID="back-home-button"
          label={t("backHome")}
          onPress={onHome}
          style={{ marginTop: SP.lg }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,24,18,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP.xl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: C.bg,
    borderRadius: R.lg,
    padding: SP.xl,
  },
  contractLine: {
    fontFamily: F.display,
    fontSize: 17,
    color: C.ink,
    textAlign: "center",
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 36,
    marginTop: SP.md,
  },
  resultBadgeText: { fontFamily: F.display, fontSize: 14, color: C.cream },
  scoreTable: { marginTop: SP.lg },
  scoreHeaderRow: { flexDirection: "row", marginBottom: SP.sm },
  scoreHeaderCell: { flex: 1 },
  teamName: {
    fontFamily: F.display,
    fontSize: 14,
    color: C.ink2,
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: C.border,
    alignItems: "center",
  },
  scoreRowFinal: { backgroundColor: C.bg2, borderRadius: R.sm },
  scoreLabel: { flex: 1, fontFamily: F.bold, fontSize: 13, color: C.ink2 },
  scoreCell: {
    flex: 1,
    fontFamily: F.extra,
    fontSize: 15,
    color: C.ink,
    textAlign: "center",
  },
  scoreCellFinal: { fontSize: 18, color: C.brand },
  countdown: {
    fontFamily: F.bold,
    fontSize: 13,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.lg,
  },
  victoryText: {
    fontFamily: F.display,
    fontSize: 32,
    textAlign: "center",
    marginTop: SP.sm,
  },
  finalLabel: {
    fontFamily: F.text,
    fontSize: 13,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.md,
  },
  finalScore: {
    fontFamily: F.display,
    fontSize: 22,
    color: C.ink,
    textAlign: "center",
    marginTop: 4,
  },
  eloDelta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 38,
    marginTop: SP.md,
  },
  eloDeltaText: { fontFamily: F.extra, fontSize: 16 },
});
