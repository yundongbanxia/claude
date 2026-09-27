import * as THREE from 'three';
import { getTexture } from './textures';
import { rng } from '../core/rng';

/**
 * GPU-cheap particle pools (one Points draw per blend mode) + instanced decals.
 */
const PVERT = /* glsl */ `
attribute float size;
attribute vec4 pcolor;
varying vec4 vColor;
#include <fog_pars_vertex>
void main() {
  vColor = pcolor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (600.0 / max(0.1, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const PFRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vColor;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
  #include <fog_fragment>
}
`;

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number; grow: number;
  r: number; g: number; b: number; a: number;
  grav: number; drag: number;
  fade: number; // power
  bounce: boolean;
}

class Pool {
  max: number;
  ps: P[] = [];
  geo = new THREE.BufferGeometry();
  pos: Float32Array;
  col: Float32Array;
  siz: Float32Array;
  points: THREE.Points;
  constructor(max: number, additive: boolean, tex: THREE.Texture) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.siz = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: PVERT,
      fragmentShader: PFRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: tex } }]),
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: true,
    });
    (mat.uniforms.map as { value: THREE.Texture }).value = tex;
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 11 : 10;
  }
  spawn(p: P) {
    if (this.ps.length >= this.max) this.ps.shift();
    this.ps.push(p);
  }
  update(dt: number, groundAt: (x: number, z: number) => number) {
    let n = 0;
    const alive: P[] = [];
    for (const p of this.ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy -= p.grav * dt;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vy *= dr;
      p.vz *= dr;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.bounce) {
        const gy = groundAt(p.x, p.z);
        if (p.y < gy + 0.02) {
          p.y = gy + 0.02;
          p.vy = 0;
          p.vx *= 0.5;
          p.vz *= 0.5;
        }
      }
      p.size += p.grow * dt;
      alive.push(p);
      const t = p.life / p.max;
      const i3 = n * 3, i4 = n * 4;
      this.pos[i3] = p.x;
      this.pos[i3 + 1] = p.y;
      this.pos[i3 + 2] = p.z;
      this.col[i4] = p.r;
      this.col[i4 + 1] = p.g;
      this.col[i4 + 2] = p.b;
      this.col[i4 + 3] = p.a * (1 - Math.pow(t, p.fade));
      this.siz[n] = p.size;
      n++;
    }
    this.ps = alive;
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.pcolor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}

class DecalPool {
  mesh: THREE.InstancedMesh;
  i = 0;
  max: number;
  life: Float32Array;
  constructor(max: number, tex: THREE.Texture, color: number, size: number) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      color,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.life = new Float32Array(max);
  }
  add(pos: THREE.Vector3, normal: THREE.Vector3, scale: number) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rng.range(0, Math.PI * 2));
    q.multiply(spin);
    const m = new THREE.Matrix4().compose(pos.clone().addScaledVector(normal, 0.01), q, new THREE.Vector3(scale, scale, scale));
    this.mesh.setMatrixAt(this.i, m);
    this.i = (this.i + 1) % this.max;
    this.mesh.count = Math.min(this.max, this.mesh.count + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() {
    this.mesh.count = 0;
    this.i = 0;
  }
}

interface Chunk {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

export class Effects {
  group = new THREE.Group();
  private normal: Pool;
  private add: Pool;
  private bloodDecals: DecalPool;
  private holes: DecalPool;
  private chunks: Chunk[] = [];
  private chunkGeo = new THREE.TetrahedronGeometry(0.06, 0);
  private chunkMat = new THREE.MeshLambertMaterial({ color: 0x5a0a08, flatShading: true });
  muzzleLight: THREE.PointLight;
  private muzzleT = 0;
  groundAt: (x: number, z: number) => number = () => 0;
  gore = true;

  constructor() {
    const soft = getTexture('soft', false, 64);
    this.normal = new Pool(1600, false, soft);
    this.add = new Pool(900, true, soft);
    this.bloodDecals = new DecalPool(90, getTexture('blood', false, 128), 0xffffff, 1);
    this.holes = new DecalPool(120, getTexture('bullethole', false, 64), 0xffffff, 0.12);
    this.group.add(this.normal.points, this.add.points, this.bloodDecals.mesh, this.holes.mesh);
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 7, 2);
    this.group.add(this.muzzleLight);
  }

  clear() {
    this.normal.ps = [];
    this.add.ps = [];
    this.bloodDecals.clear();
    this.holes.clear();
    for (const c of this.chunks) this.group.remove(c.mesh);
    this.chunks = [];
  }

  update(dt: number) {
    this.normal.update(dt, this.groundAt);
    this.add.update(dt, this.groundAt);
    if (this.muzzleT > 0) {
      this.muzzleT -= dt;
      this.muzzleLight.intensity = this.muzzleT > 0 ? 18 * (this.muzzleT / 0.06) : 0;
    }
    const keep: Chunk[] = [];
    for (const c of this.chunks) {
      c.life -= dt;
      c.v.y -= 9.8 * dt;
      c.mesh.position.addScaledVector(c.v, dt);
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      const gy = this.groundAt(c.mesh.position.x, c.mesh.position.z);
      if (c.mesh.position.y < gy + 0.03) {
        c.mesh.position.y = gy + 0.03;
        c.v.multiplyScalar(0.3);
        c.v.y = Math.abs(c.v.y) * 0.2;
        c.spin.multiplyScalar(0.5);
      }
      if (c.life > 0) keep.push(c);
      else this.group.remove(c.mesh);
    }
    this.chunks = keep;
  }

