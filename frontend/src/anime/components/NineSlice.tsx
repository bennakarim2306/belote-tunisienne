import React, { memo } from "react";
import { Image, ImageSourcePropType, PixelRatio, StyleSheet, View, ViewStyle } from "react-native";

import { NineSliceSource } from "@/src/anime/assets";

// Cross-platform 9-slice panel: the four corners keep their painted shape,
// edges and centre stretch. (React Native's `capInsets` is iOS-only, so the
// panel is pre-cut into nine images by scripts/anime/prepare-assets.ps1.)
// Fills its parent; purely decorative.

const OVERLAP = 0.5; // dp — edges/centre tuck under their neighbours to hide seams

function Piece({ source, style }: { source: ImageSourcePropType; style: ViewStyle }) {
  return (
    <View style={[styles.piece, style]}>
      <Image source={source} resizeMode="stretch" style={styles.img} fadeDuration={0} />
    </View>
  );
}

interface Props {
  slices: NineSliceSource;
  /** override the corner size (dp), e.g. to shrink it on very small tiles */
  corner?: number;
}

function NineSlice({ slices, corner }: Props) {
  const c = PixelRatio.roundToNearestPixel(corner ?? slices.corner);
  const e = c - OVERLAP;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Piece source={slices.c} style={{ left: e, right: e, top: e, bottom: e }} />
      <Piece source={slices.t} style={{ left: e, right: e, top: 0, height: c }} />
      <Piece source={slices.b} style={{ left: e, right: e, bottom: 0, height: c }} />
      <Piece source={slices.l} style={{ left: 0, width: c, top: e, bottom: e }} />
      <Piece source={slices.r} style={{ right: 0, width: c, top: e, bottom: e }} />
      <Piece source={slices.tl} style={{ left: 0, top: 0, width: c, height: c }} />
      <Piece source={slices.tr} style={{ right: 0, top: 0, width: c, height: c }} />
      <Piece source={slices.bl} style={{ left: 0, bottom: 0, width: c, height: c }} />
      <Piece source={slices.br} style={{ right: 0, bottom: 0, width: c, height: c }} />
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", overflow: "hidden" },
  img: { width: "100%", height: "100%" },
});

export default memo(NineSlice);
