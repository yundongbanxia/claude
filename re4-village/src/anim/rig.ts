import * as THREE from 'three';

/**
 * Low-poly humanoid built as ONE SkinnedMesh with rigid (weight=1) skinning.
 * Every body part is bound to a single bone, which keeps characters to a
 * single draw call while still allowing full procedural/keyframe animation.
 *
 * Conventions: characters face -Z, right hand is +X, Y up.
 */
export const enum B {
  hips, spine, chest, neck, head,
  lArm, lFore, lHand, rArm, rFore, rHand,
  lThigh, lShin, lFoot, rThigh, rShin, rFoot,
}
export const BONE_COUNT = 17;
export const BONE_NAMES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'lArm', 'lFore', 'lHand', 'rArm', 'rFore', 'rHand',
  'lThigh', 'lShin', 'lFoot', 'rThigh', 'rShin', 'rFoot',
] as const;
export type BoneName = (typeof BONE_NAMES)[number];
export const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];
/** Mirror partner for each bone (for mirrored animation keys). */
export const MIRROR = [0, 1, 2, 3, 4, 8, 9, 10, 5, 6, 7, 14, 15, 16, 11, 12, 13];

const BIND_OFFSETS: [number, number, number][] = [
  [0, 0.95, 0], // hips
  [0, 0.12, 0], // spine
  [0, 0.2, 0], // chest
  [0, 0.25, 0], // neck
  [0, 0.08, 0], // head
  [-0.2, 0.2, 0], // lArm
  [0, -0.29, 0], // lFore
  [0, -0.26, 0], // lHand
  [0.2, 0.2, 0], // rArm
  [0, -0.29, 0], // rFore
  [0, -0.26, 0], // rHand
  [-0.1, -0.04, 0], // lThigh
  [0, -0.43, 0], // lShin
  [0, -0.42, 0], // lFoot
  [0.1, -0.04, 0], // rThigh
  [0, -0.43, 0], // rShin
  [0, -0.42, 0], // rFoot
];

export type Shape = 'box' | 'cyl' | 'ball' | 'cone' | 'wedge';
export interface Part {
  bone: B;
  shape: Shape;
  /** box: w,h,d ; cyl: rTop,rBot,h ; ball: rx,ry,rz ; cone: r,h */
  size: [number, number, number];
  pos: [number, number, number];
  rot?: [number, number, number];
  color: number;
  seg?: number;
}

export interface Appearance {
  skin: number;
  shirt: number;
  sleeve?: number; // defaults to shirt
  pants: number;
  shoes: number;
  hair: number;
  height: number; // scale factor ~1
  bulk: number; // width factor ~1
  female?: boolean;
  hat?: 'cap' | 'straw' | 'beret' | 'scarf' | 'none';
  hatColor?: number;
  beard?: boolean;
  apron?: number;
  vest?: number;
  hairStyle?: 'short' | 'bald' | 'bun' | 'leon' | 'long';
  extraParts?: Part[];
}

function partGeometry(p: Part): THREE.BufferGeometry {
  const [a, b, c] = p.size;
  let g: THREE.BufferGeometry;
  switch (p.shape) {
    case 'box':
      g = new THREE.BoxGeometry(a, b, c);
      break;
    case 'cyl':
      g = new THREE.CylinderGeometry(a, b, c, p.seg ?? 6, 1);
      break;
    case 'ball':
      g = new THREE.IcosahedronGeometry(1, p.seg ?? 1);
      g.scale(a, b, c);
      break;
    case 'cone':
      g = new THREE.ConeGeometry(a, b, p.seg ?? 7, 1);
      break;
    case 'wedge': {
      // a triangular prism (for noses / collars)
      const s = new THREE.Shape();
      s.moveTo(-a / 2, 0);
      s.lineTo(a / 2, 0);
      s.lineTo(0, b);
      s.closePath();
      g = new THREE.ExtrudeGeometry(s, { depth: c, bevelEnabled: false });
      g.translate(0, 0, -c / 2);
      break;
    }
  }
  if (p.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.rot[0], p.rot[1], p.rot[2])));
  g.translate(p.pos[0], p.pos[1], p.pos[2]);
  return g.index ? g.toNonIndexed() : g;
}

