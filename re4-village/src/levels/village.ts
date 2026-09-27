import * as THREE from 'three';
import { Level } from '../world/level';
import { buildHouse, crate, barrel, fence, makeShelf, table, chair, bed, boundary, forestFill, hay, cart, well, lantern, staticBox, haystack, makeLadder } from '../world/props';
import { bigGate, church, clothesline, extLadder, merchant, pyre, scatter, signPost, typewriter, watchtower } from './common';
import { worldMat } from '../render/textures';
import { distToSegment, dist2 } from '../core/math';
import { rng } from '../core/rng';
import type { AreaInstance } from './area';
import type { Game } from '../game/game';
import type { Enemy, EnemyKind } from '../game/enemies/enemy';

const ROADS: [number, number][][] = [
  [[0, 64], [0, 30], [0, 6]],
  [[0, -8], [2, -30]],
  [[6, -4], [28, -16], [50, -24]],
  [[-8, 2], [-30, 8], [-54, 4]],
];

function nearRoad(x: number, z: number, w: number) {
  for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) if (distToSegment(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]) < w) return true;
  return false;
}

function at(tw: (x: number, z: number) => [number, number], lx: number, lz: number, y: number) {
  const [x, z] = tw(lx, lz);
  return new THREE.Vector3(x, y, z);
}

const SPAWNS: [number, number][] = [
  [-50, 4], [-44, -26], [-22, -46], [18, -46], [40, -8], [44, 20], [22, 46], [-30, 42], [0, 56], [-46, 24],
];

