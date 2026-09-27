import * as THREE from 'three';
import { boxGeo, cylGeo, gableGeo, gableRoofGeo, merge, place, tint } from '../render/geo';
import { basicMat, flatMat, getTexture, worldMat } from '../render/textures';
import type { Breakable, Door, Ladder, Level, Shelf, WindowOpening } from './level';
import { rng } from '../core/rng';

/** Transform house-local (lx, lz) to world. */
function tw(x: number, z: number, rot: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

type Side = 'n' | 's' | 'e' | 'w';
export interface Opening {
  side: Side;
  off: number;
  w?: number;
  floor?: number;
  locked?: string | null;
  /** windows: add boards / glass */
  boarded?: boolean;
}
export interface HouseSpec {
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
  floors?: 1 | 2;
  wallH?: number;
  mat?: 'plaster' | 'stone' | 'wood';
  roofMat?: 'roof' | 'thatch';
  doors?: Opening[];
  windows?: Opening[];
  /** loft over part of the interior (for 2 floors): fraction of depth from north side */
  loft?: number;
  interiorLadder?: { lx: number };
  noRoof?: boolean;
  base?: number; // floor height, defaults to terrain at center
  name?: string;
}

export interface HouseResult {
  base: number;
  doors: Door[];
  windows: WindowOpening[];
  loftFloor: number | null;
  toWorld: (lx: number, lz: number) => [number, number];
  spec: HouseSpec;
}

const T = 0.25; // wall thickness

export function buildHouse(L: Level, spec: HouseSpec): HouseResult {
  const floors = spec.floors ?? 1;
  const wallH = spec.wallH ?? 3;
  const H = wallH * floors;
  const base = spec.base ?? L.h(spec.x, spec.z);
  const { x, z, rot, w, d } = spec;
  const toW = (lx: number, lz: number) => tw(x, z, rot, lx, lz);
  const wallMat = worldMat(spec.mat ?? 'plaster');
  const trimMat = worldMat('darkwood');
  const localGeos: { mat: THREE.Material; g: THREE.BufferGeometry }[] = [];
  const addG = (mat: THREE.Material, g: THREE.BufferGeometry) => localGeos.push({ mat, g });
  const res: HouseResult = { base, doors: [], windows: [], loftFloor: null, toWorld: toW, spec };

  const sides: Side[] = ['n', 's', 'e', 'w'];
  for (const side of sides) {
    const alongX = side === 'n' || side === 's';
    const len = alongX ? w : d;
    const outward = side === 'n' || side === 'w' ? -1 : 1;
    const wallOff = (alongX ? d / 2 : w / 2) - T / 2;
    // openings on this side
    interface Op { a: number; b: number; y0: number; y1: number; kind: 'door' | 'window'; o: Opening }
    const ops: Op[] = [];
    for (const o of spec.doors ?? []) {
      if (o.side !== side) continue;
      const ow = o.w ?? 1.3;
      const f = o.floor ?? 0;
      ops.push({ a: o.off - ow / 2, b: o.off + ow / 2, y0: f * wallH, y1: f * wallH + 2.25, kind: 'door', o });
    }
    for (const o of spec.windows ?? []) {
      if (o.side !== side) continue;
      const ow = o.w ?? 1.2;
      const f = o.floor ?? 0;
      ops.push({ a: o.off - ow / 2, b: o.off + ow / 2, y0: f * wallH + 0.95, y1: f * wallH + 2.1, kind: 'window', o });
    }
    // strips
    const cuts = new Set<number>([-len / 2, len / 2]);
    for (const op of ops) {
      cuts.add(op.a);
      cuts.add(op.b);
    }
    const xs = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k < xs.length - 1; k++) {
      const s0 = xs[k], s1 = xs[k + 1];
      if (s1 - s0 < 1e-3) continue;
      const mid = (s0 + s1) / 2;
      const inOps = ops.filter((op) => mid > op.a && mid < op.b);
      // covered vertical intervals
      let intervals: [number, number][] = [[-0.6, H]];
      for (const op of inOps) {
        const next: [number, number][] = [];
        for (const [a, b] of intervals) {
          if (op.y1 <= a || op.y0 >= b) next.push([a, b]);
          else {
            if (op.y0 > a) next.push([a, op.y0]);
            if (op.y1 < b) next.push([op.y1, b]);
          }
        }
        intervals = next;
      }
      const sw = s1 - s0;
      for (const [a, b] of intervals) {
        const g = alongX ? boxGeo(sw, b - a, T, 2) : boxGeo(T, b - a, sw, 2);
        const lx = alongX ? mid : outward * wallOff;
        const lz = alongX ? outward * wallOff : mid;
        place(g, lx, (a + b) / 2, lz);
        addG(wallMat, g);
      }
      // colliders: per strip, per covered interval (move & bullet)
      const [cx, cz] = toW(alongX ? mid : outward * wallOff, alongX ? outward * wallOff : mid);
      const hx = alongX ? sw / 2 : T / 2, hz = alongX ? T / 2 : sw / 2;
      for (const [a, b] of intervals) {
        L.cw.addBox(cx, cz, hx, hz, rot, base + a, base + b, { tag: 'wall' });
      }
      for (const op of inOps) {
        if (op.kind === 'window') {
          const col = L.cw.addBox(cx, cz, hx, hz, rot, base + op.y0, base + op.y1, { tag: 'window', bullet: false, cam: false, sight: false });
          const onx = alongX ? 0 : outward, onz = alongX ? outward : 0;
          const [wx, wz] = toW(alongX ? (op.a + op.b) / 2 : outward * wallOff, alongX ? outward * wallOff : (op.a + op.b) / 2);
          // world outward normal
          const c = Math.cos(rot), s = Math.sin(rot);
          const wnx = onx * c + onz * s, wnz = -onx * s + onz * c;
          // only register once per opening (strip == opening since cuts at edges)
          const win: WindowOpening = {
            kind: 'window',
            x: wx,
            z: wz,
            y: base + op.y0 - 0.95,
            rot,
            width: op.b - op.a,
            collider: col,
            link: null,
            nx: wnx,
            nz: wnz,
            barricade: null,
            boards: null,
            glass: null,
            broken: false,
          };
          col.ref = win;
          L.windows.push(win);
          res.windows.push(win);
          // frame + sill visual
          const sill = alongX ? boxGeo(op.b - op.a + 0.1, 0.08, T + 0.12, 1) : boxGeo(T + 0.12, 0.08, op.b - op.a + 0.1, 1);
          place(sill, alongX ? (op.a + op.b) / 2 : outward * wallOff, op.y0, alongX ? outward * wallOff : (op.a + op.b) / 2);
          addG(trimMat, sill);
          // shutters (open, against wall)
          for (const sgn of [-1, 1]) {
            const sh = alongX ? boxGeo((op.b - op.a) / 2, op.y1 - op.y0, 0.05, 1) : boxGeo(0.05, op.y1 - op.y0, (op.b - op.a) / 2, 1);
            const edge = sgn < 0 ? op.a : op.b;
            const pos = edge + (sgn * (op.b - op.a)) / 4;
            place(
              sh,
              alongX ? pos : outward * (wallOff + T / 2 + 0.04),
              (op.y0 + op.y1) / 2,
              alongX ? outward * (wallOff + T / 2 + 0.04) : pos,
            );
            addG(worldMat('wood', 0x7a6a50), sh);
          }
        } else {
          // door
          const ow = op.b - op.a;
          const [dx, dz] = toW(alongX ? (op.a + op.b) / 2 : outward * wallOff, alongX ? outward * wallOff : (op.a + op.b) / 2);
          const door = makeDoor(L, dx, dz, base + op.y0, rot + (alongX ? 0 : Math.PI / 2), ow, op.o.locked ?? null, outward);
          res.doors.push(door);
          // frame
          const fr = alongX ? boxGeo(ow + 0.16, 0.14, T + 0.1, 1) : boxGeo(T + 0.1, 0.14, ow + 0.16, 1);
          place(fr, alongX ? (op.a + op.b) / 2 : outward * wallOff, op.y1, alongX ? outward * wallOff : (op.a + op.b) / 2);
          addG(trimMat, fr);
        }
      }
    }
  }
  // corner posts / beams (timber framing look)
  for (const [cx, cz] of [
    [-w / 2 + 0.1, -d / 2 + 0.1],
    [w / 2 - 0.1, -d / 2 + 0.1],
    [-w / 2 + 0.1, d / 2 - 0.1],
    [w / 2 - 0.1, d / 2 - 0.1],
  ]) {
    const g = boxGeo(0.3, H + 0.6, 0.3, 2);
    place(g, cx, H / 2 - 0.3, cz);
    addG(trimMat, g);
  }
  for (let f = 1; f <= floors; f++) {
    for (const [bw, bd, bx, bz] of [
      [w + 0.05, 0.18, 0, -d / 2 + T / 2],
      [w + 0.05, 0.18, 0, d / 2 - T / 2],
      [0.18, d + 0.05, -w / 2 + T / 2, 0],
      [0.18, d + 0.05, w / 2 - T / 2, 0],
    ]) {
      const g = boxGeo(bw, 0.2, bd + 0.06, 2);
      place(g, bx, f * wallH - 0.1, bz);
      addG(trimMat, g);
    }
  }

  // ground floor
  const gf = boxGeo(w - 0.1, 0.3, d - 0.1, 2);
  place(gf, 0, -0.14, 0);
  addG(worldMat('wood', 0x8a7a60), gf);
  L.cw.addFloor(x, z, w / 2 - 0.05, d / 2 - 0.05, rot, base + 0.01, undefined, 0, true);

  // loft / upper floor
  if (floors === 2) {
    const loftFrac = spec.loft ?? 1;
    const ld = (d - 2 * T) * loftFrac;
    const lz0 = -d / 2 + T; // north inner edge
    const lcz = lz0 + ld / 2;
    const g = boxGeo(w - 2 * T, 0.2, ld, 2);
    place(g, 0, wallH - 0.1, lcz);
    addG(worldMat('wood', 0x9a8466), g);
    // beams under loft
    for (let bx = -w / 2 + 1; bx < w / 2 - 0.5; bx += 1.6) {
      const b = boxGeo(0.16, 0.22, ld, 2);
      place(b, bx, wallH - 0.31, lcz);
      addG(trimMat, b);
    }
    const [fx, fz] = toW(0, lcz);
    const fl = L.cw.addFloor(fx, fz, w / 2 - T, ld / 2, rot, base + wallH, undefined, 0.2);
    L.upperFloors.push(fl.id);
    res.loftFloor = fl.id;
    if (loftFrac < 1) {
      // railing along the open edge with a gap for the ladder
      const edgeZ = lz0 + ld;
      const lad = spec.interiorLadder?.lx ?? 0;
      const gap: [number, number] = [lad - 0.55, lad + 0.55];
      const segs: [number, number][] = [
        [-w / 2 + T, gap[0]],
        [gap[1], w / 2 - T],
      ];
      for (const [a, b] of segs) {
        if (b - a < 0.05) continue;
        const rg = boxGeo(b - a, 0.08, 0.08, 1);
        place(rg, (a + b) / 2, wallH + 0.95, edgeZ - 0.05);
        addG(trimMat, rg);
        for (let px = a + 0.1; px < b; px += 0.7) {
          const p = boxGeo(0.07, 0.95, 0.07, 1);
          place(p, px, wallH + 0.47, edgeZ - 0.05);
          addG(trimMat, p);
        }
        const [rx, rz] = toW((a + b) / 2, edgeZ - 0.05);
        L.cw.addBox(rx, rz, (b - a) / 2, 0.08, rot, base + wallH, base + wallH + 1.0, { tag: 'wall', bullet: false, cam: false, sight: false });
      }
      // edge fascia
      const fa = boxGeo(w - 2 * T, 0.3, 0.1, 2);
      place(fa, 0, wallH - 0.15, edgeZ);
      addG(trimMat, fa);
      if (spec.interiorLadder) {
        const lx = spec.interiorLadder.lx;
        const [bx, bz] = toW(lx, edgeZ + 1.0);
        const [tx, tz] = toW(lx, edgeZ + 0.05);
        const [ex, ez] = toW(lx, edgeZ - 0.6);
        makeLadder(L, {
          bx, bz, by: base, tx, tz, ty: base + wallH, ex, ez, ey: base + wallH,
          facing: rot, // climbing faces north (-z local)
          pushable: false,
        });
      }
    }
  }
  // ceiling slab (camera/bullets)
  const ceil = boxGeo(w - 2 * T, 0.12, d - 2 * T, 2);
  place(ceil, 0, H + 0.06, 0);
  addG(worldMat('darkwood'), ceil);
  L.cw.addFloor(x, z, w / 2 - T, d / 2 - T, rot, base + H + 0.12, undefined, 0.12);

  // roof
  if (!spec.noRoof) {
    const rh = d * 0.42;
    const roofMat = worldMat(spec.roofMat ?? 'roof');
    const rg = gableRoofGeo(w, d, rh, 0.45, 2);
    place(rg, 0, H, 0);
    addG(roofMat, rg);
    for (const sx of [-1, 1]) {
      const gg = gableGeo(d, rh, T, 2);
      place(gg, (sx * (w - T)) / 2, H, 0, 0, Math.PI / 2, 0);
      addG(wallMat, gg);
    }
    // roof collider (camera + bullets) - coarse box
    L.cw.addBox(x, z, w / 2 + 0.3, d / 2 + 0.3, rot, base + H, base + H + rh * 0.8, { move: false, tag: 'wall' });
  }

  // commit geometry in world space
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, base, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1));
  for (const { mat, g } of localGeos) {
    g.applyMatrix4(m);
    L.batch.add(mat, g);
  }
  return res;
}

