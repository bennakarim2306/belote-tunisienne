import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const CARD_DELAY = 55;
const CARD_DUR = 360;

// rel targets (clockwise LANDSCAPE table): 0 = me (bottom), 1 = left, 2 = top, 3 = right
const TARGETS = [
  { x: 0, y: 130 },
  { x: -300, y: 0 },
  { x: 0, y: -125 },
  { x: 300, y: 0 },
];

function FlyingCard({ rel, index }: { rel: number; index: number }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      index * CARD_DELAY,
      withTiming(1, { duration: CARD_DUR, easing: Easing.out(Easing.quad) }),
    );
  }, [index, p]);

  const jitterX = ((index * 37) % 26) - 13;
  const jitterY = ((index * 53) % 18) - 9;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.06, 0.82, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(p.value, [0, 1], [0, TARGETS[rel].x + jitterX]) },
      { translateY: interpolate(p.value, [0, 1], [0, TARGETS[rel].y + jitterY]) },
      { rotate: `${interpolate(p.value, [0, 1], [0, 160 + jitterX * 4])}deg` },
      { scale: interpolate(p.value, [0, 1], [0.75, 1]) },
    ],
  }));

  return <Animated.View style={[styles.card, style]} />;
}

interface Props {
  mySeat: number;
  dealer: number;
  onDone: () => void;
}

export default function DealAnimation({ mySeat, dealer, onDone }: Props) {
  // deal order: one card at a time, starting left of dealer, round robin, 8 rounds
  const order = useMemo(() => {
    const arr: number[] = [];
    for (let round = 0; round < 8; round++) {
      for (let k = 0; k < 4; k++) {
        const seat = (dealer + 1 + k) % 4;
        arr.push((seat - mySeat + 4) % 4);
      }
    }
    return arr;
  }, [dealer, mySeat]);

  // onDone via ref: the parent re-renders every second during timed games
  // (turn countdown), and an inline onDone prop would otherwise reset this
  // timeout on every render — so it would NEVER fire for the first bidder.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const total = order.length * CARD_DELAY + CARD_DUR + 250;
    const tm = setTimeout(() => onDoneRef.current(), total);
    return () => clearTimeout(tm);
  }, [order]);

  return (
    <View style={styles.overlay} pointerEvents="none" testID="deal-animation">
      {/* deck stack at the centre of the table */}
      <View style={styles.deckWrap}>
        {[2, 1, 0].map((i) => (
          <View
            key={i}
            style={[styles.card, styles.deckCard, { top: -i * 2, left: -i * 2 }]}
          />
        ))}
      </View>
      {order.map((rel, i) => (
        <FlyingCard key={i} rel={rel} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  deckWrap: {
    position: "absolute",
    width: 40,
    height: 56,
  },
  deckCard: {
    position: "absolute",
  },
  card: {
    position: "absolute",
    width: 38,
    height: 54,
    borderRadius: 6,
    backgroundColor: "#1C1714",
    borderWidth: 1.5,
    borderColor: "#FF7B00",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 4,
  },
});
