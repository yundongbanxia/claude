import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometry helpers. World geometry uses meter-scaled UVs so tiled textures
 * keep a constant density regardless of object size.
 */

/** Box with UVs scaled so one texture repeat covers `uvScale` meters. */
export function boxGeo(w: number, h: number, d: number, uvScale = 2): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let su: number, sv: number;
    if (nx > 0.5) {
      su = d; sv = h;
    } else if (ny > 0.5) {
      su = w; sv = d;
    } else {
      su = w; sv = h;
    }
    uv.setXY(i, (uv.getX(i) * su) / uvScale, (uv.getY(i) * sv) / uvScale);
  }
  return g;
}

/** Transform a geometry in place (position + euler + scale) and return it. */
export function place(
  g: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  g.applyMatrix4(m);
  return g;
}

/** Merge geometries that may have differing attribute sets (drops extras). */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geos.length === 0) return new THREE.BufferGeometry();
  const norm = geos.map((g) => {
    let gg = g.index ? g.toNonIndexed() : g;
    if (!gg.attributes.uv) {
      const count = gg.attributes.position.count;
      gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (!gg.attributes.normal) gg.computeVertexNormals();
    for (const k of Object.keys(gg.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') gg.deleteAttribute(k);
    }
    return gg;
  });
  const hasColor = norm.some((g) => !!g.attributes.color);
  if (hasColor) {
    for (const g of norm) {
      if (!g.attributes.color) {
        const c = new Float32Array(g.attributes.position.count * 3).fill(1);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
    }
  } else {
    for (const g of norm) if (g.attributes.color) g.deleteAttribute('color');
  }
  const out = mergeGeometries(norm, false);
  if (!out) throw new Error('merge failed');
  return out;
}

/** Paint a flat vertex color over a geometry. */
export function tint(g: THREE.BufferGeometry, color: number | THREE.Color): THREE.BufferGeometry {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Collects geometry per material and builds one mesh per material. */
export class GeoBatch {
  private groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, g: THREE.BufferGeometry) {
    let arr = this.groups.get(mat);
    if (!arr) this.groups.set(mat, (arr = []));
    arr.push(g);
  }
  build(parent: THREE.Object3D, castShadow = true, receiveShadow = true): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, geos] of this.groups) {
      if (!geos.length) continue;
      const mesh = new THREE.Mesh(merge(geos), mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      out.push(mesh);
      for (const g of geos) g.dispose();
    }
    this.groups.clear();
    return out;
  }
}

/** A gable roof prism: ridge along X, width w (X), depth d (Z), height h. Centered at origin, base at y=0. */
export function gableRoofGeo(w: number, d: number, h: number, overhang = 0.4, uvScale = 2): THREE.BufferGeometry {
  const hw = w / 2 + overhang, hd = d / 2 + overhang;
  const slope = Math.hypot(hd, h);
  const thick = 0.12;
  const geos: THREE.BufferGeometry[] = [];
  const ang = Math.atan2(h, hd);
  for (const s of [-1, 1]) {
    const g = boxGeo(hw * 2, thick, slope, uvScale);
    place(g, 0, h / 2, (s * hd) / 2, s * ang, 0, 0);
    geos.push(g);
  }
  return merge(geos);
}

/** Triangular gable wall piece (in XY plane, facing +Z), width w, height h. */
export function gableGeo(w: number, h: number, thickness = 0.2, uvScale = 2): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / uvScale, uv.getY(i) / uvScale);
  return g;
}

export function cylGeo(rTop: number, rBot: number, h: number, seg = 7, uvScale = 2): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const circ = Math.PI * 2 * Math.max(rTop, rBot);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / uvScale, (uv.getY(i) * h) / uvScale);
  return g;
}
