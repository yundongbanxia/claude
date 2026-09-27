import * as THREE from 'three';
import { Rng } from '../core/rng';

/** Procedurally painted canvas textures (no external assets). */

type Painter = (ctx: CanvasRenderingContext2D, size: number, r: Rng) => void;

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function noiseFill(ctx: CanvasRenderingContext2D, size: number, r: Rng, base: [number, number, number], amp: number, blob = 1) {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  // cheap layered noise
  const grid = 16;
  const cells: number[] = [];
  for (let i = 0; i < grid * grid; i++) cells.push(r.next());
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * grid, gy = (y / size) * grid;
      const x0 = Math.floor(gx) % grid, y0 = Math.floor(gy) % grid;
      const x1 = (x0 + 1) % grid, y1 = (y0 + 1) % grid;
      const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy);
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = cells[y0 * grid + x0], b = cells[y0 * grid + x1], c = cells[y1 * grid + x0], e = cells[y1 * grid + x1];
      const low = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + e * sx) * sy;
      const n = (low - 0.5) * blob + (r.next() - 0.5);
      const i = (y * size + x) * 4;
      d[i] = base[0] + n * amp;
      d[i + 1] = base[1] + n * amp;
      d[i + 2] = base[2] + n * amp * 0.9;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const painters: Record<string, Painter> = {
  dirt(ctx, s, r) {
    noiseFill(ctx, s, r, [112, 94, 70], 46, 1.6);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(${60 + r.next() * 40},${50 + r.next() * 30},${35 + r.next() * 20},${0.25 + r.next() * 0.35})`;
      const x = r.next() * s, y = r.next() * s, rad = 1 + r.next() * 3;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  grass(ctx, s, r) {
    noiseFill(ctx, s, r, [82, 88, 52], 40, 1.8);
    for (let i = 0; i < 1400; i++) {
      const g = 60 + r.next() * 60;
      ctx.strokeStyle = `rgba(${g * 0.8},${g},${g * 0.45},0.55)`;
      const x = r.next() * s, y = r.next() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r.next() - 0.5) * 3, y - 3 - r.next() * 5);
      ctx.stroke();
    }
  },
  wood(ctx, s, r) {
    noiseFill(ctx, s, r, [104, 78, 52], 26, 0.6);
    const planks = 6;
    const pw = s / planks;
    for (let p = 0; p < planks; p++) {
      const tone = (r.next() - 0.5) * 34;
      ctx.fillStyle = `rgba(${90 + tone},${66 + tone},${44 + tone},0.45)`;
      ctx.fillRect(p * pw, 0, pw, s);
      for (let k = 0; k < 14; k++) {
        ctx.strokeStyle = `rgba(40,28,18,${0.12 + r.next() * 0.2})`;
        ctx.beginPath();
        const x = p * pw + r.next() * pw;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + (r.next() - 0.5) * 6, s * 0.3, x + (r.next() - 0.5) * 6, s * 0.7, x + (r.next() - 0.5) * 4, s);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(25,16,10,0.85)';
      ctx.fillRect(p * pw, 0, 2, s);
      if (r.chance(0.6)) {
        ctx.fillStyle = 'rgba(30,20,12,0.6)';
        ctx.beginPath();
        ctx.ellipse(p * pw + pw / 2, r.next() * s, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  darkwood(ctx, s, r) {
    painters.wood(ctx, s, r);
    ctx.fillStyle = 'rgba(20,14,10,0.45)';
    ctx.fillRect(0, 0, s, s);
  },
  stone(ctx, s, r) {
    noiseFill(ctx, s, r, [118, 112, 100], 30, 1.2);
    const rows = 6;
    const rh = s / rows;
    for (let y = 0; y < rows; y++) {
      let x = (y % 2) * -rh * 0.7;
      while (x < s) {
        const w = rh * (1.1 + r.next() * 0.9);
        const tone = (r.next() - 0.5) * 40;
        ctx.fillStyle = `rgba(${120 + tone},${114 + tone},${100 + tone},0.55)`;
        ctx.fillRect(x + 2, y * rh + 2, w - 4, rh - 4);
        ctx.strokeStyle = 'rgba(40,36,30,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1, y * rh + 1, w - 2, rh - 2);
        x += w;
      }
    }
  },
  plaster(ctx, s, r) {
    noiseFill(ctx, s, r, [158, 146, 124], 18, 2.2);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(90,70,50,${0.05 + r.next() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(r.next() * s, r.next() * s, 10 + r.next() * 40, 6 + r.next() * 20, r.next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // subtle cracks
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(80,66,50,${0.15 + r.next() * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let x = r.next() * s, y = r.next() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r.next() - 0.5) * 30;
        y += r.next() * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  roof(ctx, s, r) {
    noiseFill(ctx, s, r, [112, 58, 40], 30, 1);
    const rows = 10;
    const rh = s / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < 8; x++) {
        const tone = (r.next() - 0.5) * 40;
        ctx.fillStyle = `rgba(${120 + tone},${62 + tone * 0.5},${42 + tone * 0.3},0.7)`;
        const ox = (y % 2) * (s / 16);
        ctx.beginPath();
        ctx.ellipse(ox + x * (s / 8) + s / 16, y * rh + rh * 0.7, s / 17, rh * 0.62, 0, 0, Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(30,14,10,0.5)';
      ctx.fillRect(0, y * rh, s, 2);
    }
  },
  thatch(ctx, s, r) {
    noiseFill(ctx, s, r, [120, 100, 62], 30, 1);
    for (let i = 0; i < 2600; i++) {
      const t = 80 + r.next() * 80;
      ctx.strokeStyle = `rgba(${t},${t * 0.82},${t * 0.5},0.5)`;
      const x = r.next() * s, y = r.next() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r.next() - 0.5) * 4, y + 8 + r.next() * 10);
      ctx.stroke();
    }
  },
  bark(ctx, s, r) {
    noiseFill(ctx, s, r, [70, 56, 44], 26, 1);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(30,22,16,${0.3 + r.next() * 0.4})`;
      ctx.lineWidth = 1 + r.next() * 2;
      const x = r.next() * s;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (r.next() - 0.5) * 12, s);
      ctx.stroke();
    }
  },
  rock(ctx, s, r) {
    noiseFill(ctx, s, r, [104, 100, 92], 50, 2.5);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(40,38,34,${0.2 + r.next() * 0.3})`;
      ctx.beginPath();
      let x = r.next() * s, y = r.next() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r.next() - 0.5) * 40;
        y += (r.next() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  metal(ctx, s, r) {
    noiseFill(ctx, s, r, [70, 70, 72], 20, 1);
  },
  hay(ctx, s, r) {
    noiseFill(ctx, s, r, [168, 140, 76], 30, 1);
    for (let i = 0; i < 1800; i++) {
      const t = 130 + r.next() * 90;
      ctx.strokeStyle = `rgba(${t},${t * 0.85},${t * 0.45},0.6)`;
      const x = r.next() * s, y = r.next() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r.next() - 0.5) * 14, y + (r.next() - 0.5) * 6);
      ctx.stroke();
    }
  },
  blood(ctx, s, r) {
    ctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2;
    ctx.fillStyle = 'rgba(70,4,4,0.95)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.3, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      const a = r.next() * Math.PI * 2, d = s * (0.2 + r.next() * 0.25);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + r.next() * s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  bullethole(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.25, 'rgba(10,8,6,0.9)');
    g.addColorStop(0.5, 'rgba(40,30,20,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  },
  soft(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  },
  smoke(ctx, s, r) {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 18; i++) {
      const x = s / 2 + (r.next() - 0.5) * s * 0.4, y = s / 2 + (r.next() - 0.5) * s * 0.4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.3);
      g.addColorStop(0, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  },
  cloth(ctx, s, r) {
    noiseFill(ctx, s, r, [200, 200, 200], 30, 0.8);
    for (let y = 0; y < s; y += 3) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + r.next() * 0.04})`;
      ctx.fillRect(0, y, s, 1);
    }
  },
};

