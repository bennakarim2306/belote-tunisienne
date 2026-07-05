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

import { C, F, R, SP, shadow } from "@/src/theme";

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
            : C.bg2;
  const fg =
    variant === "primary" || variant === "danger"
      ? C.onBrand
      : variant === "gold"
        ? C.ink
        : variant === "ghost"
          ? C.brand
          : C.ink;

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
        variant !== "ghost" && shadow,
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
  label: {
    fontFamily: F.display,
    fontSize: 17,
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 14,
  },
});
