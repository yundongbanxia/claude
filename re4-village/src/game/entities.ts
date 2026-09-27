import * as THREE from 'three';
import { makeEnemyWeapon, makeWeaponModel } from './player/weaponMeshes';
import { ITEMS } from '../data/items';
import { rng } from '../core/rng';
import { angleDiff, damp, yawFromDir } from '../core/math';
import { basicMat, flatMat } from '../render/textures';
import { merge, place, tint } from '../render/geo';
import type { Game } from './game';
import type { Enemy } from './enemies/enemy';
import type { Interactable } from '../world/level';

// ------------------------------------------------------------------ projectiles

export type ProjKind = 'axe' | 'sickle' | 'dynamite' | 'nade' | 'flash';

export class Projectile {
  g: Game;
  kind: ProjKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  obj: THREE.Object3D;
  alive = true;
  fuse: number;
  owner: Enemy | null;
  spin: THREE.Vector3;
  bounces = 0;
  resting = false;
  age = 0;
  deflected = false;

  constructor(g: Game, kind: ProjKind, from: THREE.Vector3, target: THREE.Vector3, owner: Enemy | null, fuse = 2) {
    this.g = g;
    this.kind = kind;
    this.owner = owner;
    this.fuse = fuse;
    this.pos = from.clone();
    const d = target.clone().sub(from);
    const horiz = Math.hypot(d.x, d.z);
    const speed = kind === 'axe' || kind === 'sickle' ? 13 : kind === 'dynamite' ? 10 : 12;
    const T = Math.max(0.35, horiz / speed);
    const grav = 9.8;
    this.vel = new THREE.Vector3(d.x / T, (d.y + 0.5 * grav * T * T) / T, d.z / T);
    if (kind === 'axe' || kind === 'sickle') this.obj = makeEnemyWeapon(kind === 'axe' ? 'hatchet' : 'sickle');
    else if (kind === 'dynamite') this.obj = makeEnemyWeapon('dynamite');
    else this.obj = makeWeaponModel(kind).obj;
    this.obj.position.copy(this.pos);
    this.spin = new THREE.Vector3(kind === 'axe' || kind === 'sickle' ? -14 : rng.range(-8, 8), 0, rng.range(-3, 3));
    if (kind === 'axe' || kind === 'sickle') this.obj.rotation.y = yawFromDir(d.x, d.z);
    g.scene.add(this.obj);
  }

  get shootTarget() {
    return this;
  }

  update(dt: number) {
    const g = this.g;
    this.age += dt;
    const lv = g.level!;
    if (!this.resting) {
      this.vel.y -= 9.8 * dt;
      const step = this.vel.clone().multiplyScalar(dt);
      const len = step.length();
      const hit = len > 0 ? lv.cw.raycast(this.pos, step.clone().divideScalar(len), len + 0.05, 'bullet') : null;
      if (hit) {
        this.pos.addScaledVector(step, hit.t / len);
        if (this.kind === 'axe' || this.kind === 'sickle') {
          g.audio.play('axe_hit_wall', this.pos);
          g.fx.sparks(this.pos, 6);
          this.resting = true;
          this.alive = false;
          setTimeout(() => this.dispose(), 4000);
          return;
        }
        // bounce
        const n = hit.normal;
        const vn = this.vel.dot(n);
        this.vel.addScaledVector(n, -1.6 * vn).multiplyScalar(0.45);
        this.bounces++;
        g.audio.play('item_drop', this.pos, 0.6, 0.6);
        if (this.vel.length() < 1.2) {
          this.resting = true;
          this.vel.set(0, 0, 0);
        }
      } else this.pos.add(step);
      const gy = lv.cw.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.3);
      if (this.pos.y < gy + 0.05) {
        this.pos.y = gy + 0.05;
        if (this.kind === 'axe' || this.kind === 'sickle') {
          this.resting = true;
          this.alive = false;
          g.audio.play('thud', this.pos, 0.3, 1.5);
          setTimeout(() => this.dispose(), 4000);
          return;
        }
        if (Math.abs(this.vel.y) > 1.5) g.audio.play('item_drop', this.pos, 0.5, 0.6);
        this.vel.y = Math.abs(this.vel.y) * 0.3;
        this.vel.x *= 0.6;
        this.vel.z *= 0.6;
        if (this.vel.length() < 1) {
          this.resting = true;
          this.vel.set(0, 0, 0);
        }
      }
      this.obj.rotation.x += this.spin.x * dt;
      this.obj.rotation.z += this.spin.z * dt;
    }
    this.obj.position.copy(this.pos);

