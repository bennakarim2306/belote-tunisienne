import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { SlideInLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotifications } from "@/src/context/NotificationsContext";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

const ITEMS = [
  { key: "home", icon: "home", label: "tabHome" },
  { key: "leaderboard", icon: "trophy", label: "tabRanking" },
  { key: "friends", icon: "people", label: "tabFriends" },
  { key: "profile", icon: "person", label: "tabProfile" },
] as const;

/** Hamburger button (top-left of every tab screen) opening a left side menu.
 *  Replaces the bottom tab bar to free vertical space in landscape. */
export default function MenuButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { friendRequests, invites, duoInvites } = useNotifications();

  const badges: Record<string, number> = {
    home: invites.length + duoInvites.length,
    friends: friendRequests.length,
  };
  const totalBadge = badges.home + badges.friends;

  const go = (key: string) => {
    setOpen(false);
    if (pathname !== `/${key}`) {
      router.navigate(`/${key}` as never);
    }
  };

  return (
    <>
      <Pressable
        testID="menu-button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
        hitSlop={6}
      >
        <Ionicons name="menu" size={24} color={C.ink} />
        {totalBadge > 0 && (
          <View style={styles.btnBadge}>
            <Text style={styles.btnBadgeText}>{totalBadge}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Animated.View
            entering={SlideInLeft.duration(200)}
            style={[
              styles.panel,
              { paddingTop: insets.top + SP.lg, paddingBottom: insets.bottom + SP.lg },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={() => {}} testID="side-menu">
              <Text style={styles.brand}>♠ ♥ Belote ♦ ♣</Text>
              {ITEMS.map((item) => {
                const active = pathname === `/${item.key}`;
                const badge = badges[item.key] ?? 0;
                return (
                  <Pressable
                    key={item.key}
                    testID={`menu-item-${item.key}`}
                    onPress={() => go(item.key)}
                    style={({ pressed }) => [
                      styles.item,
                      active && styles.itemActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons
                      name={item.icon as never}
                      size={20}
                      color={active ? C.brand : C.ink2}
                    />
                    <Text style={[styles.itemText, active && { color: C.brand }]}>
                      {t(item.label as never)}
                    </Text>
                    {badge > 0 && (
                      <View style={styles.itemBadge}>
                        <Text style={styles.itemBadgeText}>{badge}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  btnBadgeText: { fontFamily: F.bold, fontSize: 10, color: C.onBrand },
  scrim: { flex: 1, backgroundColor: C.scrim, flexDirection: "row" },
  panel: {
    width: 250,
    backgroundColor: C.bg2,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingHorizontal: SP.md,
  },
  brand: {
    fontFamily: F.display,
    fontSize: 17,
    color: C.brand,
    textAlign: "center",
    marginBottom: SP.lg,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    height: 50,
    borderRadius: R.md,
    paddingHorizontal: SP.md,
    marginBottom: SP.xs,
  },
  itemActive: { backgroundColor: "rgba(0,229,122,0.10)" },
  itemText: { flex: 1, fontFamily: F.display, fontSize: 15, color: C.ink },
  itemBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  itemBadgeText: { fontFamily: F.bold, fontSize: 11, color: C.onBrand },
});
