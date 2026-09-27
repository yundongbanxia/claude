import * as THREE from 'three';
import { buildRig, B, humanHitboxes, type Appearance, type HitBox, type HitZone, type Rig } from '../../anim/rig';
import { Animator, type Clip } from '../../anim/animator';
import { G, S } from '../../anim/clips';
import { angleDiff, approachAngle, clamp, damp, DEG, dist2, yawFromDir } from '../../core/math';
import { rng } from '../../core/rng';
import { makeEnemyWeapon } from '../player/weaponMeshes';
import { basicMat } from '../../render/textures';
import type { Game } from '../game';
import type { NavLink } from '../../world/nav';
import type { Door, Ladder, Shelf, WindowOpening } from '../../world/level';
import type { LoopHandle } from '../../audio/audio';

export type EnemyKind = 'villager' | 'villager_f' | 'pitchfork' | 'thrower' | 'dynamite' | 'torch' | 'salvador';
export type EState =
  | 'idle' | 'work' | 'patrol' | 'shout' | 'chase' | 'attack' | 'throw' | 'light'
  | 'react' | 'down' | 'getup' | 'stunned' | 'grab' | 'dead'
  | 'traverse' | 'door' | 'suplexed' | 'leave' | 'raise' | 'roar' | 'decap' | 'trapped';

export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  z: number;
  yaw?: number;
  state?: 'idle' | 'work' | 'patrol' | 'chase';
  weapon?: string;
  aware?: boolean;
  patrol?: [number, number][];
  hpMul?: number;
  noDrop?: boolean;
  drop?: string;
  tag?: string;
  y?: number;
}

export interface DamageInfo {
  dmg: number;
  zone: HitZone;
  dir: THREE.Vector3;
  kind: 'bullet' | 'shotgun' | 'rifle' | 'kick' | 'knife' | 'explosion' | 'suplex' | 'stealth' | 'fire' | 'fall' | 'trap';
  crit?: boolean;
  pellets?: number;
  point?: THREE.Vector3;
}

const PHRASES_ALERT = ['¡Allí está!', '¡Un forastero!', '¡Cógelo!', '¡Agárrenlo!', '¡Mátalo!'];
const PHRASES_CHASE = ['¡Te voy a hacer pedazos!', '¡Muere!', '¡Detrás de ti!', '¡Cógelo!', '¡Mátalo!', '¡Agárrenlo!'];

const eyeGeo = new THREE.BoxGeometry(0.035, 0.018, 0.01);

function randomLook(kind: EnemyKind): Appearance {
  const shirts = [0x5a5444, 0x4a4a52, 0x6a5a40, 0x3e4a3a, 0x5a4034, 0x6a6458, 0x484038];
  const pants = [0x3a3428, 0x2e2a26, 0x4a4234, 0x33302a, 0x2a2e34];
  const skins = [0xb88a6a, 0xa87a5a, 0xc0957a, 0x9a6e52];
  const hairs = [0x1a1512, 0x2a2018, 0x3a3028, 0x4a4a48, 0x6a6a68];
  const female = kind === 'villager_f';
  const ap: Appearance = {
    skin: rng.pick(skins),
    shirt: female ? rng.pick([0x3a2a2a, 0x2a2a3a, 0x4a3a2a, 0x2a2a28]) : rng.pick(shirts),
    pants: female ? rng.pick([0x2a2226, 0x3a2e2a, 0x222228]) : rng.pick(pants),
    shoes: 0x1e1a16,
    hair: rng.pick(hairs),
    height: female ? rng.range(0.9, 0.97) : rng.range(0.95, 1.07),
    bulk: female ? rng.range(0.9, 0.98) : rng.range(0.95, 1.12),
    female,
    hat: female ? 'scarf' : rng.pick(['cap', 'none', 'straw', 'beret', 'none', 'cap']),
    hatColor: rng.pick([0x3a3834, 0x2a2826, 0x4a4032, 0x8a7a50]),
    beard: !female && rng.chance(0.55),
    hairStyle: female ? 'bun' : rng.pick(['short', 'short', 'bald']),
    apron: female && rng.chance(0.6) ? rng.pick([0x8a8070, 0x6a6458]) : undefined,
    vest: !female && rng.chance(0.4) ? rng.pick([0x2a2622, 0x3a3228, 0x4a3a2a]) : undefined,
  };
  return ap;
}

export class Enemy {
  g: Game;
  kind: EnemyKind;
  rig: Rig;
  anim: Animator;
  hitboxes: HitBox[];
  pos = new THREE.Vector3();
  yaw = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  hp: number;
  maxHp: number;
  state: EState = 'idle';
  stateT = 0;
  radius = 0.3;
  aware = false;
  weapon: string;
  weaponObj: THREE.Object3D | null = null;
  eyes: THREE.Mesh;
  token = false;
  attackCd = 0;
  attackClip: Clip | null = null;
  attackHitDone = false;
  attackKind: 'melee' | 'grab' | 'thrust' | 'swing' | 'chainsaw' | 'sawgrab' = 'melee';
  reaction: string = '';
  reactionDur = 0;
  kickable = false;
  suplexable = false;
  staggerImmune = 0;
  downT = 0;
  thinkT = rng.range(0, 0.3);
  lastSawPlayer = -100;
  lastKnown = new THREE.Vector3();
  spawn: EnemySpawn;
  patrolIdx = 0;
  layer = 0;
  traverse: { link: NavLink; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; kind: string; ladder?: Ladder; phase: number } | null = null;
  doorTarget: Door | null = null;
  shelfTarget: Shelf | null = null;
  holdAngle = rng.range(-1, 1);
  holdDist = rng.range(2.1, 3.0);
  headGone = false;
  corpseT = 0;
  removed = false;
  lit = false;
  fuseT = 0;
  chainsaw: LoopHandle | null = null;
  headStun = 0;
  legStun = 0;
  sgHits = 0;
  roarAt = [0.75, 0.5, 0.25];
  speech = rng.range(4, 10);
  lungeT = 0;
  tag?: string;
  grabDamage = 60;
  lastHitT = -10;
  onDeath: ((e: Enemy) => void) | null = null;
  trapped = 0;
  sinking = 0;
  private stuckT = 0;
  private lastPos = new THREE.Vector3();
  climbing: Ladder | null = null;
  burnT = 0;
  wander = new THREE.Vector3();
  drop: string | undefined;
  noDrop: boolean;
  isSalvador: boolean;

