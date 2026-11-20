import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { A } from "@/src/anime/tokens";

// PLACEHOLDER ARTWORK (original, drawn in code — see docs/ANIME_ASSET_MANIFEST.md).
// An emerald courtyard wall framed by two horseshoe arches with gilded
// columns, zellige bands, hanging lanterns, palms and a distant white-and-blue
// townscape. It is purely decorative: it never receives touches and carries no
// interactive control. Intended to be replaced by a painted background in
// Stage 4 without changing the layout contract below.

/** Design height of the artwork; everything is authored on a 720-unit grid. */
const DESIGN_H = 720;
/** Width (in design units) taken by one side arch + column. */
const SIDE_UNITS = 200;

/** Share of the view width one decorative side may take at most. */
const MAX_SIDE_SHARE = 0.105;

/** Scale of the side artwork: full height when there is room, otherwise
 *  shrunk (and anchored to the floor) so the menu grid keeps its width. */
const sideScale = (width: number, height: number) =>
  Math.min(height / DESIGN_H, (width * MAX_SIDE_SHARE) / SIDE_UNITS);

/** Horizontal space one decorative side (arch + column) takes. */
export const arenaSideWidth = (width: number, height: number) =>
  SIDE_UNITS * sideScale(width, height);

const OPENING = "M0,150 A150,150 0 0 1 128,378 L128,720 L0,720 Z";
const ARCH_BAND =
  "M0,100 A200,200 0 0 1 178,391 L128,378 A150,150 0 0 0 0,150 Z";
const ARCH_MID = "M0,125 A175,175 0 0 1 153,385";
const LEAF = "M0,0 Q46,-95 0,-190 Q-46,-95 0,0 Z";

/** One arch + column + lantern, authored for the LEFT edge (mirrored for the right). */
function ArenaSide() {
  return (
    <G>
      {/* view through the arch: warm daylight, distant medina */}
      <G clipPath="url(#arenaOpening)">
        <Rect x={0} y={100} width={200} height={620} fill="url(#arenaSky)" />
        <Path d="M0,520 Q70,470 128,505 L128,720 L0,720 Z" fill="#7FB8A0" opacity={0.55} />
        {/* white-washed houses with blue doors and a dome */}
        <Circle cx={34} cy={520} r={30} fill={A.townWhite} />
        <Rect x={0} y={520} width={70} height={150} fill={A.townWhite} />
        <Rect x={62} y={556} width={70} height={120} fill="#E9E3D0" />
        <Path d="M20,670 L20,612 A14,14 0 0 1 48,612 L48,670 Z" fill={A.townBlue} />
        <Rect x={84} y={582} width={18} height={26} rx={3} fill={A.townBlue} />
        <Rect x={0} y={548} width={70} height={5} fill={A.townBlue} opacity={0.7} />
        {/* palms */}
        <G transform="translate(18,700)" opacity={0.96}>
          <Path d={LEAF} fill="#0B5A3C" transform="rotate(-14) scale(1.25)" />
          <Path d={LEAF} fill="#0F7A4E" transform="rotate(12) scale(1.1)" />
          <Path d={LEAF} fill="#0B5A3C" transform="rotate(38) scale(0.95)" />
          <Path d={LEAF} fill="#12905B" transform="rotate(62) scale(0.8)" />
        </G>
        {/* courtyard floor seen through the arch + emerald wash to sit in the palette */}
        <Rect x={0} y={660} width={200} height={60} fill={A.emeraldInk} opacity={0.75} />
        <Rect x={0} y={100} width={200} height={620} fill={A.emeraldDeep} opacity={0.3} />
      </G>

      {/* lantern glow + lantern hanging inside the opening */}
      <Circle cx={74} cy={452} r={120} fill="url(#arenaLanternGlow)" />
      <Line x1={74} y1={176} x2={74} y2={398} stroke={A.goldDark} strokeWidth={3} />
      <Polygon points="74,392 96,418 52,418" fill="url(#arenaGoldV)" />
      <Polygon
        points="50,418 98,418 106,470 90,508 58,508 42,470"
        fill="url(#arenaLanternGlass)"
        stroke={A.gold}
        strokeWidth={4}
      />
      <Line x1={74} y1={418} x2={74} y2={508} stroke={A.goldDark} strokeWidth={3} />
      <Line x1={58} y1={418} x2={54} y2={508} stroke={A.goldDark} strokeWidth={2} opacity={0.8} />
      <Line x1={90} y1={418} x2={94} y2={508} stroke={A.goldDark} strokeWidth={2} opacity={0.8} />
      <Line x1={42} y1={470} x2={106} y2={470} stroke={A.gold} strokeWidth={3} />
      <Polygon points="58,508 90,508 74,534" fill="url(#arenaGoldV)" />
      <Circle cx={74} cy={540} r={5} fill={A.goldLight} />

      {/* horseshoe arch: gilded band with a zellige course */}
      <Path d={ARCH_BAND} fill="url(#arenaGoldV)" />
      <Path d={ARCH_MID} stroke="#0B5B6E" strokeWidth={26} fill="none" />
      <Path
        d={ARCH_MID}
        stroke={A.ivory}
        strokeWidth={13}
        strokeDasharray="7 17"
        fill="none"
        opacity={0.9}
      />
      <Path
        d={ARCH_MID}
        stroke={A.goldLight}
        strokeWidth={5}
        strokeDasharray="5 19"
        strokeDashoffset={12}
        fill="none"
      />
      <Path d="M0,150 A150,150 0 0 1 128,378" stroke={A.goldDark} strokeWidth={3} fill="none" />
      <Path d="M0,100 A200,200 0 0 1 178,391" stroke={A.goldLight} strokeWidth={2.5} fill="none" />

      {/* column: capital, shaft with mosaic inlay, base */}
      <Rect x={114} y={376} width={82} height={16} rx={4} fill="url(#arenaGoldV)" />
      <Rect x={122} y={392} width={66} height={14} rx={3} fill={A.goldDark} />
      <Rect x={130} y={406} width={50} height={252} fill="url(#arenaGoldH)" />
      <Rect x={144} y={420} width={22} height={224} rx={4} fill="#0B5B6E" />
      <Line
        x1={155}
        y1={428}
        x2={155}
        y2={640}
        stroke={A.ivory}
        strokeWidth={9}
        strokeDasharray="9 13"
        opacity={0.9}
      />
      <Rect x={122} y={656} width={66} height={16} rx={3} fill="url(#arenaGoldV)" />
      <Rect x={112} y={672} width={86} height={48} fill="url(#arenaGoldH)" />
      <Rect x={112} y={672} width={86} height={4} fill={A.goldLight} opacity={0.8} />
    </G>
  );
}

