import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAnime } from "@/src/anime/design";
import { avatarSource } from "@/src/avatars";
import { C, F } from "@/src/theme";

interface Props {
  avatarId?: string;
  size?: number;
  ringColor?: string;
  ringWidth?: number;
  testID?: string;
}

export default function Avatar({
  avatarId = "av1",
  size = 48,
  ringColor = C.brand3,
  ringWidth = 2.5,
  testID,
}: Props) {
  useAnime(); // avatarSource() depends on the design: re-render when it changes
  return (
    <View
      testID={testID}
      style={[
        styles.ring,
        {
          width: size + ringWidth * 2 + 4,
          height: size + ringWidth * 2 + 4,
          borderRadius: (size + ringWidth * 2 + 4) / 2,
          borderColor: ringColor,
          borderWidth: ringWidth,
        },
      ]}
    >
      <Image
        source={avatarSource(avatarId)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
        placeholder={null}
      />
    </View>
  );
}

export function AvatarFallback({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg2,
    overflow: "hidden",
  },
  fallback: {
    backgroundColor: C.brand2,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: C.onBrand,
    fontFamily: F.display,
  },
});