    // thrown blades vs player
    if ((this.kind === 'axe' || this.kind === 'sickle') && this.alive && !this.deflected) {
      const p = g.player;
      const c = p.center;
      if (p.alive && c.distanceTo(this.pos) < 0.55) {
        const parry = p.state === 'move' ? p.tryParry(this.pos, false) : null;
        if (parry) {
          this.deflected = true;
          this.vel.set(-this.vel.x * 0.3, 3, -this.vel.z * 0.3);
          g.audio.play(parry === 'perfect' ? 'parry_perfect' : 'parry', this.pos);
          g.fx.sparks(this.pos, 12);
          g.hud.toast(parry === 'perfect' ? '完美格挡!' : '格挡');
        } else if (!p.invulnerable) {
          p.hurt((this.kind === 'axe' ? 190 : 160) * g.enemyDamageMult(), this.pos, 'light');
          this.alive = false;
          this.dispose();
        }
      }
    }
    // fuses
    if (this.kind === 'dynamite' || this.kind === 'nade' || this.kind === 'flash') {
      this.fuse -= dt;
      if (this.kind === 'dynamite' && rng.chance(dt * 40)) g.fx.fuse(this.pos);
      if (this.fuse <= 0) this.detonate();
    }
    if (this.age > 12) {
      this.alive = false;
      this.dispose();
    }
  }

  detonate() {
    if (!this.alive) return;
    this.alive = false;
    const g = this.g;
    if (this.kind === 'flash') g.flashBang(this.pos);
    else g.explode(this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), this.kind === 'nade' ? 5 : 3.8, this.kind === 'nade' ? 900 : 650, this.kind === 'nade' ? 'grenade' : 'dynamite');
    this.dispose();
  }

  /** Shot by the player. */
  onShot() {
    const g = this.g;
    if (this.kind === 'dynamite') this.detonate();
    else if (this.kind === 'axe' || this.kind === 'sickle') {
      this.deflected = true;
      this.vel.set(rng.range(-2, 2), 3, rng.range(-2, 2));
      g.audio.play('metal', this.pos);
      g.fx.sparks(this.pos, 14);
      g.hud.toast('击落!');
    }
  }

  get r() {
    return this.kind === 'dynamite' ? 0.3 : 0.4;
  }

  dispose() {
    this.obj.parent?.remove(this.obj);
  }
}

// ------------------------------------------------------------------ pickups

const pickupGeos = new Map<string, THREE.BufferGeometry>();
function pickupGeo(id: string): THREE.BufferGeometry {
  let g = pickupGeos.get(id);
  if (g) return g;
  const d = ITEMS[id];
  const col = new THREE.Color(d ? d.color : '#c8a040');
  switch (true) {
    case id === 'pesetas':
      g = merge([tint(place(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), 0, 0.01, 0), 0xc8a040), tint(place(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), 0.03, 0.03, 0.02), 0xd8b050), tint(place(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), -0.02, 0.05, -0.01), 0xc0a040)]);
      break;
    case id.startsWith('herb'):
      g = merge([tint(place(new THREE.CylinderGeometry(0.07, 0.06, 0.1, 6), 0, 0.05, 0), 0x6a4a30), tint(place(new THREE.ConeGeometry(0.12, 0.22, 5), 0, 0.2, 0), col)]);
      break;
    case id.startsWith('ammo'):
      g = merge([tint(place(new THREE.BoxGeometry(0.18, 0.1, 0.12), 0, 0.05, 0), col), tint(place(new THREE.BoxGeometry(0.19, 0.02, 0.13), 0, 0.1, 0), 0x3a3a30)]);
      break;
    case id === 'nade' || id === 'flash':
      g = tint(place(new THREE.IcosahedronGeometry(0.07, 0), 0, 0.07, 0), col);
      break;
    case d?.kind === 'treasure':
      g = tint(place(new THREE.OctahedronGeometry(0.08, 0), 0, 0.1, 0), col);
      break;
    case d?.kind === 'weapon':
      g = tint(place(new THREE.BoxGeometry(0.12, 0.08, d!.w * 0.12), 0, 0.04, 0), 0x3a3a3a);
      break;
    case id.startsWith('egg'):
      g = tint(place(new THREE.SphereGeometry(0.05, 6, 5), 0, 0.05, 0, 0, 0, 0, 1, 1.3, 1), col);
      break;
    default:
      g = tint(place(new THREE.BoxGeometry(0.14, 0.12, 0.14), 0, 0.06, 0), col);
  }
  pickupGeos.set(id, g);
  return g;
}
const pickupMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x151008 });

