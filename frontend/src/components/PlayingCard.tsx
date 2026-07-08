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

// ---------- SVG suit shapes ----------
// Suit symbols are vector paths (never font glyphs): text symbols like ♣ use
// platform font metrics that shift unpredictably on devices. Static absolute
// coordinates in a 100×100 box — same primitives as the court figures.
const SUIT_D: Record<string, string> = {
  D: "M50 4 L83 50 L50 96 L17 50 Z",
  H: "M50 92 C24 68 8 48 8 31 C8 17 19 8 31 8 C40 8 47 13 50 21 C53 13 60 8 69 8 C81 8 92 17 92 31 C92 48 76 68 50 92 Z",
  S: "M50 5 C60 24 88 39 88 59 C88 72 78 81 67 81 C61 81 56 78 52 74 C53 83 57 89 63 94 L37 94 C43 89 47 83 48 74 C44 78 39 81 33 81 C22 81 12 72 12 59 C12 39 40 24 50 5 Z",
  // club stem only — the three lobes are plain circles
  C: "M46 56 C48 74 44 84 38 94 L62 94 C56 84 52 74 54 56 Z",
};

// Standalone suit symbol (corner indices, card centers) — no transforms.
function SuitMark({ suit, size }: { suit: string; size: number }) {
  const color = SUIT_COLOR[suit];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {suit === "C" && (
        <>
          <Circle cx={50} cy={27} r={20} fill={color} />
          <Circle cx={28} cy={59} r={20} fill={color} />
          <Circle cx={72} cy={59} r={20} fill={color} />
        </>
      )}
      <Path d={SUIT_D[suit]} fill={color} />
    </Svg>
  );
}

// Face of number cards (7-10) and aces: mobile-first readability — a big rank
// digit above a big suit symbol instead of realistic pip grids, which turn
// into unreadable clutter at hand-fan sizes. Courts keep their figures.
function CenterFace({ rank, suit, w }: { rank: string; suit: string; w: number }) {
  const color = SUIT_COLOR[suit];
  const isAce = rank === "A";
  return (
    <View style={styles.centerFace} pointerEvents="none">
      {!isAce && (
        <Text
          style={{
            fontFamily: F.extra,
            fontSize: w * 0.38,
            lineHeight: w * 0.42,
            color,
          }}
          allowFontScaling={false}
        >
          {rank}
        </Text>
      )}
      <SuitMark suit={suit} size={isAce ? w * 0.52 : w * 0.32} />
    </View>
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
  const suitFs = w * 0.14;
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
      <View style={{ position: "absolute", top: 2, left: 2 }}>
        <SuitMark suit={suit} size={suitFs} />
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 2,
          right: 2,
          transform: [{ rotate: "180deg" }],
        }}
      >
        <SuitMark suit={suit} size={suitFs} />
      </View>
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
  const rankFs = width * 0.28;
  const suitFs = width * 0.18;
  return (
    <View
      style={[
        styles.card,
        { width, height, borderRadius: width * 0.14 },
        isTrump && styles.trumpEdge,
        dimmed && { opacity: 0.4 },
      ]}
    >
      {/* center: court figure, or big rank + suit (numbers), or big suit (ace) */}
      {isCourt ? (
        <CourtCenter rank={rank} suit={suit} w={width} h={height} />
      ) : (
        <CenterFace rank={rank} suit={suit} w={width} />
      )}

      {/* corner indices — top-left and mirrored bottom-right, like real decks */}
      <View style={[styles.corner, styles.cornerTL]}>
        <Text style={[styles.rank, { color, fontSize: rankFs, lineHeight: rankFs * 1.05 }]}>
          {rankLabel(rank)}
        </Text>
        <SuitMark suit={suit} size={suitFs} />
      </View>
      <View style={[styles.corner, styles.cornerBR, { transform: [{ rotate: "180deg" }] }]}>
        <Text style={[styles.rank, { color, fontSize: rankFs, lineHeight: rankFs * 1.05 }]}>
          {rankLabel(rank)}
        </Text>
        <SuitMark suit={suit} size={suitFs} />
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
  centerFace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
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
