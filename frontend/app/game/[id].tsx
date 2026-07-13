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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChunkyButton from "@/src/components/ChunkyButton";
import {
  maybeShowInterstitialAfterMatch,
  preloadInterstitial,
} from "@/src/ads/interstitial";
import BiddingPanel from "@/src/components/game/BiddingPanel";
import CoachBubble from "@/src/components/game/CoachBubble";
import DealAnimation from "@/src/components/game/DealAnimation";
import { HandEndModal, MatchEndOverlay } from "@/src/components/game/HandEndModal";
import HandFan from "@/src/components/game/HandFan";
import PlayerSeat from "@/src/components/game/PlayerSeat";
import TrickArea from "@/src/components/game/TrickArea";
import PlayingCard, { SUIT_COLOR_ON_DARK, SUIT_SYMBOL, rankLabel } from "@/src/components/PlayingCard";
import { useAuth } from "@/src/context/AuthContext";
import { useGameSocket } from "@/src/game/useGameSocket";
import { TKey, useI18n } from "@/src/i18n";
import { playSound } from "@/src/sound";
import { C, F, PATTERN_BG, R, SP } from "@/src/theme";

type TFunc = (key: TKey, vars?: Record<string, string | number>) => string;

const CHAT_MSGS = ["wellPlayed", "yezzi", "aychek", "luck", "yalla", "oops", "sahha", "thinking"];
const CHAT_EMOJIS = ["😂", "😭", "😡", "🔥", "👏", "🤝", "😎", "🎉"];

