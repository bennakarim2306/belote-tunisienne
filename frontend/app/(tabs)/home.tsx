import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
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
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BTN_DARK,
  BTN_GREEN,
  BTN_ICON_GREEN,
  CHAT_CHIP,
  HUD_PANEL,
  ICONS,
} from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import NineSlice from "@/src/anime/components/NineSlice";
import DesignNotice from "@/src/anime/DesignNotice";
import { useAnime } from "@/src/anime/design";
import { AnimeTitle, AnimeWindowFrame, GameButton } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import AnimeHomeMain from "@/src/anime/home/AnimeHomeMain";
import { api, ApiError } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import DuoSetup, { DuoCandidate } from "@/src/components/DuoSetup";
import ModalCard from "@/src/components/ModalCard";
import MenuButton from "@/src/components/MenuButton";
import { useAuth } from "@/src/context/AuthContext";
import { getSavedLocalGame, newLocalGameId } from "@/src/game/useLocalGame";
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

const SUIT_DECO = [
  { s: "♠", c: "#8F9A55" },
  { s: "♥", c: "#C0392B" },
  { s: "♦", c: "#D35400" },
  { s: "♣", c: "#7E9B4E" },
];

/** thin gilded rule with a small diamond — under card titles (mockup style) */
function GoldDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <View style={styles.dividerDiamond} />
      <View style={styles.dividerLine} />
    </View>
  );
}

