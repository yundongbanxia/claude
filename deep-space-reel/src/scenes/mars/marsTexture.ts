import { random } from "remotion";
import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * Procedural Mars surface, equirectangular (lon −180…180 left→right,
 * lat 90…−90 top→bottom). Fully deterministic: seeded noise only, no
 * external imagery. Stylised — it is not a map, and the reel never claims
 * feature positions beyond the landing-site coordinates in facts.ts.
 */

const W = 2048;
const H = 1024;

// ---------- seeded 3D gradient noise (improved Perlin) ----------
const perm = (() => {
  const p = new Array(256).fill(0).map((_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random(`mars-perm-${i}`) * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return Uint8Array.from([...p, ...p]);
})();

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + t * (b - a);
const grad = (h: number, x: number, y: number, z: number) => {
  const g = h & 15;
  const u = g < 8 ? x : y;
  const v = g < 4 ? y : g === 12 || g === 14 ? x : z;
  return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v);
};

const noise3 = (x: number, y: number, z: number) => {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = perm[X] + Y;
  const AA = perm[A] + Z;
  const AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y;
  const BA = perm[B] + Z;
  const BB = perm[B + 1] + Z;
  return lerp(
    lerp(
      lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
      lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
      v,
    ),
    lerp(
      lerp(
        grad(perm[AA + 1], x, y, z - 1),
        grad(perm[BA + 1], x - 1, y, z - 1),
        u,
      ),
      lerp(
        grad(perm[AB + 1], x, y - 1, z - 1),
        grad(perm[BB + 1], x - 1, y - 1, z - 1),
        u,
      ),
      v,
    ),
    w,
  );
};

const fbm = (x: number, y: number, z: number, octaves: number) => {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum; // ≈ −0.5…0.5
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- palette (sRGB 0–255) — all rust family, desaturated ----------
const DUST = [186, 112, 74]; // bright ochre dust
const BASALT = [92, 48, 34]; // dark albedo regions
const ICE = [226, 222, 214]; // polar caps

type Crater = { x: number; y: number; z: number; rho: number; depth: number };

const makeCraters = (): Crater[] => {
  const out: Crater[] = [];
  for (let i = 0; i < 220; i++) {
    const r = (k: string) => random(`crater-${k}-${i}`);
    // southern highlands are far more cratered than the northern lowlands
    const lat = Math.asin(2 * r("lat") - 1) * (r("s") < 0.78 ? -1 : 1) * 0.9;
    const lon = r("lon") * Math.PI * 2 - Math.PI;
    const rho = (0.004 + 0.05 * r("rho") ** 3.2) as number; // radians
    out.push({
      x: Math.cos(lat) * Math.cos(lon),
      y: Math.sin(lat),
      z: Math.cos(lat) * Math.sin(lon),
      rho,
      depth: 0.5 + r("d") * 0.5,
    });
  }
  return out;
};

let cache: { map: CanvasTexture; bump: CanvasTexture } | null = null;

export const getMarsTextures = () => {
  if (cache) {
    return cache;
  }

  const height = new Float32Array(W * H);
  const albedo = new Float32Array(W * H);

  for (let j = 0; j < H; j++) {
    const lat = Math.PI / 2 - (j / H) * Math.PI;
    const cl = Math.cos(lat);
    const y = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2 - Math.PI;
      const x = cl * Math.cos(lon);
      const z = cl * Math.sin(lon);
      const idx = j * W + i;

      // domain-warped continents for the big albedo patterns
      const wx = fbm(x * 1.3 + 11, y * 1.3, z * 1.3, 3);
      const wy = fbm(x * 1.3, y * 1.3 + 23, z * 1.3, 3);
      albedo[idx] = fbm(x * 1.5 + wx * 1.1, y * 1.9 + wy * 1.1, z * 1.5, 6);
      height[idx] = fbm(x * 3.2 + 5, y * 3.2, z * 3.2, 6);
    }
  }

  // stamp craters (bowl + raised rim) into the height field
  const craters = makeCraters();
  const craterShade = new Float32Array(W * H);
  for (const c of craters) {
    const lat0 = Math.asin(c.y);
    const lon0 = Math.atan2(c.z, c.x);
    const span = c.rho * 1.5;
    const j0 = Math.max(
      0,
      Math.floor(((Math.PI / 2 - (lat0 + span)) / Math.PI) * H),
    );
    const j1 = Math.min(
      H - 1,
      Math.ceil(((Math.PI / 2 - (lat0 - span)) / Math.PI) * H),
    );
    const lonSpan = span / Math.max(0.15, Math.cos(lat0));
    const iw0 = Math.floor(((lon0 - lonSpan + Math.PI) / (Math.PI * 2)) * W);
    const iw1 = Math.ceil(((lon0 + lonSpan + Math.PI) / (Math.PI * 2)) * W);
    for (let j = j0; j <= j1; j++) {
      const lat = Math.PI / 2 - (j / H) * Math.PI;
      const cl = Math.cos(lat);
      const y = Math.sin(lat);
      for (let iw = iw0; iw <= iw1; iw++) {
        const i = ((iw % W) + W) % W;
        const lon = (i / W) * Math.PI * 2 - Math.PI;
        const d = Math.acos(
          Math.min(
            1,
            cl * Math.cos(lon) * c.x + y * c.y + cl * Math.sin(lon) * c.z,
          ),
        );
        const q = d / c.rho;
        if (q > 1.5) {
          continue;
        }
        const idx = j * W + i;
        const bowl = q < 1 ? -(1 - q * q) * 0.12 * c.depth : 0;
        const rim = Math.exp(-(((q - 1) / 0.2) ** 2)) * 0.05 * c.depth;
        height[idx] += bowl + rim;
        craterShade[idx] += bowl * 0.6 + rim * 1.2;
      }
    }
  }

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = W;
  colorCanvas.height = H;
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const cctx = colorCanvas.getContext("2d")!;
  const bctx = bumpCanvas.getContext("2d")!;
  const cimg = cctx.createImageData(W, H);
  const bimg = bctx.createImageData(W, H);

  for (let j = 0; j < H; j++) {
    const latDeg = 90 - (j / H) * 180;
    for (let i = 0; i < W; i++) {
      const idx = j * W + i;
      const h = height[idx];

      const dark = smoothstep(0.0, 0.22, albedo[idx]);
      const tone = 0.86 + h * 0.5 + craterShade[idx] * 1.6;
      let r = lerp(DUST[0], BASALT[0], dark * 0.62) * tone;
      let g = lerp(DUST[1], BASALT[1], dark * 0.62) * tone;
      let b = lerp(DUST[2], BASALT[2], dark * 0.62) * tone;

      // polar caps, ragged edge
      const edge = albedo[idx] * 6;
      const north = smoothstep(79 + edge, 83 + edge, latDeg);
      const south = smoothstep(-82 - edge, -86 - edge, latDeg);
      const ice = Math.max(north, south * 0.9);
      r = lerp(r, ICE[0], ice);
      g = lerp(g, ICE[1], ice);
      b = lerp(b, ICE[2], ice);

      const o = idx * 4;
      cimg.data[o] = Math.max(0, Math.min(255, r));
      cimg.data[o + 1] = Math.max(0, Math.min(255, g));
      cimg.data[o + 2] = Math.max(0, Math.min(255, b));
      cimg.data[o + 3] = 255;

      const hv = Math.max(0, Math.min(255, 128 + h * 170));
      bimg.data[o] = hv;
      bimg.data[o + 1] = hv;
      bimg.data[o + 2] = hv;
      bimg.data[o + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  const map = new CanvasTexture(colorCanvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new CanvasTexture(bumpCanvas);
  bump.anisotropy = 8;

  cache = { map, bump };
  return cache;
};
