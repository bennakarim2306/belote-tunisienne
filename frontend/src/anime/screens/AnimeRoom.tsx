import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BG_SALON, BTN_GREEN, BTN_RED, HUD_PANEL, ICONS, MODAL_FRAME } from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import NineSlice from "@/src/anime/components/NineSlice";
import {
  FramedPortrait,
  IconTextButton,
  ScreenBackground,
  ScreenHeader,
  ValuePill,
} from "@/src/anime/components/ScreenParts";
import { GameButton } from "@/src/anime/game/AnimeUI";
import Emblem from "@/src/anime/game/Emblem";
import { A } from "@/src/anime/tokens";
import { F, SP } from "@/src/theme";

// Visual layer of the private room in the new design. State, polling, handlers
// and windows stay in app/room/[code].tsx; testIDs are the same.

interface Seat {
  user_id: string;
  username: string;
  avatar_id: string;
}

interface Props {
  gone: boolean;
  code?: string;
  seats: (Seat | null)[];
  hostId?: string;
  myId?: string;
  isHost: boolean;
  starting: boolean;
  longMatch: boolean;
  matchText: string;
  labels: {
    title: string;
    roomCode: string;
    share: string;
    invite: string;
    start: string;
    waitingHost: string;
    players: string;
    you: string;
    host: string;
    sitHere: string;
    team: string;
    botHint: string;
    gone: string;
    backHome: string;
  };
  onLeave: () => void;
  onShare: () => void;
  onInvite: () => void;
  onStart: () => void;
  onSeat: (i: number, occupied: boolean) => void;
  onBackHome: () => void;
}

export default function AnimeRoom(p: Props) {
  const insets = useSafeAreaInsets();
  const narrow = useWindowDimensions().width < 720;
  const face = narrow ? 54 : 64;
  const l = p.labels;
  return (
    <>
      <ScreenBackground source={BG_SALON} shade={p.gone ? 0.2 : 0.42} />
      <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <ScreenHeader title={l.title} onBack={p.onLeave} backTestID="room-leave-button" />
      </View>
      {p.gone ? (
        <View style={styles.gone}>
          <Emblem kind="roomClosed" size={130} />
          <Text style={styles.goneText}>{l.gone}</Text>
          <GameButton label={l.backHome} onPress={p.onBackHome} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SP.md }]}>
          <View style={styles.columns}>
            <View style={styles.left}>
              <View style={[styles.codeCard, narrow && { paddingHorizontal: 12 }]}>
                <NineSlice slices={MODAL_FRAME} corner={24} />
                <Text style={styles.codeLabel}>{l.roomCode}</Text>
                <Text style={styles.code} testID="room-code-text" numberOfLines={1}>
                  {p.code}
                </Text>
                <IconTextButton
                  testID="share-code-button"
                  icon={ICONS.share}
                  label={l.share}
                  onPress={p.onShare}
                  style={[styles.shareBtn, narrow && { paddingHorizontal: 18 }]}
                />
              </View>
              <View style={styles.typePill}>
                <ValuePill icon={p.longMatch ? ICONS.normal : ICONS.quick} text={p.matchText} />
              </View>
              <IconTextButton
                testID="invite-friends-button"
                icon={ICONS.addFriend}
                label={l.invite}
                onPress={p.onInvite}
                style={styles.wide}
              />
              {p.isHost ? (
                <GameButton
                  testID="start-game-button"
                  label={l.start}
                  onPress={p.onStart}
                  loading={p.starting}
                  style={styles.start}
                />
              ) : (
                <View style={styles.typePill}>
                  <ValuePill icon={ICONS.hourglass} text={l.waitingHost} />
                </View>
              )}
            </View>

            <View style={[styles.right, narrow && { flex: 1.2 }]}>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>{l.players}</Text>
                <Text style={styles.botHint} numberOfLines={1}>
                  {l.botHint}
                </Text>
              </View>
              <View style={styles.grid}>
                {p.seats.map((s, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [styles.seat, pressed && !s && { opacity: 0.8 }]}
                    testID={`room-seat-${i}`}
                    onPress={() => p.onSeat(i, !!s)}
                    disabled={!!s}
                  >
                    <NineSlice slices={HUD_PANEL} corner={14} />
                    {s ? (
                      <FramedPortrait avatarId={s.avatar_id} size={face} />
                    ) : (
                      <View style={[styles.sitBox, { width: face, height: face }]}>
                        <Image source={ICONS.sitHere} style={styles.sitIcon} resizeMode="contain" fadeDuration={0} />
                      </View>
                    )}
                    <View style={styles.seatText}>
                      {s ? (
                        <Text style={styles.seatName} numberOfLines={1}>
                          {s.username}
                          {s.user_id === p.myId ? ` (${l.you})` : ""}
                        </Text>
                      ) : (
                        <Text style={styles.sitText} numberOfLines={1}>
                          {l.sitHere}
                        </Text>
                      )}
                      <View style={styles.tags}>
                        <View style={styles.team}>
                          <HSlice slices={i % 2 === 0 ? BTN_RED : BTN_GREEN} />
                          <Text style={styles.teamText} numberOfLines={1}>
                            {l.team} {i % 2 === 0 ? "1" : "2"}
                          </Text>
                        </View>
                        {s && s.user_id === p.hostId && (
                          <View style={styles.host}>
                            <Image source={ICONS.star} style={styles.hostIcon} resizeMode="contain" fadeDuration={0} />
                            <Text style={styles.hostText} numberOfLines={1}>
                              {l.host}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  gone: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP.md },
  goneText: { fontFamily: F.serif, fontSize: 19, color: A.goldLight },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: SP.lg, maxWidth: 800, width: "100%", alignSelf: "center" },
  columns: { flexDirection: "row", gap: SP.lg, alignItems: "center" },
  left: { flex: 1 },
  right: { flex: 1.35 },
  codeCard: { alignItems: "center", paddingVertical: 14, paddingHorizontal: 24 },
  codeLabel: { fontFamily: F.text, fontSize: 12, color: A.ivoryDim },
  code: { fontFamily: F.display, fontSize: 28, lineHeight: 36, color: A.goldLight, letterSpacing: 6 },
  shareBtn: { height: 36, paddingHorizontal: 24, maxWidth: "100%" },
  typePill: { alignItems: "center", marginTop: SP.sm },
  wide: { marginTop: SP.sm },
  start: { marginTop: SP.sm, alignSelf: "stretch" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SP.md, marginBottom: 6, paddingHorizontal: 4 },
  section: { fontFamily: F.serif, fontSize: 16, color: A.goldLight },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  seat: { width: "49%", minHeight: 88, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  sitBox: { alignItems: "center", justifyContent: "center" },
  sitIcon: { width: "82%", height: "82%" },
  seatText: { flex: 1, minWidth: 0, marginLeft: 6 },
  seatName: { fontFamily: F.bold, fontSize: 13, color: A.ivory },
  sitText: { fontFamily: F.bold, fontSize: 12.5, color: A.goldLight },
  tags: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, flexWrap: "wrap" },
  team: { height: 22, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  teamText: { fontFamily: F.bold, fontSize: 10, color: A.ivory },
  host: { flexDirection: "row", alignItems: "center", gap: 2 },
  hostIcon: { width: 16, height: 16 },
  hostText: { fontFamily: F.bold, fontSize: 10.5, color: A.goldLight },
  botHint: { fontFamily: F.text, fontSize: 11.5, color: A.ivoryDim, flexShrink: 1 },
});