export default function HomeScreen() {
  const ANIME = useAnime();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const {
    invites,
    friendRequests,
    duoInvites,
    refresh,
    online: onlineNow,
    currentGame: serverGame,
  } = useNotifications();

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
  const duoNeedsPartner =
    (typeModal === "online" || typeModal === "solo") &&
    onlineMode === "duo" &&
    !duoPartner;
  const [timerOn, setTimerOn] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [privateOpen, setPrivateOpen] = useState(false);
  // an unfinished offline solo game takes precedence over server games
  const [localGame, setLocalGame] = useState<CurrentGame | null>(null);
  const currentGame: CurrentGame | null =
    localGame ?? (serverGame?.game_id ? (serverGame as CurrentGame) : null);

  // reset duo selections whenever the type modal closes
  useEffect(() => {
    if (typeModal === null) {
      setOnlineMode("solo");
      setDuoPartner(null);
      setTypeError(null);
    }
  }, [typeModal]);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      refresh(); // immediate batched sync (online count, invites, current game)
      (async () => {
        setLocalGame(user ? await getSavedLocalGame(user.user_id) : null);
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.user_id]),
  );

  const chooseType = async (matchType: "short" | "long") => {
    const mode = typeModal;
    setTypeError(null);
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
          router.push({
            pathname: "/matchmaking",
            params: { type: matchType, duo: "1", mode: mode === "solo" ? "vs_ai" : "online" },
          });
        }, 150);
      } catch {
        // keep the window open so the message is seen and the player can retry
        setTypeModal((cur) => cur ?? mode);
        setTypeError(t("error_generic"));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (mode !== "create") setTypeModal(null);
    if (mode === "online") {
      // let the modal close before navigating (web Modal can linger otherwise)
      setTimeout(() => {
        router.push({ pathname: "/matchmaking", params: { type: matchType } });
      }, 150);
    } else if (mode === "solo") {
      // fully offline: the game runs on the local TS engine, no backend call
      const gid = newLocalGameId(matchType);
      setTimeout(() => {
        router.push({ pathname: "/game/[id]", params: { id: gid } });
      }, 150);
    } else if (mode === "create") {
      setBusy(true);
      try {
        const room = await api.post("/rooms", { match_type: matchType, turn_timer: timerOn });
        setTypeModal(null);
        setTimeout(() => {
          router.push({ pathname: "/room/[code]", params: { code: room.code } });
        }, 150);
      } catch {
        setTypeModal((cur) => cur ?? mode);
        setTypeError(t("error_generic"));
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
      setPrivateOpen(false);
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
      {ANIME ? (
        // Anime redesign (local flag EXPO_PUBLIC_ANIME_THEME=1): visual layer
        // only — same actions, labels and live values as the original below.
        <AnimeHomeMain
          username={user?.username}
          avatarId={user?.avatar_id}
          elo={user?.elo ?? 1000}
          onlineNow={onlineNow}
          notifCount={notifCount}
          currentGame={currentGame}
          onResume={() => {
            if (currentGame) {
              router.push({ pathname: "/game/[id]", params: { id: currentGame.game_id } });
            }
          }}
          onOpenNotifications={() => setNotifOpen(true)}
          onPlayOnline={() => setTypeModal("online")}
          onPlaySolo={() => setTypeModal("solo")}
          onLearn={() => router.push("/tutorial")}
          onPrivate={() => {
            setJoinError(null);
            setPrivateOpen(true);
          }}
        />
      ) : (
      <>
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <View style={styles.headerRow}>
          <MenuButton />
          <Avatar
            avatarId={user?.avatar_id}
            size={44}
            ringColor={C.goldSoft}
            testID="home-user-avatar"
          />
          <View style={{ marginHorizontal: SP.md, flexShrink: 1, minWidth: 0 }}>
            <Text style={styles.hello}>{t("hello")},</Text>
            <Text style={styles.username} numberOfLines={1}>
              {user?.username}
            </Text>
          </View>
          <View style={styles.headerMiddle}>
            <View style={styles.suitsDeco} pointerEvents="none">
              {SUIT_DECO.map((d) => (
                <Text key={d.s} style={[styles.suitDecoText, { color: d.c }]}>
                  {d.s}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.eloPill} testID="home-elo-pill">
            <Ionicons name="flame" size={15} color={C.gold} />
            <Text style={styles.eloText}>{user?.elo ?? 1000}</Text>
          </View>
          {currentGame && (
            <Pressable
              testID="resume-game-button"
              onPress={() =>
                router.push({ pathname: "/game/[id]", params: { id: currentGame.game_id } })
              }
              style={({ pressed }) => [styles.resumeBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="play-circle" size={18} color={C.onBrand} />
              <Text style={styles.resumeBtnText} numberOfLines={1}>
                {t("resumeGame")}
              </Text>
            </Pressable>
          )}
          <Pressable
            testID="notifications-bell"
            onPress={() => setNotifOpen(true)}
            hitSlop={8}
            style={styles.bellBtn}
          >
            <Ionicons name="notifications" size={20} color={C.goldSoft} />
            {notifCount > 0 && (
              <View style={styles.bellBadge} testID="notifications-badge">
                <Text style={styles.bellBadgeText}>{notifCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* the content area is reserved for the 4 mode boxes only */}
      <View style={styles.content}>
        {/* 2×2 landscape grid: the 4 game modes fill the whole screen */}
        <View style={styles.grid} testID="home-grid">
          <View style={styles.gridRow}>
            <Animated.View entering={FadeInUp.delay(40)} style={styles.gridItem}>
              <Animated.View style={[styles.heroGlow, { flex: 1 }, heroGlowStyle]}>
                <Pressable
                  testID="play-online-card"
                  onPress={() => setTypeModal("online")}
                  style={({ pressed }) => [styles.gridCard, styles.onlineCard, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={["#14582F", "#0A2E1C"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.gridIcon, styles.gridIconFelt]}>
                    <Ionicons name="globe-outline" size={26} color={C.goldSoft} />
                  </View>
                  <View style={styles.gridTextWrap}>
                    <Text style={[styles.gridTitle, { color: C.cream }]} numberOfLines={1}>
                      {t("playOnline")}
                    </Text>
                    <GoldDivider />
                    <Text style={styles.gridDesc} numberOfLines={2}>
                      {t("playOnlineDesc")}
                    </Text>
                    {onlineNow > 0 && (
                      <Text style={styles.onlineNowText} testID="online-now-count">
                        🟢 {t("onlineCount", { n: onlineNow })}
                      </Text>
                    )}
                  </View>
                  <View style={styles.cardSuitsRow}>
                    {SUIT_DECO.map((d) => (
                      <Text key={d.s} style={[styles.cardSuitText, { color: d.c }]}>
                        {d.s}
                      </Text>
                    ))}
                  </View>
                </Pressable>
              </Animated.View>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(70)} style={styles.gridItem}>
              <Pressable
                testID="play-solo-card"
                onPress={() => setTypeModal("solo")}
                style={({ pressed }) => [styles.gridCard, styles.soloCard, pressed && styles.pressed]}
              >
                <View style={[styles.gridIcon, styles.gridIconCopper]}>
                  <LinearGradient
                    colors={["#FFA02E", "#E96D00"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="game-controller" size={26} color="#2C1400" />
                </View>
                <View style={styles.gridTextWrap}>
                  <Text style={[styles.gridTitle, { color: C.ink }]} numberOfLines={1}>
                    {t("playVsAI")}
                  </Text>
                  <GoldDivider />
                  <Text style={[styles.gridDesc, { color: C.ink2 }]} numberOfLines={2}>
                    {t("playVsAIDesc")}
                  </Text>
                </View>
                <View style={styles.trainingBadge}>
                  <Text style={styles.trainingBadgeText}>{t("trainingBadge")}</Text>
                </View>
              </Pressable>
            </Animated.View>
          </View>

          <View style={styles.gridRow}>
            <Animated.View entering={FadeInUp.delay(100)} style={styles.gridItem}>
              <Pressable
                testID="learn-card"
                onPress={() => router.push("/tutorial")}
                style={({ pressed }) => [styles.gridCard, styles.learnCard, pressed && styles.pressed]}
              >
                <View style={[styles.gridIcon, styles.gridIconGold]}>
                  <Ionicons name="school" size={26} color={C.goldSoft} />
                </View>
                <View style={styles.gridTextWrap}>
                  <Text style={[styles.gridTitle, { color: C.ink }]} numberOfLines={1}>
                    {t("tutorialTitle")}
                  </Text>
                  <GoldDivider />
                  <Text style={[styles.gridDesc, { color: C.ink2 }]} numberOfLines={2}>
                    {t("tutorialDesc")}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(130)} style={styles.gridItem}>
              <Pressable
                testID="private-game-card"
                onPress={() => {
                  setJoinError(null);
                  setPrivateOpen(true);
                }}
                style={({ pressed }) => [styles.gridCard, styles.privateCard, pressed && styles.pressed]}
              >
                <View style={[styles.gridIcon, styles.gridIconCopper]}>
                  <LinearGradient
                    colors={["#FFA02E", "#E96D00"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="people" size={26} color="#2C1400" />
                </View>
                <View style={styles.gridTextWrap}>
                  <Text style={[styles.gridTitle, { color: C.ink }]} numberOfLines={1}>
                    {t("privateParty")}
                  </Text>
                  <GoldDivider />
                  <Text style={[styles.gridDesc, { color: C.ink2 }]} numberOfLines={2}>
                    {t("privatePartyDesc")}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>
      </>
      )}

      {/* private game: join by code or create */}
      <Modal visible={privateOpen} transparent animationType="fade" supportedOrientations={["landscape", "portrait"]}>
        <Pressable style={[styles.modalScrim, ANIME && styles.animeScrimTop]} onPress={() => setPrivateOpen(false)}>
          <Pressable style={[styles.modalSheet, ANIME && styles.animeSheet]} onPress={() => {}} testID="private-game-modal">
            {ANIME ? (
              <>
                <AnimeWindowFrame />
                <AnimeTitle text={t("privateParty")} />
              </>
            ) : (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.modalTitle}>{t("privateParty")}</Text>
              </>
            )}
            <View style={[styles.joinRow, ANIME && { marginTop: SP.md }]}>
              {ANIME && (
                <View style={styles.animeInputBg} pointerEvents="none">
                  <HSlice slices={CHAT_CHIP} />
                </View>
              )}
              <TextInput
                testID="join-code-input"
                style={[styles.joinInput, ANIME && styles.animeInput]}
                placeholder={t("roomCodePlaceholder")}
                placeholderTextColor={ANIME ? A.ivoryDim : C.ink3}
                value={joinCode}
                onChangeText={(v) => setJoinCode(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={joinRoom}
                disableFullscreenUI
              />
              <Pressable
                testID="join-room-button"
                onPress={joinRoom}
                style={({ pressed }) => [styles.joinBtn, ANIME && styles.animeClear, pressed && { opacity: 0.85 }]}
              >
                {ANIME ? (
                  <>
                    <Image source={BTN_ICON_GREEN} style={styles.animeBg} fadeDuration={0} />
                    <Image source={ICONS.arrow} style={{ width: 30, height: 30 }} resizeMode="contain" fadeDuration={0} />
                  </>
                ) : (
                  <Ionicons name="arrow-forward" size={22} color={C.onBrand} />
                )}
              </Pressable>
            </View>
            {joinError && (
              <Text testID="join-error-text" style={[styles.joinError, ANIME && styles.animeError]}>
                {joinError}
              </Text>
            )}
            <GameButton
              testID="create-party-button"
              label={t("createParty")}
              onPress={() => {
                setPrivateOpen(false);
                setTypeModal("create");
              }}
              loading={busy}
              style={{ marginTop: SP.md }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {ANIME && <DesignNotice />}

      <Modal visible={notifOpen} transparent animationType="slide" supportedOrientations={["landscape", "portrait"]}>
        <Pressable style={[styles.modalScrim, ANIME && styles.animeScrim]} onPress={() => setNotifOpen(false)}>
          <ModalCard style={[styles.modalSheet, ANIME && styles.animeSheet]} testID="notifications-panel">
            {ANIME ? (
              <>
                <AnimeWindowFrame />
                <AnimeTitle text={t("notifications")} />
              </>
            ) : (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.modalTitle}>{t("notifications")}</Text>
              </>
            )}
            <ScrollView style={{ maxHeight: 170, marginTop: ANIME ? SP.sm : 0 }}>
              {notifCount === 0 && (
                <View style={ANIME ? styles.animeEmpty : undefined}>
                  {ANIME && <Image source={ICONS.invite} style={{ width: 54, height: 54 }} resizeMode="contain" fadeDuration={0} />}
                  <Text style={[styles.notifEmpty, ANIME && styles.animeEmptyText]}>{t("noNotifications")}</Text>
                </View>
              )}
              {invites.length > 0 && (
                <Text style={[styles.notifSection, ANIME && styles.animeSection]}>{t("invitesSection")}</Text>
              )}
              {invites.map((inv) => (
                <View key={inv.invite_id} style={[styles.notifRow, ANIME && styles.animeRow]} testID={`notif-invite-${inv.room_code}`}>
                  {ANIME && <NineSlice slices={HUD_PANEL} corner={9} />}
                  <Avatar avatarId={inv.from_user.avatar_id} size={38} ringColor={ANIME ? A.gold : undefined} />
                  <Text style={[styles.notifText, ANIME && { color: A.ivory }]} numberOfLines={2}>
                    {t("invitedYou", { name: inv.from_user.username })}
                  </Text>
                  <Pressable
                    testID={`notif-invite-join-${inv.room_code}`}
                    onPress={() => {
                      setNotifOpen(false);
                      acceptInvite(inv);
                    }}
                    style={[styles.notifPrimary, ANIME && styles.animeNotifBtn]}
                  >
                    {ANIME && <HSlice slices={BTN_GREEN} />}
                    <Text style={[styles.notifPrimaryText, ANIME && { color: A.ivory }]}>{t("join")}</Text>
                  </Pressable>
                  <Pressable
                    testID={`notif-invite-dismiss-${inv.room_code}`}
                    onPress={() => dismissInvite(inv)}
                    hitSlop={8}
                  >
                    {ANIME ? (
                      <Image source={ICONS.close} style={{ width: 24, height: 24 }} resizeMode="contain" fadeDuration={0} />
                    ) : (
                      <Ionicons name="close" size={20} color={C.ink3} />
                    )}
                  </Pressable>
                </View>
              ))}
              {duoInvites.map((inv) => (
                <View key={inv.invite_id} style={[styles.notifRow, ANIME && styles.animeRow]} testID={`notif-duo-${inv.invite_id}`}>
                  {ANIME && <NineSlice slices={HUD_PANEL} corner={9} />}
                  <Avatar avatarId={inv.from_user.avatar_id} size={38} ringColor={ANIME ? A.gold : undefined} />
                  <Text style={[styles.notifText, ANIME && { color: A.ivory }]} numberOfLines={2}>
                    {t(inv.mode === "vs_ai" ? "duoInvitedYouAI" : "duoInvitedYou", {
                      name: inv.from_user.username,
                    })}
                  </Text>
                  <Pressable
                    testID={`notif-duo-accept-${inv.invite_id}`}
                    onPress={() => acceptDuoInvite(inv)}
                    style={[styles.notifPrimary, ANIME && styles.animeNotifBtn]}
                  >
                    {ANIME && <HSlice slices={BTN_GREEN} />}
                    <Text style={[styles.notifPrimaryText, ANIME && { color: A.ivory }]}>{t("accept")}</Text>
                  </Pressable>
                  <Pressable
                    testID={`notif-duo-decline-${inv.invite_id}`}
                    onPress={() => declineDuoInvite(inv)}
                    hitSlop={8}
                  >
                    {ANIME ? (
                      <Image source={ICONS.close} style={{ width: 24, height: 24 }} resizeMode="contain" fadeDuration={0} />
                    ) : (
                      <Ionicons name="close" size={20} color={C.ink3} />
                    )}
                  </Pressable>
                </View>
              ))}
              {friendRequests.length > 0 && (
                <Text style={[styles.notifSection, ANIME && styles.animeSection]}>{t("friendRequestsSection")}</Text>
              )}
              {friendRequests.map((fr) => (
                <View key={fr.friendship_id} style={[styles.notifRow, ANIME && styles.animeRow]} testID={`notif-friend-${fr.username}`}>
                  {ANIME && <NineSlice slices={HUD_PANEL} corner={9} />}
                  <Avatar avatarId={fr.avatar_id} size={38} ringColor={ANIME ? A.gold : undefined} />
                  <Text style={[styles.notifText, ANIME && { color: A.ivory }]} numberOfLines={2}>
                    {t("friendAsks", { name: fr.username })}
                  </Text>
                  <Pressable
                    testID={`notif-friend-accept-${fr.username}`}
                    onPress={() => respondFriend(fr.friendship_id, true)}
                    style={[styles.notifPrimary, ANIME && styles.animeNotifBtn]}
                  >
                    {ANIME && <HSlice slices={BTN_GREEN} />}
                    <Text style={[styles.notifPrimaryText, ANIME && { color: A.ivory }]}>{t("accept")}</Text>
                  </Pressable>
                  <Pressable
                    testID={`notif-friend-decline-${fr.username}`}
                    onPress={() => respondFriend(fr.friendship_id, false)}
                    hitSlop={8}
                  >
                    {ANIME ? (
                      <Image source={ICONS.close} style={{ width: 24, height: 24 }} resizeMode="contain" fadeDuration={0} />
                    ) : (
                      <Ionicons name="close" size={20} color={C.ink3} />
                    )}
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <GameButton
              label={t("close")}
              variant="secondary"
              onPress={() => setNotifOpen(false)}
              style={{ marginTop: SP.md }}
            />
          </ModalCard>
        </Pressable>
      </Modal>

      <Modal visible={typeModal !== null} transparent animationType="fade" supportedOrientations={["landscape", "portrait"]}>
        <Pressable style={[styles.modalScrim, ANIME && styles.animeScrim]} onPress={() => setTypeModal(null)}>
          <Pressable style={[styles.modalSheet, { maxHeight: "88%" }, ANIME && styles.animeSheet, ANIME && { maxHeight: "96%" }]} testID="match-type-modal" onPress={() => {}}>
            {ANIME ? (
              <>
                <AnimeWindowFrame />
                <AnimeTitle text={t("chooseMatchType")} />
              </>
            ) : (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.modalTitle}>{t("chooseMatchType")}</Text>
              </>
            )}
            {typeError && (
              <Text testID="type-error-text" style={[styles.joinError, ANIME && styles.animeError]}>
                {typeError}
              </Text>
            )}
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
            {(typeModal === "online" || typeModal === "solo") && (
              <View style={[styles.segmentRow, ANIME && styles.animeSegmentRow]}>
                <Pressable
                  testID="online-mode-solo"
                  onPress={() => setOnlineMode("solo")}
                  accessibilityState={{ selected: onlineMode === "solo" }}
                  style={[styles.segment, onlineMode === "solo" && styles.segmentActive, ANIME && styles.animeSegment]}
                >
                  {ANIME && <HSlice slices={onlineMode === "solo" ? BTN_GREEN : BTN_DARK} />}
                  {ANIME ? (
                    <Image source={ICONS.alone} style={styles.animeSegIcon} fadeDuration={0} />
                  ) : (
                    <Ionicons
                      name="person"
                      size={15}
                      color={onlineMode === "solo" ? C.onBrand : C.ink2}
                    />
                  )}
                  <Text
                    style={[
                      styles.segmentText,
                      onlineMode === "solo" && styles.segmentTextActive,
                      ANIME && { color: onlineMode === "solo" ? A.ivory : A.ivoryDim },
                    ]}
                  >
                    {t("playAlone")}
                  </Text>
                </Pressable>
                <Pressable
                  testID="online-mode-duo"
                  onPress={() => setOnlineMode("duo")}
                  accessibilityState={{ selected: onlineMode === "duo" }}
                  style={[styles.segment, onlineMode === "duo" && styles.segmentActive, ANIME && styles.animeSegment]}
                >
                  {ANIME && <HSlice slices={onlineMode === "duo" ? BTN_GREEN : BTN_DARK} />}
                  {ANIME ? (
                    <Image source={ICONS.duo} style={styles.animeSegIcon} fadeDuration={0} />
                  ) : (
                    <Ionicons
                      name="people"
                      size={15}
                      color={onlineMode === "duo" ? C.onBrand : C.ink2}
                    />
                  )}
                  <Text
                    style={[
                      styles.segmentText,
                      onlineMode === "duo" && styles.segmentTextActive,
                      ANIME && { color: onlineMode === "duo" ? A.ivory : A.ivoryDim },
                    ]}
                  >
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
                style={[styles.timerToggle, ANIME && styles.animePanel]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: timerOn }}
              >
                {ANIME ? (
                  <>
                    <NineSlice slices={HUD_PANEL} corner={11} />
                    <Image source={timerOn ? ICONS.checkOn : ICONS.checkOff} style={styles.animeCheck} fadeDuration={0} />
                  </>
                ) : (
                  <Ionicons
                    name={timerOn ? "checkbox" : "square-outline"}
                    size={22}
                    color={timerOn ? C.brand : C.ink3}
                  />
                )}
                <View style={{ flex: 1, marginLeft: SP.md }}>
                  <Text style={[styles.timerToggleLabel, ANIME && { color: A.ivory }]}>{t("timerSetting")}</Text>
                  <Text style={[styles.timerToggleValue, ANIME && { color: A.ivoryDim }]}>
                    {timerOn ? t("timerOn") : t("timerOff")}
                  </Text>
                </View>
                {ANIME ? (
                  <Image source={ICONS.timer} style={[styles.animeCheck, !timerOn && { opacity: 0.45 }]} fadeDuration={0} />
                ) : (
                  <Ionicons name="timer" size={20} color={timerOn ? C.brand : C.ink3} />
                )}
              </Pressable>
            )}
            <View style={ANIME ? styles.animeTypeRow : undefined}>
            <Pressable
              testID="match-type-short"
              // NOTE: no `disabled` prop — on Android a disabled Pressable
              // swallows touches and blocks the parent ScrollView from
              // scrolling; guard inside onPress instead
              onPress={() => {
                if (busy || duoNeedsPartner) return;
                chooseType("short");
              }}
              style={({ pressed }) => [
                styles.typeOption,
                ANIME && styles.animeType,
                pressed && styles.pressed,
                duoNeedsPartner && { opacity: 0.45 },
              ]}
            >
              {ANIME && <NineSlice slices={HUD_PANEL} corner={13} />}
              {ANIME ? (
                <Image source={ICONS.quick} style={styles.animeTypeIcon} fadeDuration={0} />
              ) : (
                <Ionicons name="flash" size={26} color={C.brand} />
              )}
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Text style={[styles.typeTitle, ANIME && styles.animeTypeTitle]}>{t("shortMatch")}</Text>
                <Text style={[styles.typeDesc, ANIME && { color: A.ivoryDim }]}>{t("pointsTarget", { n: 500 })}</Text>
              </View>
              {!ANIME && <Ionicons name="chevron-forward" size={20} color={C.ink3} />}
            </Pressable>
            <Pressable
              testID="match-type-long"
              onPress={() => {
                if (busy || duoNeedsPartner) return;
                chooseType("long");
              }}
              style={({ pressed }) => [
                styles.typeOption,
                ANIME && styles.animeType,
                pressed && styles.pressed,
                duoNeedsPartner && { opacity: 0.45 },
              ]}
            >
              {ANIME && <NineSlice slices={HUD_PANEL} corner={13} />}
              {ANIME ? (
                <Image source={ICONS.normal} style={styles.animeTypeIcon} fadeDuration={0} />
              ) : (
                <Ionicons name="hourglass" size={26} color={C.brand2} />
              )}
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Text style={[styles.typeTitle, ANIME && styles.animeTypeTitle]}>{t("longMatch")}</Text>
                <Text style={[styles.typeDesc, ANIME && { color: A.ivoryDim }]}>{t("pointsTarget", { n: 1000 })}</Text>
              </View>
              {!ANIME && <Ionicons name="chevron-forward" size={20} color={C.ink3} />}
            </Pressable>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- anime theme: windows opened from home ----
  animeScrim: { justifyContent: "center" },
  animeScrimTop: { justifyContent: "flex-start", paddingTop: 18 },
  animeSheet: {
    backgroundColor: "transparent",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 34,
    paddingTop: 22,
    paddingBottom: 26,
  },
  animeClear: { backgroundColor: "transparent", borderRadius: 0 },
  animeBg: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", resizeMode: "stretch" },
  animeInputBg: { position: "absolute", left: 0, right: 60, top: 0, bottom: 0 },
  // positioned so the text paints above the absolute painted field (web)
  animeInput: {
    position: "relative",
    zIndex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 26,
    color: A.ivory,
  },
  animeError: { color: "#FF8A80", textAlign: "center" },
  animeEmpty: { alignItems: "center", paddingTop: SP.sm },
  animeEmptyText: { color: A.ivoryDim, paddingVertical: SP.sm },
  animeSection: { fontFamily: F.serif, color: A.goldLight },
  animeRow: { borderBottomWidth: 0, paddingHorizontal: SP.md, marginTop: 5, minHeight: 54 },
  animeNotifBtn: { backgroundColor: "transparent", borderRadius: 0, paddingHorizontal: 26, height: 38 },
  animeSegmentRow: { backgroundColor: "transparent", borderWidth: 0, gap: SP.sm, marginTop: SP.sm, padding: 0 },
  animeSegment: { backgroundColor: "transparent", height: 46, borderRadius: 0 },
  animeSegIcon: { width: 28, height: 28, resizeMode: "contain" },
  animePanel: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, marginTop: SP.sm, marginBottom: SP.sm, paddingHorizontal: SP.lg },
  animeCheck: { width: 30, height: 30, resizeMode: "contain" },
  animeTypeRow: { flexDirection: "row", gap: SP.sm, marginTop: SP.xs },
  animeType: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    marginBottom: 0,
    paddingVertical: SP.md,
    minHeight: 84,
  },
  animeTypeIcon: { width: 48, height: 48, resizeMode: "contain" },
  animeTypeTitle: { fontFamily: F.serif, color: A.goldLight },
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: SP.lg,
    paddingBottom: SP.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  hello: { fontFamily: F.text, fontSize: 13, color: C.ink3 },
  username: { fontFamily: F.serif, fontSize: 22, color: C.ink },
  eloPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(28,23,20,0.9)",
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 40,
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.5)",
  },
  eloText: { fontFamily: F.serif, fontSize: 17, color: C.ink },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(28,23,20,0.9)",
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.35)",
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
    backgroundColor: "#E4572E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: { fontFamily: F.extra, fontSize: 10.5, color: "#FFF" },
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
  headerMiddle: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: SP.sm,
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.brand,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 40,
    marginLeft: SP.sm,
    maxWidth: 200,
  },
  resumeBtnText: { fontFamily: F.display, fontSize: 13, color: C.onBrand },
  content: {
    flex: 1,
    paddingHorizontal: SP.lg,
    paddingTop: SP.sm,
    paddingBottom: SP.sm,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  grid: { flex: 1, gap: SP.sm },
  gridRow: { flex: 1, flexDirection: "row", gap: SP.sm },
  gridItem: { flex: 1 },
  gridCard: {
    flex: 1,
    borderRadius: 22,
    padding: SP.lg,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: SP.lg,
    ...shadow,
  },
  heroGlow: {
    borderRadius: 22,
    borderWidth: 2,
    shadowColor: "#58D68D",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    elevation: 10,
  },
  onlineCard: { backgroundColor: C.felt, overflow: "hidden", borderRadius: 20 },
  privateCard: {
    backgroundColor: "#1A130E",
    borderWidth: 1.5,
    borderColor: "rgba(255,123,0,0.45)",
  },
  soloCard: {
    backgroundColor: "#1A130E",
    borderWidth: 1.5,
    borderColor: "rgba(255,123,0,0.6)",
  },
  learnCard: {
    backgroundColor: "#1B1510",
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.5)",
  },
  gridIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  gridIconFelt: {
    backgroundColor: "rgba(0,0,0,0.30)",
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.45)",
  },
  gridIconGold: {
    backgroundColor: "rgba(233,196,106,0.10)",
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.45)",
  },
  gridIconCopper: {},
  gridTextWrap: { flex: 1, minWidth: 0 },
  gridTitle: { fontFamily: F.serif, fontSize: 21, color: C.ink },
  gridDesc: {
    fontFamily: F.text,
    fontSize: 12.5,
    color: "rgba(255,255,255,0.85)",
  },
  onlineNowText: {
    fontFamily: F.bold,
    fontSize: 12,
    color: C.green,
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 5,
    maxWidth: 200,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(233,196,106,0.4)" },
  dividerDiamond: {
    width: 5,
    height: 5,
    backgroundColor: C.goldSoft,
    transform: [{ rotate: "45deg" }],
  },
  suitsDeco: { flexDirection: "row", alignItems: "center", gap: 9 },
  suitDecoText: { fontSize: 15 },
  trainingBadge: {
    position: "absolute",
    top: SP.sm,
    right: SP.sm,
    backgroundColor: C.gold,
    borderRadius: R.pill,
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
  },
  trainingBadgeText: { fontFamily: F.bold, fontSize: 10, color: "#1A1200" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  cardSuitsRow: {
    position: "absolute",
    right: SP.md,
    top: SP.sm,
    flexDirection: "row",
    gap: 5,
  },
  cardSuitText: { fontSize: 13 },
  joinRow: { flexDirection: "row", gap: SP.sm },
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
