import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { C, F, R, SP, glow, shadow } from "@/src/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "gold" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
  testID?: string;
  icon?: React.ReactNode;
}

export default function ChunkyButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  small,
  testID,
  icon,
}: Props) {
  const bg =
    variant === "primary"
      ? C.brand
      : variant === "gold"
        ? C.gold
        : variant === "danger"
          ? C.error
          : variant === "ghost"
            ? "transparent"
            : C.bg3;
  const fg =
    variant === "primary" || variant === "gold"
      ? C.onBrand
      : variant === "danger"
        ? "#FFFFFF"
        : variant === "ghost"
          ? C.brand
          : C.ink;
  const glowStyle =
    variant === "primary"
      ? glow(C.glowMint)
      : variant === "gold"
        ? glow(C.glowCopper)
        : variant === "danger"
          ? glow("rgba(255,68,68,0.4)")
          : shadow;

  const handlePress = () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === "ghost" && styles.ghost,
        variant === "secondary" && styles.secondary,
        variant !== "ghost" && !disabled && glowStyle,
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              small && styles.labelSmall,
              { color: fg },
              icon ? { marginLeft: SP.sm } : null,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: R.pill,
    paddingHorizontal: SP.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  small: {
    minHeight: 42,
    paddingHorizontal: SP.lg,
  },
  ghost: {
    borderWidth: 2,
    borderColor: C.brand,
  },
  secondary: {
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  label: {
    fontFamily: F.display,
    fontSize: 17,
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 14,
  },
});
