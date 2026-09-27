import * as THREE from 'three';
import { Level } from '../world/level';
import { buildHouse, crate, barrel, pine, fence, makeShelf, makeLadder, rock, hay, cart, boundary } from '../world/props';
import type { AreaInstance } from './area';
import type { Game } from '../game/game';

/** Small sandbox arena used for development & automated tests. */
export function buildTest(g: Game): AreaInstance {
  const L = new Level('test', {
    minX: -40, maxX: 40, minZ: -40, maxZ: 40, cell: 1, amp: 0.6, freq: 0.04, seed: 3,
    flats: [{ x: 0, z: 0, r: 22, h: 0, falloff: 8 }],
    paths: [{ pts: [[0, 30], [0, -30]], width: 4 }],
    rim: { height: 8, inset: 10 },
  });
  const house = buildHouse(L, {
    x: -10, z: -8, rot: 0, w: 9, d: 7, floors: 2, loft: 0.55,
    doors: [{ side: 's', off: 2 }],
    windows: [{ side: 'e', off: 0, floor: 0 }, { side: 'n', off: -2, floor: 1 }, { side: 'w', off: -1.5, floor: 1 }],
    interiorLadder: { lx: -2.5 },
  });
  // outside ladder up to north upper window
  const win = house.windows.find((w) => w.y > 1)!;
  makeLadder(L, {
    bx: win.x + win.nx * 1.3, bz: win.z + win.nz * 1.3, by: L.h(win.x + win.nx * 1.3, win.z + win.nz * 1.3),
    tx: win.x + win.nx * 0.2, tz: win.z + win.nz * 0.2, ty: win.y + 0.95,
    ex: win.x - win.nx * 0.9, ez: win.z - win.nz * 0.9, ey: win.y,
    facing: Math.atan2(win.nx, win.nz), pushable: true, viaWindow: win,
  });
  const door = house.doors[0];
  const [sx, sz] = house.toWorld(3.3, 2.6);
  makeShelf(L, sx, sz, door.x, door.z - 0.45, 0, house.base, door);
  crate(L, 5, 3);
  crate(L, 6, 3.2, 0.3);
  barrel(L, 7, -2);
  hay(L, 4, -6, 0.4);
  cart(L, 10, 6, 0.6);
  rock(L, 12, -10, 1.4);
  fence(L, [[-20, 12], [-8, 14], [4, 13]]);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    pine(L, Math.cos(a) * 26 + Math.sin(i) * 2, Math.sin(a) * 26);
  }
  boundary(L, [[-30, -30], [30, -30], [30, 30], [-30, 30], [-30, -30]]);
  L.finalize();
  return {
    id: 'test',
    name: '测试场地',
    level: L,
    entries: { start: { x: 0, z: 12, yaw: 0 } },
    fog: { color: 0x8a8272, density: 0.022 },
    sky: { top: 0x5a5a62, bottom: 0x9a9280 },
    sunDir: new THREE.Vector3(0.5, 0.45, -0.7).normalize(),
    sunColor: 0xffd0a0,
    sunIntensity: 2.0,
    hemi: { sky: 0xc0b8a8, ground: 0x4a4034, intensity: 1.5 },
    exposure: 1.2,
    ambience: 'village',
    spawn(gg: Game) {
      const n = (gg.flags.testEnemies as number) ?? 3;
      for (let i = 0; i < n; i++) gg.spawnEnemy({ kind: i === 2 ? 'pitchfork' : 'villager', x: -4 + i * 4, z: -2, state: 'idle', yaw: Math.PI });
      if (gg.flags.testSalvador) gg.spawnEnemy({ kind: 'salvador', x: 0, z: -15, state: 'idle' });
      gg.spawnPickup('ammo_hg', 15, new THREE.Vector3(2, 0, 10));
      gg.spawnAnimal('chicken', new THREE.Vector3(8, 0, 8));
    },
  };
}
