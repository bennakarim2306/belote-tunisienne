import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, View } from "react-native";

import { EMBLEMS, EmblemKind } from "@/src/anime/assets";
import { A } from "@/src/anime/tokens";

// Painted emblem of an alert or result, with a coded medallion as stand-in
// while the painted image is missing. Decorative only.

const ICON: Record<EmblemKind, keyof typeof Ionicons.glyphMap> = {
  belote: "heart",
  contre: "shield",
  surcontre: "flame",
  capot: "star",
  redeal: "refresh",
  made: "checkmark",
  failed: "close",
  victory: "trophy",
  defeat: "sad-outline",
};
const RED: EmblemKind[] = ["contre", "surcontre", "failed", "defeat"];

export default function Emblem({ kind, size }: { kind: EmblemKind; size: number }) {
  const src = EMBLEMS[kind];
  if (src) {
    return (
      <Image
        source={src}
        resizeMode="contain"
        fadeDuration={0}
        style={{ width: size, height: size }}
        testID={`emblem-${kind}`}
      />
    );
  }
  return (
    <View
      testID={`emblem-${kind}`}
      style={{
        width: size * 0.8,
        height: size * 0.8,
        margin: size * 0.1,
        borderRadius: size,
        borderWidth: 3,
        borderColor: A.gold,
        backgroundColor: RED.includes(kind) ? "#7A141B" : A.emeraldSurface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={ICON[kind]} size={size * 0.42} color={A.goldLight} />
    </View>
  );
}
