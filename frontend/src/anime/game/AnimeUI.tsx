import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import {
  BTN_DARK,
  BTN_GREEN,
  BTN_RED,
  HSliceSource,
  MODAL_FRAME,
  TITLE_RIBBON,
} from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import NineSlice from "@/src/anime/components/NineSlice";
import { ANIME_THEME_ENABLED } from "@/src/anime/flags";
import { A } from "@/src/anime/tokens";
import ChunkyButton from "@/src/components/ChunkyButton";
import { F, SP } from "@/src/theme";

// Shared building blocks for the in-game windows of the anime theme
// (score history, quick chat, last trick). Visual only: callers keep their
// own state, handlers and testIDs.

/** Painted window frame; place as the first child of the window container. */
export function AnimeWindowFrame() {
  return <NineSlice slices={MODAL_FRAME} />;
}

/** Window title on the painted ribbon. */
export function AnimeTitle({ text, testID }: { text: string; testID?: string }) {
  return (
    <View style={styles.titleWrap}>
      <View style={styles.titleRibbon}>
        <HSlice slices={TITLE_RIBBON} />
        <Text style={styles.titleText} numberOfLines={1} testID={testID}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const VARIANTS: Record<"green" | "red" | "dark", HSliceSource> = {
  green: BTN_GREEN,
  red: BTN_RED,
  dark: BTN_DARK,
};

/** Painted button (same art as the bidding buttons). */
export function AnimeButton({
  label,
  onPress,
  variant = "dark",
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "green" | "red" | "dark";
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        // same light tap feedback as the original ChunkyButton
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <HSlice slices={VARIANTS[variant]} />
      <Text style={styles.buttonText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type ChunkyProps = React.ComponentProps<typeof ChunkyButton>;
const FROM_CHUNKY: Record<NonNullable<ChunkyProps["variant"]>, "green" | "red" | "dark"> = {
  primary: "green",
  gold: "green",
  danger: "red",
  secondary: "dark",
  ghost: "dark",
};

/** Drop-in for ChunkyButton on the game screen: painted button in the anime
 *  theme, the untouched ChunkyButton otherwise. */
export function GameButton(props: ChunkyProps) {
  if (!ANIME_THEME_ENABLED) return <ChunkyButton {...props} />;
  return (
    <AnimeButton
      label={props.label}
      onPress={props.onPress}
      testID={props.testID}
      variant={FROM_CHUNKY[props.variant ?? "primary"]}
      style={[props.style?.flex ? { minWidth: 0, alignSelf: "auto", paddingHorizontal: SP.lg } : null, props.style]}
    />
  );
}

/** Container style for a centred anime window (replaces the dark quitCard). */
export const animeWindow: ViewStyle = {
  width: "100%",
  maxWidth: 440,
  backgroundColor: "transparent",
  paddingHorizontal: SP.xl + 6,
  paddingTop: SP.xl,
  paddingBottom: SP.xl,
};

export const animeText = StyleSheet.create({
  body: { fontFamily: F.bold, fontSize: 13, color: A.ivory, textAlign: "center" },
  muted: { fontFamily: F.text, fontSize: 12.5, color: A.ivoryDim, textAlign: "center" },
  accent: { fontFamily: F.serif, fontSize: 17, color: A.goldLight, textAlign: "center" },
});

const styles = StyleSheet.create({
  titleWrap: { alignItems: "center", marginTop: -SP.xs },
  titleRibbon: {
    minWidth: 200,
    height: 40,
    paddingHorizontal: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontFamily: F.serif,
    fontSize: 18,
    color: A.goldLight,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  button: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP.xl,
    alignSelf: "center",
    minWidth: 180,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  buttonText: {
    fontFamily: F.display,
    fontSize: 14,
    color: A.ivory,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