export function humanParts(ap: Appearance): Part[] {
  const k = ap.bulk;
  const sleeve = ap.sleeve ?? ap.shirt;
  const P: Part[] = [];
  const add = (bone: B, shape: Shape, size: [number, number, number], pos: [number, number, number], color: number, rot?: [number, number, number], seg?: number) =>
    P.push({ bone, shape, size, pos, color, rot, seg });

  // torso
  add(B.hips, 'box', [0.34 * k, 0.22, 0.21 * k], [0, -0.02, 0], ap.pants);
  add(B.spine, 'box', [0.31 * k, 0.22, 0.19 * k], [0, 0.1, 0], ap.shirt);
  add(B.chest, 'box', [0.36 * k, 0.26, 0.22 * k], [0, 0.11, 0], ap.shirt);
  add(B.chest, 'wedge', [0.34 * k, 0.07, 0.18 * k], [0, 0.24, 0], ap.shirt); // trapezius slope
  add(B.chest, 'ball', [0.085 * k, 0.07, 0.1 * k], [-0.19 * k, 0.21, 0], ap.shirt, undefined, 0); // shoulders
  add(B.chest, 'ball', [0.085 * k, 0.07, 0.1 * k], [0.19 * k, 0.21, 0], ap.shirt, undefined, 0);
  if (ap.female) add(B.chest, 'box', [0.3 * k, 0.1, 0.06], [0, 0.1, -0.12 * k], ap.shirt);
  // neck & head
  add(B.neck, 'cyl', [0.052, 0.06, 0.12], [0, 0.04, 0], ap.skin);
  add(B.head, 'ball', [0.105, 0.13, 0.115], [0, 0.12, 0], ap.skin, undefined, 1);
  add(B.head, 'box', [0.13, 0.07, 0.1], [0, 0.03, -0.035], ap.skin); // jaw
  add(B.head, 'wedge', [0.04, 0.05, 0.04], [0, 0.085, -0.115], ap.skin, [0, 0, 0]); // nose
  add(B.head, 'box', [0.045, 0.022, 0.02], [-0.045, 0.135, -0.1], 0x140c08); // eye sockets
  add(B.head, 'box', [0.045, 0.022, 0.02], [0.045, 0.135, -0.1], 0x140c08);
  add(B.head, 'box', [0.12, 0.02, 0.02], [0, 0.155, -0.105], darken(ap.hair, 0.8)); // brow
  // hair
  const hs = ap.hairStyle ?? 'short';
  if (hs === 'short' || hs === 'leon' || hs === 'bun' || hs === 'long') {
    add(B.head, 'ball', [0.112, 0.08, 0.12], [0, 0.19, 0.01], ap.hair, undefined, 1);
    add(B.head, 'box', [0.2, 0.12, 0.05], [0, 0.13, 0.095], ap.hair);
  }
  if (hs === 'leon') {
    add(B.head, 'box', [0.1, 0.1, 0.05], [0.03, 0.17, -0.1], ap.hair, [0.3, 0, -0.35]); // fringe
    add(B.head, 'box', [0.03, 0.08, 0.09], [-0.1, 0.13, -0.02], ap.hair);
    add(B.head, 'box', [0.03, 0.08, 0.09], [0.1, 0.13, -0.02], ap.hair);
  }
  if (hs === 'bun') add(B.head, 'ball', [0.06, 0.06, 0.06], [0, 0.2, 0.12], ap.hair, undefined, 0);
  if (hs === 'long') add(B.head, 'box', [0.2, 0.28, 0.06], [0, 0.02, 0.1], ap.hair);
  if (ap.beard) add(B.head, 'box', [0.14, 0.09, 0.08], [0, 0.03, -0.075], ap.hair);
  switch (ap.hat) {
    case 'cap':
      add(B.head, 'cyl', [0.12, 0.125, 0.06], [0, 0.23, 0], ap.hatColor ?? 0x3a3a38, undefined, 8);
      add(B.head, 'box', [0.2, 0.015, 0.1], [0, 0.205, -0.12], ap.hatColor ?? 0x3a3a38);
      break;
    case 'straw':
      add(B.head, 'cyl', [0.24, 0.26, 0.02], [0, 0.21, 0], ap.hatColor ?? 0xa08a50, undefined, 9);
      add(B.head, 'cyl', [0.1, 0.12, 0.1], [0, 0.26, 0], ap.hatColor ?? 0xa08a50, undefined, 8);
      break;
    case 'beret':
      add(B.head, 'ball', [0.13, 0.04, 0.13], [0.01, 0.235, 0], ap.hatColor ?? 0x222226, undefined, 1);
      break;
    case 'scarf':
      add(B.head, 'ball', [0.12, 0.1, 0.13], [0, 0.17, 0.01], ap.hatColor ?? 0x4a3a3a, undefined, 1);
      add(B.head, 'box', [0.22, 0.2, 0.06], [0, 0.07, 0.1], ap.hatColor ?? 0x4a3a3a);
      break;
  }
  // arms
  for (const [arm, fore, hand] of [
    [B.lArm, B.lFore, B.lHand],
    [B.rArm, B.rFore, B.rHand],
  ] as const) {
    add(arm, 'cyl', [0.062 * k, 0.052 * k, 0.3], [0, -0.14, 0], sleeve);
    add(fore, 'cyl', [0.05 * k, 0.042, 0.27], [0, -0.13, 0], ap.female ? ap.skin : sleeve);
    add(hand, 'box', [0.075, 0.1, 0.05], [0, -0.05, -0.01], ap.skin);
    add(hand, 'box', [0.03, 0.05, 0.03], [arm === B.lArm ? 0.04 : -0.04, -0.03, -0.03], ap.skin); // thumb
  }
  // legs
  for (const [thigh, shin, foot] of [
    [B.lThigh, B.lShin, B.lFoot],
    [B.rThigh, B.rShin, B.rFoot],
  ] as const) {
    add(thigh, 'cyl', [0.088 * k, 0.066 * k, 0.44], [0, -0.21, 0], ap.pants);
    add(shin, 'cyl', [0.064 * k, 0.05, 0.42], [0, -0.21, 0], ap.pants);
    add(foot, 'box', [0.1, 0.08, 0.25], [0, -0.03, -0.06], ap.shoes);
  }
  if (ap.female) {
    add(B.hips, 'cone', [0.3 * k, 0.55, 0.3], [0, -0.3, 0], ap.pants, undefined, 8);
  }
  if (ap.apron !== undefined) {
    add(B.spine, 'box', [0.3 * k, 0.3, 0.02], [0, 0.02, -0.105 * k], ap.apron);
    add(B.hips, 'box', [0.32 * k, 0.4, 0.02], [0, -0.2, -0.115 * k], ap.apron);
  }
  if (ap.vest !== undefined) {
    add(B.chest, 'box', [0.39 * k, 0.26, 0.235 * k], [0, 0.12, 0.004], ap.vest);
    add(B.spine, 'box', [0.33 * k, 0.2, 0.205 * k], [0, 0.1, 0.004], ap.vest);
  }
  if (ap.extraParts) P.push(...ap.extraParts);
  return P;
}

