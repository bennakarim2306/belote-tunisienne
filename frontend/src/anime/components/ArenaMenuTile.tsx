import React, { useEffect } from "react";
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { TILE_DARK, TILE_HERO } from "@/src/anime/assets";
import NineSlice from "@/src/anime/components/NineSlice";
import { A } from "@/src/anime/tokens";
import { F, SP } from "@/src/theme";

// Reusable menu tile for the Emerald Tunisian Arena. The frame is a painted
// 9-slice panel (emerald "hero" or near-black "dark"); icon, texts and touch
// handling are real components on top — the artwork never stands in for them.

interface Props {
  variant: "hero" | "dark";
  icon: ImageSourcePropType;
  title: string;
  desc: string;
  onPress: () => void;
  testID: string;
  /** responsive sizes computed by the screen */
  titleSize: number;
  descSize: number;
  iconBox: number;
  /** tile height (dp) — lets the corners shrink on very small tiles */
  tileHeight: number;
  /** extra line under the description (live online count, badge…) */
  footer?: React.ReactNode;
  /** soft breathing glow (hero tile) */
  pulse?: boolean;
}

export default function ArenaMenuTile({
  variant,
  icon,
  title,
  desc,
  onPress,
  testID,
  titleSize,
  descSize,
  iconBox,
  tileHeight,
  footer,
  pulse,
}: Props) {
  const hero = variant === "hero";
  const slices = hero ? TILE_HERO : TILE_DARK;
  // corners never take more than ~84% of the height together
  const corner = tileHeight > 0 ? Math.min(slices.corner, tileHeight * 0.42) : slices.corner;

  const glow = useSharedValue(0);
  useEffect(() => {
    if (!pulse) return;
    glow.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [glow, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: pulse ? 0.35 + glow.value * 0.5 : 0.4,
  }));

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${desc}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {/* glow: an opaque plate hidden behind the panel, only its shadow shows */}
      <Animated.View
        pointerEvents="none"
        style={[styles.glowPlate, hero ? styles.glowHero : styles.glowDark, glowStyle]}
      />
      <NineSlice slices={slices} corner={corner} />

      <Image
        source={icon}
        resizeMode="contain"
        fadeDuration={0}
        style={[styles.icon, { width: iconBox, height: iconBox }]}
      />

      <View style={styles.textWrap}>
        <Text style={[styles.title, { fontSize: titleSize }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDiamond} />
          <View style={styles.dividerLine} />
        </View>
        <Text style={[styles.desc, { fontSize: descSize }]} numberOfLines={2}>
          {desc}
        </Text>
        {footer}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: SP.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  glowPlate: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 8,
  },
  glowHero: { backgroundColor: A.emeraldSurface, shadowColor: "#3BE3A2" },
  glowDark: { backgroundColor: A.ink, shadowColor: A.gold },
  icon: { flexShrink: 0 },
  textWrap: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: F.serif,
    color: A.ivory,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 5,
    maxWidth: 220,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: A.goldLine },
  dividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: A.goldLight,
    transform: [{ rotate: "45deg" }],
  },
  desc: { fontFamily: F.text, color: A.ivoryDim },
});
