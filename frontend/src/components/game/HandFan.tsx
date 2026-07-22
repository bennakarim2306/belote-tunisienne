import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import PlayingCard from "@/src/components/PlayingCard";

interface Props {
  hand: string[];
  legal: string[];
  myTurn: boolean;
  trump: string | null;
  onPlay: (card: string) => void;
  coachCard?: string | null; // tutorial coach suggestion: pulsing gold ring
}

// Pulsing golden highlight around the card suggested by the tutorial coach.
function CoachPulse({ children, radius }: { children: React.ReactNode; radius: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [v]);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * v.value }] }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 + 0.5 * v.value }));
  return (
    <Animated.View style={lift}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          // explicit offsets (not StyleSheet.absoluteFill) — reliable everywhere
          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
          { borderWidth: 3, borderColor: "#FFBE3C", borderRadius: radius },
          ring,
        ]}
      />
    </Animated.View>
  );
}

export default function HandFan({ hand, legal, myTurn, trump, onPlay, coachCard }: Props) {
  const { width, height } = useWindowDimensions();
  const n = hand.length;
  if (n === 0) return <View style={styles.row} />;

  const overlap = 0.55;
  const maxW = Math.min(width * 0.79, 816);
  // width-driven size (+20%) but capped by screen height so the hand
  // never overwhelms small landscape phones
  const cardW = Math.min(90, height * 0.22, maxW / (1 + (n - 1) * overlap));
  const mid = (n - 1) / 2;

  const play = (card: string) => {
    if (!myTurn || !legal.includes(card)) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPlay(card);
  };

  return (
    <View style={styles.row} testID="hand-fan">
      {hand.map((card, i) => {
        const playable = myTurn && legal.includes(card);
        const isCoach = playable && coachCard === card;
        const rot = (i - mid) * 2.2;
        const lift = Math.abs(i - mid) * Math.abs(i - mid) * 0.5;
        const cardEl = (
          <PlayingCard
            card={card}
            width={cardW}
            trumpSuit={trump}
            dimmed={myTurn && !playable}
          />
        );
        return (
          <Animated.View
            key={card}
            entering={FadeInDown.duration(300)
              .delay(420 + i * 230)
              .easing(Easing.out(Easing.cubic))}
            layout={LinearTransition.duration(180).easing(Easing.out(Easing.quad))}
            style={[
              { marginLeft: i === 0 ? 0 : -cardW * (1 - overlap) },
              { zIndex: isCoach ? 100 : i },
            ]}
          >
            <View
              style={{
                transform: [
                  { rotate: `${rot}deg` },
                  { translateY: lift + (playable ? -10 : 0) },
                ],
              }}
            >
              <Pressable
                testID={`hand-card-${card}`}
                onPress={() => play(card)}
                disabled={!playable}
              >
                {isCoach ? (
                  <CoachPulse radius={cardW * 0.14}>{cardEl}</CoachPulse>
                ) : (
                  cardEl
                )}
              </Pressable>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 132,
    paddingTop: 6,
    paddingBottom: 4,
  },
});