interface Props {
  width: number;
  height: number;
}

function ArenaBackground({ width, height }: Props) {
  if (width <= 0 || height <= 0) return null;
  const u = height / DESIGN_H;
  const s = sideScale(width, height);
  const sideY = height - DESIGN_H * s; // side art stands on the floor
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="anime-arena-background">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="arenaWall" cx="50%" cy="46%" rx="62%" ry="78%">
            <Stop offset="0" stopColor="#0D6F55" />
            <Stop offset="0.55" stopColor={A.emeraldDeep} />
            <Stop offset="1" stopColor={A.emeraldInk} />
          </RadialGradient>
          <LinearGradient id="arenaTopShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={A.emeraldInk} stopOpacity={0.85} />
            <Stop offset="1" stopColor={A.emeraldInk} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="arenaGoldV" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={A.goldLight} />
            <Stop offset="0.5" stopColor={A.gold} />
            <Stop offset="1" stopColor={A.goldDark} />
          </LinearGradient>
          <LinearGradient id="arenaGoldH" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={A.goldDark} />
            <Stop offset="0.35" stopColor={A.goldLight} />
            <Stop offset="0.7" stopColor={A.gold} />
            <Stop offset="1" stopColor={A.goldDark} />
          </LinearGradient>
          <LinearGradient id="arenaSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={A.skyWarm} />
            <Stop offset="0.6" stopColor={A.sky} />
            <Stop offset="1" stopColor="#8CC9B5" />
          </LinearGradient>
          <RadialGradient id="arenaLanternGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#FFD27A" stopOpacity={0.75} />
            <Stop offset="0.45" stopColor="#FFB84A" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#FFB84A" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="arenaLanternGlass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE9A8" />
            <Stop offset="0.5" stopColor="#FFC24D" />
            <Stop offset="1" stopColor="#F08A1C" />
          </LinearGradient>
          {/* eight-point star lattice (two rotated squares) for the wall */}
          <Pattern id="arenaZellige" x={0} y={0} width={72} height={72} patternUnits="userSpaceOnUse">
            <Rect x={18} y={18} width={36} height={36} fill="none" stroke={A.gold} strokeWidth={1.4} />
            <Polygon
              points="36,10.5 61.5,36 36,61.5 10.5,36"
              fill="none"
              stroke={A.gold}
              strokeWidth={1.4}
            />
            <Circle cx={36} cy={36} r={4} fill={A.gold} />
            <Circle cx={0} cy={0} r={3} fill={A.gold} />
            <Circle cx={72} cy={0} r={3} fill={A.gold} />
            <Circle cx={0} cy={72} r={3} fill={A.gold} />
            <Circle cx={72} cy={72} r={3} fill={A.gold} />
          </Pattern>
          <ClipPath id="arenaOpening">
            <Path d={OPENING} />
          </ClipPath>
        </Defs>

        {/* emerald wall + faint gilded lattice */}
        <Rect x={0} y={0} width={width} height={height} fill="url(#arenaWall)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#arenaZellige)" opacity={0.11} />

        {/* courtyard floor */}
        <Rect x={0} y={height - 62 * u} width={width} height={62 * u} fill={A.emeraldInk} opacity={0.6} />
        <Rect x={0} y={height - 62 * u} width={width} height={Math.max(1, 3 * u)} fill={A.gold} opacity={0.75} />
        <Rect x={0} y={height - 50 * u} width={width} height={Math.max(1, 1.5 * u)} fill={A.gold} opacity={0.35} />

        {/* the two framing arches */}
        <G transform={`translate(0,${sideY}) scale(${s})`}>
          <ArenaSide />
        </G>
        <G transform={`translate(${width},${sideY}) scale(${-s},${s})`}>
          <ArenaSide />
        </G>

        {/* keeps the top bar readable over the arches */}
        <Rect x={0} y={0} width={width} height={150 * u} fill="url(#arenaTopShade)" />
      </Svg>
    </View>
  );
}

export default memo(ArenaBackground);
