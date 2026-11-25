import React, { memo, useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ANIME_THEME_ENABLED } from "@/src/anime/flags";
import { A } from "@/src/anime/tokens";
import { C } from "@/src/theme";

const COLORS = ANIME_THEME_ENABLED
  ? [A.gold, A.goldLight, A.jade, A.red, A.ivory]
  : [C.brand, C.gold, C.brand2, C.brand3, C.cream];
const PIECE_COUNT = 36;

interface PieceParams {
  x0: number;
  delay: number;
  drift: number;
  sway: number;
  rot: number;
  size: number;
  color: string;
  tall: boolean;
}

function ConfettiPiece({
  progress,
  p,
  height,
}: {
  progress: SharedValue<number>;
  p: PieceParams;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(Math.max((progress.value - p.delay) / (1 - p.delay), 0), 1);
    return {
      opacity: t <= 0 || t >= 1 ? 0 : t > 0.85 ? (1 - t) / 0.15 : 1,
      transform: [
        { translateX: p.x0 + Math.sin(t * Math.PI * p.sway) * p.drift },
        { translateY: -60 + t * (height + 120) },
        { rotate: `${t * p.rot}deg` },
        { rotateX: `${t * p.rot * 1.6}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: p.size,
          height: p.tall ? p.size * 2.2 : p.size,
          backgroundColor: p.color,
          borderRadius: p.size / 4,
        },
        style,
      ]}
    />
  );
}

// Confetti rain driven by a single shared progress value (performant: one clock).
// Runs 4 bursts (~13s) then stops on its own.
export default memo(function VictoryCelebration() {
  const { width, height } = Dimensions.get("window");
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.linear }),
      4,
      false,
    );
  }, [progress]);

  const pieces = useMemo<PieceParams[]>(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        x0: Math.random() * width,
        delay: Math.random() * 0.5,
        drift: (24 + Math.random() * 56) * (Math.random() > 0.5 ? 1 : -1),
        sway: 1.5 + Math.random() * 2.5,
        rot: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 480),
        size: 7 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        tall: Math.random() > 0.45,
      })),
    [width],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="victory-confetti">
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} progress={progress} p={p} height={height} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  piece: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
