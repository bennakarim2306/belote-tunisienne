import React, { memo, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";

import { BubbleSliceSource } from "@/src/anime/assets";

// Painted speech bubble that stretches with its label: rounded caps and the
// centred tail keep their shape, only the plain body strips stretch.
// `tail=false` clips the tail off (bubbles placed beside an avatar).
// Fills its parent; never takes touches.

function BubbleSlice({ slices, tail = true }: { slices: BubbleSliceSource; tail?: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - box.w) > 0.5 || Math.abs(height - box.h) > 0.5) setBox({ w: width, h: height });
  };
  // with the tail clipped, the body alone must fill the box
  const h = tail ? box.h : box.h / slices.body;
  const cap = Math.round(h * slices.capRatio);
  const tw = Math.round(h * slices.tailRatio);
  const tx = (box.w - tw) / 2;
  const piece = (src: typeof slices.l, left: number, width: number) => (
    <View style={[styles.piece, { left, width, height: h }]}>
      <Image source={src} resizeMode="stretch" style={styles.img} fadeDuration={0} />
    </View>
  );
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" onLayout={onLayout}>
      {box.w > 0 && (
        <>
          {piece(slices.m, cap - 0.5, tx - cap + 1)}
          {piece(slices.m, tx + tw - 0.5, box.w - cap - tx - tw + 1)}
          {piece(slices.tail, tx, tw)}
          {piece(slices.l, 0, cap)}
          {piece(slices.r, box.w - cap, cap)}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  piece: { position: "absolute", top: 0, overflow: "hidden" },
  img: { width: "100%", height: "100%" },
});

export default memo(BubbleSlice);
