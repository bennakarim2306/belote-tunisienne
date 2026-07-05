import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { withTiming } from "react-native-reanimated";

import PlayingCard from "@/src/components/PlayingCard";
import { TrickCard } from "@/src/game/useGameSocket";

const CARD_W = 56;

// rel position offsets: 0 = me (bottom), 1 = right, 2 = top (partner), 3 = left
const OFFSETS = [
  { x: 0, y: 42 },
  { x: 58, y: 0 },
  { x: 0, y: -42 },
  { x: -58, y: 0 },
];
const ROTATIONS = ["-2deg", "7deg", "3deg", "-7deg"];

const makeEnter = (dx: number, dy: number) => {
  return (values: {
    targetOriginX: number;
    targetOriginY: number;
  }) => {
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

const makeExit = (dx: number, dy: number) => {
  return (values: { currentOriginX: number; currentOriginY: number }) => {
    "worklet";
    return {
      initialValues: {
        originX: values.currentOriginX,
        originY: values.currentOriginY,
        opacity: 1,
      },
      animations: {
        originX: withTiming(values.currentOriginX + dx, { duration: 340 }),
        originY: withTiming(values.currentOriginY + dy, { duration: 340 }),
        opacity: withTiming(0, { duration: 340 }),
      },
    };
  };
};

// entering from each rel direction (card flies in from the player's seat)
const ENTER_FROM = [
  makeEnter(0, 190),
  makeEnter(210, 0),
  makeEnter(0, -190),
  makeEnter(-210, 0),
];
// exiting toward winner's seat
const EXIT_TO = [
  makeExit(0, 260),
  makeExit(300, 0),
  makeExit(0, -260),
  makeExit(-300, 0),
];

interface Props {
  trick: TrickCard[];
  lastTrick: { winner_seat: number; cards: TrickCard[] } | null;
  showLastTrick: boolean;
  mySeat: number;
  trump: string | null;
}

export default function TrickArea({ trick, lastTrick, showLastTrick, mySeat, trump }: Props) {
  const rel = (seat: number) => (seat - mySeat + 4) % 4;
  const cards = showLastTrick && lastTrick ? lastTrick.cards : trick;
  const winnerRel = lastTrick ? rel(lastTrick.winner_seat) : 0;

  return (
    <View style={styles.area} pointerEvents="none" testID="trick-area">
      {cards.map((tc) => {
        const r = rel(tc.seat);
        const off = OFFSETS[r];
        return (
          <Animated.View
            key={`${tc.seat}-${tc.card}`}
            entering={ENTER_FROM[r]}
            exiting={EXIT_TO[winnerRel]}
            style={[
              styles.cardPos,
              {
                transform: [
                  { translateX: off.x },
                  { translateY: off.y },
                  { rotate: ROTATIONS[r] },
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
});
