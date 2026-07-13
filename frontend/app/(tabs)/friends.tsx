import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import Avatar from "@/src/components/Avatar";
import MenuButton from "@/src/components/MenuButton";
import ShareSheet from "@/src/components/ShareSheet";
import { useCollapsibleHeader } from "@/src/hooks/use-collapsible-header";
import { useI18n } from "@/src/i18n";
import { APP_INSTALL_URL } from "@/src/share";
import { C, F, R, SP } from "@/src/theme";

interface FriendRow {
  friendship_id?: string;
  user_id: string;
  username: string;
  avatar_id: string;
  elo: number;
  friend_status?: string;
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [received, setReceived] = useState<FriendRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // top header hides on scroll down, reappears on scroll up
  const { headerH, headerStyle, onHeaderLayout, onScrollDirection } =
    useCollapsibleHeader();

  const load = useCallback(async () => {
    try {
      const res = await api.get("/friends");
      setFriends(res.friends);
      setReceived(res.pending_received);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const onSearch = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setResults(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(text.trim())}`);
        setResults(res.results);
      } catch {}
    }, 350);
  };

  const sendRequest = async (userId: string) => {
    try {
      await api.post("/friends/request", { user_id: userId });
      setResults((prev) =>
        prev?.map((r) =>
          r.user_id === userId ? { ...r, friend_status: "pending_sent" } : r,
        ) ?? null,
      );
      showToast(t("requestSent"));
    } catch {}
  };

  const respond = async (friendshipId: string, accept: boolean) => {
    try {
      await api.post("/friends/respond", { friendship_id: friendshipId, accept });
      await load();
    } catch {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container} testID="friends-screen">
      <Animated.View
        style={[styles.header, { paddingTop: insets.top + SP.md }, headerStyle]}
        onLayout={onHeaderLayout}
      >
        <View style={styles.titleRow}>
          <View style={{ marginRight: SP.md }}>
            <MenuButton />
          </View>
          <Text style={styles.title}>{t("friends")}</Text>
          <Pressable
            testID="invite-friends-button"
            onPress={() => setShareOpen(true)}
            style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.8 }]}
            hitSlop={6}
          >
            <Ionicons name="share-social" size={15} color={C.goldSoft} />
            <Text style={styles.inviteBtnText} numberOfLines={1}>
              {t("inviteFriends")}
            </Text>
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={C.ink3} />
          <TextInput
            testID="friend-search-input"
            style={styles.searchInput}
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={C.ink3}
            value={query}
            onChangeText={onSearch}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => onSearch("")} hitSlop={8} testID="friend-search-clear">
              <Ionicons name="close-circle" size={18} color={C.ink3} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {results !== null ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ padding: SP.lg, paddingTop: headerH + SP.md, maxWidth: 760, width: "100%", alignSelf: "center" }}
          onScroll={onScrollDirection}
          scrollEventThrottle={16}
          ListEmptyComponent={<Text style={styles.empty}>{t("noResults")}</Text>}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`search-result-${item.username}`}>
              <Avatar avatarId={item.avatar_id} size={40} ringColor="rgba(233,196,106,0.55)" />
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Text style={styles.name}>{item.username}</Text>
                <Text style={styles.sub}>{item.elo} {t("elo")}</Text>
              </View>
              {item.friend_status === "none" && (
                <Pressable
                  testID={`add-friend-${item.username}`}
                  onPress={() => sendRequest(item.user_id)}
                  style={styles.addBtn}
                >
                  <Ionicons name="person-add" size={16} color={C.onBrand} />
                  <Text style={styles.addBtnText}>{t("add")}</Text>
                </Pressable>
              )}
              {item.friend_status === "pending_sent" && (
                <Text style={styles.sentText}>{t("sentShort")}</Text>
              )}
              {item.friend_status === "friends" && (
                <Ionicons name="checkmark-circle" size={22} color={C.green} />
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ padding: SP.lg, paddingTop: headerH + SP.md, paddingBottom: SP.xl, maxWidth: 760, width: "100%", alignSelf: "center" }}
          onScroll={onScrollDirection}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} progressViewOffset={headerH} />
          }
          ListHeaderComponent={
            received.length > 0 ? (
              <View style={{ marginBottom: SP.md }}>
                <Text style={styles.sectionTitle}>{t("requests")}</Text>
                {received.map((r) => (
                  <View key={r.friendship_id} style={styles.row} testID={`request-row-${r.username}`}>
                    <Avatar avatarId={r.avatar_id} size={40} ringColor="rgba(233,196,106,0.55)" />
                    <View style={{ flex: 1, marginLeft: SP.md }}>
                      <Text style={styles.name}>{r.username}</Text>
                      <Text style={styles.sub}>{r.elo} {t("elo")}</Text>
                    </View>
                    <Pressable
                      testID={`accept-request-${r.username}`}
                      onPress={() => respond(r.friendship_id!, true)}
                      style={[styles.circleBtn, { backgroundColor: C.green }]}
                    >
                      <Ionicons name="checkmark" size={20} color={C.onBrand} />
                    </Pressable>
                    <Pressable
                      testID={`decline-request-${r.username}`}
                      onPress={() => respond(r.friendship_id!, false)}
                      style={[styles.circleBtn, { backgroundColor: C.error, marginLeft: SP.sm }]}
                    >
                      <Ionicons name="close" size={20} color={C.onBrand} />
                    </Pressable>
                  </View>
                ))}
                <Text style={styles.sectionTitle}>{t("friends")}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox} testID="friends-empty-state">
              <Ionicons name="people-circle" size={72} color={C.goldSoft} />
              <Text style={styles.emptyTitle}>{t("noFriends")}</Text>
              <Text style={styles.empty}>{t("noFriendsDesc")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row} testID={`friend-row-${item.username}`}>
              <Avatar avatarId={item.avatar_id} size={40} ringColor="rgba(233,196,106,0.55)" />
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Text style={styles.name}>{item.username}</Text>
                <Text style={styles.sub}>{item.elo} {t("elo")}</Text>
              </View>
              <Ionicons name="heart" size={18} color={C.brand3} />
            </View>
          )}
        />
      )}

      {toast && (
        <View style={styles.toast} testID="friends-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title={t("inviteFriends")}
        message={t("inviteAppMsg", { link: APP_INSTALL_URL })}
        url={APP_INSTALL_URL}
      />
    </View>
  );
}

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
    paddingBottom: SP.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    marginBottom: SP.md,
  },
  title: { fontFamily: F.serif, fontSize: 24, color: C.ink },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(233,196,106,0.10)",
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.5)",
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 32,
  },
  inviteBtnText: { fontFamily: F.bold, fontSize: 12.5, color: C.goldSoft },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: "rgba(28,23,20,0.9)",
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.3)",
    paddingHorizontal: SP.lg,
    height: 46,
  },
  searchInput: { flex: 1, fontFamily: F.text, fontSize: 15, color: C.ink },
  sectionTitle: {
    fontFamily: F.serif,
    fontSize: 16,
    color: C.goldSoft,
    marginBottom: SP.sm,
    marginTop: SP.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: SP.sm,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.16)",
  },
  name: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  sub: { fontFamily: F.text, fontSize: 12, color: C.ink3 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.brand,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    height: 36,
  },
  addBtnText: { fontFamily: F.display, fontSize: 13, color: C.onBrand },
  sentText: { fontFamily: F.bold, fontSize: 12, color: C.green },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: { alignItems: "center", marginTop: SP.xxl, paddingHorizontal: SP.xl },
  emptyTitle: { fontFamily: F.display, fontSize: 18, color: C.ink, marginTop: SP.md },
  empty: {
    fontFamily: F.text,
    fontSize: 13,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.sm,
  },
  toast: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: C.ink,
    borderRadius: R.pill,
    paddingHorizontal: SP.xl,
    paddingVertical: SP.md,
  },
  toastText: { fontFamily: F.bold, color: C.cream, fontSize: 13 },
});