/** Door hinged on one side; `rot` is the wall-aligned yaw (door width along local X). */
export function makeDoor(L: Level, x: number, z: number, y: number, rot: number, width: number, locked: string | null, outward = 1): Door {
  const pivot = new THREE.Object3D();
  const c = Math.cos(rot), s = Math.sin(rot);
  // hinge at local -width/2
  pivot.position.set(x - (width / 2) * c, y, z + (width / 2) * s);
  pivot.rotation.y = rot;
  const panel = new THREE.Mesh(boxGeo(width - 0.04, 2.2, 0.08, 1), worldMat('wood', 0x8a6a48));
  panel.position.set(width / 2, 1.1, 0);
  panel.castShadow = true;
  const handle = new THREE.Mesh(boxGeo(0.05, 0.05, 0.16, 1), flatMat(0x333030));
  handle.position.set(width - 0.18, 1.0, 0);
  panel.add(handle);
  for (const yy of [0.4, 1.8]) {
    const band = new THREE.Mesh(boxGeo(width - 0.1, 0.1, 0.1, 1), worldMat('darkwood'));
    band.position.set(0, yy - 1.1, 0);
    panel.add(band);
  }
  pivot.add(panel);
  L.group.add(pivot);
  const col = L.cw.addBox(x, z, width / 2, 0.08, rot, y, y + 2.2, { tag: 'door' });
  const door: Door = {
    kind: 'door', x, z, y, rot, width, pivot, collider: col,
    open: false, angle: 0, target: 0, openSign: outward,
    locked, barricade: null, hp: 220, broken: false, bashing: 0,
  };
  col.ref = door;
  L.doors.push(door);
  L.interactables.push({
    x, y: y + 1, z, radius: 1.7, enabled: true, priority: 2,
    prompt: (g) => {
      if (door.broken) return null;
      if (door.barricade && door.barricade.pushed && !door.barricade.destroyed) return null;
      if (door.locked && !door.open) return g.hasKey(door.locked) ? '开锁' : '上锁了';
      return door.open ? '关门' : '开门';
    },
    use: (g) => g.useDoor(door),
  });
  return door;
}

