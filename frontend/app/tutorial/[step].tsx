import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChunkyButton from "@/src/components/ChunkyButton";
import { useAnime } from "@/src/anime/design";
import { AnimeLesson } from "@/src/anime/screens/AnimeTutorial";
import { Lang, useI18n } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";
import { LESSONS } from "@/src/tutorial/lessons";
import { getTutorialProgress, setTutorialProgress } from "@/src/tutorial/progress";

const SPEECH_LANG: Record<Lang, string> = { fr: "fr-FR", en: "en-US", ar: "ar" };

export default function LessonScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { step } = useLocalSearchParams<{ step: string }>();
  const { t, lang } = useI18n();
  const ANIME = useAnime();
  const idx = parseInt(step ?? "0", 10) || 0;
  const lesson = LESSONS[idx];
  const [progress, setProgress] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    getTutorialProgress().then((p) => {
      // sequential lock: lessons beyond the current progress are unreachable
      if (!lesson || idx > p) {
        router.replace("/tutorial");
        return;
      }
      setProgress(p);
    });
    return () => {
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  if (!lesson || progress === null) return <View style={styles.container} />;

  const isArabic = lang === "ar";
  const textAlignStyle = { textAlign: isArabic ? ("right" as const) : ("left" as const) };

  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    const fullText = [
      lesson.title[lang],
      ...lesson.paragraphs.map((p) => p[lang]),
      ...(lesson.tip ? [t("tipLabel") + ". " + lesson.tip[lang]] : []),
    ].join(". ");
    setSpeaking(true);
    Speech.speak(fullText, {
      language: SPEECH_LANG[lang],
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const validate = async () => {
    Speech.stop();
    if (idx === progress) {
      await setTutorialProgress(idx + 1);
    }
    if (idx + 1 < LESSONS.length && idx + 1 <= Math.max(progress, idx + 1)) {
      // continue straight to the next lesson
      router.replace({ pathname: "/tutorial/[step]", params: { step: String(idx + 1) } });
    } else {
      router.back();
    }
  };

  if (ANIME) {
    // visual layer only — same speech, progress, navigation, texts and testIDs
    return (
      <View style={styles.container} testID="lesson-screen">
        <AnimeLesson
          lessonId={lesson.id}
          stepLabel={`${t("lessonN", { n: String(idx + 1) })} / ${LESSONS.length}`}
          title={lesson.title[lang]}
          paragraphs={lesson.paragraphs.map((p) => p[lang])}
          tip={lesson.tip ? { label: t("tipLabel"), text: lesson.tip[lang] } : undefined}
          textAlign={textAlignStyle}
          speaking={speaking}
          listenLabel={t("listen")}
          stopLabel={t("stopAudio")}
          okLabel={t("gotIt")}
          onBack={() => {
            Speech.stop();
            router.back();
          }}
          onListen={toggleSpeech}
          onOk={validate}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="lesson-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <Pressable
          testID="lesson-back"
          onPress={() => {
            Speech.stop();
            router.back();
          }}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </Pressable>
        <Text style={styles.stepLabel}>
          {t("lessonN", { n: String(idx + 1) })} / {LESSONS.length}
        </Text>
        <Pressable
          testID="listen-button"
          onPress={toggleSpeech}
          style={[styles.listenBtn, speaking && styles.listenBtnActive]}
          hitSlop={8}
        >
          <Ionicons
            name={speaking ? "stop" : "volume-high"}
            size={16}
            color={speaking ? C.onBrand : C.brand}
          />
          <Text style={[styles.listenText, speaking && { color: C.onBrand }]}>
            {speaking ? t("stopAudio") : t("listen")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SP.xl, paddingBottom: SP.xl, maxWidth: 760, width: "100%", alignSelf: "center" }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={lesson.icon as never} size={34} color={C.gold} />
        </View>
        <Text style={[styles.title, { textAlign: "center" }]} testID="lesson-title">
          {lesson.title[lang]}
        </Text>
        {lesson.paragraphs.map((p, i) => (
          <View key={i} style={styles.paraCard}>
            <Text style={[styles.paraText, textAlignStyle]}>{p[lang]}</Text>
          </View>
        ))}
        {lesson.tip && (
          <View style={styles.tipCard} testID="lesson-tip">
            <View style={styles.tipHead}>
              <Ionicons name="bulb" size={15} color={C.gold} />
              <Text style={styles.tipLabel}>{t("tipLabel")}</Text>
            </View>
            <Text style={[styles.tipText, textAlignStyle]}>{lesson.tip[lang]}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SP.md }]}>
        <ChunkyButton
          testID="lesson-ok-button"
          label={t("gotIt")}
          onPress={validate}
          style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP.xl,
    paddingBottom: SP.md,
    backgroundColor: C.bg2,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
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
  stepLabel: { fontFamily: F.bold, fontSize: 13, color: C.ink2 },
  listenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,229,122,0.10)",
    borderWidth: 1,
    borderColor: C.brand3,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 34,
  },
  listenBtnActive: { backgroundColor: C.brand, borderColor: C.brand },
  listenText: { fontFamily: F.bold, fontSize: 12.5, color: C.brand },
  iconWrap: {
    alignSelf: "center",
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255,190,60,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP.md,
  },
  title: { fontFamily: F.display, fontSize: 22, color: C.ink, marginBottom: SP.lg },
  paraCard: {
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP.lg,
    marginBottom: SP.sm,
  },
  paraText: { fontFamily: F.text, fontSize: 14.5, color: C.ink, lineHeight: 23 },
  tipCard: {
    backgroundColor: "rgba(255,190,60,0.08)",
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: "rgba(255,190,60,0.35)",
    padding: SP.lg,
    marginTop: SP.xs,
  },
  tipHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  tipLabel: { fontFamily: F.extra, fontSize: 12, color: C.gold },
  tipText: { fontFamily: F.text, fontSize: 13.5, color: C.ink2, lineHeight: 21 },
  footer: {
    paddingHorizontal: SP.xl,
    paddingTop: SP.md,
    backgroundColor: C.bg2,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
