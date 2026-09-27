import * as THREE from 'three';
import { clamp, distToSegment, fbm, lerp, smoothstep } from '../core/math';
import { getTexture } from '../render/textures';

export interface FlatZone {
  x: number;
  z: number;
  /** radius (circle) or half extents (rect) */
  r?: number;
  hx?: number;
  hz?: number;
  h: number;
  falloff: number;
}
export interface PathDef {
  pts: [number, number][];
  width: number;
  flatten?: number; // 0..1 how much it flattens toward smoothed height
}

export interface TerrainDef {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cell: number;
  amp: number; // noise amplitude (m)
  freq: number;
  seed: number;
  flats: FlatZone[];
  paths: PathDef[];
  /** raised edges (hills around the playable area) */
  rim?: { height: number; inset: number };
  baseHeight?: number;
  extraHeight?: (x: number, z: number) => number;
  grassColor?: number;
  dirtColor?: number;
}

/** Heightfield terrain with baked height grid for fast bilinear sampling. */
export class Terrain {
  def: TerrainDef;
  nx: number;
  nz: number;
  heights: Float32Array;
  pathMask: Float32Array;
  mesh: THREE.Mesh;

  constructor(def: TerrainDef) {
    this.def = def;
    this.nx = Math.ceil((def.maxX - def.minX) / def.cell) + 1;
    this.nz = Math.ceil((def.maxZ - def.minZ) / def.cell) + 1;
    this.heights = new Float32Array(this.nx * this.nz);
    this.pathMask = new Float32Array(this.nx * this.nz);
    for (let j = 0; j < this.nz; j++) {
      for (let i = 0; i < this.nx; i++) {
        const x = def.minX + i * def.cell, z = def.minZ + j * def.cell;
        const [h, pm] = this.computeHeight(x, z);
        this.heights[j * this.nx + i] = h;
        this.pathMask[j * this.nx + i] = pm;
      }
    }
    this.mesh = this.buildMesh();
  }

  private computeHeight(x: number, z: number): [number, number] {
    const d = this.def;
    let h = (d.baseHeight ?? 0) + (fbm(x * d.freq, z * d.freq, 4, d.seed) - 0.5) * 2 * d.amp;
    if (d.rim) {
      const ex = Math.min(x - d.minX, d.maxX - x), ez = Math.min(z - d.minZ, d.maxZ - z);
      const e = Math.min(ex, ez);
      const t = 1 - smoothstep(0, d.rim.inset, e);
      h += t * t * d.rim.height * (0.7 + 0.6 * fbm(x * 0.08, z * 0.08, 2, d.seed + 5));
    }
    if (d.extraHeight) h += d.extraHeight(x, z);
    // paths: flatten toward local smoothed height & compute mask
    let pathM = 0;
    for (const p of d.paths) {
      for (let k = 0; k < p.pts.length - 1; k++) {
        const [ax, az] = p.pts[k], [bx, bz] = p.pts[k + 1];
        const dd = distToSegment(x, z, ax, az, bx, bz);
        const m = 1 - smoothstep(p.width * 0.35, p.width * 0.6, dd);
        if (m > pathM) pathM = m;
      }
    }
    if (pathM > 0) {
      const smooth = (d.baseHeight ?? 0) + (fbm(x * d.freq * 0.3, z * d.freq * 0.3, 2, d.seed) - 0.5) * d.amp;
      h = lerp(h, smooth, pathM * 0.7);
    }
    for (const f of d.flats) {
      let dist: number;
      if (f.r !== undefined) dist = Math.hypot(x - f.x, z - f.z) - f.r;
      else dist = Math.max(Math.abs(x - f.x) - (f.hx ?? 0), Math.abs(z - f.z) - (f.hz ?? 0));
      const w = 1 - smoothstep(0, f.falloff, dist);
      if (w > 0) h = lerp(h, f.h, w);
    }
    return [h, pathM];
  }

  heightAt(x: number, z: number): number {
    const d = this.def;
    const fx = clamp((x - d.minX) / d.cell, 0, this.nx - 1.001);
    const fz = clamp((z - d.minZ) / d.cell, 0, this.nz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const n = this.nx;
    const h00 = this.heights[j * n + i], h10 = this.heights[j * n + i + 1];
    const h01 = this.heights[(j + 1) * n + i], h11 = this.heights[(j + 1) * n + i + 1];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }

  pathAt(x: number, z: number): number {
    const d = this.def;
    const i = clamp(Math.round((x - d.minX) / d.cell), 0, this.nx - 1);
    const j = clamp(Math.round((z - d.minZ) / d.cell), 0, this.nz - 1);
    return this.pathMask[j * this.nx + i];
  }

  normalAt(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const e = 0.5;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  private buildMesh(): THREE.Mesh {
    const d = this.def;
    const geo = new THREE.BufferGeometry();
    const n = this.nx * this.nz;
    const pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const col = new Float32Array(n * 3);
    const grass = new THREE.Color(d.grassColor ?? 0x8a8a60);
    const dirt = new THREE.Color(d.dirtColor ?? 0xa08868);
    const c = new THREE.Color();
    for (let j = 0; j < this.nz; j++) {
      for (let i = 0; i < this.nx; i++) {
        const k = j * this.nx + i;
        const x = d.minX + i * d.cell, z = d.minZ + j * d.cell;
        pos[k * 3] = x;
        pos[k * 3 + 1] = this.heights[k];
        pos[k * 3 + 2] = z;
        uv[k * 2] = x / 4;
        uv[k * 2 + 1] = z / 4;
        const noise = fbm(x * 0.15, z * 0.15, 2, d.seed + 3);
        const pm = clamp(this.pathMask[k] + (noise - 0.5) * 0.4, 0, 1);
        c.copy(grass).lerp(dirt, pm);
        const shade = 0.82 + noise * 0.3;
        col[k * 3] = c.r * shade;
        col[k * 3 + 1] = c.g * shade;
        col[k * 3 + 2] = c.b * shade;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < this.nz - 1; j++) {
      for (let i = 0; i < this.nx - 1; i++) {
        const a = j * this.nx + i, b = a + 1, cc = a + this.nx, dd = cc + 1;
        idx.push(a, cc, b, b, cc, dd);
      }
    }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ map: getTexture('dirt'), vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  /** Ray march against the heightfield. Returns distance or -1. */
  raycast(o: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number {
    const step = 0.4;
    let prevT = 0;
    let prevAbove = o.y - this.heightAt(o.x, o.z);
    if (prevAbove < 0) return 0;
    for (let t = step; t <= maxDist + step; t += step) {
      const tt = Math.min(t, maxDist);
      const x = o.x + dir.x * tt, y = o.y + dir.y * tt, z = o.z + dir.z * tt;
      const above = y - this.heightAt(x, z);
      if (above < 0) {
        // refine
        let lo = prevT, hi = tt;
        for (let k = 0; k < 6; k++) {
          const m = (lo + hi) / 2;
          const a = o.y + dir.y * m - this.heightAt(o.x + dir.x * m, o.z + dir.z * m);
          if (a < 0) hi = m;
          else lo = m;
        }
        return hi;
      }
      prevAbove = above;
      prevT = tt;
      if (tt >= maxDist) break;
    }
    return -1;
  }
}