export function setDoorOpen(door: Door, open: boolean, sign: number) {
  door.open = open;
  door.target = open ? sign * 1.75 : 0;
  door.collider.enabled = !open && !door.broken;
}

export interface LadderSpec {
  bx: number; bz: number; by: number;
  tx: number; tz: number; ty: number;
  ex: number; ez: number; ey: number;
  facing: number;
  pushable: boolean;
  viaWindow?: WindowOpening | null;
}

export function makeLadder(L: Level, sp: LadderSpec): Ladder {
  const len = Math.hypot(sp.tx - sp.bx, sp.ty - sp.by, sp.tz - sp.bz) + 0.4;
  const g: THREE.BufferGeometry[] = [];
  for (const sx of [-0.25, 0.25]) {
    const r = boxGeo(0.07, len, 0.07, 1);
    place(r, sx, len / 2, 0);
    g.push(r);
  }
  for (let y = 0.3; y < len - 0.1; y += 0.35) {
    const r = boxGeo(0.5, 0.05, 0.05, 1);
    place(r, 0, y, 0);
    g.push(r);
  }
  const mesh = new THREE.Mesh(merge(g), worldMat('wood', 0x9a7a55));
  mesh.castShadow = true;
  const pivot = new THREE.Object3D();
  pivot.position.set(sp.bx, sp.by, sp.bz);
  // orient: ladder leans from base toward top
  const dx = sp.tx - sp.bx, dz = sp.tz - sp.bz, dy = sp.ty - sp.by;
  const horiz = Math.hypot(dx, dz);
  pivot.rotation.order = 'YXZ';
  pivot.rotation.y = Math.atan2(-dx, -dz);
  pivot.rotation.x = -Math.atan2(horiz, dy);
  pivot.add(mesh);
  L.group.add(pivot);
  const ladder: Ladder = {
    kind: 'ladder', ...sp, mesh: pivot, link: null, down: false, fall: 0,
    pushable: sp.pushable, users: 0, raiseTimer: 0, viaWindow: sp.viaWindow ?? null,
  };
  L.ladders.push(ladder);
  L.interactables.push({
    x: sp.bx, y: sp.by + 1, z: sp.bz, radius: 1.3, enabled: true, priority: 3,
    prompt: () => (ladder.down ? null : '爬上梯子'),
    use: (g) => g.player.climbLadder(ladder, true),
  });
  L.interactables.push({
    x: sp.ex, y: sp.ey + 1, z: sp.ez, radius: 1.3, enabled: true, priority: 3,
    prompt: (g) => {
      if (ladder.down) return null;
      if (ladder.pushable && g.enemyOnLadder(ladder)) return '推倒梯子';
      return ladder.viaWindow ? '顺梯子爬下' : '爬下梯子';
    },
    use: (g) => {
      if (ladder.pushable && g.enemyOnLadder(ladder)) g.pushLadder(ladder);
      else g.player.climbLadder(ladder, false);
    },
  });
  if (sp.pushable) {
    L.interactables.push({
      x: sp.ex, y: sp.ey + 1, z: sp.ez, radius: 1.3, enabled: true, priority: 1,
      prompt: (g) => (ladder.down || g.enemyOnLadder(ladder) ? null : '推倒梯子'),
      use: (g) => g.pushLadder(ladder),
    });
  }
  return ladder;
}

