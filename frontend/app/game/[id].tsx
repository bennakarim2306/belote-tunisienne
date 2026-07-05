import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChunkyButton from "@/src/components/ChunkyButton";
import BiddingPanel from "@/src/components/game/BiddingPanel";
import { HandEndModal, MatchEndOverlay } from "@/src/components/game/HandEndModal";
import HandFan from "@/src/components/game/HandFan";
import PlayerSeat from "@/src/components/game/PlayerSeat";
import TrickArea from "@/src/components/game/TrickArea";
import { SUIT_SYMBOL } from "@/src/components/PlayingCard";
import { useAuth } from "@/src/context/AuthContext";
import { useGameSocket } from "@/src/game/useGameSocket";
import { useI18n } from "@/src/i18n";
import { C, F, PATTERN_BG, R, SP } from "@/src/theme";

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const { state, events, connected, fatalError, send, leave } = useGameSocket(id);

  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [showLast, setShowLast] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastEventId = useRef(0);

  // process incoming events
  useEffect(() => {
    if (!events.list.length || events.id === lastEventId.current) return;
    lastEventId.current = events.id;
    for (const ev of events.list) {
      if (ev.e === "belote") {
        setBanner({ text: t(ev.word === "belote" ? "belote" : "rebelote"), key: Date.now() });
      } else if (ev.e === "contre") {
        setBanner({ text: t("contreBang"), key: Date.now() });
      } else if (ev.e === "surcontre") {
        setBanner({ text: t("surcontreBang"), key: Date.now() });
      } else if (ev.e === "capot") {
        setBanner({ text: t("capotBang"), key: Date.now() });
      } else if (ev.e === "redeal") {
        setBanner({ text: t("allPassed"), key: Date.now() });
      } else if (ev.e === "trick_end") {
        setShowLast(true);
        setTimeout(() => setShowLast(false), 1100);
        if (Platform.OS !== "web" && state && ev.winner_seat !== undefined &&
            ev.winner_seat % 2 === state.my_seat % 2) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else if (ev.e === "match_end" && Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // banner auto-hide
  useEffect(() => {
    if (!banner) return;
    const tm = setTimeout(() => setBanner(null), 1700);
    return () => clearTimeout(tm);
  }, [banner]);

  // my-turn countdown
  useEffect(() => {
    if (!state || state.turn !== state.my_seat ||
        (state.phase !== "bidding" && state.phase !== "playing")) {
      setRemaining(null);
      return;
    }
    const update = () => {
      setRemaining(Math.max(0, Math.round(state.turn_deadline - Date.now() / 1000)));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [state]);

  const quit = () => {
    leave();
    router.replace("/(tabs)/home");
  };

  if (fatalError) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>{t("gameNotFound")}</Text>
        <ChunkyButton
          testID="game-error-home-button"
          label={t("backHome")}
          onPress={() => router.replace("/(tabs)/home")}
        />
      </View>
    );
  }

  if (!state) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top }]} testID="game-loading">
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={styles.loadingText}>
          {connected ? t("waitingPlayers") : t("connecting")}
        </Text>
      </View>
    );
  }

  const mySeat = state.my_seat;
  const myTeam = mySeat % 2;
  const seatAt = (rel: number) =>
    state.players.find((p) => p.seat === (mySeat + rel) % 4)!;
  const partner = seatAt(2);
  const rightP = seatAt(1);
  const leftP = seatAt(3);
  const me = seatAt(0);

  // latest bid label per seat (during announcements)
  const bidLabels: Record<number, string> = {};
  if (state.phase === "bidding" || state.phase === "surcontre") {
    for (const b of state.bids) {
      if (b.type === "pass") bidLabels[b.seat] = t("pass");
      else if (b.type === "bid") bidLabels[b.seat] = `${b.value}${SUIT_SYMBOL[b.suit!]}`;
      else if (b.type === "capot") bidLabels[b.seat] = `${t("capot")} ${SUIT_SYMBOL[b.suit!]}`;
      else if (b.type === "contre") bidLabels[b.seat] = t("contreBang");
      else if (b.type === "surcontre") bidLabels[b.seat] = t("surcontreBang");
    }
  }

  const contract = state.contract;
  const contractChip = contract
    ? `${contract.capot ? t("capot") : contract.value}${SUIT_SYMBOL[contract.suit]}${
        contract.surcontre ? " ×4" : contract.contre ? " ×2" : ""
      }`
    : null;

  const myTurn = state.turn === mySeat;

  return (
    <View style={styles.container} testID="game-screen">
      <LinearGradient colors={[C.feltDark, C.felt, C.feltDark]} style={StyleSheet.absoluteFill} />
      <ImageBackground
        source={{ uri: PATTERN_BG }}
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.06 }}
      />

      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <Pressable
          testID="quit-game-button"
          onPress={() => setQuitOpen(true)}
          hitSlop={10}
          style={styles.quitBtn}
        >
          <Ionicons name="close" size={22} color={C.cream} />
        </Pressable>

        <View style={styles.scoreBox} testID="match-score-header">
          <Text style={styles.scoreText}>
            {t("us")} <Text style={styles.scoreNum}>{state.match_scores[myTeam]}</Text>
            {"  ·  "}
            <Text style={styles.scoreNum}>{state.match_scores[1 - myTeam]}</Text> {t("them")}
          </Text>
          <Text style={styles.targetText}>
            {t("hand", { n: state.hand_number })} · {state.target} pts
          </Text>
        </View>

        {contractChip ? (
          <View
            style={[
              styles.contractChip,
              { borderColor: contract!.team === myTeam ? C.gold : C.brand3 },
            ]}
            testID="contract-chip"
          >
            <Text style={styles.contractText}>{contractChip}</Text>
            <Text style={styles.contractTeam}>
              {contract!.team === myTeam ? t("us") : t("them")}
            </Text>
          </View>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      {/* table */}
      <View style={styles.table}>
        <View style={styles.partnerRow}>
          <PlayerSeat
            player={partner}
            isTurn={state.turn === partner.seat}
            isDealer={state.dealer === partner.seat}
            bidLabel={bidLabels[partner.seat]}
          />
        </View>

        <View style={styles.middleRow}>
          <PlayerSeat
            player={leftP}
            isTurn={state.turn === leftP.seat}
            isDealer={state.dealer === leftP.seat}
            bidLabel={bidLabels[leftP.seat]}
          />
          <TrickArea
            trick={state.trick}
            lastTrick={state.last_trick}
            showLastTrick={showLast}
            mySeat={mySeat}
            trump={state.trump}
          />
          <PlayerSeat
            player={rightP}
            isTurn={state.turn === rightP.seat}
            isDealer={state.dealer === rightP.seat}
            bidLabel={bidLabels[rightP.seat]}
          />
        </View>

        {/* my info row */}
        <View style={styles.myRow}>
          <PlayerSeat
            player={me}
            isTurn={myTurn}
            isDealer={state.dealer === mySeat}
            bidLabel={bidLabels[mySeat]}
            isMe
            size={40}
          />
          {myTurn && state.phase === "playing" && (
            <View style={styles.turnPill} testID="your-turn-pill">
              <Text style={styles.turnPillText}>{t("yourTurn")}</Text>
              {remaining !== null && remaining <= 15 && (
                <Text style={styles.turnTimer}>{remaining}s</Text>
              )}
            </View>
          )}
          {!connected && (
            <View style={[styles.turnPill, { backgroundColor: C.warning }]}>
              <Text style={[styles.turnPillText, { color: C.ink }]}>{t("reconnecting")}</Text>
            </View>
          )}
        </View>
      </View>

      {/* my hand */}
      <View style={{ paddingBottom: Math.max(insets.bottom, SP.sm) }}>
        <HandFan
          hand={state.hand}
          legal={state.legal}
          myTurn={myTurn && state.phase === "playing"}
          trump={state.trump}
          onPlay={(card) => send({ action: "play", card })}
        />
      </View>

      {/* bidding overlays */}
      <View
        style={[styles.biddingWrap, { bottom: insets.bottom + 140 }]}
        pointerEvents="box-none"
      >
        <BiddingPanel state={state} t={t} onAction={send} />
      </View>

      {/* banner */}
      {banner && (
        <Animated.View
          key={banner.key}
          entering={ZoomIn.springify().damping(12)}
          exiting={FadeOut}
          style={styles.banner}
          pointerEvents="none"
        >
          <Text style={styles.bannerText} testID="game-banner-text">
            {banner.text}
          </Text>
        </Animated.View>
      )}

      {/* hand end */}
      {state.phase === "hand_end" && state.hand_result && (
        <HandEndModal
          result={state.hand_result}
          mySeat={mySeat}
          deadline={state.turn_deadline}
          t={t}
        />
      )}

      {/* match end */}
      {state.phase === "finished" && (
        <MatchEndOverlay
          state={state}
          myUserId={user?.user_id ?? ""}
          t={t}
          onHome={quit}
        />
      )}

      {/* quit confirm */}
      <Modal visible={quitOpen} transparent animationType="fade">
        <View style={styles.quitScrim}>
          <View style={styles.quitCard}>
            <Text style={styles.quitTitle}>{t("quitGame")}</Text>
            <Text style={styles.quitDesc}>{t("quitGameDesc")}</Text>
            <View style={styles.quitRow}>
              <ChunkyButton
                testID="quit-cancel-button"
                label={t("stay")}
                variant="secondary"
                small
                onPress={() => setQuitOpen(false)}
                style={{ flex: 1 }}
              />
              <ChunkyButton
                testID="quit-confirm-button"
                label={t("quitConfirm")}
                variant="danger"
                small
                onPress={quit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.feltDark },
  loadingWrap: {
    flex: 1,
    backgroundColor: C.feltDark,
    alignItems: "center",
    justifyContent: "center",
    gap: SP.lg,
    padding: SP.xl,
  },
  loadingText: { fontFamily: F.display, fontSize: 16, color: C.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP.md,
    paddingBottom: SP.sm,
  },
  quitBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBox: { alignItems: "center" },
  scoreText: { fontFamily: F.text, fontSize: 13, color: "rgba(255,255,255,0.8)" },
  scoreNum: { fontFamily: F.extra, fontSize: 17, color: C.cream },
  targetText: { fontFamily: F.text, fontSize: 10.5, color: "rgba(255,255,255,0.55)" },
  contractChip: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: R.md,
    borderWidth: 1.5,
    paddingHorizontal: SP.md,
    paddingVertical: 4,
    alignItems: "center",
    minWidth: 64,
  },
  contractText: { fontFamily: F.extra, fontSize: 15, color: C.cream },
  contractTeam: { fontFamily: F.text, fontSize: 10, color: "rgba(255,255,255,0.7)" },
  table: { flex: 1 },
  partnerRow: { alignItems: "center", marginTop: SP.xs },
  middleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP.xs,
  },
  myRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP.lg,
    gap: SP.md,
  },
  turnPill: {
    backgroundColor: C.gold,
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
  },
  turnPillText: { fontFamily: F.display, fontSize: 13, color: C.ink },
  turnTimer: { fontFamily: F.extra, fontSize: 14, color: C.error },
  biddingWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  banner: {
    position: "absolute",
    top: "34%",
    alignSelf: "center",
    backgroundColor: C.gold,
    borderRadius: R.pill,
    paddingHorizontal: SP.xxl,
    paddingVertical: SP.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  bannerText: { fontFamily: F.display, fontSize: 24, color: C.ink },
  quitScrim: {
    flex: 1,
    backgroundColor: C.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: SP.xl,
  },
  quitCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.bg,
    borderRadius: R.lg,
    padding: SP.xl,
  },
  quitTitle: { fontFamily: F.display, fontSize: 20, color: C.ink, textAlign: "center" },
  quitDesc: {
    fontFamily: F.text,
    fontSize: 14,
    color: C.ink2,
    textAlign: "center",
    marginTop: SP.sm,
  },
  quitRow: { flexDirection: "row", gap: SP.md, marginTop: SP.lg },
});
