import React from "react";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BG_HALL, EMBLEMS, HUD_PANEL, ICONS, TILE_HERO } from "@/src/anime/assets";
import NineSlice from "@/src/anime/components/NineSlice";
import {
  FramedPortrait,
  IconTextButton,
  PaintedMenuButton,
  ScreenBackground,
  Segments,
} from "@/src/anime/components/ScreenParts";
import { AnimeTitle } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import { F, SP } from "@/src/theme";

// Visual layer of the profile in the new design. State, saving, sound, design
// switch, language, links and windows stay in app/(tabs)/profile.tsx.

const STAT_ICON: Record<string, ImageSourcePropType> = {
  games: ICONS.statGames,
  wins: EMBLEMS.victory ?? ICONS.ranking,
  losses: EMBLEMS.defeat ?? ICONS.close,
  winrate: ICONS.statWinrate,
  ctaken: ICONS.statContracts,
  cmade: EMBLEMS.made ?? ICONS.done,
  belotes: EMBLEMS.belote ?? ICONS.heart,
  capots: EMBLEMS.capot ?? ICONS.star,
  streak: ICONS.statStreak,
};

/** Painted on / off switch (keeps the role and state of a real switch). */
export function PaintedSwitch({ value, onChange, testID }: { value: boolean; onChange: (v: boolean) => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={8}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <Image source={value ? ICONS.switchOn : ICONS.switchOff} style={styles.switch} resizeMode="contain" fadeDuration={0} />
    </Pressable>
  );
}

