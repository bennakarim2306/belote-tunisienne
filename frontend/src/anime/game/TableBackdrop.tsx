import React, { memo, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";

import { BG_GAME, TABLE_TOP } from "@/src/anime/assets";
import { A } from "@/src/anime/tokens";

// Painted backdrop of the game screen: palace courtyard + the card table top
// centred where the trick is played. Purely decorative (no touches); every
// card, seat and control is drawn by the real game components above it.

function TableBackdrop() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) {
      setSize({ w: width, h: height });
    }
  };
  const { w, h } = size;
  // the table spans most of the width between the side seats and stays clear
  // of the header (top) and of the hand (bottom)
  const tableW = Math.min(w * 0.8, h * 0.72 * TABLE_TOP.aspect);
  const tableH = tableW / TABLE_TOP.aspect;
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none" onLayout={onLayout} testID="anime-table-backdrop">
      <Image source={BG_GAME} resizeMode="cover" style={styles.fill} fadeDuration={0} />
      <View style={styles.shade} />
      {w > 0 && (
        <Image
          source={TABLE_TOP.source}
          resizeMode="stretch"
          fadeDuration={0}
          style={{
            position: "absolute",
            width: tableW,
            height: tableH,
            left: (w - tableW) / 2,
            top: (h - tableH) / 2 - h * 0.035,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: A.emeraldInk },
  fill: { width: "100%", height: "100%" },
  // calms the background so cards, names and bubbles stay the brightest things
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3,20,16,0.28)" },
});

export default memo(TableBackdrop);