  constructor(g: Game, sp: EnemySpawn) {
    this.g = g;
    this.spawn = sp;
    this.kind = sp.kind;
    this.tag = sp.tag;
    this.isSalvador = sp.kind === 'salvador';
    this.noDrop = !!sp.noDrop;
    this.drop = sp.drop;
    let ap: Appearance;
    if (this.isSalvador) {
      ap = {
        skin: 0xa07a5a, shirt: 0x3a3430, pants: 0x2a2622, shoes: 0x1a1612, hair: 0x6a5a3a,
        height: 1.13, bulk: 1.28, hairStyle: 'bald', apron: 0x5a3a2a,
        extraParts: [
          // burlap sack over head
          { bone: B.head, shape: 'ball', size: [0.125, 0.15, 0.13], pos: [0, 0.12, 0], color: 0x8a7650, seg: 1 },
          { bone: B.head, shape: 'box', size: [0.12, 0.04, 0.02], pos: [0, 0.0, -0.1], color: 0x4a3a28 },
          { bone: B.neck, shape: 'cyl', size: [0.08, 0.085, 0.06], pos: [0, 0.06, 0], color: 0x5a4a30 },
          // bloodstains on apron
          { bone: B.spine, shape: 'box', size: [0.14, 0.12, 0.01], pos: [0.05, 0.05, -0.18], color: 0x4a0a08 },
          { bone: B.hips, shape: 'box', size: [0.18, 0.16, 0.01], pos: [-0.04, -0.15, -0.19], color: 0x3a0806 },
        ],
      };
    } else ap = randomLook(sp.kind);
    this.rig = buildRig(ap);
    this.anim = new Animator(this.rig);
    this.anim.onEvent = (e) => this.onAnimEvent(e);
    this.hitboxes = humanHitboxes(ap.height, ap.bulk);
    this.radius = this.isSalvador ? 0.42 : 0.3;
    const d = g.diff;
    const baseHp = { villager: 400, villager_f: 360, pitchfork: 430, thrower: 400, dynamite: 380, torch: 420, salvador: 3300 }[sp.kind];
    this.maxHp = this.hp = Math.round(baseHp * d.enemyHp * (sp.hpMul ?? 1) * rng.range(0.9, 1.12));
    this.weapon = sp.weapon ?? this.defaultWeapon();
    this.grabDamage = this.isSalvador ? 0 : 60;
    // eyes
    const eyeMat = basicMat(0xff2a10);
    this.eyes = new THREE.Mesh(eyeGeo, eyeMat);
    const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyes.position.set(-0.045 * ap.height, 0.135 * ap.height, -0.112 * ap.height);
    eye2.position.set(0.09 * ap.height, 0, 0);
    this.eyes.add(eye2);
    this.eyes.visible = false;
    if (!this.isSalvador) this.rig.bones[B.head].add(this.eyes);
    this.attachWeapon();
    this.pos.set(sp.x, sp.y ?? g.level!.cw.baseGround(sp.x, sp.z), sp.z);
    this.yaw = sp.yaw ?? rng.range(-Math.PI, Math.PI);
    this.lastPos.copy(this.pos);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    g.scene.add(this.rig.root);
    const st = sp.state ?? 'idle';
    if (sp.aware || st === 'chase') {
      this.aware = true;
      this.setState('chase');
    } else this.setState(st);
    if (this.isSalvador) {
      this.chainsaw = g.audio.chainsaw(this.pos);
    }
  }

  private defaultWeapon(): string {
    switch (this.kind) {
      case 'pitchfork':
        return 'pitchfork';
      case 'thrower':
        return rng.pick(['hatchet', 'sickle']);
      case 'dynamite':
        return 'dynamite';
      case 'torch':
        return 'torch';
      case 'salvador':
        return 'chainsaw';
      case 'villager_f':
        return rng.pick(['none', 'none', 'sickle']);
      default:
        return rng.pick(['sickle', 'axe', 'hatchet', 'none', 'sickle', 'hatchet']);
    }
  }

  private attachWeapon() {
    if (this.weaponObj) {
      this.weaponObj.parent?.remove(this.weaponObj);
      this.weaponObj = null;
    }
    if (this.weapon === 'none') return;
    const w = makeEnemyWeapon(this.weapon === 'dynamite' ? 'dynamite' : this.weapon);
    const hand = this.rig.bones[B.rHand];
    hand.add(w);
    w.position.set(0, -0.07, -0.02);
    if (this.weapon === 'pitchfork') {
      w.rotation.set(-1.25, 0, 0);
      w.position.set(0, -0.06, 0.2);
    } else if (this.weapon === 'chainsaw') {
      w.rotation.set(-1.0, 0, 0);
      w.position.set(-0.1, -0.1, -0.1);
    } else if (this.weapon === 'dynamite') {
      w.rotation.set(-1.2, 0, 0);
      w.visible = false;
    } else w.rotation.set(-0.9, 0, 0);
    this.weaponObj = w;
  }

