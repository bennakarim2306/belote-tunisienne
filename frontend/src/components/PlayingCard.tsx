import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from "react-native-svg";

import { C } from "@/src/theme";

export const SUIT_SYMBOL: Record<string, string> = {
  S: "♠",
  H: "♥",
  C: "♣",
  D: "♦",
};

export const SUIT_COLOR: Record<string, string> = {
  S: "#23201C",
  C: "#23201C",
  H: "#C8102E",
  D: "#C8102E",
};

// Brighter variants for dark surfaces (felt table, dark chips) so ♥/♦ stay visible
export const SUIT_COLOR_ON_DARK: Record<string, string> = {
  S: "#FFFFFF",
  C: "#FFFFFF",
  H: "#FF7A66",
  D: "#FF7A66",
};

// French indices: V / D / R / A (like the classic reference deck)
const RANK_LABEL: Record<string, string> = {
  J: "V",
  Q: "D",
  K: "R",
};

export const suitOf = (card: string) => card.slice(-1);
export const rankOf = (card: string) => card.slice(0, -1);
export const rankLabel = (rank: string) => RANK_LABEL[rank] ?? rank;

// Classic French-pattern palette
const RED = "#CE2B2B";
const BLUE = "#2456A6";
const GOLD = "#E9B542";
const SKIN = "#F4C9A0";
const OUTLINE = "#35302B";
const HAIR = "#E8E2D8";
const CARD_BG = "#FFFEF9";

/* ------------------------------------------------------------------ *
 * The WHOLE card face is a single SVG (viewBox 100×145): background,
 * indices, pips and court figures live in one exact vector coordinate
 * space. No React-Native layout is used inside the card, because
 * absolutely-positioned RN views proved unreliable in some preview
 * browsers/devices (pips drifting, centers sticking to the top).
 * ------------------------------------------------------------------ */

// Suit glyph geometry in a 100×100 box centered on (50,50).
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

// Map glyph coordinates to absolute viewBox coordinates baked into the path.
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

// One suit pip at absolute (cx, cy), s units tall, optionally upside down.
function PipGlyph({ cx, cy, s, suit, flip }: {
  cx: number; cy: number; s: number; suit: string; flip?: boolean;
}) {
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

// ---------- pip layouts (fractions of the card, like the reference deck) ----
const PIPS: Record<string, [number, number][]> = {
  "7": [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5],
        [0.3, 0.8], [0.7, 0.8]],
  "8": [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5],
        [0.5, 0.65], [0.3, 0.8], [0.7, 0.8]],
  "9": [[0.3, 0.18], [0.7, 0.18], [0.3, 0.395], [0.7, 0.395], [0.5, 0.5],
        [0.3, 0.605], [0.7, 0.605], [0.3, 0.82], [0.7, 0.82]],
  "10": [[0.3, 0.18], [0.7, 0.18], [0.5, 0.29], [0.3, 0.395], [0.7, 0.395],
         [0.3, 0.605], [0.7, 0.605], [0.5, 0.71], [0.3, 0.82], [0.7, 0.82]],
};
const PIP_SIZE: Record<string, number> = { "7": 18, "8": 18, "9": 17, "10": 16 };

function NumberFace({ rank, suit }: { rank: string; suit: string }) {
  const pts = PIPS[rank];
  const s = PIP_SIZE[rank] ?? 17;
  return (
    <>
      {pts.map(([x, y], i) => (
        <PipGlyph key={i} cx={x * 100} cy={y * 145} s={s} suit={suit} flip={y > 0.55} />
      ))}
    </>
  );
}

// Corner index: rank over a small suit pip (drawn once, mirrored via a G).
function CornerIndex({ rank, suit }: { rank: string; suit: string }) {
  const label = rankLabel(rank);
  return (
    <>
      <SvgText
        x={label.length > 1 ? 14.5 : 11}
        y={17.5}
        fontSize={16}
        fontWeight="700"
        fill={SUIT_COLOR[suit]}
        textAnchor="middle"
      >
        {label}
      </SvgText>
      <PipGlyph cx={11} cy={27} s={10} suit={suit} />
    </>
  );
}

// ---------- court figures (double-headed, mirrored like real decks) ----------
function BustShapes({ rank }: { rank: string }) {
  return (
    <>
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
    </>
  );
}

function CourtFace({ rank, suit }: { rank: string; suit: string }) {
  const half = (
    <>
      <G x={22} y={22} scale={0.56}>
        <BustShapes rank={rank} />
      </G>
      {/* small suit pip inside the frame, like real courts */}
      <PipGlyph cx={29.5} cy={26} s={9} suit={suit} />
    </>
  );
  return (
    <>
      <Rect x={22} y={18} width={56} height={109} rx={2}
            fill={CARD_BG} stroke="#B9AF9E" strokeWidth={1.2} />
      <Path d="M22 72.5 L78 72.5" stroke="#B9AF9E" strokeWidth={0.8} />
      {half}
      <G rotation={180} originX={50} originY={72.5}>
        {half}
      </G>
    </>
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
  const isTrump = !!trumpSuit && suit === trumpSuit;
  const isCourt = rank === "J" || rank === "Q" || rank === "K";
  return (
    <View style={[{ width, height }, dimmed && { opacity: 0.4 }]}>
      <Svg width={width} height={height} viewBox="0 0 100 145">
        {/* card body + border (gold when trump) */}
        <Rect
          x={1.5}
          y={1.5}
          width={97}
          height={142}
          rx={13}
          fill={CARD_BG}
          stroke={isTrump ? C.gold : "#CFC6B8"}
          strokeWidth={isTrump ? 3.5 : 1.5}
        />
        {/* center: court figure, single ace pip, or the classic pip grid */}
        {isCourt ? (
          <CourtFace rank={rank} suit={suit} />
        ) : rank === "A" ? (
          <PipGlyph cx={50} cy={72.5} s={34} suit={suit} />
        ) : (
          <NumberFace rank={rank} suit={suit} />
        )}
        {/* corner indices — top-left and mirrored bottom-right */}
        <CornerIndex rank={rank} suit={suit} />
        <G rotation={180} originX={50} originY={72.5}>
          <CornerIndex rank={rank} suit={suit} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "#D8CFC0",
    overflow: "hidden",
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
