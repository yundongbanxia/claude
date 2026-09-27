export type WeaponId = 'sg09' | 'red9' | 'w870' | 'sr1903';
export type AmmoId = 'ammo_hg' | 'ammo_sg' | 'ammo_rf';
export type UpgradeStat = 'power' | 'capacity' | 'reload' | 'rate';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: 'pistol' | 'shotgun' | 'rifle';
  ammo: AmmoId;
  /** values per upgrade level */
  damage: number[];
  capacity: number[];
  reload: number[];
  rate: number[];
  upgradeCost: Record<UpgradeStat, number[]>;
  pellets: number;
  spreadMin: number; // degrees
  spreadMax: number;
  recoil: number; // degrees of camera kick
  headMult: number;
  limbMult: number;
  critBase: number;
  pierce: number;
  range: number;
  falloffStart: number;
  /** shell-by-shell reload */
  singleLoad: boolean;
  price: number;
  size: [number, number];
  desc: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sg09: {
    id: 'sg09',
    name: 'SG-09 R',
    kind: 'pistol',
    ammo: 'ammo_hg',
    damage: [100, 120, 140, 165],
    capacity: [10, 12, 15, 18],
    reload: [1.55, 1.35, 1.15],
    rate: [0.3, 0.26, 0.22],
    upgradeCost: { power: [4000, 8000, 14000], capacity: [3000, 5000, 7000], reload: [2500, 5000], rate: [3000, 6500] },
    pellets: 1,
    spreadMin: 0.35,
    spreadMax: 3.2,
    recoil: 1.3,
    headMult: 1.8,
    limbMult: 0.75,
    critBase: 0.05,
    pierce: 1,
    range: 80,
    falloffStart: 80,
    singleLoad: false,
    price: 0,
    size: [3, 2],
    desc: '里昂的标准配枪。准星收拢时爆头更容易触发暴击。',
  },
  red9: {
    id: 'red9',
    name: 'Red9',
    kind: 'pistol',
    ammo: 'ammo_hg',
    damage: [185, 215, 250, 290],
    capacity: [8, 10, 12, 14],
    reload: [2.0, 1.75, 1.5],
    rate: [0.42, 0.37, 0.33],
    upgradeCost: { power: [7000, 12000, 18000], capacity: [4000, 7000, 10000], reload: [4000, 7000], rate: [5000, 9000] },
    pellets: 1,
    spreadMin: 0.4,
    spreadMax: 4.2,
    recoil: 3.6,
    headMult: 1.8,
    limbMult: 0.75,
    critBase: 0.04,
    pierce: 1,
    range: 80,
    falloffStart: 80,
    singleLoad: false,
    price: 16500,
    size: [4, 2],
    desc: '高威力手枪，后坐力很大。',
  },
  w870: {
    id: 'w870',
    name: 'W-870',
    kind: 'shotgun',
    ammo: 'ammo_sg',
    damage: [50, 58, 68, 80],
    capacity: [5, 6, 7, 8],
    reload: [0.55, 0.47, 0.4],
    rate: [0.95, 0.85, 0.75],
    upgradeCost: { power: [8000, 13000, 20000], capacity: [5000, 8000, 11000], reload: [4000, 7000], rate: [5000, 9000] },
    pellets: 10,
    spreadMin: 8.5,
    spreadMax: 9.0,
    recoil: 5.0,
    headMult: 1.4,
    limbMult: 0.85,
    critBase: 0,
    pierce: 1,
    range: 20,
    falloffStart: 5,
    singleLoad: true,
    price: 13000,
    size: [7, 2],
    desc: '近距离威力惊人，可以同时击退多名敌人。',
  },
  sr1903: {
    id: 'sr1903',
    name: 'SR M1903',
    kind: 'rifle',
    ammo: 'ammo_rf',
    damage: [480, 560, 650, 760],
    capacity: [5, 6, 8, 10],
    reload: [2.3, 2.0, 1.7],
    rate: [1.45, 1.3, 1.15],
    upgradeCost: { power: [9000, 15000, 24000], capacity: [5000, 8000, 12000], reload: [5000, 8000], rate: [6000, 10000] },
    pellets: 1,
    spreadMin: 0.05,
    spreadMax: 2.5,
    recoil: 5.5,
    headMult: 3,
    limbMult: 0.8,
    critBase: 0,
    pierce: 3,
    range: 150,
    falloffStart: 150,
    singleLoad: false,
    price: 12000,
    size: [8, 1],
    desc: '栓动狙击步枪，子弹可以贯穿多名敌人。',
  },
};

export interface WeaponState {
  id: WeaponId;
  mag: number;
  lv: Record<UpgradeStat, number>;
}

export function newWeaponState(id: WeaponId, full = true): WeaponState {
  const s: WeaponState = { id, mag: 0, lv: { power: 0, capacity: 0, reload: 0, rate: 0 } };
  if (full) s.mag = WEAPONS[id].capacity[0];
  return s;
}

export const wDamage = (s: WeaponState) => WEAPONS[s.id].damage[s.lv.power];
export const wCap = (s: WeaponState) => WEAPONS[s.id].capacity[s.lv.capacity];
export const wReload = (s: WeaponState) => WEAPONS[s.id].reload[s.lv.reload];
export const wRate = (s: WeaponState) => WEAPONS[s.id].rate[s.lv.rate];