  private burst(pool: Pool, n: number, o: THREE.Vector3, dir: THREE.Vector3 | null, speed: number, spread: number, base: Partial<P>) {
    for (let i = 0; i < n; i++) {
      const s = speed * rng.range(0.4, 1.1);
      let vx = rng.range(-1, 1) * spread, vy = rng.range(-1, 1) * spread, vz = rng.range(-1, 1) * spread;
      if (dir) {
        vx += dir.x;
        vy += dir.y;
        vz += dir.z;
      }
      const l = Math.hypot(vx, vy, vz) || 1;
      pool.spawn({
        x: o.x, y: o.y, z: o.z,
        vx: (vx / l) * s, vy: (vy / l) * s, vz: (vz / l) * s,
        life: 0, max: 0.5, size: 0.05, grow: 0,
        r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 2, fade: 1, bounce: false,
        ...base,
        ...(base.max ? { max: base.max * rng.range(0.7, 1.3) } : {}),
      });
    }
  }

  blood(o: THREE.Vector3, dir: THREE.Vector3, amount = 1) {
    if (!this.gore) {
      this.burst(this.normal, 6, o, dir, 2, 0.8, { r: 0.5, g: 0.45, b: 0.4, a: 0.7, size: 0.06, max: 0.4, grav: 2 });
      return;
    }
    this.burst(this.normal, Math.round(14 * amount), o, dir, 3.5, 0.7, { r: 0.42, g: 0.02, b: 0.02, a: 0.95, size: 0.05, max: 0.7, grav: 9, drag: 1.5, bounce: true });
    this.burst(this.normal, Math.round(4 * amount), o, dir, 0.8, 0.5, { r: 0.35, g: 0.02, b: 0.02, a: 0.5, size: 0.18, grow: 0.5, max: 0.5, grav: 1 });
  }

