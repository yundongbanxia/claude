import * as THREE from 'three';
import { boxGeo, cylGeo, gableGeo, gableRoofGeo, merge, place, tint } from '../render/geo';
import { basicMat, flatMat, worldMat } from '../render/textures';
import { buildRig, B } from '../anim/rig';
import { Animator } from '../anim/animator';
import { G } from '../anim/clips';
import { rng } from '../core/rng';
import { fence, grass, haystack, pine, rock, deadTree, bush, makeLadder as makeLadderImpl } from '../world/props';
import type { Level } from '../world/level';
import type { Game } from '../game/game';

/** Big stone church with bell tower. Front (door) faces +z. */
export function church(L: Level, x: number, z: number, rot = 0) {
  const base = L.h(x, z);
  const geos: { m: THREE.Material; g: THREE.BufferGeometry }[] = [];
  const add = (m: THREE.Material, g: THREE.BufferGeometry) => geos.push({ m, g });
  const stone = worldMat('stone', 0xb8b0a0);
  const w = 12, d = 20, h = 8;
  for (const [bw, bd, bx, bz] of [
    [w, 0.8, 0, -d / 2],
    [0.8, d, -w / 2, 0],
    [0.8, d, w / 2, 0],
    [w, 0.8, 0, d / 2],
  ]) add(stone, place(boxGeo(bw, h, bd, 2.5), bx, h / 2, bz));
  add(worldMat('roof', 0x9a7a6a), place(gableRoofGeo(d, w, 4.5, 0.5, 2.5), 0, h, 0, 0, Math.PI / 2, 0));
  for (const s of [-1, 1]) add(stone, place(gableGeo(w, 4.5, 0.8, 2.5), 0, h, (s * (d - 0.8)) / 2));
  // big door
  add(worldMat('darkwood'), place(boxGeo(2.6, 4, 0.2, 1.5), 0, 2, d / 2 + 0.35));
  add(stone, place(boxGeo(3.4, 0.6, 1, 2), 0, 4.2, d / 2 + 0.3));
  // bell tower in front
  const tz = d / 2 + 2.5;
  for (const [sx, sz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) add(stone, place(boxGeo(0.8, 16, 0.8, 2), sx, 8, tz + sz));
  add(stone, place(boxGeo(4.4, 10, 4.4, 2.5), 0, 5, tz));
  add(stone, place(boxGeo(4.8, 0.6, 4.8, 2), 0, 12.2, tz));
  add(stone, place(boxGeo(4.8, 0.6, 4.8, 2), 0, 16.2, tz));
  add(worldMat('roof', 0x8a6a5a), place(new THREE.ConeGeometry(3.6, 4.5, 4, 1), 0, 18.7, tz, 0, Math.PI / 4, 0));
  // cross
  add(worldMat('darkwood'), place(boxGeo(0.15, 1.6, 0.15, 1), 0, 21.6, tz));
  add(worldMat('darkwood'), place(boxGeo(0.9, 0.15, 0.15, 1), 0, 21.9, tz));
  // bell
  const bell = merge([tint(new THREE.CylinderGeometry(0.5, 0.95, 1.3, 10), 0x6a5a30)]);
  add(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), place(bell, 0, 14, tz));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, base, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1));
  for (const { m: mat, g } of geos) {
    g.applyMatrix4(m);
    L.batch.add(mat, g);
  }
  L.cw.addBox(x, z, w / 2, d / 2, rot, base - 1, base + h + 4, { tag: 'wall' });
  const c = Math.cos(rot), s = Math.sin(rot);
  L.cw.addBox(x + tz * s, z + tz * c, 2.4, 2.4, rot, base - 1, base + 20, { tag: 'wall' });
  return { bellPos: new THREE.Vector3(x + tz * s, base + 14, z + tz * c), doorPos: new THREE.Vector3(x + (d / 2 + 4.5) * s, base, z + (d / 2 + 4.5) * c) };
}

