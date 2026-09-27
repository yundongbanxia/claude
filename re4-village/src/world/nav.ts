import type { CollisionWorld, Collider } from './collision';

/**
 * Multi-layer navigation grid.
 *  - layer 0: ground (terrain), other layers: upper floors of buildings
 *  - links connect nodes across walls/layers (ladders, windows)
 *  - Dijkstra "flow fields" from a target give every node its next hop, so any
 *    number of enemies can chase the player for the cost of one search.
 */
export type LinkType = 'ladder' | 'window' | 'walk' | 'drop';

export interface NavLink {
  id: number;
  type: LinkType;
  ax: number;
  az: number;
  aLayer: number;
  bx: number;
  bz: number;
  bLayer: number;
  cost: number;
  bidir: boolean;
  enabled: boolean;
  /** heights for traversal animation */
  ay: number;
  by: number;
  ref?: unknown;
  /** mid points used while traversing (e.g., window sill) */
  facing?: number;
}

export interface NavLayer {
  id: number;
  floorId: number;
  minX: number;
  minZ: number;
  w: number;
  h: number;
  y: number;
  offset: number;
  walk: Uint8Array;
  extra: Uint8Array; // extra cost (doors)
}

export interface FlowField {
  dist: Float32Array;
  next: Int32Array;
  link: Int32Array;
  target: { x: number; z: number; layer: number };
  time: number;
}

export const NAV_CELL = 0.5;
const SQRT2 = Math.SQRT2;

class Heap {
  items: number[] = [];
  keys: Float32Array;
  constructor(n: number) {
    this.keys = new Float32Array(n);
  }
  get size() {
    return this.items.length;
  }
  push(node: number, key: number) {
    this.keys[node] = key;
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[a[p]] <= key) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = node;
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      let i = 0;
      const k = this.keys[last];
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && this.keys[a[r]] < this.keys[a[l]] ? r : l;
        if (this.keys[a[c]] >= k) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return top;
  }
}

export class NavGrid {
  layers: NavLayer[] = [];
  links: NavLink[] = [];
  /** links by node index (from either end when bidir) */
  private nodeLinks = new Map<number, NavLink[]>();
  total = 0;
  doorCells = new Map<number, unknown>();
  private cw: CollisionWorld;
  private floorToLayer = new Map<number, number>();

  constructor(cw: CollisionWorld) {
    this.cw = cw;
  }

