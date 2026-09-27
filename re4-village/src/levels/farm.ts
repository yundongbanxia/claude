import * as THREE from 'three';
import { Level } from '../world/level';
import { buildHouse, crate, barrel, fence, table, bed, boundary, forestFill, hay, cart, well, lantern, staticBox, haystack, makeShelf } from '../world/props';
import { bigGate, cow, merchant, scarecrow, scatter, typewriter, water, fireAt } from './common';
import { worldMat } from '../render/textures';
import { boxGeo, place } from '../render/geo';
import { distToSegment } from '../core/math';
import { rng } from '../core/rng';
import { L as LC } from '../anim/clips';
import { Medallion } from '../game/entities';
import type { AreaInstance } from './area';
import type { Game } from '../game/game';
import type { EnemyKind } from '../game/enemies/enemy';

const ROAD: [number, number][] = [[0, 44], [0, 12], [-4, -28], [0, -70], [0, -110]];

function nearRoad(x: number, z: number, w: number) {
  for (let i = 0; i < ROAD.length - 1; i++) if (distToSegment(x, z, ROAD[i][0], ROAD[i][1], ROAD[i + 1][0], ROAD[i + 1][1]) < w) return true;
  return false;
}

function at(tw: (x: number, z: number) => [number, number], lx: number, lz: number, y: number) {
  const [x, z] = tw(lx, lz);
  return new THREE.Vector3(x, y, z);
}

