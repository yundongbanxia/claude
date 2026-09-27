import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import { ChapterTitle } from "../components/ChapterTitle";
import { MARS, MARS_SITES, MARS_TIMELINE } from "../data/facts";
import { FONT } from "../fonts";
import { ALPHA, CLAMP, COLOR, EASE, SAFE } from "../theme";
import { MarsGlobe, latLonToVec, spinForCenterLon } from "./mars/MarsGlobe";

/**
 * 02 — Mars. A slow push toward a turning globe; the milestones build on
 * the left, and the three active landing sites light up on the surface as
 * their year arrives. Labels are projected from 3D so they stay pinned.
 */

// 3D viewport: a right-hand slice of the frame, globe centred at x = 1180.
const CANVAS = { left: 620, width: 1120, height: 1080 };
const FOV = 30;
const CAM_Z = 6;
const TILT = (14 * Math.PI) / 180; // show a little of the north

// When each timeline row lands (scene frames).
const ROW_AT = [26, 56, 104, 144, 180];
// Label slots to the right of the globe, keyed by site id (north → south).
const SLOT_Y: Record<string, number> = {
  zhurong: 396,
  perseverance: 506,
  curiosity: 640,
};
const LABEL_X = 1628;

export const MarsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Camera push: globe moves from 5.8 to 5.05 units away (≈ +15% on screen).
  const dist = interpolate(frame, [0, durationInFrames], [5.8, 5.05], {
    ...CLAMP,
    easing: EASE.camera,
  });
  const z = CAM_Z - dist;
  // Rotation is prograde: features drift left → right, centre longitude falls.
  const centerLon = interpolate(frame, [0, durationInFrames], [135, 82], {
    ...CLAMP,
    easing: EASE.linear,
  });
  const spin = spinForCenterLon(centerLon);

  const camera = useMemo(() => {
    const c = new PerspectiveCamera(
      FOV,
      CANVAS.width / CANVAS.height,
      0.1,
      100,
    );
    c.position.set(0, 0, CAM_Z);
    c.updateMatrixWorld();
    c.updateProjectionMatrix();
    return c;
  }, []);

  const rot = new Matrix4()
    .makeRotationX(TILT)
    .multiply(new Matrix4().makeRotationY(spin));
  const world = new Matrix4().makeTranslation(0, 0, z).multiply(rot);

  const project = (lat: number, lon: number) => {
    const local = latLonToVec(lat, lon);
    const p = local.clone().applyMatrix4(world);
    const n = local.clone().applyMatrix4(rot).normalize();
    const toCam = new Vector3(0, 0, CAM_Z).sub(p).normalize();
    const ndc = p.clone().project(camera);
    return {
      x: CANVAS.left + ((ndc.x + 1) / 2) * CANVAS.width,
      y: ((1 - ndc.y) / 2) * CANVAS.height,
      facing: n.dot(toCam),
    };
  };

  const appear = (at: number, len = 24) =>
    interpolate(frame, [at, at + len], [0, 1], {
      ...CLAMP,
      easing: EASE.reveal,
    });

  const siteRow = (id: string) => MARS_TIMELINE.findIndex((m) => m.site === id);

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: CANVAS.left, top: 0 }}>
        <ThreeCanvas
          width={CANVAS.width}
          height={CANVAS.height}
          flat
          camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 100 }}
          gl={{ antialias: true }}
        >
          <MarsGlobe
            z={z}
            tilt={TILT}
            spin={spin}
            graticule={0.1 + 0.06 * appear(10, 40)}
          />
        </ThreeCanvas>
      </div>

      {/* site markers + leaders */}
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {MARS_SITES.map((s) => {
          const at = ROW_AT[siteRow(s.id)];
          const on = appear(at);
          const p = project(s.lat, s.lon);
          const vis = interpolate(p.facing, [0.05, 0.3], [0, 1], CLAMP) * on;
          const slotY = SLOT_Y[s.id];
          const draw = interpolate(frame, [at + 4, at + 30], [0, 1], {
            ...CLAMP,
            easing: EASE.camera,
          });
          const elbowX = LABEL_X - 36;
          return (
            <g key={s.id} opacity={vis}>
              <circle
                cx={p.x}
                cy={p.y}
                r={10 + 8 * (1 - on)}
                fill="none"
                stroke={COLOR.white}
                strokeWidth={1}
              />
              <circle cx={p.x} cy={p.y} r={2.4} fill={COLOR.gold} />
              <polyline
                points={`${p.x + 10},${p.y} ${p.x + 10 + (elbowX - p.x - 10) * draw},${p.y + (slotY - p.y) * draw} ${elbowX + 26 * draw},${slotY}`}
                fill="none"
                stroke={COLOR.white}
                strokeWidth={1}
                opacity={0.45}
              />
            </g>
          );
        })}
      </svg>

      {MARS_SITES.map((s) => {
        const at = ROW_AT[siteRow(s.id)];
        const p = project(s.lat, s.lon);
        const vis = interpolate(p.facing, [0.05, 0.3], [0, 1], CLAMP);
        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: LABEL_X,
              top: SLOT_Y[s.id] - 12,
              opacity: appear(at + 18) * vis,
              whiteSpace: "nowrap",
            }}
          >
            <div
              style={{
                fontFamily: FONT.mono,
                fontWeight: 300,
                fontSize: 16,
                letterSpacing: "0.16em",
                color: COLOR.white,
              }}
            >
              {s.name}
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontWeight: 300,
                fontSize: 14,
                letterSpacing: "0.1em",
                color: COLOR.gold,
                marginTop: 6,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.coord}
            </div>
          </div>
        );
      })}

      <ChapterTitle index="02" zh="火星" en="MARS · 1965 — 2021" />

      {/* milestones */}
      <div style={{ position: "absolute", left: SAFE.x, top: 392 }}>
        {MARS_TIMELINE.map((m, i) => {
          const next = ROW_AT[i + 1] ?? durationInFrames + 60;
          const current = frame >= ROW_AT[i] && frame < next;
          return (
            <div
              key={`${m.year}-${m.mission}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                height: 76,
                opacity:
                  appear(ROW_AT[i]) *
                  interpolate(frame, [next, next + 20], [1, 0.5], CLAMP),
                translate: `${(1 - appear(ROW_AT[i], 30)) * -12}px 0px`,
              }}
            >
              <div
                style={{
                  width: 2,
                  height: 46,
                  marginTop: 4,
                  marginRight: 20,
                  backgroundColor: COLOR.gold,
                  opacity: current ? 0.9 : 0,
                }}
              />
              <div
                style={{
                  width: 104,
                  fontFamily: FONT.mono,
                  fontWeight: 200,
                  fontSize: 34,
                  lineHeight: 1,
                  color: COLOR.gold,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {m.year}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontWeight: 300,
                    fontSize: 15,
                    letterSpacing: "0.2em",
                    color: COLOR.white,
                    opacity: ALPHA.muted + 0.1,
                  }}
                >
                  {m.mission}
                </div>
                <div
                  style={{
                    fontFamily: FONT.serif,
                    fontWeight: 400,
                    fontSize: 23,
                    letterSpacing: "0.1em",
                    color: COLOR.white,
                    marginTop: 6,
                  }}
                >
                  {m.zh}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Earth–Mars signal delay */}
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          top: 830,
          opacity: appear(206, 30),
        }}
      >
        <div
          style={{
            height: 1,
            width: 420,
            backgroundColor: COLOR.white,
            opacity: ALPHA.line,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 24,
            marginTop: 18,
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontWeight: 200,
              fontSize: 48,
              color: COLOR.rust,
              letterSpacing: "0.04em",
            }}
          >
            {MARS.delayMinMin}–{MARS.delayMaxMin} MIN
          </div>
          <div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontWeight: 300,
                fontSize: 14,
                letterSpacing: "0.22em",
                color: COLOR.white,
                opacity: ALPHA.muted,
              }}
            >
              EARTH — MARS · ONE WAY
            </div>
            <div
              style={{
                fontFamily: FONT.serif,
                fontWeight: 400,
                fontSize: 21,
                letterSpacing: "0.14em",
                color: COLOR.white,
                marginTop: 4,
              }}
            >
              地火单程通信时延
            </div>
          </div>
        </div>
      </div>

      {/* honesty note: the surface is procedural, the sites are not */}
      <div
        style={{
          position: "absolute",
          left: CANVAS.left,
          width: CANVAS.width,
          top: 972,
          textAlign: "center",
          fontFamily: FONT.serif,
          fontWeight: 400,
          fontSize: 16,
          letterSpacing: "0.24em",
          color: COLOR.white,
          opacity: 0.42 * appear(40, 30),
        }}
      >
        地表纹理为示意 · 着陆点按公布坐标标注
      </div>
    </AbsoluteFill>
  );
};