function darken(c: number, f: number): number {
  const col = new THREE.Color(c);
  col.multiplyScalar(f);
  return col.getHex();
}

export const characterMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

export interface Rig {
  /** Positioned/rotated by gameplay (feet on ground, yaw). */
  root: THREE.Object3D;
  /** Child of root: animated root channels (drop, pitch, spin). */
  body: THREE.Object3D;
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  /** Bind-pose local offsets (scaled). */
  bindPos: THREE.Vector3[];
  height: number;
  bulk: number;
}

export function buildRig(ap: Appearance, material: THREE.Material = characterMaterial): Rig {
  const s = ap.height;
  const bones: THREE.Bone[] = [];
  const bindPos: THREE.Vector3[] = [];
  const worldPos: THREE.Vector3[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const b = new THREE.Bone();
    b.name = BONE_NAMES[i];
    const o = BIND_OFFSETS[i];
    // arms/legs spread with bulk
    const wx = i === B.lArm || i === B.rArm || i === B.lThigh || i === B.rThigh ? ap.bulk : 1;
    const v = new THREE.Vector3(o[0] * s * wx, o[1] * s, o[2] * s);
    b.position.copy(v);
    bindPos.push(v.clone());
    bones.push(b);
    const p = PARENT[i];
    worldPos.push(p >= 0 ? worldPos[p].clone().add(v) : v.clone());
    if (p >= 0) bones[p].add(b);
  }

  const parts = humanParts(ap);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const skinIdx: number[] = [];
  const skinW: number[] = [];
  const col = new THREE.Color();
  for (const p of parts) {
    const g = partGeometry(p);
    // scale part by height factor (limb lengths) – widths already use bulk
    g.scale(s, s, s);
    const wp = worldPos[p.bone];
    g.translate(wp.x, wp.y, wp.z);
    g.computeVertexNormals();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    col.setHex(p.color);
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(col.r, col.g, col.b);
      skinIdx.push(p.bone, 0, 0, 0);
      skinW.push(1, 0, 0, 0);
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIdx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinW, 4));

  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const root = new THREE.Object3D();
  const body = new THREE.Object3D();
  root.add(body);
  body.add(mesh);
  return { root, body, mesh, bones, bindPos, height: s, bulk: ap.bulk };
}

