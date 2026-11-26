import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAnime } from "@/src/anime/design";
import { AnimeLessonList } from "@/src/anime/screens/AnimeTutorial";
import { api } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP, shadow } from "@/src/theme";
import { LESSONS } from "@/src/tutorial/lessons";
import { getTutorialProgress } from "@/src/tutorial/progress";

export default function TutorialIndexScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const ANIME = useAnime();
  const [progress, setProgress] = useState(0);
  const [starting, setStarting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getTutorialProgress().then(setProgress);
    }, []),
  );

  const total = LESSONS.length;
  const done = Math.min(progress, total);
  const allDone = progress >= total;

  const startFinalGame = async () => {
    if (!allDone || starting) return;
    setStarting(true);
    try {
      const res = await api.post("/tutorial/game", {});
      router.push({ pathname: "/game/[id]", params: { id: res.game_id } });
    } catch {}
    setStarting(false);
  };

  if (ANIME) {
    // visual layer only — same progress, navigation, texts and testIDs
    return (
      <View style={styles.container} testID="tutorial-screen">
        <AnimeLessonList
          title={t("tutorialTitle")}
          progressText={t("tutorialProgress", { done: String(done), total: String(total) })}
          progress={done / total}
          rows={LESSONS.map((lesson, i) => ({
            id: lesson.id,
            number: t("lessonN", { n: String(i + 1) }),
            title: lesson.title[lang],
            state: i < progress ? "done" : i === progress ? "current" : "locked",
          }))}
          final={{
            title: t("finalGameTitle"),
            desc: allDone ? t("finalGameDesc") : t("finalGameLocked"),
            open: allDone,
            starting,
          }}
          onBack={() => router.back()}
          onOpen={(i) => router.push({ pathname: "/tutorial/[step]", params: { step: String(i) } })}
          onFinal={startFinalGame}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="tutorial-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <View style={styles.titleRow}>
          <Pressable
            testID="tutorial-back"
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </Pressable>
          <Text style={styles.title}>{t("tutorialTitle")}</Text>
        </View>
        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(done / total) * 100}%` }]} />
          </View>
          <Text style={styles.progressText} testID="tutorial-progress-text">
            {t("tutorialProgress", { done: String(done), total: String(total) })}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SP.xl, paddingBottom: insets.bottom + SP.xl, maxWidth: 760, width: "100%", alignSelf: "center" }}
        showsVerticalScrollIndicator={false}
      >
        {LESSONS.map((lesson, i) => {
          const completed = i < progress;
          const current = i === progress;
          const locked = i > progress;
          return (
            <Pressable
              key={lesson.id}
              testID={`lesson-row-${i}`}
              disabled={locked}
              onPress={() =>
                router.push({ pathname: "/tutorial/[step]", params: { step: String(i) } })
              }
              style={({ pressed }) => [
                styles.row,
                current && styles.rowCurrent,
                locked && styles.rowLocked,
                pressed && !locked && { opacity: 0.85 },
              ]}
            >
              <View
                style={[
                  styles.rowIcon,
                  completed && { backgroundColor: "rgba(0,229,122,0.14)" },
                  current && { backgroundColor: "rgba(255,190,60,0.15)" },
                ]}
              >
                <Ionicons
                  name={completed ? "checkmark" : locked ? "lock-closed" : (lesson.icon as never)}
                  size={18}
                  color={completed ? C.brand : locked ? C.ink3 : C.gold}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowNum}>{t("lessonN", { n: String(i + 1) })}</Text>
                <Text
                  style={[styles.rowTitle, locked && { color: C.ink3 }]}
                  numberOfLines={1}
                >
                  {lesson.title[lang]}
                </Text>
              </View>
              {!locked && <Ionicons name="chevron-forward" size={18} color={C.ink3} />}
            </Pressable>
          );
        })}

        {/* final teaching game */}
        <Pressable
          testID="final-game-row"
          disabled={!allDone || starting}
          onPress={startFinalGame}
          style={({ pressed }) => [
            styles.finalCard,
            !allDone && styles.rowLocked,
            pressed && allDone && { opacity: 0.9 },
          ]}
        >
          <View style={[styles.rowIcon, styles.finalIcon]}>
            {starting ? (
              <ActivityIndicator color={C.gold} size="small" />
            ) : (
              <Ionicons
                name={allDone ? "trophy" : "lock-closed"}
                size={20}
                color={allDone ? C.gold : C.ink3}
              />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.rowTitle, { fontSize: 16 }, !allDone && { color: C.ink3 }]}>
              {t("finalGameTitle")}
            </Text>
            <Text style={styles.finalDesc}>
              {allDone ? t("finalGameDesc") : t("finalGameLocked")}
            </Text>
          </View>
          {allDone && <Ionicons name="play" size={20} color={C.gold} />}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: SP.xl,
    paddingBottom: SP.md,
    backgroundColor: C.bg2,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: SP.md },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  title: { fontFamily: F.display, fontSize: 22, color: C.ink },
  progressWrap: { marginTop: SP.md },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.bg3,
    overflow: "hidden",
  },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: C.brand },
  progressText: {
    fontFamily: F.bold,
    fontSize: 12,
    color: C.ink2,
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP.md,
    marginBottom: SP.sm,
  },
  rowCurrent: { borderColor: C.gold },
  rowLocked: { opacity: 0.55 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.bg3,
    alignItems: "center",
    justifyContent: "center",
  },
  rowNum: { fontFamily: F.bold, fontSize: 10.5, color: C.ink3 },
  rowTitle: { fontFamily: F.display, fontSize: 15, color: C.ink, marginTop: 1 },
  finalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.gold,
    padding: SP.lg,
    marginTop: SP.md,
    ...shadow,
  },
  finalIcon: { backgroundColor: "rgba(255,190,60,0.15)", width: 44, height: 44, borderRadius: 22 },
  finalDesc: { fontFamily: F.text, fontSize: 12, color: C.ink2, marginTop: 2 },
});
