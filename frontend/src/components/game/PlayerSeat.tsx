import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  BADGE_BOT,
  BADGE_DEALER,
  BUBBLE_BID,
  BUBBLE_CONTRACT,
  CARD_BACK,
  NAMEPLATE,
  SEAT_FRAME,
} from "@/src/anime/assets";
import BubbleSlice from "@/src/anime/components/BubbleSlice";
import HSlice from "@/src/anime/components/HSlice";
import { ANIME_THEME_ENABLED } from "@/src/anime/flags";
import ChatSticker from "@/src/anime/game/ChatSticker";
import Avatar from "@/src/components/Avatar";
import { SUIT_COLOR_ON_DARK, SUIT_SYMBOL } from "@/src/components/PlayingCard";
import { GamePlayer } from "@/src/game/useGameSocket";
import { C, F, R } from "@/src/theme";

function SeatTimer({ deadline, side = "right" }: { deadline: number; side?: "left" | "right" }) {
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
      style={[
        styles.timerPill,
        side === "left" ? styles.timerLeft : styles.timerRight,
        ANIME_THEME_ENABLED && styles.timerPillAnime,
        remaining <= 10 && styles.timerPillUrgent,
      ]}
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
  /** anime theme: the sender's sticker for a quick-chat phrase (shown with chatText) */
  chatSticker?: ImageSourcePropType | null;
  /** which side of the avatar the sticker goes (toward the table centre) */
  stickerSide?: "left" | "right";
  deadline?: number;
  showTimer?: boolean;
  isMe?: boolean;
  size?: number;
  /** where announce/contract/chat bubbles are anchored (default above avatar) */
  bubbleSide?: "top" | "right";
  /** which side of the avatar the turn countdown sits on (default right) */
  timerSide?: "left" | "right";
  /** tapping the avatar (online games: opens the add-friend player card) */
  onPress?: () => void;
}

const ANIME = ANIME_THEME_ENABLED;

/** Anime theme: painted speech-bubble background (or a coded plaque until the
 *  painted bubbles are delivered). `pointer` = small tail toward the avatar. */
function AnimeBubbleBg({ contract, pointer }: { contract?: boolean; pointer?: boolean }) {
  const slices = contract ? BUBBLE_CONTRACT : BUBBLE_BID;
  // bubbles beside the avatar (pointer=false) clip their bottom tail off
  if (slices) return <BubbleSlice slices={slices} tail={pointer} />;
  return pointer ? (
    <View
      pointerEvents="none"
      style={[styles.animeTail, { borderTopColor: contract ? "#8A6A2B" : "#D6AC56" }]}
    />
  ) : null;
}

