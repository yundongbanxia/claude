import * as THREE from 'three';
import { Renderer } from '../render/renderer';
import { Effects } from '../render/fx';
import { Input } from '../core/input';
import { AudioSys } from '../audio/audio';
import { OTSCamera } from './player/camera';
import { Player, KNIFE_MAX } from './player/player';
import { Enemy, type DamageInfo, type EnemySpawn } from './enemies/enemy';
import { Director } from './enemies/director';
import { Combat } from './combat';
import { DDA } from './dda';
import { Inventory, type ItemInst } from './inventory';
import { Animal, BearTrap, DroppedProp, Medallion, Pickup, Projectile, type ProjKind } from './entities';
import { DIFFICULTIES, type DifficultyDef, type DifficultyId } from '../data/difficulty';
import { ITEMS } from '../data/items';
import { WEAPONS } from '../data/weapons';
import { L } from '../anim/clips';
import { G as GC } from '../anim/clips';
import { B } from '../anim/rig';
import { angleDiff, clamp, damp, DEG, dist2, lerp, yawFromDir } from '../core/math';
import { rng } from '../core/rng';
import { setDoorOpen } from '../world/props';
import type { Door, Interactable, Ladder, Level, Shelf, Breakable } from '../world/level';
import type { Hud } from '../ui/hud';
import type { AreaInstance } from '../levels/area';
import { buildArea } from '../levels/registry';
import type { LoopHandle } from '../audio/audio';

export type GameState = 'title' | 'play' | 'pause' | 'inventory' | 'merchant' | 'dead' | 'results' | 'loading';

export interface Shootable {
  pos: THREE.Vector3;
  r: number;
  onShot: (p: THREE.Vector3, dir: THREE.Vector3) => void;
}

export interface CutStep {
  dur: number;
  cam?: { pos: THREE.Vector3; look: THREE.Vector3; fov?: number };
  sub?: string;
  onStart?: (g: Game) => void;
  freeze?: boolean;
}

export interface Snapshot {
  area: string;
  entry: string;
  pos?: [number, number, number];
  yaw?: number;
  inv: ReturnType<Inventory['serialize']>;
  hp: number;
  maxHp: number;
  knife: number;
  flags: Record<string, unknown>;
  rank: number;
  weaponUid: number | null;
  difficulty: DifficultyId;
  stats: Game['stats'];
  time: number;
}