const cache = new Map<string, THREE.CanvasTexture>();

export function getTexture(name: keyof typeof painters | string, repeat = true, size = 256): THREE.CanvasTexture {
  const key = `${name}:${size}:${repeat}`;
  let t = cache.get(key);
  if (t) return t;
  const [c, ctx] = makeCanvas(size);
  const painter = painters[name];
  if (!painter) throw new Error('unknown texture ' + name);
  painter(ctx, size, new Rng(name.length * 977 + size));
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

const matCache = new Map<string, THREE.Material>();

/** Shared world materials. UVs on world geometry are in meters; `scale` = meters per texture repeat. */
export function worldMat(name: string, color = 0xffffff): THREE.MeshLambertMaterial {
  const key = name + ':' + color;
  let m = matCache.get(key) as THREE.MeshLambertMaterial | undefined;
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ map: getTexture(name), color });
  matCache.set(key, m);
  return m;
}

export function flatMat(color: number, opts: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const key = 'flat:' + color + JSON.stringify(opts);
  let m = matCache.get(key) as THREE.MeshLambertMaterial | undefined;
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
  matCache.set(key, m);
  return m;
}

export function basicMat(color: number, opts: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  const key = 'basic:' + color + JSON.stringify(opts);
  let m = matCache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color, ...opts });
  matCache.set(key, m);
  return m;
}
