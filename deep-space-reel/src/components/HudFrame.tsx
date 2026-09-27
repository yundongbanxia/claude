import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT } from "../fonts";
import { ALPHA, CLAMP, COLOR, EASE, SCENE_START } from "../theme";

const INSET = 56;
const TICK = 22;

const CHAPTERS: { from: number; label: string }[] = [
  { from: SCENE_START.prologue, label: "00  序" },
  { from: SCENE_START.voyager + 10, label: "01  远航" },
  { from: SCENE_START.lightDay + 10, label: "01  远航 · 光日" },
  { from: SCENE_START.mars + 10, label: "02  火星" },
  { from: SCENE_START.outro + 10, label: "03  未完" },
];

const timecode = (frame: number, fps: number) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = Math.floor(frame / fps);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(frame % fps)}`;
};

const Corner: React.FC<{ x: number; y: number; sx: 1 | -1; sy: 1 | -1 }> = ({
  x,
  y,
  sx,
  sy,
}) => (
  <path
    d={`M ${x} ${y + sy * TICK} L ${x} ${y} L ${x + sx * TICK} ${y}`}
    stroke={COLOR.white}
    strokeWidth={1}
    fill="none"
  />
);

/**
 * Persistent HUD chrome that sits above every scene: corner registration
 * marks, timecode, chapter, reel progress. Deliberately quiet.
 */
export const HudFrame: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const chapter = [...CHAPTERS].reverse().find((c) => frame >= c.from)!;

  const label: React.CSSProperties = {
    position: "absolute",
    fontFamily: FONT.mono,
    fontWeight: 300,
    fontSize: 16,
    letterSpacing: "0.22em",
    color: COLOR.white,
    opacity: ALPHA.muted,
  };

  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(
          frame,
          [12, 48, durationInFrames - 40, durationInFrames - 12],
          [0, 1, 1, 0],
          { ...CLAMP, easing: EASE.reveal },
        ),
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", opacity: ALPHA.line }}
      >
        <Corner x={INSET} y={INSET} sx={1} sy={1} />
        <Corner x={width - INSET} y={INSET} sx={-1} sy={1} />
        <Corner x={INSET} y={height - INSET} sx={1} sy={-1} />
        <Corner x={width - INSET} y={height - INSET} sx={-1} sy={-1} />
        {/* reel progress — a single hairline along the bottom */}
        <line
          x1={INSET + 40}
          x2={
            INSET +
            40 +
            (width - 2 * INSET - 80) * (frame / (durationInFrames - 1))
          }
          y1={height - INSET}
          y2={height - INSET}
          stroke={COLOR.white}
          strokeWidth={1}
        />
      </svg>

      <div style={{ ...label, left: INSET + 36, top: INSET - 8 }}>
        DEEP SPACE REEL
      </div>
      <div
        style={{
          ...label,
          right: INSET + 36,
          top: INSET - 8,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        T+{timecode(frame, fps)}
      </div>
      <div
        style={{
          ...label,
          left: INSET + 36,
          bottom: INSET - 8 + 18,
          fontFamily: FONT.serif,
          fontWeight: 400,
          letterSpacing: "0.3em",
        }}
      >
        {chapter.label}
      </div>
      <div style={{ ...label, right: INSET + 36, bottom: INSET - 8 + 18 }}>
        1920×1080 · 30 FPS
      </div>
    </AbsoluteFill>
  );
};