export default function PlayerSeat({
  player,
  isTurn,
  isDealer,
  bidLabel,
  bidSuit,
  contractLabel,
  chatText,
  chatSticker,
  stickerSide = "right",
  deadline,
  showTimer,
  isMe,
  size = 46,
  bubbleSide = "top",
  timerSide = "right",
  onPress,
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
  // anime theme: painted medallion frame around the portrait. Its hole matches
  // the avatar's outer diameter (size + ring), so layout sizes stay unchanged.
  const frameW = ((size + 8) / SEAT_FRAME.hole) * 0.97;
  const frameH = frameW / SEAT_FRAME.aspect;
  // when both a chat message and a bid/contract bubble are visible, the chat
  // bubble is stacked ABOVE the bid bubble instead of overlapping behind it
  const hasBid = !!(contractLabel || bidLabel);
  // right-side bubbles must leave room for the countdown sitting beside the
  // avatar, otherwise the contract pill covers the timer
  const timerVisible = !!(
    isTurn && showTimer && deadline && !player.afk && !player.left
  );
  const rightBubbleShift = timerVisible ? 44 : 0;

  return (
    <View style={styles.wrap} testID={`seat-${player.seat}`}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        hitSlop={6}
        testID={`seat-avatar-${player.seat}`}
        style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}
      >
        <Animated.View
          style={[
            styles.turnRing,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
            ANIME_THEME_ENABLED && {
              width: frameW + 8,
              height: frameW + 8,
              borderRadius: (frameW + 8) / 2,
              borderWidth: 4,
              borderColor: "#FFE08A",
            },
            ringStyle,
          ]}
        />
        <Avatar
          avatarId={player.avatar_id}
          size={size}
          ringColor={isMe ? C.gold : "rgba(233,196,106,0.7)"}
          ringWidth={2}
        />
        {ANIME_THEME_ENABLED && (
          <Image
            source={SEAT_FRAME.source}
            resizeMode="stretch"
            fadeDuration={0}
            style={{ position: "absolute", width: frameW, height: frameH }}
          />
        )}
        {isDealer && (
          <View style={[styles.dealerBadge, ANIME && styles.dealerBadgeAnime]} testID={`seat-dealer-${player.seat}`}>
            {ANIME ? (
              <Image source={BADGE_DEALER} style={styles.badgeImg} fadeDuration={0} />
            ) : (
              <Text style={styles.dealerText}>D</Text>
            )}
          </View>
        )}
        {player.is_bot && (
          <View style={[styles.botBadge, ANIME && styles.botBadgeAnime]}>
            {ANIME ? (
              <Image source={BADGE_BOT} style={styles.badgeImg} fadeDuration={0} />
            ) : (
              <Ionicons name="hardware-chip" size={9} color={C.cream} />
            )}
          </View>
        )}
        {!player.is_bot && (player.afk || player.left) && (
          <View style={styles.relayBadge} testID={`seat-relay-${player.seat}`}>
            <Text style={styles.relayText}>🤖</Text>
          </View>
        )}
        {!player.is_bot && !player.afk && !player.left &&
          (player.missed ?? 0) > 0 && (
          <View style={styles.relayBadge} testID={`seat-away-${player.seat}`}>
            <Text style={styles.relayText}>💤</Text>
          </View>
        )}
        {timerVisible && deadline ? (
          <SeatTimer deadline={deadline} side={timerSide} />
        ) : null}
      </Pressable>
      <View style={[styles.nameRow, ANIME_THEME_ENABLED && styles.nameRowAnime]}>
        {ANIME_THEME_ENABLED && <HSlice slices={NAMEPLATE} />}
        <Text style={[styles.name, ANIME_THEME_ENABLED && styles.nameAnime]} numberOfLines={1}>
          {player.username}
        </Text>
      </View>
      {!isMe &&
        (ANIME_THEME_ENABLED ? (
          // painted card backs + the REAL number of cards still in hand
          <View style={styles.cardFan} testID={`seat-cards-${player.seat}`}>
            {player.card_count > 0 && (
              <View style={styles.cardFanBacks}>
                {[0, 1, 2].slice(0, Math.min(3, player.card_count)).map((i) => (
                  <Image
                    key={i}
                    source={CARD_BACK}
                    resizeMode="stretch"
                    fadeDuration={0}
                    style={[styles.cardFanBack, { marginLeft: i === 0 ? 0 : -7 }]}
                  />
                ))}
              </View>
            )}
            <Text style={styles.cardFanCount}>{player.card_count}</Text>
          </View>
        ) : (
          <View style={styles.cardCount}>
            <Text style={styles.cardCountText}>🂠 {player.card_count}</Text>
          </View>
        ))}
      {ANIME && chatText && chatSticker ? (
        <ChatSticker
          source={chatSticker}
          text={chatText}
          side={stickerSide}
          testID={`chat-sticker-${player.seat}`}
        />
      ) : chatText ? (
        <Animated.View
          entering={ZoomIn.duration(180)}
          style={[
            styles.bubble,
            styles.chatBubble,
            ANIME && styles.chatBubbleAnime,
            hasBid && bubbleSide === "top" && { top: -60 },
            bubbleSide === "right" && [
              styles.bubbleRight,
              {
                top: ringSize / 2 - 16 - (hasBid ? 28 : 0),
                zIndex: 13,
                left: 82 + rightBubbleShift,
              },
            ],
          ]}
          testID={`chat-bubble-${player.seat}`}
        >
          <Text style={[styles.chatText, ANIME && styles.chatTextAnime]} numberOfLines={1}>
            {chatText}
          </Text>
        </Animated.View>
      ) : null}
      {contractLabel ? (
        <View
          style={[
            styles.bubble,
            styles.contractBubble,
            ANIME && styles.animeContractBubble,
            bubbleSide === "right" && [
              styles.bubbleRight,
              { top: ringSize / 2 - 12, left: 82 + rightBubbleShift },
            ],
          ]}
          testID={`contract-holder-${player.seat}`}
        >
          {ANIME && <AnimeBubbleBg contract pointer={bubbleSide === "top"} />}
          <Ionicons name="ribbon" size={11} color="#1A1200" />
          <Text style={[styles.bubbleText, { color: "#1A1200" }]} numberOfLines={1}>
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
            ANIME && styles.animeBidBubble,
            bubbleSide === "right" && [
              styles.bubbleRight,
              { top: ringSize / 2 - 12, left: 82 + rightBubbleShift },
            ],
          ]}
          entering={undefined}
        >
          {ANIME && <AnimeBubbleBg pointer={bubbleSide === "top"} />}
          <Text style={[styles.bubbleText, ANIME && styles.animeBidText]} numberOfLines={1}>
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
  relayBadge: {
    position: "absolute",
    top: 0,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.ink2,
    borderWidth: 1,
    borderColor: "rgba(233,196,106,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  relayText: {
    fontSize: 10,
    lineHeight: 13,
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
  // ---- anime theme ----
  dealerBadgeAnime: { width: 25, height: 25, top: -3, right: 0, borderRadius: 13, backgroundColor: "transparent" },
  botBadgeAnime: { width: 21, height: 21, bottom: 0, right: 3, borderRadius: 11, backgroundColor: "transparent" },
  badgeImg: { width: "100%", height: "100%" },
  timerPillAnime: { backgroundColor: "#063F32", borderColor: "#D6AC56" },
  chatBubbleAnime: { backgroundColor: "#FFFDF5", borderColor: "#17130E", borderWidth: 2 },
  chatTextAnime: { color: "#17130E" },
  animeBidBubble: {
    backgroundColor: BUBBLE_BID ? "transparent" : "#063F32",
    borderWidth: BUBBLE_BID ? 0 : 1.5,
    borderColor: "#D6AC56",
    borderRadius: BUBBLE_BID ? 0 : 9,
    paddingHorizontal: 14,
    paddingTop: 3,
    paddingBottom: BUBBLE_BID ? 7 : 3,
    minWidth: 46,
    alignItems: "center",
    shadowOpacity: 0.5,
  },
  animeContractBubble: {
    backgroundColor: BUBBLE_CONTRACT ? "transparent" : "#F4D68C",
    borderWidth: BUBBLE_CONTRACT ? 0 : 1.5,
    borderColor: "#8A6A2B",
    borderRadius: BUBBLE_CONTRACT ? 0 : 9,
    paddingHorizontal: 14,
    paddingTop: 3,
    paddingBottom: BUBBLE_CONTRACT ? 7 : 3,
    minWidth: 46,
  },
  animeBidText: { color: "#FFF5DF" },
  animeTail: {
    position: "absolute",
    bottom: -7,
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  nameRowAnime: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 15,
    paddingVertical: 2.5,
    minWidth: 66,
    justifyContent: "center",
    marginTop: 5,
  },
  nameAnime: { color: "#FFF5DF", maxWidth: 76 },
  cardFan: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardFanBacks: { flexDirection: "row" },
  cardFanBack: { width: 12, height: 17, borderRadius: 2 },
  cardFanCount: {
    fontFamily: F.bold,
    fontSize: 10.5,
    color: "#FFF5DF",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
    top: "50%",
    marginTop: -10,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    zIndex: 5,
  },
  // beside the avatar (never between avatar and name, where there is no room)
  timerRight: { left: "100%", marginLeft: 2 },
  timerLeft: { right: "100%", marginRight: 2 },
  timerPillUrgent: {
    backgroundColor: C.error,
    borderColor: C.cream,
  },
  timerText: { fontFamily: F.extra, fontSize: 11, color: C.cream },
});
