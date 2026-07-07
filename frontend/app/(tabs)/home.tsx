import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { KeyboardEvents } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import ChunkyButton from "@/src/components/ChunkyButton";
import DuoSetup, { DuoCandidate } from "@/src/components/DuoSetup";
import { useAuth } from "@/src/context/AuthContext";
import {
  DuoInviteNotif,
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
  const { invites, friendRequests, duoInvites, refresh } = useNotifications();

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
  const [onlineMode, setOnlineMode] = useState<"solo" | "duo">("solo");
  const [duoPartner, setDuoPartner] = useState<DuoCandidate | null>(null);
  const [timerOn, setTimerOn] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [currentGame, setCurrentGame] = useState<CurrentGame | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // reset duo selections whenever the type modal closes
  useEffect(() => {
    if (typeModal === null) {
      setOnlineMode("solo");
      setDuoPartner(null);
    }
  }, [typeModal]);

  // when the keyboard closes (back button / done), restore the full layout
  useEffect(() => {
    const sub = KeyboardEvents.addListener("keyboardDidHide", () =>
      setCodeFocused(false),
    );
    return () => sub.remove();
  }, []);

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
    if ((mode === "online" || mode === "solo") && onlineMode === "duo") {
      if (!duoPartner) return;
      setBusy(true);
      try {
        await api.post("/matchmaking/duo/invite", {
          to_user_id: duoPartner.user_id,
          match_type: matchType,
          mode: mode === "solo" ? "vs_ai" : "online",
        });
        setTypeModal(null);
        setTimeout(() => {
          router.push({ pathname: "/matchmaking", params: { type: matchType, duo: "1" } });
        }, 150);
      } catch {
        setTypeModal(null);
        setJoinError(t("error_generic"));
      } finally {
        setBusy(false);
      }
      return;
    }
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

  // deep link /join/CODE visited before login: resume the join after auth
  useEffect(() => {
    AsyncStorage.getItem("pending_room_code").then((c) => {
      if (c) {
        AsyncStorage.removeItem("pending_room_code").catch(() => {});
        router.push({ pathname: "/join/[code]", params: { code: c } });
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const acceptDuoInvite = async (inv: DuoInviteNotif) => {
    try {
      const res = await api.post(`/matchmaking/duo/${inv.invite_id}/accept`);
      refresh();
      setNotifOpen(false);
      if (res.game_id) {
        // duo vs AI: the game is created immediately
        router.push({ pathname: "/game/[id]", params: { id: res.game_id } });
      } else {
        router.push({ pathname: "/matchmaking", params: { type: inv.match_type, duo: "1" } });
      }
    } catch {
      refresh();
    }
  };

  const declineDuoInvite = async (inv: DuoInviteNotif) => {
    await api.post(`/matchmaking/duo/${inv.invite_id}/decline`).catch(() => {});
    refresh();
  };

  const notifCount = invites.length + friendRequests.length + duoInvites.length;

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
        contentContainerStyle={{ padding: SP.lg, paddingTop: SP.md, paddingBottom: SP.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentGame && !codeFocused && (
          <Animated.View entering={FadeInDown} exiting={FadeOut.duration(120)} style={styles.resumeBanner} testID="resume-game-banner">
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

        {!codeFocused && invites.map((inv) => (
          <Animated.View key={inv.invite_id} entering={FadeInDown} exiting={FadeOut.duration(120)} style={styles.inviteBanner}>
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

        {!codeFocused && duoInvites.map((inv) => (
          <Animated.View
            key={inv.invite_id}
            entering={FadeInDown}
            exiting={FadeOut.duration(120)}
            style={[styles.inviteBanner, { borderColor: C.brand3 }]}
          >
            <Avatar avatarId={inv.from_user.avatar_id} size={36} />
            <Text style={styles.inviteText} numberOfLines={2}>
              {t(inv.mode === "vs_ai" ? "duoInvitedYouAI" : "duoInvitedYou", {
                name: inv.from_user.username,
              })}
            </Text>
            <Pressable
              testID={`duo-invite-accept-${inv.invite_id}`}
              onPress={() => acceptDuoInvite(inv)}
              style={styles.inviteJoin}
            >
              <Text style={styles.inviteJoinText}>{t("accept")}</Text>
            </Pressable>
            <Pressable
              testID={`duo-invite-decline-${inv.invite_id}`}
              onPress={() => declineDuoInvite(inv)}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={C.ink3} />
            </Pressable>
          </Animated.View>
        ))}

        {!codeFocused && (
          <Animated.View entering={FadeInUp.delay(50)} exiting={FadeOut.duration(120)}>
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
                <View style={styles.cardRow}>
                  <View style={styles.bigCardIcon}>
                    <Ionicons name="globe" size={26} color={C.cream} />
                  </View>
                  <View style={styles.cardRowText}>
                    <Text style={[styles.bigCardTitle, { color: C.cream }]}>{t("playOnline")}</Text>
                    <Text style={styles.bigCardDesc} numberOfLines={2}>
                      {t("playOnlineDesc")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSuits}>♠ ♥ ♦ ♣</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}

        {!codeFocused && (
          <Animated.View entering={FadeInUp.delay(85)} exiting={FadeOut.duration(120)}>
            <Pressable
              testID="play-solo-card"
              onPress={() => setTypeModal("solo")}
              style={({ pressed }) => [styles.bigCard, styles.soloCard, pressed && styles.pressed]}
            >
              <View style={styles.cardRow}>
                <View style={[styles.bigCardIcon, { backgroundColor: C.brand2 }]}>
                  <Ionicons name="game-controller" size={24} color={C.onBrand} />
                </View>
                <View style={styles.cardRowText}>
                  <Text style={[styles.bigCardTitle, { color: C.ink }]}>
                    {t("playVsAI")}
                  </Text>
                  <Text style={[styles.bigCardDesc, { color: C.ink2 }]} numberOfLines={2}>
                    {t("playVsAIDesc")}
                  </Text>
                </View>
                <View style={styles.trainingBadge}>
                  <Text style={styles.trainingBadgeText}>{t("trainingBadge")}</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {!codeFocused && (
          <Animated.View entering={FadeInUp.delay(100)} exiting={FadeOut.duration(120)}>
            <Pressable
              testID="learn-card"
              onPress={() => router.push("/tutorial")}
              style={({ pressed }) => [styles.learnCard, pressed && styles.pressed]}
            >
              <View style={styles.learnIcon}>
                <Ionicons name="school" size={22} color={C.gold} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.learnTitle}>{t("tutorialTitle")}</Text>
                <Text style={styles.learnDesc} numberOfLines={1}>
                  {t("tutorialDesc")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.ink3} />
            </Pressable>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInUp.delay(120)}
          layout={LinearTransition.duration(180)}
        >
          <View style={[styles.bigCard, styles.privateCard]}>
            <View style={styles.cardRow}>
              <View style={[styles.bigCardIcon, { backgroundColor: C.brand2 }]}>
                <Ionicons name="people" size={24} color={C.onBrand} />
              </View>
              <View style={styles.cardRowText}>
                <Text style={[styles.bigCardTitle, { color: C.ink }]}>{t("privateParty")}</Text>
                <Text style={[styles.bigCardDesc, { color: C.ink2 }]} numberOfLines={2}>
                  {t("privatePartyDesc")}
                </Text>
              </View>
            </View>

            <ChunkyButton
              testID="create-party-button"
              label={t("createParty")}
              onPress={() => setTypeModal("create")}
              loading={busy}
              style={{ marginTop: SP.md }}
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
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                returnKeyType="go"
                onSubmitEditing={joinRoom}
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
              {duoInvites.map((inv) => (
                <View key={inv.invite_id} style={styles.notifRow} testID={`notif-duo-${inv.invite_id}`}>
                  <Avatar avatarId={inv.from_user.avatar_id} size={38} />
                  <Text style={styles.notifText} numberOfLines={2}>
                    {t(inv.mode === "vs_ai" ? "duoInvitedYouAI" : "duoInvitedYou", {
                      name: inv.from_user.username,
                    })}
                  </Text>
                  <Pressable
                    testID={`notif-duo-accept-${inv.invite_id}`}
                    onPress={() => acceptDuoInvite(inv)}
                    style={styles.notifPrimary}
                  >
                    <Text style={styles.notifPrimaryText}>{t("accept")}</Text>
                  </Pressable>
                  <Pressable
                    testID={`notif-duo-decline-${inv.invite_id}`}
                    onPress={() => declineDuoInvite(inv)}
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
          <Pressable style={[styles.modalSheet, { maxHeight: "88%" }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>{t("chooseMatchType")}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
            {(typeModal === "online" || typeModal === "solo") && (
              <View style={styles.segmentRow}>
                <Pressable
                  testID="online-mode-solo"
                  onPress={() => setOnlineMode("solo")}
                  style={[styles.segment, onlineMode === "solo" && styles.segmentActive]}
                >
                  <Ionicons
                    name="person"
                    size={15}
                    color={onlineMode === "solo" ? C.onBrand : C.ink2}
                  />
                  <Text style={[styles.segmentText, onlineMode === "solo" && styles.segmentTextActive]}>
                    {t("playAlone")}
                  </Text>
                </Pressable>
                <Pressable
                  testID="online-mode-duo"
                  onPress={() => setOnlineMode("duo")}
                  style={[styles.segment, onlineMode === "duo" && styles.segmentActive]}
                >
                  <Ionicons
                    name="people"
                    size={15}
                    color={onlineMode === "duo" ? C.onBrand : C.ink2}
                  />
                  <Text style={[styles.segmentText, onlineMode === "duo" && styles.segmentTextActive]}>
                    {t("playDuo")}
                  </Text>
                </Pressable>
              </View>
            )}
            {(typeModal === "online" || typeModal === "solo") && onlineMode === "duo" && (
              <DuoSetup
                partner={duoPartner}
                onPartner={setDuoPartner}
                showDuoElo={typeModal === "online"}
              />
            )}
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
              disabled={busy || ((typeModal === "online" || typeModal === "solo") && onlineMode === "duo" && !duoPartner)}
              style={({ pressed }) => [
                styles.typeOption,
                pressed && styles.pressed,
                (typeModal === "online" || typeModal === "solo") && onlineMode === "duo" && !duoPartner && { opacity: 0.45 },
              ]}
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
              disabled={busy || ((typeModal === "online" || typeModal === "solo") && onlineMode === "duo" && !duoPartner)}
              style={({ pressed }) => [
                styles.typeOption,
                pressed && styles.pressed,
                (typeModal === "online" || typeModal === "solo") && onlineMode === "duo" && !duoPartner && { opacity: 0.45 },
              ]}
            >
              <Ionicons name="hourglass" size={26} color={C.brand2} />
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Text style={styles.typeTitle}>{t("longMatch")}</Text>
                <Text style={styles.typeDesc}>{t("pointsTarget", { n: 2000 })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.ink3} />
            </Pressable>
            </ScrollView>
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
    padding: SP.lg,
    marginBottom: SP.md,
    ...shadow,
  },
  heroGlow: {
    borderRadius: R.lg,
    borderWidth: 1.5,
    marginBottom: SP.md,
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
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardRowText: { flex: 1, marginLeft: SP.md },
  trainingBadge: {
    backgroundColor: C.gold,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    paddingVertical: 4,
    flexShrink: 0,
  },
  trainingBadgeText: { fontFamily: F.bold, fontSize: 11, color: "#1A1200" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  learnCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: "rgba(255,190,60,0.35)",
    padding: SP.md,
    marginBottom: SP.md,
  },
  learnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,190,60,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  learnTitle: { fontFamily: F.display, fontSize: 16, color: C.ink },
  learnDesc: { fontFamily: F.text, fontSize: 12.5, color: C.ink2, marginTop: 1 },
  bigCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  bigCardTitle: { fontFamily: F.display, fontSize: 19, color: C.onBrand },
  bigCardDesc: {
    fontFamily: F.text,
    fontSize: 12.5,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  cardSuits: {
    position: "absolute",
    right: SP.md,
    top: SP.sm,
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    letterSpacing: 2,
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
    paddingVertical: 0,
    fontFamily: F.extra,
    fontSize: 16,
    letterSpacing: 2,
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
  segmentRow: {
    flexDirection: "row",
    backgroundColor: C.bg2,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
    marginBottom: SP.sm,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    borderRadius: R.pill,
  },
  segmentActive: { backgroundColor: C.brand },
  segmentText: { fontFamily: F.bold, fontSize: 13.5, color: C.ink2 },
  segmentTextActive: { color: C.onBrand },
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
