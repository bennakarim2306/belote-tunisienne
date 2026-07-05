import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

const MEDAL_COLORS = [C.gold, "#B9B0A2", "#C58A5A"];

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const [players, setPlayers] = useState<LeaderRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

      <FlatList
        data={players}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xl }}
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
                <Text style={[styles.rankText, index < 3 && { color: C.cream }]}>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.cream,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: SP.sm,
    borderLeftWidth: 4,
    borderLeftColor: C.bg3,
  },
  rowMe: { borderLeftColor: C.brand, backgroundColor: "#FBEFE9" },
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
