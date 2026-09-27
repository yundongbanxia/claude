export type DifficultyId = 'assisted' | 'standard' | 'hardcore' | 'professional';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  desc: string;
  enemyDamage: number;
  enemyHp: number;
  /** simultaneous melee attackers */
  tokens: number;
  attackCooldown: number; // multiplier
  aimAssist: number; // 0..1 reticle snap strength toward heads
  parryWindow: number; // seconds for perfect parry
  guardParry: boolean; // holding guard auto-parries
  grabEscape: number; // mash progress per press
  salvadorGrabKills: boolean;
  lootMult: number;
  siegeTime: number; // seconds until bell
  ddaMin: number;
  ddaMax: number;
  ddaStart: number;
  regen: boolean; // slow health regen up to 1/3 (assisted)
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  assisted: {
    id: 'assisted',
    name: '辅助',
    desc: '适合初次接触动作游戏的玩家。有瞄准辅助，体力会缓慢恢复。',
    enemyDamage: 0.55,
    enemyHp: 0.8,
    tokens: 1,
    attackCooldown: 1.4,
    aimAssist: 0.6,
    parryWindow: 0.35,
    guardParry: true,
    grabEscape: 0.22,
    salvadorGrabKills: false,
    lootMult: 1.35,
    siegeTime: 170,
    ddaMin: 1,
    ddaMax: 4,
    ddaStart: 2,
    regen: true,
  },
  standard: {
    id: 'standard',
    name: '标准',
    desc: '推荐难度。按照原作标准难度的节奏设计。',
    enemyDamage: 1,
    enemyHp: 1,
    tokens: 2,
    attackCooldown: 1,
    aimAssist: 0,
    parryWindow: 0.25,
    guardParry: true,
    grabEscape: 0.15,
    salvadorGrabKills: true,
    lootMult: 1,
    siegeTime: 215,
    ddaMin: 2,
    ddaMax: 7,
    ddaStart: 4,
    regen: false,
  },
  hardcore: {
    id: 'hardcore',
    name: '硬核',
    desc: '面向熟悉原作的玩家。敌人更凶猛，资源更稀缺。',
    enemyDamage: 1.5,
    enemyHp: 1.2,
    tokens: 3,
    attackCooldown: 0.8,
    aimAssist: 0,
    parryWindow: 0.2,
    guardParry: true,
    grabEscape: 0.11,
    salvadorGrabKills: true,
    lootMult: 0.8,
    siegeTime: 240,
    ddaMin: 5,
    ddaMax: 9,
    ddaStart: 6,
    regen: false,
  },
  professional: {
    id: 'professional',
    name: '专家',
    desc: '极限挑战。只有完美时机的格挡才有效，任何失误都可能致命。',
    enemyDamage: 2.2,
    enemyHp: 1.35,
    tokens: 3,
    attackCooldown: 0.7,
    aimAssist: 0,
    parryWindow: 0.14,
    guardParry: false,
    grabEscape: 0.09,
    salvadorGrabKills: true,
    lootMult: 0.7,
    siegeTime: 260,
    ddaMin: 10,
    ddaMax: 10,
    ddaStart: 10,
    regen: false,
  },
};