export class Pickup {
  g: Game;
  id: string;
  count: number;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  taken = false;
  glintT = rng.range(0, 1);
  inter: Interactable;
  flag?: string;

  constructor(g: Game, id: string, count: number, pos: THREE.Vector3, flag?: string) {
    this.g = g;
    this.id = id;
    this.count = count;
    this.flag = flag;
    this.pos = pos.clone();
    this.mesh = new THREE.Mesh(pickupGeo(id), pickupMat);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = rng.range(0, 6.28);
    this.mesh.castShadow = true;
    g.scene.add(this.mesh);
    this.inter = {
      x: this.pos.x,
      y: this.pos.y + 0.3,
      z: this.pos.z,
      radius: 1.5,
      yTol: 1.6,
      enabled: true,
      priority: 4,
      prompt: () => (this.taken ? null : '拾取 ' + this.label()),
      use: (gg) => gg.takePickup(this),
    };
  }

  label(): string {
    if (this.id === 'pesetas') return `${this.count} 比塞塔`;
    const d = ITEMS[this.id];
    return d ? (this.count > 1 ? `${d.name} ×${this.count}` : d.name) : this.id;
  }

  update(dt: number) {
    this.glintT -= dt;
    if (this.glintT <= 0) {
      this.glintT = rng.range(0.7, 1.4);
      this.g.fx.glint(this.pos.clone().add(new THREE.Vector3(rng.range(-0.1, 0.1), 0.2, rng.range(-0.1, 0.1))));
    }
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
  }
}

// ------------------------------------------------------------------ animals

const birdMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

export class Animal {
  g: Game;
  kind: 'chicken' | 'crow';
  obj = new THREE.Group();
  body: THREE.Mesh;
  wings: THREE.Mesh[] = [];
  pos: THREE.Vector3;
  vel = new THREE.Vector3();
  yaw = rng.range(0, 6.28);
  alive = true;
  state: 'idle' | 'walk' | 'flee' | 'fly' | 'dead' = 'idle';
  t = 0;
  home: THREE.Vector3;
  eggT = rng.range(40, 90);
  removed = false;