/** Bookshelf that can be pushed to barricade a door/window. */
export function makeShelf(L: Level, fromX: number, fromZ: number, toX: number, toZ: number, rot: number, y: number, target: Door | WindowOpening): Shelf {
  const g: THREE.BufferGeometry[] = [];
  const body = boxGeo(1.4, 1.9, 0.45, 1);
  place(body, 0, 0.95, 0);
  g.push(body);
  const inner: THREE.BufferGeometry[] = [];
  for (const yy of [0.35, 0.9, 1.45]) {
    const b = boxGeo(1.2, 0.3, 0.2, 1);
    place(b, rng.range(-0.1, 0.1), yy, -0.14);
    inner.push(tint(b, rng.pick([0x5a2a20, 0x2a3a50, 0x4a4a2a, 0x6a5030])));
  }
  const mesh = new THREE.Group();
  const m1 = new THREE.Mesh(merge(g), worldMat('darkwood'));
  const m2 = new THREE.Mesh(merge(inner), new THREE.MeshLambertMaterial({ vertexColors: true }));
  m1.castShadow = true;
  mesh.add(m1, m2);
  mesh.position.set(fromX, y, fromZ);
  mesh.rotation.y = rot;
  L.group.add(mesh);
  const col = L.cw.addBox(fromX, fromZ, 0.7, 0.24, rot, y, y + 1.9, { tag: 'barricade' });
  const shelf: Shelf = {
    kind: 'shelf', mesh, collider: col, fromX, fromZ, toX, toZ, rot,
    pushed: false, progress: 0, hp: 380, target, destroyed: false,
  };
  col.ref = shelf;
  L.shelves.push(shelf);
  L.interactables.push({
    x: fromX, y: y + 1, z: fromZ, radius: 1.6, enabled: true, priority: 2,
    prompt: () => (shelf.pushed || shelf.destroyed ? null : '推书架堵住'),
    use: (g) => g.pushShelf(shelf),
  });
  return shelf;
}

