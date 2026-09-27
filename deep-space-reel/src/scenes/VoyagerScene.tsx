import { evolvePath } from "@remotion/paths";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ChapterTitle } from "../components/ChapterTitle";
import { Label } from "../components/Label";
import { ORBIT_AU, VOYAGER } from "../data/facts";
import { FONT } from "../fonts";
import { ALPHA, CLAMP, COLOR, EASE } from "../theme";

/**
 * 01 — Voyager 1, 1977 → 2012.
 * A heliocentric schematic on a logarithmic distance scale. The probe climbs
 * out through the planets while the camera pulls back until the heliopause
 * enters frame. Orbits draw on with @remotion/paths.
 */

const SUN = { x: 300, y: 650 };
// Screen radius (world px, before camera scale) for a distance in AU.
const K = 560;
const rOf = (au: number) => K * Math.log10(1 + au / 0.6);

// Direction of travel (degrees, screen space, negative = up). Curves a little
// through the gravity assists, then runs straight. Schematic, not an ephemeris.
const headingOf = (au: number) => -22 + 14 * Math.exp(-(au - 1) / 4);

const toScreen = (au: number, scale: number, headingDeg = headingOf(au)) => {
  const a = (headingDeg * Math.PI) / 180;
  const r = rOf(au) * scale;
  return { x: SUN.x + r * Math.cos(a), y: SUN.y + r * Math.sin(a) };
};

const circlePath = (cx: number, cy: number, r: number, startDeg: number) => {
  const a = (startDeg * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a);
  const y0 = cy + r * Math.sin(a);
  const x1 = cx - r * Math.cos(a);
  const y1 = cy - r * Math.sin(a);
  return `M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1} A ${r} ${r} 0 1 1 ${x0} ${y0}`;
};

const arcPath = (
  cx: number,
  cy: number,
  r: number,
  fromDeg: number,
  toDeg: number,
) => {
  const p = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  };
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  const sweep = toDeg > fromDeg ? 1 : 0;
  return `M ${p(fromDeg)} A ${r} ${r} 0 ${large} ${sweep} ${p(toDeg)}`;
};

// Probe progress keyframes: [frame, AU, decimal year]. Dates from facts.ts.
const KF_FRAMES = [18, 70, 96, 150, 236];
const KF_AU = [
  ORBIT_AU.earth,
  ORBIT_AU.jupiter,
  ORBIT_AU.saturn,
  VOYAGER.paleBlueDotAU,
  VOYAGER.heliopauseAU,
];
const KF_YEAR = [1977.68, 1979.17, 1980.87, 1990.12, 2012.65];

type Orbit = {
  au: number;
  name: string;
  dotDeg: number;
  color: string;
  delay: number;
};
const ORBITS: Orbit[] = [
  {
    au: ORBIT_AU.earth,
    name: "EARTH",
    dotDeg: headingOf(ORBIT_AU.earth),
    color: COLOR.white,
    delay: 0,
  },
  { au: ORBIT_AU.mars, name: "MARS", dotDeg: 128, color: COLOR.rust, delay: 4 },
  {
    au: ORBIT_AU.jupiter,
    name: "JUPITER",
    dotDeg: headingOf(ORBIT_AU.jupiter),
    color: COLOR.white,
    delay: 8,
  },
  {
    au: ORBIT_AU.saturn,
    name: "SATURN",
    dotDeg: headingOf(ORBIT_AU.saturn),
    color: COLOR.white,
    delay: 12,
  },
  {
    au: ORBIT_AU.uranus,
    name: "URANUS",
    dotDeg: 64,
    color: COLOR.white,
    delay: 16,
  },
  {
    au: ORBIT_AU.neptune,
    name: "NEPTUNE",
    dotDeg: -128,
    color: COLOR.white,
    delay: 20,
  },
];

