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
// Pips are drawn as vector paths (never font glyphs): text symbols like ♣ use
// platform font metrics that shift/scale unpredictably on iOS/Android, which
// scrambled the pip grid on real devices.
// Geometry is stored as raw numbers (100×100 box centered on 50,50) so every
// pip can be emitted with FINAL absolute coordinates baked into the path data —
// no SVG transform strings at all. Plain <Path d>/<Circle> are the exact same
// primitives as the court figures, which render pixel-perfect on real devices.
type Tok = string | number;
const SUIT_PATH: Record<string, Tok[]> = {
  D: ["M", 50, 4, "L", 83, 50, "L", 50, 96, "L", 17, 50, "Z"],
  H: ["M", 50, 92, "C", 24, 68, 8, 48, 8, 31, "C", 8, 17, 19, 8, 31, 8,
      "C", 40, 8, 47, 13, 50, 21, "C", 53, 13, 60, 8, 69, 8,
      "C", 81, 8, 92, 17, 92, 31, "C", 92, 48, 76, 68, 50, 92, "Z"],
  S: ["M", 50, 5, "C", 60, 24, 88, 39, 88, 59, "C", 88, 72, 78, 81, 67, 81,
      "C", 61, 81, 56, 78, 52, 74, "C", 53, 83, 57, 89, 63, 94, "L", 37, 94,
      "C", 43, 89, 47, 83, 48, 74, "C", 44, 78, 39, 81, 33, 81,
      "C", 22, 81, 12, 72, 12, 59, "C", 12, 39, 40, 24, 50, 5, "Z"],
  // club stem only — the three lobes are plain circles
  C: ["M", 46, 56, "C", 48, 74, 44, 84, 38, 94, "L", 62, 94,
      "C", 56, 84, 52, 74, 54, 56, "Z"],
};
const CLUB_LOBES: [number, number][] = [[50, 27], [28, 59], [72, 59]];
const CLUB_R = 20;

// Map base-glyph coordinates to absolute viewBox coordinates.
// flip (f = -1) is a point reflection about the pip center == a 180° rotation.
function pipPath(tokens: Tok[], cx: number, cy: number, k: number, f: number) {
  let isX = true;
  return tokens
    .map((t) => {
      if (typeof t === "string") {
        isX = true;
        return t;
      }
      const v = isX ? cx + (t - 50) * k * f : cy + (t - 50) * k * f;
      isX = !isX;
      return v.toFixed(2);
    })
    .join(" ");
}

// One pip with absolute coordinates inside the card-face Svg (viewBox 0 0 100 145).
// x/y are fractions of the card; s is the pip size in viewBox units.
function PipShape({ x, y, s, suit, flip }: {
  x: number; y: number; s: number; suit: string; flip?: boolean;
}) {
  const cx = x * 100;
  const cy = y * 145;
  const k = s / 100;
  const f = flip ? -1 : 1;
  const color = SUIT_COLOR[suit];
  const d = pipPath(SUIT_PATH[suit], cx, cy, k, f);
  if (suit === "C") {
    return (
      <>
        {CLUB_LOBES.map(([lx, ly], i) => (
          <Circle
            key={i}
            cx={cx + (lx - 50) * k * f}
            cy={cy + (ly - 50) * k * f}
            r={CLUB_R * k}
            fill={color}
          />
        ))}
        <Path d={d} fill={color} />
      </>
    );
  }
  return <Path d={d} fill={color} />;
}

// Standalone suit mark (corner indices, court frames) — static paths, no transforms.
function SuitMark({ suit, size }: { suit: string; size: number }) {
  const color = SUIT_COLOR[suit];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {suit === "C" ? (
        <>
          {CLUB_LOBES.map(([lx, ly], i) => (
            <Circle key={i} cx={lx} cy={ly} r={CLUB_R} fill={color} />
          ))}
          <Path d={pipPath(SUIT_PATH.C, 50, 50, 1, 1)} fill={color} />
        </>
      ) : (
        <Path d={pipPath(SUIT_PATH[suit], 50, 50, 1, 1)} fill={color} />
      )}
    </Svg>
  );
}

// ---------- pip layouts (fractions of the card) ----------
// Real French layouts; bottom-half pips are rotated 180°, like on real cards.
const PIPS: Record<string, [number, number][]> = {
  "7": [[0.3, 0.19], [0.7, 0.19], [0.5, 0.345], [0.3, 0.5], [0.7, 0.5],
        [0.3, 0.81], [0.7, 0.81]],
  "8": [[0.3, 0.19], [0.7, 0.19], [0.5, 0.345], [0.3, 0.5], [0.7, 0.5],
        [0.5, 0.655], [0.3, 0.81], [0.7, 0.81]],
  "9": [[0.3, 0.17], [0.7, 0.17], [0.3, 0.39], [0.7, 0.39], [0.5, 0.5],
        [0.3, 0.61], [0.7, 0.61], [0.3, 0.83], [0.7, 0.83]],
  "10": [[0.3, 0.17], [0.7, 0.17], [0.5, 0.28], [0.3, 0.39], [0.7, 0.39],
         [0.3, 0.61], [0.7, 0.61], [0.5, 0.72], [0.3, 0.83], [0.7, 0.83]],
};

// pip size in viewBox units (card width = 100 units)
const PIP_SIZE: Record<string, number> = { "7": 19, "8": 19, "9": 17, "10": 16 };

// One pip placed inside the card-face Svg (viewBox 0 0 100 145)
// positions live in one exact coordinate space (no per-pip native views).
function PipsFace({ rank, suit }: { rank: string; suit: string }) {
  const pts = PIPS[rank];
  if (!pts) return null;
  const s = PIP_SIZE[rank] ?? 17;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 145"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {pts.map(([x, y], i) => (
        <PipShape key={i} x={x} y={y} s={s} suit={suit} flip={y > 0.55} />
      ))}
    </Svg>
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
  const rankFs = width * 0.26;
  const suitFs = width * 0.15;
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
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 145"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <PipShape x={0.5} y={0.5} s={42} suit={suit} />
        </Svg>
      ) : (
        <PipsFace rank={rank} suit={suit} />
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
