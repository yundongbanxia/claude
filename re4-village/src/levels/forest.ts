import * as THREE from 'three';
import { Level } from '../world/level';
import { buildHouse, crate, barrel, fence, makeShelf, table, chair, bed, fireplace, boundary, forestFill, rock, hay, staticBox, lantern } from '../world/props';
import { bridge, fireAt, policeCar, scatter, signPost, water } from './common';
import { worldMat } from '../render/textures';
import { distToSegment } from '../core/math';
import { rng } from '../core/rng';
import { BearTrap } from '../game/entities';
import type { AreaInstance } from './area';
import type { Game } from '../game/game';
import type { Enemy } from '../game/enemies/enemy';

const PATH: [number, number][] = [
  [2, 28], [2, 10], [-2, -16], [-8, -36], [-7, -58], [1, -78], [8, -96], [7, -118], [-1, -140], [0, -160], [0, -192],
];

function nearPath(x: number, z: number, w: number) {
  for (let i = 0; i < PATH.length - 1; i++) if (distToSegment(x, z, PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1]) < w) return true;
  return false;
}

export function buildForest(g: Game): AreaInstance {
  rng.seed(1001);
  const creekZ = -103;
  const L = new Level('forest', {
    minX: -48, maxX: 48, minZ: -192, maxZ: 30, cell: 1, amp: 1.6, freq: 0.035, seed: 11,
    flats: [
      { x: -19, z: -48, hx: 9, hz: 9, h: 0.2, falloff: 6 },
      { x: 15, z: -86, hx: 6, hz: 6, h: 0.3, falloff: 5 },
      { x: 2, z: 18, r: 8, h: 0, falloff: 6 },
      { x: 5, z: -165, r: 6, h: 0, falloff: 5 },
    ],
    paths: [{ pts: PATH, width: 5 }],
    rim: { height: 12, inset: 14 },
    extraHeight: (x, z) => {
      // creek ravine crossing the path
      const d = Math.abs(z - creekZ + Math.sin(x * 0.08) * 2);
      return d < 5 ? -3.2 * (1 - (d / 5) ** 2) : 0;
    },
    grassColor: 0x9a9a78,
    dirtColor: 0xb09878,
  });

  // --- start: police car
  policeCar(L, 4.5, 21, Math.PI * 0.95);

  // --- hunter's lodge
  const lodge = buildHouse(L, {
    x: -19, z: -48, rot: Math.PI / 2, w: 10, d: 8, floors: 2, loft: 0.45, mat: 'wood',
    doors: [{ side: 's', off: 1.5 }],
    windows: [
      { side: 'n', off: 2.5, floor: 0 },
      { side: 'e', off: -2.5, floor: 0 },
      { side: 'w', off: -2, floor: 0 },
      { side: 'n', off: -1.5, floor: 1 },
    ],
    interiorLadder: { lx: -3.2 },
  });
  const lw = lodge.toWorld;
  const base = lodge.base;
  {
    const [fx, fz] = lw(4.35, 1.8);
    fireplace(L, fx, fz, base, 0);
    fireAt(L, fx, base + 0.2, fz + 0.45, 0.5, true);
    const [tx, tz] = lw(-1.2, 1.9);
    table(L, tx, tz, base, Math.PI / 2);
    const [cx, cz] = lw(-0.4, 2.8);
    chair(L, cx, cz, base, 0.4);
    const [bx, bz] = lw(2.5, -2.2);
    bed(L, bx, bz, base + 3, 0);
    const door = lodge.doors[0];
    const [sx, sz] = lw(-2.2, 3.1);
    const [ex, ez] = lw(1.5, 3.25);
    makeShelf(L, sx, sz, ex, ez, Math.PI / 2, base, door);
    lantern(L, ...lw(0, 0), base + 2.6, true);
  }

  // --- woodcutter shed
  const shed = buildHouse(L, {
    x: 15, z: -86, rot: -Math.PI / 2, w: 6, d: 5, floors: 1, mat: 'wood', roofMat: 'thatch',
    doors: [{ side: 's', off: 0 }],
    windows: [{ side: 'e', off: 0 }],
  });
  {
    const [x0, z0] = shed.toWorld(-1.5, 3.4);
    for (let i = 0; i < 4; i++) staticBox(L, x0 + i * 0.1, z0 - 1.2 - i * 0.02, 1.4, 0.35, 0.35, 0.1 * i, worldMat('bark'), L.h(x0, z0) + i * 0.3, i === 0);
    crate(L, 19, -80);
    crate(L, 19.5, -81.2, 0.4);
    barrel(L, 10.5, -82);
  }

  // --- creek & bridge
  const by = 0.05;
  bridge(L, 7.8, creekZ - 6.5, creekZ + 6.5, by);
  water(L, 0, creekZ, 96, 7, -2.6);
  for (let x = -40; x < 40; x += 3.5) if (Math.abs(x - 8) > 4) rock(L, x + rng.range(-1, 1), creekZ + rng.range(-3, 3), rng.range(0.4, 1.1), false);

  // --- props along the path
  fence(L, [[-5, -6], [-9, -14], [-11, -24]]);
  fence(L, [[6, -62], [10, -70], [12, -76]]);
  crate(L, -5, -30);
  barrel(L, -4.5, -31.5);
  crate(L, 12, -120, 0.3);
  crate(L, 12.6, -121.3, 0.1, 0.7);
  barrel(L, -6, -146);
  hay(L, 8, -158, 0.4);
  signPost(L, 3.5, -176, 0.3);
  fireAt(L, 5, L.h(5, -165) + 0.1, -165, 0.8, true);
  // gate posts to the village
  for (const sx of [-3.2, 3.2]) staticBox(L, sx, -184, 0.5, 4, 0.5, 0, worldMat('darkwood'));
  staticBox(L, 0, -184, 7, 0.4, 0.4, 0, worldMat('darkwood'), L.h(0, -184) + 3.8, false);

  // --- vegetation
  forestFill(L, -44, -188, 44, 26, 6.2, (x, z) => nearPath(x, z, 6) || (Math.abs(x + 19) < 11 && Math.abs(z + 48) < 11) || (Math.abs(x - 15) < 8 && Math.abs(z + 86) < 8) || Math.abs(z - creekZ) < 5 || (Math.hypot(x - 2, z - 18) < 9) || (Math.hypot(x - 5, z + 165) < 7));
  scatter(L, -44, -188, 44, 26, 2200, (x, z) => nearPath(x, z, 2.2) || Math.abs(z - creekZ) < 4, ['grass', 'grass', 'grass', 'bush', 'rock']);
  boundary(L, [[-40, 28], [40, 28], [40, -190], [-40, -190], [-40, 28]]);

  L.finalize();

  const area: AreaInstance = {
    id: 'forest',
    name: '森林小路',
    level: L,
    entries: {
      start: { x: 1.5, z: 16, yaw: 0 },
      north: { x: 0, z: -178, yaw: Math.PI },
    },
    fog: { color: 0x7a7a6e, density: 0.03 },
    sky: { top: 0x5a6068, bottom: 0x9a9888 },
    sunDir: new THREE.Vector3(-0.45, 0.55, 0.7).normalize(),
    sunColor: 0xffe0b8,
    sunIntensity: 1.8,
    hemi: { sky: 0xc0c0b0, ground: 0x4a4638, intensity: 1.55 },
    exposure: 1.15,
    ambience: 'forest',
    spawn(gg: Game) {
      const f = gg.flags;
      // lodge fireplace villager
      if (!f.lodge_intro_done) {
        const [x, z] = lw(3.2, 1.8);
        gg.spawnEnemy({ kind: 'villager', x, z, yaw: 0, state: 'idle', weapon: 'hatchet', tag: 'lodge1', drop: 'ammo_hg' });
      }
      // woodcutters
      gg.spawnEnemy({ kind: 'villager', x: 13.5, z: -80.5, yaw: 2.2, state: 'work', weapon: 'axe', tag: 'shed1' });
      gg.spawnEnemy({ kind: 'villager', x: 18, z: -92, yaw: -2.6, state: 'idle', weapon: 'sickle', tag: 'shed2' });
      // after the bridge
      gg.spawnEnemy({ kind: 'villager', x: 2, z: -124, yaw: 0.2, state: 'patrol', weapon: 'sickle', tag: 'br1', patrol: [[2, -124], [-4, -132], [4, -128]] });
      gg.spawnEnemy({ kind: 'thrower', x: 16, z: -129, yaw: 1.2, state: 'idle', tag: 'br2' });
      gg.spawnEnemy({ kind: 'villager_f', x: -8, z: -128, yaw: -1, state: 'idle', tag: 'br3' });
      // campfire group near the village gate
      gg.spawnEnemy({ kind: 'villager', x: 3.5, z: -163.5, yaw: 1.8, state: 'idle', weapon: 'hatchet', tag: 'cf1' });
      gg.spawnEnemy({ kind: 'pitchfork', x: 6.8, z: -166, yaw: -1.2, state: 'idle', tag: 'cf2' });
      gg.spawnEnemy({ kind: 'villager', x: 5, z: -167.6, yaw: 3, state: 'idle', weapon: 'none', tag: 'cf3' });
      // pickups
      gg.spawnPickup('herb_g', 1, new THREE.Vector3(-4, L.h(-4, -26), -26), 'f_herb1');
      const [ax, az] = lw(-1.2, 1.9);
      gg.spawnPickup('ammo_hg', 10, new THREE.Vector3(ax, base + 0.83, az), 'f_ammo_lodge');
      const [lx, lz] = lw(-3.5, -1.5);
      gg.spawnPickup('velvet_blue', 1, new THREE.Vector3(lx, base + 3.05, lz), 'f_treasure_loft');
      gg.spawnPickup('pesetas', 800, new THREE.Vector3(-12, L.h(-12, -64), -64), 'f_pes1');
      gg.spawnPickup('gunpowder', 1, new THREE.Vector3(16.5, L.h(16.5, -88.5) + 0.05, -88.5), 'f_gp1');
      gg.spawnPickup('herb_g', 1, new THREE.Vector3(-5, L.h(-5, -150), -150), 'f_herb2');
      gg.spawnPickup('ammo_hg', 8, new THREE.Vector3(9.5, L.h(9.5, -160), -160), 'f_ammo2');
      // bear traps
      for (const [x, z] of [[7, -111], [-1.5, -137], [1.5, -151], [9, -121]]) gg.traps.push(new BearTrap(gg, new THREE.Vector3(x, L.h(x, z) + 0.02, z)));
      // crows
      for (const [x, z] of [[-7, -10], [-9.5, -18], [9, -66], [11, -73], [-2, -143]]) gg.spawnAnimal('crow', new THREE.Vector3(x, L.h(x, z) + 1.25, z));
    },
    onEnter(gg: Game, entry: string) {
      const f = gg.flags;
      if (entry === 'start' && !f.forest_intro) {
        f.forest_intro = true;
        const p = gg.player.pos;
        gg.playCutscene([
          { dur: 3.2, cam: { pos: new THREE.Vector3(p.x + 3, p.y + 2.2, p.z + 5), look: new THREE.Vector3(p.x, p.y + 1.4, p.z - 6), fov: 50 }, sub: '警察：「我们就在车里等你。快去快回，美国佬。」' },
          { dur: 3.4, cam: { pos: new THREE.Vector3(p.x - 1, p.y + 1.7, p.z - 2), look: new THREE.Vector3(p.x - 3, p.y + 1.6, p.z - 30), fov: 45 }, sub: '里昂：「……这地方可真是热情好客。」' },
          { dur: 2.6, sub: '<span style="color:#d8b46a">目标：沿着小路前往村庄，寻找阿什莉的下落</span>' },
        ], () => {
          gg.hud.objective('沿着小路前往村庄');
          gg.hud.toast('按住 鼠标右键 瞄准，左键 射击', 4);
          gg.after(4.5, () => gg.hud.toast('打中头部或腿部让敌人硬直，然后按 F 使用体术', 4));
        });
      } else gg.hud.objective('沿着小路前往村庄');
    },
    update(gg: Game) {
      const p = gg.player.pos;
      const f = gg.flags;
      // lodge interior trigger
      if (!f.lodge_intro_done && !f.lodge_intro && Math.abs(p.x + 19) < 3.6 && Math.abs(p.z + 48) < 4.6 && p.y < base + 1) {
        f.lodge_intro = true;
        const e = gg.enemies.find((x) => x.tag === 'lodge1');
        if (e) {
          gg.playCutscene(
            [
              { dur: 2.4, cam: { pos: e.pos.clone().add(new THREE.Vector3(2.6, 1.8, 3.2)), look: e.headPos.add(new THREE.Vector3(0.6, -0.3, 1.2)), fov: 45 }, sub: '里昂：「打扰一下，我在找一个女孩……」' },
              {
                dur: 1.6,
                onStart: () => {
                  e.faceTo(gg.player.pos, 10);
                  gg.audio.shout(e.headPos, '¡Lárgate de aquí!', 0.9);
                },
                cam: { pos: e.pos.clone().add(new THREE.Vector3(1.2, 1.65, 1.5)), look: e.headPos, fov: 38 },
                sub: '村民：「¡Lárgate de aquí!」（滚出去！）',
              },
            ],
            () => {
              f.lodge_intro_done = true;
              e.becomeAware(0, false);
              e.attackCd = 0.4;
              gg.hud.objective('击倒袭击你的村民');
            },
          );
        }
      }
      // reinforcements after the first kill
      if (f.lodge1_dead && !f.lodge_siege && gg.time > (f.lodge1_t as number) + 2.5) {
        f.lodge_siege = true;
        gg.hud.subtitle('里昂：「……看来还有更多。」', 3);
        gg.hud.objective('突破村民的包围（可以推动书架堵门，或者从窗户跳出去）');
        const spots: [number, number, string][] = [[-6, -40, 'villager'], [-8, -60, 'villager_f'], [-30, -44, 'pitchfork'], [-12, -30, 'villager']];
        for (const [x, z, k] of spots) gg.spawnEnemy({ kind: k as Enemy['kind'], x, z, aware: true, tag: `lodge_r${x}${z}` });
        gg.audio.shout(new THREE.Vector3(-6, 1.5, -40), '¡Allí está!', 1);
      }
      if (f.lodge_siege && !f.lodge_cleared && !gg.enemies.some((e) => e.alive && e.tag?.startsWith('lodge'))) {
        f.lodge_cleared = true;
        gg.hud.objective('沿着小路前往村庄');
        gg.checkpoint(true);
      }
      // exit to village
      if (p.z < -181 && Math.abs(p.x) < 4) {
        gg.flags.forest_done = true;
        gg.loadArea('village', 'south');
      }
    },
    onEnemyKilled(gg: Game, e: Enemy) {
      if (e.tag === 'lodge1') {
        gg.flags.lodge1_dead = true;
        gg.flags.lodge1_t = gg.time;
      }
    },
  };
  return area;
}
