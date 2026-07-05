import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import PlayingCard from "@/src/components/PlayingCard";

interface Props {
  hand: string[];
  legal: string[];
  myTurn: boolean;
  trump: string | null;
  onPlay: (card: string) => void;
}

export default function HandFan({ hand, legal, myTurn, trump, onPlay }: Props) {
  const { width } = useWindowDimensions();
  const n = hand.length;
  if (n === 0) return <View style={styles.row} />;

  const overlap = 0.6;
  const maxW = Math.min(width - 24, 560);
  const cardW = Math.min(76, maxW / (1 + (n - 1) * overlap));
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
        const rot = (i - mid) * 2.5;
        const lift = Math.abs(i - mid) * Math.abs(i - mid) * 1.1;
        return (
          <Animated.View
            key={card}
            entering={FadeInDown.delay(i * 55).springify().damping(16)}
            layout={LinearTransition.springify().damping(18)}
            style={[
              { marginLeft: i === 0 ? 0 : -cardW * (1 - overlap) },
              { zIndex: i },
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
                <PlayingCard
                  card={card}
                  width={cardW}
                  trumpSuit={trump}
                  dimmed={myTurn && !playable}
                />
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
    minHeight: 126,
    paddingTop: 14,
    paddingBottom: 10,
  },
});
