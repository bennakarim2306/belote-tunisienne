import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Modal, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { SlideInLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BTN_GREEN, ICONS, LOGO } from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import { useAnime } from "@/src/anime/design";
import { AnimeWindowFrame } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import { useNotifications } from "@/src/context/NotificationsContext";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

const ITEMS = [
  { key: "home", icon: "home", label: "tabHome" },
  { key: "leaderboard", icon: "trophy", label: "tabRanking" },
  { key: "friends", icon: "people", label: "tabFriends" },
  { key: "profile", icon: "person", label: "tabProfile" },
] as const;

const ANIME_ICON = {
  home: ICONS.home,
  leaderboard: ICONS.ranking,
  friends: ICONS.friends,
  profile: ICONS.profile,
};

/** Hamburger button (top-left of every tab screen) opening a left side menu.
 *  Replaces the bottom tab bar to free vertical space in landscape. */
interface MenuButtonProps {
  /** optional visual overrides for the trigger button only (anime theme);
   *  without them the button renders exactly as before */
  buttonStyle?: StyleProp<ViewStyle>;
  iconColor?: string;
  /** replaces the menu glyph (painted button of the anime theme) */
  icon?: React.ReactNode;
}

export default function MenuButton({ buttonStyle, iconColor, icon }: MenuButtonProps = {}) {
  const ANIME = useAnime();
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
        style={({ pressed }) => [styles.btn, buttonStyle, pressed && { opacity: 0.8 }]}
        hitSlop={6}
      >
        {icon ?? <Ionicons name="menu" size={24} color={iconColor ?? C.ink} />}
        {totalBadge > 0 && (
          <View style={[styles.btnBadge, ANIME && styles.badgeAnime]}>
            <Text style={[styles.btnBadgeText, ANIME && { color: A.ivory }]}>{totalBadge}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" supportedOrientations={["landscape", "portrait"]} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Animated.View
            entering={SlideInLeft.duration(200)}
            style={[
              styles.panel,
              ANIME && styles.panelAnime,
              { paddingTop: insets.top + SP.lg, paddingBottom: insets.bottom + SP.lg },
            ]}
          >
            {ANIME && <AnimeWindowFrame />}
            <Pressable style={{ flex: 1 }} onPress={() => {}} testID="side-menu">
              {ANIME ? (
                <Image source={LOGO.source} style={styles.logoAnime} resizeMode="contain" fadeDuration={0} />
              ) : (
                <Text style={styles.brand}>♠ ♥ Belote ♦ ♣</Text>
              )}
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
                      ANIME && styles.itemAnime,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    {ANIME && active && <HSlice slices={BTN_GREEN} />}
                    {ANIME ? (
                      <Image source={ANIME_ICON[item.key]} style={styles.iconAnime} fadeDuration={0} />
                    ) : (
                      <Ionicons
                        name={item.icon as never}
                        size={20}
                        color={active ? C.brand : C.ink2}
                      />
                    )}
                    <Text style={[styles.itemText, active && { color: C.brand }, ANIME && { fontFamily: F.serif, color: active ? A.ivory : A.goldLight }]}>
                      {t(item.label as never)}
                    </Text>
                    {badge > 0 && (
                      <View style={[styles.itemBadge, ANIME && styles.badgeAnime]}>
                        <Text style={[styles.itemBadgeText, ANIME && { color: A.ivory }]}>{badge}</Text>
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
  // ---- anime theme ----
  panelAnime: { width: 268, backgroundColor: "transparent", borderRightWidth: 0, paddingHorizontal: 26 },
  logoAnime: { width: 136, height: 58, alignSelf: "center", marginBottom: SP.sm },
  itemAnime: { backgroundColor: "transparent", borderRadius: 0, height: 48, paddingHorizontal: 26 },
  iconAnime: { width: 30, height: 30, resizeMode: "contain" },
  badgeAnime: { backgroundColor: A.red, borderWidth: 1, borderColor: A.goldLight },
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
    borderRightColor: "rgba(233,196,106,0.3)",
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
