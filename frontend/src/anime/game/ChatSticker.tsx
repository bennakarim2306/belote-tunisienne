import React from "react";
import { I18nManager, Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, Keyframe } from "react-native-reanimated";

import { F } from "@/src/theme";

// Anime theme: a quick-chat message shown as the sender's character sticker
// plus a manga speech bubble with the UNCHANGED translated message text.
// The sticker images contain no text, so the text follows the app language.

export const STICKER_SIZE = 86;

/** One flashy pop out of the avatar: starts small at the avatar, overshoots
 *  once, settles — then stays completely still (no spring, no wobble). */
const popFrom = (side: "left" | "right") => {
  const fromX = side === "right" ? -70 : 70; // the avatar sits on the other side
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateX: fromX }, { scale: 0.15 }] },
    65: {
      opacity: 1,
      transform: [{ translateX: 0 }, { scale: 1.14 }],
      easing: Easing.out(Easing.cubic),
    },
    100: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }], easing: Easing.inOut(Easing.quad) },
  }).duration(280);
};
const POP = { left: popFrom("left"), right: popFrom("right") };

interface Props {
  source: ImageSourcePropType;
  text: string;
  /** which side of the avatar the sticker sits on (toward the table centre) */
  side: "left" | "right";
  testID?: string;
}

export default function ChatSticker({ source, text, side, testID }: Props) {
  return (
    <Animated.View
      entering={POP[side]}
      pointerEvents="none"
      style={[styles.wrap, side === "right" ? styles.right : styles.left]}
      testID={testID}
    >
      <Image source={source} style={styles.sticker} fadeDuration={0} resizeMode="contain" />
      <View style={[styles.bubble, side === "right" ? styles.bubbleRight : styles.bubbleLeft]}>
        {/* tail pointing back at the sticker */}
        <View style={[styles.tailOuter, side === "right" ? styles.tailOuterR : styles.tailOuterL]} />
        <View style={[styles.tailInner, side === "right" ? styles.tailInnerR : styles.tailInnerL]} />
        <Text
          style={[styles.text, I18nManager.isRTL && { writingDirection: "rtl" }]}
          numberOfLines={2}
        >
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

const INK = "#17130E";
const PAPER = "#FFFDF5";

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: -4,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  // anchored beside the 92-wide seat column
  right: { left: 80 },
  left: { right: 80, flexDirection: "row-reverse" },
  sticker: { width: STICKER_SIZE, height: STICKER_SIZE },
  bubble: {
    maxWidth: 150,
    backgroundColor: PAPER,
    borderWidth: 2.5,
    borderColor: INK,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: -26,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 6,
  },
  bubbleRight: { marginLeft: 6, transform: [{ rotate: "-3deg" }] },
  bubbleLeft: { marginRight: 6, transform: [{ rotate: "3deg" }] },
  text: {
    fontFamily: F.display,
    fontSize: 13,
    lineHeight: 16,
    color: INK,
    textAlign: "center",
  },
  // two stacked triangles = outlined manga tail
  tailOuter: {
    position: "absolute",
    bottom: 4,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  tailOuterR: { left: -13, borderRightWidth: 12, borderRightColor: INK },
  tailOuterL: { right: -13, borderLeftWidth: 12, borderLeftColor: INK },
  tailInner: {
    position: "absolute",
    bottom: 6.5,
    width: 0,
    height: 0,
    borderTopWidth: 5.5,
    borderBottomWidth: 5.5,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  tailInnerR: { left: -8, borderRightWidth: 8, borderRightColor: PAPER },
  tailInnerL: { right: -8, borderLeftWidth: 8, borderLeftColor: PAPER },
});
