import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import ChunkyButton from "@/src/components/ChunkyButton";
import { useAuth } from "@/src/context/AuthContext";
import {
  InviteNotif,
  useNotifications,
} from "@/src/context/NotificationsContext";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP, shadow } from "@/src/theme";

interface CurrentGame {
  game_id: string;
  match_scores: [number, number];
  my_team: number;
  target: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const { invites, friendRequests, refresh } = useNotifications();

  // pulsing neon glow on the hero card
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
    borderColor: `rgba(0,229,122,${0.3 + glowPulse.value * 0.55})`,
  }));

  const [typeModal, setTypeModal] = useState<null | "online" | "create" | "solo">(null);
  const [timerOn, setTimerOn] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [currentGame, setCurrentGame] = useState<CurrentGame | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      refresh();
      const poll = async () => {
        try {
          const cur = await api.get("/games/current");
          setCurrentGame(cur.game_id ? cur : null);
        } catch {}
      };
      poll();
      pollRef.current = setInterval(poll, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const chooseType = async (matchType: "short" | "long") => {
    const mode = typeModal;
    setTypeModal(null);
    if (mode === "online") {
      // let the modal close before navigating (web Modal can linger otherwise)
      setTimeout(() => {
        router.push({ pathname: "/matchmaking", params: { type: matchType } });
      }, 150);
    } else if (mode === "solo") {
      setBusy(true);
      try {
        const res = await api.post("/solo", { match_type: matchType });
        setTimeout(() => {
          router.push({ pathname: "/game/[id]", params: { id: res.game_id } });
        }, 150);
      } catch {
        setJoinError(t("error_generic"));
      } finally {
        setBusy(false);
      }
    } else if (mode === "create") {
      setBusy(true);
      try {
        const room = await api.post("/rooms", { match_type: matchType, turn_timer: timerOn });
        setTimeout(() => {
          router.push({ pathname: "/room/[code]", params: { code: room.code } });
        }, 150);
      } catch {
        setJoinError(t("error_generic"));
      } finally {
        setBusy(false);
      }
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    setJoinError(null);
    setBusy(true);
    try {
      await api.post(`/rooms/${code}/join`);
      setJoinCode("");
      router.push({ pathname: "/room/[code]", params: { code } });
    } catch (e) {
      setJoinError(e instanceof ApiError && e.detail === "room_full"
        ? t("error_generic")
        : t("roomGone"));
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = async (inv: InviteNotif) => {
    try {
      await api.post(`/rooms/${inv.room_code}/join`);
      await api.post(`/invites/${inv.invite_id}/dismiss`);
      refresh();
      router.push({ pathname: "/room/[code]", params: { code: inv.room_code } });
    } catch {
      await api.post(`/invites/${inv.invite_id}/dismiss`).catch(() => {});
      refresh();
    }
  };

  const dismissInvite = async (inv: InviteNotif) => {
    await api.post(`/invites/${inv.invite_id}/dismiss`).catch(() => {});
    refresh();
  };

  const respondFriend = async (friendshipId: string, accept: boolean) => {
    await api.post("/friends/respond", { friendship_id: friendshipId, accept }).catch(() => {});
    refresh();
  };

  const notifCount = invites.length + friendRequests.length;

  return (
    <View style={styles.container} testID="home-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <View style={styles.headerRow}>
          <Avatar avatarId={user?.avatar_id} size={46} testID="home-user-avatar" />
          <View style={{ flex: 1, marginHorizontal: SP.md }}>
            <Text style={styles.hello}>{t("hello")},</Text>
            <Text style={styles.username} numberOfLines={1}>
              {user?.username}
            </Text>
          </View>
          <View style={styles.eloPill} testID="home-elo-pill">
            <Ionicons name="flame" size={14} color={C.gold} />
            <Text style={styles.eloText}>{user?.elo ?? 1000}</Text>
          </View>
          <Pressable
            testID="notifications-bell"
            onPress={() => setNotifOpen(true)}
            hitSlop={8}
            style={styles.bellBtn}
          >
            <Ionicons name="notifications" size={20} color={C.ink2} />
            {notifCount > 0 && (
              <View style={styles.bellBadge} testID="notifications-badge">
                <Text style={styles.bellBadgeText}>{notifCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xl }}
        showsVerticalScrollIndicator={false}
      >
        {currentGame && (
          <Animated.View entering={FadeInDown} style={styles.resumeBanner} testID="resume-game-banner">
            <Ionicons name="play-circle" size={32} color={C.brand} />
            <View style={{ flex: 1, minWidth: 0, marginLeft: SP.md }}>
              <Text style={styles.resumeTitle}>{t("resumeGame")}</Text>
              <Text style={styles.resumeDesc} numberOfLines={1}>
                {t("us")} {currentGame.match_scores[currentGame.my_team]}
                {" · "}
                {currentGame.match_scores[1 - currentGame.my_team]} {t("them")} — {currentGame.target} pts
              </Text>
            </View>
            <Pressable
              testID="resume-game-button"
              onPress={() =>
                router.push({ pathname: "/game/[id]", params: { id: currentGame.game_id } })
              }
              style={styles.resumeBtn}
            >
              <Text style={styles.resumeBtnText}>{t("resumeGameBtn")}</Text>
            </Pressable>
          </Animated.View>
        )}

        {invites.map((inv) => (
          <Animated.View key={inv.invite_id} entering={FadeInDown} style={styles.inviteBanner}>
            <Avatar avatarId={inv.from_user.avatar_id} size={36} />
            <Text style={styles.inviteText} numberOfLines={2}>
              {t("invitedYou", { name: inv.from_user.username })}
            </Text>
            <Pressable
              testID={`invite-join-${inv.room_code}`}
              onPress={() => acceptInvite(inv)}
              style={styles.inviteJoin}
            >
              <Text style={styles.inviteJoinText}>{t("join")}</Text>
            </Pressable>
            <Pressable
              testID={`invite-dismiss-${inv.room_code}`}
              onPress={() => dismissInvite(inv)}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={C.ink3} />
            </Pressable>
          </Animated.View>
        ))}

        <Animated.View entering={FadeInUp.delay(50)}>
          <Animated.View style={[styles.heroGlow, heroGlowStyle]}>
            <Pressable
              testID="play-online-card"
              onPress={() => setTypeModal("online")}
              style={({ pressed }) => [styles.bigCard, styles.onlineCard, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={[C.felt, C.feltDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.bigCardIcon}>
                <Ionicons name="globe" size={30} color={C.cream} />
              </View>
              <Text style={[styles.bigCardTitle, { color: C.cream }]}>{t("playOnline")}</Text>
              <Text style={styles.bigCardDesc}>{t("playOnlineDesc")}</Text>
              <Text style={styles.cardSuits}>♠ ♥ ♦ ♣</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(85)}>
          <Pressable
            testID="play-solo-card"
            onPress={() => setTypeModal("solo")}
            style={({ pressed }) => [styles.bigCard, styles.soloCard, pressed && styles.pressed]}
          >
            <View style={styles.soloRow}>
              <View style={[styles.bigCardIcon, styles.soloIcon]}>
                <Ionicons name="game-controller" size={26} color={C.onBrand} />
              </View>
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Text style={[styles.bigCardTitle, { color: C.ink, fontSize: 20 }]}>
                  {t("playVsAI")}
                </Text>
                <Text style={[styles.bigCardDesc, { color: C.ink2 }]}>{t("playVsAIDesc")}</Text>
              </View>
              <View style={styles.trainingBadge}>
                <Text style={styles.trainingBadgeText}>{t("trainingBadge")}</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120)}>
          <View style={[styles.bigCard, styles.privateCard]}>
            <View style={[styles.bigCardIcon, { backgroundColor: C.brand2 }]}>
              <Ionicons name="people" size={30} color={C.onBrand} />
            </View>
            <Text style={[styles.bigCardTitle, { color: C.ink }]}>{t("privateParty")}</Text>
            <Text style={[styles.bigCardDesc, { color: C.ink2 }]}>{t("privatePartyDesc")}</Text>

            <ChunkyButton
              testID="create-party-button"
              label={t("createParty")}
              onPress={() => setTypeModal("create")}
              loading={busy}
              style={{ marginTop: SP.lg }}
            />

            <View style={styles.joinRow}>
              <TextInput
                testID="join-code-input"
                style={styles.joinInput}
                placeholder={t("roomCodePlaceholder")}
                placeholderTextColor={C.ink3}
                value={joinCode}
                onChangeText={(v) => setJoinCode(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
              />
              <Pressable
                testID="join-room-button"
                onPress={joinRoom}
                style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="arrow-forward" size={22} color={C.onBrand} />
              </Pressable>
            </View>
            {joinError && (
              <Text testID="join-error-text" style={styles.joinError}>
                {joinError}
              </Text>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <Modal visible={notifOpen} transparent animationType="slide">
        <Pressable style={styles.modalScrim} onPress={() => setNotifOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}} testID="notifications-panel">
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>{t("notifications")}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {notifCount === 0 && (
                <Text style={styles.notifEmpty}>{t("noNotifications")}</Text>
              )}
              {invites.length > 0 && (
                <Text style={styles.notifSection}>{t("invitesSection")}</Text>
              )}
              {invites.map((inv) => (
                <View key={inv.invite_id} style={styles.notifRow} testID={`notif-invite-${inv.room_code}`}>
                  <Avatar avatarId={inv.from_user.avatar_id} size={38} />
                  <Text style={styles.notifText} numberOfLines={2}>
                    {t("invitedYou", { name: inv.from_user.username })}
                  </Text>
                  <Pressable
                    testID={`notif-invite-join-${inv.room_code}`}
                    onPress={() => {
                      setNotifOpen(false);
                      acceptInvite(inv);
                    }}
                    style={styles.notifPrimary}
                  >
                    <Text style={styles.notifPrimaryText}>{t("join")}</Text>
                  </Pressable>
                  <Pressable
                    testID={`notif-invite-dismiss-${inv.room_code}`}
                    onPress={() => dismissInvite(inv)}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={20} color={C.ink3} />
                  </Pressable>
                </View>
              ))}
              {friendRequests.length > 0 && (
                <Text style={styles.notifSection}>{t("friendRequestsSection")}</Text>
              )}
              {friendRequests.map((fr) => (
                <View key={fr.friendship_id} style={styles.notifRow} testID={`notif-friend-${fr.username}`}>
                  <Avatar avatarId={fr.avatar_id} size={38} />
                  <Text style={styles.notifText} numberOfLines={2}>
                    {t("friendAsks", { name: fr.username })}
                  </Text>
                  <Pressable
                    testID={`notif-friend-accept-${fr.username}`}
                    onPress={() => respondFriend(fr.friendship_id, true)}
                    style={styles.notifPrimary}
                  >
                    <Text style={styles.notifPrimaryText}>{t("accept")}</Text>
                  </Pressable>
                  <Pressable
                    testID={`notif-friend-decline-${fr.username}`}
                    onPress={() => respondFriend(fr.friendship_id, false)}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={20} color={C.ink3} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <ChunkyButton
              label={t("close")}
              variant="secondary"
              onPress={() => setNotifOpen(false)}
              style={{ marginTop: SP.md }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={typeModal !== null} transparent animationType="fade">
        <Pressable style={styles.modalScrim} onPress={() => setTypeModal(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>{t("chooseMatchType")}</Text>
            {typeModal === "create" && (
              <Pressable
                testID="room-timer-toggle"
                onPress={() => setTimerOn((v) => !v)}
                style={styles.timerToggle}
              >
                <Ionicons
                  name={timerOn ? "checkbox" : "square-outline"}
                  size={22}
                  color={timerOn ? C.brand : C.ink3}
                />
                <View style={{ flex: 1, marginLeft: SP.md }}>
                  <Text style={styles.timerToggleLabel}>{t("timerSetting")}</Text>
                  <Text style={styles.timerToggleValue}>
                    {timerOn ? t("timerOn") : t("timerOff")}
                  </Text>
                </View>
                <Ionicons name="timer" size={20} color={timerOn ? C.brand : C.ink3} />
              </Pressable>
            )}
            <Pressable
              testID="match-type-short"
              onPress={() => chooseType("short")}
              style={({ pressed }) => [styles.typeOption, pressed && styles.pressed]}
            >
              <Ionicons name="flash" size={26} color={C.brand} />
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Text style={styles.typeTitle}>{t("shortMatch")}</Text>
                <Text style={styles.typeDesc}>{t("pointsTarget", { n: 1000 })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.ink3} />
            </Pressable>
            <Pressable
              testID="match-type-long"
              onPress={() => chooseType("long")}
              style={({ pressed }) => [styles.typeOption, pressed && styles.pressed]}
            >
              <Ionicons name="hourglass" size={26} color={C.brand2} />
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Text style={styles.typeTitle}>{t("longMatch")}</Text>
                <Text style={styles.typeDesc}>{t("pointsTarget", { n: 2000 })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.ink3} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  hello: { fontFamily: F.text, fontSize: 13, color: C.ink3 },
  username: { fontFamily: F.display, fontSize: 20, color: C.ink },
  eloPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.bg2,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 34,
    borderWidth: 1,
    borderColor: C.border,
  },
  eloText: { fontFamily: F.extra, fontSize: 15, color: C.ink },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SP.sm,
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: { fontFamily: F.extra, fontSize: 10.5, color: C.onBrand },
  notifSection: {
    fontFamily: F.display,
    fontSize: 14,
    color: C.ink2,
    marginTop: SP.md,
    marginBottom: SP.xs,
  },
  notifEmpty: {
    fontFamily: F.text,
    fontSize: 13,
    color: C.ink3,
    textAlign: "center",
    paddingVertical: SP.xl,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    paddingVertical: SP.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  notifText: { flex: 1, fontFamily: F.bold, fontSize: 13, color: C.ink },
  notifPrimary: {
    backgroundColor: C.brand,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 34,
    justifyContent: "center",
  },
  notifPrimaryText: { fontFamily: F.display, fontSize: 12.5, color: C.onBrand },
  inviteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.bg3,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.brand3,
    padding: SP.md,
    marginBottom: SP.md,
  },
  resumeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.brand,
    padding: SP.md,
    marginBottom: SP.md,
  },
  resumeTitle: { fontFamily: F.display, fontSize: 15, color: C.ink },
  resumeDesc: { fontFamily: F.text, fontSize: 12, color: C.ink3, marginTop: 1 },
  resumeBtn: {
    backgroundColor: C.brand,
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SP.sm,
  },
  resumeBtnText: { fontFamily: F.display, fontSize: 13, color: C.onBrand },
  inviteText: { flex: 1, fontFamily: F.bold, fontSize: 13, color: C.ink },
  inviteJoin: {
    backgroundColor: C.brand,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 34,
    justifyContent: "center",
  },
  inviteJoinText: { fontFamily: F.display, color: C.onBrand, fontSize: 13 },
  bigCard: {
    borderRadius: R.lg,
    padding: SP.xl,
    marginBottom: SP.lg,
    ...shadow,
  },
  heroGlow: {
    borderRadius: R.lg,
    borderWidth: 1.5,
    marginBottom: SP.lg,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    elevation: 10,
  },
  onlineCard: { backgroundColor: C.felt, overflow: "hidden", marginBottom: 0 },
  privateCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  soloCard: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.brand3,
    padding: SP.lg,
  },
  soloRow: { flexDirection: "row", alignItems: "center" },
  soloIcon: {
    backgroundColor: C.brand2,
    width: 48,
    height: 48,
    borderRadius: 16,
    marginBottom: 0,
  },
  trainingBadge: {
    backgroundColor: C.gold,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    paddingVertical: 4,
    flexShrink: 0,
  },
  trainingBadgeText: { fontFamily: F.bold, fontSize: 11, color: "#1A1200" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  bigCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP.md,
  },
  bigCardTitle: { fontFamily: F.display, fontSize: 24, color: C.onBrand },
  bigCardDesc: {
    fontFamily: F.text,
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  cardSuits: {
    position: "absolute",
    right: SP.lg,
    top: SP.lg,
    color: "rgba(255,255,255,0.35)",
    fontSize: 18,
    letterSpacing: 3,
  },
  joinRow: { flexDirection: "row", gap: SP.sm, marginTop: SP.md },
  joinInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SP.lg,
    fontFamily: F.extra,
    fontSize: 18,
    letterSpacing: 4,
    color: C.ink,
  },
  joinBtn: {
    width: 52,
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.brand2,
    alignItems: "center",
    justifyContent: "center",
  },
  joinError: { fontFamily: F.bold, color: C.error, fontSize: 12, marginTop: SP.sm },
  modalScrim: { flex: 1, backgroundColor: C.scrim, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: SP.xl,
    paddingBottom: SP.xxl,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.borderStrong,
    alignSelf: "center",
    marginBottom: SP.lg,
  },
  modalTitle: { fontFamily: F.display, fontSize: 20, color: C.ink, marginBottom: SP.lg },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP.lg,
    marginBottom: SP.md,
  },
  typeTitle: { fontFamily: F.display, fontSize: 17, color: C.ink },
  typeDesc: { fontFamily: F.text, fontSize: 13, color: C.ink3, marginTop: 2 },
  timerToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP.md,
    marginBottom: SP.md,
  },
  timerToggleLabel: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  timerToggleValue: { fontFamily: F.text, fontSize: 12, color: C.ink3, marginTop: 1 },
});
