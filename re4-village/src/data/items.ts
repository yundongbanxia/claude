import type { WeaponId } from './weapons';

export type ItemKind = 'weapon' | 'ammo' | 'heal' | 'herb' | 'grenade' | 'treasure' | 'key' | 'resource' | 'knife';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  w: number;
  h: number;
  stack: number;
  /** merchant sell price (what the merchant pays) */
  sell: number;
  desc: string;
  color: string;
  heal?: number; // absolute HP, -1 = full
  maxUp?: number;
  weapon?: WeaponId;
  /** grid-less valuables (treasures, keys, resources) */
  valuable?: boolean;
}

const I = (d: ItemDef) => d;

export const ITEMS: Record<string, ItemDef> = {
  sg09: I({ id: 'sg09', name: 'SG-09 R 手枪', kind: 'weapon', w: 3, h: 2, stack: 1, sell: 1000, desc: '里昂的标准配枪。', color: '#4a4f58', weapon: 'sg09' }),
  red9: I({ id: 'red9', name: 'Red9 手枪', kind: 'weapon', w: 4, h: 2, stack: 1, sell: 8000, desc: '高威力手枪。', color: '#5a4a40', weapon: 'red9' }),
  w870: I({ id: 'w870', name: 'W-870 霰弹枪', kind: 'weapon', w: 7, h: 2, stack: 1, sell: 6500, desc: '近距离威力惊人。', color: '#4a4038', weapon: 'w870' }),
  sr1903: I({ id: 'sr1903', name: 'SR M1903 步枪', kind: 'weapon', w: 8, h: 1, stack: 1, sell: 6000, desc: '栓动步枪，可贯穿。', color: '#4a3e30', weapon: 'sr1903' }),

  ammo_hg: I({ id: 'ammo_hg', name: '手枪子弹', kind: 'ammo', w: 1, h: 1, stack: 30, sell: 10, desc: '手枪用弹药。', color: '#6b6a3a' }),
  ammo_sg: I({ id: 'ammo_sg', name: '霰弹', kind: 'ammo', w: 1, h: 1, stack: 12, sell: 40, desc: '霰弹枪用弹药。', color: '#7a3a2a' }),
  ammo_rf: I({ id: 'ammo_rf', name: '步枪子弹', kind: 'ammo', w: 1, h: 1, stack: 10, sell: 60, desc: '步枪用弹药。', color: '#6a5a2a' }),

  herb_g: I({ id: 'herb_g', name: '绿色草药', kind: 'herb', w: 1, h: 2, stack: 1, sell: 100, desc: '恢复少量体力。可与其他草药混合。', color: '#3f6a2a', heal: 300 }),
  herb_r: I({ id: 'herb_r', name: '红色草药', kind: 'herb', w: 1, h: 2, stack: 1, sell: 100, desc: '单独使用无效。与绿色草药混合可完全恢复。', color: '#7a2a24' }),
  herb_y: I({ id: 'herb_y', name: '黄色草药', kind: 'herb', w: 1, h: 2, stack: 1, sell: 800, desc: '单独使用无效。混合后可提升体力上限。', color: '#8a7a2a' }),
  herb_gg: I({ id: 'herb_gg', name: '混合草药(绿+绿)', kind: 'herb', w: 1, h: 2, stack: 1, sell: 300, desc: '恢复中等体力。', color: '#4a8030', heal: 600 }),
  herb_ggg: I({ id: 'herb_ggg', name: '混合草药(绿+绿+绿)', kind: 'herb', w: 1, h: 2, stack: 1, sell: 600, desc: '完全恢复体力。', color: '#5a9a38', heal: -1 }),
  herb_gr: I({ id: 'herb_gr', name: '混合草药(绿+红)', kind: 'herb', w: 1, h: 2, stack: 1, sell: 600, desc: '完全恢复体力。', color: '#6a5a2a', heal: -1 }),
  herb_gy: I({ id: 'herb_gy', name: '混合草药(绿+黄)', kind: 'herb', w: 1, h: 2, stack: 1, sell: 1000, desc: '恢复体力并提升体力上限。', color: '#7a8a2a', heal: 300, maxUp: 100 }),
  herb_ry: I({ id: 'herb_ry', name: '混合草药(红+黄)', kind: 'herb', w: 1, h: 2, stack: 1, sell: 1000, desc: '单独使用无效。再加入绿色草药效果极佳。', color: '#8a4a2a' }),
  herb_gry: I({ id: 'herb_gry', name: '混合草药(绿+红+黄)', kind: 'herb', w: 1, h: 2, stack: 1, sell: 2500, desc: '完全恢复体力并大幅提升体力上限。', color: '#9a7a3a', heal: -1, maxUp: 200 }),
  spray: I({ id: 'spray', name: '急救喷雾', kind: 'heal', w: 1, h: 2, stack: 1, sell: 1500, desc: '完全恢复体力。', color: '#b8b8b0', heal: -1 }),
  egg_w: I({ id: 'egg_w', name: '白鸡蛋', kind: 'heal', w: 1, h: 1, stack: 1, sell: 50, desc: '恢复少量体力。', color: '#e8e4d8', heal: 150 }),
  egg_b: I({ id: 'egg_b', name: '褐鸡蛋', kind: 'heal', w: 1, h: 1, stack: 1, sell: 100, desc: '恢复中等体力。', color: '#a87a4a', heal: 400 }),
  egg_gold: I({ id: 'egg_gold', name: '金鸡蛋', kind: 'heal', w: 1, h: 1, stack: 1, sell: 3000, desc: '完全恢复体力。', color: '#d8b040', heal: -1 }),

  nade: I({ id: 'nade', name: '手雷', kind: 'grenade', w: 1, h: 2, stack: 1, sell: 700, desc: '投掷后爆炸，范围杀伤。', color: '#4a5a3a' }),
  flash: I({ id: 'flash', name: '闪光弹', kind: 'grenade', w: 1, h: 2, stack: 1, sell: 500, desc: '强光使周围敌人暂时失明。', color: '#8a8a8a' }),

  // valuables (no grid space)
  gunpowder: I({ id: 'gunpowder', name: '火药', kind: 'resource', w: 1, h: 1, stack: 99, sell: 50, desc: '制作弹药的材料。', color: '#444', valuable: true }),
  res_s: I({ id: 'res_s', name: '资源(小)', kind: 'resource', w: 1, h: 1, stack: 99, sell: 50, desc: '制作的材料。', color: '#665', valuable: true }),
  res_l: I({ id: 'res_l', name: '资源(大)', kind: 'resource', w: 1, h: 1, stack: 99, sell: 100, desc: '制作的材料。', color: '#776', valuable: true }),
  spinel: I({ id: 'spinel', name: '尖晶石', kind: 'treasure', w: 1, h: 1, stack: 99, sell: 0, desc: '可在商人处交换特殊物品。', color: '#c04070', valuable: true }),
  velvet_blue: I({ id: 'velvet_blue', name: '天鹅绒蓝宝石', kind: 'treasure', w: 1, h: 1, stack: 99, sell: 2500, desc: '闪着蓝光的宝石。', color: '#3a4ab0', valuable: true }),
  antique_pipe: I({ id: 'antique_pipe', name: '古董烟斗', kind: 'treasure', w: 1, h: 1, stack: 99, sell: 9000, desc: '雕工精美的烟斗。', color: '#6a4a2a', valuable: true }),
  gold_bangle: I({ id: 'gold_bangle', name: '金手镯', kind: 'treasure', w: 1, h: 1, stack: 99, sell: 7500, desc: '沉甸甸的金手镯。', color: '#c0a040', valuable: true }),
  elegant_mask: I({ id: 'elegant_mask', name: '华丽面具', kind: 'treasure', w: 1, h: 1, stack: 99, sell: 12000, desc: '镶嵌宝石的面具。', color: '#a08060', valuable: true }),
  ruby: I({ id: 'ruby', name: '红宝石', kind: 'treasure', w: 1, h: 1, stack: 99, sell: 10000, desc: '从电锯男身上得到的红宝石。', color: '#b02030', valuable: true }),
  crank: I({ id: 'crank', name: '摇柄', kind: 'key', w: 1, h: 1, stack: 1, sell: 0, desc: '转动绞盘用的铁摇柄。', color: '#555', valuable: true }),
  lodge_key: I({ id: 'lodge_key', name: '旧钥匙', kind: 'key', w: 1, h: 1, stack: 1, sell: 0, desc: '一把生锈的钥匙。', color: '#886', valuable: true }),
  case_l: I({ id: 'case_l', name: '手提箱(L)', kind: 'key', w: 1, h: 1, stack: 1, sell: 0, desc: '更大的手提箱。', color: '#553', valuable: true }),
};

