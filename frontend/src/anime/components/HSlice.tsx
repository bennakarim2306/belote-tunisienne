import React, { memo, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";

import { HSliceSource } from "@/src/anime/assets";

// Horizontal 3-slice background for painted buttons and plaques: the two end
// caps keep their shape (they scale with the height), the centre stretches.
// Fills its parent and never takes touches — the parent Pressable stays the
// real control.

function HSlice({ slices, opacity = 1 }: { slices: HSliceSource; opacity?: number }) {
  const [h, setH] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (Math.abs(next - h) > 0.5) setH(next);
  };
  const cap = Math.round(h * slices.capRatio);
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none" onLayout={onLayout}>
      {h > 0 && (
        <>
          <View style={[styles.piece, { left: cap - 0.5, right: cap - 0.5 }]}>
            <Image source={slices.c} resizeMode="stretch" style={styles.img} fadeDuration={0} />
          </View>
          <View style={[styles.piece, { left: 0, width: cap }]}>
            <Image source={slices.l} resizeMode="stretch" style={styles.img} fadeDuration={0} />
          </View>
          <View style={[styles.piece, { right: 0, width: cap }]}>
            <Image source={slices.r} resizeMode="stretch" style={styles.img} fadeDuration={0} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", top: 0, bottom: 0, overflow: "hidden" },
  img: { width: "100%", height: "100%" },
});

export default memo(HSlice);
