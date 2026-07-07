import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

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

// Tunisian (French-pattern) indices: 1 / V / D / R
const RANK_LABEL: Record<string, string> = {
  J: "V",
  Q: "D",
  K: "R",
  A: "1",
};

export const suitOf = (card: string) => card.slice(-1);
export const rankOf = (card: string) => card.slice(0, -1);
export const rankLabel = (rank: string) => RANK_LABEL[rank] ?? rank;

// Classic French-pattern palette (as on Tunisian café decks)
const RED = "#CE2B2B";
const BLUE = "#2456A6";
const GOLD = "#E9B542";
const SKIN = "#F4C9A0";
const OUTLINE = "#35302B";
const HAIR = "#E8E2D8";

// ---------- pip layouts (fractions of the card) ----------
// Bottom-half pips are rotated 180°, like on real cards.
const PIPS: Record<string, [number, number][]> = {
  "7": [[0.31, 0.18], [0.69, 0.18], [0.5, 0.33], [0.31, 0.5], [0.69, 0.5],
        [0.31, 0.82], [0.69, 0.82]],
  "8": [[0.31, 0.18], [0.69, 0.18], [0.5, 0.33], [0.31, 0.5], [0.69, 0.5],
        [0.5, 0.67], [0.31, 0.82], [0.69, 0.82]],
  "9": [[0.31, 0.16], [0.69, 0.16], [0.31, 0.39], [0.69, 0.39], [0.5, 0.5],
        [0.31, 0.61], [0.69, 0.61], [0.31, 0.84], [0.69, 0.84]],
  "10": [[0.31, 0.16], [0.69, 0.16], [0.5, 0.26], [0.31, 0.39], [0.69, 0.39],
         [0.31, 0.61], [0.69, 0.61], [0.5, 0.74], [0.31, 0.84], [0.69, 0.84]],
};

const PIP_SIZE: Record<string, number> = { "7": 0.21, "8": 0.21, "9": 0.19, "10": 0.18 };

function Pips({ rank, suit, w, h }: { rank: string; suit: string; w: number; h: number }) {
  const pts = PIPS[rank];
  if (!pts) return null;
  const fs = w * (PIP_SIZE[rank] ?? 0.2);
  const color = SUIT_COLOR[suit];
  return (
    <>
      {pts.map(([x, y], i) => (
        <Text
          key={i}
          style={{
            position: "absolute",
            left: x * w - fs * 0.62,
            top: y * h - fs * 0.62,
            width: fs * 1.24,
            textAlign: "center",
            fontSize: fs,
            lineHeight: fs * 1.15,
            color,
            transform: y > 0.55 ? [{ rotate: "180deg" }] : undefined,
          }}
        >
          {SUIT_SYMBOL[suit]}
        </Text>
      ))}
    </>
  );
}

// ---------- court figures (double-headed, mirrored like real decks) ----------
function HalfBust({ rank }: { rank: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 78" preserveAspectRatio="xMidYMax meet">
      {/* tunic: red / blue halves with gold trim */}
      <Path d="M20 78 L29 52 Q38 43 50 43 L50 78 Z" fill={RED} stroke={OUTLINE} strokeWidth={1.4} />
      <Path d="M80 78 L71 52 Q62 43 50 43 L50 78 Z" fill={BLUE} stroke={OUTLINE} strokeWidth={1.4} />
      <Rect x={36} y={41} width={28} height={7} rx={2.5} fill={GOLD} stroke={OUTLINE} strokeWidth={1.2} />
      <Circle cx={50} cy={62} r={7.5} fill={GOLD} stroke={OUTLINE} strokeWidth={1.2} />
      {/* head */}
      <Circle cx={50} cy={28} r={12.5} fill={SKIN} stroke={OUTLINE} strokeWidth={1.4} />
      {/* hair on the sides */}
      <Path d="M38 26 Q36 36 41 41 L45 37 Q40 33 40 26 Z" fill={HAIR} stroke={OUTLINE} strokeWidth={1} />
      <Path d="M62 26 Q64 36 59 41 L55 37 Q60 33 60 26 Z" fill={HAIR} stroke={OUTLINE} strokeWidth={1} />
      {/* face */}
      <Circle cx={45.4} cy={27} r={1.5} fill={OUTLINE} />
      <Circle cx={54.6} cy={27} r={1.5} fill={OUTLINE} />
      <Path d="M46 33.5 Q50 36 54 33.5" stroke={OUTLINE} strokeWidth={1.2} fill="none" />
      {rank === "K" && (
        <>
          {/* crown + beard */}
          <Path d="M37 19 L37 8 L44 14 L50 6 L56 14 L63 8 L63 19 Z"
                fill={GOLD} stroke={OUTLINE} strokeWidth={1.4} />
          <Path d="M41 35 Q50 47 59 35 Q59 43 50 45 Q41 43 41 35 Z"
                fill={HAIR} stroke={OUTLINE} strokeWidth={1} />
        </>
      )}
      {rank === "Q" && (
        <>
          {/* tiara + red veil */}
          <Path d="M38 17 L38 11 L50 8 L62 11 L62 17 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={1.4} />
          <Path d="M38 14 Q27 24 31 46 L39 41 Q35 28 40 18 Z" fill={RED} stroke={OUTLINE} strokeWidth={1.2} />
          <Path d="M62 14 Q73 24 69 46 L61 41 Q65 28 60 18 Z" fill={RED} stroke={OUTLINE} strokeWidth={1.2} />
        </>
      )}
      {rank === "J" && (
        <>
          {/* blue beret + gold band */}
          <Ellipse cx={50} cy={12} rx={16} ry={6.5} fill={BLUE} stroke={OUTLINE} strokeWidth={1.4} />
          <Rect x={39} y={14.5} width={22} height={4.5} rx={2} fill={GOLD} stroke={OUTLINE} strokeWidth={1} />
        </>
      )}
    </Svg>
  );
}

