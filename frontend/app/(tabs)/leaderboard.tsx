import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
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

import { BG_HALL, EMPTY_RANKING, HUD_PANEL, ICONS, TILE_HERO } from "@/src/anime/assets";
import NineSlice from "@/src/anime/components/NineSlice";
import { FramedPortrait, PaintedMenuButton, ScreenBackground, Segments } from "@/src/anime/components/ScreenParts";
import { useAnime } from "@/src/anime/design";
import { AnimeTitle } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import { api } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import MenuButton from "@/src/components/MenuButton";
import { useAuth } from "@/src/context/AuthContext";
import { useCollapsibleHeader } from "@/src/hooks/use-collapsible-header";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

interface LeaderRow {
  user_id: string;
  username: string;
  avatar_id: string;
  elo: number;
  elo_duo?: number;
  games_played: number;
  wins: number;
}

type LbMode = "solo" | "duo";

const MEDAL_COLORS = [C.gold, "#C9C2B6", "#C86A2E"];
const MEDALS = [ICONS.medalGold, ICONS.medalSilver, ICONS.medalBronze];

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const ANIME = useAnime();
  const [players, setPlayers] = useState<LeaderRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<LbMode>("solo");

  // top header hides on scroll down, reappears on scroll up
  const { headerH, headerStyle, onHeaderLayout, onScrollDirection } =
    useCollapsibleHeader();

  // custom slim scroll indicator: visible only while scrolling, fades out after
  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(1);
  const viewH = useSharedValue(1);
  const indicatorOn = useSharedValue(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScrollDirection(e);
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
      const res = await api.get(`/leaderboard?mode=${mode}`);
      setPlayers(res.players);
      setMyRank(res.my_rank);
    } catch {}
  }, [mode]);

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

  if (ANIME) {
    // visual layer only — same data, refresh, scrolling, texts and testIDs
    return (
      <View style={styles.container} testID="leaderboard-screen">
        <ScreenBackground source={BG_HALL} shade={0.15} />
        <Animated.View
          style={[styles.header, an.header, { paddingTop: insets.top + SP.sm }, headerStyle]}
          onLayout={onHeaderLayout}
        >
          <View style={an.width}>
            <View style={styles.titleRow}>
              <PaintedMenuButton />
              <AnimeTitle text={t("ranking")} />
              <View testID="leaderboard-mode-toggle">
                <Segments
                  value={mode}
                  onChange={setMode}
                  height={34}
                  items={[
                    { key: "solo", label: t("lbSolo"), icon: ICONS.alone, testID: "lb-mode-solo" },
                    { key: "duo", label: t("lbDuo"), icon: ICONS.duo, testID: "lb-mode-duo" },
                  ]}
                />
              </View>
            </View>
            <View style={an.myRank} testID="my-rank-card">
              <NineSlice slices={TILE_HERO} corner={18} />
              <FramedPortrait avatarId={user?.avatar_id} size={54} />
              <View style={{ flex: 1, marginHorizontal: SP.md }}>
                <Text style={an.myRankLabel}>{t("yourRank")}</Text>
                <Text style={an.myRankValue}>
                  #{myRank ?? "—"} · {(mode === "duo" ? user?.elo_duo : user?.elo) ?? 1000}{" "}
                  {mode === "duo" ? t("eloDuo") : t("eloSolo")}
                </Text>
              </View>
              <Image source={ICONS.ranking} style={an.cup} resizeMode="contain" fadeDuration={0} />
            </View>
          </View>
        </Animated.View>

        <View style={styles.listWrap}>
          <FlatList
            data={players}
            keyExtractor={(item) => item.user_id}
            contentContainerStyle={[an.list, { paddingTop: headerH + SP.sm }]}
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
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={A.gold} progressViewOffset={headerH} />
            }
            ListEmptyComponent={
              <View style={an.empty}>
                <Image source={EMPTY_RANKING} style={an.emptyImg} resizeMode="contain" fadeDuration={0} />
                <Text style={an.emptyText}>{t("noPlayers")}</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMe = item.user_id === user?.user_id;
              return (
                <View testID={`leaderboard-row-${index + 1}`} style={an.row}>
                  <NineSlice slices={isMe ? TILE_HERO : HUD_PANEL} corner={isMe ? 16 : 12} />
                  <View style={an.medal}>
                    <Image source={MEDALS[index] ?? ICONS.medalPlain} style={an.medalImg} resizeMode="contain" fadeDuration={0} />
                    <Text style={[an.rank, index < 3 && { color: A.ink }]}>{index + 1}</Text>
                  </View>
                  <FramedPortrait avatarId={item.avatar_id} size={46} />
                  <View style={{ flex: 1, marginLeft: SP.sm }}>
                    <Text style={an.name} numberOfLines={1}>
                      {item.username}
                      {isMe ? ` · ${t("you")}` : ""}
                    </Text>
                    <Text style={an.games}>{t("gamesShort", { n: item.games_played })}</Text>
                  </View>
                  <Image source={ICONS.elo} style={an.eloIcon} resizeMode="contain" fadeDuration={0} />
                  <Text style={an.elo}>{mode === "duo" ? (item.elo_duo ?? 1000) : item.elo}</Text>
                </View>
              );
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.scrollIndicator, { backgroundColor: A.gold, shadowColor: A.gold }, indicatorStyle]}
            testID="custom-scroll-indicator"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="leaderboard-screen">
      <Animated.View
        style={[styles.header, { paddingTop: insets.top + SP.md }, headerStyle]}
        onLayout={onHeaderLayout}
      >
        <View style={styles.titleRow}>
          <View style={{ marginRight: SP.md }}>
            <MenuButton />
          </View>
          <Text style={styles.title}>{t("ranking")}</Text>
          <View style={styles.modeToggle} testID="leaderboard-mode-toggle">
            <Pressable
              testID="lb-mode-solo"
              onPress={() => setMode("solo")}
              style={[styles.modeBtn, mode === "solo" && styles.modeBtnActive]}
            >
              <Ionicons
                name="person"
                size={13}
                color={mode === "solo" ? "#1A1200" : C.ink3}
              />
              <Text style={[styles.modeText, mode === "solo" && styles.modeTextActive]}>
                {t("lbSolo")}
              </Text>
            </Pressable>
            <Pressable
              testID="lb-mode-duo"
              onPress={() => setMode("duo")}
              style={[styles.modeBtn, mode === "duo" && styles.modeBtnActive]}
            >
              <Ionicons
                name="people"
                size={13}
                color={mode === "duo" ? "#1A1200" : C.ink3}
              />
              <Text style={[styles.modeText, mode === "duo" && styles.modeTextActive]}>
                {t("lbDuo")}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.myRankCard} testID="my-rank-card">
          <Avatar avatarId={user?.avatar_id} size={44} ringColor={C.gold} />
          <View style={{ flex: 1, marginHorizontal: SP.md }}>
            <Text style={styles.myRankLabel}>{t("yourRank")}</Text>
            <Text style={styles.myRankValue}>
              #{myRank ?? "—"} ·{" "}
              {(mode === "duo" ? user?.elo_duo : user?.elo) ?? 1000}{" "}
              {mode === "duo" ? t("eloDuo") : t("eloSolo")}
            </Text>
          </View>
          <Ionicons name="trophy" size={28} color={C.gold} />
        </View>
      </Animated.View>

      <View style={styles.listWrap}>
        <FlatList
          data={players}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ padding: SP.lg, paddingTop: headerH + SP.md, paddingBottom: SP.xl, maxWidth: 760, width: "100%", alignSelf: "center" }}
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} progressViewOffset={headerH} />
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
                <Avatar avatarId={item.avatar_id} size={38} ringColor="rgba(233,196,106,0.55)" />
                <View style={{ flex: 1, marginLeft: SP.md }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.username}
                    {isMe ? ` · ${t("you")}` : ""}
                  </Text>
                  <Text style={styles.games}>
                    {t("gamesShort", { n: item.games_played })}
                  </Text>
                </View>
                <Text style={styles.elo}>
                  {mode === "duo" ? (item.elo_duo ?? 1000) : item.elo}
                </Text>
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

