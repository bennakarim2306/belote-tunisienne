import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ANIME_THEME_ENABLED } from "@/src/anime/flags";
import { AnimeWindowFrame, GameButton } from "@/src/anime/game/AnimeUI";
import Emblem from "@/src/anime/game/Emblem";
import { A } from "@/src/anime/tokens";
import { SUIT_COLOR_ON_DARK, SUIT_SYMBOL } from "@/src/components/PlayingCard";
import VictoryCelebration from "@/src/components/game/VictoryCelebration";
import { useAuth } from "@/src/context/AuthContext";
import { GameState, HandResult } from "@/src/game/useGameSocket";
import { TKey } from "@/src/i18n";
import { maybeAskStoreReview } from "@/src/review";
import { playSound } from "@/src/sound";
import { C, F, R, SP } from "@/src/theme";

const ANIME = ANIME_THEME_ENABLED;

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
  readySeats,
  humanSeats,
  onReady,
  t,
}: {
  result: HandResult;
  mySeat: number;
  deadline: number;
  readySeats: number[];
  humanSeats: number[];
  onReady: () => void;
  t: TFunc;
}) {
  const remaining = useCountdown(deadline);
  const myTeam = mySeat % 2;
  const otherTeam = 1 - myTeam;
  const c = result.contract;
  const iAmReady = readySeats.includes(mySeat);
  const readyCount = humanSeats.filter((s) => readySeats.includes(s)).length;
  const total = humanSeats.length;

  const teamLabel = (team: number) => (team === myTeam ? t("us") : t("them"));

  return (
    <View style={styles.scrim} testID="hand-end-modal">
      <Animated.View
        entering={FadeInDown.duration(320).easing(Easing.out(Easing.cubic))}
        style={[styles.card, ANIME && styles.animeCard]}
      >
        {ANIME && <AnimeWindowFrame />}
        {ANIME && (
          <View style={styles.animeHandEmblem} pointerEvents="none">
            <Emblem kind={result.success ? "made" : "failed"} size={62} />
          </View>
        )}
        <Text style={[styles.contractLine, ANIME && styles.animeTitle]}>
          {t("contract")} : {c.capot ? t("capot") : c.value}
          <Text style={{ color: SUIT_COLOR_ON_DARK[c.suit] }}> {SUIT_SYMBOL[c.suit]}</Text>
          {c.surcontre ? ` · ${t("surcontred")}` : c.contre ? ` · ${t("contred")}` : ""}
          {" — "}
          {teamLabel(c.team)}
        </Text>
        <View
          style={[
            styles.resultBadge,
            { backgroundColor: result.success ? C.green : C.error },
            ANIME && styles.animeBadge,
            ANIME && { backgroundColor: result.success ? A.emeraldBright : "#8E1820" },
          ]}
          testID="hand-result-badge"
        >
          <Ionicons
            name={result.success ? "checkmark-circle" : "close-circle"}
            size={18}
            color={ANIME ? A.ivory : result.success ? "#051A10" : C.cream}
          />
          <Text
            style={[
              styles.resultBadgeText,
              result.success && { color: "#051A10" },
              ANIME && { color: A.ivory },
            ]}
          >
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
            <Text style={[styles.scoreHeaderCell, styles.teamName, ANIME && styles.animeTeam]}>{teamLabel(myTeam)}</Text>
            <Text style={[styles.scoreHeaderCell, styles.teamName, ANIME && styles.animeTeam]}>{teamLabel(otherTeam)}</Text>
          </View>
          <View style={[styles.scoreRow, ANIME && styles.animeRow]}>
            <Text style={[styles.scoreLabel, ANIME && styles.animeLabel]}>{t("points")}</Text>
            <Text style={[styles.scoreCell, ANIME && styles.animeCell]}>{result.raw_points[myTeam]}</Text>
            <Text style={[styles.scoreCell, ANIME && styles.animeCell]}>{result.raw_points[otherTeam]}</Text>
          </View>
          {result.belote_team !== null && (
            <View style={[styles.scoreRow, ANIME && styles.animeRow]}>
              <Text style={[styles.scoreLabel, ANIME && styles.animeLabel]}>{t("beloteBonus")}</Text>
              <Text style={[styles.scoreCell, ANIME && styles.animeCell]}>
                {result.belote_team === myTeam ? "+20" : "—"}
              </Text>
              <Text style={[styles.scoreCell, ANIME && styles.animeCell]}>
                {result.belote_team === otherTeam ? "+20" : "—"}
              </Text>
            </View>
          )}
          <View style={[styles.scoreRow, styles.scoreRowFinal, ANIME && styles.animeRow, ANIME && styles.animeRowFinal]}>
            <Text style={[styles.scoreLabel, { fontFamily: F.extra }, ANIME && styles.animeLabel]}>
              {t("handScores")}
            </Text>
            <Text style={[styles.scoreCell, styles.scoreCellFinal, ANIME && styles.animeCellFinal]}>
              {result.hand_scores[myTeam]}
            </Text>
            <Text style={[styles.scoreCell, styles.scoreCellFinal, ANIME && styles.animeCellFinal]}>
              {result.hand_scores[otherTeam]}
            </Text>
          </View>
          <View style={[styles.scoreRow, ANIME && styles.animeRow]}>
            <Text style={[styles.scoreLabel, ANIME && styles.animeLabel]}>{t("matchScore")}</Text>
            <Text style={[styles.scoreCell, { color: C.brand }, ANIME && styles.animeCellFinal]}>
              {result.match_scores[myTeam]}
            </Text>
            <Text style={[styles.scoreCell, { color: C.brand }, ANIME && styles.animeCellFinal]}>
              {result.match_scores[otherTeam]}
            </Text>
          </View>
        </View>

        {!iAmReady ? (
          <GameButton
            testID="hand-continue-button"
            label={total > 1 ? `${t("continueBtn")} (${readyCount}/${total})` : t("continueBtn")}
            onPress={onReady}
            small
            style={{ marginTop: SP.md }}
          />
        ) : total > 1 ? (
          <Text style={[styles.waitingReady, ANIME && { color: A.goldLight }]} testID="hand-waiting-others">
            {t("waitingOthers")} ({readyCount}/{total})
          </Text>
        ) : null}

        {!result.match_over && (
          <Text style={[styles.countdown, ANIME && { color: A.ivoryDim }]}>{t("nextHandIn", { n: remaining })}</Text>
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
  onReplay,
  onlineWaiting = 0,
  onPlayOnline,
}: {
  state: GameState;
  myUserId: string;
  t: TFunc;
  onHome: () => void;
  onReplay?: () => void;
  /** humans currently waiting in the online queue (solo vs AI games only) */
  onlineWaiting?: number;
  onPlayOnline?: () => void;
}) {
  const myTeam = state.my_seat % 2;
  const won = state.winner_team === myTeam;
  const eloDelta = state.elo_changes?.[myUserId] ?? 0;
  const { user } = useAuth();

  // victory fanfare / defeat tone (once, when the overlay appears)
  useEffect(() => {
    playSound(won ? "victory" : "defeat", won ? 0.9 : 0.65);
    // store-review nudge: only after a WIN, for loyal players (native builds)
    if (won) maybeAskStoreReview(user?.games_played ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pulsing mint glow around the trophy
  const glowP = useSharedValue(0);
  useEffect(() => {
    glowP.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [glowP]);
  const trophyGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.45 + glowP.value * 0.5,
    shadowRadius: 18 + glowP.value * 14,
    borderColor: `rgba(0,229,122,${0.35 + glowP.value * 0.5})`,
    transform: [{ scale: 1 + glowP.value * 0.05 }],
  }));

  return (
    <View style={styles.scrim} testID="match-end-overlay">
      <Animated.View
        entering={ANIME ? ZoomIn.duration(260) : ZoomIn.springify().damping(14)}
        style={[styles.card, ANIME && styles.animeCard]}
      >
        {ANIME && <AnimeWindowFrame />}
        {ANIME ? (
          <View style={styles.animeMatchEmblem} testID={won ? "victory-trophy" : "defeat-emblem"}>
            <Emblem kind={won ? "victory" : "defeat"} size={96} />
          </View>
        ) : won ? (
          <Animated.View
            entering={ZoomIn.springify().damping(10).delay(150)}
            style={{ alignSelf: "center" }}
          >
            <Animated.View style={[styles.trophyGlow, trophyGlowStyle]} testID="victory-trophy">
              <Ionicons name="trophy" size={54} color={C.gold} />
            </Animated.View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.delay(200)}>
            <Ionicons
              name="sad-outline"
              size={64}
              color={C.ink3}
              style={{ alignSelf: "center" }}
            />
          </Animated.View>
        )}
        <Text style={[styles.victoryText, { color: won ? C.green : C.error }, ANIME && styles.animeVictory, ANIME && !won && { color: "#FF8A80" }]} testID="match-result-text">
          {won ? t("victory") : t("defeat")}
        </Text>
        <Text style={[styles.finalLabel, ANIME && { color: A.ivoryDim }]}>{t("finalScore")}</Text>
        <Text style={[styles.finalScore, ANIME && { fontFamily: F.serif, color: A.ivory }]}>
          {t("us")} {state.match_scores[myTeam]} — {state.match_scores[1 - myTeam]}{" "}
          {t("them")}
        </Text>
        {eloDelta !== 0 && (
          <View
            style={[
              styles.eloDelta,
              { backgroundColor: eloDelta > 0 ? "rgba(0,229,122,0.14)" : "rgba(255,68,68,0.14)" },
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
        {/* anime: buttons share a wrapping row so the window always fits */}
        <View style={ANIME ? styles.animeButtons : undefined}>
        {onPlayOnline && onlineWaiting > 0 && (
          <GameButton
            testID="match-end-online-button"
            label={t("matchEndOnline", { n: onlineWaiting })}
            onPress={onPlayOnline}
            small
            style={{ marginTop: SP.md }}
          />
        )}
        {onReplay && (
          <GameButton
            testID="replay-button"
            label={t("replay")}
            onPress={onReplay}
            small
            variant={onPlayOnline && onlineWaiting > 0 ? "secondary" : undefined}
            style={{ marginTop: !ANIME && onPlayOnline && onlineWaiting > 0 ? SP.sm : SP.md }}
          />
        )}
        <GameButton
          testID="back-home-button"
          label={t("backHome")}
          onPress={onHome}
          small
          variant={onReplay || (onPlayOnline && onlineWaiting > 0) ? "secondary" : undefined}
          style={{ marginTop: ANIME || !onReplay ? SP.md : SP.sm }}
        />
        </View>
      </Animated.View>
      {won && <VictoryCelebration />}
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- anime theme ----
  animeCard: { backgroundColor: "transparent", borderRadius: 0, paddingHorizontal: 40, paddingVertical: 24 },
  animeHandEmblem: { position: "absolute", top: 14, left: 26 },
  animeButtons: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 8 },
  animeMatchEmblem: { alignSelf: "center", marginBottom: -4 },
  animeTitle: { fontFamily: F.serif, color: A.goldLight },
  animeBadge: { borderWidth: 1.5, borderColor: A.gold },
  animeRow: { borderTopColor: "rgba(214,172,86,0.3)" },
  animeRowFinal: { backgroundColor: "rgba(214,172,86,0.14)" },
  animeLabel: { color: A.ivoryDim },
  animeCell: { color: A.ivory },
  animeCellFinal: { fontFamily: F.serif, color: A.goldLight },
  animeTeam: { fontFamily: F.serif, color: A.gold },
  animeVictory: { fontFamily: F.serif, color: A.goldLight },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,24,18,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP.xl,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "96%",
    backgroundColor: C.bg,
    borderRadius: R.lg,
    padding: SP.lg,
  },
  contractLine: {
    fontFamily: F.display,
    fontSize: 15,
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
    height: 30,
    marginTop: SP.sm,
  },
  resultBadgeText: { fontFamily: F.display, fontSize: 13, color: C.cream },
  scoreTable: { marginTop: SP.sm },
  scoreHeaderRow: { flexDirection: "row", marginBottom: SP.xs },
  scoreHeaderCell: { flex: 1 },
  teamName: {
    fontFamily: F.display,
    fontSize: 14,
    color: C.ink2,
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    paddingVertical: 5,
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
    fontSize: 12,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.sm,
  },
  waitingReady: {
    fontFamily: F.display,
    fontSize: 14,
    color: C.brand,
    textAlign: "center",
    marginTop: SP.md,
  },
  victoryText: {
    fontFamily: F.display,
    fontSize: 26,
    textAlign: "center",
    marginTop: SP.xs,
  },
  trophyGlow: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,229,122,0.10)",
    borderWidth: 1.5,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  finalLabel: {
    fontFamily: F.text,
    fontSize: 13,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.sm,
  },
  finalScore: {
    fontFamily: F.display,
    fontSize: 20,
    color: C.ink,
    textAlign: "center",
    marginTop: 2,
  },
  eloDelta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 34,
    marginTop: SP.sm,
  },
  eloDeltaText: { fontFamily: F.extra, fontSize: 15 },
});
