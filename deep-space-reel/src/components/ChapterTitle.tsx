import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FONT } from "../fonts";
import { CLAMP, COLOR, EASE, SAFE } from "../theme";

/**
 * Chapter slate, top-left inside the safe area:
 *   01 ──
 *   远航
 *   VOYAGER 1
 */
export const ChapterTitle: React.FC<{
  index: string;
  zh: string;
  en: string;
  delay?: number;
}> = ({ index, zh, en, delay = 8 }) => {
  const frame = useCurrentFrame() - delay;
  const reveal = (a: number, b: number) =>
    interpolate(frame, [a, b], [0, 1], { ...CLAMP, easing: EASE.reveal });

  return (
    <div style={{ position: "absolute", left: SAFE.x, top: SAFE.y + 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            fontFamily: FONT.mono,
            fontWeight: 300,
            fontSize: 20,
            letterSpacing: "0.3em",
            color: COLOR.gold,
            opacity: reveal(0, 24),
          }}
        >
          {index}
        </div>
        <div
          style={{
            height: 1,
            width: 64 * reveal(4, 34),
            backgroundColor: COLOR.gold,
            opacity: 0.7,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: FONT.serif,
          fontWeight: 300,
          fontSize: 76,
          letterSpacing: "0.2em",
          color: COLOR.white,
          marginTop: 18,
          lineHeight: 1.1,
          opacity: reveal(8, 38),
          translate: `0px ${(1 - reveal(8, 44)) * 14}px`,
        }}
      >
        {zh}
      </div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontWeight: 200,
          fontSize: 22,
          letterSpacing: "0.36em",
          color: COLOR.white,
          marginTop: 14,
          opacity: 0.6 * reveal(18, 48),
        }}
      >
        {en}
      </div>
    </div>
  );
};