export function buildFarm(g: Game): AreaInstance {
  rng.seed(3003);
  const pond = { x: 26, z: -64, r: 8 };
  const L = new Level('farm', {
    minX: -58, maxX: 58, minZ: -114, maxZ: 44, cell: 1, amp: 1.0, freq: 0.03, seed: 37,
    flats: [
      { x: 0, z: 30, r: 10, h: 0, falloff: 6 },
      { x: 22, z: -30, hx: 11, hz: 9, h: 0.1, falloff: 6 },
      { x: -24, z: -8, hx: 12, hz: 14, h: 0, falloff: 6 },
      { x: 0, z: -98, hx: 12, hz: 8, h: 0, falloff: 8 },
    ],
    paths: [{ pts: ROAD, width: 6 }, { pts: [[-2, -20], [14, -28]], width: 4 }, { pts: [[-2, -40], [-18, -42]], width: 3 }],
    rim: { height: 12, inset: 12 },
    extraHeight: (x, z) => {
      const d = Math.hypot(x - pond.x, (z - pond.z) * 1.3);
      return d < pond.r ? -1.6 * (1 - (d / pond.r) ** 2) : 0;
    },
    grassColor: 0x9a9a70,
    dirtColor: 0xb09878,
  });

  // entry gate (open) and safe spot
  const entryGate = bigGate(L, 0, 41, 0, 20);
  entryGate.setProgress(1);
  entryGate.col.enabled = false;
  typewriter(L, g, 7.5, 31, -Math.PI / 2);
  {
    // small shelter over the typewriter
    for (const [x, z] of [[6.2, 29.5], [8.8, 29.5], [6.2, 32.5], [8.8, 32.5]]) staticBox(L, x, z, 0.15, 2.4, 0.15, 0, worldMat('darkwood'), undefined, true, false);
    const roof = boxGeo(3.4, 0.12, 3.8, 1.5);
    place(roof, 7.5, L.h(7.5, 31) + 2.45, 31, 0.08, 0, 0);
    L.batch.add(worldMat('thatch'), roof);
    lantern(L, 7.5, 31, L.h(7.5, 31) + 2.2, true);
  }

  // field with furrows and scarecrows
  for (let i = 0; i < 9; i++) {
    const g2 = boxGeo(18, 0.18, 0.5, 2);
    place(g2, -24, L.h(-24, -18 + i * 2.6) + 0.05, -18 + i * 2.6);
    L.batch.add(worldMat('dirt', 0x6a5a44), g2);
  }
  scarecrow(L, -30, -4, 0.4);
  scarecrow(L, -18, -14, -0.3);
  fence(L, [[-35, -22], [-35, 6], [-13, 6]]);

  // cow pen
  fence(L, [[14, 2], [32, 2], [32, 18], [14, 18], [14, 11]]);
  cow(L, g, 20, 8, 0.6);
  cow(L, g, 26, 13, -2.2);
  hay(L, 29, 5, 0.3);

  // chicken coop
  staticBox(L, -12, 16, 2.4, 1.6, 1.8, 0.2, worldMat('wood', 0x8a7458));
  fence(L, [[-16, 12], [-16, 20], [-8, 20], [-8, 12]]);

  // barn
  const barn = buildHouse(L, {
    x: 22, z: -30, rot: -Math.PI / 2, w: 14, d: 11, floors: 2, loft: 0.45, mat: 'wood', roofMat: 'roof', wallH: 3.2,
    doors: [{ side: 's', off: 0, w: 3.2 }, { side: 'e', off: 2 }],
    windows: [{ side: 's', off: 4.5, floor: 1 }, { side: 's', off: -4.5, floor: 1 }, { side: 'w', off: -2, floor: 0 }, { side: 'n', off: 3, floor: 0 }],
    interiorLadder: { lx: -4 },
  });
  const bw = barn.toWorld;
  for (const [lx, lz, r] of [[4, 2, 0.1], [4, 3.2, 0.2], [5, -2.6, 1.5], [-5, 3, 0], [-5.5, 1.8, 0.1]] as [number, number, number][]) hay(L, ...bw(lx, lz), r);
  haystack(L, ...bw(3, -3.6), 1.1);
  const [bdx, bdz] = bw(0, 5.4);
  makeShelf(L, ...bw(-3.2, 4.8), bdx, bdz - 0.0, -Math.PI / 2, barn.base, barn.doors[0]);
  lantern(L, ...bw(0, 0), barn.base + 2.8, true);

  // farmhouses
  const fa = buildHouse(L, { x: -24, z: -42, rot: Math.PI / 2, w: 9, d: 7, floors: 1, mat: 'plaster', doors: [{ side: 's', off: 1.5 }], windows: [{ side: 'e', off: 0 }, { side: 'w', off: 0 }, { side: 'n', off: 1 }] });
  table(L, ...fa.toWorld(-1.5, 1), fa.base, 0);
  bed(L, ...fa.toWorld(2.8, -1.8), fa.base, 0);
  const fb = buildHouse(L, { x: -20, z: -72, rot: Math.PI / 2, w: 8, d: 6, floors: 1, mat: 'stone', roofMat: 'thatch', doors: [{ side: 's', off: -1 }], windows: [{ side: 'e', off: 1 }] });
  table(L, ...fb.toWorld(1.5, 0.5), fb.base, 0.2);

  // pond, well, carts
  water(L, pond.x, pond.z, pond.r * 2.2, pond.r * 1.8, -1.1);
  well(L, -10, -28);
  cart(L, 8, -12, 0.4);
  cart(L, -8, -84, 2.2);
  for (const [x, z] of [[10, -40], [11, -41.2], [-12, -52], [6, -88], [-6, -60], [14, 22]]) crate(L, x, z, rng.range(0, 1));
  for (const [x, z] of [[12, -38.5], [-13, -50.5], [5, -86], [-30, -40]]) barrel(L, x, z);
  for (const [x, z] of [[34, -44], [-34, -60], [12, -80], [-14, -96]]) haystack(L, x, z, rng.range(1.1, 1.6));

  // exit gate with winch
  const exitGate = bigGate(L, 0, -104, 0, 22);
  const winch = new THREE.Vector3(5, L.h(5, -101.5), -101.5);
  staticBox(L, winch.x, winch.z, 0.7, 1.1, 0.7, 0, worldMat('darkwood'));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 4, 10), worldMat('metal', 0x777777));
  wheel.position.set(winch.x - 0.4, winch.y + 1.1, winch.z);
  wheel.rotation.y = Math.PI / 2;
  L.group.add(wheel);
  fireAt(L, -5, L.h(-5, -98), -98, 0.9, true);

  // vegetation
  forestFill(L, -54, -110, 54, 40, 6.5, (x, z) => nearRoad(x, z, 9) || (Math.abs(x + 24) < 16 && z > -26 && z < 12) || (Math.abs(x - 23) < 13 && z > -1 && z < 22) || (Math.abs(x - 22) < 14 && Math.abs(z + 30) < 12) || Math.hypot(x - pond.x, z - pond.z) < 12 || (Math.abs(x + 22) < 9 && Math.abs(z + 42) < 7) || (Math.abs(x + 20) < 8 && Math.abs(z + 72) < 7) || (Math.abs(x) < 14 && z < -90) || (Math.abs(x + 12) < 6 && Math.abs(z - 16) < 6), 0.08);
  scatter(L, -54, -110, 54, 40, 1800, (x, z) => nearRoad(x, z, 3) || Math.hypot(x - pond.x, z - pond.z) < 8, ['grass', 'grass', 'grass', 'bush', 'rock']);
  boundary(L, [[-50, 42], [50, 42], [50, -108], [-50, -108], [-50, 42]]);

  L.finalize();

  const fin = { active: false, t: 0, spawnT: 0, progress: 0, salvador: false, done: false };

  const area: AreaInstance = {
    id: 'farm',
    name: '农场',
    level: L,
    entries: { south: { x: 0, z: 36, yaw: 0 } },
    fog: { color: 0x847c6c, density: 0.021 },
    sky: { top: 0x5e5c5a, bottom: 0xa49480 },
    sunDir: new THREE.Vector3(-0.5, 0.35, 0.8).normalize(),
    sunColor: 0xffb880,
    sunIntensity: 1.9,
    hemi: { sky: 0xc0b0a0, ground: 0x4a4034, intensity: 1.45 },
    exposure: 1.12,
    ambience: 'farm',
    spawn(gg: Game) {
      const f = gg.flags;
      merchant(L, gg, -7, 30, Math.PI / 2 + 0.3);
      if (!f.farm_done) {
        gg.spawnEnemy({ kind: 'villager', x: -26, z: -8, yaw: 0.3, state: 'work', weapon: 'sickle', tag: 'fa_field1' });
        gg.spawnEnemy({ kind: 'villager_f', x: -20, z: -2, yaw: 2.5, state: 'work', tag: 'fa_field2' });
        gg.spawnEnemy({ kind: 'villager', x: -28, z: -16, yaw: -2, state: 'idle', weapon: 'hatchet', tag: 'fa_field3' });
        gg.spawnEnemy({ kind: 'pitchfork', x: 18, z: 12, yaw: 1, state: 'idle', tag: 'fa_pen' });
        gg.spawnEnemy({ kind: 'dynamite', ...xz(at(bw, 3, -2.5, 0)), y: barn.base + 3.2, yaw: Math.PI / 2, state: 'idle', tag: 'fa_barn_dyn' });
        gg.spawnEnemy({ kind: 'villager', ...xz(at(fa.toWorld, -1.5, 1.8, 0)), yaw: 0, state: 'idle', weapon: 'axe', tag: 'fa_house' });
        gg.spawnEnemy({ kind: 'pitchfork', x: -14, z: -48, state: 'patrol', patrol: [[-14, -48], [-8, -40], [-14, -34]], tag: 'fa_patrol' });
        gg.spawnEnemy({ kind: 'villager', x: 20, z: -58, yaw: 2, state: 'idle', weapon: 'sickle', tag: 'fa_pond1' });
        gg.spawnEnemy({ kind: 'thrower', x: 30, z: -72, yaw: -2.4, state: 'idle', tag: 'fa_pond2' });
        gg.spawnEnemy({ kind: 'torch', x: -16, z: -74, yaw: 1.5, state: 'idle', tag: 'fa_fb' });
      }
      // pickups
      gg.spawnPickup('ammo_sg', 4, at(bw, -5, -3, barn.base + 3.25), 'fa_sg');
      gg.spawnPickup('herb_g', 1, at(fa.toWorld, -1.5, 1, fa.base + 0.83), 'fa_herb1');
      gg.spawnPickup('herb_y', 1, new THREE.Vector3(30, L.h(30, 16), 16), 'fa_herby');
      gg.spawnPickup('gold_bangle', 1, at(fb.toWorld, 1.5, 0.5, fb.base + 0.83), 'fa_bangle');
      gg.spawnPickup('spinel', 1, new THREE.Vector3(-33, L.h(-33, 4), 4), 'fa_spinel1');
      gg.spawnPickup('ammo_hg', 10, new THREE.Vector3(-9, L.h(-9, -30), -30.2), 'fa_ammo1');
      gg.spawnPickup('pesetas', 1500, new THREE.Vector3(33, L.h(33, -42), -42), 'fa_pes');
      gg.spawnPickup('res_l', 1, new THREE.Vector3(-6, L.h(-6, -58), -58), 'fa_resl');
      gg.spawnPickup('nade', 1, new THREE.Vector3(-4, L.h(-4, -96), -96), 'fa_nade');
      gg.spawnPickup('spray', 1, new THREE.Vector3(8, L.h(8, -92), -92), 'fa_spray');
      for (const [x, z] of [[-11, 13], [-13, 18], [-10, 19]]) gg.spawnAnimal('chicken', new THREE.Vector3(x, 0, z));
      for (const [x, z] of [[14, 2], [-35, -10]]) gg.spawnAnimal('crow', new THREE.Vector3(x, L.h(x, z) + 1.25, z));
      // blue medallions (request)
      gg.flags.medallionsTotal = 5;
      const [m1x, m1z] = bw(0, 6.2);
      const [m4x, m4z] = fa.toWorld(0, 3.7);
      const meds: [number, number, number, number][] = [
        [m1x, barn.base + 6.9, m1z, Math.PI / 2],
        [31.9, L.h(31.9, 10) + 1.6, 10, Math.PI / 2],
        [-30, L.h(-30, -4) + 2.55, -3.8, 0.4],
        [m4x, fa.base + 3.6, m4z, Math.PI / 2],
        [-2.6, L.h(-2.6, -104) + 5.2, -103.4, 0],
      ];
      if (!f.medallionsDone) {
        const got = (f.medallions as number) ?? 0;
        meds.slice(got).forEach(([x, y, z, yaw]) => gg.medallions.push(new Medallion(gg, new THREE.Vector3(x, y, z), yaw)));
      }
      fin.active = false;
      fin.t = 0;
      fin.progress = (f.farm_crank as number) ?? 0;
      fin.salvador = false;
      if (f.farm_gate_open) exitGate.open(gg);
    },
    onEnter(gg: Game) {
      const f = gg.flags;
      if (!f.farm_intro) {
        f.farm_intro = true;
        gg.hud.subtitle('商人："Got a selection of good things on sale, stranger."', 4);
        setTimeout(() => gg.hud.toast('委托：击碎农场里的 5 个蓝色徽章（射击它们），可向商人领取奖励', 5), 4500);
      }
      gg.hud.objective(f.farm_gate_open ? '穿过北边的大门' : '穿过农场，打开北边的大门');
    },
    update(gg: Game, dt: number) {
      const f = gg.flags;
      const p = gg.player;
      // barn ambush
      if (!f.barn_ambush && Math.abs(p.pos.x - 22) < 5.5 && Math.abs(p.pos.z + 30) < 6.5) {
        f.barn_ambush = true;
        gg.audio.shout(new THREE.Vector3(10, 1.6, -30), '¡Agárrenlo!', 1);
        const pts: [number, number, EnemyKind][] = [[8, -22, 'villager'], [8, -38, 'villager_f'], [34, -20, 'pitchfork'], [36, -36, 'villager'], [12, -30, 'villager']];
        for (const [x, z, k] of pts) gg.spawnEnemy({ kind: k, x, z, aware: true, tag: 'fa_amb' + x + z });
        gg.hud.toast('埋伏！', 2);
      }
      // winch
      const dw = Math.hypot(p.pos.x - winch.x, p.pos.z - winch.z);
      if (p.action?.name === 'crank') wheel.rotation.x += dt * 4;
      if (!f.farm_gate_open && dw < 2 && p.state === 'move' && gg.input.isDown('interact') && !p.action) startCrank(gg);
      if (fin.active && !f.farm_gate_open) updateFinale(gg, dt);
      // exit
      if (f.farm_gate_open && p.pos.z < -106 && Math.abs(p.pos.x) < 3.5 && !fin.done) {
        fin.done = true;
        f.farm_done = true;
        gg.hud.menus.results();
      }
      if (p.pos.z > 42 && Math.abs(p.pos.x) < 4) gg.loadArea('village', 'farmgate');
    },
  };

  function startCrank(gg: Game) {
    const p = gg.player;
    p.yaw = Math.atan2(-(winch.x - p.pos.x), -(winch.z - p.pos.z));
    if (!fin.active) {
      fin.active = true;
      fin.t = 0;
      fin.spawnT = 1.5;
      gg.hud.objective('转动绞盘打开大门！（按住 F）');
      gg.audio.shout(new THREE.Vector3(0, 2, -60), '¡Allí está! ¡Mátalo!', 1);
      gg.checkpoint(true);
    }
    p.doAction({
      name: 'crank',
      clip: LC.crank,
      dur: 1.2,
      onEnd: () => {
        fin.progress = Math.min(1, fin.progress + 1 / 12);
        gg.flags.farm_crank = fin.progress;
        gg.audio.play('crank', winch);
        exitGate.setProgress(fin.progress * 0.25);
        gg.hud.toast(`大门 ${Math.round(fin.progress * 100)}%`, 1);
        if (fin.progress >= 1) {
          gg.flags.farm_gate_open = true;
          exitGate.open(gg);
          gg.hud.objective('穿过北边的大门！');
          for (const e of gg.enemies) if (e.alive && !e.isSalvador) e.becomeAware(0);
        }
      },
    });
    gg.hud.setPrompt('', 'F');
  }

  function updateFinale(gg: Game, dt: number) {
    fin.t += dt;
    fin.spawnT -= dt;
    const alive = gg.enemies.filter((e) => e.alive && !e.isSalvador).length;
    const cap = { assisted: 4, standard: 7, hardcore: 9, professional: 10 }[gg.diff.id];
    if (fin.spawnT <= 0 && alive < cap) {
      fin.spawnT = rng.range(2.2, 4);
      const pts: [number, number][] = [[-20, -60], [20, -62], [-30, -90], [30, -92], [0, -60], [-14, -80], [16, -84]];
      const [x, z] = rng.pick(pts);
      const r = rng.next();
      const kind: EnemyKind = r < 0.45 ? 'villager' : r < 0.6 ? 'villager_f' : r < 0.75 ? 'pitchfork' : r < 0.87 ? 'thrower' : r < 0.94 ? 'torch' : 'dynamite';
      gg.spawnEnemy({ kind, x, z, aware: true, noDrop: rng.chance(0.4) });
    }
    if (!fin.salvador && fin.t > 25 && gg.diff.id !== 'assisted') {
      fin.salvador = true;
      gg.spawnEnemy({ kind: 'salvador', x: 0, z: -62, aware: true, tag: 'salvador2' });
      gg.hud.toast('电锯的声音……又来了！', 2.5);
    }
  }

  return area;
}

function xz(v: THREE.Vector3) {
  return { x: v.x, z: v.z };
}
