import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BTN_DARK, BTN_GREEN, CHAT_CHIP, EMBLEMS, HUD_PANEL, ICONS } from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import NineSlice from "@/src/anime/components/NineSlice";
import { useAnime } from "@/src/anime/design";
import { A } from "@/src/anime/tokens";
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
  const ANIME = useAnime();
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
        style={[styles.chip, selected && styles.chipSelected, ANIME && styles.chipAnime, ANIME && selected && styles.chipAnimeOn]}
      >
        <View>
          <Avatar avatarId={c.avatar_id} size={40} ringColor={ANIME ? (selected ? A.goldLight : A.goldDark) : selected ? C.brand : undefined} />
          <View
            style={[styles.presenceDot, { backgroundColor: c.online ? C.green : C.ink3 }]}
            testID={`duo-presence-${c.username}-${c.online ? "on" : "off"}`}
          />
        </View>
        <Text style={[styles.chipName, selected && { color: C.brand }, ANIME && { color: selected ? A.goldLight : A.ivory }]} numberOfLines={1}>
          {c.username}
        </Text>
        <Text style={[styles.chipElo, ANIME && { color: A.ivoryDim }]}>
          {showDuoElo ? (c.elo_duo ?? 1000) : c.elo}
        </Text>
        {showAdd && c.friend_status === "none" && !requested[c.user_id] && (
          <Pressable
            testID={`duo-add-friend-${c.username}`}
            onPress={() => addFriend(c)}
            hitSlop={6}
            style={[styles.addBtn, ANIME && styles.addBtnAnime]}
          >
            {ANIME ? (
              <Image source={ICONS.addFriend} style={styles.addImg} fadeDuration={0} />
            ) : (
              <Ionicons name="person-add" size={12} color={C.onBrand} />
            )}
          </Pressable>
        )}
        {showAdd && (c.friend_status === "pending" || requested[c.user_id]) && (
          <View style={[styles.addBtn, { backgroundColor: C.bg3 }, ANIME && styles.addBtnAnime]}>
            {ANIME && EMBLEMS.pause ? (
              <Image source={EMBLEMS.pause} style={styles.addImg} fadeDuration={0} />
            ) : (
              <Ionicons name="hourglass" size={11} color={C.ink3} />
            )}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View testID="duo-setup">
      <Text style={[styles.label, ANIME && styles.labelAnime]}>{t("duoChoosePartner")}</Text>
      <View style={styles.filterRow}>
        <View style={[styles.searchBox, ANIME && styles.searchAnime]}>
          {ANIME && <HSlice slices={CHAT_CHIP} />}
          {ANIME ? (
            <Image source={ICONS.search} style={styles.searchImg} fadeDuration={0} />
          ) : (
            <Ionicons name="search" size={14} color={C.ink3} />
          )}
          <TextInput
            testID="duo-search-input"
            style={[styles.searchInput, ANIME && styles.inputAnime]}
            placeholder={t("duoSearchFriend")}
            placeholderTextColor={ANIME ? A.ivoryDim : C.ink3}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            disableFullscreenUI
          />
        </View>
        <Pressable
          testID="duo-online-filter"
          onPress={() => setOnlyOnline((v) => !v)}
          style={[styles.onlineChip, onlyOnline && styles.onlineChipActive, ANIME && styles.onlineAnime]}
        >
          {ANIME && <HSlice slices={onlyOnline ? BTN_GREEN : BTN_DARK} />}
          <View style={styles.presenceDotInline} />
          <Text style={[styles.onlineChipText, onlyOnline && { color: C.onBrand }, ANIME && { color: A.ivory }]}>
            {t("onlineFilter")}
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={ANIME ? A.gold : C.brand} style={{ marginVertical: SP.lg }} />
      ) : friends.length === 0 && recent.length === 0 ? (
        <Text style={[styles.empty, ANIME && styles.emptyAnime]}>{t("duoNoCandidates")}</Text>
      ) : fList.length === 0 && rList.length === 0 ? (
        <Text style={[styles.empty, ANIME && styles.emptyAnime]}>{t("noResults")}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SP.sm, paddingVertical: SP.xs }}
        >
          {fList.map((c) => renderChip(c, false))}
          {rList.length > 0 && (
            <View style={styles.recentDivider}>
              <Text style={[styles.recentDividerText, ANIME && { color: A.gold }]}>{t("duoRecentSection")}</Text>
            </View>
          )}
          {rList.map((c) => renderChip(c, true))}
        </ScrollView>
      )}

      {showDuoElo && (
        <View style={[styles.duoOnlyHint, ANIME && styles.hintAnime]} testID="duo-vs-duo-hint">
          {ANIME && <NineSlice slices={HUD_PANEL} corner={9} />}
          {ANIME ? (
            <Image source={ICONS.friends} style={styles.searchImg} fadeDuration={0} />
          ) : (
            <Ionicons name="shield-checkmark" size={15} color={C.brand} />
          )}
          <Text style={[styles.duoOnlyText, ANIME && { color: A.ivory }]}>{t("duoVsDuoOnly")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- anime theme ----
  chipAnime: { backgroundColor: "rgba(3,35,28,0.75)", borderColor: A.goldFaint },
  chipAnimeOn: { backgroundColor: A.emeraldBright, borderColor: A.goldLight },
  addBtnAnime: { backgroundColor: "transparent", width: 24, height: 24, top: 1, right: 1 },
  addImg: { width: "100%", height: "100%", resizeMode: "contain" },
  labelAnime: { fontFamily: F.serif, color: A.goldLight, marginTop: SP.sm },
  searchAnime: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, paddingHorizontal: 20, height: 40 },
  // positioned so the text paints above the absolute painted field (web)
  inputAnime: { position: "relative", zIndex: 1, color: A.ivory },
  searchImg: { width: 22, height: 22, resizeMode: "contain" },
  onlineAnime: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, paddingHorizontal: 24, height: 40 },
  emptyAnime: { color: A.ivoryDim, textAlign: "center" },
  hintAnime: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, marginTop: SP.sm, marginBottom: SP.xs },
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