// ------------------------------------------------------------------ small props

export function crate(L: Level, x: number, z: number, rot = 0, size = 0.8, loot: string | null = 'auto'): Breakable {
  const y = L.h(x, z);
  const g: THREE.BufferGeometry[] = [];
  const b = boxGeo(size, size, size, 0.8);
  place(b, 0, size / 2, 0);
  g.push(b);
  for (const yy of [0.08, size - 0.08]) {
    const s1 = boxGeo(size + 0.03, 0.1, size + 0.03, 0.8);
    place(s1, 0, yy, 0);
    g.push(s1);
  }
  const mesh = new THREE.Mesh(merge(g), worldMat('wood', 0xa08560));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rot;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  L.group.add(mesh);
  const col = L.cw.addBox(x, z, size / 2, size / 2, rot, y, y + size, { tag: 'breakable', cam: false });
  const br: Breakable = { kind: 'breakable', mesh, collider: col, hp: 60, x, y: y + size / 2, z, type: 'crate', broken: false, loot, radius: size * 0.6, height: size };
  col.ref = br;
  L.breakables.push(br);
  return br;
}

export function barrel(L: Level, x: number, z: number, loot: string | null = 'auto'): Breakable {
  const y = L.h(x, z);
  const g: THREE.BufferGeometry[] = [];
  const b = cylGeo(0.36, 0.34, 1.0, 10, 1);
  place(b, 0, 0.5, 0);
  g.push(b);
  const mesh = new THREE.Mesh(merge(g), worldMat('wood', 0x8a6a48));
  const hoops = new THREE.Mesh(merge([place(cylGeo(0.375, 0.375, 0.06, 10, 1), 0, 0.2, 0), place(cylGeo(0.375, 0.375, 0.06, 10, 1), 0, 0.8, 0)]), flatMat(0x2a2624));
  mesh.add(hoops);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  L.group.add(mesh);
  const col = L.cw.addCircle(x, z, 0.36, y, y + 1, { tag: 'breakable' });
  const br: Breakable = { kind: 'breakable', mesh, collider: col, hp: 60, x, y: y + 0.5, z, type: 'barrel', broken: false, loot, radius: 0.4, height: 1 };
  col.ref = br;
  L.breakables.push(br);
  return br;
}

/** Static non-breakable box prop merged into the level batch. */
export function staticBox(L: Level, x: number, z: number, w: number, h: number, d: number, rot: number, mat: THREE.Material, y?: number, collide = true, bullet = true) {
  const yy = y ?? L.h(x, z);
  const g = boxGeo(w, h, d, 1.5);
  place(g, x, yy + h / 2, z, 0, rot, 0);
  L.batch.add(mat, g);
  if (collide) L.cw.addBox(x, z, w / 2, d / 2, rot, yy, yy + h, { tag: 'prop', bullet, cam: false, sight: h > 1.6 });
}

