import React from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BG_HALL, EMBLEMS, HUD_PANEL, ICONS, PROGRESS_TRACK, TILE_HERO } from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import NineSlice from "@/src/anime/components/NineSlice";
import { IconTextButton, ScreenBackground, ScreenHeader } from "@/src/anime/components/ScreenParts";
import { GameButton } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import { F, SP } from "@/src/theme";

// Visual layer of the tutorial in the new design (lesson list + lesson page).
// Progress, speech and navigation stay in app/tutorial/; testIDs are the same.

/** Painted picture of each lesson (by lesson id). */
export const LESSON_ICON: Record<string, ImageSourcePropType> = {
  welcome: ICONS.learn,
  trump: ICONS.lessonTrump,
  values: ICONS.lessonValues,
  deal: ICONS.lessonDeal,
  bidding: ICONS.lessonBidding,
  contre: EMBLEMS.contre ?? ICONS.lessonBidding,
  capot: EMBLEMS.capot ?? ICONS.lessonBidding,
  follow: ICONS.lessonFollow,
  cut: ICONS.lessonCut,
  tfaskira: ICONS.lessonTfaskira,
  belote: EMBLEMS.belote ?? ICONS.lessonValues,
  scoring: ICONS.lessonScoring,
  "tactics-bids": ICONS.lessonReadBids,
  "tactics-play": ICONS.lessonPlayWell,
};
const iconOf = (id: string) => LESSON_ICON[id] ?? ICONS.learn;

/** Painted progress bar; the gold fill stays between the two ornaments. */
function Progress({ value }: { value: number }) {
  return (
    <View style={styles.track}>
      <HSlice slices={PROGRESS_TRACK} />
      <View style={styles.fillArea}>
        <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }]} />
      </View>
    </View>
  );
}

interface Row {
  id: string;
  number: string;
  title: string;
  state: "done" | "current" | "locked";
}

export function AnimeLessonList(p: {
  title: string;
  progressText: string;
  progress: number;
  rows: Row[];
  final: { title: string; desc: string; open: boolean; starting: boolean };
  onBack: () => void;
  onOpen: (i: number) => void;
  onFinal: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <ScreenBackground source={BG_HALL} shade={0.15} />
      <View style={[styles.head, { paddingTop: insets.top + SP.sm }]}>
        <ScreenHeader title={p.title} onBack={p.onBack} backTestID="tutorial-back" />
        <View style={styles.progressRow}>
          <Progress value={p.progress} />
          <Text style={styles.progressText} testID="tutorial-progress-text">
            {p.progressText}
          </Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SP.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {p.rows.map((r, i) => {
          const locked = r.state === "locked";
          return (
            <Pressable
              key={r.id}
              testID={`lesson-row-${i}`}
              disabled={locked}
              onPress={() => p.onOpen(i)}
              style={({ pressed }) => [styles.row, locked && styles.locked, pressed && !locked && styles.pressed]}
            >
              <NineSlice slices={r.state === "current" ? TILE_HERO : HUD_PANEL} corner={r.state === "current" ? 18 : 13} />
              <View style={styles.rowIconBox}>
                <Image
                  source={locked ? ICONS.lock : iconOf(r.id)}
                  style={locked ? styles.lockIcon : styles.rowIcon}
                  resizeMode="contain"
                  fadeDuration={0}
                />
                {r.state === "done" && (
                  <Image source={ICONS.done} style={styles.doneBadge} resizeMode="contain" fadeDuration={0} />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowNum}>{r.number}</Text>
                <Text style={[styles.rowTitle, locked && { color: A.ivoryDim }]} numberOfLines={1}>
                  {r.title}
                </Text>
              </View>
              {!locked && <Image source={ICONS.arrow} style={styles.go} resizeMode="contain" fadeDuration={0} />}
            </Pressable>
          );
        })}

        <Pressable
          testID="final-game-row"
          disabled={!p.final.open || p.final.starting}
          onPress={p.onFinal}
          style={({ pressed }) => [styles.final, !p.final.open && styles.locked, pressed && p.final.open && styles.pressed]}
        >
          <NineSlice slices={TILE_HERO} corner={20} />
          <View style={styles.finalIconBox}>
            {p.final.starting ? (
              <ActivityIndicator color={A.goldLight} />
            ) : (
              <Image
                source={p.final.open ? (EMBLEMS.victory ?? ICONS.ranking) : ICONS.lock}
                style={p.final.open ? styles.finalIcon : styles.lockIcon}
                resizeMode="contain"
                fadeDuration={0}
              />
            )}
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.finalTitle, !p.final.open && { color: A.ivoryDim }]}>{p.final.title}</Text>
            <Text style={styles.finalDesc}>{p.final.desc}</Text>
          </View>
          {p.final.open && <Image source={ICONS.resume} style={styles.play} resizeMode="contain" fadeDuration={0} />}
        </Pressable>
      </ScrollView>
    </>
  );
}

