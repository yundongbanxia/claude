import * as THREE from 'three';
import { buildRig, B, humanHitboxes, type Rig, type HitBox } from '../../anim/rig';
import { Animator, R_Y, type Clip } from '../../anim/animator';
import { L } from '../../anim/clips';
import { angleDiff, approachAngle, clamp, damp, DEG, lerp, wrapAngle, yawFromDir } from '../../core/math';
import { rng } from '../../core/rng';
import { WEAPONS, wCap, wRate, wReload, type WeaponDef } from '../../data/weapons';
import type { ItemInst } from '../inventory';
import type { Ladder, WindowOpening } from '../../world/level';
import { makeWeaponModel, type WeaponModel } from './weaponMeshes';
import type { Game } from '../game';
import type { Enemy } from '../enemies/enemy';

export type PState = 'move' | 'action' | 'hurt' | 'down' | 'grabbed' | 'dead' | 'climb' | 'locked';

interface Action {
  name: string;
  clip: Clip;
  dur: number;
  t: number;
  upper: boolean;
  invuln: boolean;
  onEvent?: (e: string) => void;
  onEnd?: () => void;
  update?: (dt: number, t: number) => void;
  lockMove: boolean;
}

export const KNIFE_MAX = 1000;

export class Player {
  g: Game;
  rig: Rig;
  anim: Animator;
  hitboxes: HitBox[];
  pos = new THREE.Vector3();
  vx = 0;
  vz = 0;
  vy = 0;
  yaw = 0;
  hp = 1000;
  maxHp = 1000;
  state: PState = 'move';
  stateT = 0;
  aiming = false;
  crouch = false;
  sprinting = false;
  moveSpeed = 0;
  action: Action | null = null;
  invuln = 0;
  // weapons
  weaponUid: number | null = null;
  private models = new Map<string, WeaponModel>();
  private knifeModel: WeaponModel;
  fireCd = 0;
  reloadT = -1;
  reloadDur = 0;
  private shellMode = false;
  spread = 3;
  focusT = 0;
  switchT = 0;
  knife = KNIFE_MAX;
  // knife guard/slash
  guard = false;
  guardT = 0;
  slashT = -1;
  parryWindowT = -1;
  // grabbed
  grabbedBy: Enemy | null = null;
  grabProgress = 0;
  grabDmgAcc = 0;
  // climbing
  private climb: { ladder: Ladder; up: boolean; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; phase: 'climb' | 'vault' } | null = null;
  quickTurn = 0;
  private quickTurnFrom = 0;
  /** caught in a bear trap: can't move */
  trapT = 0;
  noise = 0;
  aimPoint = new THREE.Vector3();
  aimHitEnemy: Enemy | null = null;
  aimHitZone = '';
  lastHurtT = -10;
  dead = false;
  deathKind: 'normal' | 'decap' = 'normal';
  private stepSide = 0;
  onFloor = -1;
  kills = 0;
  private legYaw = 0;
  hurtDir = 0;

  constructor(g: Game) {
    this.g = g;
    this.rig = buildRig({
      skin: 0xd0a482,
      shirt: 0x4a3322,
      sleeve: 0x4a3322,
      pants: 0x2a3140,
      shoes: 0x241c16,
      hair: 0x9a7040,
      height: 1.0,
      bulk: 1.02,
      hairStyle: 'leon',
      extraParts: [
        // fur collar
        { bone: B.chest, shape: 'box', size: [0.3, 0.07, 0.22], pos: [0, 0.29, 0.03], color: 0x8a6a48 },
        { bone: B.neck, shape: 'cyl', size: [0.09, 0.11, 0.08], pos: [0, 0.0, 0.01], color: 0x8a6a48 },
        // shirt showing at front
        { bone: B.chest, shape: 'box', size: [0.14, 0.24, 0.02], pos: [0, 0.12, -0.11], color: 0x2a2c30 },
        // holster straps
        { bone: B.chest, shape: 'box', size: [0.05, 0.28, 0.24], pos: [-0.12, 0.12, 0.0], color: 0x1c1612 },
        { bone: B.hips, shape: 'box', size: [0.36, 0.06, 0.23], pos: [0, 0.06, 0], color: 0x1c1612 },
        { bone: B.rThigh, shape: 'box', size: [0.1, 0.16, 0.14], pos: [0.07, -0.12, 0], color: 0x1c1612 },
        // knife sheath on chest
        { bone: B.chest, shape: 'box', size: [0.05, 0.16, 0.03], pos: [-0.1, 0.1, -0.13], color: 0x1a1a1a },
      ],
    });
    this.anim = new Animator(this.rig);
    this.hitboxes = humanHitboxes(1, 1.02);
    this.anim.play(L.idle);
    this.anim.onEvent = (e) => this.onAnimEvent(e);
    this.knifeModel = makeWeaponModel('knife');
    this.knifeModel.obj.visible = false;
    this.rig.bones[B.rHand].add(this.knifeModel.obj);
    this.knifeModel.obj.position.set(0, -0.08, -0.02);
    this.knifeModel.obj.rotation.set(-Math.PI / 2, 0, 0);
  }

