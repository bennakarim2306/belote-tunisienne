import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import ChunkyButton from "@/src/components/ChunkyButton";
import PlayingCard from "@/src/components/PlayingCard";
import ShareSheet from "@/src/components/ShareSheet";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { APP_INSTALL_URL } from "@/src/share";
import { C, F, R, SP } from "@/src/theme";

interface FoundPlayer {
  username: string;
  avatar_id: string;
  elo: number;
}

interface DuoStatusInfo {
  partner: FoundPlayer;
}

function ShufflingCard({ delay }: { delay: number }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [rot]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value + delay}deg` }],
  }));
  return (
    <Animated.View style={[style, { marginHorizontal: -10 }]}>
      <PlayingCard faceDown width={40} />
    </Animated.View>
  );
}

function EmptySlot({ label }: { label: string }) {
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.emptyCircle, style]}>
        <Ionicons name="person" size={22} color="rgba(255,255,255,0.5)" />
      </Animated.View>
      <Text style={styles.slotName} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function MatchmakingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type, duo, mode } = useLocalSearchParams<{
    type: string;
    duo?: string;
    mode?: string;
  }>();
  const isDuo = duo === "1";
  // duo vs AI: only the teammate is awaited (the 2 opponents are bots)
  const isVsAi = isDuo && mode === "vs_ai";
  const { user } = useAuth();
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(0);
  const [found, setFound] = useState(false);
  const [players, setPlayers] = useState<FoundPlayer[]>([]);
  const [eloRange, setEloRange] = useState(100);
  const [duoInfo, setDuoInfo] = useState<DuoStatusInfo | null>(null);
  const [pendingPartner, setPendingPartner] = useState<FoundPlayer | null>(null);
  const [endMsg, setEndMsg] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    let tick: ReturnType<typeof setInterval> | null = null;
    let checking = false;

    const checkStatus = async () => {
      if (cancelledRef.current || checking) return;
      checking = true;
      try {
        const st = await api.get("/matchmaking/status");
        if (st.status === "found" && st.game_id) {
          cancelledRef.current = true;
          setFound(true);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setTimeout(() => {
            router.replace({ pathname: "/game/[id]", params: { id: st.game_id } });
          }, 700);
        } else if (st.status === "waiting") {
          setPendingPartner(null);
          setPlayers(st.players ?? []);
          setEloRange(st.elo_range ?? 100);
          setDuoInfo(st.duo ?? null);
        } else if (st.status === "duo_pending") {
          setPendingPartner(st.partner ?? null);
        } else if (isDuo) {
          // declined / cancelled / expired -> inform and go back
          cancelledRef.current = true;
          const key =
            st.status === "duo_declined"
              ? "duoDeclinedMsg"
              : st.status === "duo_cancelled"
                ? "duoCancelledMsg"
                : "duoExpiredMsg";
          setEndMsg(t(key as never));
          setTimeout(() => router.back(), 1800);
        } else if (st.status === "idle") {
          // dropped from the queue (app was backgrounded and polling froze):
          // silently rejoin so the search continues seamlessly
          await api.post("/matchmaking/join", {
            match_type: type === "long" ? "long" : "short",
          });
        }
      } catch {}
      checking = false;
    };

    (async () => {
      if (!isDuo) {
        try {
          await api.post("/matchmaking/join", { match_type: type === "long" ? "long" : "short" });
        } catch {
          router.back();
          return;
        }
      }
      tick = setInterval(() => setSeconds((s) => s + 1), 1000);
      poll = setInterval(checkStatus, 1500);
      checkStatus(); // immediate first check (no 1.5s 'searching' flash in duo)
    })();

    // on resume from background, check immediately (found ticket lives 10 min;
    // if the queue entry was purged, checkStatus rejoins on the spot)
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") checkStatus();
    });

    return () => {
      if (poll) clearInterval(poll);
      if (tick) clearInterval(tick);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = async () => {
    cancelledRef.current = true;
    try {
      await api.del("/matchmaking/leave");
    } catch {}
    router.back();
  };

  const partnerSlot = duoInfo?.partner ?? pendingPartner;
  const foundCount = (duoInfo ? 2 : 1) + players.length;
  const totalSlots = isVsAi ? 2 : 4;
  const emptySlots = Math.max(0, totalSlots - foundCount - (pendingPartner ? 1 : 0));

  if (endMsg) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]} testID="matchmaking-screen">
        <View style={styles.center}>
          <Ionicons name="information-circle" size={44} color={C.gold} />
          <Text style={[styles.title, { marginTop: SP.md }]} testID="duo-end-message">
            {endMsg}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="matchmaking-screen">
      {/* invite friends while waiting — social share (top right) */}
      {!found && (
        <Pressable
          testID="invite-friends-button"
          onPress={() => setShareOpen(true)}
          style={[styles.inviteBtn, { top: insets.top + SP.sm }]}
          hitSlop={8}
        >
          <Ionicons name="person-add" size={16} color={C.goldSoft} />
          <Text style={styles.inviteBtnText}>{t("inviteFriends")}</Text>
        </Pressable>
      )}
      <View style={styles.center}>
        <View style={styles.cardsRow}>
          <ShufflingCard delay={-6} />
          <ShufflingCard delay={0} />
          <ShufflingCard delay={6} />
        </View>

        <Text style={styles.title} testID="matchmaking-status-text">
          {found
            ? t("matchFound")
            : pendingPartner
              ? t("duoWaitingPartner", { name: pendingPartner.username })
              : t("searching")}
        </Text>
        <Text style={styles.counter} testID="matchmaking-players-count">
          {t("playersCount", { n: foundCount, total: totalSlots })}
        </Text>

        <View style={styles.slotsRow} testID="matchmaking-slots">
          <View style={styles.slot}>
            <Avatar avatarId={user?.avatar_id} size={52} ringColor={C.gold} />
            <Text style={styles.slotName} numberOfLines={1}>
              {t("you")}
            </Text>
            <Text style={styles.slotElo}>
              {isVsAi ? "" : isDuo ? (user?.elo_duo ?? 1000) : (user?.elo ?? 1000)}
            </Text>
          </View>
          {partnerSlot && (
            <View style={styles.slot} testID="matchmaking-duo-partner">
              <View>
                <Avatar
                  avatarId={partnerSlot.avatar_id}
                  size={52}
                  ringColor={pendingPartner ? "rgba(255,255,255,0.4)" : C.gold}
                />
                {pendingPartner ? (
                  <View style={styles.pendingBadge}>
                    <Ionicons name="hourglass" size={11} color="#1A1200" />
                  </View>
                ) : (
                  <View style={[styles.pendingBadge, { backgroundColor: C.brand }]}>
                    <Ionicons name="people" size={11} color={C.onBrand} />
                  </View>
                )}
              </View>
              <Text style={styles.slotName} numberOfLines={1}>
                {partnerSlot.username}
              </Text>
              <Text style={styles.slotElo}>
                {pendingPartner ? "…" : partnerSlot.elo}
              </Text>
            </View>
          )}
          {players.map((p) => (
            <Animated.View key={p.username} entering={FadeInDown.springify().damping(14)}>
              <View style={styles.slot} testID={`matchmaking-player-${p.username}`}>
                <Avatar avatarId={p.avatar_id} size={52} />
                <Text style={styles.slotName} numberOfLines={1}>
                  {p.username}
                </Text>
                <Text style={styles.slotElo}>{p.elo}</Text>
              </View>
            </Animated.View>
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} label={t("waitingSlot")} />
          ))}
        </View>

        {!isVsAi && (
          <View style={styles.rangeChip} testID="matchmaking-elo-range">
            <Ionicons name="flame" size={13} color={C.gold} />
            <Text style={styles.rangeText}>{t("eloRangeLabel", { n: eloRange })}</Text>
          </View>
        )}

        {duoInfo && (
          <View
            style={[styles.rangeChip, { marginTop: SP.sm, borderColor: C.brand, borderWidth: 1 }]}
            testID="duo-mode-chip"
          >
            <Ionicons name="people" size={13} color={C.brand} />
            <Text style={styles.rangeText}>{t("duoVsDuoOnly")}</Text>
          </View>
        )}

        <Text style={styles.timer}>{seconds}s</Text>
        <Text style={styles.hint}>{isVsAi ? t("duoVsAiHint") : t("searchingHint")}</Text>
      </View>

      {!found && (
        <ChunkyButton
          testID="cancel-search-button"
          label={t("cancelSearch")}
          variant="secondary"
          small
          onPress={cancel}
          style={{
            alignSelf: "center",
            minWidth: 260,
            marginBottom: insets.bottom + SP.md,
          }}
        />
      )}

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title={t("inviteFriends")}
        message={t("shareQueueMsg", { link: APP_INSTALL_URL })}
        url={APP_INSTALL_URL}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.feltDark },
  inviteBtn: {
    position: "absolute",
    right: SP.lg,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(28,23,20,0.9)",
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.55)",
    borderRadius: R.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteBtnText: { fontFamily: F.bold, fontSize: 13, color: C.goldSoft },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SP.lg },
  cardsRow: { flexDirection: "row", marginBottom: SP.xs },
  title: { fontFamily: F.display, fontSize: 18, color: C.cream },
  counter: { fontFamily: F.extra, fontSize: 20, color: C.gold, marginTop: 2 },
  slotsRow: {
    flexDirection: "row",
    gap: SP.lg,
    marginTop: SP.sm,
    justifyContent: "center",
  },
  slot: { alignItems: "center", width: 96 },
  slotName: {
    fontFamily: F.bold,
    fontSize: 11,
    color: C.cream,
    marginTop: 4,
    maxWidth: 94,
    textAlign: "center",
  },
  slotElo: { fontFamily: F.text, fontSize: 10, color: "rgba(255,255,255,0.6)" },
  pendingBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rangeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 32,
    marginTop: SP.md,
  },
  rangeText: { fontFamily: F.bold, fontSize: 12.5, color: C.cream },
  timer: { fontFamily: F.extra, fontSize: 16, color: C.cream, marginTop: SP.xs, opacity: 0.85 },
  hint: {
    fontFamily: F.text,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
    textAlign: "center",
    paddingHorizontal: SP.xl,
  },
});