  constructor(g: Game, kind: 'chicken' | 'crow', pos: THREE.Vector3) {
    this.g = g;
    this.kind = kind;
    this.pos = pos.clone();
    this.home = pos.clone();
    const geos: THREE.BufferGeometry[] = [];
    if (kind === 'chicken') {
      geos.push(tint(place(new THREE.BoxGeometry(0.22, 0.2, 0.3), 0, 0.25, 0), 0xe8e0d0));
      geos.push(tint(place(new THREE.BoxGeometry(0.11, 0.14, 0.11), 0, 0.42, -0.14), 0xe8e0d0));
      geos.push(tint(place(new THREE.BoxGeometry(0.03, 0.06, 0.06), 0, 0.5, -0.14), 0xc02020));
      geos.push(tint(place(new THREE.BoxGeometry(0.04, 0.03, 0.06), 0, 0.42, -0.22), 0xd0a030));
      geos.push(tint(place(new THREE.BoxGeometry(0.14, 0.14, 0.08), 0, 0.33, 0.17, 0.5), 0xd8d0c0));
      for (const x of [-0.05, 0.05]) geos.push(tint(place(new THREE.BoxGeometry(0.02, 0.15, 0.02), x, 0.08, 0), 0xd0a030));
    } else {
      geos.push(tint(place(new THREE.BoxGeometry(0.1, 0.1, 0.24), 0, 0.12, 0), 0x151518));
      geos.push(tint(place(new THREE.BoxGeometry(0.08, 0.08, 0.08), 0, 0.17, -0.13), 0x151518));
      geos.push(tint(place(new THREE.ConeGeometry(0.02, 0.07, 4), 0, 0.17, -0.2, -Math.PI / 2), 0x333333));
      geos.push(tint(place(new THREE.BoxGeometry(0.08, 0.02, 0.12), 0, 0.12, 0.16), 0x151518));
    }
    this.body = new THREE.Mesh(merge(geos), birdMat);
    this.body.castShadow = true;
    this.obj.add(this.body);
    if (kind === 'crow') {
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(tint(place(new THREE.BoxGeometry(0.22, 0.015, 0.14), s * 0.11, 0, 0), 0x1a1a1e), birdMat);
        w.position.set(s * 0.04, 0.15, 0);
        this.obj.add(w);
        this.wings.push(w);
      }
    }
    this.obj.position.copy(this.pos);
    g.scene.add(this.obj);
  }

  get r() {
    return this.kind === 'chicken' ? 0.3 : 0.25;
  }

  onShot() {
    this.kill();
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    const g = this.g;
    g.fx.blood(this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), new THREE.Vector3(0, 1, 0), 0.3);
    for (let i = 0; i < 8; i++) g.fx.dust(this.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 1, 0.08);
    g.audio.play(this.kind === 'chicken' ? 'chicken' : 'crow', this.pos, 0.8, 1.3);
    this.state = 'dead';
    const ground = g.level!.cw.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.2);
    if (this.kind === 'crow') {
      const drop = rng.chance(0.5) ? (['pesetas', rng.pick([100, 200, 300])] as [string, number]) : rng.chance(0.5) ? (['ammo_hg', 5] as [string, number]) : null;
      if (drop) g.spawnPickup(drop[0], drop[1], new THREE.Vector3(this.pos.x, ground, this.pos.z));
    } else if (rng.chance(0.4)) g.spawnPickup(rng.chance(0.15) ? 'egg_b' : 'egg_w', 1, new THREE.Vector3(this.pos.x, ground, this.pos.z));
    this.obj.rotation.z = Math.PI / 2;
    this.pos.y = ground;
    this.obj.position.copy(this.pos);
    setTimeout(() => {
      this.removed = true;
    }, 15000);
  }

  update(dt: number) {
    if (!this.alive) return;
    const g = this.g;
    const lv = g.level!;
    this.t += dt;
    const p = g.player;
    const d = this.pos.distanceTo(p.pos);
    if (this.kind === 'chicken') {
      this.eggT -= dt;
      if (this.eggT <= 0 && d > 6) {
        this.eggT = rng.range(60, 120);
        g.spawnPickup(rng.chance(0.08) ? 'egg_gold' : rng.chance(0.3) ? 'egg_b' : 'egg_w', 1, this.pos.clone());
        g.audio.play('chicken', this.pos, 0.6);
      }
      if ((d < 2.2 && p.moveSpeed > 1) || (d < 4 && p.sprinting)) {
        this.state = 'flee';
        this.t = 0;
      }
      if (this.state === 'flee') {
        const away = yawFromDir(this.pos.x - p.pos.x, this.pos.z - p.pos.z);
        this.yaw += angleDiff(this.yaw, away) * damp(8, dt);
        this.vel.set(-Math.sin(this.yaw) * 3, 0, -Math.cos(this.yaw) * 3);
        if (this.t > 1.2) this.state = 'idle';
        if (rng.chance(dt * 3)) g.audio.play('chicken', this.pos, 0.5);
      } else if (this.state === 'walk') {
        this.vel.set(-Math.sin(this.yaw) * 0.6, 0, -Math.cos(this.yaw) * 0.6);
        if (this.t > 1.5) {
          this.state = 'idle';
          this.t = 0;
        }
      } else {
        this.vel.multiplyScalar(0.8);
        if (this.t > rng.range(1.5, 4)) {
          this.state = 'walk';
          this.t = 0;
          const toHome = yawFromDir(this.home.x - this.pos.x, this.home.z - this.pos.z);
          this.yaw = this.pos.distanceTo(this.home) > 5 ? toHome : this.yaw + rng.range(-1.5, 1.5);
        }
        // peck
        this.body.rotation.x = Math.max(0, Math.sin(this.t * 7)) * 0.5;
      }
      const np = { x: this.pos.x + this.vel.x * dt, z: this.pos.z + this.vel.z * dt };
      lv.cw.resolveCircle(np, 0.15, this.pos.y, 0.5);
      this.pos.x = np.x;
      this.pos.z = np.z;
      this.pos.y = lv.cw.groundHeight(np.x, np.z, this.pos.y + 0.3);
      this.obj.position.copy(this.pos);
      this.obj.position.y += Math.abs(Math.sin(this.t * 12)) * 0.03 * Math.min(1, this.vel.length());
      this.obj.rotation.y = this.yaw;
    } else {
      // crow
      if (this.state !== 'fly' && (d < 5 || (p.noise > 20 && d < 30))) {
        this.state = 'fly';
        this.t = 0;
        this.vel.set(rng.range(-2, 2), 3.5, rng.range(-2, 2));
        g.audio.play('crow', this.pos, 0.8);
      }
      if (this.state === 'fly') {
        this.vel.y += dt * 0.5;
        this.pos.addScaledVector(this.vel, dt);
        this.yaw = yawFromDir(this.vel.x, this.vel.z);
        const flap = Math.sin(this.t * 22) * 0.9;
        this.wings[0].rotation.z = flap;
        this.wings[1].rotation.z = -flap;
        if (this.t > 8) this.removed = true;
      } else {
        if (rng.chance(dt * 0.3)) this.yaw += rng.range(-1, 1);
        this.body.rotation.x = Math.sin(this.t * 3) > 0.9 ? 0.4 : 0;
      }
      this.obj.position.copy(this.pos);
      this.obj.rotation.y = this.yaw;
    }
  }

  dispose() {
    this.obj.parent?.remove(this.obj);
  }
}