  get alive() {
    return this.state !== 'dead';
  }
  get solid() {
    return this.alive && this.state !== 'suplexed' && this.state !== 'traverse';
  }
  get headPos(): THREE.Vector3 {
    return this.rig.bones[B.head].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0));
  }
  get center(): THREE.Vector3 {
    return this.rig.bones[B.chest].getWorldPosition(new THREE.Vector3());
  }
  get isDown() {
    return this.state === 'down' || this.state === 'suplexed';
  }
  get stunnedForMelee(): 'kick' | 'suplex' | null {
    if (!this.alive) return null;
    if (this.state === 'react' && (this.reaction === 'staggerHead' || this.reaction === 'kneel') && this.kickable) {
      return this.reaction === 'kneel' ? 'suplex' : 'kick';
    }
    if (this.state === 'stunned' && this.stateT > 0.2) return 'kick';
    return null;
  }

  setState(s: EState) {
    if (this.state === 'grab' && s !== 'grab' && this.g.player.grabbedBy === this) this.g.player.releaseGrab(false);
    this.state = s;
    this.stateT = 0;
    if (s !== 'attack' && s !== 'throw' && s !== 'light') this.releaseToken();
    switch (s) {
      case 'idle':
      case 'patrol':
        this.anim.play(this.isSalvador ? S.idle : G.idle, { fade: 0.3 });
        break;
      case 'work':
        this.anim.play(G.work, { fade: 0.3, speed: rng.range(0.85, 1.1), time: rng.range(0, 1.8) });
        break;
      case 'leave':
        this.anim.play(G.walk, { fade: 0.4, speed: 0.8 });
        break;
    }
  }

  releaseToken() {
    if (this.token) {
      this.token = false;
      this.g.director.releaseToken(this);
    }
  }

  // ------------------------------------------------------------------ perception

  becomeAware(delay = 0, shout = true) {
    if (this.aware || !this.alive) return;
    this.aware = true;
    this.eyes.visible = true;
    this.lastKnown.copy(this.g.player.pos);
    if (this.state === 'idle' || this.state === 'work' || this.state === 'patrol') {
      if (shout && delay <= 0.05 && !this.isSalvador) {
        this.setState('shout');
        this.anim.play(G.shout, { fade: 0.15, restart: true });
        this.faceTo(this.g.player.pos, 1);
        this.g.audio.shout(this.headPos, rng.pick(PHRASES_ALERT), 1, this.kind === 'villager_f');
      } else {
        this.thinkT = delay;
        this.setState('chase');
      }
    }
  }

  private perceive() {
    const g = this.g;
    const p = g.player;
    if (!p.alive) return;
    const d = this.pos.distanceTo(p.pos);
    // hearing
    if (p.noise > 0 && d < p.noise) {
      this.becomeAware(rng.range(0.2, 0.6));
      return;
    }
    const range = this.state === 'work' ? 11 : 17;
    if (d > range) return;
    const toP = yawFromDir(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const fov = this.state === 'work' ? 60 * DEG : 75 * DEG;
    const close = d < (p.crouch ? 1.6 : 3.2);
    if (!close && Math.abs(angleDiff(this.yaw, toP)) > fov) return;
    const eye = this.headPos;
    if (!g.level!.cw.clear(eye, p.center, 'sight')) return;
    // crouching reduces detection range
    if (p.crouch && d > 7 && !close) return;
    this.becomeAware(0);
  }

  // ------------------------------------------------------------------ update

  update(dt: number) {
    const g = this.g;
    this.stateT += dt;
    this.attackCd -= dt;
    this.staggerImmune -= dt;
    this.thinkT -= dt;
    this.headStun = Math.max(0, this.headStun - dt * 0.4);
    this.legStun = Math.max(0, this.legStun - dt * 0.4);
    this.anim.extra.fill(0);
    if (this.burnT > 0) {
      this.burnT -= dt;
      if (rng.chance(dt * 20)) g.fx.fire(this.center, 0.6);
    }

    switch (this.state) {
      case 'idle':
      case 'work':
      case 'patrol':
        this.updateIdle(dt);
        break;
      case 'shout':
        if (this.stateT > 1.0) this.setState('chase');
        this.faceTo(g.player.pos, dt * 5);
        break;
      case 'chase':
        this.updateChase(dt);
        break;
      case 'attack':
        this.updateAttack(dt);
        break;
      case 'throw':
      case 'light':
        this.updateThrow(dt);
        break;
      case 'react':
        this.updateReact(dt);
        break;
      case 'down':
        this.updateDown(dt);
        break;
      case 'getup':
        if (this.anim.finished) this.setState('chase');
        break;
      case 'stunned':
        if (this.stateT > (this.isSalvador ? 3.5 : 4.5)) {
          this.setState('chase');
        }
        break;
      case 'grab':
        this.updateGrab(dt);
        break;
      case 'traverse':
        this.updateTraverse(dt);
        break;
      case 'door':
        this.updateDoor(dt);
        break;
      case 'suplexed':
        if (this.anim.finished && this.stateT > 1.3) {
          this.state = 'down';
          this.stateT = 0.6;
          this.downT = 2.4;
          this.anim.play(G.lieBack, { fade: 0.1 });
        }
        break;
      case 'leave':
        this.updateLeave(dt);
        break;
      case 'raise':
        this.updateRaise(dt);
        break;
      case 'roar':
        if (this.anim.finished) this.setState('chase');
        break;
      case 'decap':
        this.faceTo(g.player.pos, dt * 8);
        break;
      case 'trapped':
        this.trapped -= dt;
        if (this.trapped <= 0) this.setState('chase');
        break;
      case 'dead':
        this.updateDead(dt);
        break;
    }

    // physics
    if (this.state !== 'traverse' && this.state !== 'dead' && this.state !== 'suplexed') this.applyVelocity(dt);
    else if (this.state === 'dead') this.settle(dt);

    // salvador audio
    if (this.chainsaw) {
      this.chainsaw.setPos(this.center);
      const rev = this.state === 'attack' ? 1 : this.state === 'chase' && this.vx * this.vx + this.vz * this.vz > 6 ? 0.6 : this.state === 'decap' ? 1 : 0.1;
      this.chainsaw.set(rev);
    }
    // dynamite fuse
    if (this.lit && this.weaponObj) {
      this.fuseT -= dt;
      if (rng.chance(dt * 30)) this.g.fx.fuse(this.weaponObj.getWorldPosition(new THREE.Vector3()));
      if (this.fuseT <= 0 && this.alive) {
        // blew up in hand
        this.lit = false;
        const p = this.weaponObj.getWorldPosition(new THREE.Vector3());
        this.weaponObj.visible = false;
        g.explode(p, 3.8, 650, 'dynamite');
      }
    }

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    if (this.alive && this.state !== 'traverse' && this.state !== 'grab' && this.aware) this.lookAt(g.player.headPos, 0.7);
    this.anim.update(dt);
    this.rig.root.updateMatrixWorld(true);
  }

  private lookAt(target: THREE.Vector3, w: number) {
    const yawTo = yawFromDir(target.x - this.pos.x, target.z - this.pos.z);
    const d = clamp(angleDiff(this.yaw, yawTo), -1.0, 1.0);
    this.anim.extra[B.head * 3 + 1] += d * w * 0.6;
    this.anim.extra[B.neck * 3 + 1] += d * w * 0.4;
  }

  faceTo(p: THREE.Vector3, rate: number) {
    const t = yawFromDir(p.x - this.pos.x, p.z - this.pos.z);
    this.yaw = approachAngle(this.yaw, t, rate);
  }

  private updateIdle(dt: number) {
    if (this.thinkT <= 0) {
      this.thinkT = 0.2;
      this.perceive();
    }
    if (this.state === 'patrol' && this.spawn.patrol?.length) {
      const pt = this.spawn.patrol[this.patrolIdx % this.spawn.patrol.length];
      const d = dist2(this.pos.x, this.pos.z, pt[0], pt[1]);
      if (d < 0.6) this.patrolIdx++;
      else {
        this.steerTo(pt[0], pt[1], 1.0, dt);
        this.anim.play(G.walk, { speed: 0.75 });
      }
    } else {
      this.vx *= 0.8;
      this.vz *= 0.8;
    }
    if (this.speech > 0) {
      this.speech -= dt;
      if (this.speech <= 0) {
        this.speech = rng.range(6, 14);
        this.g.audio.grunt(this.headPos, 'idle', this.kind === 'villager_f' ? 1.7 : 1);
      }
    }
  }

  // ------------------------------------------------------------------ chase & navigation

  private updateChase(dt: number) {
    const g = this.g;
    const p = g.player;
    if (!p.alive) {
      // gather around the body
      this.vx *= 0.9;
      this.vz *= 0.9;
      this.anim.play(this.isSalvador ? S.idle : G.idle, { fade: 0.3 });
      return;
    }
    if (this.thinkT > 0) {
      this.anim.play(this.isSalvador ? S.idle : G.idle, { fade: 0.3 });
      return;
    }
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const dy = Math.abs(p.pos.y - this.pos.y);
    const sameLevel = dy < 1.2;
    if (this.speech > 0) {
      this.speech -= dt;
      if (this.speech <= 0 && !this.isSalvador) {
        this.speech = rng.range(5, 11);
        if (rng.chance(0.35) && d < 16) g.audio.shout(this.headPos, rng.pick(PHRASES_CHASE), 1, this.kind === 'villager_f');
        else g.audio.grunt(this.headPos, 'idle', this.kind === 'villager_f' ? 1.7 : 1);
      }
    }

    // ranged enemies
    if ((this.kind === 'thrower' || (this.kind === 'dynamite' && this.weapon === 'dynamite')) && sameLevel) {
      const ideal = this.kind === 'dynamite' ? 11 : 9;
      if (d > 5 && d < 17 && this.attackCd <= 0 && g.director.requestRanged(this)) {
        const eye = this.headPos;
        if (g.level!.cw.clear(eye, p.center, 'sight')) {
          this.startThrow();
          return;
        }
        g.director.releaseRanged(this);
      }
      if (d > 5 && d < ideal + 3 && g.level!.cw.clear(this.headPos, p.center, 'sight')) {
        // hold position and strafe a bit
        this.faceTo(p.pos, dt * 5);
        const side = Math.sin(g.time * 0.7 + this.holdAngle * 3) * 0.6;
        this.vx += ((Math.cos(this.yaw) * side) - this.vx) * damp(3, dt);
        this.vz += ((-Math.sin(this.yaw) * side) - this.vz) * damp(3, dt);
        this.anim.play(G.sidestep, { speed: 0.6 });
        return;
      }
    }

    // melee range logic
    const range = this.attackRange();
    if (sameLevel && d < range + 0.2 && this.attackCd <= 0) {
      if (this.token || g.director.requestToken(this)) {
        this.token = true;
        this.startAttack();
        return;
      }
    }
    // close but no token: hold/circle
    if (sameLevel && d < this.holdDist + 0.6 && !this.token && !this.isSalvador) {
      this.faceTo(p.pos, dt * 6);
      const ang = yawFromDir(-dx, -dz) + this.holdAngle * 0.6;
      const tx = p.pos.x + -Math.sin(ang) * this.holdDist, tz = p.pos.z + -Math.cos(ang) * this.holdDist;
      const ex = tx - this.pos.x, ez = tz - this.pos.z;
      const el = Math.hypot(ex, ez);
      const spd = el > 0.3 ? 0.7 : 0;
      this.vx += ((el > 0 ? (ex / el) * spd : 0) - this.vx) * damp(4, dt);
      this.vz += ((el > 0 ? (ez / el) * spd : 0) - this.vz) * damp(4, dt);
      if (spd > 0) this.anim.play(G.walk, { speed: 0.6 });
      else this.anim.play(G.idle, { fade: 0.3 });
      this.holdAngle += Math.sin(g.time * 0.3 + this.maxHp) * dt * 0.1;
      return;
    }
    // navigate via flow field
    const speed = this.isSalvador ? (d < 8 && sameLevel ? 4.4 : 1.35) : d > 9 ? (this.kind === 'villager_f' ? 2.8 : 3.2) : 1.5;
    const moved = this.navigate(dt, speed);
    if (!moved) {
      // direct approach fallback
      if (sameLevel) this.steerTo(p.pos.x, p.pos.z, speed, dt);
      else {
        this.vx *= 0.9;
        this.vz *= 0.9;
      }
    }
    const sp = Math.hypot(this.vx, this.vz);
    const set = this.isSalvador ? S : G;
    if (sp > 2.4) this.anim.play(set.run, { speed: sp / (this.isSalvador ? 4.4 : 3.2) });
    else if (sp > 0.2) this.anim.play(set.walk, { speed: Math.max(0.6, sp / 1.35) });
    else this.anim.play(set.idle, { fade: 0.3 });
    // stuck detection
    if (this.pos.distanceTo(this.lastPos) < 0.02 && sp > 0.5) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastPos.copy(this.pos);
  }

  attackRange(): number {
    if (this.isSalvador) return 2.3;
    if (this.weapon === 'pitchfork') return 2.4;
    if (this.weapon === 'none') return 1.5;
    if (this.weapon === 'axe') return 1.9;
    return 1.75;
  }

  /** Follow the director's flow field. Returns false if no path. */
  private navigate(dt: number, speed: number): boolean {
    const g = this.g;
    const nav = g.level!.nav;
    const field = g.director.field;
    if (!field) return false;
    const floorId = g.level!.cw.floorIdAt(this.pos.x, this.pos.z, this.pos.y);
    this.layer = nav.layerForFloor(floorId);
    let node = nav.node(this.pos.x, this.pos.z, this.layer);
    if (node < 0 || !nav.walkable(node)) node = nav.nearestWalkable(this.pos.x, this.pos.z, this.layer, 2);
    if (node < 0 || !isFinite(field.dist[node])) return false;
    // link?
    if (field.link[node] >= 0) {
      const link = nav.links[field.link[node]];
      const [na] = nav.linkEnds(link);
      const atA = node === na;
      const sx = atA ? link.ax : link.bx, sz = atA ? link.az : link.bz;
      if (dist2(this.pos.x, this.pos.z, sx, sz) < 0.55) {
        this.startTraverse(link, atA);
        return true;
      }
      this.steerTo(sx, sz, Math.min(speed, 2.2), dt);
      return true;
    }
    // look ahead along the chain for smoothing
    let target = node;
    let n = node;
    for (let k = 0; k < 6; k++) {
      const nx = field.next[n];
      if (nx < 0 || field.link[n] >= 0) break;
      const np = nav.nodePos(nx);
      if (np.layer !== this.layer) break;
      // door check
      const door = nav.doorCells.get(nx) as Door | undefined;
      if (door && !door.open && !door.broken) {
        const dd = dist2(this.pos.x, this.pos.z, door.x, door.z);
        if (dd < 1.4) {
          this.startDoor(door);
          return true;
        }
        target = nx;
        break;
      }
      if (!nav.lineWalkable(this.pos.x, this.pos.z, np.x, np.z, this.layer)) break;
      target = nx;
      n = nx;
    }
    if (target === node) {
      const nx = field.next[node];
      if (nx >= 0) target = nx;
      else {
        // at target cell
        return false;
      }
    }
    const tp = nav.nodePos(target);
    this.steerTo(tp.x, tp.z, speed, dt);
    return true;
  }

  steerTo(x: number, z: number, speed: number, dt: number) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      this.vx *= 0.8;
      this.vz *= 0.8;
      return;
    }
    let tx = (dx / d) * speed, tz = (dz / d) * speed;
    // separation
    for (const o of this.g.enemies) {
      if (o === this || !o.solid) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z;
      const od = Math.hypot(ox, oz);
      if (od < 1.0 && od > 1e-4) {
        const f = (1.0 - od) * 2.2;
        tx += (ox / od) * f;
        tz += (oz / od) * f;
      }
    }
    const a = damp(this.isSalvador ? 3 : 6, dt);
    this.vx += (tx - this.vx) * a;
    this.vz += (tz - this.vz) * a;
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 0.2) this.yaw = approachAngle(this.yaw, yawFromDir(this.vx, this.vz), dt * (this.isSalvador ? 4 : 7));
  }

  applyVelocity(dt: number) {
    const lv = this.g.level!;
    const p = { x: this.pos.x + this.vx * dt, z: this.pos.z + this.vz * dt };
    lv.cw.resolveCircle(p, this.radius, this.pos.y, 1.7);
    // player solid
    const pl = this.g.player;
    if (pl.alive && this.solid && pl.state !== 'grabbed') {
      const dx = p.x - pl.pos.x, dz = p.z - pl.pos.z;
      const d = Math.hypot(dx, dz);
      const min = this.radius + 0.34;
      if (d < min && d > 1e-4 && Math.abs(pl.pos.y - this.pos.y) < 1.2) {
        p.x += (dx / d) * (min - d);
        p.z += (dz / d) * (min - d);
      }
    }
    lv.cw.resolveCircle(p, this.radius, this.pos.y, 1.7);
    this.pos.x = p.x;
    this.pos.z = p.z;
    const gy = lv.cw.groundHeight(p.x, p.z, this.pos.y);
    if (gy < this.pos.y - 0.08) {
      this.vy -= 18 * dt;
      this.pos.y = Math.max(gy, this.pos.y + this.vy * dt);
      if (this.pos.y <= gy) this.vy = 0;
    } else {
      this.vy = 0;
      this.pos.y += (gy - this.pos.y) * damp(20, dt);
    }
  }

  private settle(dt: number) {
    const lv = this.g.level!;
    this.vx *= Math.exp(-6 * dt);
    this.vz *= Math.exp(-6 * dt);
    const p = { x: this.pos.x + this.vx * dt, z: this.pos.z + this.vz * dt };
    lv.cw.resolveCircle(p, 0.25, this.pos.y, 1);
    this.pos.x = p.x;
    this.pos.z = p.z;
    const gy = lv.cw.groundHeight(p.x, p.z, this.pos.y);
    if (gy < this.pos.y - 0.05) {
      this.vy -= 18 * dt;
      this.pos.y = Math.max(gy, this.pos.y + this.vy * dt);
    } else this.pos.y = gy;
  }

  // ------------------------------------------------------------------ attacks

  private startAttack() {
    const g = this.g;
    this.state = 'attack';
    this.stateT = 0;
    this.attackHitDone = false;
    this.lungeT = 0;
    let clip: Clip;
    if (this.isSalvador) {
      const d = this.pos.distanceTo(g.player.pos);
      if (d < 1.9 && rng.chance(0.45)) {
        clip = S.grab;
        this.attackKind = 'sawgrab';
      } else {
        clip = S.swing;
        this.attackKind = 'chainsaw';
      }
    } else if (this.weapon === 'none') {
      clip = G.grabLunge;
      this.attackKind = 'grab';
    } else if (this.weapon === 'pitchfork') {
      clip = G.thrust;
      this.attackKind = 'thrust';
    } else if (rng.chance(0.18) && this.kind !== 'torch') {
      clip = G.grabLunge;
      this.attackKind = 'grab';
    } else {
      clip = G.swing;
      this.attackKind = 'swing';
    }
    this.attackClip = clip;
    const speedMul = 1 / Math.max(0.75, g.diff.attackCooldown * 0.25 + 0.75);
    this.anim.play(clip, { fade: 0.12, restart: true, speed: speedMul });
    if (!this.isSalvador) g.audio.grunt(this.headPos, 'attack', this.kind === 'villager_f' ? 1.7 : 1);
    else g.audio.grunt(this.headPos, 'salvador');
    this.vx *= 0.3;
    this.vz *= 0.3;
  }

  private updateAttack(dt: number) {
    const g = this.g;
    const p = g.player;
    const clip = this.attackClip!;
    const hitT = clip.events.find((e) => e.name === 'hit' || e.name === 'grab')?.t ?? clip.duration * 0.6;
    const t = this.anim.time;
    // track target during windup
    if (t < hitT - 0.18) this.faceTo(p.pos, dt * (this.isSalvador ? 3 : 5));
    // lunge forward near the strike
    const lunge = this.attackKind === 'grab' || this.attackKind === 'sawgrab' ? 2.6 : this.attackKind === 'thrust' ? 1.6 : this.attackKind === 'chainsaw' ? 1.8 : 0.9;
    if (t > hitT - 0.28 && t < hitT + 0.05) {
      const d = this.pos.distanceTo(p.pos);
      const f = d > 0.9 ? lunge : 0;
      this.vx = -Math.sin(this.yaw) * f;
      this.vz = -Math.cos(this.yaw) * f;
    } else {
      this.vx *= 0.8;
      this.vz *= 0.8;
    }
    if (this.anim.finished) {
      this.attackCd = rng.range(1.4, 2.6) * g.diff.attackCooldown * g.dda.cooldownMult() * (this.isSalvador ? 0.8 : 1);
      this.setState('chase');
    }
  }

  private onAnimEvent(e: string) {
    const g = this.g;
    if (e === 'step') {
      if (this.isSalvador) g.audio.play('step', this.pos, 0.9, 0.7);
      else if (rng.chance(0.5)) g.audio.play('step', this.pos, 0.35, 0.9);
    }
    if (e === 'land' && this.state !== 'suplexed') g.audio.play('body_fall', this.pos, 0.8);
    if (e === 'land' && this.state === 'suplexed') {
      g.audio.play('kick_hit', this.pos, 1.2);
      g.camera.shake(0.3);
    }
    if (this.state === 'attack' && (e === 'hit' || e === 'grab') && !this.attackHitDone) {
      this.attackHitDone = true;
      this.resolveStrike();
    }
    if (this.state === 'attack' && e === 'windup') {
      if (this.attackKind === 'chainsaw' || this.attackKind === 'sawgrab') g.audio.grunt(this.headPos, 'salvador');
      else g.audio.play('whoosh', this.center, 0.4, 0.7);
    }
    if (this.state === 'throw' && e === 'release') this.releaseThrow();
    if (this.state === 'door' && e === 'bash') this.bashHit();
  }

  private resolveStrike() {
    const g = this.g;
    const p = g.player;
    if (!p.alive) return;
    const d = this.pos.distanceTo(p.pos);
    const dy = Math.abs(p.pos.y - this.pos.y);
    const toP = yawFromDir(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const ang = Math.abs(angleDiff(this.yaw, toP));
    const reach = this.attackRange() + 0.45;
    const arc = this.attackKind === 'chainsaw' ? 95 * DEG : 55 * DEG;
    g.audio.play('whoosh', this.center, 0.7, this.isSalvador ? 0.6 : 0.9);
    if (d > reach || dy > 1.3 || ang > arc) return;
    if (p.state === 'climb') return;
    // chainsaw horizontal swing can be ducked
    if (this.attackKind === 'chainsaw' && p.crouch) {
      g.hud.toast('闪避！');
      return;
    }
    if (p.invulnerable && p.state !== 'grabbed') return;
    const heavy = this.isSalvador;
    const parry = p.state === 'move' ? p.tryParry(this.pos, heavy) : null;
    if (parry) {
      g.onParry(this, parry);
      return;
    }
    const dm = g.enemyDamageMult();
    switch (this.attackKind) {
      case 'grab':
        if (p.state === 'move' || p.state === 'hurt') {
          this.state = 'grab';
          this.stateT = 0;
          this.anim.play(G.grabHold, { fade: 0.1 });
          p.grab(this);
          g.director.onPlayerGrabbed(this);
        }
        break;
      case 'sawgrab':
        if (g.diff.salvadorGrabKills && !g.godMode) {
          this.state = 'decap';
          this.stateT = 0;
          this.anim.play(S.decap, { fade: 0.1 });
          g.onDecapitation(this);
        } else p.hurt(700 * dm, this.pos, 'heavy');
        break;
      case 'chainsaw':
        p.hurt(620 * dm, this.pos, 'heavy');
        g.fx.blood(p.center, new THREE.Vector3(0, 0.5, 0), 2);
        break;
      case 'thrust':
        p.hurt(250 * dm, this.pos, 'light');
        break;
      default: {
        const base = this.weapon === 'axe' ? 280 : this.weapon === 'torch' ? 240 : 220;
        p.hurt(base * dm, this.pos, 'light');
        if (this.weapon === 'torch') g.fx.fire(p.center, 0.8);
      }
    }
  }

  private updateGrab(dt: number) {
    const g = this.g;
    const p = g.player;
    if (p.grabbedBy !== this) {
      this.endGrab();
      return;
    }
    // hold the player at arm's length
    this.faceTo(p.pos, dt * 10);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const tx = p.pos.x - fx * 0.62, tz = p.pos.z - fz * 0.62;
    this.pos.x += (tx - this.pos.x) * damp(10, dt);
    this.pos.z += (tz - this.pos.z) * damp(10, dt);
    this.vx = this.vz = 0;
  }

  endGrab() {
    if (this.state === 'grab') {
      this.attackCd = rng.range(2.5, 4);
      this.setState('chase');
      this.anim.play(G.idle, { fade: 0.2 });
    }
  }

  shove(from: THREE.Vector3, force: number) {
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vx = (dx / d) * force;
    this.vz = (dz / d) * force;
  }

  // ------------------------------------------------------------------ throwing

  private startThrow() {
    const g = this.g;
    this.faceTo(g.player.pos, 10);
    if (this.kind === 'dynamite' && !this.lit) {
      this.state = 'light';
      this.stateT = 0;
      this.anim.play(G.light, { fade: 0.15, restart: true });
      if (this.weaponObj) this.weaponObj.visible = true;
      this.lit = true;
      this.fuseT = 3.2;
      g.audio.play('fuse', this.center);
      return;
    }
    this.state = 'throw';
    this.stateT = 0;
    this.anim.play(G.throw, { fade: 0.12, restart: true });
    if (this.weaponObj) this.weaponObj.visible = true;
    g.audio.grunt(this.headPos, 'attack');
  }

  private updateThrow(dt: number) {
    const g = this.g;
    this.faceTo(g.player.pos, dt * 4);
    this.vx *= 0.8;
    this.vz *= 0.8;
    if (this.state === 'light' && this.anim.finished) {
      this.state = 'throw';
      this.stateT = 0;
      this.anim.play(G.throw, { fade: 0.1, restart: true });
      return;
    }
    if (this.state === 'throw' && this.anim.finished) {
      g.director.releaseRanged(this);
      this.attackCd = rng.range(3, 5) * g.diff.attackCooldown;
      if (this.kind === 'thrower' && this.weaponObj) this.weaponObj.visible = true;
      if (this.kind === 'dynamite' && this.weaponObj) this.weaponObj.visible = false;
      this.setState('chase');
    }
  }

  private releaseThrow() {
    const g = this.g;
    const from = this.rig.bones[B.rHand].getWorldPosition(new THREE.Vector3());
    // lead the target a little
    const p = g.player;
    const target = p.center.clone().add(new THREE.Vector3(p.vx * 0.5, 0, p.vz * 0.5));
    target.x += rng.range(-0.6, 0.6);
    target.z += rng.range(-0.6, 0.6);
    if (this.kind === 'dynamite') {
      g.spawnProjectile('dynamite', from, target, this, Math.max(0.5, this.fuseT));
      this.lit = false;
      if (this.weaponObj) this.weaponObj.visible = false;
    } else {
      g.spawnProjectile(this.weapon === 'sickle' ? 'sickle' : 'axe', from, target, this);
      if (this.weaponObj) this.weaponObj.visible = false;
    }
    g.audio.play('throw', from);
  }

  // ------------------------------------------------------------------ damage & reactions

  takeDamage(info: DamageInfo): boolean {
    const g = this.g;
    if (!this.alive) return false;
    let dmg = info.dmg;
    this.lastHitT = g.time;
    if (!this.aware) {
      this.becomeAware(0, false);
      g.director.alertAround(this.pos, 12);
    }
    const zoneBone = info.zone === 'head' ? B.head : info.zone === 'armL' ? B.lArm : info.zone === 'armR' ? B.rArm : info.zone === 'legL' ? B.lThigh : info.zone === 'legR' ? B.rThigh : B.chest;
    // additive hit reaction: push bone away from shot direction
    const local = info.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw);
    const k = Math.min(1, dmg / 150) * 9;
    this.anim.impulse(zoneBone, -local.z * k, 0, local.x * k);
    if (zoneBone !== B.chest) this.anim.impulse(B.chest, -local.z * k * 0.4, 0, local.x * k * 0.3);

    this.hp -= dmg;
    const killed = this.hp <= 0;
    if (killed) {
      this.die(info);
      return true;
    }
    if (this.isSalvador) {
      this.salvadorReact(info);
      return false;
    }
    if (this.state === 'dead') return true;
    g.audio.grunt(this.headPos, 'pain', this.kind === 'villager_f' ? 1.7 : 1);
    // reactions
    const busyDown = this.state === 'down' || this.state === 'getup' || this.state === 'suplexed' || this.state === 'traverse';
    if (busyDown) return false;
    if (info.kind === 'explosion' || info.kind === 'kick' || (info.kind === 'shotgun' && (info.pellets ?? 0) >= 3 && this.pos.distanceTo(g.player.pos) < 7)) {
      this.knockDown(info.dir, info.kind === 'explosion' ? 5 : info.kind === 'kick' ? 3.5 : 3);
      return false;
    }
    if (this.state === 'grab') {
      if (dmg >= 50) {
        g.player.releaseGrab(true);
        this.stagger('flinch', 0.6);
      }
      return false;
    }
    if (this.state === 'stunned' || this.state === 'trapped') return false;
    switch (info.zone) {
      case 'head':
        if (this.staggerImmune <= 0 || info.kind === 'knife') this.stagger('staggerHead', 1.6);
        else this.stagger('flinch', 0.5);
        break;
      case 'legL':
      case 'legR':
        if (this.staggerImmune <= 0) this.stagger('kneel', 2.0);
        else this.stagger('flinch', 0.5);
        break;
      case 'armR':
      case 'armL':
        if (this.weapon !== 'none' && info.zone === 'armR' && this.weapon !== 'dynamite' && rng.chance(0.55) && info.kind !== 'knife') this.dropWeapon();
        this.stagger(info.zone === 'armR' ? 'armHitR' : 'armHitL', 0.65);
        break;
      default:
        if (dmg >= 80 || rng.chance(0.65) || this.state === 'attack' || this.state === 'throw') this.stagger('flinch', 0.5);
    }
    return false;
  }

  private salvadorReact(info: DamageInfo) {
    const g = this.g;
    const frac = this.hp / this.maxHp;
    if (this.state === 'down' || this.state === 'getup' || this.state === 'decap') return;
    if (info.kind === 'explosion' || info.kind === 'kick') {
      this.knockDown(info.dir, 2.2);
      this.downT = info.kind === 'kick' ? 2.8 : 2.0;
      return;
    }
    if (info.kind === 'shotgun' && (info.pellets ?? 0) >= 4 && this.pos.distanceTo(g.player.pos) < 6) {
      this.sgHits++;
      if (this.sgHits >= 2) {
        this.sgHits = 0;
        this.knockDown(info.dir, 2.2);
        this.downT = 2.2;
        return;
      }
      this.stagger('flinch', 0.55);
      return;
    }
    if (info.zone === 'head') {
      this.headStun += 1;
      if (this.headStun >= 3 && this.staggerImmune <= 0) {
        this.headStun = 0;
        this.stagger('staggerHead', 1.8);
        return;
      }
    }
    if (info.zone === 'legL' || info.zone === 'legR') {
      this.legStun += 1;
      if (this.legStun >= 4 && this.staggerImmune <= 0) {
        this.legStun = 0;
        this.stagger('kneel', 2.2);
        return;
      }
    }
    if (this.roarAt.length && frac < this.roarAt[0]) {
      this.roarAt.shift();
      this.state = 'roar';
      this.stateT = 0;
      this.anim.play(S.roar, { fade: 0.1, restart: true });
      g.audio.grunt(this.headPos, 'salvador');
      this.releaseToken();
    }
  }

  stagger(kind: string, dur: number) {
    if (!this.alive) return;
    if (this.state === 'grab' && this.g.player.grabbedBy === this) this.g.player.releaseGrab(true);
    this.lit = this.kind === 'dynamite' ? this.lit : false;
    this.state = 'react';
    this.stateT = 0;
    this.reaction = kind;
    this.reactionDur = dur;
    this.kickable = false;
    this.releaseToken();
    this.g.director.releaseRanged(this);
    const clip = (G as Record<string, Clip>)[kind] ?? G.flinch;
    this.anim.play(clip, { fade: 0.06, restart: true, speed: clip.duration / Math.max(0.3, dur) });
    this.vx *= 0.2;
    this.vz *= 0.2;
    if (kind === 'staggerHead' || kind === 'kneel') {
      const back = kind === 'staggerHead' ? 1.2 : 0.4;
      this.vx += Math.sin(this.yaw) * back;
      this.vz += Math.cos(this.yaw) * back;
    }
  }

  private updateReact(dt: number) {
    const t = this.stateT;
    const dur = this.reactionDur;
    this.vx *= Math.exp(-5 * dt);
    this.vz *= Math.exp(-5 * dt);
    if (this.reaction === 'staggerHead') this.kickable = t > 0.12 && t < dur * 0.92;
    else if (this.reaction === 'kneel') this.kickable = t > 0.22 && t < dur * 0.8;
    else this.kickable = false;
    if (t >= dur) {
      if (this.reaction === 'staggerHead' || this.reaction === 'kneel') this.staggerImmune = 0.9;
      this.attackCd = Math.max(this.attackCd, rng.range(0.4, 1.0));
      this.setState('chase');
    }
  }

  knockDown(dir: THREE.Vector3, force: number) {
    if (!this.alive) return;
    if (this.state === 'grab' && this.g.player.grabbedBy === this) this.g.player.releaseGrab(true);
    this.releaseToken();
    this.g.director.releaseRanged(this);
    this.state = 'down';
    this.stateT = 0;
    this.downT = rng.range(1.6, 2.6);
    // fall backward along dir: face opposite to dir
    const fromBehind = Math.abs(angleDiff(this.yaw, yawFromDir(dir.x, dir.z))) < Math.PI / 2;
    this.anim.play(fromBehind ? G.fallFront : G.fallBack, { fade: 0.05, restart: true });
    this.reaction = fromBehind ? 'front' : 'back';
    this.vx = dir.x * force;
    this.vz = dir.z * force;
    if (this.lit && this.kind === 'dynamite') {
      // drops lit dynamite
      this.lit = false;
      const p = this.weaponObj?.getWorldPosition(new THREE.Vector3()) ?? this.center;
      if (this.weaponObj) this.weaponObj.visible = false;
      this.g.spawnProjectile('dynamite', p, p.clone().add(new THREE.Vector3(rng.range(-1, 1), -1, rng.range(-1, 1))), this, Math.max(0.3, this.fuseT));
    }
  }

  private updateDown(dt: number) {
    this.vx *= Math.exp(-4 * dt);
    this.vz *= Math.exp(-4 * dt);
    const front = this.reaction === 'front';
    if (this.stateT > 0.65 && (this.anim.clipName === 'fallBack' || this.anim.clipName === 'fallFront')) this.anim.play(front ? G.lieFront : G.lieBack, { fade: 0.1 });
    if (this.stateT > 0.65 + this.downT) {
      this.state = 'getup';
      this.stateT = 0;
      this.anim.play(front ? G.getUpFront : G.getUpBack, { fade: 0.1, restart: true, speed: this.isSalvador ? 0.8 : 1 });
      this.staggerImmune = 1;
    }
  }

  stun(dur = 4.5) {
    if (!this.alive || this.state === 'down' || this.state === 'suplexed') return;
    if (this.state === 'grab' && this.g.player.grabbedBy === this) this.g.player.releaseGrab(true);
    this.releaseToken();
    this.state = 'stunned';
    this.stateT = 0;
    this.anim.play(G.stunned, { fade: 0.1 });
    this.vx = this.vz = 0;
    void dur;
  }

  private dropWeapon() {
    if (!this.weaponObj) return;
    const wp = this.weaponObj.getWorldPosition(new THREE.Vector3());
    const wq = this.weaponObj.getWorldQuaternion(new THREE.Quaternion());
    this.weaponObj.parent?.remove(this.weaponObj);
    this.g.dropProp(this.weaponObj, wp, wq);
    this.weaponObj = null;
    this.weapon = 'none';
    this.g.audio.play('metal', wp, 0.6);
  }

  die(info: DamageInfo) {
    const g = this.g;
    if (this.state === 'dead') return;
    const wasHeld = g.player.grabbedBy === this;
    this.state = 'dead';
    this.stateT = 0;
    this.hp = 0;
    this.releaseToken();
    g.director.releaseRanged(this);
    if (wasHeld) g.player.releaseGrab(true);
    this.eyes.visible = false;
    this.vx = info.dir.x * (info.kind === 'explosion' ? 5 : info.kind === 'shotgun' ? 3 : info.kind === 'kick' ? 3 : 1);
    this.vz = info.dir.z * (info.kind === 'explosion' ? 5 : info.kind === 'shotgun' ? 3 : info.kind === 'kick' ? 3 : 1);
    const headKill = info.zone === 'head' && (info.kind === 'bullet' || info.kind === 'rifle' || info.kind === 'shotgun');
    if (headKill && (info.crit || rng.chance(this.isSalvador ? 0 : 0.35) || info.kind === 'rifle' || info.kind === 'shotgun')) this.explodeHead(info.dir);
    if (this.chainsaw) {
      this.chainsaw.stop();
      this.chainsaw = null;
    }
    if (this.lit && this.weaponObj) {
      // lit dynamite drops
      this.lit = false;
      const p = this.weaponObj.getWorldPosition(new THREE.Vector3());
      this.weaponObj.visible = false;
      g.spawnProjectile('dynamite', p, p.clone().add(new THREE.Vector3(0, -1, 0)), this, Math.max(0.3, this.fuseT));
    }
    if (this.state === 'dead' && (info.kind === 'explosion' || info.kind === 'kick' || info.kind === 'shotgun')) {
      const fromBehind = Math.abs(angleDiff(this.yaw, yawFromDir(info.dir.x, info.dir.z))) < Math.PI / 2;
      this.anim.play(fromBehind ? G.fallFront : G.fallBack, { fade: 0.05, restart: true });
    } else if (info.kind === 'stealth') this.anim.play(G.stealthDie, { fade: 0.05, restart: true });
    else if (info.kind !== 'suplex') this.anim.play(G.dieCollapse, { fade: 0.08, restart: true });
    g.audio.grunt(this.headPos, this.isSalvador ? 'salvador' : 'death', this.kind === 'villager_f' ? 1.7 : 1);
    if (this.weaponObj && this.weapon !== 'chainsaw' && rng.chance(0.7)) this.dropWeapon();
    g.onEnemyKilled(this, info);
    this.onDeath?.(this);
  }

  explodeHead(dir: THREE.Vector3) {
    if (this.headGone) return;
    this.headGone = true;
    const hp = this.headPos;
    this.rig.bones[B.head].scale.setScalar(0.001);
    this.g.fx.headBurst(hp, dir);
    this.g.audio.play('head_burst', hp);
  }

  private updateDead(dt: number) {
    this.corpseT += dt;
    if (this.corpseT > 25) {
      this.sinking += dt * 0.25;
      this.rig.body.position.y -= this.sinking * dt;
      if (this.sinking > 0.5) this.removed = true;
    }
    if (this.corpseT > 0.9 && this.corpseT - dt <= 0.9) this.g.fx.bloodPool(this.pos, this.headGone ? 1.4 : 0.9);
  }

  // ------------------------------------------------------------------ traversal

  private startTraverse(link: NavLink, atA: boolean) {
    const g = this.g;
    const from = atA ? new THREE.Vector3(link.ax, link.ay, link.az) : new THREE.Vector3(link.bx, link.by, link.bz);
    const to = atA ? new THREE.Vector3(link.bx, link.by, link.bz) : new THREE.Vector3(link.ax, link.ay, link.az);
    if (link.type === 'window') {
      const w = link.ref as WindowOpening;
      if (w.barricade && !w.barricade.destroyed && w.barricade.pushed) {
        this.shelfTarget = w.barricade;
        this.state = 'door';
        this.stateT = 0;
        this.doorTarget = null;
        this.anim.play(G.bash, { fade: 0.15 });
        return;
      }
      from.y = this.pos.y;
      to.y = g.level!.cw.groundHeight(to.x, to.z, w.y + 0.5);
      this.traverse = { link, t: 0, dur: 1.0, from: this.pos.clone(), to, kind: 'window', phase: 0 };
      this.anim.play(G.vault, { fade: 0.1, restart: true });
      this.yaw = yawFromDir(to.x - from.x, to.z - from.z);
      if (!w.broken && w.glass) {
        w.broken = true;
        w.glass.visible = false;
        g.audio.play('glass', this.center);
      }
    } else if (link.type === 'ladder') {
      const l = link.ref as Ladder;
      const up = atA;
      if (l.down) {
        if (up) {
          // raise the ladder back up
          this.state = 'raise';
          this.stateT = 0;
          this.climbing = l;
          this.anim.play(G.bash, { fade: 0.2 });
          return;
        }
        return;
      }
      this.traverse = {
        link, t: 0, dur: Math.abs(l.ty - l.by) / 1.3 + 0.9,
        from: up ? new THREE.Vector3(l.bx, l.by, l.bz) : new THREE.Vector3(l.ex, l.ey, l.ez),
        to: up ? new THREE.Vector3(l.ex, l.ey, l.ez) : new THREE.Vector3(l.bx, l.by, l.bz),
        kind: up ? 'ladderUp' : 'ladderDown', ladder: l, phase: 0,
      };
      l.users++;
      this.climbing = l;
      this.anim.play(G.climb, { fade: 0.15 });
      this.yaw = l.facing;
    } else {
      this.traverse = { link, t: 0, dur: from.distanceTo(to) / 1.5, from: this.pos.clone(), to, kind: 'walk', phase: 0 };
    }
    this.state = 'traverse';
    this.stateT = 0;
    this.releaseToken();
  }

  private updateTraverse(dt: number) {
    const tr = this.traverse;
    if (!tr) {
      this.setState('chase');
      return;
    }
    tr.t += dt;
    const u = Math.min(1, tr.t / tr.dur);
    if (tr.kind === 'window') {
      this.pos.lerpVectors(tr.from, tr.to, u);
      this.pos.y = tr.from.y + (tr.to.y - tr.from.y) * u + Math.sin(u * Math.PI) * 0.9;
    } else if (tr.kind === 'ladderUp' || tr.kind === 'ladderDown') {
      const l = tr.ladder!;
      if (l.down) {
        // fell off
        this.fallOffLadder();
        return;
      }
      const base = new THREE.Vector3(l.bx, l.by, l.bz), top = new THREE.Vector3(l.tx, l.ty, l.tz), exit = new THREE.Vector3(l.ex, l.ey, l.ez);
      const pts = tr.kind === 'ladderUp' ? [base, top, exit] : [exit, top, base];
      const split = 0.8;
      if (tr.kind === 'ladderUp') {
        if (u < split) {
          this.pos.lerpVectors(pts[0], pts[1], u / split);
          this.pos.x += Math.sin(l.facing) * 0.35;
          this.pos.z += Math.cos(l.facing) * 0.35;
          this.anim.play(G.climb);
        } else {
          this.pos.lerpVectors(pts[1], pts[2], (u - split) / (1 - split));
          if (this.anim.clipName !== 'vault') this.anim.play(G.vault, { fade: 0.1, restart: true });
        }
      } else {
        if (u < 1 - split) {
          this.pos.lerpVectors(pts[0], pts[1], u / (1 - split));
          if (this.anim.clipName !== 'vault') this.anim.play(G.vault, { fade: 0.1, restart: true });
        } else {
          this.pos.lerpVectors(pts[1], pts[2], (u - (1 - split)) / split);
          this.pos.x += Math.sin(l.facing) * 0.35;
          this.pos.z += Math.cos(l.facing) * 0.35;
          this.anim.play(G.climb, { speed: -1 });
        }
      }
      this.yaw = l.facing;
    } else {
      this.pos.lerpVectors(tr.from, tr.to, u);
    }
    if (u >= 1) {
      if (tr.ladder) {
        tr.ladder.users = Math.max(0, tr.ladder.users - 1);
        this.climbing = null;
      }
      this.pos.copy(tr.to);
      this.traverse = null;
      this.vx = this.vz = 0;
      this.setState('chase');
    }
  }

  fallOffLadder() {
    const tr = this.traverse;
    if (tr?.ladder) tr.ladder.users = Math.max(0, tr.ladder.users - 1);
    this.traverse = null;
    this.climbing = null;
    this.pos.y = Math.max(this.pos.y, 0);
    this.state = 'down';
    this.stateT = 0;
    this.downT = 2.5;
    this.anim.play(G.fallBack, { fade: 0.05, restart: true });
    this.reaction = 'back';
    this.g.audio.grunt(this.headPos, 'pain');
    this.hp -= 120;
    if (this.hp <= 0) this.die({ dmg: 0, zone: 'torso', dir: new THREE.Vector3(0, -1, 0), kind: 'fall' });
  }

  private updateRaise(dt: number) {
    const l = this.climbing;
    this.vx *= 0.8;
    this.vz *= 0.8;
    if (!l) {
      this.setState('chase');
      return;
    }
    this.faceTo(new THREE.Vector3(l.tx, 0, l.tz), dt * 5);
    l.raiseTimer += dt;
    if (l.raiseTimer > 3.2) {
      l.raiseTimer = 0;
      l.down = false;
      if (l.link) l.link.enabled = true;
      this.climbing = null;
      this.g.audio.play('thud', new THREE.Vector3(l.tx, l.ty, l.tz), 0.6);
      this.setState('chase');
    }
  }

  // ------------------------------------------------------------------ doors / barricades

  private startDoor(door: Door) {
    this.doorTarget = door;
    this.shelfTarget = door.barricade && door.barricade.pushed && !door.barricade.destroyed ? door.barricade : null;
    this.state = 'door';
    this.stateT = 0;
    this.releaseToken();
    if (this.shelfTarget || door.locked) this.anim.play(G.bash, { fade: 0.15 });
    else this.anim.play(G.idle, { fade: 0.15 });
  }

  private updateDoor(dt: number) {
    const g = this.g;
    const door = this.doorTarget;
    this.vx *= 0.7;
    this.vz *= 0.7;
    if (door) this.faceTo(new THREE.Vector3(door.x, 0, door.z), dt * 6);
    if (this.shelfTarget) {
      if (this.shelfTarget.destroyed) {
        this.shelfTarget = null;
        this.setState('chase');
      }
      return; // bash events handle damage
    }
    if (!door) {
      this.setState('chase');
      return;
    }
    if (door.open || door.broken) {
      this.setState('chase');
      return;
    }
    if (door.locked) {
      // bash locked doors down
      return;
    }
    if (this.stateT > 0.5) {
      g.openDoor(door, this.pos);
      this.setState('chase');
    }
  }

  private bashHit() {
    const g = this.g;
    if (this.shelfTarget) {
      const s = this.shelfTarget;
      s.hp -= 30;
      g.audio.play('door_bash', s.mesh.position);
      s.mesh.rotation.z = rng.range(-0.04, 0.04);
      if (s.hp <= 0) g.destroyShelf(s);
    } else if (this.doorTarget && this.doorTarget.locked) {
      const d = this.doorTarget;
      d.hp -= 30;
      g.audio.play('door_bash', new THREE.Vector3(d.x, d.y + 1, d.z));
      if (d.hp <= 0) g.breakDoor(d);
    }
  }

  // ------------------------------------------------------------------ bell / leaving

  leave(target: THREE.Vector3) {
    if (!this.alive) return;
    if (this.state === 'grab') this.g.player.releaseGrab(true);
    this.releaseToken();
    this.wander.copy(target);
    this.state = 'leave';
    this.stateT = rng.range(-2.5, -0.5);
    this.anim.play(this.isSalvador ? S.idle : G.idle, { fade: 0.4 });
    if (this.weaponObj && this.weapon !== 'chainsaw' && rng.chance(0.5)) this.dropWeapon();
    this.lit = false;
  }

  private updateLeave(dt: number) {
    if (this.stateT < 0) {
      this.vx *= 0.9;
      this.vz *= 0.9;
      this.anim.extra[B.head * 3] -= 0.4;
      return;
    }
    const field = this.g.director.leaveField;
    const nav = this.g.level!.nav;
    let moved = false;
    if (field) {
      const node = nav.nearestWalkable(this.pos.x, this.pos.z, 0, 2);
      if (node >= 0 && field.next[node] >= 0) {
        let t = field.next[node];
        for (let k = 0; k < 4 && field.next[t] >= 0; k++) t = field.next[t];
        const p = nav.nodePos(t);
        this.steerTo(p.x, p.z, 1.1, dt);
        moved = true;
      }
    }
    if (!moved) this.steerTo(this.wander.x, this.wander.z, 1.1, dt);
    this.anim.play(this.isSalvador ? S.walk : G.walk, { speed: 0.85 });
    this.anim.extra[B.head * 3] -= 0.35;
    if (this.pos.distanceTo(this.wander) < 3 || this.stateT > 40) {
      this.removed = true;
      if (this.chainsaw) {
        this.chainsaw.stop();
        this.chainsaw = null;
      }
    }
  }

  dispose() {
    this.rig.root.parent?.remove(this.rig.root);
    this.rig.mesh.geometry.dispose();
    this.chainsaw?.stop();
    this.chainsaw = null;
    if (this.weaponObj) this.weaponObj.parent?.remove(this.weaponObj);
  }
}
