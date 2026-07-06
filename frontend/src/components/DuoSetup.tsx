import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  friend_status?: "friends" | "pending" | "none";
}

export type DuoMode = "wait" | "duo_only" | "fill";

const MODES: { id: DuoMode; icon: string; label: string; desc: string }[] = [
  { id: "wait", icon: "time", label: "duoModeWait", desc: "duoModeWaitDesc" },
  { id: "duo_only", icon: "shield-checkmark", label: "duoModeOnly", desc: "duoModeOnlyDesc" },
  { id: "fill", icon: "flash", label: "duoModeFill", desc: "duoModeFillDesc" },
];

interface Props {
  partner: DuoCandidate | null;
  onPartner: (c: DuoCandidate | null) => void;
  mode: DuoMode;
  onMode: (m: DuoMode) => void;
  showModes?: boolean;
}

// Partner picker (friends + recent co-players) and opponents-wait mode selector
// shown inside the "Jouer en ligne" modal when "En duo" is active.
export default function DuoSetup({ partner, onPartner, mode, onMode, showModes = true }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<DuoCandidate[]>([]);
  const [recent, setRecent] = useState<DuoCandidate[]>([]);
  const [requested, setRequested] = useState<Record<string, boolean>>({});

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

  const renderChip = (c: DuoCandidate, showAdd: boolean) => {
    const selected = partner?.user_id === c.user_id;
    return (
      <Pressable
        key={c.user_id}
        testID={`duo-candidate-${c.username}`}
        onPress={() => onPartner(selected ? null : c)}
        style={[styles.chip, selected && styles.chipSelected]}
      >
        <Avatar avatarId={c.avatar_id} size={40} ringColor={selected ? C.brand : undefined} />
        <Text style={[styles.chipName, selected && { color: C.brand }]} numberOfLines={1}>
          {c.username}
        </Text>
        <Text style={styles.chipElo}>{c.elo}</Text>
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
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginVertical: SP.lg }} />
      ) : friends.length === 0 && recent.length === 0 ? (
        <Text style={styles.empty}>{t("duoNoCandidates")}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SP.sm, paddingVertical: SP.xs }}
        >
          {friends.map((c) => renderChip(c, false))}
          {recent.length > 0 && (
            <View style={styles.recentDivider}>
              <Text style={styles.recentDividerText}>{t("duoRecentSection")}</Text>
            </View>
          )}
          {recent.map((c) => renderChip(c, true))}
        </ScrollView>
      )}

      {showModes && (
        <>
          <Text style={styles.label}>{t("duoOpponents")}</Text>
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <Pressable
                key={m.id}
                testID={`duo-mode-${m.id}`}
                onPress={() => onMode(m.id)}
                style={[styles.modeRow, active && styles.modeRowActive]}
              >
                <Ionicons
                  name={m.icon as never}
                  size={18}
                  color={active ? C.brand : C.ink3}
                />
                <View style={{ flex: 1, marginLeft: SP.md }}>
                  <Text style={[styles.modeLabel, active && { color: C.brand }]}>
                    {t(m.label as never)}
                  </Text>
                  <Text style={styles.modeDesc}>{t(m.desc as never)}</Text>
                </View>
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={19}
                  color={active ? C.brand : C.ink3}
                />
              </Pressable>
            );
          })}
        </>
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
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg2,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    marginTop: SP.xs,
  },
  modeRowActive: { borderColor: C.brand, backgroundColor: C.bg3 },
  modeLabel: { fontFamily: F.bold, fontSize: 13.5, color: C.ink },
  modeDesc: { fontFamily: F.text, fontSize: 11.5, color: C.ink3, marginTop: 1 },
});