  /** Build the ground layer over the given bounds. `isDoor` colliders are treated as walkable. */
  buildGround(minX: number, minZ: number, maxX: number, maxZ: number) {
    const w = Math.ceil((maxX - minX) / NAV_CELL), h = Math.ceil((maxZ - minZ) / NAV_CELL);
    const layer = this.newLayer(-1, minX, minZ, w, h, 0);
    const terr = this.cw.terrain;
    const heights = new Float32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const x = minX + (i + 0.5) * NAV_CELL, z = minZ + (j + 0.5) * NAV_CELL;
        heights[j * w + i] = terr ? terr.heightAt(x, z) : 0;
      }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = minX + (i + 0.5) * NAV_CELL, z = minZ + (j + 0.5) * NAV_CELL;
        const y = heights[j * w + i];
        // slope check
        let steep = false;
        if (i > 0 && Math.abs(heights[j * w + i - 1] - y) > 0.32) steep = true;
        if (j > 0 && Math.abs(heights[(j - 1) * w + i] - y) > 0.32) steep = true;
        if (i < w - 1 && Math.abs(heights[j * w + i + 1] - y) > 0.32) steep = true;
        if (j < h - 1 && Math.abs(heights[(j + 1) * w + i] - y) > 0.32) steep = true;
        if (steep) continue;
        let door: unknown = null;
        const blocked = this.blockedAt(x, z, y, (c) => {
          if (c.tag === 'door') {
            door = c.ref ?? c;
            return true;
          }
          return false;
        });
        if (!blocked) {
          layer.walk[j * w + i] = 1;
          if (door) {
            layer.extra[j * w + i] = 4;
            this.doorCells.set(layer.offset + j * w + i, door);
          }
        }
      }
    }
  }

  private blockedAt(x: number, z: number, y: number, ignore: (c: Collider) => boolean): boolean {
    const r = 0.3;
    let hit = false;
    this.cw.query(x - r, z - r, x + r, z + r, (c) => {
      if (hit || !c.move) return;
      if (c.tag === 'barricade') return; // barricades are dynamic; handled by AI
      if (c.y1 <= y + 0.35 || c.y0 >= y + 1.7) return;
      if (ignore(c)) return;
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

  /** Build a layer for an upper floor (by floor index in the collision world). */
  buildFloorLayer(floorId: number) {
    const f = this.cw.floors[floorId];
    const ex = Math.abs(f.hx * f.cos) + Math.abs(f.hz * f.sin);
    const ez = Math.abs(f.hx * f.sin) + Math.abs(f.hz * f.cos);
    const minX = f.x - ex, minZ = f.z - ez;
    const w = Math.ceil((2 * ex) / NAV_CELL), h = Math.ceil((2 * ez) / NAV_CELL);
    const layer = this.newLayer(floorId, minX, minZ, w, h, f.y);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = minX + (i + 0.5) * NAV_CELL, z = minZ + (j + 0.5) * NAV_CELL;
        // must be inside floor with margin
        const inside =
          this.cw.floorHeightAt(f, x, z) !== null &&
          this.cw.floorHeightAt(f, x + 0.25, z) !== null &&
          this.cw.floorHeightAt(f, x - 0.25, z) !== null &&
          this.cw.floorHeightAt(f, x, z + 0.25) !== null &&
          this.cw.floorHeightAt(f, x, z - 0.25) !== null;
        if (!inside) continue;
        let door: unknown = null;
        const blocked = this.blockedAt(x, z, f.y, (c) => {
          if (c.tag === 'door') {
            door = c.ref ?? c;
            return true;
          }
          return false;
        });
        if (!blocked) {
          layer.walk[j * w + i] = 1;
          if (door) {
            layer.extra[j * w + i] = 4;
            this.doorCells.set(layer.offset + j * w + i, door);
          }
        }
      }
    }
    this.floorToLayer.set(floorId, layer.id);
  }

  private newLayer(floorId: number, minX: number, minZ: number, w: number, h: number, y: number): NavLayer {
    const layer: NavLayer = {
      id: this.layers.length,
      floorId,
      minX,
      minZ,
      w,
      h,
      y,
      offset: this.total,
      walk: new Uint8Array(w * h),
      extra: new Uint8Array(w * h),
    };
    this.layers.push(layer);
    this.total += w * h;
    return layer;
  }

  layerForFloor(floorId: number): number {
    if (floorId < 0) return 0;
    return this.floorToLayer.get(floorId) ?? 0;
  }

  addLink(l: Omit<NavLink, 'id' | 'enabled'> & { enabled?: boolean }): NavLink {
    const link: NavLink = { ...l, id: this.links.length, enabled: l.enabled ?? true };
    this.links.push(link);
    const a = this.nearestWalkable(link.ax, link.az, link.aLayer, 3);
    const b = this.nearestWalkable(link.bx, link.bz, link.bLayer, 3);
    // register at both ends; direction is checked during the search
    if (a >= 0) this.pushNodeLink(a, link);
    if (b >= 0) this.pushNodeLink(b, link);
    (link as NavLink & { na: number; nb: number }).na = a;
    (link as NavLink & { na: number; nb: number }).nb = b;
    return link;
  }

  private pushNodeLink(n: number, l: NavLink) {
    let arr = this.nodeLinks.get(n);
    if (!arr) this.nodeLinks.set(n, (arr = []));
    arr.push(l);
  }

  linkEnds(l: NavLink): [number, number] {
    const ll = l as NavLink & { na: number; nb: number };
    return [ll.na, ll.nb];
  }

  node(x: number, z: number, layer: number): number {
    const L = this.layers[layer];
    if (!L) return -1;
    const i = Math.floor((x - L.minX) / NAV_CELL), j = Math.floor((z - L.minZ) / NAV_CELL);
    if (i < 0 || j < 0 || i >= L.w || j >= L.h) return -1;
    return L.offset + j * L.w + i;
  }

  layerOf(node: number): NavLayer {
    for (let k = this.layers.length - 1; k >= 0; k--) if (node >= this.layers[k].offset) return this.layers[k];
    return this.layers[0];
  }

  walkable(node: number): boolean {
    if (node < 0) return false;
    const L = this.layerOf(node);
    return L.walk[node - L.offset] === 1;
  }

  nodePos(node: number): { x: number; z: number; layer: number } {
    const L = this.layerOf(node);
    const k = node - L.offset;
    const i = k % L.w, j = (k / L.w) | 0;
    return { x: L.minX + (i + 0.5) * NAV_CELL, z: L.minZ + (j + 0.5) * NAV_CELL, layer: L.id };
  }

  nearestWalkable(x: number, z: number, layer: number, maxR = 4): number {
    const L = this.layers[layer];
    if (!L) return -1;
    const ci = Math.floor((x - L.minX) / NAV_CELL), cj = Math.floor((z - L.minZ) / NAV_CELL);
    let best = -1, bestD = Infinity;
    const R = Math.ceil(maxR / NAV_CELL);
    for (let r = 0; r <= R; r++) {
      for (let j = cj - r; j <= cj + r; j++) {
        for (let i = ci - r; i <= ci + r; i++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
          if (i < 0 || j < 0 || i >= L.w || j >= L.h) continue;
          if (!L.walk[j * L.w + i]) continue;
          const px = L.minX + (i + 0.5) * NAV_CELL, pz = L.minZ + (j + 0.5) * NAV_CELL;
          const d = Math.hypot(px - x, pz - z);
          if (d < bestD) {
            bestD = d;
            best = L.offset + j * L.w + i;
          }
        }
      }
      if (best >= 0 && r * NAV_CELL > bestD) break;
    }
    return best;
  }

  /** Dijkstra from the target node over all layers and links. */
  computeField(tx: number, tz: number, layer: number, maxCost = 90, time = 0): FlowField {
    const n = this.total;
    const dist = new Float32Array(n).fill(Infinity);
    const next = new Int32Array(n).fill(-1);
    const link = new Int32Array(n).fill(-1);
    const field: FlowField = { dist, next, link, target: { x: tx, z: tz, layer }, time };
    const start = this.nearestWalkable(tx, tz, layer, 6);
    if (start < 0) return field;
    const heap = new Heap(n);
    dist[start] = 0;
    heap.push(start, 0);
    const done = new Uint8Array(n);
    while (heap.size) {
      const u = heap.pop();
      if (done[u]) continue;
      done[u] = 1;
      const du = dist[u];
      if (du > maxCost) break;
      const L = this.layerOf(u);
      const k = u - L.offset;
      const i = k % L.w, j = (k / L.w) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= L.w || nj >= L.h) continue;
          const nk = nj * L.w + ni;
          if (!L.walk[nk]) continue;
          if (di && dj && (!L.walk[j * L.w + ni] || !L.walk[nj * L.w + i])) continue;
          const v = L.offset + nk;
          const c = du + (di && dj ? SQRT2 : 1) * NAV_CELL + L.extra[nk] * NAV_CELL;
          if (c < dist[v]) {
            dist[v] = c;
            next[v] = u;
            link[v] = -1;
            heap.push(v, c);
          }
        }
      }
      const ls = this.nodeLinks.get(u);
      if (ls) {
        for (const l of ls) {
          if (!l.enabled) continue;
          const [na, nb] = this.linkEnds(l);
          // reversed search: an agent at the other end travels to u through the link
          const other = u === na ? nb : na;
          if (other < 0) continue;
          // directional: agent must be able to go other -> u
          if (!l.bidir && other !== na) continue;
          const c = du + l.cost;
          if (c < dist[other]) {
            dist[other] = c;
            next[other] = u;
            link[other] = l.id;
            heap.push(other, c);
          }
        }
      }
    }
    return field;
  }

  /** Walk the grid line between two nodes on the same layer: true if all cells walkable. */
  lineWalkable(ax: number, az: number, bx: number, bz: number, layer: number): boolean {
    const L = this.layers[layer];
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (NAV_CELL * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const i = Math.floor((x - L.minX) / NAV_CELL), j = Math.floor((z - L.minZ) / NAV_CELL);
      if (i < 0 || j < 0 || i >= L.w || j >= L.h) return false;
      if (!L.walk[j * L.w + i]) return false;
      // keep agents off tight corners: sample perpendicular offsets
    }
    return true;
  }
}
