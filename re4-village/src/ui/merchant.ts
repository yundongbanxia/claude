import type { Game } from '../game/game';
import { ITEMS } from '../data/items';
import { WEAPONS, wCap, type UpgradeStat, type WeaponId } from '../data/weapons';
import { KNIFE_MAX } from '../game/player/player';
import { el } from './hud';

type Tab = 'buy' | 'sell' | 'upgrade' | 'repair' | 'trade';

interface ShopEntry {
  id: string;
  price: number;
  count?: number;
  once?: boolean;
  label?: string;
  desc?: string;
}

const STOCK: ShopEntry[] = [
  { id: 'spray', price: 3000 },
  { id: 'nade', price: 1500 },
  { id: 'flash', price: 1000 },
  { id: 'gunpowder', price: 400, desc: '制作弹药的材料' },
  { id: 'res_s', price: 500 },
  { id: 'w870', price: 13000, once: true },
  { id: 'sr1903', price: 12000, once: true },
  { id: 'red9', price: 16500, once: true },
  { id: 'case_l', price: 14000, once: true, label: '手提箱(L) 12×8', desc: '更大的手提箱，能放下更多物品。' },
];

const TRADES: { id: string; cost: number; count?: number }[] = [
  { id: 'herb_y', cost: 2 },
  { id: 'spray', cost: 3 },
  { id: 'egg_gold', cost: 3 },
  { id: 'nade', cost: 2 },
  { id: 'velvet_blue', cost: 3 },
];

const STAT_NAMES: Record<UpgradeStat, string> = { power: '威力', capacity: '装弹数', reload: '换弹速度', rate: '射速' };

