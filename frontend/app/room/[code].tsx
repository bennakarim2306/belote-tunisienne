import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import ChunkyButton from "@/src/components/ChunkyButton";
import ShareSheet from "@/src/components/ShareSheet";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { roomLink } from "@/src/share";
import { C, F, R, SP } from "@/src/theme";

interface RoomPlayer {
  user_id: string;
  username: string;
  avatar_id: string;
  elo: number;
}

interface Room {
  code: string;
  host_id: string;
  match_type: string;
  turn_timer?: boolean;
  started: boolean;
  game_id: string | null;
  players: RoomPlayer[];
}

interface Friend {
  user_id: string;
  username: string;
  avatar_id: string;
}

export default function RoomScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const [room, setRoom] = useState<Room | null>(null);
  const [gone, setGone] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSeat, setInviteSeat] = useState<number | null>(null);
  const [seatAction, setSeatAction] = useState<number | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const navigatedRef = useRef(false);

  const isHost = room?.host_id === user?.user_id;

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      try {
        const r = await api.get(`/rooms/${code}`);
        setRoom(r);
        if (r.started && r.game_id && !navigatedRef.current) {
          navigatedRef.current = true;
          router.replace({ pathname: "/game/[id]", params: { id: r.game_id } });
        }
      } catch {
        setGone(true);
        if (poll) clearInterval(poll);
      }
    };
    load();
    poll = setInterval(load, 2000);
    return () => {
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const openInvite = useCallback(async (seat: number | null = null) => {
    setInviteSeat(seat);
    setInviteOpen(true);
    try {
      const res = await api.get("/friends");
      setFriends(res.friends);
    } catch {}
  }, []);

  const inviteFriend = async (friendId: string) => {
    try {
      await api.post(`/rooms/${code}/invite`, {
        user_id: friendId,
        ...(inviteSeat !== null ? { seat: inviteSeat } : {}),
      });
      setInvited((prev) => new Set(prev).add(friendId));
    } catch {}
  };

  const moveSeat = async (seat: number) => {
    try {
      const r = await api.post(`/rooms/${code}/seat`, { seat });
      setRoom(r);
    } catch {}
  };

  const onSeatPress = (i: number, occupied: boolean) => {
    if (occupied || room?.started) return;
    if (isHost) {
      setSeatAction(i); // host chooses: sit here, or invite a friend to this seat
    } else {
      moveSeat(i);
    }
  };

  const start = async () => {
    setStarting(true);
    try {
      const res = await api.post(`/rooms/${code}/start`);
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        router.replace({ pathname: "/game/[id]", params: { id: res.game_id } });
      }
    } catch {
      setStarting(false);
    }
  };

  const leave = async () => {
    try {
      await api.post(`/rooms/${code}/leave`);
    } catch {}
    router.back();
  };

  const [shareOpen, setShareOpen] = useState(false);

  const seats = room?.seats ?? [null, null, null, null];

  return (
    <View style={[styles.container, { paddingTop: insets.top + SP.md }]} testID="room-screen">
      <View style={styles.topBar}>
        <Pressable onPress={leave} hitSlop={12} testID="room-leave-button">
          <Ionicons name="arrow-back" size={26} color={C.ink} />
        </Pressable>
        <Text style={styles.title}>{t("partyLobby")}</Text>
        <View style={{ width: 26 }} />
      </View>

      {gone ? (
        <View style={styles.center}>
          <Text style={styles.goneText}>{t("roomGone")}</Text>
          <ChunkyButton label={t("backHome")} onPress={() => router.back()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.columns}>
            <View style={styles.colLeft}>
              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>{t("roomCode")}</Text>
                <Text style={styles.code} testID="room-code-text">
                  {code}
                </Text>
                <Pressable
                  onPress={() => setShareOpen(true)}
                  style={styles.shareBtn}
                  testID="share-code-button"
                >
                  <Ionicons name="share-social" size={16} color={C.brand} />
                  <Text style={styles.shareText}>{t("shareCode")}</Text>
                </Pressable>
              </View>

              <View style={styles.matchTypeChip}>
                <Ionicons
                  name={room?.match_type === "long" ? "hourglass" : "flash"}
                  size={14}
                  color={C.brand}
                />
                <Text style={styles.matchTypeText}>
                  {room?.match_type === "long" ? t("longMatch") : t("shortMatch")} ·{" "}
                  {t("pointsTarget", { n: room?.match_type === "long" ? 2000 : 1000 })}
                  {" · "}
                  {room?.turn_timer ? t("timerOn") : `${t("timerSetting")}: ${t("timerOff")}`}
                </Text>
              </View>

              <ChunkyButton
                testID="invite-friends-button"
                label={t("inviteFriends")}
                variant="secondary"
                onPress={() => openInvite(null)}
                icon={<Ionicons name="person-add" size={18} color={C.ink} />}
                style={{ marginTop: SP.lg }}
              />

              {isHost ? (
                <ChunkyButton
                  testID="start-game-button"
                  label={t("startGame")}
                  onPress={start}
                  loading={starting}
                  style={{ marginTop: SP.md }}
                />
              ) : (
                <Text style={styles.waitingHost}>{t("waitingHost")}</Text>
              )}
            </View>

            <View style={styles.colRight}>
              <Text style={styles.sectionTitle}>{t("players")}</Text>
              <View style={styles.seatsGrid}>
                {seats.map((p, i) => (
                  <Pressable
                    key={i}
                    style={[styles.seat, !p && styles.seatFree]}
                    testID={`room-seat-${i}`}
                    onPress={() => onSeatPress(i, !!p)}
                    disabled={!!p}
                  >
                    {p ? (
                      <>
                        <Avatar avatarId={p.avatar_id} size={44} />
                        <Text style={styles.seatName} numberOfLines={1}>
                          {p.username}
                          {p.user_id === user?.user_id ? ` (${t("you")})` : ""}
                        </Text>
                        {p.user_id === room?.host_id && (
                          <View style={styles.hostBadge}>
                            <Ionicons name="star" size={10} color={C.gold} />
                            <Text style={styles.hostText}>{t("host")}</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        <View style={styles.emptySeatCircle}>
                          <Ionicons name="hand-left" size={20} color={C.brand} />
                        </View>
                        <Text style={styles.sitHereText}>{t("sitHere")}</Text>
                      </>
                    )}
                    <View
                      style={[
                        styles.teamTag,
                        { backgroundColor: i % 2 === 0 ? C.brand3 : C.bg3 },
                      ]}
                    >
                      <Text style={styles.teamTagText}>
                        {t("team")} {i % 2 === 0 ? "1" : "2"}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.botHint}>{t("botSeatHint")}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title={t("shareCode")}
        message={t("shareRoomMsg", { code: code ?? "", link: roomLink(code ?? "") })}
        url={roomLink(code ?? "")}
      />

      <Modal visible={seatAction !== null} transparent animationType="fade">
        <Pressable style={styles.actionScrim} onPress={() => setSeatAction(null)}>
          <Pressable style={styles.actionCard} onPress={() => {}} testID="seat-action-modal">
            <Text style={styles.actionTitle}>
              {t("team")} {(seatAction ?? 0) % 2 === 0 ? "1" : "2"}
            </Text>
            <ChunkyButton
              testID="seat-sit-button"
              label={t("sitHere")}
              small
              onPress={() => {
                const s = seatAction;
                setSeatAction(null);
                if (s !== null) moveSeat(s);
              }}
            />
            <ChunkyButton
              testID="seat-invite-button"
              label={t("inviteHere")}
              variant="secondary"
              small
              onPress={() => {
                const s = seatAction;
                setSeatAction(null);
                openInvite(s);
              }}
              style={{ marginTop: SP.sm }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={inviteOpen} transparent animationType="slide">
        <Pressable style={styles.modalScrim} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>
              {inviteSeat !== null
                ? t("inviteToSeat", { n: inviteSeat + 1 })
                : t("inviteFriends")}
            </Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {friends.length === 0 && (
                <Text style={styles.noFriends}>{t("noFriendsYet")}</Text>
              )}
              {friends.map((f) => (
                <View key={f.user_id} style={styles.friendRow} testID={`invite-friend-${f.username}`}>
                  <Avatar avatarId={f.avatar_id} size={38} />
                  <Text style={styles.friendName}>{f.username}</Text>
                  {invited.has(f.user_id) ? (
                    <Text style={styles.invitedText}>{t("invited")}</Text>
                  ) : (
                    <Pressable
                      testID={`invite-send-${f.username}`}
                      onPress={() => inviteFriend(f.user_id)}
                      style={styles.inviteBtn}
                    >
                      <Text style={styles.inviteBtnText}>{t("invite")}</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
            <ChunkyButton
              label={t("close")}
              variant="secondary"
              onPress={() => setInviteOpen(false)}
              style={{ marginTop: SP.md }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
  },
  title: { fontFamily: F.display, fontSize: 20, color: C.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP.lg },
  goneText: { fontFamily: F.bold, fontSize: 15, color: C.ink2 },
  scrollContent: {
    padding: SP.lg,
    paddingTop: SP.xs,
    paddingBottom: SP.xl,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  columns: { flexDirection: "row", gap: SP.xl },
  colLeft: { flex: 1 },
  colRight: { flex: 1.2 },
  codeCard: {
    backgroundColor: C.felt,
    borderRadius: R.lg,
    padding: SP.lg,
    alignItems: "center",
  },
  codeLabel: { fontFamily: F.text, fontSize: 13, color: "rgba(255,255,255,0.75)" },
  code: {
    fontFamily: F.display,
    fontSize: 34,
    color: C.cream,
    letterSpacing: 8,
    marginVertical: SP.xs,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.card,
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 36,
  },
  shareText: { fontFamily: F.bold, fontSize: 13, color: C.brand },
  matchTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: C.bg3,
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 34,
    marginTop: SP.md,
    borderWidth: 1,
    borderColor: C.brand3,
  },
  matchTypeText: { fontFamily: F.bold, fontSize: 12.5, color: C.ink },
  sectionTitle: {
    fontFamily: F.display,
    fontSize: 18,
    color: C.ink,
    marginBottom: SP.md,
  },
  seatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP.md,
    justifyContent: "space-between",
  },
  seat: {
    width: "47.5%",
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    padding: SP.md,
  },
  seatFree: {
    borderStyle: "dashed",
    borderColor: C.brand3,
    backgroundColor: "rgba(0,229,122,0.06)",
  },
  sitHereText: { fontFamily: F.bold, fontSize: 12.5, color: C.brand, marginTop: SP.sm },
  seatName: { fontFamily: F.bold, fontSize: 14, color: C.ink, marginTop: SP.sm },
  hostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  hostText: { fontFamily: F.bold, fontSize: 10, color: C.ink3 },
  emptySeatCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  teamTag: {
    borderRadius: R.pill,
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
    marginTop: SP.sm,
  },
  teamTagText: { fontFamily: F.bold, fontSize: 10, color: C.ink2 },
  botHint: {
    fontFamily: F.text,
    fontSize: 12,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.md,
  },
  waitingHost: {
    fontFamily: F.bold,
    fontSize: 14,
    color: C.ink2,
    textAlign: "center",
    marginTop: SP.xl,
  },
  modalScrim: { flex: 1, backgroundColor: C.scrim, justifyContent: "flex-end" },
  actionScrim: {
    flex: 1,
    backgroundColor: C.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: SP.xl,
  },
  actionCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: C.bg,
    borderRadius: R.lg,
    padding: SP.xl,
  },
  actionTitle: {
    fontFamily: F.display,
    fontSize: 18,
    color: C.ink,
    textAlign: "center",
    marginBottom: SP.lg,
  },
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
  modalTitle: { fontFamily: F.display, fontSize: 20, color: C.ink, marginBottom: SP.md },
  noFriends: { fontFamily: F.text, fontSize: 13, color: C.ink3, textAlign: "center", padding: SP.lg },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    paddingVertical: SP.sm,
  },
  friendName: { flex: 1, fontFamily: F.bold, fontSize: 15, color: C.ink },
  inviteBtn: {
    backgroundColor: C.brand,
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 36,
    justifyContent: "center",
  },
  inviteBtnText: { fontFamily: F.display, fontSize: 13, color: C.onBrand },
  invitedText: { fontFamily: F.bold, fontSize: 13, color: C.green },
});