export interface Recipe {
  id: string;
  out: string;
  count: number;
  needs: [string, number][];
}

export const RECIPES: Recipe[] = [
  { id: 'r_hg', out: 'ammo_hg', count: 10, needs: [['gunpowder', 1]] },
  { id: 'r_sg', out: 'ammo_sg', count: 4, needs: [['gunpowder', 1], ['res_s', 1]] },
  { id: 'r_rf', out: 'ammo_rf', count: 3, needs: [['gunpowder', 1], ['res_l', 1]] },
  { id: 'r_nade', out: 'nade', count: 1, needs: [['gunpowder', 2], ['res_l', 1]] },
  { id: 'r_flash', out: 'flash', count: 1, needs: [['res_s', 2]] },
];

/** herb mixing: sorted pair -> result */
export const HERB_MIX: Record<string, string> = {
  'herb_g+herb_g': 'herb_gg',
  'herb_g+herb_gg': 'herb_ggg',
  'herb_g+herb_r': 'herb_gr',
  'herb_g+herb_y': 'herb_gy',
  'herb_r+herb_y': 'herb_ry',
  'herb_g+herb_ry': 'herb_gry',
  'herb_gr+herb_y': 'herb_gry',
  'herb_gy+herb_r': 'herb_gry',
};

export function mixKey(a: string, b: string) {
  return [a, b].sort().join('+');
}