/** Wooden watchtower with ladder; returns top platform height. */
export function watchtower(L: Level, x: number, z: number, ladderSide: number) {
  const base = L.h(x, z);
  const H = 5;
  const geos: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) geos.push(place(boxGeo(0.25, H + 2.4, 0.25, 2), sx, (H + 2.4) / 2, sz));
  geos.push(place(boxGeo(3.2, 0.2, 3.2, 2), 0, H, 0));
  for (const [bw, bd, bx, bz] of [[3.2, 0.1, 0, -1.5], [3.2, 0.1, 0, 1.5], [0.1, 3.2, -1.5, 0], [0.1, 3.2, 1.5, 0]]) {
    geos.push(place(boxGeo(bw, 0.9, bd, 1.5), bx, H + 0.55, bz));
  }
  // cross braces
  for (const s of [-1, 1]) {
    geos.push(place(boxGeo(0.12, 5.5, 0.12, 2), s * 1.3, 2.5, 0, 0.45, 0, 0));
    geos.push(place(boxGeo(0.12, 5.5, 0.12, 2), 0, 2.5, s * 1.3, 0, 0, 0.45));
  }
  const roof = gableRoofGeo(3.4, 3.4, 1.2, 0.3, 2);
  place(roof, 0, H + 2.4, 0);
  const g = merge(geos);
  g.translate(x, base, z);
  L.batch.add(worldMat('wood', 0x8a7458), g);
  roof.translate(x, base, z);
  L.batch.add(worldMat('thatch'), roof);
  for (const [sx, sz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) L.cw.addCircle(x + sx, z + sz, 0.2, base - 1, base + H + 2.4, { tag: 'prop' });
  const fl = L.cw.addFloor(x, z, 1.5, 1.5, 0, base + H, undefined, 0.2);
  L.upperFloors.push(fl.id);
  // railings (move only)
  for (const [hx, hz, bx, bz] of [[1.6, 0.05, 0, -1.5], [1.6, 0.05, 0, 1.5], [0.05, 1.6, -1.5, 0], [0.05, 1.6, 1.5, 0]]) {
    L.cw.addBox(x + bx, z + bz, hx, hz, 0, base + H, base + H + 1, { tag: 'wall', bullet: false, cam: false, sight: false });
  }
  return { top: base + H, base, ladderSide };
}

export function pyre(L: Level, x: number, z: number) {
  const y = L.h(x, z);
  const logs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    logs.push(place(cylGeo(0.12, 0.14, 2.4, 5, 1), Math.cos(a) * 0.9, 0.7, Math.sin(a) * 0.9, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6));
  }
  logs.push(place(cylGeo(0.14, 0.18, 5, 6, 1), 0, 2.5, 0));
  logs.push(place(boxGeo(1.6, 0.15, 0.15, 1), 0, 3.6, 0));
  const g = merge(logs);
  g.translate(x, y, z);
  L.batch.add(worldMat('darkwood', 0x3a2a20), g);
  // charred body tied to the post
  const body = merge([
    place(boxGeo(0.4, 0.6, 0.25, 1), 0, 3.0, 0.2),
    place(boxGeo(0.25, 0.25, 0.25, 1), 0, 3.5, 0.22),
    place(boxGeo(0.15, 0.7, 0.15, 1), -0.35, 3.3, 0.2, 0, 0, 0.9),
    place(boxGeo(0.15, 0.7, 0.15, 1), 0.35, 3.3, 0.2, 0, 0, -0.9),
    place(boxGeo(0.15, 0.8, 0.15, 1), -0.1, 2.35, 0.2),
    place(boxGeo(0.15, 0.8, 0.15, 1), 0.1, 2.35, 0.2),
  ]);
  body.translate(x, y, z);
  L.batch.add(flatMat(0x141010), body);
  L.cw.addCircle(x, z, 1.4, y, y + 3, { tag: 'prop', sight: false });
  fireAt(L, x, y + 0.6, z, 1.6, true);
}

export function fireAt(L: Level, x: number, y: number, z: number, size: number, light: boolean, blue = false) {
  let pl: THREE.PointLight | null = null;
  if (light) {
    pl = new THREE.PointLight(blue ? 0x4a7aff : 0xff8a3a, blue ? 3 : 10, blue ? 7 : 14, 1.5);
    pl.position.set(x, y + 1, z);
    L.group.add(pl);
  }
  L.fires.push({ x, y, z, size, light: pl, blue, acc: 0 });
}

