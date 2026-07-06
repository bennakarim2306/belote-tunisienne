import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { C, F } from "@/src/theme";

export const SUIT_SYMBOL: Record<string, string> = {
  S: "♠",
  H: "♥",
  C: "♣",
  D: "♦",
};

export const SUIT_COLOR: Record<string, string> = {
  S: "#2A2421",
  C: "#2A2421",
  H: "#C0392B",
  D: "#C0392B",
};

// Brighter variants for dark surfaces (felt table, dark chips) so ♥/♦ stay visible
export const SUIT_COLOR_ON_DARK: Record<string, string> = {
  S: "#FFFFFF",
  C: "#FFFFFF",
  H: "#FF7A66",
  D: "#FF7A66",
};

const RANK_LABEL: Record<string, string> = {
  J: "V",
  Q: "D",
  K: "R",
  A: "A",
};

export const suitOf = (card: string) => card.slice(-1);
export const rankOf = (card: string) => card.slice(0, -1);
export const rankLabel = (rank: string) => RANK_LABEL[rank] ?? rank;

interface Props {
  card?: string;
  width?: number;
  faceDown?: boolean;
  dimmed?: boolean;
  trumpSuit?: string | null;
}

export default function PlayingCard({
  card,
  width = 62,
  faceDown,
  dimmed,
  trumpSuit,
}: Props) {
  const height = width * 1.45;
  if (faceDown || !card) {
    return (
      <View style={[styles.card, styles.back, { width, height, borderRadius: width * 0.14 }]}>
        <View style={[styles.backInner, { borderRadius: width * 0.09 }]}>
          <Text style={[styles.backMotif, { fontSize: width * 0.42 }]}>✦</Text>
        </View>
      </View>
    );
  }
  const suit = suitOf(card);
  const rank = rankOf(card);
  const color = SUIT_COLOR[suit];
  const isTrump = trumpSuit && suit === trumpSuit;
  return (
    <View
      style={[
        styles.card,
        { width, height, borderRadius: width * 0.14 },
        isTrump && styles.trumpEdge,
        dimmed && { opacity: 0.4 },
      ]}
    >
      <View style={styles.corner}>
        <Text style={[styles.rank, { color, fontSize: width * 0.3 }]}>
          {rankLabel(rank)}
        </Text>
        <Text style={[styles.smallSuit, { color, fontSize: width * 0.24 }]}>
          {SUIT_SYMBOL[suit]}
        </Text>
      </View>
      <Text style={[styles.bigSuit, { color, fontSize: width * 0.52 }]}>
        {SUIT_SYMBOL[suit]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#D8CFC0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
    overflow: "hidden",
  },
  trumpEdge: {
    borderColor: C.gold,
    borderWidth: 2,
  },
  corner: {
    position: "absolute",
    top: 3,
    left: 5,
    alignItems: "center",
  },
  rank: {
    fontFamily: F.extra,
    lineHeight: undefined,
  },
  smallSuit: {
    marginTop: -2,
  },
  bigSuit: {
    position: "absolute",
    bottom: 2,
    right: 6,
  },
  back: {
    backgroundColor: "#1C1714",
    borderColor: "#FF7B00",
    borderWidth: 1.5,
    padding: 4,
  },
  backInner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "rgba(0,229,122,0.5)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#26201B",
  },
  backMotif: {
    color: "#00E57A",
  },
});
