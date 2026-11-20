import React, { memo } from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";

import { A } from "@/src/anime/tokens";

// Hanging banner with the Tunisian flag emblem (red field, white disc, red
// crescent and star). Decorative only. Drawn in code — no image asset.

const star = (cx: number, cy: number, outer: number, inner: number, rotDeg: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rotDeg + i * 36) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
};

function TunisianFlagBanner({ width = 46 }: { width?: number }) {
  const height = (width * 96) / 60;
  return (
    <Svg width={width} height={height} viewBox="0 0 60 96" pointerEvents="none">
      <Defs>
        <LinearGradient id="flagRed" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E8323B" />
          <Stop offset="0.6" stopColor={A.red} />
          <Stop offset="1" stopColor="#A81820" />
        </LinearGradient>
      </Defs>
      <Path d="M3,4 H57 V90 L30,74 L3,90 Z" fill="url(#flagRed)" />
      <Path d="M3,4 H57 V90 L30,74 L3,90 Z" fill="none" stroke={A.gold} strokeWidth={1.5} />
      <Rect x={0} y={0} width={60} height={6} rx={3} fill={A.gold} />
      <Circle cx={30} cy={38} r={17} fill="#FFFFFF" />
      <Circle cx={29} cy={38} r={12.5} fill={A.red} />
      <Circle cx={32.6} cy={38} r={10} fill="#FFFFFF" />
      <Polygon points={star(33.4, 38, 7.4, 2.9, 180)} fill={A.red} />
    </Svg>
  );
}

export default memo(TunisianFlagBanner);