/** The Merchant with his blue-flame torch. */
export function merchant(L: Level, g: Game, x: number, z: number, yaw: number) {
  const y = L.h(x, z);
  const rig = buildRig({
    skin: 0x8a7060, shirt: 0x2a2440, sleeve: 0x2a2440, pants: 0x1e1a24, shoes: 0x1a1612, hair: 0x2a2020,
    height: 1.02, bulk: 1.15, hairStyle: 'bald',
    extraParts: [
      { bone: B.head, shape: 'ball', size: [0.14, 0.16, 0.15], pos: [0, 0.14, 0.02], color: 0x2a2440, seg: 1 }, // hood
      { bone: B.head, shape: 'box', size: [0.16, 0.08, 0.05], pos: [0, 0.04, -0.1], color: 0x3a2a3a }, // bandana
      { bone: B.chest, shape: 'box', size: [0.5, 0.36, 0.3], pos: [0, 0.12, 0.02], color: 0x2a2440 }, // coat
      { bone: B.hips, shape: 'cone', size: [0.36, 0.8, 0.36], pos: [0, -0.35, 0], color: 0x2a2440, seg: 8 },
      { bone: B.chest, shape: 'box', size: [0.12, 0.3, 0.06], pos: [0.12, 0.05, -0.16], color: 0x6a5a30 }, // strap
    ],
  });
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.01), basicMat(0xffd070));
  eyes.position.set(0, 0.135, -0.12);
  rig.bones[B.head].add(eyes);
  rig.root.position.set(x, y, z);
  rig.root.rotation.y = yaw;
  L.group.add(rig.root);
  const anim = new Animator(rig);
  anim.play(G.idle);
  anim.update(0.01);
  let greeted = false;
  L.animated.push((dt) => {
    anim.extra.fill(0);
    const p = g.player.pos;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < 8) {
      const toP = Math.atan2(-(p.x - x), -(p.z - z));
      let rel = toP - yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      anim.extra[B.head * 3 + 1] = Math.max(-1, Math.min(1, rel)) * 0.7;
      anim.extra[B.chest * 3 + 1] = Math.max(-1, Math.min(1, rel)) * 0.3;
      if (!greeted && d < 7) {
        greeted = true;
        g.audio.say('Over here, stranger!', 'en', 0.55, 0.9);
        g.hud.subtitle('商人："Over here, stranger!"（这边，陌生人！）', 3);
      }
    } else if (d > 14) greeted = false;
    anim.update(dt);
  });
  // blue torch (direct meshes: may be created after the level batch is built)
  const tx = x + Math.cos(yaw) * 0.9, tz = z - Math.sin(yaw) * 0.9;
  const post = new THREE.Mesh(place(cylGeo(0.05, 0.06, 1.6, 5, 1), tx, y + 0.8, tz), worldMat('darkwood'));
  const bowl = new THREE.Mesh(place(new THREE.CylinderGeometry(0.18, 0.1, 0.15, 7), tx, y + 1.65, tz), flatMat(0x3a3a3a));
  L.group.add(post, bowl);
  fireAt(L, tx, y + 1.7, tz, 0.55, true, true);
  L.cw.addCircle(x, z, 0.45, y, y + 1.8, { tag: 'prop' });
  L.interactables.push({
    x, y: y + 1, z, radius: 2.2, enabled: true, priority: 5,
    prompt: () => '交易（商人）',
    use: (gg) => gg.openMerchant(),
  });
}

export function typewriter(L: Level, g: Game, x: number, z: number, yaw: number, y?: number) {
  const yy = y ?? L.h(x, z);
  const t = merge([
    place(boxGeo(1.0, 0.06, 0.6, 1), 0, 0.76, 0),
    ...[[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]].map(([a, b]) => place(boxGeo(0.06, 0.76, 0.06, 1), a, 0.38, b)),
  ]);
  t.rotateY(yaw);
  t.translate(x, yy, z);
  L.batch.add(worldMat('wood', 0x7a6048), t);
  const tw = merge([
    tint(place(new THREE.BoxGeometry(0.42, 0.12, 0.3), 0, 0.85, 0), 0x1c1c1e),
    tint(place(new THREE.BoxGeometry(0.44, 0.06, 0.1), 0, 0.95, 0.08), 0x2a2a2c),
    tint(place(new THREE.BoxGeometry(0.3, 0.12, 0.02), 0, 1.02, 0.12, -0.3), 0xe8e4d8),
  ]);
  tw.rotateY(yaw);
  tw.translate(x, yy, z);
  L.batch.add(new THREE.MeshLambertMaterial({ vertexColors: true }), tw);
  L.cw.addBox(x, z, 0.5, 0.3, yaw, yy, yy + 0.8, { tag: 'prop', bullet: false, cam: false, sight: false });
  L.interactables.push({
    x, y: yy + 1, z, radius: 1.6, enabled: true, priority: 5,
    prompt: () => '使用打字机（存档）',
    use: (gg) => gg.hud.menus.typewriter(),
  });
  void g;
}