  headBurst(o: THREE.Vector3, dir: THREE.Vector3) {
    if (!this.gore) {
      this.burst(this.normal, 20, o, null, 2, 1, { r: 0.4, g: 0.4, b: 0.4, a: 0.7, size: 0.15, grow: 0.8, max: 0.6 });
      return;
    }
    this.burst(this.normal, 40, o, dir, 4.5, 1.0, { r: 0.45, g: 0.02, b: 0.02, a: 1, size: 0.06, max: 0.9, grav: 9, drag: 1.2, bounce: true });
    this.burst(this.normal, 10, o, null, 1.2, 1, { r: 0.3, g: 0.0, b: 0.0, a: 0.6, size: 0.3, grow: 0.9, max: 0.7, grav: 1 });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(this.chunkGeo, this.chunkMat);
      m.position.copy(o);
      m.scale.setScalar(rng.range(0.6, 1.8));
      this.group.add(m);
      this.chunks.push({
        mesh: m,
        v: new THREE.Vector3(rng.range(-2, 2) + dir.x * 2, rng.range(1, 4), rng.range(-2, 2) + dir.z * 2),
        spin: new THREE.Vector3(rng.range(-10, 10), rng.range(-10, 10), 0),
        life: rng.range(3, 6),
      });
    }
  }

  bloodPool(p: THREE.Vector3, scale = 1) {
    if (!this.gore) return;
    this.bloodDecals.add(new THREE.Vector3(p.x, this.groundAt(p.x, p.z) + 0.02, p.z), new THREE.Vector3(0, 1, 0), scale * rng.range(0.7, 1.3));
  }

  bloodSplat(p: THREE.Vector3, n: THREE.Vector3, scale = 0.5) {
    if (!this.gore) return;
    this.bloodDecals.add(p, n, scale);
  }

  impact(p: THREE.Vector3, n: THREE.Vector3, kind: 'wood' | 'stone' | 'dirt' | 'metal') {
    const col = kind === 'dirt' ? [0.45, 0.38, 0.28] : kind === 'wood' ? [0.5, 0.4, 0.28] : [0.55, 0.53, 0.5];
    this.burst(this.normal, 8, p, n, 2.2, 0.8, { r: col[0], g: col[1], b: col[2], a: 0.9, size: 0.035, max: 0.5, grav: 8, bounce: true });
    this.burst(this.normal, 3, p, n, 0.6, 0.6, { r: col[0], g: col[1], b: col[2], a: 0.45, size: 0.15, grow: 0.6, max: 0.8, grav: -0.2 });
    this.burst(this.add, kind === 'metal' || kind === 'stone' ? 7 : 3, p, n, 5, 0.9, { r: 1, g: 0.75, b: 0.4, a: 1, size: 0.025, max: 0.18, grav: 6 });
    if (kind !== 'dirt') this.holes.add(p, n, 1);
  }

  sparks(p: THREE.Vector3, n: number) {
    this.burst(this.add, n, p, null, 4, 1, { r: 1, g: 0.8, b: 0.45, a: 1, size: 0.03, max: 0.3, grav: 7 });
  }

  muzzle(p: THREE.Vector3, dir: THREE.Vector3, big = false) {
    this.burst(this.add, big ? 10 : 5, p, dir, big ? 5 : 3, 0.35, { r: 1, g: 0.72, b: 0.35, a: 1, size: big ? 0.16 : 0.1, max: 0.06, drag: 10 });
    this.burst(this.normal, big ? 5 : 2, p, dir, 1, 0.5, { r: 0.45, g: 0.43, b: 0.4, a: 0.18, size: 0.08, grow: 0.5, max: 0.6, grav: -0.3 });
    this.muzzleLight.position.copy(p);
    this.muzzleT = 0.06;
    this.muzzleLight.intensity = 18;
  }

  explosion(p: THREE.Vector3, r = 1) {
    this.burst(this.add, 50, p, null, 9 * r, 1, { r: 1, g: 0.6, b: 0.25, a: 1, size: 0.35 * r, grow: 1.5, max: 0.35, drag: 5 });
    this.burst(this.add, 30, p, null, 12, 1, { r: 1, g: 0.8, b: 0.4, a: 1, size: 0.04, max: 0.6, grav: 8 });
    this.burst(this.normal, 30, p, new THREE.Vector3(0, 0.6, 0), 3 * r, 1, { r: 0.25, g: 0.23, b: 0.2, a: 0.7, size: 0.6 * r, grow: 2, max: 2.2, grav: -0.8, drag: 1.5 });
    this.burst(this.normal, 25, p, null, 7, 1, { r: 0.3, g: 0.26, b: 0.2, a: 1, size: 0.05, max: 1.2, grav: 9, bounce: true });
    this.muzzleLight.position.copy(p);
    this.muzzleT = 0.25;
  }

  flash(p: THREE.Vector3) {
    this.burst(this.add, 40, p, null, 6, 1, { r: 1, g: 1, b: 1, a: 1, size: 0.6, grow: 3, max: 0.3, drag: 6 });
    this.muzzleLight.position.copy(p);
    this.muzzleT = 0.3;
  }

  dust(p: THREE.Vector3, n = 6, size = 0.3) {
    this.burst(this.normal, n, p, new THREE.Vector3(0, 0.3, 0), 1.2, 1, { r: 0.45, g: 0.4, b: 0.32, a: 0.5, size, grow: 0.8, max: 1.2, grav: -0.1, drag: 2 });
  }

  splinters(p: THREE.Vector3, n = 20) {
    this.burst(this.normal, n, p, new THREE.Vector3(0, 0.5, 0), 4, 1, { r: 0.45, g: 0.34, b: 0.22, a: 1, size: 0.06, max: 1.2, grav: 9, bounce: true });
    this.dust(p, 6, 0.4);
  }

  fire(p: THREE.Vector3, size: number, blue = false) {
    const c = blue ? [0.3, 0.55, 1] : [1, 0.5, 0.15];
    this.add.spawn({
      x: p.x + rng.range(-0.3, 0.3) * size, y: p.y, z: p.z + rng.range(-0.3, 0.3) * size,
      vx: rng.range(-0.2, 0.2), vy: rng.range(1.2, 2.2) * size, vz: rng.range(-0.2, 0.2),
      life: 0, max: rng.range(0.4, 0.8), size: 0.35 * size, grow: -0.3 * size,
      r: c[0], g: c[1], b: c[2], a: 0.9, grav: 0, drag: 0.5, fade: 1.5, bounce: false,
    });
    if (!blue && rng.chance(0.3)) {
      this.normal.spawn({
        x: p.x, y: p.y + 0.8 * size, z: p.z,
        vx: rng.range(-0.2, 0.2), vy: rng.range(0.8, 1.4), vz: rng.range(-0.2, 0.2),
        life: 0, max: 2.5, size: 0.4 * size, grow: 0.6, r: 0.2, g: 0.19, b: 0.18, a: 0.35, grav: -0.1, drag: 0.3, fade: 1, bounce: false,
      });
    }
  }

  fuse(p: THREE.Vector3) {
    this.add.spawn({
      x: p.x, y: p.y, z: p.z, vx: rng.range(-1, 1), vy: rng.range(0.5, 2), vz: rng.range(-1, 1),
      life: 0, max: 0.2, size: 0.03, grow: 0, r: 1, g: 0.8, b: 0.3, a: 1, grav: 4, drag: 1, fade: 1, bounce: false,
    });
  }

  glint(p: THREE.Vector3) {
    this.add.spawn({
      x: p.x, y: p.y, z: p.z, vx: 0, vy: 0.1, vz: 0, life: 0, max: 0.5, size: 0.12, grow: -0.1,
      r: 1, g: 0.95, b: 0.7, a: 0.9, grav: 0, drag: 0, fade: 2, bounce: false,
    });
  }
}
