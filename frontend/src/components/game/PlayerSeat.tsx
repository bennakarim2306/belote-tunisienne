import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import Avatar from "@/src/components/Avatar";
import { SUIT_COLOR_ON_DARK, SUIT_SYMBOL } from "@/src/components/PlayingCard";
import { GamePlayer } from "@/src/game/useGameSocket";
import { C, F, R } from "@/src/theme";

function SeatTimer({ deadline }: { deadline: number }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round(deadline - Date.now() / 1000)),
  );
  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, Math.round(deadline - Date.now() / 1000)));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [deadline]);
  return (
    <View
      style={[styles.timerPill, remaining <= 10 && styles.timerPillUrgent]}
      testID="seat-timer"
    >
      <Text style={styles.timerText}>{remaining}s</Text>
    </View>
  );
}

interface Props {
  player: GamePlayer;
  isTurn: boolean;
  isDealer: boolean;
  bidLabel?: string | null;
  bidSuit?: string | null;
  contractLabel?: { text: string; suit: string } | null;
  chatText?: string | null;
  deadline?: number;
  showTimer?: boolean;
  isMe?: boolean;
  size?: number;
  /** where announce/contract/chat bubbles are anchored (default above avatar) */
  bubbleSide?: "top" | "right";
}

export default function PlayerSeat({
  player,
  isTurn,
  isDealer,
  bidLabel,
  bidSuit,
  contractLabel,
  chatText,
  deadline,
  showTimer,
  isMe,
  size = 46,
  bubbleSide = "top",
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
  // when both a chat message and a bid/contract bubble are visible, the chat
  // bubble is stacked ABOVE the bid bubble instead of overlapping behind it
  const hasBid = !!(contractLabel || bidLabel);

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
          ringColor={isMe ? C.gold : "rgba(233,196,106,0.7)"}
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
        {isTurn && showTimer && deadline ? <SeatTimer deadline={deadline} /> : null}
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
      {chatText ? (
        <Animated.View
          entering={ZoomIn.duration(180)}
          style={[
            styles.bubble,
            styles.chatBubble,
            hasBid && bubbleSide === "top" && { top: -60 },
            bubbleSide === "right" && [
              styles.bubbleRight,
              { top: ringSize / 2 - 16 - (hasBid ? 28 : 0), zIndex: 13 },
            ],
          ]}
          testID={`chat-bubble-${player.seat}`}
        >
          <Text style={styles.chatText} numberOfLines={1}>
            {chatText}
          </Text>
        </Animated.View>
      ) : null}
      {contractLabel ? (
        <View
          style={[
            styles.bubble,
            styles.contractBubble,
            bubbleSide === "right" && [styles.bubbleRight, { top: ringSize / 2 - 12 }],
          ]}
          testID={`contract-holder-${player.seat}`}
        >
          <Ionicons name="ribbon" size={11} color="#1A1200" />
          <Text style={[styles.bubbleText, { color: "#1A1200" }]}>
            {" "}
            {contractLabel.text}
            <Text style={{ color: contractLabel.suit === "H" || contractLabel.suit === "D" ? "#B3261E" : "#1A1200" }}>
              {" "}
              {SUIT_SYMBOL[contractLabel.suit]}
            </Text>
          </Text>
        </View>
      ) : bidLabel ? (
        <Animated.View
          style={[
            styles.bubble,
            bubbleSide === "right" && [styles.bubbleRight, { top: ringSize / 2 - 12 }],
          ]}
          entering={undefined}
        >
          <Text style={styles.bubbleText}>
            {bidLabel}
            {bidSuit ? (
              <Text style={{ color: SUIT_COLOR_ON_DARK[bidSuit] }}> {SUIT_SYMBOL[bidSuit]}</Text>
            ) : null}
          </Text>
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
    backgroundColor: C.card,
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    backgroundColor: "rgba(8,26,17,0.8)",
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.5)",
    borderRadius: R.pill,
    paddingHorizontal: 9,
    paddingVertical: 1.5,
  },
  name: {
    fontFamily: F.serifSemi,
    fontSize: 11.5,
    color: C.cream,
    maxWidth: 90,
    textAlign: "center",
  },
  cardCount: {
    backgroundColor: "rgba(8,26,17,0.7)",
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.35)",
    borderRadius: R.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginTop: 2,
  },
  cardCountText: { fontFamily: F.bold, fontSize: 10, color: "rgba(255,255,255,0.85)" },
  bubble: {
    position: "absolute",
    top: -26,
    backgroundColor: C.card,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  bubbleRight: {
    left: 82,
    zIndex: 12,
    maxWidth: 190,
  },
  bubbleText: { fontFamily: F.extra, fontSize: 12, color: C.ink },
  contractBubble: {
    backgroundColor: C.gold,
    flexDirection: "row",
    alignItems: "center",
  },
  chatBubble: {
    top: -34,
    zIndex: 10,
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.brand,
    maxWidth: 170,
  },
  chatText: { fontFamily: F.bold, fontSize: 12, color: C.ink },
  timerPill: {
    position: "absolute",
    bottom: -8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    zIndex: 5,
  },
  timerPillUrgent: {
    backgroundColor: C.error,
    borderColor: C.cream,
  },
  timerText: { fontFamily: F.extra, fontSize: 11, color: C.cream },
});