export const VoyagerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Camera: slow pull-back from the inner planets to the heliopause.
  const scale = interpolate(frame, [0, durationInFrames], [1.5, 0.78], {
    ...CLAMP,
    easing: EASE.camera,
  });

  // Probe travels in log-distance so screen speed stays even.
  const logAu = interpolate(
    frame,
    KF_FRAMES,
    KF_AU.map((a) => Math.log(a)),
    {
      ...CLAMP,
      easing: [EASE.camera, EASE.linear, EASE.linear, EASE.reveal],
    },
  );
  const au = Math.exp(logAu);
  const year = interpolate(frame, KF_FRAMES, KF_YEAR, CLAMP);
  const launched = frame >= KF_FRAMES[0];
  const head = toScreen(au, scale);

  // Trail: sample the path from 1 AU to the probe's current distance.
  const trailPts: string[] = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const a = Math.exp((Math.log(au) * i) / steps);
    const p = toScreen(a, scale);
    trailPts.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }

  const appear = (at: number, len = 22) =>
    interpolate(frame, [at, at + len], [0, 1], {
      ...CLAMP,
      easing: EASE.reveal,
    });

  const hpR = rOf(VOYAGER.heliopauseAU) * scale;
  const hpDraw = interpolate(frame, [176, 236], [0, 1], {
    ...CLAMP,
    easing: EASE.camera,
  });

  const wp = (au: number) => toScreen(au, scale);
  // label offset perpendicular to the path (below-right / above-left)
  const n = { x: 0.375, y: 0.927 };
  const pbd = wp(VOYAGER.paleBlueDotAU);
  const earth = wp(ORBIT_AU.earth);
  const lookBack = interpolate(frame, [152, 190], [0, 1], {
    ...CLAMP,
    easing: EASE.camera,
  });
  const lookBackFade = interpolate(frame, [226, 262], [1, 0.25], CLAMP);

  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {/* orbits */}
        {ORBITS.map((o) => {
          const r = rOf(o.au) * scale;
          const d = circlePath(SUN.x, SUN.y, r, o.dotDeg);
          const evo = evolvePath(
            interpolate(frame, [o.delay, o.delay + 46], [0, 1], {
              ...CLAMP,
              easing: EASE.camera,
            }),
            d,
          );
          const dot = toScreen(o.au, scale, o.dotDeg);
          return (
            <g key={o.name}>
              <path
                d={d}
                fill="none"
                stroke={o.color}
                strokeWidth={1}
                opacity={o.name === "MARS" ? 0.5 : ALPHA.line}
                strokeDasharray={evo.strokeDasharray}
                strokeDashoffset={evo.strokeDashoffset}
              />
              <circle
                cx={dot.x}
                cy={dot.y}
                r={o.name === "MARS" ? 4 : 3}
                fill={o.color}
                opacity={appear(o.delay + 30) * 0.9}
              />
            </g>
          );
        })}

        {/* heliopause — dashed gold arc, drawn as the probe arrives */}
        <path
          d={arcPath(SUN.x, SUN.y, hpR, -78, -78 + 86 * hpDraw)}
          fill="none"
          stroke={COLOR.gold}
          strokeWidth={1.2}
          strokeDasharray="2 7"
          opacity={hpDraw > 0 ? 0.8 : 0}
        />

        {/* Pale Blue Dot: the look back toward Earth */}
        <line
          x1={pbd.x}
          y1={pbd.y}
          x2={pbd.x + (earth.x - pbd.x) * lookBack}
          y2={pbd.y + (earth.y - pbd.y) * lookBack}
          stroke={COLOR.white}
          strokeWidth={1}
          strokeDasharray="1 5"
          opacity={frame >= 152 ? 0.55 * lookBackFade : 0}
        />

        {/* trajectory */}
        {launched ? (
          <polyline
            points={trailPts.join(" ")}
            fill="none"
            stroke={COLOR.gold}
            strokeWidth={1.4}
            opacity={0.9}
          />
        ) : null}

        {/* the Sun */}
        <circle
          cx={SUN.x}
          cy={SUN.y}
          r={5}
          fill={COLOR.gold}
          opacity={appear(0)}
        />
        <circle
          cx={SUN.x}
          cy={SUN.y}
          r={14}
          fill="none"
          stroke={COLOR.gold}
          strokeWidth={1}
          opacity={0.35 * appear(6)}
        />

        {/* probe reticle */}
        {launched ? (
          <g>
            <circle cx={head.x} cy={head.y} r={2.6} fill={COLOR.white} />
            <circle
              cx={head.x}
              cy={head.y}
              r={9}
              fill="none"
              stroke={COLOR.white}
              strokeWidth={1}
              opacity={0.7}
            />
            <line
              x1={head.x + 12}
              y1={head.y}
              x2={head.x + 56}
              y2={head.y}
              stroke={COLOR.white}
              strokeWidth={1}
              opacity={0.5}
            />
          </g>
        ) : null}
      </svg>

      <Label
        x={SUN.x - 12}
        y={SUN.y + 26}
        mono="SOL"
        zh="太阳"
        opacity={appear(10) * 0.75}
        size={15}
      />

      {launched ? (
        <Label
          x={head.x + 64}
          y={head.y - 12}
          mono="VOYAGER 1"
          zh="旅行者1号"
          opacity={appear(KF_FRAMES[0])}
        />
      ) : null}

      {/* waypoints */}
      <Label
        x={earth.x + n.x * 30}
        y={earth.y + n.y * 30}
        mono={`${VOYAGER.launch}  LAUNCH`}
        zh="发射"
        accent={COLOR.gold}
        opacity={
          appear(KF_FRAMES[0]) *
          interpolate(frame, [120, 150], [1, 0.45], CLAMP)
        }
        size={15}
      />
      <Label
        x={wp(ORBIT_AU.jupiter).x + n.x * 26}
        y={wp(ORBIT_AU.jupiter).y + n.y * 26}
        mono={`JUPITER  ${VOYAGER.jupiter}`}
        opacity={
          appear(KF_FRAMES[1]) *
          interpolate(frame, [150, 180], [0.9, 0.45], CLAMP)
        }
        size={14}
      />
      <Label
        x={wp(ORBIT_AU.saturn).x - n.x * 26}
        y={wp(ORBIT_AU.saturn).y - n.y * 26}
        above
        align="right"
        mono={`SATURN  ${VOYAGER.saturn}`}
        opacity={
          appear(KF_FRAMES[2]) *
          interpolate(frame, [150, 180], [0.9, 0.45], CLAMP)
        }
        size={14}
      />
      <Label
        x={pbd.x + n.x * 30}
        y={pbd.y + n.y * 30}
        mono={`${VOYAGER.paleBlueDot}  ·  ${VOYAGER.paleBlueDotKm}`}
        zh="回望地球：暗淡蓝点"
        accent={COLOR.gold}
        opacity={
          appear(KF_FRAMES[3]) *
          interpolate(frame, [236, 262], [1, 0.55], CLAMP)
        }
      />
      <Label
        x={wp(VOYAGER.heliopauseAU).x - 24}
        y={wp(VOYAGER.heliopauseAU).y - 30}
        above
        align="right"
        mono={`HELIOPAUSE  ·  ${VOYAGER.heliopauseAU} AU  ·  ${VOYAGER.heliopause}`}
        zh={`穿越日球层顶，进入星际空间 · 距太阳 ${VOYAGER.heliopauseKm}`}
        accent={COLOR.gold}
        opacity={appear(KF_FRAMES[4] - 6, 26)}
      />

      <ChapterTitle index="01" zh="远航" en="VOYAGER 1 · 1977" />

      {/* readout panel */}
      <div
        style={{
          position: "absolute",
          right: 140,
          bottom: 150,
          width: 420,
          opacity: appear(30, 30),
          fontFamily: FONT.mono,
          color: COLOR.white,
        }}
      >
        <div
          style={{
            height: 1,
            backgroundColor: COLOR.white,
            opacity: ALPHA.line,
          }}
        />
        <Readout
          label="YEAR"
          value={launched ? Math.floor(year).toString() : "1977"}
          big
        />
        <Readout
          label="DISTANCE"
          value={`${au.toFixed(1).padStart(5, "0")} AU`}
        />
        <div
          style={{
            height: 1,
            backgroundColor: COLOR.white,
            opacity: ALPHA.line,
          }}
        />
        <div
          style={{
            fontFamily: FONT.serif,
            fontSize: 17,
            letterSpacing: "0.2em",
            opacity: 0.5,
            marginTop: 14,
          }}
        >
          对数距离尺度 · 示意轨迹
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Readout: React.FC<{ label: string; value: string; big?: boolean }> = ({
  label,
  value,
  big,
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: big ? "16px 0 10px" : "8px 0",
    }}
  >
    <span
      style={{
        fontWeight: 300,
        fontSize: 15,
        letterSpacing: "0.24em",
        opacity: 0.55,
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontWeight: 200,
        fontSize: big ? 64 : 28,
        letterSpacing: "0.06em",
        color: big ? COLOR.gold : COLOR.white,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  </div>
);
