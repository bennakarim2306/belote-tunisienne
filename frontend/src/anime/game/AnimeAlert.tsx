import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeOut, Keyframe } from "react-native-reanimated";

import { EmblemKind, HUD_PANEL, TURN_BANNER } from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import NineSlice from "@/src/anime/components/NineSlice";
import Emblem from "@/src/anime/game/Emblem";
import { A } from "@/src/anime/tokens";
import { F } from "@/src/theme";

// Table alert of the anime theme. With an emblem (Belote, Contre, new deal…)
// the text sits on the gold scroll below it; plain messages (a player is
// absent, pause refused) use the small emerald panel. One pop, then still.

const POP = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.3 }] },
  65: { opacity: 1, transform: [{ scale: 1.1 }], easing: Easing.out(Easing.cubic) },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.inOut(Easing.quad) },
}).duration(300);

export default function AnimeAlert({
  text,
  emblem,
  compact,
}: {
  text: string;
  emblem?: EmblemKind;
  /** small and high up, so the panel with the player's buttons stays readable */
  compact?: boolean;
}) {
  return (
    <View style={[styles.layer, compact && styles.layerCompact]} pointerEvents="none">
      <Animated.View entering={POP} exiting={FadeOut} style={styles.box}>
        {emblem ? (
          <>
            <Emblem kind={emblem} size={compact ? 62 : 116} />
            <View style={[styles.scroll, compact && styles.scrollCompact]}>
              {TURN_BANNER && <HSlice slices={TURN_BANNER} />}
              <Text style={[styles.scrollText, compact && styles.scrollTextCompact]} numberOfLines={1} adjustsFontSizeToFit testID="game-banner-text">
                {text}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.panel}>
            <NineSlice slices={HUD_PANEL} corner={14} />
            <Text style={styles.panelText} testID="game-banner-text">
              {text}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    elevation: 60,
  },
  layerCompact: { justifyContent: "flex-start", paddingTop: 40 },
  scrollCompact: { height: 36, minWidth: 140, paddingHorizontal: 32, marginTop: -8 },
  scrollTextCompact: { fontSize: 16 },
  box: { alignItems: "center", maxWidth: "80%", marginBottom: 40 },
  scroll: {
    minWidth: 200,
    maxWidth: "100%",
    height: 52,
    marginTop: -10,
    paddingHorizontal: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollText: { fontFamily: F.serif, fontSize: 22, color: A.ink },
  panel: { paddingHorizontal: 28, paddingVertical: 14 },
  panelText: { fontFamily: F.bold, fontSize: 15, color: A.ivory, textAlign: "center" },
});