export function buildVillage(g: Game): AreaInstance {
  rng.seed(2002);
  const L = new Level('village', {
    minX: -58, maxX: 58, minZ: -62, maxZ: 62, cell: 1, amp: 1.2, freq: 0.03, seed: 23,
    flats: [
      { x: 0, z: 0, r: 30, h: 0, falloff: 10 },
      { x: 0, z: -40, hx: 10, hz: 16, h: 0.2, falloff: 6 },
      { x: 40, z: -22, hx: 10, hz: 8, h: 0.1, falloff: 6 },
    ],
    paths: ROADS.map((pts) => ({ pts, width: 6 })),
    rim: { height: 11, inset: 12 },
    grassColor: 0x9a9470,
    dirtColor: 0xb4a080,
  });

  // --- the siege house (two floors, loft)
  const h1 = buildHouse(L, {
    x: -21, z: -8, rot: Math.PI / 2, w: 11, d: 9, floors: 2, loft: 0.6, mat: 'plaster',
    doors: [{ side: 's', off: 2.5 }, { side: 'n', off: -3 }],
    windows: [
      { side: 'w', off: 1.5, floor: 0 },
      { side: 'e', off: -1.5, floor: 0 },
      { side: 'n', off: 1.5, floor: 1 },
      { side: 'e', off: -2.3, floor: 1 },
      { side: 'w', off: -2.3, floor: 1 },
    ],
    interiorLadder: { lx: 3.2 },
  });
  const hw = h1.toWorld;
  const hb = h1.base;
  {
    const [t1x, t1z] = hw(-2.5, 2.5);
    table(L, t1x, t1z, hb, 0);
    chair(L, ...hw(-2.5, 3.4), hb, 0.2);
    const [t2x, t2z] = hw(-3.2, -3.4);
    table(L, t2x, t2z, hb + 3, Math.PI / 2, 1.2, 0.7);
    bed(L, ...hw(1.4, -3.2), hb + 3, 0);
    barrel(L, ...hw(4.6, 3.6), null);
    // barricade shelves
    const front = h1.doors[0], back = h1.doors[1];
    makeShelf(L, ...hw(-0.2, 3.9), ...hw(2.5, 3.9), Math.PI / 2, hb, front);
    makeShelf(L, ...hw(-0.8, -3.95), ...hw(-3, -3.95), Math.PI / 2, hb, back);
    const gwin = h1.windows.find((w) => w.y < hb + 1 && w.nz > 0.5);
    if (gwin) {
      const [sx, sz] = hw(-0.8, 2.6);
      makeShelf(L, sx, sz, gwin.x - gwin.nx * 0.55, gwin.z - gwin.nz * 0.55, 0, hb, gwin);
    }
    lantern(L, ...hw(0, 0), hb + 2.5, true);
    // exterior ladders on upper windows (back and north)
    for (const w of h1.windows) {
      if (w.y < hb + 1) continue;
      if (w.nz > 0.5) continue; // south upper window: jump-out only
      extLadder(L, w, 1.35);
    }
  }

  // --- other houses
  const h2 = buildHouse(L, { x: 19, z: -16, rot: -Math.PI / 2, w: 9, d: 7, floors: 1, mat: 'stone', doors: [{ side: 's', off: 1.5 }], windows: [{ side: 'e', off: 0 }, { side: 'w', off: 1 }, { side: 'n', off: -1.5 }] });
  typewriter(L, g, ...h2.toWorld(-2.8, -2.2), Math.PI / 2, h2.base);
  table(L, ...h2.toWorld(2, -1.8), h2.base, 0);
  const h3 = buildHouse(L, { x: 25, z: 15, rot: -Math.PI / 2, w: 9, d: 7, floors: 1, mat: 'wood', roofMat: 'thatch', doors: [{ side: 's', off: 0, w: 3 }], windows: [{ side: 'n', off: 2 }] });
  hay(L, ...h3.toWorld(-2.5, -2), 0.1);
  hay(L, ...h3.toWorld(-2.5, -0.8), 0.1);
  hay(L, ...h3.toWorld(2.8, -2.4), 1.6);
  const h4 = buildHouse(L, { x: -22, z: 19, rot: Math.PI / 2, w: 8, d: 6, floors: 1, mat: 'plaster', doors: [{ side: 's', off: -1.5 }], windows: [{ side: 'e', off: 0 }, { side: 'w', off: 1.2 }, { side: 'n', off: 1.5 }] });
  table(L, ...h4.toWorld(1.5, 0.5), h4.base, 0.3);
  bed(L, ...h4.toWorld(-2.6, -1.6), h4.base, 0);
  const h5 = buildHouse(L, { x: 11, z: 34, rot: Math.PI, w: 6, d: 5, floors: 1, mat: 'wood', roofMat: 'thatch', doors: [{ side: 's', off: 0.8 }], windows: [{ side: 'e', off: 0 }] });
  void h5;
  const h6 = buildHouse(L, { x: -8, z: -26, rot: 0, w: 7, d: 6, floors: 1, mat: 'stone', doors: [{ side: 's', off: 1.2 }], windows: [{ side: 'w', off: 0 }, { side: 'e', off: 0.5 }] });
  table(L, ...h6.toWorld(-1.5, -1), h6.base, 0);
  const h7 = buildHouse(L, { x: 30, z: 36, rot: Math.PI * 1.1, w: 7, d: 6, floors: 1, mat: 'plaster', doors: [{ side: 's', off: 0 }], windows: [{ side: 'w', off: 0 }] });
  void h7;

  // --- church, watchtower, pyre, well, gate
  const ch = church(L, 0, -48, 0);
  const wt = watchtower(L, 35, -2, -1);
  makeLadder(L, {
    bx: 33.1, bz: -2, by: L.h(33.1, -2), tx: 33.62, tz: -2, ty: wt.top, ex: 35, ez: -2, ey: wt.top, facing: -Math.PI / 2, pushable: false,
  });
  pyre(L, 0, 0);
  well(L, -8, 12);
  const gate = bigGate(L, 49, -24, Math.PI / 2, 18);
  // winch next to the gate
  const winchPos = new THREE.Vector3(46.5, L.h(46.5, -29), -29);
  staticBox(L, winchPos.x, winchPos.z, 0.6, 1.1, 0.6, 0, worldMat('darkwood'));
  staticBox(L, winchPos.x, winchPos.z, 0.9, 0.3, 0.3, 0, worldMat('metal', 0x888888), winchPos.y + 1.0, false);
  L.interactables.push({
    x: winchPos.x, y: winchPos.y + 1, z: winchPos.z, radius: 1.8, enabled: true, priority: 3,
    prompt: (gg) => (gate.isOpen ? null : gg.hasKey('crank') ? '装上摇柄，打开大门' : '绞盘（缺少摇柄）'),
    use: (gg) => {
      if (gate.isOpen) return;
      if (!gg.hasKey('crank')) {
        gg.hud.toast('需要一个摇柄才能转动绞盘');
        gg.audio.play('ui_error');
        return;
      }
      gg.flags.village_gate_open = true;
      gg.audio.play('crank', winchPos);
      gate.open(gg);
      gg.hud.objective('穿过大门前往农场');
    },
  });

  // --- props
  for (const [x, z, r] of [[8, 8, 0.6], [-12, -4, 1.2], [14, -4, 2.4], [-4, 26, 0.2], [30, -26, 1]] as [number, number, number][]) cart(L, x, z, r);
  for (const [x, z] of [[12, 12], [12.7, 11.1], [-14, 6], [5, -16], [22, -24], [-30, -2], [26, 3], [-26, 30]]) crate(L, x, z, rng.range(0, 1));
  for (const [x, z] of [[13.5, 12.2], [-15, 7.5], [-29, -15], [16, -24], [6, 22], [27, 5], [-2, -18]]) barrel(L, x, z);
  for (const [x, z, r] of [[20, 6, 0.3], [18, 23, 1.2], [-32, 22, 0.1], [-16, -18, 0.8]] as [number, number, number][]) hay(L, x, z, r);
  haystack(L, 30, 24, 1.6);
  haystack(L, -34, 30, 1.3);
  fence(L, [[-30, 26], [-16, 28], [-12, 34]]);
  fence(L, [[16, 26], [20, 30], [34, 28]]);
  fence(L, [[-40, -12], [-36, -26], [-26, -34]]);
  fence(L, [[14, -34], [24, -38], [36, -34]]);
  clothesline(L, -14, 26, -8, 28);
  clothesline(L, 16, -28, 22, -30);
  signPost(L, 3, 44, 0.2);
  for (const [x, z] of [[4, 16], [-5, -12], [16, -8], [-14, 14]]) {
    staticBox(L, x, z, 0.12, 2.6, 0.12, 0, worldMat('darkwood'));
    lantern(L, x, z, L.h(x, z) + 2.5, false);
  }
  // vegetation
  forestFill(L, -54, -58, 54, 58, 6.5, (x, z) => Math.hypot(x, z) < 42 || nearRoad(x, z, 10) || (x > 36 && Math.abs(z + 24) < 12), 0.04);
  scatter(L, -54, -58, 54, 58, 1500, (x, z) => nearRoad(x, z, 3) || Math.hypot(x, z - 0) < 4, ['grass', 'grass', 'grass', 'bush', 'rock', 'dead']);
  boundary(L, [[-50, 60], [50, 60], [50, -58], [-50, -58], [-50, 60]]);

  L.finalize();

  const churchDoor = ch.doorPos;
  const siege = { t: 0, spawnT: 0, salvador: false, dyn: false, bell: false, bellT: 0 };

  const area: AreaInstance = {
    id: 'village',
    name: '村庄',
    level: L,
    entries: {
      south: { x: 0, z: 54, yaw: 0 },
      farmgate: { x: 44, z: -23, yaw: -Math.PI / 2 },
      house: { x: -19, z: -10, yaw: Math.PI / 2 },
    },
    fog: { color: 0x8a8070, density: 0.022 },
    sky: { top: 0x6a6660, bottom: 0xa89878 },
    sunDir: new THREE.Vector3(0.6, 0.5, 0.55).normalize(),
    sunColor: 0xffc890,
    sunIntensity: 2.0,
    hemi: { sky: 0xc8b8a0, ground: 0x4a4034, intensity: 1.5 },
    exposure: 1.12,
    ambience: 'village',
    spawn(gg: Game) {
      const f = gg.flags;
      if (!f.siege_done) {
        // villagers gathered around the pyre
        for (let i = 0; i < 4; i++) {
          const a = -0.6 + i * 0.5 + Math.PI / 2;
          const x = Math.cos(a) * 4, z = Math.sin(a) * 4;
          gg.spawnEnemy({ kind: i === 1 ? 'villager_f' : i === 3 ? 'pitchfork' : 'villager', x, z, yaw: Math.atan2(x, z), state: 'idle', tag: 'pyre' + i });
        }
        gg.spawnEnemy({ kind: 'villager', x: 18, z: 10, yaw: 1.2, state: 'work', weapon: 'axe', tag: 'v_farmer' });
        gg.spawnEnemy({ kind: 'villager_f', x: -6.5, z: 9.5, yaw: -2.2, state: 'idle', tag: 'v_well' });
        gg.spawnEnemy({ kind: 'villager', x: -8, z: -27, yaw: 0.4, state: 'idle', weapon: 'sickle', tag: 'v_h6' });
        gg.spawnEnemy({ kind: 'thrower', x: 35, z: -2, y: wt.top, yaw: -1.4, state: 'idle', tag: 'v_tower' });
        gg.spawnEnemy({ kind: 'pitchfork', x: -16, z: 23, state: 'patrol', patrol: [[-16, 23], [-10, 30], [-18, 32]], tag: 'v_patrol' });
      }
      // items
      gg.spawnPickup('w870', 1, at(hw, -3.2, -3.4, hb + 3.84), 'v_shotgun');
      gg.spawnPickup('ammo_sg', 6, at(hw, -2.6, -3.1, hb + 3.84), 'v_sgammo');
      gg.spawnPickup('crank', 1, new THREE.Vector3(35.6, wt.top + 0.05, -1.4), 'v_crank');
      gg.spawnPickup('herb_g', 1, at(h4.toWorld, 1.5, 0.5, h4.base + 0.83), 'v_herb1');
      gg.spawnPickup('herb_r', 1, new THREE.Vector3(-3, L.h(-3, 30), 30), 'v_herbr');
      gg.spawnPickup('ammo_hg', 10, at(h6.toWorld, -1.5, -1, h6.base + 0.83), 'v_ammo1');
      gg.spawnPickup('antique_pipe', 1, at(h2.toWorld, 2, -1.8, h2.base + 0.83), 'v_pipe');
      gg.spawnPickup('pesetas', 1200, new THREE.Vector3(27, L.h(27, 17), 17), 'v_pes1');
      gg.spawnPickup('gunpowder', 2, new THREE.Vector3(-30, L.h(-30, 23), 23), 'v_gp');
      gg.spawnPickup('flash', 1, new THREE.Vector3(10, L.h(10, 36), 36), 'v_flash');
      gg.spawnPickup('nade', 1, new THREE.Vector3(-20, L.h(-20, 18), 18.5), 'v_nade');
      for (const [x, z] of [[-18, 27], [-15, 29], [-20, 31], [-13, 25]]) gg.spawnAnimal('chicken', new THREE.Vector3(x, 0, z));
      for (const [x, z] of [[14, 26.5], [18, 29.7]]) gg.spawnAnimal('crow', new THREE.Vector3(x, L.h(x, z) + 1.25, z));
      if (f.siege_done) merchant(L, gg, 41, -17, -Math.PI / 2 - 0.4);
      siege.t = 0;
      siege.spawnT = 0;
      siege.salvador = false;
      siege.dyn = false;
      siege.bell = false;
      siege.bellT = 0;
      if (f.village_gate_open) gate.open(gg);
    },
    onEnter(gg: Game, entry: string) {
      const f = gg.flags;
      if (f.siege_done) {
        gg.hud.objective(f.village_gate_open ? '穿过大门前往农场' : gg.hasKey('crank') ? '用摇柄打开东边的大门' : '寻找打开东边大门的方法（瞭望塔？）');
        return;
      }
      if (entry === 'south' && !f.village_intro) {
        f.village_intro = true;
        gg.playCutscene([
          { dur: 3.6, cam: { pos: new THREE.Vector3(-3, 6, 34), look: new THREE.Vector3(0, 2, 0), fov: 42 }, sub: '村庄的广场上，一群村民围着燃烧的火堆……' },
          { dur: 3.0, cam: { pos: new THREE.Vector3(2, 3.5, 12), look: new THREE.Vector3(0, 3.2, 0), fov: 32 }, sub: '里昂：「……那是警察？」' },
        ], () => gg.hud.objective('调查村庄'));
      } else gg.hud.objective('调查村庄');
    },
    update(gg: Game, dt: number) {
      const f = gg.flags;
      const p = gg.player.pos;
      if (!f.siege_done) {
        if (!f.siege_started) {
          const anyAware = gg.enemies.some((e) => e.alive && e.aware);
          if (anyAware || p.z < 22) startSiege(gg);
        } else updateSiege(gg, dt);
      }
      // exit through the gate
      if (gate.isOpen && p.x > 48 && Math.abs(p.z + 24) < 3) gg.loadArea('farm', 'south');
      // back to the forest
      if (p.z > 58 && Math.abs(p.x) < 5) gg.loadArea('forest', 'north');
      void dist2;
    },
  };

  function startSiege(gg: Game) {
    const f = gg.flags;
    f.siege_started = true;
    siege.t = 0;
    const shouter = gg.enemies.find((e) => e.alive && e.tag?.startsWith('pyre')) ?? gg.enemies[0];
    if (shouter) gg.audio.shout(shouter.headPos, '¡Allí está!', 1);
    for (const e of gg.enemies) if (e.alive) e.becomeAware(0.3 + Math.random() * 1.2, e === shouter);
    gg.hud.objective('活下去！');
    gg.hud.toast('村民发现了你！', 2.5);
    setTimeout(() => gg.hud.toast('提示：两层的房子可以推书架堵门，推倒梯子阻挡敌人', 5), 6000);
    gg.checkpoint(true);
  }

  function pickSpawn(gg: Game): [number, number] | null {
    const p = gg.player.pos;
    const cam = gg.camera.cam;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const ok = SPAWNS.filter(([x, z]) => {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < 20) return false;
      const to = new THREE.Vector3(x - cam.position.x, 0, z - cam.position.z).normalize();
      const inView = to.dot(new THREE.Vector3(fwd.x, 0, fwd.z).normalize()) > 0.55;
      return !inView || d > 38;
    });
    return ok.length ? rng.pick(ok) : rng.pick(SPAWNS);
  }

  function maxAlive(gg: Game) {
    return { assisted: 5, standard: 8, hardcore: 10, professional: 11 }[gg.diff.id];
  }

  function updateSiege(gg: Game, dt: number) {
    const f = gg.flags;
    if (siege.bell) {
      siege.bellT += dt;
      if (siege.bellT > 10 || (!gg.enemies.some((e) => e.alive && e.state === 'leave') && siege.bellT > 5)) endSiege(gg);
      return;
    }
    if (!gg.player.alive) return;
    siege.t += dt;
    siege.spawnT -= dt;
    const alive = gg.enemies.filter((e) => e.alive && !e.isSalvador).length;
    if (siege.spawnT <= 0 && alive < maxAlive(gg)) {
      siege.spawnT = rng.range(2.5, 4.5);
      const sp = pickSpawn(gg);
      if (sp) {
        const r = rng.next();
        let kind: EnemyKind = r < 0.5 ? 'villager' : r < 0.66 ? 'villager_f' : r < 0.8 ? 'pitchfork' : r < 0.92 ? 'thrower' : 'torch';
        if (siege.t > 100 && !siege.dyn) {
          kind = 'dynamite';
          siege.dyn = true;
        } else if (siege.t > 150 && rng.chance(0.12)) kind = 'dynamite';
        gg.spawnEnemy({ kind, x: sp[0] + rng.range(-2, 2), z: sp[1] + rng.range(-2, 2), aware: true, noDrop: rng.chance(0.35) });
      }
    }
    if (!siege.salvador && siege.t > 70) {
      siege.salvador = true;
      const s = gg.spawnEnemy({ kind: 'salvador', x: 2, z: -32, aware: true, tag: 'salvador' });
      if (s) {
        gg.hud.toast('……那是什么声音？', 2.5);
        gg.camera.shake(0.2);
      }
    }
    if (siege.t >= gg.diff.siegeTime) ringBell(gg);
    void f;
  }

  function ringBell(gg: Game) {
    siege.bell = true;
    siege.bellT = 0;
    gg.audio.bell(ch.bellPos, 6, 2.4);
    for (const e of gg.enemies) if (e.alive) e.leave(churchDoor);
    gg.director.computeLeaveField(churchDoor.x, churchDoor.z);
    for (const pr of gg.projectiles) if (pr.kind === 'dynamite') pr.fuse = Math.max(pr.fuse, 0.1);
    gg.hud.objective('……钟声？');
    gg.hud.toast('教堂的钟声响了', 3);
  }

  function endSiege(gg: Game) {
    const f = gg.flags;
    f.siege_done = true;
    for (const e of gg.enemies) {
      if (e.alive) {
        e.removed = true;
      }
    }
    const p = gg.player.pos;
    gg.playCutscene(
      [
        { dur: 3.2, cam: { pos: new THREE.Vector3(p.x + 1, p.y + 2, p.z + 3), look: ch.bellPos, fov: 40 }, sub: '里昂：「大家都去哪了？……去玩宾果吗？」' },
        { dur: 2.2, sub: '<span style="color:#d8b46a">村民们消失在了教堂里。</span>' },
      ],
      () => {
        merchant(L, gg, 41, -17, -Math.PI / 2 - 0.4);
        gg.hud.objective('寻找打开东边大门的方法（瞭望塔？）');
        gg.hud.toast('东边大门附近出现了一个神秘商人', 4);
        gg.checkpoint(true);
      },
    );
  }

  return area;
}

export type { Enemy };
