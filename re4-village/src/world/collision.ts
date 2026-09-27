import * as THREE from 'three';
import type { Terrain } from './terrain';

export type ColliderTag = 'wall' | 'door' | 'window' | 'prop' | 'tree' | 'barricade' | 'breakable' | 'invisible' | 'ladder' | 'rock';

export interface Collider {
  id: number;
  kind: 'box' | 'circle';
  x: number;
  z: number;
  hx: number;
  hz: number;
  r: number;
  rot: number;
  cos: number;
  sin: number;
  y0: number;
  y1: number;
  move: boolean;
  bullet: boolean;
  cam: boolean;
  /** Blocks AI line of sight. */
  sight: boolean;
  enabled: boolean;
  tag: ColliderTag;
  ref?: unknown;
}

export interface Floor {
  x: number;
  z: number;
  hx: number;
  hz: number;
  rot: number;
  cos: number;
  sin: number;
  y: number;
  /** Ramp: height goes from y0 at local -axis edge to y1 at +axis edge. */
  ramp?: { axis: 'x' | 'z'; y0: number; y1: number };
  /** thickness for raycasts (0 = not solid) */
  slab: number;
  id: number;
  /** part of the ground nav layer (bridges, house ground floors) */
  ground?: boolean;
}

export type RayMask = 'bullet' | 'cam' | 'sight' | 'move';

export interface RayHit {
  t: number;
  normal: THREE.Vector3;
  collider: Collider | null;
  floor: Floor | null;
  terrain: boolean;
}

const CELL = 4;

export class CollisionWorld {
  colliders: Collider[] = [];
  floors: Floor[] = [];
  terrain: Terrain | null = null;
  private minX: number;
  private minZ: number;
  private gw: number;
  private gh: number;
  private cells: number[][];
  private stamp: Uint32Array = new Uint32Array(0);
  private stampId = 1;
  private nextId = 1;

  constructor(minX: number, minZ: number, maxX: number, maxZ: number) {
    this.minX = minX;
    this.minZ = minZ;
    this.gw = Math.ceil((maxX - minX) / CELL) + 1;
    this.gh = Math.ceil((maxZ - minZ) / CELL) + 1;
    this.cells = Array.from({ length: this.gw * this.gh }, () => []);
  }

  addBox(
    x: number,
    z: number,
    hx: number,
    hz: number,
    rot: number,
    y0: number,
    y1: number,
    opts: Partial<Pick<Collider, 'move' | 'bullet' | 'cam' | 'sight' | 'tag' | 'ref' | 'enabled'>> = {},
  ): Collider {
    const c: Collider = {
      id: this.nextId++,
      kind: 'box',
      x, z, hx, hz, r: 0, rot,
      cos: Math.cos(rot),
      sin: Math.sin(rot),
      y0, y1,
      move: opts.move ?? true,
      bullet: opts.bullet ?? true,
      cam: opts.cam ?? true,
      sight: opts.sight ?? opts.bullet ?? true,
      enabled: opts.enabled ?? true,
      tag: opts.tag ?? 'wall',
      ref: opts.ref,
    };
    this.insert(c);
    return c;
  }

  addCircle(
    x: number,
    z: number,
    r: number,
    y0: number,
    y1: number,
    opts: Partial<Pick<Collider, 'move' | 'bullet' | 'cam' | 'sight' | 'tag' | 'ref' | 'enabled'>> = {},
  ): Collider {
    const c: Collider = {
      id: this.nextId++,
      kind: 'circle',
      x, z, hx: r, hz: r, r, rot: 0, cos: 1, sin: 0,
      y0, y1,
      move: opts.move ?? true,
      bullet: opts.bullet ?? true,
      cam: opts.cam ?? false,
      sight: opts.sight ?? false,
      enabled: opts.enabled ?? true,
      tag: opts.tag ?? 'prop',
      ref: opts.ref,
    };
    this.insert(c);
    return c;
  }

  addFloor(x: number, z: number, hx: number, hz: number, rot: number, y: number, ramp?: Floor['ramp'], slab = 0.2, ground = false): Floor {
    const f: Floor = { x, z, hx, hz, rot, cos: Math.cos(rot), sin: Math.sin(rot), y, ramp, slab, id: this.floors.length, ground };
    this.floors.push(f);
    return f;
  }

  /** Move a collider (e.g., pushed bookshelf). */
  moveCollider(c: Collider, x: number, z: number, rot = c.rot) {
    this.remove(c);
    c.x = x;
    c.z = z;
    c.rot = rot;
    c.cos = Math.cos(rot);
    c.sin = Math.sin(rot);
    this.insert(c);
  }

  remove(c: Collider) {
    this.forCells(c, (cell) => {
      const i = cell.indexOf(c.id);
      if (i >= 0) cell.splice(i, 1);
    });
    this.colliders[c.id] = undefined as unknown as Collider;
  }

