import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import PlayingCard from "@/src/components/PlayingCard";
import { TrickCard } from "@/src/game/useGameSocket";
import { C, F } from "@/src/theme";

const CARD_W = 56;

// rel position offsets — CLOCKWISE play direction on screen:
// 0 = me (bottom), 1 = next player (LEFT), 2 = partner (top), 3 = previous (RIGHT)
const OFFSETS = [
  { x: 0, y: 42 },
  { x: -58, y: 0 },
  { x: 0, y: -42 },
  { x: 58, y: 0 },
];
const ROTATIONS_DEG = [-2, -7, 3, 7];

// where the collected pile flies to (toward the winner's seat, off the table)
const COLLECT_TARGETS = [
  { x: 0, y: 260 },
  { x: -280, y: 0 },
  { x: 0, y: -250 },
  { x: 280, y: 0 },
];

const makeEnter = (dx: number, dy: number) => {
  return (values: { targetOriginX: number; targetOriginY: number }) => {
    "worklet";
    return {
      initialValues: {
        originX: values.targetOriginX + dx,
        originY: values.targetOriginY + dy,
        opacity: 0.3,
      },
      animations: {
        originX: withTiming(values.targetOriginX, { duration: 280 }),
        originY: withTiming(values.targetOriginY, { duration: 280 }),
        opacity: withTiming(1, { duration: 200 }),
      },
    };
  };
};

// entering from each rel direction (card flies in from the player's seat)
const ENTER_FROM = [
  makeEnter(0, 190),
  makeEnter(-210, 0),
  makeEnter(0, -190),
  makeEnter(210, 0),
];

interface CollectingProps {
  tc: TrickCard;
  rel: number;
  winnerRel: number;
  index: number;
  trump: string | null;
  progress: Animated.SharedValue<number>;
}

function CollectingCard({ tc, rel, winnerRel, index, trump, progress }: CollectingProps) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const gather = interpolate(p, [0, 0.38], [0, 1], Extrapolation.CLAMP);
    const fly = interpolate(p, [0.5, 1], [0, 1], Extrapolation.CLAMP);
    const x = OFFSETS[rel].x * (1 - gather) + COLLECT_TARGETS[winnerRel].x * fly;
    const y = OFFSETS[rel].y * (1 - gather) + COLLECT_TARGETS[winnerRel].y * fly;
    const rot = ROTATIONS_DEG[rel] * (1 - gather) + (index - 1.5) * 6 * gather;
    return {
      opacity: interpolate(p, [0.82, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale: interpolate(p, [0.5, 1], [1, 0.55], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.cardPos, style]}>
      <PlayingCard card={tc.card} width={CARD_W} trumpSuit={trump} />
    </Animated.View>
  );
}

function PointsFly({
  winnerRel,
  points,
  progress,
}: {
  winnerRel: number;
  points: number;
  progress: Animated.SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const fly = interpolate(p, [0.45, 1], [0, 0.55], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p, [0.3, 0.45, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: COLLECT_TARGETS[winnerRel].x * fly },
        { translateY: COLLECT_TARGETS[winnerRel].y * fly },
        { scale: interpolate(p, [0.3, 0.55], [0.5, 1.15], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.pointsFly, style]} testID="trick-points-fly">
      <Text style={styles.pointsText}>+{points}</Text>
    </Animated.View>
  );
}

interface Props {
  trick: TrickCard[];
  lastTrick: { winner_seat: number; cards: TrickCard[]; points: number } | null;
  showLastTrick: boolean;
  mySeat: number;
  trump: string | null;
}

export default function TrickArea({ trick, lastTrick, showLastTrick, mySeat, trump }: Props) {
  const progress = useSharedValue(0);
  const rel = (seat: number) => (seat - mySeat + 4) % 4;

  useEffect(() => {
    if (showLastTrick && lastTrick) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.cubic),
      });
    }
  }, [showLastTrick, lastTrick, progress]);

  if (showLastTrick && lastTrick) {
    const wr = rel(lastTrick.winner_seat);
    return (
      <View style={styles.area} pointerEvents="none" testID="trick-area">
        {lastTrick.cards.map((tc, i) => (
          <CollectingCard
            key={`${tc.seat}-${tc.card}`}
            tc={tc}
            rel={rel(tc.seat)}
            winnerRel={wr}
            index={i}
            trump={trump}
            progress={progress}
          />
        ))}
        <PointsFly winnerRel={wr} points={lastTrick.points} progress={progress} />
      </View>
    );
  }

  return (
    <View style={styles.area} pointerEvents="none" testID="trick-area">
      {trick.map((tc) => {
        const r = rel(tc.seat);
        const off = OFFSETS[r];
        return (
          <Animated.View
            key={`${tc.seat}-${tc.card}`}
            entering={ENTER_FROM[r]}
            style={[
              styles.cardPos,
              {
                transform: [
                  { translateX: off.x },
                  { translateY: off.y },
                  { rotate: `${ROTATIONS_DEG[r]}deg` },
                ],
              },
            ]}
          >
            <PlayingCard card={tc.card} width={CARD_W} trumpSuit={trump} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardPos: {
    position: "absolute",
  },
  pointsFly: {
    position: "absolute",
    backgroundColor: C.gold,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
  },
  pointsText: {
    fontFamily: F.display,
    fontSize: 18,
    color: C.ink,
  },
});