// ------------------------------------------------------------------ bear trap

const trapGeo = merge([
  tint(place(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 10), 0, 0.015, 0), 0x4a4440),
  tint(place(new THREE.TorusGeometry(0.26, 0.02, 4, 12), 0, 0.05, 0, Math.PI / 2), 0x6a6460),
]);

export class BearTrap {
  g: Game;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  armed = true;
  removed = false;
  constructor(g: Game, pos: THREE.Vector3) {
    this.g = g;
    this.pos = pos.clone();
    this.mesh = new THREE.Mesh(trapGeo, flatMat(0x5a5450));
    this.mesh.position.copy(pos);
    g.scene.add(this.mesh);
  }
  get r() {
    return 0.35;
  }
  onShot() {
    if (!this.armed) return;
    this.snap();
    this.g.hud.toast('捕兽夹已解除');
  }
  snap() {
    this.armed = false;
    this.mesh.scale.set(0.6, 3, 0.6);
    this.g.audio.play('bear_trap', this.pos);
  }
  update() {
    if (!this.armed) return;
    const g = this.g;
    const p = g.player;
    if (p.alive && p.state === 'move' && p.pos.distanceTo(this.pos) < 0.45) {
      this.snap();
      g.trapPlayer();
      return;
    }
    for (const e of g.enemies) {
      if (e.alive && e.solid && e.pos.distanceTo(this.pos) < 0.45) {
        this.snap();
        e.takeDamage({ dmg: 120, zone: 'legL', dir: new THREE.Vector3(0, -1, 0), kind: 'trap' });
        if (e.alive) {
          e.stagger('kneel', 3);
        }
        return;
      }
    }
  }
  dispose() {
    this.mesh.parent?.remove(this.mesh);
  }
}

// ------------------------------------------------------------------ dropped props (enemy weapons)

export class DroppedProp {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  rest = false;
  life = 40;
  constructor(obj: THREE.Object3D, pos: THREE.Vector3, q: THREE.Quaternion) {
    this.obj = obj;
    obj.position.copy(pos);
    obj.quaternion.copy(q);
    this.vel = new THREE.Vector3(rng.range(-1, 1), 1.5, rng.range(-1, 1));
    this.spin = new THREE.Vector3(rng.range(-6, 6), rng.range(-6, 6), rng.range(-6, 6));
  }
  update(dt: number, groundAt: (x: number, z: number, y: number) => number) {
    this.life -= dt;
    if (this.rest) return;
    this.vel.y -= 9.8 * dt;
    this.obj.position.addScaledVector(this.vel, dt);
    this.obj.rotation.x += this.spin.x * dt;
    this.obj.rotation.y += this.spin.y * dt;
    this.obj.rotation.z += this.spin.z * dt;
    const gy = groundAt(this.obj.position.x, this.obj.position.z, this.obj.position.y + 0.3);
    if (this.obj.position.y < gy + 0.05) {
      this.obj.position.y = gy + 0.05;
      this.rest = true;
      this.obj.rotation.set(0, this.obj.rotation.y, Math.PI / 2 - 0.15);
    }
  }
}

// ------------------------------------------------------------------ blue medallion (shooting request)

export class Medallion {
  g: Game;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  alive = true;
  constructor(g: Game, pos: THREE.Vector3, yaw: number) {
    this.g = g;
    this.pos = pos.clone();
    const geo = merge([
      tint(place(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), 0, 0, 0, Math.PI / 2), 0x2040c0),
      tint(place(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 8), 0, 0, 0, Math.PI / 2), 0xa0b0ff),
      tint(place(new THREE.BoxGeometry(0.01, 0.3, 0.01), 0, 0.2, 0), 0x333333),
    ]);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0a1030 }));
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = yaw;
    g.scene.add(this.mesh);
  }
  get r() {
    return 0.2;
  }
  onShot() {
    if (!this.alive) return;
    this.alive = false;
    this.g.audio.play('medal', this.pos);
    this.g.fx.sparks(this.pos, 16);
    this.mesh.visible = false;
    this.g.onMedallion();
  }
  update(t: number) {
    this.mesh.rotation.z = Math.sin(t * 1.3 + this.pos.x) * 0.15;
  }
}

export const glowMat = basicMat(0x60a0ff);