export function hay(L: Level, x: number, z: number, rot = 0) {
  const y = L.h(x, z);
  const g = boxGeo(1.4, 0.7, 0.8, 1);
  place(g, x, y + 0.35, z, 0, rot, 0);
  L.batch.add(worldMat('hay'), g);
  L.cw.addBox(x, z, 0.7, 0.4, rot, y, y + 0.7, { tag: 'prop', cam: false, sight: false });
}

export function haystack(L: Level, x: number, z: number, r = 1.4) {
  const y = L.h(x, z);
  const g = new THREE.SphereGeometry(r, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  place(g, x, y, z, 0, 0, 0, 1, 1.1, 1);
  L.batch.add(worldMat('hay'), g);
  L.cw.addCircle(x, z, r * 0.9, y, y + r, { tag: 'prop', sight: true, cam: false });
}

export function fence(L: Level, pts: [number, number][], height = 1.1, gapEvery = 0) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(-(bz - az), bx - ax);
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const y = L.h(x, z);
      const p = boxGeo(0.12, height + 0.2, 0.12, 1);
      place(p, x, y + (height + 0.2) / 2 - 0.1, z);
      L.batch.add(worldMat('darkwood'), p);
    }
    for (const hh of [0.4, 0.85]) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const y = (L.h(ax, az) + L.h(bx, bz)) / 2;
      const r = boxGeo(len, 0.1, 0.05, 1.5);
      place(r, mx, y + hh * height, mz, 0, rot, 0);
      L.batch.add(worldMat('wood', 0x9a8a70), r);
    }
    if (!gapEvery) {
      const y = (L.h(ax, az) + L.h(bx, bz)) / 2;
      L.cw.addBox((ax + bx) / 2, (az + bz) / 2, len / 2, 0.08, rot, y - 0.5, y + height, { tag: 'prop', bullet: false, cam: false, sight: false });
    }
  }
}

export function cart(L: Level, x: number, z: number, rot: number) {
  const y = L.h(x, z);
  const g: THREE.BufferGeometry[] = [];
  const bed = boxGeo(1.6, 0.12, 2.6, 1);
  place(bed, 0, 0.75, 0);
  g.push(bed);
  for (const sx of [-0.8, 0.8]) {
    const side = boxGeo(0.08, 0.4, 2.6, 1);
    place(side, sx, 0.95, 0);
    g.push(side);
  }
  const front = boxGeo(1.6, 0.4, 0.08, 1);
  place(front, 0, 0.95, -1.3);
  g.push(front);
  for (const sx of [-0.2, 0.2]) {
    const shaft = boxGeo(0.08, 0.08, 2, 1);
    place(shaft, sx, 0.5, 2.2, -0.35, 0, 0);
    g.push(shaft);
  }
  const wheels: THREE.BufferGeometry[] = [];
  for (const sx of [-0.9, 0.9]) {
    const w = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 10);
    place(w, sx, 0.55, 0.2, 0, 0, Math.PI / 2);
    wheels.push(w);
  }
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1));
  const gg = merge(g);
  gg.applyMatrix4(m);
  L.batch.add(worldMat('wood', 0x8a7458), gg);
  const wg = merge(wheels);
  wg.applyMatrix4(m);
  L.batch.add(worldMat('darkwood'), wg);
  L.cw.addBox(x, z, 0.85, 1.4, rot, y, y + 1.2, { tag: 'prop', cam: false, sight: false });
}

export function well(L: Level, x: number, z: number) {
  const y = L.h(x, z);
  const g = cylGeo(1.0, 1.05, 0.9, 12, 1.5);
  place(g, x, y + 0.45, z);
  L.batch.add(worldMat('stone'), g);
  for (const sx of [-0.9, 0.9]) {
    const p = boxGeo(0.12, 2.2, 0.12, 1);
    place(p, x + sx, y + 1.1, z);
    L.batch.add(worldMat('darkwood'), p);
  }
  const roof = gableRoofGeo(2.2, 1.6, 0.6, 0.1, 1.5);
  place(roof, x, y + 2.1, z, 0, Math.PI / 2, 0);
  L.batch.add(worldMat('roof'), roof);
  L.cw.addCircle(x, z, 1.05, y, y + 0.9, { tag: 'prop', bullet: true, sight: false });
}

export function table(L: Level, x: number, z: number, y: number, rot = 0, w = 1.4, d = 0.8) {
  const g: THREE.BufferGeometry[] = [];
  const top = boxGeo(w, 0.08, d, 1);
  place(top, 0, 0.78, 0);
  g.push(top);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = boxGeo(0.07, 0.78, 0.07, 1);
    place(leg, (sx * (w - 0.12)) / 2, 0.39, (sz * (d - 0.12)) / 2);
    g.push(leg);
  }
  const gg = merge(g);
  place(gg, x, y, z, 0, rot, 0);
  L.batch.add(worldMat('wood', 0x9a8060), gg);
  L.cw.addBox(x, z, w / 2, d / 2, rot, y, y + 0.82, { tag: 'prop', bullet: false, cam: false, sight: false });
}

