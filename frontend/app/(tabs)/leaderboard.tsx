import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

interface LeaderRow {
  user_id: string;
  username: string;
  avatar_id: string;
  elo: number;
  games_played: number;
  wins: number;
}

const MEDAL_COLORS = [C.gold, "#C9C2B6", "#C86A2E"];

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const [players, setPlayers] = useState<LeaderRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // custom slim scroll indicator: visible only while scrolling, fades out after
  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(1);
  const viewH = useSharedValue(1);
  const indicatorOn = useSharedValue(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
    indicatorOn.value = withTiming(1, { duration: 120 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      indicatorOn.value = withTiming(0, { duration: 450 });
    }, 700);
  };

  const indicatorStyle = useAnimatedStyle(() => {
    const trackH = viewH.value;
    const ratio = Math.min(trackH / Math.max(contentH.value, 1), 1);
    const barH = Math.max(trackH * ratio, 40);
    const maxScroll = Math.max(contentH.value - trackH, 1);
    const progress = Math.min(Math.max(scrollY.value / maxScroll, 0), 1);
    return {
      opacity: ratio < 1 ? indicatorOn.value : 0,
      height: barH,
      transform: [{ translateY: progress * (trackH - barH) }],
    };
  });

  const load = useCallback(async () => {
    try {
      const res = await api.get("/leaderboard");
      setPlayers(res.players);
      setMyRank(res.my_rank);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container} testID="leaderboard-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <Text style={styles.title}>{t("ranking")}</Text>
        <View style={styles.myRankCard} testID="my-rank-card">
          <Avatar avatarId={user?.avatar_id} size={44} ringColor={C.gold} />
          <View style={{ flex: 1, marginHorizontal: SP.md }}>
            <Text style={styles.myRankLabel}>{t("yourRank")}</Text>
            <Text style={styles.myRankValue}>
              #{myRank ?? "—"} · {user?.elo ?? 1000} {t("elo")}
            </Text>
          </View>
          <Ionicons name="trophy" size={28} color={C.gold} />
        </View>
      </View>

      <View style={styles.listWrap}>
        <FlatList
          data={players}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xl }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={(_w, h) => {
            contentH.value = h;
          }}
          onLayout={(e) => {
            viewH.value = e.nativeEvent.layout.height;
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{t("noPlayers")}</Text>
          }
          renderItem={({ item, index }) => {
            const isMe = item.user_id === user?.user_id;
            return (
              <View
                testID={`leaderboard-row-${index + 1}`}
                style={[styles.row, isMe && styles.rowMe]}
              >
                <View
                  style={[
                    styles.rankBadge,
                    index < 3 && { backgroundColor: MEDAL_COLORS[index] },
                  ]}
                >
                  <Text style={[styles.rankText, index < 3 && { color: "#1A1200" }]}>
                    {index + 1}
                  </Text>
                </View>
                <Avatar avatarId={item.avatar_id} size={38} />
                <View style={{ flex: 1, marginLeft: SP.md }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.username}
                    {isMe ? ` · ${t("you")}` : ""}
                  </Text>
                  <Text style={styles.games}>
                    {t("gamesShort", { n: item.games_played })}
                  </Text>
                </View>
                <Text style={styles.elo}>{item.elo}</Text>
              </View>
            );
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.scrollIndicator, indicatorStyle]}
          testID="custom-scroll-indicator"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SP.lg,
    paddingBottom: SP.lg,
  },
  title: { fontFamily: F.display, fontSize: 26, color: C.ink, marginBottom: SP.md },
  myRankCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.bg2,
    borderRadius: R.md,
    padding: SP.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  myRankLabel: { fontFamily: F.text, fontSize: 12, color: C.ink3 },
  myRankValue: { fontFamily: F.display, fontSize: 18, color: C.ink },
  listWrap: { flex: 1 },
  scrollIndicator: {
    position: "absolute",
    right: 3,
    top: 0,
    width: 4,
    borderRadius: 2,
    backgroundColor: C.brand,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: SP.sm,
    borderLeftWidth: 4,
    borderLeftColor: C.bg3,
  },
  rowMe: { borderLeftColor: C.brand, backgroundColor: "rgba(0,229,122,0.08)" },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.bg2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SP.md,
  },
  rankText: { fontFamily: F.extra, fontSize: 14, color: C.ink2 },
  name: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  games: { fontFamily: F.text, fontSize: 12, color: C.ink3 },
  elo: { fontFamily: F.extra, fontSize: 18, color: C.brand },
  empty: {
    fontFamily: F.text,
    fontSize: 14,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.xxl,
  },
});