function PausedOverlay({
  until,
  requesterName,
  reason,
  canResume,
  onResume,
  t,
}: {
  until: number;
  requesterName: string;
  reason: "request" | "disconnect";
  canResume: boolean;
  onResume: () => void;
  t: TFunc;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round(until - Date.now() / 1000)),
  );
  useEffect(() => {
    const iv = setInterval(
      () => setRemaining(Math.max(0, Math.round(until - Date.now() / 1000))),
      1000,
    );
    return () => clearInterval(iv);
  }, [until]);
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const disconnect = reason === "disconnect";
  return (
    <View style={styles.pausedScrim} testID="paused-overlay">
      <Ionicons
        name={disconnect ? "wifi" : "pause-circle"}
        size={44}
        color={disconnect ? C.warning : C.gold}
      />
      <Text style={styles.pausedTitle}>
        {disconnect ? t("connLostTitle") : t("pausedTitle")}
      </Text>
      <Text style={styles.pausedBy} testID="paused-reason">
        {disconnect
          ? t("connLostBy", { name: requesterName })
          : t("pausedBy", { name: requesterName })}
      </Text>
      <Text style={styles.pausedTimer} testID="paused-countdown">
        {t("autoResumeIn", { t: `${mm}:${ss}` })}
      </Text>
      {disconnect && <Text style={styles.pausedHint}>{t("connLostHint")}</Text>}
      {canResume && (
        <ChunkyButton
          testID="pause-resume-button"
          label={t("resume")}
          onPress={onResume}
          style={{ marginTop: SP.md, minWidth: 180 }}
        />
      )}
    </View>
  );
}

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
  const [lastTrickOpen, setLastTrickOpen] = useState(false);
  const [scoresOpen, setScoresOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dealing, setDealing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBubbles, setChatBubbles] = useState<Record<number, { text: string; key: number }>>({});
  const chatTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [coachMsg, setCoachMsg] = useState<{ text: string; key: number } | null>(null);
  const coachMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [handEndReady, setHandEndReady] = useState(false);
  const prevPhaseRef = useRef<string | null>(null);
  const lastEventId = useRef(0);
  const prevHandRef = useRef<number | null>(null);

  // transient coach commentary (e.g. what an opponent's bid may mean)
  const showCoachMsg = (text: string) => {
    setCoachMsg({ text, key: Date.now() });
    if (coachMsgTimer.current) clearTimeout(coachMsgTimer.current);
    coachMsgTimer.current = setTimeout(() => setCoachMsg(null), 6500);
  };

  // trigger the dealing animation on every fresh hand
  useEffect(() => {
    if (!state) return;
    const prev = prevHandRef.current;
    if (prev === null) {
      prevHandRef.current = state.hand_number;
      if (state.phase === "bidding" && state.bids.length === 0) {
        setDealing(true);
        playSound("deal", 0.7);
      }
    } else if (state.hand_number !== prev) {
      prevHandRef.current = state.hand_number;
      setDealing(true);
      playSound("deal", 0.7);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [state]);

  // process incoming events
  useEffect(() => {
    if (!events.list.length || events.id === lastEventId.current) return;
    lastEventId.current = events.id;
    for (const ev of events.list) {
      if (ev.e === "play") {
        playSound("card", 0.5);
      } else if (ev.e === "chat" && ev.seat !== undefined) {
        const seat = ev.seat;
        const text = ev.kind === "msg" ? t(`chat_${ev.msg}` as TKey) : (ev.msg ?? "");
        setChatBubbles((b) => ({ ...b, [seat]: { text, key: Date.now() } }));
        if (chatTimers.current[seat]) clearTimeout(chatTimers.current[seat]);
        chatTimers.current[seat] = setTimeout(() => {
          setChatBubbles((b) => {
            const next = { ...b };
            delete next[seat];
            return next;
          });
        }, 2800);
      } else if (ev.e === "belote") {
        playSound("belote");
        setBanner({ text: t(ev.word === "belote" ? "belote" : "rebelote"), key: Date.now() });
      } else if (ev.e === "bid" && state?.coach_mode && ev.seat !== undefined &&
                 ev.seat !== state.my_seat) {
        const name = state.players.find((p) => p.seat === ev.seat)?.username ?? "";
        const suitSym = SUIT_SYMBOL[ev.suit ?? ""] ?? "";
        const isPartner = ev.seat % 2 === state.my_seat % 2;
        const key = isPartner
          ? "coach_partner_bid"
          : `coach_opp_bid_${Math.min(ev.value ?? 90, 130)}`;
        showCoachMsg(t(key as TKey, { name, value: String(ev.value ?? ""), suit: suitSym }));
      } else if (ev.e === "contre") {
        setBanner({ text: t("contreBang"), key: Date.now() });
        if (state?.coach_mode && ev.seat !== undefined &&
            ev.seat % 2 !== state.my_seat % 2) {
          const name = state.players.find((p) => p.seat === ev.seat)?.username ?? "";
          showCoachMsg(t("coach_opp_contre", { name }));
        }
      } else if (ev.e === "surcontre") {
        setBanner({ text: t("surcontreBang"), key: Date.now() });
      } else if (ev.e === "capot") {
        setBanner({ text: t("capotBang"), key: Date.now() });
      } else if (ev.e === "redeal") {
        setBanner({ text: t("allPassed"), key: Date.now() });
      } else if (ev.e === "pause_declined") {
        setBanner({ text: t("pauseDeclined"), key: Date.now() });
      } else if (ev.e === "trick_end") {
        // the completed trick rests ~0.9s (so the 4th card is clearly seen),
        // then the collect animation plays (~1s) — see TrickArea HOLD_MS
        setShowLast(true);
        setTimeout(() => playSound("trick", 0.7), 850);
        setTimeout(() => setShowLast(false), 2050);
        if (Platform.OS !== "web" && state && ev.winner_seat !== undefined &&
            ev.winner_seat % 2 === state.my_seat % 2) {
          setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }, 850);
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

  // my-turn countdown (only for timed games)
  useEffect(() => {
    if (!state || !state.turn_timeout || state.turn !== state.my_seat ||
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

  // the hand-end recap waits for the final trick's rest + collect animation
  // (fresh transition from "playing" only — rejoins show it immediately)
  useEffect(() => {
    const phase = state?.phase;
    if (phase !== "hand_end") {
      setHandEndReady(false);
      prevPhaseRef.current = phase ?? null;
      return;
    }
    const fresh = prevPhaseRef.current === "playing";
    prevPhaseRef.current = phase;
    if (!fresh) {
      setHandEndReady(true);
      return;
    }
    const tm = setTimeout(() => setHandEndReady(true), 2150);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase]);

  const quit = () => {
    leave();
    router.replace("/(tabs)/home");
  };

  // interstitial ad (native builds only): preload once, show after match per frequency rules
  useEffect(() => {
    preloadInterstitial();
  }, []);
  const quitAfterMatch = () => {
    maybeShowInterstitialAfterMatch(state?.origin ?? "online").finally(quit);
  };

  const sendChat = (kind: "msg" | "emoji", value: string) => {
    send({ action: "chat", kind, value });
    setChatOpen(false);
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
  // clockwise play direction on screen: me (bottom) -> left -> top -> right
  const leftP = seatAt(1);
  const rightP = seatAt(3);
  const me = seatAt(0);

  // latest bid label per seat (during announcements)
  const bidLabels: Record<number, { text: string; suit?: string }> = {};
  if (state.phase === "bidding" || state.phase === "surcontre") {
    for (const b of state.bids) {
      if (b.type === "pass") bidLabels[b.seat] = { text: t("pass") };
      else if (b.type === "bid") bidLabels[b.seat] = { text: `${b.value}`, suit: b.suit };
      else if (b.type === "capot") bidLabels[b.seat] = { text: t("capot"), suit: b.suit };
      else if (b.type === "contre") bidLabels[b.seat] = { text: t("contreBang") };
      else if (b.type === "surcontre") bidLabels[b.seat] = { text: t("surcontreBang") };
    }
  }

  const contract = state.contract;

  const myTurn = state.turn === mySeat;

  // tutorial coach: my-turn hint takes precedence over transient commentary
  const fmtCard = (c: string) => rankLabel(c.slice(0, -1)) + (SUIT_SYMBOL[c.slice(-1)] ?? "");
  let coachHintText: string | null = null;
  if (state.coach_mode && state.coach && myTurn && !state.paused) {
    const h = state.coach;
    coachHintText =
      h.kind === "play" && h.card
        ? t(`coach_${h.reason}` as TKey, { card: fmtCard(h.card) })
        : t(`coach_${h.reason}` as TKey, {
            value: String(h.value ?? ""),
            suit: h.suit ? SUIT_SYMBOL[h.suit] : "",
            n: String(h.n ?? ""),
            prev: String(h.prev ?? ""),
            need: String(h.need ?? ""),
            needBelote: String(h.need_belote ?? ""),
          });
  }
  const coachDisplay = state.coach_mode ? (coachHintText ?? coachMsg?.text ?? null) : null;
  const coachCard =
    state.coach_mode && myTurn && state.coach?.kind === "play" ? state.coach.card : null;

  // announced contract holder badge (visible while the hand is being played)
  const contractLabelFor = (seat: number) =>
    contract &&
    contract.seat === seat &&
    (state.phase === "playing" || state.phase === "hand_end")
      ? { text: contract.capot ? t("capot") : String(contract.value), suit: contract.suit }
      : null;

  // countdown visible on the active player's seat for everyone (timed games)
  const seatTimerOn =
    !!state.turn_timeout &&
    !state.paused &&
    (state.phase === "bidding" || state.phase === "playing");

  const canPause =
    !state.paused &&
    !state.pause_req &&
    (state.phase === "bidding" || state.phase === "playing");
  const pauseAskMe =
    !!state.pause_req &&
    state.pause_req.seat !== mySeat &&
    state.pause_req.required.includes(mySeat) &&
    !state.pause_req.accepts.includes(mySeat);

  return (
    <View style={styles.container} testID="game-screen">
      <LinearGradient colors={[C.feltDark, C.felt, C.feltDark]} style={StyleSheet.absoluteFill} />
      <ImageBackground
        source={{ uri: PATTERN_BG }}
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.09 }}
      />
      {/* ornamental gilded frame + central medallion */}
      <View pointerEvents="none" style={styles.ornateFrame} />
      <View pointerEvents="none" style={styles.medallionWrap}>
        <View style={styles.medallionOuter} />
        <View style={styles.medallionInner} />
        <View style={styles.medallionDiamond} />
      </View>

      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <View style={styles.headerLeft}>
          <Pressable
            testID="quit-game-button"
            onPress={() => setQuitOpen(true)}
            hitSlop={10}
            style={styles.quitBtn}
          >
            <Ionicons name="close" size={22} color={C.cream} />
          </Pressable>
          {canPause && (
            <Pressable
              testID="pause-request-button"
              onPress={() => send({ action: "pause_request" })}
              hitSlop={10}
              style={styles.quitBtn}
            >
              <Ionicons name="pause" size={20} color={C.cream} />
            </Pressable>
          )}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          style={styles.scoreBox}
          testID="match-score-header"
          onPress={() => setScoresOpen(true)}
        >
          <Text style={styles.scoreText}>
            {t("us")} <Text style={styles.scoreNum}>{state.match_scores[myTeam]}</Text>
            {"  ·  "}
            <Text style={styles.scoreNum}>{state.match_scores[1 - myTeam]}</Text> {t("them")}
          </Text>
          <Text style={styles.targetText}>
            {t("hand", { n: state.hand_number })} · {state.target} pts{"  "}
            <Ionicons name="list" size={10} color="rgba(255,255,255,0.55)" />
          </Text>
        </Pressable>

        {contract ? (
          <View
            style={[
              styles.contractChip,
              { borderColor: contract!.team === myTeam ? C.goldLine : "rgba(194,59,34,0.75)" },
            ]}
            testID="contract-chip"
          >
            <Text style={styles.contractText}>
              {contract!.capot ? t("capot") : contract!.value}
              <Text style={{ color: SUIT_COLOR_ON_DARK[contract!.suit] }}>
                {" "}
                {SUIT_SYMBOL[contract!.suit]}
              </Text>
            </Text>
            <Text style={styles.contractTeam} numberOfLines={1}>
              {state.players.find((p) => p.seat === contract!.seat)?.username}
              {" · "}
              {contract!.team === myTeam ? t("us") : t("them")}
              {contract!.surcontre
                ? ` · ${t("surcontred")}`
                : contract!.contre
                  ? ` · ${t("contred")}`
                  : ""}
            </Text>
          </View>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      {/* partner seat: pinned to the very top screen edge (max ~14px) — its
          position must never shift; rendered BEFORE the table so trick cards
          pass ABOVE the avatar */}
      <View
        style={[styles.partnerRow, { top: Math.min(insets.top, 12) + 2 }]}
        pointerEvents="box-none"
      >
        <PlayerSeat
          player={partner}
          isTurn={state.turn === partner.seat}
          isDealer={state.dealer === partner.seat}
          bidLabel={bidLabels[partner.seat]?.text}
          bidSuit={bidLabels[partner.seat]?.suit}
          contractLabel={contractLabelFor(partner.seat)}
          chatText={chatBubbles[partner.seat]?.text}
          deadline={state.turn_deadline}
          showTimer={seatTimerOn}
          size={38}
          bubbleSide="right"
        />
      </View>

      {/* table */}
      <View style={styles.table}>
        <View style={styles.middleRow}>
          <PlayerSeat
            player={leftP}
            isTurn={state.turn === leftP.seat}
            isDealer={state.dealer === leftP.seat}
            bidLabel={bidLabels[leftP.seat]?.text}
            bidSuit={bidLabels[leftP.seat]?.suit}
            contractLabel={contractLabelFor(leftP.seat)}
            chatText={chatBubbles[leftP.seat]?.text}
            deadline={state.turn_deadline}
            showTimer={seatTimerOn}
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
            bidLabel={bidLabels[rightP.seat]?.text}
            bidSuit={bidLabels[rightP.seat]?.suit}
            contractLabel={contractLabelFor(rightP.seat)}
            chatText={chatBubbles[rightP.seat]?.text}
            deadline={state.turn_deadline}
            showTimer={seatTimerOn}
          />
        </View>

        {/* dealing animation overlay */}
        {dealing && (
          <DealAnimation
            mySeat={mySeat}
            dealer={state.dealer}
            onDone={() => setDealing(false)}
          />
        )}
      </View>

      {/* bottom row: me + chat (left) · hand fan (center) · status (right) */}
      <View style={[styles.bottomRow, { paddingBottom: Math.max(insets.bottom, SP.sm) }]}>
        <View style={styles.bottomSide}>
          <PlayerSeat
            player={me}
            isTurn={myTurn}
            isDealer={state.dealer === mySeat}
            bidLabel={bidLabels[mySeat]?.text}
            bidSuit={bidLabels[mySeat]?.suit}
            contractLabel={contractLabelFor(mySeat)}
            chatText={chatBubbles[mySeat]?.text}
            deadline={state.turn_deadline}
            showTimer={seatTimerOn}
            isMe
            size={40}
            bubbleSide="right"
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <HandFan
            hand={state.hand}
            legal={state.legal}
            myTurn={myTurn && state.phase === "playing"}
            trump={state.trump}
            onPlay={(card) => send({ action: "play", card })}
            coachCard={coachCard}
          />
        </View>
        <View style={styles.bottomRight}>
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
              <Text style={[styles.turnPillText, { color: "#1A1200" }]}>{t("reconnecting")}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: SP.sm }}>
            {state.last_trick && state.phase === "playing" && (
              <Pressable
                testID="last-trick-button"
                onPress={() => setLastTrickOpen(true)}
                style={styles.sideBtn}
              >
                <Ionicons name="albums" size={20} color={C.cream} />
              </Pressable>
            )}
            {state.phase !== "finished" && (
              <Pressable
                testID="chat-button"
                onPress={() => setChatOpen(true)}
                style={styles.sideBtn}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color={C.cream} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* bidding overlays (hidden while cards are being dealt) */}
      {!dealing && (
        <View
          style={[styles.biddingWrap, { bottom: insets.bottom + 112 }]}
          pointerEvents="box-none"
        >
          {coachDisplay && (
            <View style={styles.coachWrap}>
              <CoachBubble text={coachDisplay} label={t("coachLabel")} />
            </View>
          )}
          <BiddingPanel state={state} t={t} onAction={send} />
        </View>
      )}

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
      {state.phase === "hand_end" && state.hand_result && handEndReady && (
        <HandEndModal
          result={state.hand_result}
          mySeat={mySeat}
          deadline={state.turn_deadline}
          readySeats={state.ready_seats ?? []}
          humanSeats={state.players.filter((p) => !p.is_bot).map((p) => p.seat)}
          onReady={() => send({ action: "ready" })}
          t={t}
        />
      )}

      {/* match end */}
      {state.phase === "finished" && state.cancelled && (
        <View style={styles.pausedScrim} testID="cancelled-overlay">
          <Ionicons name="close-circle" size={64} color={C.brand3} />
          <Text style={styles.pausedTitle}>{t("hostEnded")}</Text>
          <ChunkyButton
            testID="cancelled-home-button"
            label={t("backHome")}
            onPress={quit}
            style={{ marginTop: SP.lg, minWidth: 200 }}
          />
        </View>
      )}
      {state.phase === "finished" && !state.cancelled && (
        <MatchEndOverlay
          state={state}
          myUserId={user?.user_id ?? ""}
          t={t}
          onHome={quitAfterMatch}
        />
      )}

      {/* quick chat modal */}
      <Modal visible={chatOpen} transparent animationType="slide">
        <Pressable style={styles.chatScrim} onPress={() => setChatOpen(false)}>
          <Pressable style={styles.chatSheet} onPress={() => {}} testID="chat-panel">
            <View style={styles.sheetHandle} />
            <Text style={styles.quitTitle}>{t("quickChat")}</Text>
            <View style={styles.emojiRow}>
              {CHAT_EMOJIS.map((em) => (
                <Pressable
                  key={em}
                  testID={`chat-emoji-${em}`}
                  onPress={() => sendChat("emoji", em)}
                  style={({ pressed }) => [styles.emojiBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.emojiText}>{em}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.chatMsgWrap}>
              {CHAT_MSGS.map((id2) => (
                <Pressable
                  key={id2}
                  testID={`chat-msg-${id2}`}
                  onPress={() => sendChat("msg", id2)}
                  style={({ pressed }) => [styles.chatMsgChip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.chatMsgText}>{t(`chat_${id2}` as TKey)}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={lastTrickOpen} transparent animationType="fade">
        <Pressable style={styles.quitScrim} onPress={() => setLastTrickOpen(false)}>
          <Pressable style={styles.quitCard} onPress={() => {}} testID="last-trick-modal">
            <Text style={styles.quitTitle}>{t("lastTrick")}</Text>
            <View style={styles.lastTrickRow}>
              {state.last_trick?.cards.map((tc) => {
                const p = state.players.find((pl) => pl.seat === tc.seat)!;
                const isWinner = state.last_trick?.winner_seat === tc.seat;
                return (
                  <View key={tc.seat} style={styles.lastTrickCol}>
                    <Text
                      style={[styles.lastTrickName, isWinner && { color: C.brand }]}
                      numberOfLines={1}
                    >
                      {p.username}
                    </Text>
                    <View style={isWinner ? styles.lastTrickWinner : styles.lastTrickNeutral}>
                      <PlayingCard card={tc.card} width={54} trumpSuit={state.trump} />
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.lastTrickWonBy} testID="last-trick-won-by">
              {t("wonBy", {
                name:
                  state.players.find((pl) => pl.seat === state.last_trick?.winner_seat)
                    ?.username ?? "",
              })}
              {" · +"}
              {state.last_trick?.points} {t("points")}
            </Text>
            <ChunkyButton
              testID="last-trick-close-button"
              label={t("close")}
              variant="secondary"
              small
              onPress={() => setLastTrickOpen(false)}
              style={{ marginTop: SP.md }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* pause: requester waiting pill */}
      {state.pause_req?.seat === mySeat && (
        <View style={styles.pauseSentPill} pointerEvents="none" testID="pause-sent-pill">
          <Text style={styles.pauseSentText}>{t("pauseSent")}</Text>
        </View>
      )}

      {/* pause: accept/decline for the other players */}
      <Modal visible={pauseAskMe} transparent animationType="fade">
        <View style={styles.quitScrim}>
          <View style={styles.quitCard} testID="pause-request-modal">
            <Ionicons
              name="pause-circle"
              size={40}
              color={C.brand}
              style={{ alignSelf: "center" }}
            />
            <Text style={[styles.quitTitle, { marginTop: SP.sm }]}>
              {t("pauseAsks", {
                name:
                  state.players.find((p) => p.seat === state.pause_req?.seat)?.username ??
                  "",
              })}
            </Text>
            <View style={styles.quitRow}>
              <ChunkyButton
                testID="pause-decline-button"
                label={t("decline")}
                variant="secondary"
                small
                onPress={() => send({ action: "pause_decline" })}
                style={{ flex: 1 }}
              />
              <ChunkyButton
                testID="pause-accept-button"
                label={t("accept")}
                small
                onPress={() => send({ action: "pause_accept" })}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* active pause overlay */}
      {state.paused && state.phase !== "finished" && (
        <PausedOverlay
          until={state.paused.until}
          requesterName={
            state.players.find((p) => p.seat === state.paused?.seat)?.username ?? ""
          }
          reason={state.paused.reason ?? "request"}
          canResume={
            state.paused.seat === mySeat && state.paused.reason !== "disconnect"
          }
          onResume={() => send({ action: "resume" })}
          t={t}
        />
      )}

      {/* score history (tap on the header score) */}
      <Modal visible={scoresOpen} transparent animationType="fade">
        <Pressable style={styles.quitScrim} onPress={() => setScoresOpen(false)}>
          <Pressable
            style={[styles.quitCard, { maxHeight: "75%" }]}
            onPress={() => {}}
            testID="score-history-modal"
          >
            <Text style={styles.quitTitle}>{t("scoreHistory")}</Text>
            <Text style={styles.historyTotal} testID="score-history-total">
              {t("us")} {state.match_scores[myTeam]} — {state.match_scores[1 - myTeam]}{" "}
              {t("them")} · {state.target} pts
            </Text>
            <ScrollView style={{ marginTop: SP.sm }}>
              {state.hand_history?.length ? (
                state.hand_history.map((h) => (
                  <View key={h.hand_number} style={styles.historyRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.historyHand}>
                        {t("hand", { n: h.hand_number })} ·{" "}
                        {h.contract.capot ? t("capot") : h.contract.value}
                        <Text style={{ color: SUIT_COLOR_ON_DARK[h.contract.suit] }}>
                          {" "}
                          {SUIT_SYMBOL[h.contract.suit]}
                        </Text>
                        {h.contract.surcontre
                          ? ` · ${t("surcontred")}`
                          : h.contract.contre
                            ? ` · ${t("contred")}`
                            : ""}
                      </Text>
                      <Text style={styles.historyTaker} numberOfLines={1}>
                        {state.players.find((p) => p.seat === h.contract.seat)?.username}
                        {" · "}
                        {h.contract.team === myTeam ? t("us") : t("them")}
                      </Text>
                    </View>
                    <Ionicons
                      name={h.success ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={h.success ? C.green : C.error}
                    />
                    <Text style={styles.historyScores}>
                      {h.hand_scores[myTeam]} / {h.hand_scores[1 - myTeam]}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.historyEmpty}>{t("noHandsYet")}</Text>
              )}
            </ScrollView>
            <ChunkyButton
              testID="score-history-close"
              label={t("close")}
              variant="secondary"
              small
              onPress={() => setScoresOpen(false)}
              style={{ marginTop: SP.md }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* quit confirm */}
      <Modal visible={quitOpen} transparent animationType="fade">
        <View style={styles.quitScrim}>
          <View style={styles.quitCard}>
            <Text style={styles.quitTitle}>{t("quitGame")}</Text>
            <Text style={styles.quitDesc}>
              {state.host_user_id === user?.user_id
                ? t("quitGameHostDesc")
                : t("quitGameDesc")}
            </Text>
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
  ornateFrame: {
    position: "absolute",
    top: 6,
    left: 10,
    right: 10,
    bottom: 6,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.16)",
  },
  medallionWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -12 }],
  },
  medallionOuter: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.10)",
  },
  medallionInner: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.08)",
  },
  medallionDiamond: {
    position: "absolute",
    width: 150,
    height: 150,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.07)",
    transform: [{ rotate: "45deg" }],
  },
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
    gap: SP.sm,
    paddingHorizontal: SP.md,
    paddingBottom: SP.sm,
  },
  headerLeft: { flexDirection: "row", gap: SP.sm },
  quitBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBox: {
    alignItems: "center",
    backgroundColor: "rgba(8,26,17,0.78)",
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.goldLine,
    paddingHorizontal: SP.md,
    paddingVertical: 3,
  },
  scoreText: { fontFamily: F.serifSemi, fontSize: 12.5, color: "rgba(233,196,106,0.9)" },
  scoreNum: { fontFamily: F.serif, fontSize: 18, color: C.cream },
  targetText: { fontFamily: F.text, fontSize: 10.5, color: "rgba(233,196,106,0.55)" },
  contractChip: {
    backgroundColor: "rgba(8,26,17,0.78)",
    borderRadius: R.md,
    borderWidth: 1.5,
    paddingHorizontal: SP.md,
    paddingVertical: 4,
    alignItems: "center",
    minWidth: 64,
  },
  contractText: { fontFamily: F.serif, fontSize: 15, color: C.cream },
  contractTeam: { fontFamily: F.text, fontSize: 10, color: "rgba(233,196,106,0.75)" },
  table: { flex: 1 },
  partnerRow: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  middleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP.md,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SP.md,
  },
  bottomSide: {
    width: 150,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: SP.sm,
    paddingBottom: SP.sm,
  },
  bottomRight: {
    width: 150,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: SP.xs,
    paddingBottom: SP.sm,
  },
  sideBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  turnPill: {
    backgroundColor: C.gold,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: SP.xs,
    flexShrink: 1,
  },
  turnPillText: { fontFamily: F.display, fontSize: 12, color: "#1A1200" },
  turnTimer: { fontFamily: F.extra, fontSize: 13, color: C.brand3 },
  biddingWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
  },
  coachWrap: {
    paddingHorizontal: SP.md,
    marginBottom: SP.sm,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
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
  bannerText: { fontFamily: F.display, fontSize: 24, color: "#1A1200" },
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
  chatScrim: { flex: 1, backgroundColor: C.scrim, justifyContent: "flex-end" },
  chatSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: SP.lg,
    paddingBottom: SP.xl,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.borderStrong,
    alignSelf: "center",
    marginBottom: SP.md,
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SP.sm,
    marginTop: SP.md,
  },
  emojiBtn: {
    width: 52,
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: { fontSize: 26 },
  chatMsgWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP.sm,
    marginTop: SP.lg,
  },
  chatMsgChip: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chatMsgText: { fontFamily: F.bold, fontSize: 13.5, color: C.ink },
  lastTrickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SP.sm,
    marginTop: SP.lg,
  },
  lastTrickCol: { alignItems: "center", gap: 6 },
  lastTrickName: {
    fontFamily: F.bold,
    fontSize: 11,
    color: C.ink2,
    maxWidth: 68,
    textAlign: "center",
  },
  lastTrickNeutral: { padding: 3 },
  lastTrickWinner: {
    padding: 1,
    borderWidth: 2,
    borderColor: C.gold,
    borderRadius: 10,
  },
  lastTrickWonBy: {
    fontFamily: F.bold,
    fontSize: 13,
    color: C.ink,
    textAlign: "center",
    marginTop: SP.md,
  },
  pauseSentPill: {
    position: "absolute",
    top: "16%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  pauseSentText: { fontFamily: F.bold, fontSize: 13, color: C.cream },
  pausedScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,24,18,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP.xl,
    zIndex: 1000,
    elevation: 1000,
  },
  pausedTitle: { fontFamily: F.display, fontSize: 20, color: C.cream, marginTop: SP.sm },
  pausedBy: {
    fontFamily: F.text,
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginTop: 4,
  },
  pausedTimer: { fontFamily: F.extra, fontSize: 16, color: C.gold, marginTop: SP.md },
  pausedHint: {
    fontFamily: F.text,
    fontSize: 12.5,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: SP.sm,
  },
  historyTotal: {
    fontFamily: F.display,
    fontSize: 15,
    color: C.brand,
    textAlign: "center",
    marginTop: SP.xs,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  historyHand: { fontFamily: F.bold, fontSize: 13.5, color: C.ink },
  historyTaker: { fontFamily: F.text, fontSize: 11.5, color: C.ink3, marginTop: 1 },
  historyScores: {
    fontFamily: F.extra,
    fontSize: 14,
    color: C.ink,
    minWidth: 64,
    textAlign: "right",
  },
  historyEmpty: {
    fontFamily: F.text,
    fontSize: 13,
    color: C.ink3,
    textAlign: "center",
    paddingVertical: SP.lg,
  },
});