export class Game {
  renderer: Renderer;
  scene = new THREE.Scene();
  camera: OTSCamera;
  input: Input;
  audio = new AudioSys();
  hud!: Hud;
  fx = new Effects();
  combat: Combat;
  director: Director;
  diff: DifficultyDef = DIFFICULTIES.standard;
  dda: DDA;
  inv = new Inventory(10, 7);
  player: Player;
  level: Level | null = null;
  area: AreaInstance | null = null;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  animals: Animal[] = [];
  traps: BearTrap[] = [];
  props: DroppedProp[] = [];
  medallions: Medallion[] = [];
  shootables: Shootable[] = [];
  state: GameState = 'title';
  time = 0;
  playTime = 0;
  godMode = false;
  flags: Record<string, unknown> = {};
  stats = { kills: 0, shots: 0, hits: 0, headshots: 0, deaths: 0, pesetas: 0, time: 0, damage: 0, parries: 0 };
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  cutscene: { steps: CutStep[]; i: number; t: number; onEnd?: () => void; skippable: boolean } | null = null;
  private fireLoops: LoopHandle[] = [];
  checkpointData: Snapshot | null = null;
  timeScale = 1;
  private hitStopT = 0;
  onStateChange: ((s: GameState) => void) | null = null;
  test = false;
  private deadT = 0;
  private promptCache: { text: string; key: string } | null = null;
  pendingPickup: Pickup | null = null;
  areaEntry = '';
  settings = { sens: 1, invertY: false, fov: 60, quality: 'medium' as 'low' | 'medium' | 'high', gore: true, tts: true, master: 0.8, music: 0.55, sfx: 1 };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.camera = new OTSCamera(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    this.input = new Input(canvas);
    this.combat = new Combat(this);
    this.director = new Director(this);
    this.dda = new DDA(this.diff);
    this.player = new Player(this);
    this.scene.add(this.player.rig.root);
    this.scene.add(this.fx.group);
    this.fx.groundAt = (x, z) => (this.level ? this.level.cw.groundHeight(x, z, 100) : 0);
    // lights
    this.hemi = new THREE.HemisphereLight(0xb8b0a0, 0x3a3228, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd8a8, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.renderer.shadowMapSize, this.renderer.shadowMapSize);
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -32;
    sc.right = 32;
    sc.top = 32;
    sc.bottom = -32;
    sc.near = 1;
    sc.far = 140;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(0x6a6a70) }, bottom: { value: new THREE.Color(0xa09880) }, sunDir: { value: new THREE.Vector3(0, 0.2, -1) }, sunCol: { value: new THREE.Color(0xffc080) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.15,0.0,1.0); vec3 c = mix(bottom, top, h); float s = max(0.0, dot(normalize(vP), normalize(sunDir))); c += sunCol * (pow(s, 40.0)*0.9 + pow(s, 4.0)*0.18); gl_FragColor = vec4(c,1.0); }',
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(200, 16, 10), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(0x8a8270, 0.025);
  }

  setState(s: GameState) {
    this.state = s;
    this.onStateChange?.(s);
  }

  // ------------------------------------------------------------------ lifecycle

  newGame(diff: DifficultyId) {
    this.diff = DIFFICULTIES[diff];
    this.dda = new DDA(this.diff);
    this.inv = new Inventory(10, 7);
    this.inv.add('sg09');
    this.inv.add('ammo_hg', 20);
    this.inv.add('herb_g', 1);
    this.inv.pesetas = 0;
    const keep = Object.fromEntries(Object.entries(this.flags).filter(([k]) => k.startsWith('test')));
    this.flags = { difficulty: diff, ...keep };
    this.stats = { kills: 0, shots: 0, hits: 0, headshots: 0, deaths: 0, pesetas: 0, time: 0, damage: 0, parries: 0 };
    this.player.hp = this.player.maxHp = 1000;
    this.player.knife = KNIFE_MAX;
    this.player.weaponUid = null;
    const w = this.inv.weapons()[0];
    this.player.equip(w.uid);
    this.playTime = 0;
    this.loadArea(this.test ? (this.flags.testArea as string) ?? 'forest' : 'forest', 'start');
  }

  loadArea(id: string, entry: string, pos?: [number, number, number], yaw?: number) {
    this.clearArea();
    this.areaEntry = entry;
    const area = buildArea(id, this);
    this.area = area;
    this.level = area.level;
    this.scene.add(area.level.group);
    // lighting / atmosphere
    (this.scene.fog as THREE.FogExp2).color.setHex(area.fog.color);
    (this.scene.fog as THREE.FogExp2).density = area.fog.density;
    this.skyMat.uniforms.top.value.setHex(area.sky.top);
    this.skyMat.uniforms.bottom.value.setHex(area.sky.bottom);
    this.skyMat.uniforms.sunDir.value.copy(area.sunDir);
    this.skyMat.uniforms.sunCol.value.setHex(area.sunColor);
    this.sun.color.setHex(area.sunColor);
    this.sun.intensity = area.sunIntensity;
    this.hemi.color.setHex(area.hemi.sky);
    this.hemi.groundColor.setHex(area.hemi.ground);
    this.hemi.intensity = area.hemi.intensity;
    this.renderer.post.exposure = area.exposure ?? 1;
    // player
    const e = area.entries[entry] ?? Object.values(area.entries)[0];
    this.player.reset();
    if (pos) {
      this.player.place(pos[0], pos[2], yaw ?? 0);
      this.player.pos.y = pos[1];
    } else this.player.place(e.x, e.z, e.yaw);
    this.director.reset();
    area.spawn(this);
    // fire audio loops
    for (const f of area.level.fires) this.fireLoops.push(this.audio.fireLoop(new THREE.Vector3(f.x, f.y, f.z), f.blue ? 0.15 : 0.35 * f.size));
    this.audio.startAmbience(area.ambience);
    this.audio.music?.setMode('game');
    this.renderer.post.fade = 1;
    this.setState('play');
    this.hud.areaTitle(area.name);
    area.onEnter?.(this, entry);
    this.checkpoint();
  }

  private clearArea() {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    for (const p of this.projectiles) p.dispose();
    this.projectiles = [];
    for (const p of this.pickups) p.dispose();
    this.pickups = [];
    for (const a of this.animals) a.dispose();
    this.animals = [];
    for (const t of this.traps) t.dispose();
    this.traps = [];
    for (const p of this.props) p.obj.parent?.remove(p.obj);
    this.props = [];
    for (const m of this.medallions) m.mesh.parent?.remove(m.mesh);
    this.medallions = [];
    for (const l of this.fireLoops) l.stop();
    this.fireLoops = [];
    this.fx.clear();
    this.cutscene = null;
    this.camera.override = null;
    if (this.level) {
      this.scene.remove(this.level.group);
      this.level.dispose();
      this.level = null;
    }
  }

  snapshot(): Snapshot {
    const p = this.player;
    return {
      area: this.area?.id ?? 'forest',
      entry: this.areaEntry,
      inv: this.inv.serialize(),
      hp: p.hp,
      maxHp: p.maxHp,
      knife: p.knife,
      flags: JSON.parse(JSON.stringify(this.flags)),
      rank: this.dda.rank,
      weaponUid: p.weaponUid,
      difficulty: this.diff.id,
      stats: { ...this.stats },
      time: this.playTime,
    };
  }

  restore(s: Snapshot) {
    this.diff = DIFFICULTIES[s.difficulty];
    this.dda = new DDA(this.diff);
    this.dda.rank = s.rank;
    this.inv = Inventory.deserialize(s.inv);
    this.flags = JSON.parse(JSON.stringify(s.flags));
    this.stats = { ...s.stats };
    this.playTime = s.time;
    this.player.hp = Math.max(s.hp, s.maxHp * 0.5);
    this.player.maxHp = s.maxHp;
    this.player.knife = s.knife;
    this.player.weaponUid = null;
    this.player.equip(s.weaponUid ?? this.inv.weapons()[0]?.uid ?? null);
    this.loadArea(s.area, s.entry, s.pos, s.yaw);
  }

  checkpoint(pos?: boolean) {
    const s = this.snapshot();
    if (pos) {
      s.pos = [this.player.pos.x, this.player.pos.y, this.player.pos.z];
      s.yaw = this.player.yaw;
    }
    this.checkpointData = s;
    try {
      localStorage.setItem('re4v_checkpoint', JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  saveSlot(slot: number) {
    const s = this.snapshot();
    s.pos = [this.player.pos.x, this.player.pos.y, this.player.pos.z];
    s.yaw = this.player.yaw;
    const meta = { ...s, savedAt: Date.now(), areaName: this.area?.name ?? '' };
    try {
      localStorage.setItem('re4v_slot_' + slot, JSON.stringify(meta));
      return true;
    } catch {
      return false;
    }
  }

  static readSlot(slot: number): (Snapshot & { savedAt: number; areaName: string }) | null {
    try {
      const raw = localStorage.getItem('re4v_slot_' + slot);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  continueFromCheckpoint() {
    const s = this.checkpointData;
    if (!s) return;
    this.stats.deaths++;
    this.restore(s);
    this.stats.deaths = Math.max(this.stats.deaths, (s.stats.deaths ?? 0) + 1);
  }

  // ------------------------------------------------------------------ main update

  update(rawDt: number) {
    const dt0 = Math.min(rawDt, 0.05);
    if (this.hitStopT > 0) {
      this.hitStopT -= dt0;
    }
    const dt = dt0 * this.timeScale * (this.hitStopT > 0 ? 0.08 : 1);
    this.time += dt;
    const post = this.renderer.post;
    post.damage = Math.max(0, post.damage - dt0 * 1.6);
    post.flash = Math.max(0, post.flash - dt0 * 0.9);

    if (this.state === 'play') {
      this.playTime += dt0;
      this.updatePlay(dt);
    } else if (this.state === 'dead') {
      this.deadT += dt0;
      this.updateWorld(dt * 0.6, true);
      post.fade = clamp((this.deadT - 2.2) / 1.2, 0, 0.85);
      if (this.deadT > 3.2) this.hud.showDeath(true);
    }
    if (this.state === 'play' && post.fade > 0 && !this.cutscene?.steps[this.cutscene.i]?.freeze) post.fade = Math.max(0, post.fade - dt0 * 1.5);
    post.lowHealth = this.player.alive ? clamp(1 - this.player.hp / (this.player.maxHp * 0.3), 0, 1) : 0;

    // camera
    if (this.state === 'play' || this.state === 'dead') {
      this.camera.update(dt0, this.player.pos, this.level?.cw ?? null);
    }
    const cam = this.camera.cam;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    this.audio.setListener(cam.position, fwd, cam.up);
    this.audio.music?.update(dt0);
    // sun follows player for shadow coverage
    if (this.area) {
      const p = this.player.pos;
      const sd = this.area.sunDir;
      this.sun.position.set(p.x + sd.x * 60, p.y + sd.y * 60, p.z + sd.z * 60);
      this.sun.target.position.set(p.x, p.y, p.z);
      this.sky.position.copy(cam.position);
    }
    if (this.state !== 'title') this.hud.update(dt0);
  }

  private updatePlay(dt: number) {
    const inp = this.input;
    const p = this.player;
    // mouse look
    if (!this.cutscene && p.state !== 'dead') this.camera.addLook(inp.mouseDX, inp.mouseDY);
    // cutscene
    if (this.cutscene) {
      this.updateCutscene(dt);
      if (this.cutscene?.steps[this.cutscene.i]?.freeze) return;
    } else {
      if (inp.pressed('pause')) {
        this.pause();
        return;
      }
      if (inp.pressed('inventory') && p.state === 'move') {
        this.openInventory();
        return;
      }
    }
    if (!this.cutscene) p.update(dt);
    else {
      p.state = p.state === 'move' ? 'locked' : p.state;
      p.update(dt);
    }
    if (!this.cutscene && p.state === 'locked') p.state = 'move';
    this.combat.updateAim(p);
    this.updateWorld(dt, false);
    this.dda.update(dt);
    this.area?.update?.(this, dt);
    // triggers
    for (const t of this.level!.triggers) {
      if (!t.enabled || (t.once && t.fired)) continue;
      if (Math.abs(p.pos.x - t.x) < t.hx && Math.abs(p.pos.z - t.z) < t.hz) {
        t.fired = true;
        t.fn(this);
      }
    }
    // prompt
    this.updatePrompt();
  }

  private updateWorld(dt: number, deadMode: boolean) {
    this.director.update(dt);
    for (const e of this.enemies) e.update(dt);
    if (this.enemies.some((e) => e.removed)) {
      for (const e of this.enemies) if (e.removed) e.dispose();
      this.enemies = this.enemies.filter((e) => !e.removed);
    }
    for (const pr of this.projectiles) pr.update(dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    for (const pk of this.pickups) pk.update(dt);
    for (const a of this.animals) a.update(dt);
    if (this.animals.some((a) => a.removed)) {
      for (const a of this.animals) if (a.removed) a.dispose();
      this.animals = this.animals.filter((a) => !a.removed);
    }
    if (!deadMode) for (const t of this.traps) t.update();
    const lv = this.level!;
    const gh = (x: number, z: number, y: number) => lv.cw.groundHeight(x, z, y);
    for (const pr of this.props) pr.update(dt, gh);
    if (this.props.length > 24) {
      const old = this.props.shift()!;
      old.obj.parent?.remove(old.obj);
    }
    for (const m of this.medallions) m.update(this.time);
    this.updateLevelObjects(dt);
    this.fx.update(dt);
    // shootables list
    this.shootables.length = 0;
    for (const pr of this.projectiles) if (pr.alive && (pr.kind === 'dynamite' || pr.kind === 'axe' || pr.kind === 'sickle') && !pr.deflected) this.shootables.push({ pos: pr.pos, r: pr.r, onShot: () => pr.onShot() });
    for (const a of this.animals) if (a.alive) this.shootables.push({ pos: a.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), r: a.r, onShot: () => a.onShot() });
    for (const t of this.traps) if (t.armed) this.shootables.push({ pos: t.pos, r: t.r, onShot: () => t.onShot() });
    for (const m of this.medallions) if (m.alive) this.shootables.push({ pos: m.pos, r: m.r, onShot: () => m.onShot() });
    for (const e of this.enemies) {
      if (e.alive && e.lit && e.weaponObj) {
        const wp = e.weaponObj.getWorldPosition(new THREE.Vector3());
        this.shootables.push({
          pos: wp,
          r: 0.18,
          onShot: () => {
            e.lit = false;
            e.weaponObj!.visible = false;
            this.explode(wp, 3.8, 700, 'dynamite');
            this.hud.toast('引爆!');
          },
        });
      }
    }
  }

  private updateLevelObjects(dt: number) {
    const lv = this.level!;
    for (const d of lv.doors) {
      if (Math.abs(d.angle - d.target) > 0.001) {
        d.angle += (d.target - d.angle) * damp(9, dt);
        d.pivot.rotation.y = d.rot + d.angle;
      }
    }
    for (const l of lv.ladders) {
      const target = l.down ? 1 : 0;
      if (Math.abs(l.fall - target) > 0.001) {
        l.fall += (target - l.fall) * damp(l.down ? 4 : 3, dt);
        if (Math.abs(l.fall - target) < 0.01) l.fall = target;
        // fall backward away from the wall until lying on the ground
        const dx = l.tx - l.bx, dz = l.tz - l.bz, dy = l.ty - l.by;
        const lean = Math.atan2(Math.hypot(dx, dz), dy);
        const f = l.fall * l.fall;
        l.mesh.rotation.x = lerp(-lean, Math.PI / 2 - 0.12, f);
      }
    }
    for (const s of lv.shelves) {
      if (s.pushed && s.progress < 1 && !s.destroyed) {
        s.progress = Math.min(1, s.progress + dt / 1.1);
        const x = lerp(s.fromX, s.toX, s.progress), z = lerp(s.fromZ, s.toZ, s.progress);
        s.mesh.position.x = x;
        s.mesh.position.z = z;
        lv.cw.moveCollider(s.collider, x, z, s.rot);
      }
    }
    for (const f of lv.fires) {
      f.acc += dt * (f.blue ? 12 : 30) * f.size;
      while (f.acc > 1) {
        f.acc -= 1;
        this.fx.fire(new THREE.Vector3(f.x, f.y, f.z), f.size, f.blue);
      }
      if (f.light) f.light.intensity = (f.blue ? 3 : 10) * f.size * (0.8 + Math.random() * 0.4);
    }
    for (const a of lv.animated) a(dt, this.time);
  }

  // ------------------------------------------------------------------ interaction

  private meleeTarget(): { e: Enemy; kind: 'kick' | 'suplex' } | null {
    const p = this.player;
    let best: { e: Enemy; kind: 'kick' | 'suplex'; d: number } | null = null;
    for (const e of this.enemies) {
      const m = e.stunnedForMelee;
      if (!m) continue;
      const d = dist2(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
      if (d > 3.2 || Math.abs(e.pos.y - p.pos.y) > 1) continue;
      let kind: 'kick' | 'suplex' = 'kick';
      if (m === 'suplex') {
        // suplex when standing behind a kneeling enemy
        const toP = yawFromDir(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
        kind = Math.abs(angleDiff(e.yaw, toP)) > 110 * DEG ? 'suplex' : 'kick';
      }
      if (e.isSalvador && kind === 'suplex') kind = 'kick';
      if (!best || d < best.d) best = { e, kind, d };
    }
    return best;
  }

  knifeContext(): (() => void) | null {
    const p = this.player;
    if (p.state !== 'move') return null;
    for (const e of this.enemies) {
      if (!e.alive || e.isSalvador) continue;
      const d = dist2(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
      if (Math.abs(e.pos.y - p.pos.y) > 1) continue;
      // stealth kill: unaware and from behind
      if (!e.aware && d < 1.7 && (e.state === 'idle' || e.state === 'work' || e.state === 'patrol')) {
        const toP = yawFromDir(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
        if (Math.abs(angleDiff(e.yaw, toP)) > 100 * DEG) return () => this.doStealth(e);
      }
      if (e.state === 'down' && e.stateT > 0.5 && d < 1.9) return () => this.doStab(e);
    }
    return null;
  }

  private findInteractable(): Interactable | null {
    const p = this.player;
    const lv = this.level;
    if (!lv) return null;
    let best: Interactable | null = null;
    let bestScore = Infinity;
    const all = lv.interactables.concat(this.pickups.filter((pk) => !pk.taken).map((pk) => pk.inter));
    for (const it of all) {
      if (!it.enabled) continue;
      const d = dist2(p.pos.x, p.pos.z, it.x, it.z);
      if (d > it.radius) continue;
      if (Math.abs(it.y - (p.pos.y + 1)) > (it.yTol ?? 1.4)) continue;
      const text = it.prompt(this);
      if (!text) continue;
      // prefer things in front
      const toI = yawFromDir(it.x - p.pos.x, it.z - p.pos.z);
      const face = Math.abs(angleDiff(p.aiming ? this.camera.yaw : p.yaw, toI));
      const score = d + face * 0.8 - (it.priority ?? 0) * 0.15;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  private findWindow() {
    const p = this.player;
    const lv = this.level;
    if (!lv) return null;
    for (const w of lv.windows) {
      const d = dist2(p.pos.x, p.pos.z, w.x, w.z);
      if (d > 1.3) continue;
      if (Math.abs(w.y - p.pos.y) > 0.6) continue;
      if (w.barricade && w.barricade.pushed && !w.barricade.destroyed) continue;
      return w;
    }
    return null;
  }

  private updatePrompt() {
    const p = this.player;
    let text = '';
    let key = 'F';
    if (p.state === 'move') {
      const m = this.meleeTarget();
      if (m) text = m.kind === 'suplex' ? '背摔' : '回旋踢';
      else {
        const kc = this.knifeContext();
        if (kc) {
          key = 'Q';
          const e = this.enemies.find((e) => e.alive && !e.aware && dist2(p.pos.x, p.pos.z, e.pos.x, e.pos.z) < 1.7);
          text = e ? '潜行击杀' : '小刀补刀';
        } else {
          const it = this.findInteractable();
          if (it) text = it.prompt(this) ?? '';
          else if (this.findWindow()) text = '翻越窗户';
        }
      }
    }
    if (!this.promptCache || this.promptCache.text !== text || this.promptCache.key !== key) {
      this.promptCache = { text, key };
      this.hud.setPrompt(text, key);
    }
  }

  onInteract() {
    const p = this.player;
    if (p.state !== 'move') return;
    const m = this.meleeTarget();
    if (m) {
      if (m.kind === 'suplex') this.doSuplex(m.e);
      else this.doKick(m.e);
      return;
    }
    const it = this.findInteractable();
    if (it) {
      it.use(this);
      return;
    }
    const w = this.findWindow();
    if (w) p.vaultWindow(w);
  }

  // ------------------------------------------------------------------ melee

  private doKick(target: Enemy) {
    const p = this.player;
    p.yaw = yawFromDir(target.pos.x - p.pos.x, target.pos.z - p.pos.z);
    // step to proper distance
    const d = dist2(p.pos.x, p.pos.z, target.pos.x, target.pos.z);
    const want = 1.2;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const shift = d - want;
    this.audio.play('kick_whoosh', p.pos);
    this.audio.play('leon_grunt', p.pos);
    let hitDone = false;
    const startX = p.pos.x, startZ = p.pos.z;
    p.doAction({
      name: 'kick',
      clip: L.kick,
      invuln: true,
      update: (_dt, t) => {
        const u = Math.min(1, t / 0.25);
        p.pos.x = startX + fx * shift * u;
        p.pos.z = startZ + fz * shift * u;
      },
      onEvent: (e) => {
        if (e !== 'hit' || hitDone) return;
        hitDone = true;
        this.hitStop(0.06);
        this.camera.shake(0.25);
        this.audio.play('kick_hit', target.center, 1.1);
        const dir = new THREE.Vector3(fx, 0, fz);
        target.takeDamage({ dmg: 260, zone: 'head', dir, kind: 'kick' });
        // area knockdown
        for (const e of this.enemies) {
          if (e === target || !e.alive) continue;
          const dd = dist2(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
          if (dd < 2.6 && Math.abs(e.pos.y - p.pos.y) < 1) {
            const dd2 = new THREE.Vector3(e.pos.x - p.pos.x, 0, e.pos.z - p.pos.z).normalize();
            e.takeDamage({ dmg: 90, zone: 'torso', dir: dd2, kind: 'kick' });
          }
        }
      },
    });
  }

  private doSuplex(target: Enemy) {
    const p = this.player;
    // position behind target, facing same direction
    const bx = target.pos.x + Math.sin(target.yaw) * 0.55, bz = target.pos.z + Math.cos(target.yaw) * 0.55;
    p.pos.x = bx;
    p.pos.z = bz;
    p.yaw = target.yaw;
    target.state = 'suplexed';
    target.stateT = 0;
    target.releaseToken();
    target.anim.play(GC.suplexed, { fade: 0.05, restart: true });
    target.vx = target.vz = 0;
    this.audio.play('leon_grunt', p.pos);
    let done = false;
    p.doAction({
      name: 'suplex',
      clip: L.suplex,
      invuln: true,
      onEvent: (e) => {
        if (e !== 'hit' || done) return;
        done = true;
        this.hitStop(0.08);
        this.camera.shake(0.4);
        target.takeDamage({ dmg: 800, zone: 'head', dir: new THREE.Vector3(Math.sin(target.yaw), 0, Math.cos(target.yaw)), kind: 'suplex' });
        this.fx.dust(target.pos.clone().add(new THREE.Vector3(Math.sin(target.yaw) * 1.2, 0.1, Math.cos(target.yaw) * 1.2)), 10, 0.5);
      },
    });
  }

  private doStab(target: Enemy) {
    const p = this.player;
    p.yaw = yawFromDir(target.pos.x - p.pos.x, target.pos.z - p.pos.z);
    p.knife = Math.max(0, p.knife - 25);
    let done = false;
    p.doAction({
      name: 'stab',
      clip: L.knifeStab,
      invuln: false,
      onEvent: (e) => {
        if (e !== 'hit' || done) return;
        done = true;
        this.audio.play('knife_hit', target.center);
        this.fx.blood(target.center, new THREE.Vector3(0, 1, 0), 1);
        target.takeDamage({ dmg: 190, zone: 'torso', dir: new THREE.Vector3(0, -1, 0), kind: 'knife' });
      },
    });
  }

  private doStealth(target: Enemy) {
    const p = this.player;
    const bx = target.pos.x + Math.sin(target.yaw) * 0.6, bz = target.pos.z + Math.cos(target.yaw) * 0.6;
    p.pos.x = bx;
    p.pos.z = bz;
    p.yaw = target.yaw;
    p.knife = Math.max(0, p.knife - 90);
    target.vx = target.vz = 0;
    target.state = 'suplexed'; // freeze AI briefly
    target.stateT = -10;
    let done = false;
    p.doAction({
      name: 'stealth',
      clip: L.stealthKill,
      invuln: true,
      onEvent: (e) => {
        if (e !== 'hit' || done) return;
        done = true;
        this.audio.play('knife_hit', target.center, 1.2);
        this.fx.blood(target.headPos, new THREE.Vector3(0, 0.2, 0), 1.2);
        target.state = 'react';
        target.takeDamage({ dmg: 99999, zone: 'head', dir: new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)), kind: 'stealth' });
      },
    });
  }

  knifeSlashHit() {
    this.combat.knifeSlash(this.player);
  }

  onParry(e: Enemy, kind: 'perfect' | 'normal') {
    this.stats.parries++;
    this.audio.play(kind === 'perfect' ? 'parry_perfect' : 'parry', e.center);
    this.fx.sparks(this.player.center.clone().lerp(e.center, 0.5), kind === 'perfect' ? 30 : 16);
    this.hitStop(kind === 'perfect' ? 0.12 : 0.05);
    this.camera.shake(0.2);
    if (e.isSalvador) {
      e.stagger(kind === 'perfect' ? 'staggerHead' : 'flinch', kind === 'perfect' ? 1.9 : 0.8);
    } else e.stagger('staggerHead', kind === 'perfect' ? 2.0 : 1.4);
    this.hud.toast(kind === 'perfect' ? '完美格挡!' : '格挡');
  }

  hitStop(t: number) {
    this.hitStopT = Math.max(this.hitStopT, t);
  }

  // ------------------------------------------------------------------ damage & events

  enemyDamageMult(): number {
    return this.diff.enemyDamage * this.dda.damageMult();
  }

  damagePlayer(amount: number, from: THREE.Vector3, kind: 'light' | 'heavy' | 'explosion' | 'dot') {
    this.player.hurt(amount, from, kind);
  }

  onPlayerDamaged(amount: number) {
    this.stats.damage += amount;
    this.dda.onPlayerDamaged(amount);
  }

  onPlayerDeath() {
    this.dda.onPlayerDeath();
    this.deadT = 0;
    this.input.exitLock();
    this.setState('dead');
    this.hud.setPrompt('', 'F');
    this.audio.music?.setMode('none');
  }

  onDecapitation(e: Enemy) {
    const p = this.player;
    p.grabbedBy = null;
    p.state = 'locked';
    p.yaw = yawFromDir(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    p.anim.play(L.grabbed, { fade: 0.1 });
    this.camera.override = {
      pos: e.pos.clone().add(new THREE.Vector3(Math.cos(e.yaw) * 2.8, 1.7, -Math.sin(e.yaw) * 2.8)),
      look: p.pos.clone().add(new THREE.Vector3(0, 1.4, 0)),
      fov: 45,
      blend: 1,
    };
    this.audio.play('grab', p.pos);
    setTimeout(() => {
      this.audio.play('decap', p.pos);
      p.decapitate();
      this.camera.shake(0.8);
      this.renderer.post.damage = 1;
      p.hp = 0;
      p.die(false, true);
      setTimeout(() => (this.camera.override = null), 2500);
    }, 1100);
  }

  onEnemyKilled(e: Enemy, info: DamageInfo) {
    this.stats.kills++;
    this.player.kills++;
    this.dda.onKill();
    if (e.tag) this.flags['dead_' + e.tag] = true;
    this.area?.onEnemyKilled?.(this, e);
    if (e.noDrop) return;
    const pos = new THREE.Vector3(e.pos.x, 0, e.pos.z);
    pos.y = this.level!.cw.groundHeight(pos.x, pos.z, e.pos.y + 0.5);
    if (e.isSalvador) {
      this.spawnPickup('ruby', 1, pos.clone().add(new THREE.Vector3(0.3, 0, 0)));
      this.spawnPickup('pesetas', 5000, pos.clone().add(new THREE.Vector3(-0.3, 0, 0.2)));
      this.spawnPickup('ammo_sg', 4, pos.clone().add(new THREE.Vector3(0, 0, -0.4)));
      return;
    }
    if (e.drop) {
      this.spawnPickup(e.drop, 1, pos);
      return;
    }
    const drop = this.dda.rollDrop(this.inv, this.player.hp / this.player.maxHp, this.diff.lootMult);
    if (drop) {
      // drop a moment later (RE4 bodies "dissolve" the item out)
      const [id, n] = drop;
      setTimeout(() => {
        if (this.level && this.enemies.includes(e)) this.spawnPickup(id, n, pos);
      }, 900);
    }
    void info;
  }

  alertNoise(pos: THREE.Vector3, radius: number) {
    for (const e of this.enemies) {
      if (!e.alive || e.aware) continue;
      const d = e.pos.distanceTo(pos);
      if (d < radius) e.becomeAware(0.3 + d * 0.03, d < 8);
    }
  }

  // ------------------------------------------------------------------ spawning

  spawnEnemy(sp: EnemySpawn): Enemy | null {
    if (sp.tag && this.flags['dead_' + sp.tag]) return null;
    const e = new Enemy(this, sp);
    this.enemies.push(e);
    return e;
  }

  spawnProjectile(kind: ProjKind, from: THREE.Vector3, target: THREE.Vector3, owner: Enemy | null, fuse = 2) {
    this.projectiles.push(new Projectile(this, kind, from, target, owner, fuse));
  }

  spawnPickup(id: string, count: number, pos: THREE.Vector3, flag?: string): Pickup | null {
    if (flag && this.flags['got_' + flag]) return null;
    if (id === 'ammo_rf' && !this.inv.hasWeapon('sr1903') && !flag) id = 'ammo_hg';
    if (id === 'ammo_sg' && !this.inv.hasWeapon('w870') && !flag) {
      id = 'ammo_hg';
      count = 5;
    }
    const pk = new Pickup(this, id, count, pos, flag);
    this.pickups.push(pk);
    return pk;
  }

  spawnAnimal(kind: 'chicken' | 'crow', pos: THREE.Vector3) {
    this.animals.push(new Animal(this, kind, pos));
  }

  takePickup(pk: Pickup) {
    const p = this.player;
    if (pk.taken) return;
    if (pk.id === 'pesetas') {
      this.inv.pesetas += pk.count;
      this.stats.pesetas += pk.count;
      this.audio.play('pesetas');
      this.hud.pesetas(this.inv.pesetas, pk.count);
    } else {
      const d = ITEMS[pk.id];
      const left = this.inv.add(pk.id, pk.count);
      if (left === pk.count) {
        this.audio.play('ui_error');
        this.pendingPickup = pk;
        this.hud.toast('手提箱空间不足 —— 整理后再拾取');
        this.openInventory(pk);
        return;
      }
      if (left > 0) {
        pk.count = left;
        this.hud.toast(`拾取 ${d.name} (剩余 ${left} 放不下)`);
        this.audio.play('pickup');
        return;
      }
      this.audio.play('pickup');
      this.hud.pickupFeed(pk.label());
      if (d.kind === 'weapon' && d.weapon) this.hud.toast(`获得 ${d.name}！按数字键切换`);
    }
    pk.taken = true;
    if (pk.flag) this.flags['got_' + pk.flag] = true;
    pk.dispose();
    this.pickups = this.pickups.filter((x) => x !== pk);
    p.doAction({ name: 'pickup', clip: L.pickup, upper: false, dur: 0.45, lockMove: true });
  }

  dropProp(obj: THREE.Object3D, pos: THREE.Vector3, q: THREE.Quaternion) {
    this.scene.add(obj);
    this.props.push(new DroppedProp(obj, pos, q));
  }

  explode(pos: THREE.Vector3, radius: number, dmg: number, source: string) {
    this.combat.explode(pos, radius, dmg, source);
  }

  flashBang(pos: THREE.Vector3) {
    this.fx.flash(pos);
    this.audio.play('flash_bang', pos);
    const cam = this.camera.cam;
    const toF = pos.clone().sub(cam.position);
    const d = toF.length();
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const facing = toF.normalize().dot(fwd);
    if (d < 25 && facing > 0.2 && this.level!.cw.clear(cam.position, pos, 'sight')) this.renderer.post.flash = Math.min(1, (1 - d / 25) * facing * 1.4);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ed = e.headPos.distanceTo(pos);
      if (ed < 10 && this.level!.cw.clear(e.headPos, pos, 'sight')) e.stun(e.isSalvador ? 3.5 : 4.5);
    }
    this.alertNoise(pos, 25);
  }

  throwGrenade(id: string) {
    const p = this.player;
    if (p.state !== 'move' || p.action) return;
    if (this.inv.count(id) <= 0) return;
    this.inv.take(id, 1);
    const target = p.aimPoint.clone();
    const flat = new THREE.Vector3(target.x - p.pos.x, 0, target.z - p.pos.z);
    if (flat.length() > 16) {
      flat.setLength(16);
      target.set(p.pos.x + flat.x, target.y, p.pos.z + flat.z);
    }
    if (flat.length() < 3) {
      const f = this.camera.forward(new THREE.Vector3()).setY(0).normalize();
      target.set(p.pos.x + f.x * 8, p.pos.y, p.pos.z + f.z * 8);
      target.y = this.level!.cw.groundHeight(target.x, target.z, p.pos.y + 1);
    }
    p.yaw = this.camera.yaw;
    let released = false;
    p.doAction({
      name: 'throw',
      clip: L.throwNade,
      upper: true,
      onEvent: (e) => {
        if (e !== 'release' || released) return;
        released = true;
        const from = p.rig.bones[B.rHand].getWorldPosition(new THREE.Vector3());
        this.spawnProjectile(id === 'nade' ? 'nade' : 'flash', from, target, null, id === 'nade' ? 2.0 : 1.3);
        this.audio.play('throw', from);
      },
    });
  }

  quickHeal() {
    const p = this.player;
    if (p.hp >= p.maxHp) {
      this.hud.toast('体力已满');
      return;
    }
    const missing = p.maxHp - p.hp;
    const heals = this.inv.items.filter((i) => ITEMS[i.id].heal !== undefined && ITEMS[i.id].heal !== 0);
    if (!heals.length) {
      this.hud.toast('没有回复道具');
      this.audio.play('ui_error');
      return;
    }
    // choose the smallest heal that covers the missing amount, else the biggest
    const amt = (i: ItemInst) => (ITEMS[i.id].heal === -1 ? p.maxHp : ITEMS[i.id].heal!);
    heals.sort((a, b) => amt(a) - amt(b));
    const pick = heals.find((h) => amt(h) >= missing) ?? heals[heals.length - 1];
    this.useItem(pick);
  }

  useItem(it: ItemInst): boolean {
    const p = this.player;
    const d = ITEMS[it.id];
    if (d.heal === undefined) {
      this.hud.toast('无法单独使用');
      return false;
    }
    if (d.maxUp) p.maxHp += d.maxUp;
    const amt = d.heal === -1 ? p.maxHp : d.heal;
    p.hp = Math.min(p.maxHp, p.hp + amt);
    this.inv.take(it.id, 1);
    if (it.count <= 0 || !this.inv.items.includes(it)) this.inv.remove(it);
    this.audio.play('heal');
    this.hud.toast(`使用 ${d.name}`);
    return true;
  }

  trapPlayer() {
    const p = this.player;
    p.hurt(180 * this.enemyDamageMult(), p.pos.clone().add(new THREE.Vector3(0, 0, 0.1)), 'dot');
    this.audio.play('leon_hurt_big', p.pos);
    this.camera.shake(0.5);
    this.renderer.post.damage = 1;
    p.state = 'locked';
    this.hud.toast('踩到捕兽夹！');
    setTimeout(() => {
      if (p.state === 'locked') p.state = 'move';
    }, 1500);
  }

  onMedallion() {
    const n = ((this.flags.medallions as number) ?? 0) + 1;
    this.flags.medallions = n;
    const total = (this.flags.medallionsTotal as number) ?? 5;
    this.hud.toast(`蓝色徽章 ${n}/${total}`);
    if (n >= total) {
      this.hud.toast('委托完成：击碎所有蓝色徽章！去找商人领取奖励');
      this.flags.medallionsDone = true;
    }
  }

  // ------------------------------------------------------------------ doors, ladders, barricades

  hasKey(id: string) {
    return this.inv.count(id) > 0;
  }

  useDoor(door: Door) {
    const p = this.player;
    if (door.locked && !door.open) {
      if (this.hasKey(door.locked)) {
        door.locked = null;
        this.audio.play('metal', new THREE.Vector3(door.x, door.y + 1, door.z));
        this.hud.toast('打开了锁');
      } else {
        this.audio.play('door_bash', new THREE.Vector3(door.x, door.y + 1, door.z), 0.4);
        this.hud.toast('门锁住了');
        return;
      }
    }
    if (door.open) {
      setDoorOpen(door, false, door.openSign);
      this.audio.play('door_close', new THREE.Vector3(door.x, door.y + 1, door.z));
    } else {
      // kick open if running
      this.openDoor(door, p.pos, p.sprinting);
    }
  }

  openDoor(door: Door, from: THREE.Vector3, kick = false) {
    const c = Math.cos(door.rot), s = Math.sin(door.rot);
    // door normal (local +z) in world
    const nx = s, nz = c;
    const side = (from.x - door.x) * nx + (from.z - door.z) * nz > 0 ? 1 : -1;
    // swing away from opener
    setDoorOpen(door, true, side);
    this.audio.play(kick ? 'door_bash' : 'door_open', new THREE.Vector3(door.x, door.y + 1, door.z));
    if (kick) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = dist2(e.pos.x, e.pos.z, door.x, door.z);
        if (d < 1.8) e.takeDamage({ dmg: 60, zone: 'torso', dir: new THREE.Vector3(-nx * side, 0, -nz * side), kind: 'kick' });
      }
    }
  }

  breakDoor(door: Door) {
    door.broken = true;
    door.collider.enabled = false;
    door.pivot.visible = false;
    this.fx.splinters(new THREE.Vector3(door.x, door.y + 1.1, door.z), 30);
    this.audio.play('wood_break', new THREE.Vector3(door.x, door.y + 1, door.z));
  }

  pushShelf(s: Shelf) {
    if (s.pushed) return;
    const p = this.player;
    s.pushed = true;
    s.target.barricade = s;
    if (s.target.kind === 'window' && s.target.link) {
      // keep link; enemies bash the barricade when they reach it
    }
    p.yaw = yawFromDir(s.toX - s.fromX, s.toZ - s.fromZ);
    p.doAction({ name: 'push', clip: L.push, dur: 1.1, invuln: false });
    this.audio.play('door_bash', s.mesh.position, 0.5, 0.6);
  }

  destroyShelf(s: Shelf) {
    s.destroyed = true;
    s.collider.enabled = false;
    s.mesh.visible = false;
    this.fx.splinters(s.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 40);
    this.audio.play('wood_break', s.mesh.position);
    if (s.target.kind === 'door') {
      this.openDoor(s.target, s.mesh.position, true);
    }
  }

  enemyOnLadder(l: Ladder): boolean {
    return l.users > 0 || this.enemies.some((e) => e.alive && e.climbing === l);
  }

  pushLadder(l: Ladder) {
    if (l.down) return;
    l.down = true;
    l.raiseTimer = 0;
    if (l.link) l.link.enabled = false;
    this.audio.play('ladder_fall', new THREE.Vector3(l.tx, l.ty, l.tz));
    const p = this.player;
    p.doAction({ name: 'push', clip: L.push, dur: 0.6 });
    for (const e of this.enemies) if (e.climbing === l && e.state === 'traverse') e.fallOffLadder();
    this.hud.toast('推倒了梯子');
  }

  damageBreakable(b: Breakable, dmg: number, p: THREE.Vector3) {
    if (b.broken) return;
    b.hp -= dmg;
    this.audio.play('thud', p, 0.4, 1.4);
    if (b.hp > 0) return;
    b.broken = true;
    b.collider.enabled = false;
    b.mesh.visible = false;
    this.fx.splinters(new THREE.Vector3(b.x, b.y, b.z), 25);
    this.audio.play('wood_break', new THREE.Vector3(b.x, b.y, b.z));
    if (b.onBreak) b.onBreak(this);
    if (b.loot) {
      let drop: [string, number] | null = null;
      if (b.loot === 'auto') drop = this.dda.rollDrop(this.inv, this.player.hp / this.player.maxHp, this.diff.lootMult * 0.9);
      else {
        const [id, n] = b.loot.split(':');
        drop = [id, parseInt(n ?? '1') || 1];
      }
      if (drop) this.spawnPickup(drop[0], drop[1], new THREE.Vector3(b.x, b.y - b.height / 2 + 0.02, b.z));
    }
  }

  // ------------------------------------------------------------------ menus

  pause() {
    if (this.state !== 'play') return;
    this.setState('pause');
    this.input.exitLock();
    this.hud.showPause(true);
  }

  resume() {
    if (this.state !== 'pause' && this.state !== 'inventory' && this.state !== 'merchant') return;
    this.hud.showPause(false);
    this.setState('play');
    this.input.clearAll();
    if (!this.test) this.input.requestLock();
    this.audio.music?.setMode('game');
  }

  openInventory(pending?: Pickup) {
    this.setState('inventory');
    this.input.exitLock();
    this.hud.openCase(pending ?? null);
  }

  openMerchant() {
    this.setState('merchant');
    this.input.exitLock();
    this.audio.music?.setMode('merchant');
    this.hud.openMerchant();
  }

  // ------------------------------------------------------------------ cutscenes

  playCutscene(steps: CutStep[], onEnd?: () => void, skippable = true) {
    this.cutscene = { steps, i: -1, t: 0, onEnd, skippable };
    this.nextCutStep();
  }

  private nextCutStep() {
    const c = this.cutscene!;
    c.i++;
    c.t = 0;
    if (c.i >= c.steps.length) {
      this.endCutscene();
      return;
    }
    const s = c.steps[c.i];
    s.onStart?.(this);
    if (s.sub !== undefined) this.hud.subtitle(s.sub, s.dur);
    if (s.cam) this.camera.override = { pos: s.cam.pos.clone(), look: s.cam.look.clone(), fov: s.cam.fov ?? 50, blend: this.camera.override ? this.camera.override.blend : 0 };
  }

  private updateCutscene(dt: number) {
    const c = this.cutscene!;
    const post = this.renderer.post;
    post.letterbox = Math.min(1, post.letterbox + dt * 2);
    c.t += dt;
    const s = c.steps[c.i];
    if (this.camera.override) {
      if (s?.cam) this.camera.override.blend = Math.min(1, this.camera.override.blend + dt * 2.5);
      else this.camera.override.blend = Math.max(0, this.camera.override.blend - dt * 2.5);
    }
    if (c.skippable && c.t > 0.4 && (this.input.pressed('interact') || this.input.pressed('pause'))) {
      while (this.cutscene && this.cutscene.i < this.cutscene.steps.length) {
        this.nextCutStep();
      }
      return;
    }
    if (s && c.t >= s.dur) this.nextCutStep();
  }

  private endCutscene() {
    const c = this.cutscene;
    this.cutscene = null;
    this.camera.override = null;
    this.hud.subtitle('', 0);
    this.renderer.post.letterbox = 0;
    if (this.player.state === 'locked') this.player.state = 'move';
    c?.onEnd?.();
  }

  // ------------------------------------------------------------------ render

  render() {
    this.renderer.render(this.scene, this.camera.cam, this.time);
  }

  resize(w: number, h: number) {
    this.renderer.resize(w, h);
    this.camera.cam.aspect = w / Math.max(1, h);
    this.camera.cam.updateProjectionMatrix();
  }

  applySettings() {
    const s = this.settings;
    this.camera.sens = s.sens;
    this.camera.invertY = s.invertY;
    this.camera.fovBase = s.fov;
    if (this.renderer.quality !== s.quality) {
      this.renderer.setQuality(s.quality);
      this.sun.shadow.mapSize.set(this.renderer.shadowMapSize, this.renderer.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.fx.gore = s.gore;
    this.audio.tts = s.tts;
    this.audio.volumes.master = s.master;
    this.audio.volumes.music = s.music;
    this.audio.volumes.sfx = s.sfx;
    this.audio.applyVolumes();
    try {
      localStorage.setItem('re4v_settings', JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('re4v_settings');
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch {
      /* ignore */
    }
    this.applySettings();
  }

  get weaponName(): string {
    const w = this.player.weapon;
    return w?.weapon ? WEAPONS[w.weapon.id].name : '';
  }
}

export { rng };
