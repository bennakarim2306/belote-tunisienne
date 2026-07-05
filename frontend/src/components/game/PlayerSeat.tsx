import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import Avatar from "@/src/components/Avatar";
import { GamePlayer } from "@/src/game/useGameSocket";
import { C, F, R } from "@/src/theme";

interface Props {
  player: GamePlayer;
  isTurn: boolean;
  isDealer: boolean;
  bidLabel?: string | null;
  isMe?: boolean;
  size?: number;
}

export default function PlayerSeat({
  player,
  isTurn,
  isDealer,
  bidLabel,
  isMe,
  size = 46,
}: Props) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isTurn) {
      pulse.value = withRepeat(withTiming(1, { duration: 650 }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 150 });
    }
  }, [isTurn, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.1 }],
    opacity: isTurn ? 0.5 + pulse.value * 0.5 : 0,
  }));

  const ringSize = size + 18;

  return (
    <View style={styles.wrap} testID={`seat-${player.seat}`}>
      <View style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            styles.turnRing,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
            ringStyle,
          ]}
        />
        <Avatar
          avatarId={player.avatar_id}
          size={size}
          ringColor={isMe ? C.gold : "rgba(255,255,255,0.35)"}
          ringWidth={2}
        />
        {isDealer && (
          <View style={styles.dealerBadge}>
            <Text style={styles.dealerText}>D</Text>
          </View>
        )}
        {player.is_bot && (
          <View style={styles.botBadge}>
            <Ionicons name="hardware-chip" size={9} color={C.cream} />
          </View>
        )}
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {player.username}
        </Text>
      </View>
      {!isMe && (
        <View style={styles.cardCount}>
          <Text style={styles.cardCountText}>🂠 {player.card_count}</Text>
        </View>
      )}
      {bidLabel ? (
        <Animated.View style={styles.bubble} entering={undefined}>
          <Text style={styles.bubbleText}>{bidLabel}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: 92 },
  turnRing: {
    position: "absolute",
    borderWidth: 3,
    borderColor: C.gold,
  },
  dealerBadge: {
    position: "absolute",
    top: 0,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  dealerText: { fontFamily: F.extra, fontSize: 10, color: C.ink },
  botBadge: {
    position: "absolute",
    bottom: 2,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.ink2,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  name: {
    fontFamily: F.bold,
    fontSize: 11.5,
    color: C.cream,
    maxWidth: 90,
    textAlign: "center",
  },
  cardCount: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: R.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginTop: 2,
  },
  cardCountText: { fontFamily: F.bold, fontSize: 10, color: "rgba(255,255,255,0.85)" },
  bubble: {
    position: "absolute",
    top: -26,
    backgroundColor: C.cream,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  bubbleText: { fontFamily: F.extra, fontSize: 12, color: C.ink },
});
