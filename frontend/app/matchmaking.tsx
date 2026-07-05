import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import ChunkyButton from "@/src/components/ChunkyButton";
import PlayingCard from "@/src/components/PlayingCard";
import { useI18n } from "@/src/i18n";
import { C, F, SP } from "@/src/theme";

function ShufflingCard({ delay }: { delay: number }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [rot]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value + delay}deg` }],
  }));
  return (
    <Animated.View style={[style, { marginHorizontal: -14 }]}>
      <PlayingCard faceDown width={64} />
    </Animated.View>
  );
}

export default function MatchmakingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(0);
  const [found, setFound] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    let tick: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        await api.post("/matchmaking/join", { match_type: type === "long" ? "long" : "short" });
      } catch {
        router.back();
        return;
      }
      tick = setInterval(() => setSeconds((s) => s + 1), 1000);
      poll = setInterval(async () => {
        if (cancelledRef.current) return;
        try {
          const st = await api.get("/matchmaking/status");
          if (st.status === "found" && st.game_id) {
            cancelledRef.current = true;
            setFound(true);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setTimeout(() => {
              router.replace({ pathname: "/game/[id]", params: { id: st.game_id } });
            }, 700);
          }
        } catch {}
      }, 1500);
    })();
    return () => {
      if (poll) clearInterval(poll);
      if (tick) clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = async () => {
    cancelledRef.current = true;
    try {
      await api.del("/matchmaking/leave");
    } catch {}
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="matchmaking-screen">
      <View style={styles.center}>
        <View style={styles.cardsRow}>
          <ShufflingCard delay={-6} />
          <ShufflingCard delay={0} />
          <ShufflingCard delay={6} />
        </View>
        <Text style={styles.title} testID="matchmaking-status-text">
          {found ? t("matchFound") : t("searching")}
        </Text>
        <Text style={styles.timer}>{seconds}s</Text>
        <Text style={styles.hint}>{t("searchingHint")}</Text>
      </View>
      {!found && (
        <ChunkyButton
          testID="cancel-search-button"
          label={t("cancelSearch")}
          variant="secondary"
          onPress={cancel}
          style={{ marginHorizontal: SP.xl, marginBottom: insets.bottom + SP.xl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.feltDark },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardsRow: { flexDirection: "row", marginBottom: SP.xl },
  title: { fontFamily: F.display, fontSize: 24, color: C.cream },
  timer: { fontFamily: F.extra, fontSize: 40, color: C.gold, marginTop: SP.sm },
  hint: {
    fontFamily: F.text,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: SP.md,
    textAlign: "center",
    paddingHorizontal: SP.xl,
  },
});
