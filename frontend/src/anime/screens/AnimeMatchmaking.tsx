import React from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BG_DUEL, ICONS, NAMEPLATE } from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import {
  EmptyPortrait,
  FramedPortrait,
  IconTextButton,
  ScreenBackground,
  TurningCard,
  ValuePill,
} from "@/src/anime/components/ScreenParts";
import { AnimeTitle, GameButton } from "@/src/anime/game/AnimeUI";
import Emblem from "@/src/anime/game/Emblem";
import { A } from "@/src/anime/tokens";
import { F, SP } from "@/src/theme";

// Visual layer of the matchmaking screen in the new design. All state, polling
// and handlers stay in app/matchmaking.tsx; testIDs are the same.

interface SlotPlayer {
  username: string;
  avatar_id?: string;
  elo: number | string;
}

interface Props {
  endMsg: string | null;
  title: string;
  count: string;
  found: boolean;
  me: SlotPlayer;
  partner: SlotPlayer | null;
  partnerPending: boolean;
  players: SlotPlayer[];
  emptySlots: number;
  waitingLabel: string;
  confirm: { me: boolean; waitText: string; acceptLabel: string } | null;
  warnMsg: string | null;
  eloRange: string | null;
  duoOnly: string | null;
  seconds: number;
  hint: string;
  inviteLabel: string;
  cancelLabel: string;
  onAccept: () => void;
  onInvite: () => void;
  onCancel: () => void;
}

export default function AnimeMatchmaking(p: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const frame = Math.round(Math.min(92, height * 0.225, width * 0.125));

  if (p.endMsg) {
    return (
      <View style={styles.container} testID="matchmaking-screen">
        <ScreenBackground source={BG_DUEL} />
        <View style={styles.end}>
          <Emblem kind="declined" size={Math.min(150, height * 0.36)} />
          <Text style={styles.endText} testID="duo-end-message">
            {p.endMsg}
          </Text>
        </View>
      </View>
    );
  }

  const nameRow = (name: string, elo?: number | string) => (
    <>
      <View style={styles.plate}>
        <HSlice slices={NAMEPLATE} />
        <Text style={styles.plateText} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={styles.elo}>{elo ?? " "}</Text>
    </>
  );

  const slots: React.ReactNode[] = [
    <View style={styles.slot} key="me">
      <FramedPortrait avatarId={p.me.avatar_id} size={frame} />
      {nameRow(p.me.username, p.me.elo)}
    </View>,
  ];
  if (p.partner) {
    slots.push(
      <View style={styles.slot} key="partner" testID="matchmaking-duo-partner">
        <View>
          <FramedPortrait avatarId={p.partner.avatar_id} size={frame} dim={p.partnerPending} />
          <Image
            source={p.partnerPending ? ICONS.hourglass : ICONS.duo}
            style={styles.badge}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>
        {nameRow(p.partner.username, p.partner.elo)}
      </View>,
    );
  }
  p.players.forEach((pl) =>
    slots.push(
      <Animated.View key={pl.username} entering={FadeIn.duration(260)}>
        <View style={styles.slot} testID={`matchmaking-player-${pl.username}`}>
          <FramedPortrait avatarId={pl.avatar_id} size={frame} />
          {nameRow(pl.username, pl.elo)}
        </View>
      </Animated.View>,
    ),
  );
  for (let i = 0; i < p.emptySlots; i++) {
    slots.push(
      <View style={styles.slot} key={`empty-${i}`}>
        <EmptyPortrait size={frame} />
        {nameRow(p.waitingLabel)}
      </View>,
    );
  }
  const half = Math.ceil(slots.length / 2);

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + SP.md, paddingBottom: insets.bottom + SP.md }]}
      testID="matchmaking-screen"
    >
      <ScreenBackground source={BG_DUEL} />
      <AnimeTitle text={p.title} testID="matchmaking-status-text" />

      <View style={styles.middle}>
        <View style={styles.slots} testID="matchmaking-slots">
          {slots.slice(0, half)}
          <View style={styles.centre}>
            {p.found ? (
              <Animated.View entering={ZoomIn.duration(260)}>
                <Emblem kind="matchFound" size={frame * 1.15} />
              </Animated.View>
            ) : (
              <TurningCard height={frame * 0.82} />
            )}
          </View>
          {slots.slice(half)}
        </View>

        {p.confirm && !p.found && (
          <View style={styles.confirm} testID="matchmaking-confirm-box">
            {p.confirm.me ? (
              <Text style={styles.strong} testID="matchmaking-confirm-wait">
                {p.confirm.waitText}
              </Text>
            ) : (
              <GameButton testID="matchmaking-accept-button" label={p.confirm.acceptLabel} onPress={p.onAccept} />
            )}
          </View>
        )}
        {p.warnMsg && (
          <Text style={styles.warn} testID="matchmaking-warn">
            {p.warnMsg}
          </Text>
        )}

        <View style={styles.pills}>
          <ValuePill icon={ICONS.friends} text={p.count} textTestID="matchmaking-players-count" />
          {p.eloRange && <ValuePill icon={ICONS.elo} text={p.eloRange} testID="matchmaking-elo-range" />}
          {p.duoOnly && <ValuePill icon={ICONS.duo} text={p.duoOnly} testID="duo-mode-chip" />}
          <ValuePill icon={ICONS.timer} text={`${p.seconds}s`} />
        </View>
        <Text style={styles.hint} numberOfLines={2}>
          {p.hint}
        </Text>
      </View>

      <View style={styles.bottom}>
        {!p.found && (
          <>
            <IconTextButton
              testID="invite-friends-button"
              icon={ICONS.addFriend}
              label={p.inviteLabel}
              onPress={p.onInvite}
              variant="green"
            />
            <IconTextButton
              testID="cancel-search-button"
              icon={ICONS.close}
              label={p.cancelLabel}
              onPress={p.onCancel}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: A.emeraldInk },
  middle: { flex: 1, alignItems: "center", justifyContent: "space-evenly", paddingHorizontal: SP.md },
  slots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  slot: { width: 100, alignItems: "center" },
  centre: { width: 108, alignItems: "center", justifyContent: "center" },
  plate: { width: 98, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginTop: -4 },
  plateText: { fontFamily: F.bold, fontSize: 11, color: A.ivory, maxWidth: 74 },
  elo: { fontFamily: F.serif, fontSize: 12, lineHeight: 16, color: A.goldLight },
  badge: { position: "absolute", right: -2, bottom: -2, width: 30, height: 30 },
  confirm: { alignItems: "center", justifyContent: "center", minHeight: 42 },
  strong: { fontFamily: F.bold, fontSize: 14, color: A.goldLight },
  warn: { fontFamily: F.bold, fontSize: 12, color: A.goldLight, textAlign: "center", maxWidth: 440 },
  pills: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: SP.sm, rowGap: 4, maxWidth: "100%" },
  hint: { fontFamily: F.text, fontSize: 11.5, color: A.ivoryDim, textAlign: "center", maxWidth: 460 },
  bottom: { flexDirection: "row", justifyContent: "center", gap: SP.md, minHeight: 42 },
  end: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP.md },
  endText: { fontFamily: F.serif, fontSize: 20, color: A.goldLight, textAlign: "center", paddingHorizontal: SP.xl },
});