/** Large double gate in a stone wall segment. Returns handle to open it. */
export function bigGate(L: Level, x: number, z: number, rot: number, wallLen = 16) {
  const y = L.h(x, z);
  const stone = worldMat('stone', 0xa8a090);
  const c = Math.cos(rot), s = Math.sin(rot);
  const side = (wallLen - 4.4) / 2;
  for (const sg of [-1, 1]) {
    const off = sg * (2.2 + side / 2);
    const g = boxGeo(side, 3.2, 0.8, 2);
    place(g, x + off * c, y + 1.6 - 0.3, z - off * s, 0, rot, 0);
    L.batch.add(stone, g);
    L.cw.addBox(x + off * c, z - off * s, side / 2, 0.4, rot, y - 1, y + 3, { tag: 'wall' });
    const pil = boxGeo(1, 4.4, 1, 2);
    place(pil, x + sg * 2.4 * c, y + 2.2 - 0.3, z - sg * 2.4 * s, 0, rot, 0);
    L.batch.add(stone, pil);
    L.cw.addBox(x + sg * 2.4 * c, z - sg * 2.4 * s, 0.5, 0.5, rot, y - 1, y + 4.4, { tag: 'wall' });
  }
  const lintel = boxGeo(5.8, 0.6, 1, 2);
  place(lintel, x, y + 4.4, z, 0, rot, 0);
  L.batch.add(stone, lintel);
  const doors: THREE.Object3D[] = [];
  for (const sg of [-1, 1]) {
    const pivot = new THREE.Object3D();
    pivot.position.set(x + sg * 1.95 * c, y, z - sg * 1.95 * s);
    pivot.rotation.y = rot;
    const panel = new THREE.Mesh(boxGeo(1.95, 3.8, 0.18, 1.5), worldMat('wood', 0x6a5038));
    panel.position.set(-sg * 0.975, 1.9, 0);
    panel.castShadow = true;
    const bands = new THREE.Mesh(merge([place(boxGeo(1.95, 0.14, 0.22, 1), 0, -1.2, 0), place(boxGeo(1.95, 0.14, 0.22, 1), 0, 1.2, 0)]), flatMat(0x2a2624));
    panel.add(bands);
    pivot.add(panel);
    L.group.add(pivot);
    doors.push(pivot);
  }
  const col = L.cw.addBox(x, z, 2.0, 0.2, rot, y - 1, y + 4, { tag: 'wall' });
  let open = 0, opening = false;
  L.animated.push((dt) => {
    if (!opening || open >= 1) return;
    open = Math.min(1, open + dt / 2.5);
    doors[0].rotation.y = rot - open * 1.6;
    doors[1].rotation.y = rot + open * 1.6;
  });
  return {
    open(g: Game) {
      if (opening) return;
      opening = true;
      col.enabled = false;
      g.audio.play('gate', new THREE.Vector3(x, y + 2, z));
    },
    setProgress(p: number) {
      doors[0].rotation.y = rot - p * 1.6;
      doors[1].rotation.y = rot + p * 1.6;
    },
    get isOpen() {
      return opening;
    },
    pos: new THREE.Vector3(x, y, z),
    col,
  };
}

export function water(L: Level, x: number, z: number, w: number, d: number, y: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: 0x2a3a3a, transparent: true, opacity: 0.85 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  L.group.add(m);
}

