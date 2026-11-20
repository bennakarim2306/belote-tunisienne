import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { A, goldGlow } from "@/src/anime/tokens";
import { F, SP } from "@/src/theme";

// Reusable menu tile for the Emerald Tunisian Arena: emerald (hero) or
// near-black (dark) panel, gold trim, inner hairline frame, small ornamental
// corner studs. A real Pressable — the background art never stands in for it.

interface Props {
  variant: "hero" | "dark";
  icon: React.ReactNode;
  /** "emerald" = framed glass well, "amber" = the app's existing orange block */
  iconTone: "emerald" | "amber";
  title: string;
  desc: string;
  onPress: () => void;
  testID: string;
  /** responsive sizes computed by the screen */
  titleSize: number;
  descSize: number;
  iconBox: number;
  /** extra line under the description (e.g. live online count) */
  footer?: React.ReactNode;
  /** small pill pinned top-right (e.g. "Entraînement") */
  badge?: string;
}

function Stud({ style }: { style: object }) {
  return <View pointerEvents="none" style={[styles.stud, style]} />;
}

export default function ArenaMenuTile({
  variant,
  icon,
  iconTone,
  title,
  desc,
  onPress,
  testID,
  titleSize,
  descSize,
  iconBox,
  footer,
  badge,
}: Props) {
  const hero = variant === "hero";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${desc}`}
      style={({ pressed }) => [
        styles.tile,
        hero ? styles.tileHero : styles.tileDark,
        pressed && styles.pressed,
      ]}
    >
      {({ pressed }) => (
        <>
          <LinearGradient
            colors={hero ? ["#0F7C5C", "#07513E", "#053629"] : ["#231C14", "#17130E", "#0F0C08"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.fill]}
          />
          {/* inner hairline frame + corner studs */}
          <View
            pointerEvents="none"
            style={[styles.innerFrame, pressed && { borderColor: A.goldLight }]}
          />
          <Stud style={{ top: 5, left: 5 }} />
          <Stud style={{ top: 5, right: 5 }} />
          <Stud style={{ bottom: 5, left: 5 }} />
          <Stud style={{ bottom: 5, right: 5 }} />

          <View
            style={[
              styles.iconBox,
              { width: iconBox, height: iconBox, borderRadius: iconBox * 0.3 },
              iconTone === "emerald" && styles.iconEmerald,
            ]}
          >
            {iconTone === "amber" && (
              <LinearGradient colors={[A.amber, A.amberDeep]} style={StyleSheet.absoluteFill} />
            )}
            {icon}
          </View>

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

          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 2,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
  },
  tileHero: { borderColor: "#3BE3A2", backgroundColor: A.emeraldSurface },
  tileDark: { borderColor: A.gold, backgroundColor: A.ink, ...goldGlow },
  fill: { borderRadius: 18 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.94 },
  innerFrame: {
    position: "absolute",
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: A.goldFaint,
  },
  stud: {
    position: "absolute",
    width: 7,
    height: 7,
    marginTop: -1,
    marginLeft: -1,
    marginRight: -1,
    marginBottom: -1,
    backgroundColor: A.goldLight,
    borderWidth: 1,
    borderColor: A.goldDark,
    transform: [{ rotate: "45deg" }],
  },
  iconBox: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  iconEmerald: {
    backgroundColor: "rgba(3,35,28,0.55)",
    borderWidth: 1.5,
    borderColor: A.goldLine,
  },
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
  badge: {
    position: "absolute",
    top: 10,
    right: 14,
    backgroundColor: A.gold,
    borderRadius: 999,
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: A.goldLight,
  },
  badgeText: { fontFamily: F.bold, fontSize: 10, color: A.ink },
});
