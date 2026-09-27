import React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LIGHT_DAY, MARS } from "../data/facts";
import { FONT } from "../fonts";
import { ALPHA, CLAMP, COLOR, EASE } from "../theme";

/**
 * 01b — One light-day. A single ruler, Earth → Voyager 1, 24 hours long.
 * A signal pulse crosses it while the clock runs; the whole Earth–Mars delay
 * turns out to be a sliver at the far left.
 */

const X0 = 180;
const X1 = 1740;
const Y = 560;
const L = X1 - X0;
const minutesToX = (m: number) => X0 + (m / (LIGHT_DAY.hours * 60)) * L;

const PULSE_FROM = 18;
const PULSE_TO = 112;

const hms = (hours: number) => {
  const s = Math.round(hours * 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

export const LightDayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const p = interpolate(frame, [PULSE_FROM, PULSE_TO], [0, 1], {
    ...CLAMP,
    easing: EASE.camera,
  });
  const px = X0 + p * L;
  const arrived = frame >= PULSE_TO;
  const appear = (at: number, len = 26) =>
    interpolate(frame, [at, at + len], [0, 1], {
      ...CLAMP,
      easing: EASE.reveal,
    });
  const ruler = appear(0, 30);

  const marsA = minutesToX(MARS.delayMinMin);
  const marsB = minutesToX(MARS.delayMaxMin);

  return (
    <AbsoluteFill
      style={{
        scale: interpolate(frame, [0, durationInFrames], [1, 1.03], {
          ...CLAMP,
          easing: EASE.linear,
        }),
      }}
    >
      {/* headline */}
      <div
        style={{
          position: "absolute",
          top: 176,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Interactive.Div
          name="Headline"
          style={{
            fontFamily: FONT.serif,
            fontWeight: 300,
            fontSize: 60,
            letterSpacing: "0.28em",
            marginRight: "-0.28em",
            color: COLOR.white,
            opacity: interpolate(frame, [4, 34], [0, 1], {
              ...CLAMP,
              easing: EASE.reveal,
            }),
          }}
        >
          距离，以光的时间丈量
        </Interactive.Div>
        <Interactive.Div
          name="Headline EN"
          style={{
            fontFamily: FONT.mono,
            fontWeight: 200,
            fontSize: 20,
            letterSpacing: "0.44em",
            marginRight: "-0.44em",
            marginTop: 20,
            color: COLOR.white,
            opacity: interpolate(frame, [14, 44], [0, 0.55], {
              ...CLAMP,
              easing: EASE.reveal,
            }),
          }}
        >
          DISTANCE, MEASURED IN LIGHT-TIME
        </Interactive.Div>
      </div>

      {/* clock */}
      <div
        style={{
          position: "absolute",
          top: 350,
          width: "100%",
          textAlign: "center",
          opacity: appear(10),
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontWeight: 300,
            fontSize: 16,
            letterSpacing: "0.3em",
            color: COLOR.white,
            opacity: ALPHA.muted,
          }}
        >
          ONE-WAY SIGNAL TIME
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontWeight: 200,
            fontSize: 92,
            letterSpacing: "0.08em",
            marginTop: 6,
            color: arrived ? COLOR.gold : COLOR.white,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {hms(p * LIGHT_DAY.hours)}
        </div>
      </div>

      <svg width={width} height={height} style={{ position: "absolute" }}>
        <defs>
          <linearGradient
            id="pulse"
            gradientUnits="userSpaceOnUse"
            x1={px - 180}
            x2={px}
            y1={0}
            y2={0}
          >
            <stop offset="0" stopColor={COLOR.gold} stopOpacity={0} />
            <stop offset="1" stopColor={COLOR.gold} stopOpacity={1} />
          </linearGradient>
        </defs>

        {/* ruler: full length, then the travelled part brighter */}
        <line
          x1={X0}
          x2={X0 + L * ruler}
          y1={Y}
          y2={Y}
          stroke={COLOR.white}
          strokeWidth={1}
          opacity={ALPHA.line}
        />
        <line
          x1={X0}
          x2={px}
          y1={Y}
          y2={Y}
          stroke={COLOR.white}
          strokeWidth={1}
          opacity={0.55}
        />

        {/* hour ticks */}
        {new Array(LIGHT_DAY.hours + 1).fill(true).map((_, h) => {
          const x = X0 + (h / LIGHT_DAY.hours) * L;
          const major = h % 6 === 0;
          return (
            <line
              key={h}
              x1={x}
              x2={x}
              y1={Y}
              y2={Y + (major ? 16 : 7)}
              stroke={COLOR.white}
              strokeWidth={1}
              opacity={(major ? 0.6 : 0.3) * appear(4 + h * 1.2, 14)}
            />
          );
        })}

        {/* signal pulse */}
        {frame >= PULSE_FROM && !arrived ? (
          <line
            x1={Math.max(X0, px - 180)}
            x2={px}
            y1={Y}
            y2={Y}
            stroke="url(#pulse)"
            strokeWidth={2}
          />
        ) : null}

        {/* endpoints */}
        <circle cx={X0} cy={Y} r={4} fill={COLOR.white} opacity={ruler} />
        <circle
          cx={X1}
          cy={Y}
          r={9}
          fill="none"
          stroke={arrived ? COLOR.gold : COLOR.white}
          strokeWidth={1}
          opacity={ruler * 0.8}
        />
        <circle
          cx={X1}
          cy={Y}
          r={2.6}
          fill={arrived ? COLOR.gold : COLOR.white}
          opacity={ruler}
        />

        {/* Earth–Mars delay, for scale */}
        <g opacity={appear(118)}>
          <line
            x1={marsA}
            x2={marsB}
            y1={Y - 8}
            y2={Y - 8}
            stroke={COLOR.rust}
            strokeWidth={3}
          />
          <line
            x1={marsA}
            x2={marsA}
            y1={Y - 8}
            y2={Y - 50}
            stroke={COLOR.rust}
            strokeWidth={1}
            opacity={0.8}
          />
        </g>
      </svg>

      {/* hour labels */}
      {[0, 6, 12, 18, 24].map((h) => (
        <div
          key={h}
          style={{
            position: "absolute",
            left: X0 + (h / LIGHT_DAY.hours) * L - 40,
            width: 80,
            top: Y + 26,
            textAlign: "center",
            fontFamily: FONT.mono,
            fontWeight: 300,
            fontSize: 14,
            letterSpacing: "0.16em",
            color: COLOR.white,
            opacity: 0.45 * appear(8 + h * 1.2, 14),
          }}
        >
          {h}H
        </div>
      ))}

      <EndLabel x={X0} align="left" mono="EARTH" zh="地球" opacity={ruler} />
      <EndLabel
        x={X1}
        align="right"
        mono="VOYAGER 1"
        zh="旅行者1号"
        opacity={ruler}
        color={arrived ? COLOR.gold : COLOR.white}
      />

      {/* Mars annotation */}
      <div
        style={{
          position: "absolute",
          left: marsA + 12,
          top: Y - 62,
          opacity: appear(122),
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontWeight: 300,
            fontSize: 16,
            letterSpacing: "0.16em",
            color: COLOR.rust,
          }}
        >
          MARS {MARS.delayMinMin}–{MARS.delayMaxMin} MIN
        </span>
        <span
          style={{
            fontFamily: FONT.serif,
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: "0.12em",
            color: COLOR.white,
            opacity: 0.75,
            marginLeft: 16,
          }}
        >
          地火单程时延，在这把尺上几乎看不见
        </span>
      </div>

      {/* the fact */}
      <div
        style={{
          position: "absolute",
          top: 700,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT.serif,
            fontWeight: 300,
            fontSize: 34,
            letterSpacing: "0.2em",
            color: COLOR.white,
            opacity: appear(100),
          }}
        >
          预计 {LIGHT_DAY.date}，旅行者1号距地球一光日
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontWeight: 200,
            fontSize: 60,
            letterSpacing: "0.1em",
            marginTop: 18,
            color: COLOR.gold,
            fontVariantNumeric: "tabular-nums",
            opacity: appear(108),
          }}
        >
          {LIGHT_DAY.km} KM
        </div>
        <div
          style={{
            fontFamily: FONT.serif,
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: "0.3em",
            marginTop: 18,
            color: COLOR.white,
            opacity: 0.6 * appear(116),
          }}
        >
          第一个抵达这一距离的人造物体
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EndLabel: React.FC<{
  x: number;
  align: "left" | "right";
  mono: string;
  zh: string;
  opacity: number;
  color?: string;
}> = ({ x, align, mono, zh, opacity, color = COLOR.white }) => (
  <div
    style={{
      position: "absolute",
      left: align === "left" ? x - 4 : undefined,
      right: align === "right" ? 1920 - x - 4 : undefined,
      top: Y + 54,
      textAlign: align,
      opacity,
    }}
  >
    <div
      style={{
        fontFamily: FONT.mono,
        fontWeight: 300,
        fontSize: 17,
        letterSpacing: "0.2em",
        color,
      }}
    >
      {mono}
    </div>
    <div
      style={{
        fontFamily: FONT.serif,
        fontWeight: 400,
        fontSize: 20,
        letterSpacing: "0.16em",
        color: COLOR.white,
        opacity: 0.75,
        marginTop: 4,
      }}
    >
      {zh}
    </div>
  </div>
);