export function AnimeLesson(p: {
  lessonId: string;
  stepLabel: string;
  title: string;
  paragraphs: string[];
  tip?: { label: string; text: string };
  textAlign: TextStyle;
  speaking: boolean;
  listenLabel: string;
  stopLabel: string;
  okLabel: string;
  onBack: () => void;
  onListen: () => void;
  onOk: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <ScreenBackground source={BG_HALL} shade={0.15} />
      <View style={[styles.lessonHead, { paddingTop: insets.top + SP.sm }]}>
        <ScreenHeader title={p.stepLabel} onBack={p.onBack} backTestID="lesson-back" />
        <IconTextButton
          testID="listen-button"
          icon={p.speaking ? ICONS.stop : ICONS.speaker}
          label={p.speaking ? p.stopLabel : p.listenLabel}
          onPress={p.onListen}
          variant={p.speaking ? "green" : "dark"}
          style={[styles.listen, { top: insets.top + SP.sm + 1 }]}
        />
      </View>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Image source={iconOf(p.lessonId)} style={styles.lessonIcon} resizeMode="contain" fadeDuration={0} />
        <Text style={styles.lessonTitle} testID="lesson-title">
          {p.title}
        </Text>
        {p.paragraphs.map((t, i) => (
          <View key={i} style={styles.para}>
            <NineSlice slices={HUD_PANEL} corner={13} />
            <Text style={[styles.paraText, p.textAlign]}>{t}</Text>
          </View>
        ))}
        {p.tip && (
          <View style={styles.tip} testID="lesson-tip">
            <NineSlice slices={TILE_HERO} corner={16} />
            <View style={styles.tipHead}>
              <Image source={ICONS.tip} style={styles.tipIcon} resizeMode="contain" fadeDuration={0} />
              <Text style={styles.tipLabel}>{p.tip.label}</Text>
            </View>
            <Text style={[styles.tipText, p.textAlign]}>{p.tip.text}</Text>
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + SP.sm }]}>
        <GameButton testID="lesson-ok-button" label={p.okLabel} onPress={p.onOk} style={styles.ok} />
      </View>
    </>
  );
}


const styles = StyleSheet.create({
  head: { backgroundColor: "rgba(3,25,19,0.55)", paddingBottom: SP.sm, borderBottomWidth: 1, borderBottomColor: A.goldFaint },
  progressRow: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingHorizontal: SP.xl, maxWidth: 640, width: "100%", alignSelf: "center" },
  track: { flex: 1, height: 20 },
  fillArea: { position: "absolute", left: 21, right: 21, top: 4, bottom: 4, overflow: "hidden", borderRadius: 3 },
  fill: { height: "100%", backgroundColor: A.gold, borderRadius: 3, borderTopWidth: 2, borderTopColor: A.goldLight },
  progressText: { fontFamily: F.bold, fontSize: 12, color: A.goldLight },
  list: { padding: SP.lg, paddingTop: SP.md, maxWidth: 640, width: "100%", alignSelf: "center", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: SP.md, minHeight: 58, paddingHorizontal: 14, paddingVertical: 6 },
  locked: { opacity: 0.55 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  rowIconBox: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  rowIcon: { width: 42, height: 42 },
  lockIcon: { width: 32, height: 32 },
  doneBadge: { position: "absolute", right: -6, bottom: -4, width: 22, height: 22 },
  rowText: { flex: 1, minWidth: 0 },
  rowNum: { fontFamily: F.bold, fontSize: 10.5, color: A.goldLight },
  rowTitle: { fontFamily: F.serif, fontSize: 15, color: A.ivory },
  go: { width: 22, height: 22 },
  final: { flexDirection: "row", alignItems: "center", gap: SP.md, minHeight: 74, paddingHorizontal: 18, paddingVertical: 10, marginTop: SP.sm },
  finalIconBox: { width: 54, height: 54, alignItems: "center", justifyContent: "center" },
  finalIcon: { width: 54, height: 54 },
  finalTitle: { fontFamily: F.serif, fontSize: 16, color: A.goldLight },
  finalDesc: { fontFamily: F.text, fontSize: 12, color: A.ivoryDim, marginTop: 2 },
  play: { width: 28, height: 28 },
  lessonHead: { backgroundColor: "rgba(3,25,19,0.55)", paddingBottom: SP.xs, borderBottomWidth: 1, borderBottomColor: A.goldFaint },
  listen: { position: "absolute", right: SP.lg, height: 40, paddingHorizontal: 22 },
  page: { padding: SP.xl, paddingTop: SP.md, maxWidth: 640, width: "100%", alignSelf: "center", gap: SP.sm },
  lessonIcon: { width: 76, height: 76, alignSelf: "center" },
  lessonTitle: { fontFamily: F.serif, fontSize: 22, color: A.goldLight, textAlign: "center", marginBottom: SP.xs },
  para: { paddingHorizontal: SP.lg + 4, paddingVertical: SP.md + 2 },
  paraText: { fontFamily: F.text, fontSize: 14.5, lineHeight: 23, color: A.ivory },
  tip: { paddingHorizontal: SP.lg + 6, paddingVertical: SP.md + 4 },
  tipHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  tipIcon: { width: 24, height: 24 },
  tipLabel: { fontFamily: F.extra, fontSize: 12.5, color: A.goldLight },
  tipText: { fontFamily: F.text, fontSize: 13.5, lineHeight: 21, color: A.ivory },
  footer: { paddingHorizontal: SP.xl, paddingTop: SP.sm, backgroundColor: "rgba(3,25,19,0.6)", borderTopWidth: 1, borderTopColor: A.goldFaint },
  ok: { alignSelf: "center", minWidth: 280 },
});
