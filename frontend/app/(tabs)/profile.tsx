import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { AVATARS, avatarUrl } from "@/src/avatars";
import Avatar from "@/src/components/Avatar";
import ChunkyButton from "@/src/components/ChunkyButton";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser, logout, refreshUser } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [rank, setRank] = useState<number | null>(null);
  const [winRate, setWinRate] = useState(0);
  const [showAvatars, setShowAvatars] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      api
        .get("/users/me/stats")
        .then((res) => {
          setRank(res.rank);
          setWinRate(res.win_rate);
        })
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const pickAvatar = async (avatarId: string) => {
    if (!user || avatarId === user.avatar_id) return;
    setUser({ ...user, avatar_id: avatarId });
    try {
      const updated = await api.put("/users/me", { avatar_id: avatarId });
      setUser(updated);
    } catch {}
  };

  const doLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  const stats = user?.stats ?? {};
  const history = user?.elo_history ?? [];
  const last = history.slice(-12);
  const maxElo = Math.max(...last.map((h) => h.elo), 1100);
  const minElo = Math.min(...last.map((h) => h.elo), 900);

  const statBlocks: { key: string; label: string; value: string | number; icon: string }[] = [
    { key: "games", label: t("gamesPlayed"), value: user?.games_played ?? 0, icon: "albums" },
    { key: "wins", label: t("wins"), value: user?.wins ?? 0, icon: "trophy" },
    { key: "losses", label: t("losses"), value: user?.losses ?? 0, icon: "sad" },
    { key: "winrate", label: t("winRate"), value: `${winRate}%`, icon: "stats-chart" },
    { key: "ctaken", label: t("contractsTaken"), value: stats.contracts_taken ?? 0, icon: "hand-right" },
    { key: "cmade", label: t("contractsMade"), value: stats.contracts_made ?? 0, icon: "checkmark-done" },
    { key: "belotes", label: t("belotes"), value: stats.belotes ?? 0, icon: "heart-circle" },
    { key: "capots", label: t("capots"), value: stats.capots ?? 0, icon: "flame" },
    { key: "streak", label: t("bestStreak"), value: stats.best_streak ?? 0, icon: "trending-up" },
  ];

  return (
    <View style={styles.container} testID="profile-screen">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SP.lg,
          paddingBottom: SP.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Avatar avatarId={user?.avatar_id} size={84} ringColor={C.brand} ringWidth={3} testID="profile-avatar" />
          <Text style={styles.username} testID="profile-username">{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.eloRow}>
            <View style={styles.eloBadge} testID="profile-elo-badge">
              <Ionicons name="flame" size={16} color={C.gold} />
              <Text style={styles.eloValue}>{user?.elo ?? 1000}</Text>
              <Text style={styles.eloLabel}>{t("elo")}</Text>
            </View>
            <View style={styles.eloBadge}>
              <Ionicons name="podium" size={16} color={C.brand} />
              <Text style={styles.eloValue}>#{rank ?? "—"}</Text>
              <Text style={styles.eloLabel}>{t("rank")}</Text>
            </View>
          </View>
        </View>

        <Pressable
          testID="toggle-avatars"
          onPress={() => setShowAvatars((v) => !v)}
          style={styles.sectionToggle}
        >
          <Ionicons name="color-palette" size={18} color={C.brand2} />
          <Text style={styles.sectionToggleText}>{t("chooseAvatar")}</Text>
          <Ionicons
            name={showAvatars ? "chevron-up" : "chevron-down"}
            size={18}
            color={C.ink3}
          />
        </Pressable>
        {showAvatars && (
          <Animated.View entering={FadeInDown.duration(160)} style={{ marginTop: SP.md }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SP.lg, gap: SP.md }}
            >
              {AVATARS.map((av) => (
                <Pressable
                  key={av.id}
                  testID={`avatar-option-${av.id}`}
                  onPress={() => pickAvatar(av.id)}
                  style={[
                    styles.avatarOption,
                    user?.avatar_id === av.id && styles.avatarSelected,
                  ]}
                >
                  <Image
                    source={{ uri: avatarUrl(av.id) }}
                    style={styles.avatarImg}
                    contentFit="cover"
                    transition={100}
                  />
                  <Text style={styles.avatarName} numberOfLines={1}>
                    {av.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        <Pressable
          testID="toggle-stats"
          onPress={() => setShowStats((v) => !v)}
          style={styles.sectionToggle}
        >
          <Ionicons name="stats-chart" size={18} color={C.brand2} />
          <Text style={styles.sectionToggleText}>{t("statistics")}</Text>
          <Ionicons
            name={showStats ? "chevron-up" : "chevron-down"}
            size={18}
            color={C.ink3}
          />
        </Pressable>
        {showStats && (
          <Animated.View entering={FadeInDown.duration(160)}>
            <View style={[styles.statsGrid, { marginTop: SP.md }]} testID="stats-grid">
              {statBlocks.map((s) => (
                <View key={s.key} style={styles.statBlock} testID={`stat-${s.key}`}>
                  <Ionicons name={s.icon as never} size={20} color={C.brand2} />
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {last.length > 1 && (
              <>
                <Text style={styles.sectionTitle}>{t("eloProgress")}</Text>
                <View style={styles.chart} testID="elo-chart">
                  {last.map((h, i) => {
                    const range = Math.max(maxElo - minElo, 1);
                    const hPct = 0.2 + 0.8 * ((h.elo - minElo) / range);
                    return (
                      <View key={i} style={styles.chartCol}>
                        <View style={[styles.chartBar, { height: `${hPct * 100}%` }]} />
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </Animated.View>
        )}

        <Text style={styles.sectionTitle}>{t("language")}</Text>
        <View style={styles.langRow}>
          <Pressable
            testID="language-fr-option"
            onPress={() => setLang("fr")}
            style={[styles.langOption, lang === "fr" && styles.langActive]}
          >
            <Text style={[styles.langText, lang === "fr" && styles.langTextActive]}>
              {t("french")}
            </Text>
          </Pressable>
          <Pressable
            testID="language-ar-option"
            onPress={() => setLang("ar")}
            style={[styles.langOption, lang === "ar" && styles.langActive]}
          >
            <Text style={[styles.langText, lang === "ar" && styles.langTextActive]}>
              {t("arabic")}
            </Text>
          </Pressable>
        </View>

        <ChunkyButton
          testID="logout-button"
          label={t("logout")}
          variant="ghost"
          onPress={doLogout}
          style={{ marginHorizontal: SP.lg, marginTop: SP.lg }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerCard: {
    alignItems: "center",
    backgroundColor: C.card,
    marginHorizontal: SP.lg,
    borderRadius: R.lg,
    padding: SP.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  username: { fontFamily: F.display, fontSize: 24, color: C.ink, marginTop: SP.md },
  email: { fontFamily: F.text, fontSize: 13, color: C.ink3, marginTop: 2 },
  eloRow: { flexDirection: "row", gap: SP.md, marginTop: SP.lg },
  eloBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.bg2,
    borderRadius: R.pill,
    paddingHorizontal: SP.lg,
    height: 40,
    borderWidth: 1,
    borderColor: C.border,
  },
  eloValue: { fontFamily: F.extra, fontSize: 17, color: C.ink },
  eloLabel: { fontFamily: F.text, fontSize: 12, color: C.ink3 },
  sectionTitle: {
    fontFamily: F.display,
    fontSize: 18,
    color: C.ink,
    marginTop: SP.xl,
    marginBottom: SP.md,
    paddingHorizontal: SP.lg,
  },
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: SP.lg,
    height: 52,
    marginHorizontal: SP.lg,
    marginTop: SP.md,
  },
  sectionToggleText: { flex: 1, fontFamily: F.display, fontSize: 16, color: C.ink },
  avatarOption: {
    width: 86,
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: SP.sm,
    borderWidth: 2,
    borderColor: C.border,
    flexShrink: 0,
  },
  avatarSelected: { borderColor: C.brand, backgroundColor: "rgba(0,229,122,0.10)" },
  avatarImg: { width: 60, height: 60, borderRadius: 30 },
  avatarName: { fontFamily: F.bold, fontSize: 10, color: C.ink2, marginTop: 4 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SP.lg,
    gap: SP.sm,
  },
  statBlock: {
    width: "31.5%",
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: SP.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: { fontFamily: F.extra, fontSize: 20, color: C.ink, marginTop: 4 },
  statLabel: { fontFamily: F.text, fontSize: 10.5, color: C.ink3, marginTop: 2 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 110,
    marginHorizontal: SP.lg,
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP.md,
    gap: 5,
  },
  chartCol: { flex: 1, height: "100%", justifyContent: "flex-end" },
  chartBar: {
    backgroundColor: C.brand2,
    borderRadius: 4,
    width: "100%",
  },
  langRow: { flexDirection: "row", gap: SP.md, paddingHorizontal: SP.lg },
  langOption: {
    flex: 1,
    height: 50,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  langActive: { borderColor: C.brand, backgroundColor: "rgba(0,229,122,0.10)" },
  langText: { fontFamily: F.bold, fontSize: 15, color: C.ink2 },
  langTextActive: { color: C.brand },
});
