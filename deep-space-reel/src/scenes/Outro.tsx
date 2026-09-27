import React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT } from "../fonts";
import { CLAMP, COLOR, EASE } from "../theme";

/**
 * 03 — Close. One line, one hairline, then black. The final 14 frames fade
 * everything out so the reel ends on the starfield going dark.
 */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: interpolate(
          frame,
          [durationInFrames - 22, durationInFrames - 4],
          [1, 0],
          { ...CLAMP, easing: EASE.exit },
        ),
        scale: interpolate(frame, [0, durationInFrames], [1.02, 1], {
          ...CLAMP,
          easing: EASE.linear,
        }),
      }}
    >
      <Interactive.Div
        name="Closing line"
        style={{
          fontFamily: FONT.serif,
          fontWeight: 300,
          fontSize: 64,
          letterSpacing: "0.3em",
          marginRight: "-0.3em",
          color: COLOR.white,
          opacity: interpolate(frame, [6, 34], [0, 1], {
            ...CLAMP,
            easing: EASE.reveal,
          }),
        }}
      >
        信号，仍在路上
      </Interactive.Div>
      <div
        style={{
          height: 1,
          marginTop: 40,
          marginBottom: 30,
          backgroundColor: COLOR.gold,
          opacity: 0.7,
          width: interpolate(frame, [12, 48], [0, 360], {
            ...CLAMP,
            easing: EASE.reveal,
          }),
        }}
      />
      <Interactive.Div
        name="Closing line EN"
        style={{
          fontFamily: FONT.mono,
          fontWeight: 200,
          fontSize: 20,
          letterSpacing: "0.46em",
          marginRight: "-0.46em",
          color: COLOR.white,
          opacity: interpolate(frame, [18, 46], [0, 0.6], {
            ...CLAMP,
            easing: EASE.reveal,
          }),
        }}
      >
        THE SIGNAL IS STILL ON ITS WAY
      </Interactive.Div>
      <div
        style={{
          position: "absolute",
          bottom: 140,
          fontFamily: FONT.mono,
          fontWeight: 300,
          fontSize: 14,
          letterSpacing: "0.3em",
          color: COLOR.white,
          opacity: interpolate(frame, [26, 50], [0, 0.4], {
            ...CLAMP,
            easing: EASE.reveal,
          }),
        }}
      >
        DATA · NASA / JPL · CNSA · NATURE ASTRONOMY — SOURCES IN README
      </div>
    </AbsoluteFill>
  );
};