function Row({
  icon,
  label,
  right,
  onPress,
  testID,
}: {
  icon: ImageSourcePropType;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const body = (
    <>
      <NineSlice slices={HUD_PANEL} corner={13} />
      <Image source={icon} style={styles.rowIcon} resizeMode="contain" fadeDuration={0} />
      <Text style={styles.rowText} numberOfLines={1}>
        {label}
      </Text>
      {right}
    </>
  );
  return onPress ? (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View testID={testID} style={styles.row}>
      {body}
    </View>
  );
}

interface Props {
  title: string;
  user: { username?: string; email?: string; avatar_id?: string; elo?: number; elo_duo?: number } | null;
  rank: number | null;
  labels: Record<
    | "eloSolo" | "eloDuo" | "rank" | "chooseAvatar" | "statistics" | "eloProgress" | "soundEffects" | "newDesign"
    | "language" | "feedback" | "rateApp" | "privacy" | "logout" | "deleteAccount" | "version",
    string
  >;
  avatars: { id: string; name: string }[];
  showAvatars: boolean;
  showStats: boolean;
  stats: { key: string; label: string; value: string | number }[];
  chart: number[]; // bar heights 0..1
  soundOn: boolean;
  designOn: boolean | null; // null: no design switch in this build
  lang: string;
  languages: { code: string; label: string }[];
  showRate: boolean;
  onToggleAvatars: () => void;
  onPickAvatar: (id: string) => void;
  onToggleStats: () => void;
  onSound: (v: boolean) => void;
  onDesign: (v: boolean) => void;
  onLang: (code: string) => void;
  onFeedback: () => void;
  onRate: () => void;
  onPrivacy: () => void;
  onLogout: () => void;
  onDelete: () => void;
}

export default function AnimeProfile(p: Props) {
  const insets = useSafeAreaInsets();
  const l = p.labels;
  const open = (on: boolean) => (
    <Image
      source={ICONS.chevronDown}
      style={[styles.chevron, on && { transform: [{ rotate: "180deg" }] }]}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
  const out = <Image source={ICONS.external} style={styles.small} resizeMode="contain" fadeDuration={0} />;
  return (
    <>
      <ScreenBackground source={BG_HALL} shade={0.15} />
      <View style={[styles.head, { paddingTop: insets.top + SP.sm }]}>
        <View style={styles.headRow}>
          <PaintedMenuButton />
          <AnimeTitle text={p.title} />
          <View style={{ width: 44 }} />
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + SP.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <NineSlice slices={TILE_HERO} corner={20} />
          <View testID="profile-avatar">
            <FramedPortrait avatarId={p.user?.avatar_id} size={86} />
          </View>
          <View style={styles.who}>
            <Text style={styles.username} testID="profile-username" numberOfLines={1}>
              {p.user?.username}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {p.user?.email}
            </Text>
          </View>
          <View style={styles.values}>
            {(
              [
                ["profile-elo-badge", ICONS.elo, p.user?.elo ?? 1000, l.eloSolo],
                ["profile-elo-duo-badge", ICONS.duo, p.user?.elo_duo ?? 1000, l.eloDuo],
                [undefined, ICONS.podium, `#${p.rank ?? "—"}`, l.rank],
              ] as const
            ).map(([id, icon, value, label], i) => (
              <View key={i} style={styles.value} testID={id}>
                <NineSlice slices={HUD_PANEL} corner={10} />
                <View style={styles.valueRow}>
                  <Image source={icon} style={styles.valueIcon} resizeMode="contain" fadeDuration={0} />
                  <Text style={styles.valueText}>{value}</Text>
                </View>
                <Text style={styles.valueLabel} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Row testID="toggle-avatars" icon={ICONS.avatarMirror} label={l.chooseAvatar} onPress={p.onToggleAvatars} right={open(p.showAvatars)} />
        {p.showAvatars && (
          <Animated.View entering={FadeIn.duration(160)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatars}>
              {p.avatars.map((av) => {
                const on = p.user?.avatar_id === av.id;
                return (
                  <Pressable
                    key={av.id}
                    testID={`avatar-option-${av.id}`}
                    onPress={() => p.onPickAvatar(av.id)}
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
                  >
                    <NineSlice slices={on ? TILE_HERO : HUD_PANEL} corner={12} />
                    <FramedPortrait avatarId={av.id} size={62} />
                    <Text style={[styles.avatarName, on && { color: A.goldLight }]} numberOfLines={1}>
                      {av.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        <Row testID="toggle-stats" icon={ICONS.statistics} label={l.statistics} onPress={p.onToggleStats} right={open(p.showStats)} />
        {p.showStats && (
          <Animated.View entering={FadeIn.duration(160)} style={{ gap: SP.sm }}>
            <View style={styles.stats} testID="stats-grid">
              {p.stats.map((s) => (
                <View key={s.key} style={styles.stat} testID={`stat-${s.key}`}>
                  <NineSlice slices={HUD_PANEL} corner={11} />
                  <Image source={STAT_ICON[s.key] ?? ICONS.statistics} style={styles.statIcon} resizeMode="contain" fadeDuration={0} />
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
            {p.chart.length > 1 && (
              <>
                <Text style={styles.section}>{l.eloProgress}</Text>
                <View style={styles.chart} testID="elo-chart">
                  <NineSlice slices={HUD_PANEL} corner={12} />
                  {p.chart.map((h, i) => (
                    <View key={i} style={styles.chartCol}>
                      <View style={[styles.chartBar, { height: `${h * 100}%` }]} />
                    </View>
                  ))}
                </View>
              </>
            )}
          </Animated.View>
        )}

        <View style={{ height: SP.sm }} />
        <Row
          icon={p.soundOn ? ICONS.soundOn : ICONS.soundOff}
          label={l.soundEffects}
          right={<PaintedSwitch testID="sound-toggle" value={p.soundOn} onChange={p.onSound} />}
        />
        {p.designOn !== null && (
          <Row
            icon={ICONS.design}
            label={l.newDesign}
            right={<PaintedSwitch testID="design-toggle" value={p.designOn} onChange={p.onDesign} />}
          />
        )}

        <View style={styles.langHead}>
          <Image source={ICONS.language} style={styles.rowIcon} resizeMode="contain" fadeDuration={0} />
          <Text style={styles.section}>{l.language}</Text>
        </View>
        <View style={styles.langs}>
          <Segments
            value={p.lang}
            onChange={p.onLang}
            height={40}
            items={p.languages.map((x) => ({ key: x.code, label: x.label, testID: `language-${x.code}-option` }))}
          />
        </View>

        <View style={{ height: SP.sm }} />
        <Row testID="feedback-entry" icon={ICONS.feedback} label={l.feedback} onPress={p.onFeedback} right={<Image source={ICONS.arrow} style={styles.small} resizeMode="contain" fadeDuration={0} />} />
        {p.showRate && <Row testID="rate-app-link" icon={ICONS.star} label={l.rateApp} onPress={p.onRate} right={out} />}
        <Row testID="privacy-policy-link" icon={ICONS.privacy} label={l.privacy} onPress={p.onPrivacy} right={out} />

        <IconTextButton testID="logout-button" icon={ICONS.logout} label={l.logout} onPress={p.onLogout} style={styles.logout} />
        <Pressable testID="delete-account-button" onPress={p.onDelete} style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
          <Image source={ICONS.delete} style={styles.small} resizeMode="contain" fadeDuration={0} />
          <Text style={styles.deleteText}>{l.deleteAccount}</Text>
        </Pressable>
        <Text style={styles.version} testID="app-version-text">
          {l.version}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: "rgba(3,25,19,0.6)", paddingBottom: SP.xs, borderBottomWidth: 1, borderBottomColor: A.goldFaint },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SP.lg, maxWidth: 680, width: "100%", alignSelf: "center" },
  page: { padding: SP.lg, paddingTop: SP.md, gap: 6, maxWidth: 680, width: "100%", alignSelf: "center" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  card: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingHorizontal: 18, paddingVertical: 12, flexWrap: "wrap" },
  who: { flexShrink: 1, minWidth: 120 },
  username: { fontFamily: F.serif, fontSize: 20, color: A.goldLight },
  email: { fontFamily: F.text, fontSize: 12.5, color: A.ivoryDim, marginTop: 2 },
  values: { flex: 1, flexDirection: "row", gap: SP.sm, minWidth: 240 },
  value: { flex: 1, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, minWidth: 0 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  valueIcon: { width: 20, height: 20 },
  valueText: { fontFamily: F.serif, fontSize: 16, color: A.ivory },
  valueLabel: { fontFamily: F.text, fontSize: 10.5, color: A.ivoryDim, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: SP.sm, minHeight: 52, paddingHorizontal: 16 },
  rowIcon: { width: 30, height: 30 },
  rowText: { flex: 1, fontFamily: F.display, fontSize: 15, color: A.ivory },
  chevron: { width: 20, height: 20 },
  small: { width: 22, height: 22 },
  switch: { width: 58, height: 32 },
  avatars: { gap: SP.sm, paddingVertical: 4 },
  avatar: { width: 92, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4 },
  avatarName: { fontFamily: F.bold, fontSize: 10.5, color: A.ivory, marginTop: 2, maxWidth: 84 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm, justifyContent: "space-between" },
  stat: { width: "31.8%", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4 },
  statIcon: { width: 34, height: 34 },
  statValue: { fontFamily: F.serif, fontSize: 20, color: A.goldLight, marginTop: 2 },
  statLabel: { fontFamily: F.text, fontSize: 10.5, color: A.ivoryDim },
  section: { fontFamily: F.serif, fontSize: 17, color: A.goldLight },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 118, padding: 16, gap: 5 },
  chartCol: { flex: 1, height: "100%", justifyContent: "flex-end" },
  chartBar: { width: "100%", borderRadius: 3, backgroundColor: A.gold, borderTopWidth: 2, borderTopColor: A.goldLight },
  langHead: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginTop: SP.md, paddingHorizontal: 4 },
  langs: { alignItems: "center" },
  logout: { marginTop: SP.md, alignSelf: "center", minWidth: 260 },
  delete: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, marginTop: 2 },
  deleteText: { fontFamily: F.display, fontSize: 14, color: "#FF8A80" },
  version: { fontFamily: F.text, fontSize: 12, color: A.ivoryDim, textAlign: "center", marginTop: SP.sm },
});
