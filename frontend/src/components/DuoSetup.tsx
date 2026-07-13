import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

export interface DuoCandidate {
  user_id: string;
  username: string;
  avatar_id: string;
  elo: number;
  elo_duo?: number;
  friend_status?: "friends" | "pending" | "none";
  online?: boolean;
}

interface Props {
  partner: DuoCandidate | null;
  onPartner: (c: DuoCandidate | null) => void;
  showDuoElo?: boolean;
}

// Partner picker (friends + recent co-players) shown inside the play modals
// when "En duo" is active. Online duo is strictly duo-vs-duo, rated on the
// separate duo ELO — hence showDuoElo for the online variant.
export default function DuoSetup({ partner, onPartner, showDuoElo = false }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<DuoCandidate[]>([]);
  const [recent, setRecent] = useState<DuoCandidate[]>([]);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/matchmaking/duo/candidates");
        setFriends(res.friends ?? []);
        setRecent(res.recent ?? []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const addFriend = async (c: DuoCandidate) => {
    setRequested((r) => ({ ...r, [c.user_id]: true }));
    await api.post("/friends/request", { user_id: c.user_id }).catch(() => {});
  };

  const matches = (c: DuoCandidate) =>
    c.username.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!onlyOnline || !!c.online);
  const fList = friends.filter(matches);
  const rList = recent.filter(matches);

  const renderChip = (c: DuoCandidate, showAdd: boolean) => {
    const selected = partner?.user_id === c.user_id;
    return (
      <Pressable
        key={c.user_id}
        testID={`duo-candidate-${c.username}`}
        onPress={() => onPartner(selected ? null : c)}
        style={[styles.chip, selected && styles.chipSelected]}
      >
        <View>
          <Avatar avatarId={c.avatar_id} size={40} ringColor={selected ? C.brand : undefined} />
          <View
            style={[styles.presenceDot, { backgroundColor: c.online ? C.green : C.ink3 }]}
            testID={`duo-presence-${c.username}-${c.online ? "on" : "off"}`}
          />
        </View>
        <Text style={[styles.chipName, selected && { color: C.brand }]} numberOfLines={1}>
          {c.username}
        </Text>
        <Text style={styles.chipElo}>
          {showDuoElo ? (c.elo_duo ?? 1000) : c.elo}
        </Text>
        {showAdd && c.friend_status === "none" && !requested[c.user_id] && (
          <Pressable
            testID={`duo-add-friend-${c.username}`}
            onPress={() => addFriend(c)}
            hitSlop={6}
            style={styles.addBtn}
          >
            <Ionicons name="person-add" size={12} color={C.onBrand} />
          </Pressable>
        )}
        {showAdd && (c.friend_status === "pending" || requested[c.user_id]) && (
          <View style={[styles.addBtn, { backgroundColor: C.bg3 }]}>
            <Ionicons name="hourglass" size={11} color={C.ink3} />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View testID="duo-setup">
      <Text style={styles.label}>{t("duoChoosePartner")}</Text>
      <View style={styles.filterRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color={C.ink3} />
          <TextInput
            testID="duo-search-input"
            style={styles.searchInput}
            placeholder={t("duoSearchFriend")}
            placeholderTextColor={C.ink3}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            disableFullscreenUI
          />
        </View>
        <Pressable
          testID="duo-online-filter"
          onPress={() => setOnlyOnline((v) => !v)}
          style={[styles.onlineChip, onlyOnline && styles.onlineChipActive]}
        >
          <View style={styles.presenceDotInline} />
          <Text style={[styles.onlineChipText, onlyOnline && { color: C.onBrand }]}>
            {t("onlineFilter")}
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginVertical: SP.lg }} />
      ) : friends.length === 0 && recent.length === 0 ? (
        <Text style={styles.empty}>{t("duoNoCandidates")}</Text>
      ) : fList.length === 0 && rList.length === 0 ? (
        <Text style={styles.empty}>{t("noResults")}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SP.sm, paddingVertical: SP.xs }}
        >
          {fList.map((c) => renderChip(c, false))}
          {rList.length > 0 && (
            <View style={styles.recentDivider}>
              <Text style={styles.recentDividerText}>{t("duoRecentSection")}</Text>
            </View>
          )}
          {rList.map((c) => renderChip(c, true))}
        </ScrollView>
      )}

      {showDuoElo && (
        <View style={styles.duoOnlyHint} testID="duo-vs-duo-hint">
          <Ionicons name="shield-checkmark" size={15} color={C.brand} />
          <Text style={styles.duoOnlyText}>{t("duoVsDuoOnly")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: F.bold,
    fontSize: 13,
    color: C.ink2,
    marginTop: SP.md,
    marginBottom: SP.xs,
  },
  filterRow: { flexDirection: "row", gap: SP.sm, marginBottom: SP.xs },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.bg,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SP.md,
    height: 34,
  },
  searchInput: {
    flex: 1,
    fontFamily: F.text,
    fontSize: 13,
    color: C.ink,
    paddingVertical: 0,
  },
  onlineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg2,
    paddingHorizontal: SP.md,
    height: 34,
  },
  onlineChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  onlineChipText: { fontFamily: F.bold, fontSize: 12, color: C.ink2 },
  presenceDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.bg2,
  },
  presenceDotInline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  empty: {
    fontFamily: F.text,
    fontSize: 13,
    color: C.ink3,
    marginVertical: SP.md,
  },
  chip: {
    alignItems: "center",
    width: 78,
    paddingVertical: SP.sm,
    borderRadius: R.md,
    backgroundColor: C.bg2,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  chipSelected: { borderColor: C.brand, backgroundColor: C.bg3 },
  chipName: {
    fontFamily: F.bold,
    fontSize: 11,
    color: C.ink,
    marginTop: 4,
    maxWidth: 70,
  },
  chipElo: { fontFamily: F.text, fontSize: 10, color: C.ink3 },
  addBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.brand2,
    alignItems: "center",
    justifyContent: "center",
  },
  recentDivider: { justifyContent: "center", paddingHorizontal: 2 },
  recentDividerText: {
    fontFamily: F.bold,
    fontSize: 10,
    color: C.ink3,
    transform: [{ rotate: "-90deg" }],
    width: 70,
    textAlign: "center",
  },
  duoOnlyHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SP.md,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.brand3,
    borderRadius: R.md,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
  },
  duoOnlyText: { fontFamily: F.bold, fontSize: 12.5, color: C.brand, flex: 1 },
});
