import React, { memo } from "react";
import { Image, StyleSheet, View } from "react-native";

import { BG_ARENA } from "@/src/anime/assets";
import { A } from "@/src/anime/tokens";

// Painted courtyard background (emerald wall, gilded arches, lanterns, medina).
// Purely decorative: it never receives touches and carries no control.
// Drawn "cover" and centred, so on narrower screens the outer arches are
// cropped first while the lanterns and the calm wall stay visible.

/** Scale and horizontal crop of the centred "cover" image for a given view. */
const coverMetrics = (width: number, height: number) => {
  const scale = Math.max(width / BG_ARENA.width, height / BG_ARENA.height);
  return { scale, cropX: (BG_ARENA.width * scale - width) / 2 };
};

/** Distance from either screen edge to where the calm wall starts, i.e.
 *  how far the menu grid must be inset to clear arch, column and lantern. */
export const arenaContentInset = (width: number, height: number) => {
  if (width <= 0 || height <= 0) return 0;
  const { scale, cropX } = coverMetrics(width, height);
  return Math.max(0, BG_ARENA.sideFeatureEnd * scale - cropX);
};

function ArenaBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none" testID="anime-arena-background">
      <Image source={BG_ARENA.source} resizeMode="cover" style={styles.img} fadeDuration={0} />
      {/* keeps the top bar readable over foliage and arches */}
      <View style={styles.topShade} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: A.emeraldDeep },
  img: { width: "100%", height: "100%" },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: "rgba(3,35,28,0.38)",
  },
});

export default memo(ArenaBackground);
