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
 * 00 — Title. One hairline opens the frame, the title settles onto it.
 * Camera: continuous 4% push-in.
 */
export const Prologue: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        scale: interpolate(frame, [0, durationInFrames], [1, 1.04], {
          ...CLAMP,
          easing: EASE.linear,
        }),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        <Interactive.Div
          name="Kicker"
          style={{
            fontFamily: FONT.mono,
            fontWeight: 300,
            fontSize: 20,
            letterSpacing: "0.5em",
            color: COLOR.gold,
            marginBottom: 44,
            opacity: interpolate(frame, [8, 38], [0, 0.85], {
              ...CLAMP,
              easing: EASE.reveal,
            }),
          }}
        >
          1965 — 2026
        </Interactive.Div>

        <Interactive.Div
          name="Title"
          style={{
            fontFamily: FONT.serif,
            fontWeight: 300,
            fontSize: 112,
            letterSpacing: "0.32em",
            // letter-spacing adds trailing space; pull it back to stay centred
            marginRight: "-0.32em",
            color: COLOR.white,
            lineHeight: 1,
            opacity: interpolate(frame, [22, 62], [0, 1], {
              ...CLAMP,
              easing: EASE.reveal,
            }),
            translate: interpolate(frame, [22, 70], ["0px 18px", "0px 0px"], {
              ...CLAMP,
              easing: EASE.reveal,
            }),
            filter: `blur(${interpolate(frame, [22, 58], [8, 0], {
              ...CLAMP,
              easing: EASE.reveal,
            })}px)`,
          }}
        >
          人类的深空之旅
        </Interactive.Div>

        <div
          style={{
            height: 1,
            marginTop: 56,
            marginBottom: 40,
            backgroundColor: COLOR.white,
            opacity: 0.45,
            width: interpolate(frame, [4, 56], [0, 720], {
              ...CLAMP,
              easing: EASE.reveal,
            }),
          }}
        />

        <Interactive.Div
          name="Subtitle ZH"
          style={{
            fontFamily: FONT.serif,
            fontWeight: 300,
            fontSize: 40,
            letterSpacing: "0.4em",
            marginRight: "-0.4em",
            color: COLOR.white,
            opacity: interpolate(frame, [48, 84], [0, 0.85], {
              ...CLAMP,
              easing: EASE.reveal,
            }),
          }}
        >
          从旅行者号到火星
        </Interactive.Div>

        <Interactive.Div
          name="Subtitle EN"
          style={{
            fontFamily: FONT.mono,
            fontWeight: 200,
            fontSize: 22,
            letterSpacing: "0.46em",
            marginRight: "-0.46em",
            marginTop: 22,
            color: COLOR.white,
            opacity: interpolate(frame, [60, 96], [0, 0.55], {
              ...CLAMP,
              easing: EASE.reveal,
            }),
          }}
        >
          HUMANITY'S JOURNEY INTO DEEP SPACE
        </Interactive.Div>
      </div>
    </AbsoluteFill>
  );
};