function CourtCenter({ rank, suit, w, h }: { rank: string; suit: string; w: number; h: number }) {
  const color = SUIT_COLOR[suit];
  const suitFs = w * 0.17;
  return (
    <View
      style={{
        position: "absolute",
        left: w * 0.2,
        right: w * 0.2,
        top: h * 0.13,
        bottom: h * 0.13,
        borderWidth: 1,
        borderColor: "#B9AF9E",
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: "#FFFDF8",
      }}
    >
      <View style={{ flex: 1 }}>
        <HalfBust rank={rank} />
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "#B9AF9E" }} />
      <View style={{ flex: 1, transform: [{ rotate: "180deg" }] }}>
        <HalfBust rank={rank} />
      </View>
      {/* small suit pips inside the frame, like real courts */}
      <Text
        style={{
          position: "absolute",
          top: 1,
          left: 2,
          fontSize: suitFs,
          lineHeight: suitFs * 1.15,
          color,
        }}
      >
        {SUIT_SYMBOL[suit]}
      </Text>
      <Text
        style={{
          position: "absolute",
          bottom: 1,
          right: 2,
          fontSize: suitFs,
          lineHeight: suitFs * 1.15,
          color,
          transform: [{ rotate: "180deg" }],
        }}
      >
        {SUIT_SYMBOL[suit]}
      </Text>
    </View>
  );
}

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
  const isCourt = rank === "J" || rank === "Q" || rank === "K";
  const rankFs = width * 0.26;
  const suitFs = width * 0.2;
  return (
    <View
      style={[
        styles.card,
        { width, height, borderRadius: width * 0.14 },
        isTrump && styles.trumpEdge,
        dimmed && { opacity: 0.4 },
      ]}
    >
      {/* center: figure, pips, or the big "1" ace pip */}
      {isCourt ? (
        <CourtCenter rank={rank} suit={suit} w={width} h={height} />
      ) : rank === "A" ? (
        <Text
          style={{
            position: "absolute",
            alignSelf: "center",
            top: height / 2 - width * 0.31,
            fontSize: width * 0.52,
            lineHeight: width * 0.62,
            color,
          }}
        >
          {SUIT_SYMBOL[suit]}
        </Text>
      ) : (
        <Pips rank={rank} suit={suit} w={width} h={height} />
      )}

      {/* corner indices — top-left and mirrored bottom-right, like real decks */}
      <View style={[styles.corner, styles.cornerTL]}>
        <Text style={[styles.rank, { color, fontSize: rankFs, lineHeight: rankFs * 1.05 }]}>
          {rankLabel(rank)}
        </Text>
        <Text style={{ color, fontSize: suitFs, lineHeight: suitFs * 1.1, marginTop: -1 }}>
          {SUIT_SYMBOL[suit]}
        </Text>
      </View>
      <View style={[styles.corner, styles.cornerBR, { transform: [{ rotate: "180deg" }] }]}>
        <Text style={[styles.rank, { color, fontSize: rankFs, lineHeight: rankFs * 1.05 }]}>
          {rankLabel(rank)}
        </Text>
        <Text style={{ color, fontSize: suitFs, lineHeight: suitFs * 1.1, marginTop: -1 }}>
          {SUIT_SYMBOL[suit]}
        </Text>
      </View>
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
    alignItems: "center",
  },
  cornerTL: {
    top: 2,
    left: 4,
  },
  cornerBR: {
    bottom: 2,
    right: 4,
  },
  rank: {
    fontFamily: F.extra,
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
