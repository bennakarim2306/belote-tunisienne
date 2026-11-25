import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { Image, ImageSourcePropType, Modal, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  AVATAR_PORTRAITS,
  BG_ARENA,
  BG_GAME,
  BTN_DARK,
  BTN_GREEN,
  BTN_ICON_GREEN,
  BTN_ICON_RED,
  CARD_BACK,
  CARD_FACE,
  FLAG_BANNER,
  HUD_PANEL,
  ICONS,
  LOGO,
  MODAL_FRAME,
  NAMEPLATE,
  SEAT_FRAME,
  TABLE_TOP,
  TILE_DARK,
  TILE_HERO,
  TITLE_RIBBON,
} from "@/src/anime/assets";
import { DesignId, applyDesign, saveDesign } from "@/src/anime/design";
import { A } from "@/src/anime/tokens";
import { AVATARS, avatarUrl } from "@/src/avatars";
import { useI18n } from "@/src/i18n";
import { C, F, PATTERN_BG, SP } from "@/src/theme";

// Full-screen loading animation while the design changes (docs/
// ANIME_DESIGN_SWITCH_PLAN.md). The images of the target design are prepared
// first, then the design is saved and swapped underneath, then the screen
// opens again. Nothing is remounted: login, navigation and ads stay as they are.

const MIN_MS = 800; // no flicker when everything is already loaded
const MAX_MS = 8000; // slow or no network: go on, the rest loads as usual
const STEP_MS = 5000; // a single download never holds its slot longer
const FADE_MS = 280;
const BATCH = 10; // local images decoded at the same time
const NOTE_MS = 2200; // how long "not saved" stays readable

let request: ((target: DesignId) => void) | null = null;
/** Starts the change; ignored while one is already running. */
export const startDesignSwitch = (target: DesignId) => request?.(target);

// nine- and three-slices: every entry except the numbers is an image
const slices = (s: object): ImageSourcePropType[] =>
  Object.entries(s)
    .filter(([k]) => k !== "corner" && k !== "capRatio")
    .map(([, v]) => v as ImageSourcePropType);

/** What the player sees first in the new design (all inside the app). */
const emeraldImages = (): ImageSourcePropType[] => [
  BG_ARENA.source,
  FLAG_BANNER.source,
  ...slices(TILE_HERO),
  ...slices(TILE_DARK),
  ...Object.values(ICONS),
  ...slices(MODAL_FRAME),
  ...slices(TITLE_RIBBON),
  ...slices(BTN_GREEN),
  ...slices(BTN_DARK),
  ...slices(HUD_PANEL),
  ...Object.values(AVATAR_PORTRAITS),
  BG_GAME,
  TABLE_TOP.source,
  SEAT_FRAME.source,
  ...slices(NAMEPLATE),
  BTN_ICON_GREEN,
  BTN_ICON_RED,
  CARD_FACE,
];

/** The original design takes these from the internet, as it always has. */
const classicDownloads = (): (() => Promise<unknown>)[] => [
  ...AVATARS.map((a) => () => ExpoImage.prefetch(avatarUrl(a.id))),
  () => Image.prefetch(PATTERN_BG),
];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function DesignSwitchOverlay() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [target, setTarget] = useState<DesignId | null>(null);
  const [visible, setVisible] = useState(false);
  const [notSaved, setNotSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batch, setBatch] = useState<{ from: number; images: ImageSourcePropType[] } | null>(null);
  const busy = useRef(false);
  const onImage = useRef<() => void>(() => {});

  const turn = useSharedValue(0);
  const bar = useSharedValue(0);

  useEffect(() => {
    request = (next) => {
      if (busy.current) return;
      busy.current = true;
      setNotSaved(false);
      setProgress(0);
      setTarget(next);
      setVisible(true);
    };
    return () => {
      request = null;
    };
  }, []);

  // one steady turn after the other, no bounce
  useEffect(() => {
    if (!visible || reduced) return;
    turn.value = 0;
    turn.value = withRepeat(withTiming(360, { duration: 1800, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [visible, reduced, turn]);

  useEffect(() => {
    bar.value =
      progress === 0 ? 0 : withTiming(progress, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [progress, bar]);

  useEffect(() => {
    if (!target) return;
    let stopped = false; // time is up (or unmounted): stop preparing
    const prepareEmerald = async () => {
      const all = emeraldImages();
      let done = 0;
      for (let i = 0; i < all.length && !stopped; i += BATCH) {
        const images = all.slice(i, i + BATCH);
        await new Promise<void>((resolve) => {
          let left = images.length;
          onImage.current = () => {
            done += 1;
            left -= 1;
            if (!stopped) setProgress(done / all.length);
            if (left <= 0) resolve();
          };
          setBatch({ from: i, images });
        });
      }
    };
    const prepareClassic = async () => {
      const all = classicDownloads();
      let done = 0;
      await Promise.all(
        all.map(async (load) => {
          await Promise.race([load().catch(() => false), wait(STEP_MS)]);
          done += 1;
          if (!stopped) setProgress(done / all.length);
        }),
      );
    };
    (async () => {
      await wait(FADE_MS); // the overlay is fully closed first
      await Promise.all([
        Promise.race([
          target === "emerald" ? prepareEmerald() : prepareClassic(),
          wait(MAX_MS),
        ]),
        wait(MIN_MS),
      ]);
      stopped = true;
      setProgress(1);
      const saved = await Promise.race([saveDesign(target), wait(2000).then(() => false)]);
      applyDesign(target); // swapped behind the closed overlay
      await wait(320);
      if (!saved) {
        setNotSaved(true);
        await wait(NOTE_MS);
      }
      setVisible(false);
      await wait(FADE_MS);
      setBatch(null);
      setTarget(null);
      busy.current = false;
    })();
    return () => {
      stopped = true;
    };
  }, [target]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 700 }, { rotateY: `${turn.value}deg` }],
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.round(bar.value * 100)}%` }));

  const classic = target === "classic";
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        // back button: the change cannot be interrupted half-way
      }}
      supportedOrientations={["landscape", "portrait"]}
    >
      <View
        style={[styles.screen, classic && { backgroundColor: C.bg }]}
        testID="design-switch-overlay"
      >
        <Image source={LOGO.source} style={styles.logo} resizeMode="contain" fadeDuration={0} />
        <Animated.View style={[styles.card, cardStyle]}>
          <Image source={CARD_BACK} style={styles.card} resizeMode="stretch" fadeDuration={0} />
        </Animated.View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, classic && { backgroundColor: C.brand }, barStyle]} />
        </View>
        <Text
          style={[styles.text, notSaved && styles.warn]}
          testID="design-switch-text"
          accessibilityLiveRegion="polite"
        >
          {notSaved ? t("designNotSaved") : t("designLoading")}
        </Text>
        {/* prepared here by the same image component the screens use */}
        <View style={styles.hidden} pointerEvents="none">
          {batch?.images.map((source, i) => (
            <Image
              key={batch.from + i}
              source={source}
              style={styles.hiddenImg}
              fadeDuration={0}
              onLoadEnd={() => onImage.current()}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP.md,
    backgroundColor: "#03140E",
  },
  logo: { height: 84, width: 84 * LOGO.aspect },
  card: { width: 74, height: 104 },
  track: {
    width: 240,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: A.gold,
    padding: 2,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: A.gold },
  text: { fontFamily: F.bold, fontSize: 13, color: A.ivory, textAlign: "center" },
  warn: { color: "#FF8A80" },
  hidden: { position: "absolute", left: 0, bottom: 0, opacity: 0.01, flexDirection: "row" },
  hiddenImg: { width: 2, height: 2 },
});