/** Box hitboxes in bone-local space for bullet raycasts. */
export type HitZone = 'head' | 'torso' | 'armL' | 'armR' | 'legL' | 'legR';
export interface HitBox {
  bone: B;
  zone: HitZone;
  center: THREE.Vector3;
  half: THREE.Vector3;
}

export function humanHitboxes(scale: number, bulk: number): HitBox[] {
  const hb = (bone: B, zone: HitZone, c: [number, number, number], h: [number, number, number]): HitBox => ({
    bone,
    zone,
    center: new THREE.Vector3(c[0] * scale, c[1] * scale, c[2] * scale),
    half: new THREE.Vector3(h[0] * scale, h[1] * scale, h[2] * scale),
  });
  const k = bulk;
  return [
    hb(B.head, 'head', [0, 0.11, -0.01], [0.12, 0.15, 0.13]),
    hb(B.chest, 'torso', [0, 0.12, 0], [0.22 * k, 0.17, 0.13 * k]),
    hb(B.spine, 'torso', [0, 0.1, 0], [0.18 * k, 0.12, 0.12 * k]),
    hb(B.hips, 'torso', [0, -0.03, 0], [0.18 * k, 0.12, 0.12 * k]),
    hb(B.lArm, 'armL', [0, -0.14, 0], [0.07, 0.16, 0.07]),
    hb(B.lFore, 'armL', [0, -0.14, 0], [0.06, 0.16, 0.06]),
    hb(B.rArm, 'armR', [0, -0.14, 0], [0.07, 0.16, 0.07]),
    hb(B.rFore, 'armR', [0, -0.14, 0], [0.06, 0.16, 0.06]),
    hb(B.lThigh, 'legL', [0, -0.21, 0], [0.09, 0.23, 0.09]),
    hb(B.lShin, 'legL', [0, -0.21, 0], [0.07, 0.23, 0.07]),
    hb(B.rThigh, 'legR', [0, -0.21, 0], [0.09, 0.23, 0.09]),
    hb(B.rShin, 'legR', [0, -0.21, 0], [0.07, 0.23, 0.07]),
  ];
}

const _inv = new THREE.Matrix4();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

/**
 * Ray vs hitboxes. Returns nearest hit distance/zone or null.
 * `origin`/`dir` in world space, dir normalized.
 */
export function raycastHitboxes(
  bones: THREE.Bone[],
  boxes: HitBox[],
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
): { t: number; zone: HitZone; box: HitBox } | null {
  let best: { t: number; zone: HitZone; box: HitBox } | null = null;
  for (const hbx of boxes) {
    const bone = bones[hbx.bone];
    _inv.copy(bone.matrixWorld).invert();
    _o.copy(origin).applyMatrix4(_inv).sub(hbx.center);
    _d.copy(dir).transformDirection(_inv);
    // transformDirection normalizes; matrices are rigid so distances preserved
    let tmin = 0, tmax = maxDist;
    let hit = true;
    for (let a = 0; a < 3; a++) {
      const o = a === 0 ? _o.x : a === 1 ? _o.y : _o.z;
      const d = a === 0 ? _d.x : a === 1 ? _d.y : _d.z;
      const h = a === 0 ? hbx.half.x : a === 1 ? hbx.half.y : hbx.half.z;
      if (Math.abs(d) < 1e-8) {
        if (o < -h || o > h) {
          hit = false;
          break;
        }
      } else {
        let t1 = (-h - o) / d, t2 = (h - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) {
          hit = false;
          break;
        }
      }
    }
    if (hit && (!best || tmin < best.t)) best = { t: tmin, zone: hbx.zone, box: hbx };
  }
  return best;
}