/** Plank bridge along z from z0 to z1 at x (width 3). */
export function bridge(L: Level, x: number, z0: number, z1: number, y: number) {
  const len = Math.abs(z1 - z0);
  const zc = (z0 + z1) / 2;
  const planks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < len / 0.35; i++) planks.push(place(boxGeo(3, 0.1, 0.3, 1), x + rng.range(-0.05, 0.05), y - 0.05, Math.min(z0, z1) + 0.2 + i * 0.35));
  for (const sx of [-1.45, 1.45]) {
    planks.push(place(boxGeo(0.1, 0.1, len, 2), x + sx, y + 0.9, zc));
    for (let k = 0; k <= len; k += 2) planks.push(place(boxGeo(0.12, 1.0, 0.12, 1), x + sx, y + 0.45, Math.min(z0, z1) + k));
  }
  for (let k = 0; k <= len; k += 4) planks.push(place(boxGeo(0.25, 4, 0.25, 1), x - 1.2, y - 2, Math.min(z0, z1) + k), place(boxGeo(0.25, 4, 0.25, 1), x + 1.2, y - 2, Math.min(z0, z1) + k));
  L.batch.add(worldMat('wood', 0x8a7050), merge(planks));
  L.cw.addFloor(x, zc, 1.5, len / 2, 0, y, undefined, 0.1, true);
  for (const sx of [-1.5, 1.5]) L.cw.addBox(x + sx, zc, 0.08, len / 2, 0, y, y + 1, { tag: 'prop', bullet: false, cam: false, sight: false });
}

export function policeCar(L: Level, x: number, z: number, rot: number) {
  const y = L.h(x, z);
  const body: THREE.BufferGeometry[] = [
    tint(place(new THREE.BoxGeometry(1.8, 0.6, 4.4), 0, 0.65, 0), 0x2a3440),
    tint(place(new THREE.BoxGeometry(1.6, 0.55, 2.2), 0, 1.2, 0.2), 0x2a3440),
    tint(place(new THREE.BoxGeometry(1.5, 0.45, 2.0), 0, 1.22, 0.2), 0x1a2028),
    tint(place(new THREE.BoxGeometry(1.82, 0.12, 4.42), 0, 0.72, 0), 0xd8d4c8),
    tint(place(new THREE.BoxGeometry(0.5, 0.12, 0.25), -0.3, 1.52, 0.2), 0x2040c0),
    tint(place(new THREE.BoxGeometry(0.5, 0.12, 0.25), 0.3, 1.52, 0.2), 0xc02020),
  ];
  for (const [wx, wz] of [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]]) body.push(tint(place(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 10), wx, 0.36, wz, 0, 0, Math.PI / 2), 0x151515));
  const g = merge(body);
  g.rotateY(rot);
  g.translate(x, y, z);
  L.batch.add(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), g);
  L.cw.addBox(x, z, 0.95, 2.25, rot, y, y + 1.6, { tag: 'prop' });
  const hl = new THREE.SpotLight(0xfff0d0, 12, 30, 0.45, 0.5, 1.5);
  hl.position.set(x - Math.sin(rot) * 2.3, y + 0.8, z - Math.cos(rot) * 2.3);
  hl.target.position.set(x - Math.sin(rot) * 12, y, z - Math.cos(rot) * 12);
  L.group.add(hl, hl.target);
}

export function scarecrow(L: Level, x: number, z: number, yaw: number) {
  const y = L.h(x, z);
  const g = merge([
    tint(place(new THREE.BoxGeometry(0.1, 2.4, 0.1), 0, 1.2, 0), 0x5a4030),
    tint(place(new THREE.BoxGeometry(1.4, 0.08, 0.08), 0, 1.7, 0), 0x5a4030),
    tint(place(new THREE.BoxGeometry(0.5, 0.7, 0.25), 0, 1.5, 0), 0x6a5a3a),
    tint(place(new THREE.SphereGeometry(0.16, 6, 5), 0, 2.05, 0), 0xb8a070),
    tint(place(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 8), 0, 2.2, 0), 0x9a8050),
    tint(place(new THREE.ConeGeometry(0.14, 0.18, 7), 0, 2.3, 0), 0x9a8050),
  ]);
  g.rotateY(yaw);
  g.translate(x, y, z);
  L.batch.add(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), g);
}

