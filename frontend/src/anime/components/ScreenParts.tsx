import React, { useEffect } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
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
  BTN_DARK,
  BTN_GREEN,
  BTN_ICON_GREEN,
  CARD_BACK,
  CHAT_CHIP,
  EMPTY_PLAYER,
  ICONS,
  SEAT_FRAME,
} from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import { AnimeTitle } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import { avatarSource } from "@/src/avatars";
import MenuButton from "@/src/components/MenuButton";
import { F, SP } from "@/src/theme";

// Building blocks of the full screens of the new design (matchmaking, private
// room, join…). Visual only: the screens keep their state, handlers, testIDs.

/** Painted background, "cover" and centred; never takes touches. */
export function ScreenBackground({ source, shade = 0.2 }: { source: ImageSourcePropType; shade?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.bg]} pointerEvents="none">
      <Image source={source} resizeMode="cover" style={styles.fill} fadeDuration={0} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(3,20,16,${shade})` }]} />
    </View>
  );
}

/** Round portrait in the painted seat frame; `size` is the width of the frame. */
export function FramedPortrait({ avatarId, size, dim }: { avatarId?: string; size: number; dim?: boolean }) {
  const face = size * SEAT_FRAME.hole * 1.04;
  return (
    <View style={[styles.center, { width: size, height: size / SEAT_FRAME.aspect }, dim && { opacity: 0.6 }]}>
      <Image
        source={avatarSource(avatarId ?? "av1")}
        style={{ width: face, height: face, borderRadius: face / 2 }}
        resizeMode="cover"
        fadeDuration={0}
      />
      <Image
        source={SEAT_FRAME.source}
        resizeMode="stretch"
        fadeDuration={0}
        style={[styles.over, { width: size, height: size / SEAT_FRAME.aspect }]}
      />
    </View>
  );
}

/** Place that still waits for a player: a slow change of brightness, no movement. */
export function EmptyPortrait({ size }: { size: number }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.85);
  useEffect(() => {
    if (reduced) return;
    pulse.value = 0.5;
    pulse.value = withRepeat(withTiming(0.95, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={[styles.center, { width: size, height: size / SEAT_FRAME.aspect }, style]}>
      <Image source={EMPTY_PLAYER} style={{ width: size * 0.84, height: size * 0.84 }} resizeMode="contain" fadeDuration={0} />
    </Animated.View>
  );
}

/** Card back turning steadily: the waiting sign of the new design. */
export function TurningCard({ height }: { height: number }) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    turn.value = 0;
    turn.value = withRepeat(withTiming(360, { duration: 1800, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [turn, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ perspective: 700 }, { rotateY: `${turn.value}deg` }] }));
  const box = { width: height * 0.71, height };
  return (
    <Animated.View style={[box, style]}>
      <Image source={CARD_BACK} style={box} resizeMode="stretch" fadeDuration={0} />
    </Animated.View>
  );
}

/** Small value on a painted pill. */
export function ValuePill({
  icon,
  text,
  testID,
  textTestID,
}: {
  icon?: ImageSourcePropType;
  text: string;
  testID?: string;
  textTestID?: string;
}) {
  const narrow = useWindowDimensions().width < 720;
  return (
    <View style={[styles.pill, narrow && styles.pillNarrow]} testID={testID}>
      <HSlice slices={CHAT_CHIP} />
      {icon && <Image source={icon} style={styles.pillIcon} resizeMode="contain" fadeDuration={0} />}
      <Text style={[styles.pillText, narrow && { fontSize: 11.5 }]} numberOfLines={1} testID={textTestID}>
        {text}
      </Text>
    </View>
  );
}

/** Painted button with an icon in front of its label. */
export function IconTextButton({
  icon,
  label,
  onPress,
  testID,
  variant = "dark",
  style,
}: {
  icon: ImageSourcePropType;
  label: string;
  onPress: () => void;
  testID?: string;
  variant?: "green" | "dark";
  style?: StyleProp<ViewStyle>;
}) {
  const narrow = useWindowDimensions().width < 720;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.btn, narrow && styles.btnNarrow, pressed && styles.pressed, style]}
    >
      <HSlice slices={variant === "green" ? BTN_GREEN : BTN_DARK} />
      <Image source={icon} style={styles.btnIcon} resizeMode="contain" fadeDuration={0} />
      <Text style={[styles.btnText, narrow && { fontSize: 12 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Screen head: back button on the left, title on the ribbon. */
export function ScreenHeader({ title, onBack, backTestID }: { title: string; onBack: () => void; backTestID: string }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        testID={backTestID}
        accessibilityRole="button"
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Image source={BTN_ICON_GREEN} style={[styles.over, styles.back]} resizeMode="stretch" fadeDuration={0} />
        <Image source={ICONS.back} style={styles.backIcon} resizeMode="contain" fadeDuration={0} />
      </Pressable>
      <AnimeTitle text={title} />
      <View style={styles.back} pointerEvents="none" />
    </View>
  );
}

/** Side-menu button on the painted square (as on home). */
export function PaintedMenuButton() {
  return (
    <MenuButton
      buttonStyle={styles.menuBtn}
      icon={
        <>
          <Image source={BTN_ICON_GREEN} style={[styles.over, styles.menuBtn]} resizeMode="stretch" fadeDuration={0} />
          <Image source={ICONS.menu} style={styles.backIcon} resizeMode="contain" fadeDuration={0} />
        </>
      }
    />
  );
}

/** Two-way switch on painted buttons (solo / duo, quick / normal…). */
export function Segments<K extends string>({
  items,
  value,
  onChange,
  height = 36,
  compact,
}: {
  items: { key: K; label: string; icon?: ImageSourcePropType; testID?: string }[];
  value: K;
  onChange: (k: K) => void;
  height?: number;
  compact?: boolean;
}) {
  return (
    <View style={styles.segments}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          testID={it.testID}
          onPress={() => onChange(it.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === it.key }}
          style={({ pressed }) => [styles.segment, { height }, compact && styles.segCompact, pressed && styles.pressed]}
        >
          <HSlice slices={value === it.key ? BTN_GREEN : BTN_DARK} />
          {it.icon && <Image source={it.icon} style={styles.segIcon} resizeMode="contain" fadeDuration={0} />}
          <Text style={[styles.segText, value !== it.key && { color: A.ivoryDim }]} numberOfLines={1}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menuBtn: { width: 44, height: 44, backgroundColor: "transparent", borderWidth: 0, borderRadius: 0 },
  segments: { flexDirection: "row", gap: 6 },
  segment: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 20, minWidth: 96 },
  segCompact: { minWidth: 58, paddingHorizontal: 14 },
  segIcon: { width: 20, height: 20 },
  segText: { fontFamily: F.bold, fontSize: 12.5, color: A.ivory },
  bg: { backgroundColor: A.emeraldInk },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  over: { position: "absolute", top: 0, left: 0 },
  pill: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 18,
    flexShrink: 1,
  },
  pillNarrow: { paddingHorizontal: 14, gap: 4 },
  pillIcon: { width: 20, height: 20 },
  pillText: { fontFamily: F.bold, fontSize: 12.5, color: A.ivory, flexShrink: 1 },
  btn: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 30,
  },
  btnNarrow: { gap: 5, paddingHorizontal: 24 },
  btnIcon: { width: 24, height: 24 },
  btnText: {
    fontFamily: F.display,
    fontSize: 13.5,
    color: A.ivory,
    flexShrink: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP.lg,
    paddingBottom: SP.xs,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backIcon: { width: 25, height: 25 },
});
