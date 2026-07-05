import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import ChunkyButton from "@/src/components/ChunkyButton";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP, shadow } from "@/src/theme";

interface Invite {
  invite_id: string;
  room_code: string;
  match_type: string;
  from_user: { username: string; avatar_id: string };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();

  const [typeModal, setTypeModal] = useState<null | "online" | "create">(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      const poll = async () => {
        try {
          const res = await api.get("/invites/pending");
          setInvites(res.invites);
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
      router.push({ pathname: "/matchmaking", params: { type: matchType } });
    } else if (mode === "create") {
      setBusy(true);
      try {
        const room = await api.post("/rooms", { match_type: matchType });
        router.push({ pathname: "/room/[code]", params: { code: room.code } });
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

  const acceptInvite = async (inv: Invite) => {
    try {
      await api.post(`/rooms/${inv.room_code}/join`);
      await api.post(`/invites/${inv.invite_id}/dismiss`);
      router.push({ pathname: "/room/[code]", params: { code: inv.room_code } });
    } catch {
      await api.post(`/invites/${inv.invite_id}/dismiss`).catch(() => {});
      setInvites((prev) => prev.filter((i) => i.invite_id !== inv.invite_id));
    }
  };

  const dismissInvite = async (inv: Invite) => {
    setInvites((prev) => prev.filter((i) => i.invite_id !== inv.invite_id));
    await api.post(`/invites/${inv.invite_id}/dismiss`).catch(() => {});
  };

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
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xl }}
        showsVerticalScrollIndicator={false}
      >
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
          <Pressable
            testID="play-online-card"
            onPress={() => setTypeModal("online")}
            style={({ pressed }) => [styles.bigCard, styles.onlineCard, pressed && styles.pressed]}
          >
            <View style={styles.bigCardIcon}>
              <Ionicons name="globe" size={30} color={C.onBrand} />
            </View>
            <Text style={styles.bigCardTitle}>{t("playOnline")}</Text>
            <Text style={styles.bigCardDesc}>{t("playOnlineDesc")}</Text>
            <Text style={styles.cardSuits}>♠ ♥ ♦ ♣</Text>
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

      <Modal visible={typeModal !== null} transparent animationType="fade">
        <Pressable style={styles.modalScrim} onPress={() => setTypeModal(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>{t("chooseMatchType")}</Text>
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
    backgroundColor: C.cream,
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
  inviteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: "#FBEFE2",
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.brand3,
    padding: SP.md,
    marginBottom: SP.md,
  },
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
  onlineCard: { backgroundColor: C.felt, overflow: "hidden" },
  privateCard: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
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
    backgroundColor: C.cream,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP.lg,
    marginBottom: SP.md,
  },
  typeTitle: { fontFamily: F.display, fontSize: 17, color: C.ink },
  typeDesc: { fontFamily: F.text, fontSize: 13, color: C.ink3, marginTop: 2 },
});
