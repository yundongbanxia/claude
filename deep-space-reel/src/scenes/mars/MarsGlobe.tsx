import React, { useMemo } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Vector3,
} from "three";
import { COLOR } from "../../theme";
import { getMarsTextures } from "./marsTexture";

/**
 * Unit-sphere position for planetocentric lat / east-lon, matching
 * three.js SphereGeometry UVs with an equirectangular map whose left edge is
 * lon −180°. With no rotation, lon −90° faces the camera (+Z) and east is
 * to the right.
 */
export const latLonToVec = (latDeg: number, lonDeg: number, r = 1) => {
  const theta = ((90 - latDeg) * Math.PI) / 180;
  const phi = ((lonDeg + 180) * Math.PI) / 180;
  return new Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
  );
};

// Y rotation (radians) that brings east-longitude lonDeg to face the camera.
export const spinForCenterLon = (lonDeg: number) =>
  ((-90 - lonDeg) * Math.PI) / 180;

const makeGraticule = () => {
  const pts: number[] = [];
  const R = 1.0025;
  const push = (a: Vector3, b: Vector3) =>
    pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  // meridians every 30°
  for (let lon = -180; lon < 180; lon += 30) {
    for (let lat = -88; lat < 88; lat += 2) {
      push(latLonToVec(lat, lon, R), latLonToVec(lat + 2, lon, R));
    }
  }
  // parallels every 30°
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = -180; lon < 180; lon += 2) {
      push(latLonToVec(lat, lon, R), latLonToVec(lat, lon + 2, R));
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pts, 3));
  return g;
};

const rimVertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vNormalW;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewV = normalize(-mv.xyz);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const rimFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform float uStrength;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vNormalW;
  void main() {
    float fresnel = pow(1.0 - max(dot(vNormalV, vViewV), 0.0), 5.0);
    float lit = smoothstep(-0.15, 0.6, dot(vNormalW, normalize(uLightDir)));
    gl_FragColor = vec4(uColor, fresnel * lit * uStrength);
  }
`;

export const LIGHT_POS: [number, number, number] = [-3.4, 1.4, 1.9];

export const MarsGlobe: React.FC<{
  z: number;
  tilt: number;
  spin: number;
  graticule: number;
}> = ({ z, tilt, spin, graticule }) => {
  const { map, bump } = useMemo(() => getMarsTextures(), []);
  const grid = useMemo(() => makeGraticule(), []);
  const rimUniforms = useMemo(
    () => ({
      uColor: {
        value: new Color(COLOR.rust).lerp(new Color(COLOR.white), 0.35),
      },
      uLightDir: { value: new Vector3(...LIGHT_POS) },
      uStrength: { value: 0.55 },
    }),
    [],
  );

  return (
    <>
      <ambientLight intensity={0.035} />
      <directionalLight position={LIGHT_POS} intensity={3} />
      <group position={[0, 0, z]} rotation={[tilt, 0, 0]}>
        <group rotation={[0, spin, 0]}>
          <mesh>
            <sphereGeometry args={[1, 160, 80]} />
            <meshStandardMaterial
              map={map}
              bumpMap={bump}
              bumpScale={2.2}
              roughness={0.97}
              metalness={0}
            />
          </mesh>
          <lineSegments geometry={grid}>
            <lineBasicMaterial
              color={COLOR.white}
              transparent
              opacity={graticule}
              depthWrite={false}
            />
          </lineSegments>
        </group>
        <mesh scale={1.018}>
          <sphereGeometry args={[1, 96, 48]} />
          <shaderMaterial
            vertexShader={rimVertex}
            fragmentShader={rimFragment}
            uniforms={rimUniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </>
  );
};