export function cow(L: Level, g: Game, x: number, z: number, yaw: number) {
  const y = L.h(x, z);
  const parts = merge([
    tint(place(new THREE.BoxGeometry(0.7, 0.7, 1.6), 0, 1.0, 0), 0x3a2a20),
    tint(place(new THREE.BoxGeometry(0.72, 0.3, 0.6), 0, 1.2, 0.3), 0xd8d0c0),
    tint(place(new THREE.BoxGeometry(0.4, 0.4, 0.5), 0, 1.25, -1.0), 0x3a2a20),
    tint(place(new THREE.BoxGeometry(0.3, 0.2, 0.2), 0, 1.12, -1.3), 0xc0a090),
    ...[[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]].map(([a, b]) => tint(place(new THREE.BoxGeometry(0.14, 0.7, 0.14), a, 0.35, b), 0x2a2018)),
  ]);
  const m = new THREE.Mesh(parts, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  m.castShadow = true;
  L.group.add(m);
  L.cw.addBox(x, z, 0.4, 0.9, yaw, y, y + 1.4, { tag: 'prop', bullet: true, sight: false });
  let t = rng.range(5, 15);
  L.animated.push((dt, time) => {
    t -= dt;
    m.rotation.z = Math.sin(time * 0.5 + x) * 0.01;
    if (t <= 0) {
      t = rng.range(10, 25);
      g.audio.play('moo', new THREE.Vector3(x, y + 1, z), 0.8, rng.range(0.9, 1.1));
    }
  });
}

export function clothesline(L: Level, x0: number, z0: number, x1: number, z1: number) {
  const y0 = L.h(x0, z0), y1 = L.h(x1, z1);
  L.batch.add(worldMat('darkwood'), place(boxGeo(0.1, 2.2, 0.1, 1), x0, y0 + 1.1, z0));
  L.batch.add(worldMat('darkwood'), place(boxGeo(0.1, 2.2, 0.1, 1), x1, y1 + 1.1, z1));
  const n = 4;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const y = y0 + (y1 - y0) * t + 1.5;
    const cloth = place(boxGeo(0.7, 0.8, 0.02, 1), x, y, z, 0, Math.atan2(-(z1 - z0), x1 - x0), 0);
    L.batch.add(worldMat('cloth', rng.pick([0x8a7a6a, 0x6a6a7a, 0x9a8a6a, 0x7a5a4a])), cloth);
  }
}

export function signPost(L: Level, x: number, z: number, yaw: number) {
  const y = L.h(x, z);
  L.batch.add(worldMat('darkwood'), place(boxGeo(0.12, 2, 0.12, 1), x, y + 1, z));
  L.batch.add(worldMat('wood', 0x9a8060), place(boxGeo(1.2, 0.3, 0.05, 1), x, y + 1.7, z, 0, yaw, 0.08));
}

/** Scatter grass tufts, bushes and rocks in a region, avoiding a predicate. */
export function scatter(L: Level, minX: number, minZ: number, maxX: number, maxZ: number, n: number, avoid: (x: number, z: number) => boolean, kinds: ('grass' | 'bush' | 'rock' | 'dead' | 'pine' | 'hay')[] = ['grass']) {
  for (let i = 0; i < n; i++) {
    const x = rng.range(minX, maxX), z = rng.range(minZ, maxZ);
    if (avoid(x, z)) continue;
    const k = rng.pick(kinds);
    if (k === 'grass') grass(L, x, z);
    else if (k === 'bush') bush(L, x, z, rng.range(0.6, 1.3));
    else if (k === 'rock') rock(L, x, z, rng.range(0.3, 0.9), false);
    else if (k === 'dead') deadTree(L, x, z, rng.range(0.7, 1.1));
    else if (k === 'pine') pine(L, x, z, rng.range(0.8, 1.3));
    else if (k === 'hay') haystack(L, x, z, rng.range(1, 1.5));
  }
}

export { fence };

/** Exterior ladder leaning under an upper-floor window (enemies climb in, player can push it down). */
export function extLadder(L: Level, win: import('../world/level').WindowOpening, dist = 1.3) {
  const bx = win.x + win.nx * dist, bz = win.z + win.nz * dist;
  return makeLadderImpl(L, {
    bx, bz, by: L.h(bx, bz),
    tx: win.x + win.nx * 0.2, tz: win.z + win.nz * 0.2, ty: win.y + 0.95,
    ex: win.x - win.nx * 0.9, ez: win.z - win.nz * 0.9, ey: win.y,
    facing: Math.atan2(win.nx, win.nz), pushable: true, viaWindow: win,
  });
}