  get weapon(): ItemInst | undefined {
    return this.g.inv.byUid(this.weaponUid);
  }
  get wdef(): WeaponDef | null {
    const w = this.weapon;
    return w?.weapon ? WEAPONS[w.weapon.id] : null;
  }
  get alive() {
    return this.state !== 'dead';
  }
  get busy() {
    return this.state !== 'move';
  }
  get center(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + (this.crouch ? 0.7 : 1.0), this.pos.z);
  }
  get headPos(): THREE.Vector3 {
    return this.rig.bones[B.head].getWorldPosition(new THREE.Vector3());
  }

  place(x: number, z: number, yaw: number) {
    this.pos.set(x, this.g.level ? this.g.level.cw.baseGround(x, z) : 0, z);
    this.yaw = yaw;
    this.g.camera.yaw = yaw;
    this.g.camera.pitch = -0.08;
    this.vx = this.vz = this.vy = 0;
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = yaw;
  }

  reset() {
    this.state = 'move';
    this.action = null;
    this.grabbedBy = null;
    this.climb = null;
    this.reloadT = -1;
    this.guard = false;
    this.slashT = -1;
    this.aiming = false;
    this.dead = false;
    this.invuln = 1;
    this.anim.play(L.idle, { fade: 0 });
    this.anim.playUpper(null);
    this.rig.bones[B.head].scale.setScalar(1);
  }

  equip(uid: number | null) {
    if (uid === this.weaponUid) return;
    this.weaponUid = uid;
    this.reloadT = -1;
    this.switchT = 0.35;
    const w = this.weapon;
    for (const [, m] of this.models) m.obj.visible = false;
    if (w?.weapon) {
      this.model(w.weapon.id).obj.visible = true;
      this.spread = WEAPONS[w.weapon.id].spreadMax;
      this.g.audio.play('slide', undefined, 0.5);
    }
  }

  private model(id: string): WeaponModel {
    let m = this.models.get(id);
    if (!m) {
      m = makeWeaponModel(id);
      this.models.set(id, m);
      this.g.scene.add(m.obj);
    }
    return m;
  }

  /** Start a committed action. */
  doAction(a: Omit<Action, 't' | 'dur' | 'upper' | 'invuln' | 'lockMove'> & Partial<Pick<Action, 'dur' | 'upper' | 'invuln' | 'lockMove'>>) {
    this.action = {
      t: 0,
      dur: a.dur ?? a.clip.duration,
      upper: a.upper ?? false,
      invuln: a.invuln ?? false,
      lockMove: a.lockMove ?? true,
      ...a,
    } as Action;
    if (this.action.upper) this.anim.playUpper(a.clip, { restart: true });
    else {
      this.anim.play(a.clip, { fade: 0.1, restart: true });
      this.anim.playUpper(null);
    }
    if (!this.action.upper) this.state = 'action';
    this.reloadT = -1;
    this.aiming = false;
    this.guard = false;
  }

  private onAnimEvent(e: string) {
    if (e === 'step') {
      this.stepSide ^= 1;
      const wood = this.onFloor >= 0 || this.g.level?.cw.floorIdAt(this.pos.x, this.pos.z, this.pos.y) !== -1;
      this.g.audio.play(wood ? 'step_wood' : 'step', this.pos, this.sprinting ? 1 : this.crouch ? 0.3 : 0.6);
    }
    if (this.action?.onEvent) this.action.onEvent(e);
  }

  // ------------------------------------------------------------------ update

  update(dt: number) {
    const g = this.g;
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.switchT = Math.max(0, this.switchT - dt);
    this.noise = 0;
    this.anim.extra.fill(0);

    // regen (assisted)
    if (g.diff.regen && this.alive && this.hp < this.maxHp * 0.34 && g.time - this.lastHurtT > 6) this.hp = Math.min(this.maxHp * 0.34, this.hp + 12 * dt);

    switch (this.state) {
      case 'move':
        this.updateMove(dt);
        break;
      case 'action':
        this.updateAction(dt);
        this.applyVelocity(dt, 0);
        break;
      case 'hurt':
        if (this.stateT > 0.45) this.toMove();
        this.applyVelocity(dt, 8);
        break;
      case 'down':
        this.updateDown(dt);
        this.applyVelocity(dt, 5);
        break;
      case 'grabbed':
        this.updateGrabbed(dt);
        break;
      case 'climb':
        this.updateClimb(dt);
        break;
      case 'dead':
        this.applyVelocity(dt, 6);
        break;
      case 'locked':
        this.applyVelocity(dt, 10);
        break;
    }
    if (this.action && this.action.upper) this.updateAction(dt);

    // knife slash / guard timers
    if (this.slashT >= 0) {
      const before = this.slashT;
      this.slashT += dt;
      if (before < 0.13 && this.slashT >= 0.13 && this.anim.upperClip === 'knifeSlash') this.g.knifeSlashHit();
      if (this.slashT > 0.42) {
        this.slashT = -1;
        if (this.guard) this.anim.playUpper(L.knifeGuard);
        else this.anim.playUpper(null);
      }
    }
    if (this.parryWindowT >= 0) this.parryWindowT += dt;
    if (this.guard) this.guardT += dt;

    // animation & visuals
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.anim.update(dt);
    this.rig.root.updateMatrixWorld(true);
    this.updateWeaponVisual();
  }

  private toMove() {
    this.state = 'move';
    this.stateT = 0;
    this.action = null;
  }

  private moveInput(): { x: number; z: number; mag: number } {
    const inp = this.g.input;
    let x = 0, z = 0;
    if (inp.isDown('forward')) z += 1;
    if (inp.isDown('back')) z -= 1;
    if (inp.isDown('right')) x += 1;
    if (inp.isDown('left')) x -= 1;
    const mag = Math.hypot(x, z);
    if (mag > 1) {
      x /= mag;
      z /= mag;
    }
    return { x, z, mag: Math.min(1, mag) };
  }

  private updateMove(dt: number) {
    const g = this.g;
    const inp = g.input;
    const cam = g.camera;
    const w = this.weapon;
    const wd = this.wdef;

    // quick turn (back + sprint)
    if (this.quickTurn > 0) {
      this.quickTurn -= dt;
      const t = 1 - Math.max(0, this.quickTurn) / 0.3;
      const target = this.quickTurnFrom + Math.PI * t;
      const d = angleDiff(cam.yaw, target);
      cam.yaw += d;
      this.yaw = target;
    } else if (inp.pressed('sprint') && inp.isDown('back') && !inp.isDown('forward') && !this.aiming) {
      this.quickTurn = 0.3;
      this.quickTurnFrom = cam.yaw;
      g.audio.play('whoosh', this.pos, 0.3);
    }

    // crouch toggle
    if (inp.pressed('crouch')) this.crouch = !this.crouch;

    // aim / guard
    const canAim = !!w?.weapon && this.switchT <= 0 && !this.guard;
    const wasAiming = this.aiming;
    this.aiming = canAim && inp.isDown('aim') && this.slashT < 0;
    if (this.aiming && !wasAiming && wd) {
      this.spread = wd.spreadMax;
      this.focusT = 0;
      this.crouch = false;
    }

    // knife: Q
    if (inp.pressed('knife')) this.onKnifePress();
    if (this.guard && !inp.isDown('knife')) {
      this.guard = false;
      // a quick tap still finishes the slash
      if (this.slashT < 0) this.anim.playUpper(null);
    }

    // movement
    const mi = this.trapT > 0 ? { x: 0, z: 0, mag: 0 } : this.moveInput();
    if (this.trapT > 0) this.trapT -= dt;
    this.sprinting = inp.isDown('sprint') && mi.z > 0.3 && !this.aiming && !this.guard && !this.crouch && this.quickTurn <= 0;
    let speed = this.aiming ? 1.35 : this.guard ? 1.2 : this.crouch ? 1.25 : this.sprinting ? 5.0 : 2.9;
    if (this.reloadT >= 0 && !this.aiming) speed = Math.min(speed, 2.4);
    const cy = cam.yaw;
    const fx = -Math.sin(cy), fz = -Math.cos(cy);
    const rx = Math.cos(cy), rz = -Math.sin(cy);
    let dx = fx * mi.z + rx * mi.x, dz = fz * mi.z + rz * mi.x;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-4) {
      dx /= dl;
      dz /= dl;
    }
    const tvx = dx * speed * mi.mag, tvz = dz * speed * mi.mag;
    const acc = damp(this.aiming ? 14 : 10, dt);
    this.vx += (tvx - this.vx) * acc;
    this.vz += (tvz - this.vz) * acc;

    // facing
    if (this.aiming || this.guard) {
      this.yaw = approachAngle(this.yaw, cy, 14 * dt);
    } else if (this.quickTurn <= 0 && mi.mag > 0.1) {
      this.yaw = approachAngle(this.yaw, yawFromDir(dx, dz), (this.sprinting ? 7 : 10) * dt);
    }
    this.applyVelocity(dt, -1);
    const sp = Math.hypot(this.vx, this.vz);
    this.moveSpeed = sp;
    this.noise = this.sprinting ? 9 : sp > 0.5 && !this.crouch ? 4 : 0;

    // base locomotion anim
    if (this.crouch) {
      if (sp > 0.3) this.anim.play(L.crouchWalk, { speed: sp / 1.25 });
      else this.anim.play(L.crouchIdle);
    } else if (sp > 3.8) this.anim.play(L.run, { speed: sp / 5.0 });
    else if (sp > 0.25) this.anim.play(L.walk, { speed: Math.max(0.5, sp / 2.9) });
    else this.anim.play(L.idle);
    // strafing: rotate legs toward travel direction while aiming
    if ((this.aiming || this.guard) && sp > 0.3) {
      let rel = angleDiff(this.yaw, yawFromDir(this.vx, this.vz));
      let back = false;
      if (Math.abs(rel) > Math.PI / 2) {
        rel = wrapAngle(rel + Math.PI);
        back = true;
      }
      this.legYaw += (clamp(rel, -1.2, 1.2) - this.legYaw) * damp(10, dt);
      if (back) this.anim.setSpeed(-Math.max(0.5, sp / 2.9));
    } else this.legYaw += (0 - this.legYaw) * damp(10, dt);
    this.anim.extra[B.hips * 3 + 1] += this.legYaw;
    this.anim.extra[B.spine * 3 + 1] -= this.legYaw * 0.6;
    this.anim.extra[B.chest * 3 + 1] -= this.legYaw * 0.4;

    // upper body layer
    if (this.action?.upper) {
      /* handled by action */
    } else if (this.slashT >= 0 || this.guard) {
      /* knife layer set by knife code */
    } else if (this.reloadT >= 0) {
      /* reload layer */
    } else if (this.aiming && wd) {
      this.anim.playUpper(wd.kind === 'pistol' ? L.aimPistol : L.aimLong);
    } else if (wd && !this.sprinting) {
      this.anim.playUpper(wd.kind === 'pistol' ? L.holdPistol : L.holdLong, { armsOnly: true });
    } else this.anim.playUpper(null);

    // aim pitch distributed over spine/chest/neck
    const aimW = this.anim.upperWeight * (this.aiming || this.guard ? 1 : 0.3);
    const p = cam.pitch + cam.recoil;
    this.anim.extra[B.spine * 3] += p * 0.35 * aimW;
    this.anim.extra[B.chest * 3] += p * 0.55 * aimW;
    this.anim.extra[B.neck * 3] += p * 0.1 * aimW;
    if (!this.aiming) this.anim.extra[B.head * 3] += clamp(p, -0.5, 0.5) * 0.4;

    // spread / focus
    if (wd) {
      if (this.aiming) {
        const moving = sp > 0.3;
        const floor = moving ? lerp(wd.spreadMin, wd.spreadMax, 0.55) : wd.spreadMin;
        const rate = (wd.spreadMax - wd.spreadMin) / 0.75;
        this.spread = Math.max(floor, this.spread - rate * dt);
        if (this.spread < floor) this.spread = floor;
        this.focusT = this.spread <= wd.spreadMin * 1.25 ? this.focusT + dt : 0;
      } else this.spread = wd.spreadMax;
    }

    // reload
    if (this.reloadT >= 0) this.updateReload(dt);
    else if (inp.pressed('reload')) this.startReload();

    // fire
    if (this.aiming && wd && w?.weapon && this.switchT <= 0) {
      const wantFire = inp.pressed('fire');
      if (wantFire) {
        if (this.reloadT >= 0 && this.shellMode && w.weapon.mag > 0) {
          this.reloadT = -1;
          this.anim.playUpper(L.aimLong);
        }
        if (this.reloadT < 0 && this.fireCd <= 0) {
          if (w.weapon.mag > 0) this.fire();
          else {
            g.audio.play('dry', this.pos);
            this.fireCd = 0.25;
            if (g.inv.count(wd.ammo) > 0) this.startReload();
          }
        }
      }
    } else if (inp.pressed('fire') && !this.aiming && wd && this.reloadT < 0 && !this.guard) {
      // RE4R: fire without aim does a quick knife? keep simple: nothing
    }

    // weapon slots
    for (let i = 0; i < 8; i++) {
      if (inp.pressed(('slot' + (i + 1)) as 'slot1')) {
        const uid = g.inv.slots[i];
        const it = g.inv.byUid(uid);
        if (it?.weapon) this.equip(uid);
        else if (it && (it.id === 'nade' || it.id === 'flash')) g.throwGrenade(it.id);
      }
    }
    if (inp.wheel !== 0 && !this.aiming) this.cycleWeapon(inp.wheel > 0 ? 1 : -1);

    // interact / melee
    if (inp.pressed('interact')) g.onInteract();
    if (inp.pressed('grenade')) {
      if (g.inv.count('nade') > 0) g.throwGrenade('nade');
      else if (g.inv.count('flash') > 0) g.throwGrenade('flash');
      else g.hud.toast('没有可投掷的物品');
    }
    if (inp.pressed('heal')) g.quickHeal();

    // camera aim blend
    cam.aimT += ((this.aiming ? 1 : 0) - cam.aimT) * damp(12, dt);
    cam.scope += ((this.aiming && wd?.kind === 'rifle' && cam.aimT > 0.8 ? 1 : 0) - cam.scope) * damp(14, dt);
    cam.crouch += ((this.crouch ? 1 : 0) - cam.crouch) * damp(8, dt);
  }

  cycleWeapon(dir: number) {
    const ws = this.g.inv.slots.map((uid) => this.g.inv.byUid(uid)).filter((i) => i?.weapon) as ItemInst[];
    if (!ws.length) return;
    let idx = ws.findIndex((i) => i.uid === this.weaponUid);
    idx = (idx + dir + ws.length) % ws.length;
    this.equip(ws[idx].uid);
  }

  private onKnifePress() {
    const g = this.g;
    if (this.knife <= 0) {
      g.hud.toast('小刀已损坏，需要找商人修理');
      g.audio.play('ui_error');
      return;
    }
    // context: stealth kill / finish downed enemy
    const ctx = g.knifeContext();
    if (ctx) {
      ctx();
      return;
    }
    this.reloadT = -1;
    this.aiming = false;
    this.guard = true;
    this.guardT = 0;
    this.slashT = 0;
    this.parryWindowT = 0;
    this.anim.playUpper(L.knifeSlash, { restart: true });
    g.audio.play('knife_swing', this.pos);
  }

  /** Called by enemies when their strike lands. */
  tryParry(attackerPos: THREE.Vector3, heavy: boolean): 'perfect' | 'normal' | null {
    if (this.knife <= 0) return null;
    if (!(this.guard || this.slashT >= 0)) return null;
    // must face attacker
    const toA = yawFromDir(attackerPos.x - this.pos.x, attackerPos.z - this.pos.z);
    if (Math.abs(angleDiff(this.yaw, toA)) > 80 * DEG) return null;
    const win = this.g.diff.parryWindow;
    const perfect = this.parryWindowT >= 0 && this.parryWindowT <= win;
    if (!perfect && !this.g.diff.guardParry) return null;
    this.knife = Math.max(0, this.knife - (perfect ? (heavy ? 60 : 8) : heavy ? 160 : 45));
    this.anim.playUpper(L.parry, { restart: true });
    this.slashT = 0.1;
    this.parryWindowT = -1;
    return perfect ? 'perfect' : 'normal';
  }

  // ------------------------------------------------------------------ guns

  startReload() {
    const w = this.weapon, wd = this.wdef;
    if (!w?.weapon || !wd) return;
    const cap = wCap(w.weapon);
    if (w.weapon.mag >= cap) return;
    if (this.g.inv.count(wd.ammo) <= 0) {
      this.g.hud.toast('没有' + (wd.ammo === 'ammo_hg' ? '手枪子弹' : wd.ammo === 'ammo_sg' ? '霰弹' : '步枪子弹'));
      return;
    }
    this.guard = false;
    this.slashT = -1;
    this.shellMode = wd.singleLoad;
    this.reloadT = 0;
    this.reloadDur = wd.singleLoad ? wReload(w.weapon) : wReload(w.weapon);
    if (wd.kind === 'pistol') this.anim.playUpper(L.reloadPistol, { restart: true, speed: L.reloadPistol.duration / this.reloadDur });
    else if (wd.kind === 'shotgun') this.anim.playUpper(L.reloadShell, { restart: true, speed: L.reloadShell.duration / this.reloadDur });
    else this.anim.playUpper(L.reloadRifle, { restart: true, speed: L.reloadRifle.duration / this.reloadDur });
    this.g.audio.play(wd.kind === 'shotgun' ? 'shell' : 'mag_out', this.pos);
  }

  private updateReload(dt: number) {
    const w = this.weapon, wd = this.wdef;
    if (!w?.weapon || !wd) {
      this.reloadT = -1;
      return;
    }
    this.reloadT += dt;
    if (this.reloadT >= this.reloadDur) {
      const cap = wCap(w.weapon);
      if (this.shellMode) {
        const got = this.g.inv.take(wd.ammo, 1);
        w.weapon.mag += got;
        this.g.audio.play('shell', this.pos);
        if (w.weapon.mag < cap && this.g.inv.count(wd.ammo) > 0 && got > 0) {
          this.reloadT = 0;
          return;
        }
        this.g.audio.play('slide', this.pos);
      } else {
        const need = cap - w.weapon.mag;
        w.weapon.mag += this.g.inv.take(wd.ammo, need);
        this.g.audio.play(wd.kind === 'rifle' ? 'bolt' : 'slide', this.pos);
      }
      this.reloadT = -1;
      this.anim.playUpper(null);
    } else if (!this.shellMode && this.reloadT > this.reloadDur * 0.6 && this.reloadT - dt <= this.reloadDur * 0.6) {
      this.g.audio.play('mag_in', this.pos);
    }
  }

  private fire() {
    const g = this.g;
    const w = this.weapon!, wd = this.wdef!;
    w.weapon!.mag--;
    this.fireCd = wRate(w.weapon!);
    const focused = this.focusT > 0.05;
    g.combat.fireWeapon(this, w.weapon!, wd, this.spread, focused);
    // recoil
    const kick = wd.recoil * (this.crouch ? 0.7 : 1);
    g.camera.kick(kick, rng.range(-0.3, 0.3) * kick);
    this.spread = Math.min(wd.spreadMax, this.spread + (wd.kind === 'pistol' ? 1.5 : 2.5));
    this.focusT = 0;
    this.anim.impulse(B.rArm, -kick * 0.9, 0, 0);
    this.anim.impulse(B.chest, kick * 0.35, 0, 0);
    this.noise = 35;
    g.alertNoise(this.pos, 35);
    g.camera.shake(wd.kind === 'pistol' ? 0.05 : 0.18);
    if (wd.kind === 'rifle' && w.weapon!.mag > 0) g.after(0.5, () => g.audio.play('bolt', this.pos));
    if (wd.kind === 'shotgun') g.after(0.38, () => g.audio.play('slide', this.pos, 0.8, 0.7));
  }

  /** Muzzle world position & barrel dir. */
  muzzle(outPos: THREE.Vector3, outDir: THREE.Vector3) {
    const w = this.weapon;
    if (!w?.weapon) {
      outPos.copy(this.center);
      outDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      return;
    }
    const m = this.model(w.weapon.id);
    m.obj.updateMatrixWorld(true);
    outPos.copy(m.muzzle).applyMatrix4(m.obj.matrixWorld);
    outDir.set(0, 0, -1).transformDirection(m.obj.matrixWorld);
  }

  private updateWeaponVisual() {
    const w = this.weapon;
    for (const [id, m] of this.models) m.obj.visible = !!w?.weapon && w.weapon.id === id && !this.dead;
    this.knifeModel.obj.visible = this.slashT >= 0 || this.guard || this.action?.name === 'stab' || this.action?.name === 'stealth';
    if (!w?.weapon) return;
    const m = this.model(w.weapon.id);
    if (this.knifeModel.obj.visible) {
      // holster gun while knifing: hide it
      m.obj.visible = false;
      return;
    }
    const hand = this.rig.bones[B.rHand];
    const hp = hand.getWorldPosition(new THREE.Vector3());
    const wd = WEAPONS[w.weapon.id];
    const aimBlend = this.g.camera.aimT;
    if (this.aiming && aimBlend > 0.3 && this.reloadT < 0) {
      // point the barrel at the aim point
      const chest = this.rig.bones[B.chest].getWorldPosition(new THREE.Vector3());
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      let base: THREE.Vector3;
      if (wd.kind === 'pistol') base = chest.clone().addScaledVector(fwd, 0.52).addScaledVector(right, 0.1).add(new THREE.Vector3(0, 0.3, 0));
      else base = chest.clone().addScaledVector(fwd, 0.28).addScaledVector(right, 0.16).add(new THREE.Vector3(0, 0.25, 0));
      base.y += (this.g.camera.pitch + this.g.camera.recoil) * 0.25;
      m.obj.position.lerp(base, 0.7);
      m.obj.lookAt(this.aimPoint);
      // lookAt points +Z at target; our barrel is -Z
      m.obj.rotateY(Math.PI);
    } else {
      m.obj.position.copy(hp);
      const q = hand.getWorldQuaternion(new THREE.Quaternion());
      m.obj.quaternion.copy(q);
      // gun barrel (-Z) along hand's -Y, gun up along hand -Z
      m.obj.rotateX(-Math.PI / 2);
      m.obj.translateY(0.02);
      if (wd.kind !== 'pistol') m.obj.translateZ(-0.1);
    }
  }

  // ------------------------------------------------------------------ physics

  applyVelocity(dt: number, friction: number) {
    const lv = this.g.level;
    if (friction >= 0) {
      const f = damp(friction, dt);
      this.vx -= this.vx * f;
      this.vz -= this.vz * f;
    }
    const p = { x: this.pos.x + this.vx * dt, z: this.pos.z + this.vz * dt };
    if (lv) {
      lv.cw.resolveCircle(p, 0.32, this.pos.y, 1.75);
      // enemies are solid
      for (const e of this.g.enemies) {
        if (!e.solid) continue;
        const dx = p.x - e.pos.x, dz = p.z - e.pos.z;
        if (Math.abs(e.pos.y - this.pos.y) > 1.2) continue;
        const d = Math.hypot(dx, dz);
        const min = 0.32 + e.radius;
        if (d < min && d > 1e-4) {
          p.x += (dx / d) * (min - d) * 0.8;
          p.z += (dz / d) * (min - d) * 0.8;
        }
      }
      lv.cw.resolveCircle(p, 0.32, this.pos.y, 1.75);
      const b = lv.bounds;
      p.x = clamp(p.x, b.minX + 1, b.maxX - 1);
      p.z = clamp(p.z, b.minZ + 1, b.maxZ - 1);
      this.pos.x = p.x;
      this.pos.z = p.z;
      const gy = lv.cw.groundHeight(p.x, p.z, this.pos.y);
      if (gy < this.pos.y - 0.06) {
        this.vy -= 18 * dt;
        this.pos.y = Math.max(gy, this.pos.y + this.vy * dt);
        if (this.pos.y <= gy) {
          if (this.vy < -9) this.g.audio.play('thud', this.pos, 0.7);
          this.vy = 0;
        }
      } else {
        this.vy = 0;
        this.pos.y += (gy - this.pos.y) * damp(22, dt);
      }
      this.onFloor = lv.cw.floorIdAt(p.x, p.z, this.pos.y);
    } else {
      this.pos.x = p.x;
      this.pos.z = p.z;
    }
  }

  // ------------------------------------------------------------------ actions

  private updateAction(dt: number) {
    const a = this.action;
    if (!a) {
      this.toMove();
      return;
    }
    a.t += dt;
    a.update?.(dt, a.t);
    if (a.t >= a.dur) {
      this.action = null;
      if (a.upper) this.anim.playUpper(null);
      else this.toMove();
      a.onEnd?.();
    }
  }

  get invulnerable(): boolean {
    return this.invuln > 0 || !!this.action?.invuln || this.state === 'down' || this.state === 'climb';
  }

  /** Enemy damage entry point. */
  hurt(amount: number, from: THREE.Vector3, kind: 'light' | 'heavy' | 'explosion' | 'dot' | 'fall') {
    const g = this.g;
    if (this.state === 'dead') return;
    if (kind !== 'dot' && this.invulnerable && kind !== 'explosion') return;
    if (g.godMode) amount = 0;
    this.hp -= amount;
    this.lastHurtT = g.time;
    g.onPlayerDamaged(amount);
    this.hurtDir = yawFromDir(from.x - this.pos.x, from.z - this.pos.z);
    if (kind !== 'dot') {
      g.camera.shake(kind === 'light' ? 0.35 : 0.7);
      g.renderer.post.damage = Math.min(1, g.renderer.post.damage + (kind === 'light' ? 0.6 : 1));
      g.fx.blood(this.center, new THREE.Vector3(this.pos.x - from.x, 0.3, this.pos.z - from.z).normalize(), 0.8);
      g.hud.damageIndicator(this.hurtDir);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(kind === 'explosion');
      return;
    }
    if (kind === 'dot') return;
    g.audio.play(kind === 'light' ? 'leon_hurt' : 'leon_hurt_big', this.pos);
    this.reloadT = -1;
    this.guard = false;
    this.slashT = -1;
    this.aiming = false;
    if (this.state === 'grabbed') this.releaseGrab(false);
    if (this.state === 'climb') return;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z;
    const dl = Math.hypot(dx, dz) || 1;
    if (kind === 'heavy' || kind === 'explosion') {
      this.knockDown(dx / dl, dz / dl, kind === 'explosion' ? 6 : 3.5);
    } else {
      this.state = 'hurt';
      this.stateT = 0;
      this.action = null;
      this.anim.play(L.hurt, { fade: 0.05, restart: true });
      this.anim.playUpper(null);
      this.vx = (dx / dl) * 2;
      this.vz = (dz / dl) * 2;
      this.invuln = 0.5;
    }
  }

  knockDown(dx: number, dz: number, force: number) {
    this.state = 'down';
    this.stateT = 0;
    this.action = null;
    this.climb = null;
    this.yaw = yawFromDir(-dx, -dz);
    this.anim.play(L.fallBack, { fade: 0.05, restart: true });
    this.anim.playUpper(null);
    this.vx = dx * force;
    this.vz = dz * force;
    this.invuln = 2.2;
  }

  private updateDown(_dt: number) {
    const t = this.stateT;
    if (t > 0.65 && this.anim.clipName === 'fallBack') this.anim.play(L.lieBack, { fade: 0.1 });
    if (t > 1.3 && this.anim.clipName === 'lieBack') this.anim.play(L.getUpBack, { fade: 0.1, restart: true });
    if (t > 1.3 + L.getUpBack.duration) {
      this.invuln = 0.6;
      this.toMove();
    }
  }

  die(explosion = false, decap = false) {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.stateT = 0;
    this.dead = true;
    this.action = null;
    this.climb = null;
    this.grabbedBy = null;
    this.aiming = false;
    this.anim.playUpper(null);
    this.deathKind = decap ? 'decap' : 'normal';
    if (decap) this.anim.play(L.decapDeath, { fade: 0.05, restart: true });
    else this.anim.play(explosion ? L.fallBack : L.dieFront, { fade: 0.08, restart: true });
    this.g.audio.play('leon_hurt_big', this.pos, 1, 0.8);
    this.g.onPlayerDeath();
  }

  decapitate() {
    this.rig.bones[B.head].scale.setScalar(0.001);
    const hp = this.headPos;
    this.g.fx.headBurst(hp, new THREE.Vector3(0, 1, 0));
    this.g.fx.bloodPool(this.pos, 1.8);
  }

  // grab -----------------------------------------------------------------
  grab(by: Enemy) {
    if (this.state === 'dead') return;
    this.state = 'grabbed';
    this.stateT = 0;
    this.grabbedBy = by;
    this.grabProgress = 0;
    this.grabDmgAcc = 0;
    this.action = null;
    this.climb = null;
    this.reloadT = -1;
    this.aiming = false;
    this.guard = false;
    this.slashT = -1;
    this.anim.play(L.grabbed, { fade: 0.1 });
    this.anim.playUpper(null);
    this.yaw = yawFromDir(by.pos.x - this.pos.x, by.pos.z - this.pos.z);
    this.g.audio.play('grab', this.pos);
    this.g.hud.showMash(true);
  }

  private updateGrabbed(dt: number) {
    const g = this.g;
    const e = this.grabbedBy;
    if (!e || !e.alive || e.state !== 'grab') {
      this.releaseGrab(false);
      return;
    }
    this.yaw = yawFromDir(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
    // choke damage
    this.grabDmgAcc += dt;
    if (this.grabDmgAcc > 0.5) {
      this.grabDmgAcc = 0;
      g.damagePlayer(e.grabDamage * 0.5 * g.enemyDamageMult(), e.pos, 'dot');
      g.audio.play('choke', this.pos, 0.6);
      if (this.state !== 'grabbed') return;
    }
    this.grabProgress = Math.max(0, this.grabProgress - dt * 0.18);
    if (g.input.pressed('interact')) {
      this.grabProgress += g.diff.grabEscape;
      this.anim.impulse(B.chest, rng.range(-3, 3), rng.range(-3, 3));
    }
    if (g.input.pressed('knife') && this.knife > 0) {
      this.knife = Math.max(0, this.knife - 70);
      g.audio.play('knife_hit', e.pos);
      g.fx.blood(e.headPos, new THREE.Vector3(0, 0.5, 0), 0.6);
      g.hud.toast('小刀挣脱');
      e.takeDamage({ dmg: 60, zone: 'torso', dir: new THREE.Vector3(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize(), kind: 'knife' });
      e.stagger('staggerHead', 1.6);
      this.releaseGrab(true);
      return;
    }
    g.hud.setMash(this.grabProgress);
    if (this.grabProgress >= 1) {
      e.stagger('flinch', 0.9);
      e.shove(this.pos, 2);
      this.releaseGrab(true);
    }
  }

  releaseGrab(escaped: boolean) {
    const e = this.grabbedBy;
    this.grabbedBy = null;
    this.g.hud.showMash(false);
    if (e && e.state === 'grab') e.endGrab();
    if (this.state === 'grabbed') {
      this.toMove();
      this.invuln = escaped ? 1.0 : 0.6;
      this.anim.play(L.idle, { fade: 0.2 });
    }
  }

  // ladders / windows ------------------------------------------------------
  climbLadder(l: Ladder, up: boolean) {
    if (this.state !== 'move' || l.down) return;
    const from = up ? new THREE.Vector3(l.bx, l.by, l.bz) : new THREE.Vector3(l.ex, l.ey, l.ez);
    const to = up ? new THREE.Vector3(l.ex, l.ey, l.ez) : new THREE.Vector3(l.bx, l.by, l.bz);
    this.climb = { ladder: l, up, t: 0, dur: Math.abs(l.ty - l.by) / 2.2 + 0.4, from, to, phase: 'climb' };
    this.state = 'climb';
    this.stateT = 0;
    this.aiming = false;
    this.reloadT = -1;
    this.guard = false;
    this.yaw = l.facing;
    this.anim.play(L.climb, { fade: 0.15 });
    this.anim.playUpper(null);
  }

  private updateClimb(dt: number) {
    const c = this.climb;
    if (!c) {
      this.toMove();
      return;
    }
    const l = c.ladder;
    if (l.down) {
      // ladder knocked while climbing
      this.climb = null;
      this.knockDown(Math.sin(l.facing), Math.cos(l.facing), 2);
      this.hurt(150, this.pos.clone().add(new THREE.Vector3(0, 0, 1)), 'dot');
      return;
    }
    c.t += dt;
    const u = Math.min(1, c.t / c.dur);
    // path: base -> ladder top -> exit (or reverse)
    const base = new THREE.Vector3(l.bx, l.by, l.bz);
    const top = new THREE.Vector3(l.tx, l.ty, l.tz);
    const exit = new THREE.Vector3(l.ex, l.ey, l.ez);
    const pts = c.up ? [base, top, exit] : [exit, top, base];
    const seg = u < 0.8 ? 0 : 1;
    const su = seg === 0 ? u / 0.8 : (u - 0.8) / 0.2;
    const a = c.up ? pts[seg] : pts[seg];
    const b = pts[seg + 1];
    // when climbing (seg 0 up / seg 1 down) keep offset from ladder
    this.pos.lerpVectors(a, b, su);
    if ((c.up && seg === 0) || (!c.up && seg === 1)) {
      // stand slightly in front of ladder
      const fx = -Math.sin(l.facing), fz = -Math.cos(l.facing);
      this.pos.x -= fx * 0.35;
      this.pos.z -= fz * 0.35;
      this.anim.play(L.climb, { speed: c.up ? 1 : -1 });
    } else this.anim.play(L.vault, { fade: 0.1 });
    this.yaw = l.facing;
    if (u >= 1) {
      this.pos.copy(c.to);
      this.climb = null;
      this.toMove();
      this.anim.play(L.idle, { fade: 0.2 });
    }
  }

  vaultWindow(w: WindowOpening) {
    if (this.state !== 'move') return;
    const side = (this.pos.x - w.x) * w.nx + (this.pos.z - w.z) * w.nz > 0 ? 1 : -1;
    const from = this.pos.clone();
    const to = new THREE.Vector3(w.x - w.nx * side * 0.9, w.y, w.z - w.nz * side * 0.9);
    const ground = this.g.level!.cw.groundHeight(to.x, to.z, w.y + 0.5);
    to.y = ground;
    this.yaw = yawFromDir(-w.nx * side, -w.nz * side);
    const sill = w.y + 1.0;
    this.doAction({
      name: 'vault',
      clip: L.vault,
      dur: 0.9,
      invuln: true,
      update: (_dt, t) => {
        const u = Math.min(1, t / 0.9);
        this.pos.x = from.x + (to.x - from.x) * u;
        this.pos.z = from.z + (to.z - from.z) * u;
        const arc = Math.sin(u * Math.PI) * (sill - Math.min(from.y, to.y) + 0.2);
        this.pos.y = lerp(from.y, Math.max(to.y, from.y - 0.5), u) + arc * (u < 0.5 ? 1 : 1 - (u - 0.5));
        this.vx = this.vz = 0;
        this.anim.pose[R_Y] = 0;
      },
      onEnd: () => {
        this.vy = 0;
      },
    });
    this.g.audio.play('whoosh', this.pos, 0.5);
    if (!w.broken && w.glass) {
      w.broken = true;
      w.glass.visible = false;
      this.g.audio.play('glass', this.pos);
    }
  }

  lookHeadTo(target: THREE.Vector3, w = 0.6) {
    const yawTo = yawFromDir(target.x - this.pos.x, target.z - this.pos.z);
    const d = clamp(angleDiff(this.yaw, yawTo), -1.1, 1.1);
    this.anim.extra[B.head * 3 + 1] += d * w * 0.6;
    this.anim.extra[B.neck * 3 + 1] += d * w * 0.4;
  }
}