export function chair(L: Level, x: number, z: number, y: number, rot = 0) {
  const g: THREE.BufferGeometry[] = [];
  const seat = boxGeo(0.45, 0.06, 0.45, 1);
  place(seat, 0, 0.46, 0);
  g.push(seat);
  const back = boxGeo(0.45, 0.5, 0.05, 1);
  place(back, 0, 0.72, 0.2);
  g.push(back);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = boxGeo(0.05, 0.46, 0.05, 1);
    place(leg, sx * 0.19, 0.23, sz * 0.19);
    g.push(leg);
  }
  const gg = merge(g);
  place(gg, x, y, z, 0, rot, 0);
  L.batch.add(worldMat('wood', 0x7a6048), gg);
}

export function bed(L: Level, x: number, z: number, y: number, rot = 0) {
  const g = boxGeo(1.0, 0.45, 2.0, 1);
  place(g, x, y + 0.225, z, 0, rot, 0);
  L.batch.add(worldMat('darkwood'), g);
  const m = boxGeo(0.9, 0.15, 1.9, 1);
  place(m, x, y + 0.5, z, 0, rot, 0);
  L.batch.add(worldMat('cloth', 0x8a8070), m);
  L.cw.addBox(x, z, 0.5, 1.0, rot, y, y + 0.6, { tag: 'prop', bullet: false, cam: false, sight: false });
}

export function fireplace(L: Level, x: number, z: number, y: number, rot: number) {
  const g = boxGeo(1.6, 1.2, 0.7, 1);
  place(g, x, y + 0.6, z, 0, rot, 0);
  L.batch.add(worldMat('stone'), g);
  const c = boxGeo(0.9, 2.2, 0.6, 1);
  place(c, x, y + 2.3, z, 0, rot, 0);
  L.batch.add(worldMat('stone'), c);
  L.cw.addBox(x, z, 0.8, 0.35, rot, y, y + 3, { tag: 'prop' });
}

export function lantern(L: Level, x: number, z: number, y: number, withLight = false) {
  const g = boxGeo(0.18, 0.28, 0.18, 1);
  place(g, x, y, z);
  L.batch.add(basicMat(0xffc070), g);
  if (withLight) {
    const light = new THREE.PointLight(0xffa050, 6, 9, 1.6);
    light.position.set(x, y, z);
    L.group.add(light);
  }
}

// ------------------------------------------------------------------ vegetation (instanced)

let pineGeo: THREE.BufferGeometry | null = null;
let trunkGeo: THREE.BufferGeometry | null = null;
let deadGeo: THREE.BufferGeometry | null = null;
let bushGeo: THREE.BufferGeometry | null = null;
let rockGeo: THREE.BufferGeometry | null = null;
let grassGeo: THREE.BufferGeometry | null = null;

function ensureVegGeos() {
  if (pineGeo) return;
  const cones: THREE.BufferGeometry[] = [];
  for (const [r, h, y] of [
    [1.9, 3.2, 2.6],
    [1.5, 2.8, 4.2],
    [1.05, 2.4, 5.6],
    [0.6, 1.8, 6.8],
  ]) {
    const c = new THREE.ConeGeometry(r, h, 7, 1);
    place(c, 0, y, 0);
    cones.push(tint(c, new THREE.Color(0x3a4a30).lerp(new THREE.Color(0x4f5a3a), Math.random())));
  }
  pineGeo = merge(cones);
  trunkGeo = cylGeo(0.14, 0.24, 3, 6, 2);
  trunkGeo.translate(0, 1.5, 0);
  const dead: THREE.BufferGeometry[] = [];
  const t = cylGeo(0.1, 0.22, 5.5, 5, 2);
  t.translate(0, 2.75, 0);
  dead.push(t);
  for (const [y, a, l] of [
    [2.6, 0.9, 1.6],
    [3.4, -1.1, 1.4],
    [4.3, 0.5, 1.1],
  ]) {
    const b = cylGeo(0.03, 0.07, l, 4, 1);
    place(b, Math.sin(a) * l * 0.4, y, Math.cos(a) * l * 0.2, 0.2, 0, a);
    dead.push(b);
  }
  deadGeo = merge(dead);
  const blobs: THREE.BufferGeometry[] = [];
  for (const [bx, by, bz, r] of [[0, 0.35, 0, 0.5], [0.35, 0.25, 0.1, 0.35], [-0.3, 0.28, -0.1, 0.38], [0.05, 0.22, 0.35, 0.3]]) {
    const b = new THREE.IcosahedronGeometry(r, 0);
    b.translate(bx, by, bz);
    blobs.push(tint(b.toNonIndexed(), new THREE.Color(0x3e4a2c).lerp(new THREE.Color(0x56603a), Math.random())));
  }
  bushGeo = merge(blobs);
  const rk = new THREE.DodecahedronGeometry(1, 0);
  rk.scale(1, 0.7, 0.9);
  rockGeo = rk;
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const p = new THREE.PlaneGeometry(0.08, 0.45);
    place(p, (Math.random() - 0.5) * 0.3, 0.22, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
    blades.push(p);
  }
  grassGeo = tint(merge(blades), 0x6a7040);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

function mat4(x: number, y: number, z: number, ry: number, s: number, sy = s): THREE.Matrix4 {
  _e.set(0, ry, 0);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, sy, s));
}

const pineMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const vegMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

export function pine(L: Level, x: number, z: number, s = 1, collide = true) {
  ensureVegGeos();
  const y = L.h(x, z) - 0.2;
  const ry = rng.range(0, Math.PI * 2);
  L.addInstance('pine', pineGeo!, pineMat, mat4(x, y, z, ry, s, s * rng.range(0.9, 1.25)));
  L.addInstance('trunk', trunkGeo!, worldMat('bark'), mat4(x, y, z, ry, s));
  if (collide) L.cw.addCircle(x, z, 0.3 * s, y, y + 6, { tag: 'tree', sight: true, bullet: true });
}

export function deadTree(L: Level, x: number, z: number, s = 1) {
  ensureVegGeos();
  const y = L.h(x, z) - 0.1;
  L.addInstance('dead', deadGeo!, worldMat('bark'), mat4(x, y, z, rng.range(0, 6.28), s));
  L.cw.addCircle(x, z, 0.25 * s, y, y + 5, { tag: 'tree' });
}

export function bush(L: Level, x: number, z: number, s = 1) {
  ensureVegGeos();
  L.addInstance('bush', bushGeo!, pineMat, mat4(x, L.h(x, z), z, rng.range(0, 6.28), s));
}

export function rock(L: Level, x: number, z: number, s = 1, collide = true) {
  ensureVegGeos();
  const y = L.h(x, z);
  _m.identity();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y + s * 0.2, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.3, 0.3), rng.range(0, 6.28), rng.range(-0.3, 0.3))),
    new THREE.Vector3(s, s, s),
  );
  L.addInstance('rock', rockGeo!, worldMat('rock'), m);
  if (collide && s > 0.5) L.cw.addCircle(x, z, s * 0.85, y - 1, y + s * 0.9, { tag: 'rock', sight: s > 1.2, cam: s > 1.5 });
}

export function grass(L: Level, x: number, z: number) {
  ensureVegGeos();
  L.addInstance('grass', grassGeo!, vegMat, mat4(x, L.h(x, z), z, rng.range(0, 6.28), rng.range(0.8, 1.4)), false);
}

/** Scatter trees in a band/region avoiding a predicate. */
export function forestFill(L: Level, minX: number, minZ: number, maxX: number, maxZ: number, spacing: number, avoid: (x: number, z: number) => boolean, deadChance = 0.12) {
  for (let z = minZ; z <= maxZ; z += spacing) {
    for (let x = minX; x <= maxX; x += spacing) {
      const px = x + rng.range(-spacing * 0.45, spacing * 0.45);
      const pz = z + rng.range(-spacing * 0.45, spacing * 0.45);
      if (avoid(px, pz)) continue;
      if (rng.chance(deadChance)) deadTree(L, px, pz, rng.range(0.8, 1.2));
      else pine(L, px, pz, rng.range(0.8, 1.35));
    }
  }
}

/** Invisible boundary wall. */
export function boundary(L: Level, pts: [number, number][]) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(-(bz - az), bx - ax);
    L.cw.addBox((ax + bx) / 2, (az + bz) / 2, len / 2, 0.3, rot, -20, 40, { tag: 'invisible', bullet: false, cam: false, sight: false });
  }
}

/** Big rock cliff wall segment (visual + collider). */
export function cliff(L: Level, x: number, z: number, len: number, rot: number, h = 6) {
  const y = L.h(x, z) - 1;
  for (let i = 0; i < Math.ceil(len / 3); i++) {
    const t = (i + 0.5) / Math.ceil(len / 3) - 0.5;
    const c = Math.cos(rot), s = Math.sin(rot);
    const px = x + t * len * c, pz = z - t * len * s;
    rock(L, px + rng.range(-0.5, 0.5), pz + rng.range(-0.5, 0.5), rng.range(2.0, 3.2) * (h / 6), false);
  }
  L.cw.addBox(x, z, len / 2, 1.5, rot, y, y + h + 2, { tag: 'rock' });
}

export function ensureTexturesWarm() {
  for (const n of ['dirt', 'grass', 'wood', 'darkwood', 'stone', 'plaster', 'roof', 'thatch', 'bark', 'rock', 'hay']) getTexture(n);
}
