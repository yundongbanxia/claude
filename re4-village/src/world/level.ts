import * as THREE from 'three';
import { CollisionWorld, type Collider } from './collision';
import { Terrain, type TerrainDef } from './terrain';
import { NavGrid, type NavLink } from './nav';
import { GeoBatch } from '../render/geo';
import type { Game } from '../game/game';

/** Anything the player can press F on. */
export interface Interactable {
  x: number;
  y: number;
  z: number;
  radius: number;
  /** vertical tolerance */
  yTol?: number;
  enabled: boolean;
  /** player must face roughly toward it */
  needFacing?: boolean;
  priority?: number;
  prompt(game: Game): string | null;
  use(game: Game): void;
}

export interface Door {
  kind: 'door';
  x: number;
  z: number;
  y: number;
  rot: number; // wall yaw
  width: number;
  pivot: THREE.Object3D;
  collider: Collider;
  open: boolean;
  angle: number;
  target: number;
  openSign: number;
  locked: string | null;
  barricade: Shelf | null;
  hp: number;
  broken: boolean;
  /** time an enemy has been working on it */
  bashing: number;
}

export interface WindowOpening {
  kind: 'window';
  x: number;
  z: number;
  y: number; // floor height of this window
  rot: number;
  width: number;
  collider: Collider;
  link: NavLink | null;
  /** outward normal (world) */
  nx: number;
  nz: number;
  barricade: Shelf | null;
  boards: THREE.Object3D | null;
  glass: THREE.Mesh | null;
  broken: boolean;
}

export interface Ladder {
  kind: 'ladder';
  bx: number;
  bz: number;
  by: number;
  tx: number;
  tz: number;
  ty: number;
  /** where you end up at the top (inside) */
  ex: number;
  ez: number;
  ey: number;
  facing: number; // yaw facing the ladder when climbing
  mesh: THREE.Object3D;
  link: NavLink | null;
  down: boolean;
  fall: number; // 0 up .. 1 down (animated)
  pushable: boolean;
  /** enemies currently on it */
  users: number;
  raiseTimer: number;
  viaWindow: WindowOpening | null;
}

export interface Shelf {
  kind: 'shelf';
  mesh: THREE.Object3D;
  collider: Collider;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  rot: number;
  pushed: boolean;
  progress: number;
  hp: number;
  target: Door | WindowOpening;
  destroyed: boolean;
}

export interface Breakable {
  kind: 'breakable';
  mesh: THREE.Object3D;
  collider: Collider;
  hp: number;
  x: number;
  y: number;
  z: number;
  type: 'crate' | 'barrel' | 'medallion' | 'lantern';
  broken: boolean;
  loot: string | null;
  onBreak?: (g: Game) => void;
  radius: number;
  height: number;
}

export interface Trigger {
  x: number;
  z: number;
  hx: number;
  hz: number;
  once: boolean;
  fired: boolean;
  enabled: boolean;
  fn: (g: Game) => void;
}

export interface FireSource {
  x: number;
  y: number;
  z: number;
  size: number;
  light: THREE.PointLight | null;
  blue?: boolean;
  acc: number;
}

export class Level {
  id: string;
  group = new THREE.Group();
  cw: CollisionWorld;
  terrain: Terrain;
  nav: NavGrid;
  batch = new GeoBatch();
  interactables: Interactable[] = [];
  doors: Door[] = [];
  windows: WindowOpening[] = [];
  ladders: Ladder[] = [];
  shelves: Shelf[] = [];
  breakables: Breakable[] = [];
  triggers: Trigger[] = [];
  fires: FireSource[] = [];
  /** instanced props keyed by kind */
  instances = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[]; shadow: boolean }>();
  upperFloors: number[] = [];
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  animated: ((dt: number, t: number) => void)[] = [];

  constructor(id: string, terrainDef: TerrainDef) {
    this.id = id;
    this.bounds = { minX: terrainDef.minX, minZ: terrainDef.minZ, maxX: terrainDef.maxX, maxZ: terrainDef.maxZ };
    this.cw = new CollisionWorld(terrainDef.minX, terrainDef.minZ, terrainDef.maxX, terrainDef.maxZ);
    this.terrain = new Terrain(terrainDef);
    this.cw.terrain = this.terrain;
    this.group.add(this.terrain.mesh);
    this.nav = new NavGrid(this.cw);
  }

  h(x: number, z: number) {
    return this.terrain.heightAt(x, z);
  }

  addInstance(kind: string, geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, shadow = true) {
    let e = this.instances.get(kind);
    if (!e) this.instances.set(kind, (e = { geo, mat, mats: [], shadow }));
    e.mats.push(m);
  }

  /** Build merged meshes, instanced meshes and the nav grid. Call after all content is added. */
  finalize() {
    this.batch.build(this.group);
    for (const [, e] of this.instances) {
      const im = new THREE.InstancedMesh(e.geo, e.mat, e.mats.length);
      e.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = e.shadow;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.group.add(im);
    }
    const b = this.bounds;
    this.nav.buildGround(b.minX, b.minZ, b.maxX, b.maxZ);
    for (const f of this.upperFloors) this.nav.buildFloorLayer(f);
    // links need grid
    for (const w of this.windows) this.linkWindow(w);
    for (const l of this.ladders) this.linkLadder(l);
  }

  private linkWindow(w: WindowOpening) {
    if (w.link) return;
    // windows on ground floor connect outside <-> inside on the same layer; upper windows handled by ladders
    if (w.y > this.h(w.x, w.z) + 1.5) return;
    const d = 0.9;
    w.link = this.nav.addLink({
      type: 'window',
      ax: w.x + w.nx * d,
      az: w.z + w.nz * d,
      aLayer: 0,
      bx: w.x - w.nx * d,
      bz: w.z - w.nz * d,
      bLayer: 0,
      cost: 6,
      bidir: true,
      ay: w.y,
      by: w.y,
      ref: w,
    });
  }

  private linkLadder(l: Ladder) {
    if (l.link) return;
    const floorId = this.cw.floorIdAt(l.ex, l.ez, l.ey + 0.1);
    const layer = this.nav.layerForFloor(floorId);
    l.link = this.nav.addLink({
      type: 'ladder',
      ax: l.bx,
      az: l.bz,
      aLayer: 0,
      bx: l.ex,
      bz: l.ez,
      bLayer: layer,
      cost: 7,
      bidir: true,
      ay: l.by,
      by: l.ey,
      ref: l,
    });
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const f of this.fires) if (f.light) f.light.dispose();
  }
}