/** The Merchant: buy / sell / tune-up / knife repair / spinel trades. */
export class MerchantUI {
  g: Game;
  root: HTMLElement;
  private wrap: HTMLElement | null = null;
  private tab: Tab = 'buy';
  private keyHandler = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  };

  constructor(g: Game, root: HTMLElement) {
    this.g = g;
    this.root = root;
  }

  open() {
    this.tab = 'buy';
    this.wrap = el('div', { class: 'screen dim interactive' }, this.root);
    window.addEventListener('keydown', this.keyHandler, true);
    this.g.audio.say("What're ya buyin'?", 'en', 0.55, 0.9);
    this.render();
  }

  close() {
    if (!this.wrap) return;
    window.removeEventListener('keydown', this.keyHandler, true);
    this.wrap.remove();
    this.wrap = null;
    this.g.audio.say('Come back any time.', 'en', 0.55, 0.9);
    this.g.resume();
  }

  private say(text: string) {
    this.g.audio.say(text, 'en', 0.55, 0.9);
  }

  private render() {
    const g = this.g;
    const w = this.wrap!;
    w.innerHTML = '';
    const p = el('div', { class: 'panel' }, w);
    const head = el('div', { class: 'merchant-head' }, p);
    const q = { buy: "What're ya buyin'?", sell: "What're ya sellin'?", upgrade: 'Tune-up, stranger?', repair: "Let's sharpen that knife.", trade: 'Got some spinel for me?' }[this.tab];
    el('span', { class: 'q' }, head, `“${q}”`);
    el('span', { class: 'money' }, head, `${g.inv.pesetas.toLocaleString()} PTAS　尖晶石 ×${g.inv.count('spinel')}`);
    const tabs = el('div', { class: 'tabs' }, p);
    const names: [Tab, string][] = [
      ['buy', '购买'],
      ['sell', '出售'],
      ['upgrade', '改造'],
      ['repair', '修理小刀'],
      ['trade', '交易'],
    ];
    for (const [t, n] of names) {
      const b = el('button', { class: this.tab === t ? 'on' : '' }, tabs, n);
      b.addEventListener('click', () => {
        this.tab = t;
        g.audio.play('ui_move');
        this.render();
      });
    }
    const shop = el('div', { class: 'shop' }, p);
    const list = el('div', { class: 'list' }, shop);
    switch (this.tab) {
      case 'buy':
        this.renderBuy(list);
        break;
      case 'sell':
        this.renderSell(list);
        break;
      case 'upgrade':
        this.renderUpgrade(list);
        break;
      case 'repair':
        this.renderRepair(list);
        break;
      case 'trade':
        this.renderTrade(list);
        break;
    }
    const foot = el('div', { class: 'case-actions' }, p);
    foot.style.marginTop = '14px';
    const cb = el('button', {}, foot, '打开手提箱');
    cb.addEventListener('click', () => {
      this.wrapClose();
      g.hud.openCase(null);
      g.setState('inventory');
    });
    const x = el('button', {}, foot, '离开 (Esc)');
    x.addEventListener('click', () => this.close());
  }

  private wrapClose() {
    window.removeEventListener('keydown', this.keyHandler, true);
    this.wrap?.remove();
    this.wrap = null;
  }

  private row(list: HTMLElement, name: string, sub: string, price: string, btnText: string, enabled: boolean, fn: () => void) {
    const r = el('div', { class: 'item' }, list);
    el('div', {}, r, `${name}<span class="sub">${sub}</span>`);
    el('span', { class: 'price' }, r, price);
    const b = el('button', { class: 'act' }, r, btnText);
    b.disabled = !enabled;
    b.addEventListener('click', () => {
      fn();
      this.render();
    });
  }

  private pay(n: number): boolean {
    const g = this.g;
    if (g.inv.pesetas < n) {
      g.audio.play('ui_error');
      this.say('Not enough cash, stranger.');
      return false;
    }
    g.inv.pesetas -= n;
    g.audio.play('buy');
    return true;
  }

  private renderBuy(list: HTMLElement) {
    const g = this.g;
    for (const s of STOCK) {
      const d = ITEMS[s.id];
      if (s.once && (g.flags['bought_' + s.id] || (d.weapon && g.inv.hasWeapon(d.weapon)))) continue;
      this.row(list, s.label ?? d.name, s.desc ?? d.desc, `${s.price.toLocaleString()} PTAS`, '购买', g.inv.pesetas >= s.price, () => {
        if (!this.pay(s.price)) return;
        if (s.id === 'case_l') {
          g.inv.resize(12, 8);
          g.flags['bought_case_l'] = true;
          this.say('Heh heh heh, thank you!');
          return;
        }
        const left = g.inv.add(s.id, s.count ?? 1);
        if (left > 0) {
          g.inv.pesetas += s.price;
          g.hud.toast('手提箱空间不足');
          g.audio.play('ui_error');
          return;
        }
        if (s.once) g.flags['bought_' + s.id] = true;
        this.say('Heh heh heh, thank you!');
      });
    }
  }

  private renderSell(list: HTMLElement) {
    const g = this.g;
    const inv = g.inv;
    for (const it of inv.items) {
      const d = ITEMS[it.id];
      const unit = d.sell;
      if (unit <= 0) continue;
      const price = unit * (d.stack > 1 ? it.count : 1);
      const isOnlyWeapon = !!it.weapon && inv.weapons().length <= 1;
      this.row(list, d.name + (d.stack > 1 ? ` ×${it.count}` : ''), d.desc, `${price.toLocaleString()} PTAS`, '出售', !isOnlyWeapon, () => {
        inv.remove(it);
        if (it.uid === g.player.weaponUid) g.player.equip(inv.weapons()[0]?.uid ?? null);
        inv.pesetas += price;
        g.audio.play('buy');
        this.say('Heh heh heh, thank you!');
      });
    }
    for (const [id, n] of Object.entries(inv.valuables)) {
      const d = ITEMS[id];
      if (!d || d.sell <= 0 || n <= 0 || d.kind === 'resource') continue;
      this.row(list, `${d.name} ×${n}`, d.desc, `${(d.sell * n).toLocaleString()} PTAS`, '出售', true, () => {
        inv.take(id, n);
        inv.pesetas += d.sell * n;
        g.audio.play('buy');
        this.say('Heh heh heh, thank you!');
      });
    }
    if (!list.children.length) el('div', { class: 'item' }, list, '<span style="color:#777">没有可以出售的东西。</span>');
  }

  private renderUpgrade(list: HTMLElement) {
    const g = this.g;
    for (const it of g.inv.weapons()) {
      const ws = it.weapon!;
      const wd = WEAPONS[ws.id as WeaponId];
      el('div', { class: 'item' }, list, `<b style="color:var(--gold2);font-weight:400">${wd.name}</b>`);
      for (const stat of ['power', 'capacity', 'reload', 'rate'] as UpgradeStat[]) {
        const costs = wd.upgradeCost[stat];
        const lv = ws.lv[stat];
        const max = costs.length;
        const cur = stat === 'power' ? wd.damage[lv] : stat === 'capacity' ? wd.capacity[lv] : stat === 'reload' ? wd.reload[lv] + 's' : wd.rate[lv] + 's';
        const next = lv < max ? (stat === 'power' ? wd.damage[lv + 1] : stat === 'capacity' ? wd.capacity[lv + 1] : stat === 'reload' ? wd.reload[lv + 1] + 's' : wd.rate[lv + 1] + 's') : '';
        const pips = `<span class="lvl">${Array.from({ length: max + 1 }, (_, i) => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>`;
        const price = lv < max ? costs[lv] : 0;
        this.row(list, `${STAT_NAMES[stat]} ${pips}`, lv < max ? `${cur} → ${next}` : `${cur}（已满）`, lv < max ? `${price.toLocaleString()} PTAS` : '—', '改造', lv < max && g.inv.pesetas >= price, () => {
          if (!this.pay(price)) return;
          ws.lv[stat]++;
          if (stat === 'capacity') ws.mag = Math.min(ws.mag, wCap(ws));
          this.say('Heh heh heh, thank you!');
        });
      }
    }
  }

  private renderRepair(list: HTMLElement) {
    const g = this.g;
    const p = g.player;
    const missing = KNIFE_MAX - p.knife;
    const cost = Math.ceil(missing * 5 / 100) * 100;
    this.row(list, '战斗小刀', `耐久度 ${Math.round((p.knife / KNIFE_MAX) * 100)}%${p.knife <= 0 ? '（已损坏）' : ''}`, missing > 0 ? `${cost.toLocaleString()} PTAS` : '—', '修理', missing > 0 && g.inv.pesetas >= cost, () => {
      if (!this.pay(cost)) return;
      p.knife = KNIFE_MAX;
      g.audio.play('metal');
      this.say('Good as new, stranger.');
    });
  }

  private renderTrade(list: HTMLElement) {
    const g = this.g;
    if (g.flags.medallionsDone && !g.flags.medallionsRewarded) {
      this.row(list, '委托：击碎蓝色徽章', '完成委托的报酬', '奖励', '领取', true, () => {
        g.inv.add('spinel', 3);
        g.inv.pesetas += 5000;
        g.flags.medallionsRewarded = true;
        g.audio.play('buy');
        this.say('Heh heh heh, thank you!');
      });
    }
    for (const t of TRADES) {
      const d = ITEMS[t.id];
      this.row(list, d.name, d.desc, `尖晶石 ×${t.cost}`, '交换', g.inv.count('spinel') >= t.cost, () => {
        if (g.inv.count('spinel') < t.cost) return;
        const left = g.inv.add(t.id, t.count ?? 1);
        if (left > 0) {
          g.hud.toast('手提箱空间不足');
          return;
        }
        g.inv.take('spinel', t.cost);
        g.audio.play('buy');
      });
    }
  }
}