// ---- new design ----
const an = StyleSheet.create({
  header: { backgroundColor: "rgba(3,25,19,0.62)", borderBottomColor: A.goldFaint, paddingBottom: SP.sm },
  width: { maxWidth: 660, width: "100%", alignSelf: "center" },
  myRank: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.lg, paddingVertical: 8 },
  myRankLabel: { fontFamily: F.text, fontSize: 12, color: A.ivoryDim },
  myRankValue: { fontFamily: F.serif, fontSize: 18, color: A.goldLight },
  cup: { width: 40, height: 40 },
  list: { padding: SP.lg, paddingBottom: SP.xl, maxWidth: 660, width: "100%", alignSelf: "center", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: SP.sm, paddingHorizontal: 14, paddingVertical: 6, minHeight: 62 },
  medal: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  medalImg: { position: "absolute", width: 40, height: 40 },
  rank: { fontFamily: F.extra, fontSize: 14, color: A.ivory },
  name: { fontFamily: F.bold, fontSize: 15, color: A.ivory },
  games: { fontFamily: F.text, fontSize: 12, color: A.ivoryDim },
  eloIcon: { width: 22, height: 22 },
  elo: { fontFamily: F.serif, fontSize: 18, color: A.goldLight, minWidth: 44, textAlign: "right" },
  empty: { alignItems: "center", marginTop: SP.lg, gap: SP.sm },
  emptyImg: { width: 150, height: 150 },
  emptyText: { fontFamily: F.bold, fontSize: 14, color: A.goldLight, textAlign: "center" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(233,196,106,0.25)",
    paddingHorizontal: SP.lg,
    paddingBottom: SP.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP.md,
  },
  title: { fontFamily: F.serif, fontSize: 24, color: C.ink },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(28,23,20,0.9)",
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.35)",
    padding: 3,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SP.md,
    height: 32,
    borderRadius: R.pill,
  },
  modeBtnActive: { backgroundColor: C.gold },
  modeText: { fontFamily: F.bold, fontSize: 13, color: C.ink3 },
  modeTextActive: { color: "#1A1200" },
  myRankCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(28,23,20,0.9)",
    borderRadius: R.md,
    padding: SP.md,
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.45)",
  },
  myRankLabel: { fontFamily: F.text, fontSize: 12, color: C.ink3 },
  myRankValue: { fontFamily: F.serif, fontSize: 18, color: C.ink },
  listWrap: { flex: 1 },
  scrollIndicator: {
    position: "absolute",
    right: 3,
    top: 0,
    width: 4,
    borderRadius: 2,
    backgroundColor: C.goldSoft,
    shadowColor: C.goldSoft,
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
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.14)",
    borderLeftWidth: 4,
    borderLeftColor: "rgba(233,196,106,0.3)",
  },
  rowMe: { borderLeftColor: C.gold, backgroundColor: "rgba(233,196,106,0.08)" },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SP.md,
  },
  rankText: { fontFamily: F.extra, fontSize: 14, color: C.ink2 },
  name: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  games: { fontFamily: F.text, fontSize: 12, color: C.ink3 },
  elo: { fontFamily: F.serif, fontSize: 18, color: C.goldSoft },
  empty: {
    fontFamily: F.text,
    fontSize: 14,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.xxl,
  },
});