  private insert(c: Collider) {
    this.colliders[c.id] = c;
    this.forCells(c, (cell) => cell.push(c.id));
    if (this.stamp.length <= c.id) {
      const s = new Uint32Array(Math.max(256, c.id * 2));
      s.set(this.stamp);
      this.stamp = s;
    }
  }

  private aabb(c: Collider): [number, number, number, number] {
    if (c.kind === 'circle') return [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
    const ex = Math.abs(c.hx * c.cos) + Math.abs(c.hz * c.sin);
    const ez = Math.abs(c.hx * c.sin) + Math.abs(c.hz * c.cos);
    return [c.x - ex, c.z - ez, c.x + ex, c.z + ez];
  }

  private forCells(c: Collider, fn: (cell: number[]) => void) {
    const [a, b, cc, d] = this.aabb(c);
    const i0 = Math.max(0, Math.floor((a - this.minX) / CELL)), i1 = Math.min(this.gw - 1, Math.floor((cc - this.minX) / CELL));
    const j0 = Math.max(0, Math.floor((b - this.minZ) / CELL)), j1 = Math.min(this.gh - 1, Math.floor((d - this.minZ) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(this.cells[j * this.gw + i]);
  }

  /** Visit enabled colliders overlapping an AABB (deduped). */
  query(minX: number, minZ: number, maxX: number, maxZ: number, fn: (c: Collider) => void) {
    const sid = ++this.stampId;
    const i0 = Math.max(0, Math.floor((minX - this.minX) / CELL)), i1 = Math.min(this.gw - 1, Math.floor((maxX - this.minX) / CELL));
    const j0 = Math.max(0, Math.floor((minZ - this.minZ) / CELL)), j1 = Math.min(this.gh - 1, Math.floor((maxZ - this.minZ) / CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (const id of this.cells[j * this.gw + i]) {
          if (this.stamp[id] === sid) continue;
          this.stamp[id] = sid;
          const c = this.colliders[id];
          if (c && c.enabled) fn(c);
        }
      }
    }
  }

  /**
   * Push a circle out of blocking colliders. Returns true if any contact.
   * yFeet/height: vertical extent of the character.
   */
  resolveCircle(p: { x: number; z: number }, r: number, yFeet: number, height: number, ignore?: (c: Collider) => boolean): boolean {
    let hitAny = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      this.query(p.x - r, p.z - r, p.x + r, p.z + r, (c) => {
        if (!c.move) return;
        if (c.y1 <= yFeet + 0.3 || c.y0 >= yFeet + height) return;
        if (ignore && ignore(c)) return;
        if (c.kind === 'circle') {
          const dx = p.x - c.x, dz = p.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = r + c.r;
          if (d < min) {
            if (d > 1e-5) {
              p.x += (dx / d) * (min - d);
              p.z += (dz / d) * (min - d);
            } else p.x += min;
            moved = true;
          }
        } else {
          const dx = p.x - c.x, dz = p.z - c.z;
          const lx = dx * c.cos - dz * c.sin;
          const lz = dx * c.sin + dz * c.cos;
          const cx = Math.max(-c.hx, Math.min(c.hx, lx));
          const cz = Math.max(-c.hz, Math.min(c.hz, lz));
          const ox = lx - cx, oz = lz - cz;
          const d = Math.hypot(ox, oz);
          let px = 0, pz = 0;
          if (d > 1e-6) {
            if (d >= r) return;
            px = (ox / d) * (r - d);
            pz = (oz / d) * (r - d);
          } else {
            const penX = c.hx - Math.abs(lx), penZ = c.hz - Math.abs(lz);
            if (penX < penZ) px = Math.sign(lx || 1) * (penX + r);
            else pz = Math.sign(lz || 1) * (penZ + r);
          }
          // local -> world
          p.x += px * c.cos + pz * c.sin;
          p.z += -px * c.sin + pz * c.cos;
          moved = true;
        }
      });
      if (!moved) break;
      hitAny = true;
    }
    return hitAny;
  }

  /** Is a point inside any blocking collider (with radius)? */
  blocked(x: number, z: number, r: number, yFeet: number, height: number): boolean {
    let hit = false;
    this.query(x - r, z - r, x + r, z + r, (c) => {
      if (hit || !c.move) return;
      if (c.y1 <= yFeet + 0.3 || c.y0 >= yFeet + height) return;
      if (c.kind === 'circle') {
        if (Math.hypot(x - c.x, z - c.z) < r + c.r) hit = true;
      } else {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        const cx = Math.max(-c.hx, Math.min(c.hx, lx));
        const cz = Math.max(-c.hz, Math.min(c.hz, lz));
        if (Math.hypot(lx - cx, lz - cz) < r) hit = true;
      }
    });
    return hit;
  }

  floorHeightAt(f: Floor, x: number, z: number): number | null {
    const dx = x - f.x, dz = z - f.z;
    const lx = dx * f.cos - dz * f.sin;
    const lz = dx * f.sin + dz * f.cos;
    if (Math.abs(lx) > f.hx || Math.abs(lz) > f.hz) return null;
    if (!f.ramp) return f.y;
    const t = f.ramp.axis === 'x' ? (lx + f.hx) / (2 * f.hx) : (lz + f.hz) / (2 * f.hz);
    return f.ramp.y0 + (f.ramp.y1 - f.ramp.y0) * t;
  }

  /** Walkable ground height under (x,z) reachable from yFeet (can step up `step`). */
  groundHeight(x: number, z: number, yFeet: number, step = 0.55): number {
    let h = this.terrain ? this.terrain.heightAt(x, z) : 0;
    for (const f of this.floors) {
      const fh = this.floorHeightAt(f, x, z);
      if (fh !== null && fh <= yFeet + step && fh > h) h = fh;
    }
    return h;
  }

  /** Ground-layer height: terrain or ground floors (bridges). */
  baseGround(x: number, z: number): number {
    let h = this.terrain ? this.terrain.heightAt(x, z) : 0;
    for (const f of this.floors) {
      if (!f.ground) continue;
      const fh = this.floorHeightAt(f, x, z);
      if (fh !== null && fh > h) h = fh;
    }
    return h;
  }

  /** Which (non-ground) floor supports the point, or -1 for the ground layer. */
  floorIdAt(x: number, z: number, yFeet: number): number {
    let h = this.baseGround(x, z);
    let id = -1;
    for (const f of this.floors) {
      if (f.ground) continue;
      const fh = this.floorHeightAt(f, x, z);
      if (fh !== null && fh <= yFeet + 0.55 && fh > h + 0.3) {
        h = fh;
        id = f.id;
      }
    }
    return id;
  }

  /**
   * Raycast against colliders (filtered by mask), floor slabs, and terrain.
   */
  raycast(o: THREE.Vector3, dir: THREE.Vector3, maxDist: number, mask: RayMask, ignore?: (c: Collider) => boolean): RayHit | null {
    let best: RayHit | null = null;
    let bestT = maxDist;
    const sid = ++this.stampId;
    // 2D DDA across grid cells
    const ex = o.x + dir.x * maxDist, ez = o.z + dir.z * maxDist;
    let i = Math.floor((o.x - this.minX) / CELL), j = Math.floor((o.z - this.minZ) / CELL);
    const iEnd = Math.floor((ex - this.minX) / CELL), jEnd = Math.floor((ez - this.minZ) / CELL);
    const di = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
    const dj = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;
    const hlen = Math.hypot(dir.x, dir.z);
    const tDeltaX = di !== 0 ? CELL / Math.abs(dir.x) : Infinity;
    const tDeltaZ = dj !== 0 ? CELL / Math.abs(dir.z) : Infinity;
    const nextBX = this.minX + (i + (di > 0 ? 1 : 0)) * CELL;
    const nextBZ = this.minZ + (j + (dj > 0 ? 1 : 0)) * CELL;
    let tMaxX = di !== 0 ? (nextBX - o.x) / dir.x : Infinity;
    let tMaxZ = dj !== 0 ? (nextBZ - o.z) / dir.z : Infinity;
    const tmpN = new THREE.Vector3();
    let guard = 0;
    while (guard++ < 400) {
      if (i >= 0 && j >= 0 && i < this.gw && j < this.gh) {
        for (const id of this.cells[j * this.gw + i]) {
          if (this.stamp[id] === sid) continue;
          this.stamp[id] = sid;
          const c = this.colliders[id];
          if (!c || !c.enabled) continue;
          if (mask === 'bullet' && !c.bullet) continue;
          if (mask === 'cam' && !c.cam) continue;
          if (mask === 'sight' && !c.sight) continue;
          if (mask === 'move' && !c.move) continue;
          if (ignore && ignore(c)) continue;
          const t = this.rayCollider(c, o, dir, bestT, tmpN);
          if (t >= 0 && t < bestT) {
            bestT = t;
            best = { t, normal: tmpN.clone(), collider: c, floor: null, terrain: false };
          }
        }
      }
      if (hlen < 1e-6) break;
      if ((i === iEnd && j === jEnd) || Math.min(tMaxX, tMaxZ) > bestT) break;
      if (tMaxX < tMaxZ) {
        i += di;
        tMaxX += tDeltaX;
      } else {
        j += dj;
        tMaxZ += tDeltaZ;
      }
    }
    // floor slabs
    if (mask !== 'move') {
      for (const f of this.floors) {
        if (f.slab <= 0 || f.ramp) continue;
        const t = this.rayFloor(f, o, dir, bestT, tmpN);
        if (t >= 0 && t < bestT) {
          bestT = t;
          best = { t, normal: tmpN.clone(), collider: null, floor: f, terrain: false };
        }
      }
    }
    if (this.terrain) {
      const t = this.terrain.raycast(o, dir, bestT);
      if (t >= 0 && t < bestT) {
        const p = new THREE.Vector3().copy(dir).multiplyScalar(t).add(o);
        best = { t, normal: this.terrain.normalAt(p.x, p.z, new THREE.Vector3()), collider: null, floor: null, terrain: true };
      }
    }
    return best;
  }

  private rayCollider(c: Collider, o: THREE.Vector3, d: THREE.Vector3, maxT: number, nOut: THREE.Vector3): number {
    if (c.kind === 'circle') {
      const ox = o.x - c.x, oz = o.z - c.z;
      const a = d.x * d.x + d.z * d.z;
      if (a < 1e-9) return -1;
      const b = 2 * (ox * d.x + oz * d.z);
      const cc = ox * ox + oz * oz - c.r * c.r;
      const disc = b * b - 4 * a * cc;
      if (disc < 0) return -1;
      const sq = Math.sqrt(disc);
      let t = (-b - sq) / (2 * a);
      if (t < 0) {
        if (cc < 0) t = 0; // inside
        else return -1;
      }
      if (t > maxT) return -1;
      const y = o.y + d.y * t;
      if (y < c.y0 || y > c.y1) return -1;
      nOut.set(ox + d.x * t, 0, oz + d.z * t).normalize();
      return t;
    }
    // OBB slab test in local space
    const dx = o.x - c.x, dz = o.z - c.z;
    const lox = dx * c.cos - dz * c.sin, loz = dx * c.sin + dz * c.cos;
    const ldx = d.x * c.cos - d.z * c.sin, ldz = d.x * c.sin + d.z * c.cos;
    const ymid = (c.y0 + c.y1) / 2, hy = (c.y1 - c.y0) / 2;
    const loy = o.y - ymid;
    let tmin = 0, tmax = maxT;
    let axis = -1, sgn = 0;
    const orig = [lox, loy, loz], dirs = [ldx, d.y, ldz], halves = [c.hx, hy, c.hz];
    for (let k = 0; k < 3; k++) {
      const oo = orig[k], dd = dirs[k], h = halves[k];
      if (Math.abs(dd) < 1e-9) {
        if (oo < -h || oo > h) return -1;
        continue;
      }
      let t1 = (-h - oo) / dd, t2 = (h - oo) / dd;
      let s = -1;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axis = k;
        sgn = s;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
    if (axis === 1) nOut.set(0, sgn, 0);
    else if (axis === 0) nOut.set(sgn * c.cos, 0, -sgn * c.sin);
    else if (axis === 2) nOut.set(sgn * c.sin, 0, sgn * c.cos);
    else nOut.set(-d.x, -d.y, -d.z);
    return tmin;
  }

  private rayFloor(f: Floor, o: THREE.Vector3, d: THREE.Vector3, maxT: number, nOut: THREE.Vector3): number {
    const dx = o.x - f.x, dz = o.z - f.z;
    const lox = dx * f.cos - dz * f.sin, loz = dx * f.sin + dz * f.cos;
    const ldx = d.x * f.cos - d.z * f.sin, ldz = d.x * f.sin + d.z * f.cos;
    const ymid = f.y - f.slab / 2, hy = f.slab / 2;
    const orig = [lox, o.y - ymid, loz], dirs = [ldx, d.y, ldz], halves = [f.hx, hy, f.hz];
    let tmin = 0, tmax = maxT, axis = -1, sgn = 0;
    for (let k = 0; k < 3; k++) {
      const oo = orig[k], dd = dirs[k], h = halves[k];
      if (Math.abs(dd) < 1e-9) {
        if (oo < -h || oo > h) return -1;
        continue;
      }
      let t1 = (-h - oo) / dd, t2 = (h - oo) / dd;
      let s = -1;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axis = k;
        sgn = s;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
    if (axis === 1) nOut.set(0, sgn, 0);
    else nOut.set(-d.x, 0, -d.z).normalize();
    return tmin;
  }

  /** Line of sight between two points. */
  clear(a: THREE.Vector3, b: THREE.Vector3, mask: RayMask = 'sight'): boolean {
    const dir = _v.copy(b).sub(a);
    const len = dir.length();
    if (len < 1e-4) return true;
    dir.divideScalar(len);
    const hit = this.raycast(a, dir, len, mask);
    return !hit;
  }
}

const _v = new THREE.Vector3();
