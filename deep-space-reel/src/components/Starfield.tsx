import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CLAMP, COLOR } from "../theme";

type Star = { x: number; y: number; r: number; a: number; tw: number };

type Layer = {
  seed: string;
  count: number;
  radius: [number, number];
  alpha: [number, number];
  // px per frame of lateral drift — ratio between layers sells the depth
  drift: number;
  // total push-in over the whole reel (scale delta)
  push: number;
};

// Three depths, drift ratio 1 : 2.5 : 6.
const LAYERS: Layer[] = [
  {
    seed: "far",
    count: 1100,
    radius: [0.35, 0.8],
    alpha: [0.18, 0.5],
    drift: 0.025,
    push: 0.02,
  },
  {
    seed: "mid",
    count: 280,
    radius: [0.7, 1.2],
    alpha: [0.35, 0.7],
    drift: 0.065,
    push: 0.05,
  },
  {
    seed: "near",
    count: 60,
    radius: [1.1, 1.7],
    alpha: [0.55, 0.9],
    drift: 0.15,
    push: 0.1,
  },
];

// Stars are generated over a field larger than the frame so drift and
// push never reveal an empty edge.
const OVERSCAN = 1.25;

const makeStars = (layer: Layer, width: number, height: number): Star[] => {
  const w = width * OVERSCAN;
  const h = height * OVERSCAN;
  return new Array(layer.count).fill(true).map((_, i) => {
    const r = (k: string) => random(`${layer.seed}-${k}-${i}`);
    return {
      x: (r("x") - 0.5) * w,
      y: (r("y") - 0.5) * h,
      r: layer.radius[0] + r("r") ** 2 * (layer.radius[1] - layer.radius[0]),
      a: layer.alpha[0] + r("a") * (layer.alpha[1] - layer.alpha[0]),
      // only ~1 in 6 stars scintillates, and only slightly
      tw: r("t") < 0.16 ? r("p") * Math.PI * 2 : -1,
    };
  });
};

export const Starfield: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const layers = useMemo(
    () => LAYERS.map((l) => ({ layer: l, stars: makeStars(l, width, height) })),
    [width, height],
  );

  const t = frame / durationInFrames;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLOR.space,
        opacity: interpolate(frame, [0, 36], [0, 1], CLAMP),
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {layers.map(({ layer, stars }) => {
          const s = 1 + layer.push * t;
          const dx = -layer.drift * frame;
          const dy = layer.drift * 0.35 * frame;
          return (
            <g
              key={layer.seed}
              transform={`translate(${width / 2 + dx} ${height / 2 + dy}) scale(${s})`}
            >
              {stars.map((star, i) => {
                const twinkle =
                  star.tw < 0
                    ? 1
                    : 0.8 + 0.2 * Math.sin(frame * 0.09 + star.tw);
                return (
                  <circle
                    key={i}
                    cx={star.x}
                    cy={star.y}
                    r={star.r}
                    fill={COLOR.white}
                    opacity={star.a * twinkle}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
