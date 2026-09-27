import * as THREE from 'three';
import type { Game } from '../game/game';
import type { Pickup } from '../game/entities';
import { ITEMS, RECIPES, HERB_MIX, mixKey } from '../data/items';
import { WEAPONS, wCap } from '../data/weapons';
import { itemSize, type ItemInst } from '../game/inventory';
import { itemIcon } from './icons';
import { el } from './hud';

const CELL = 52;

/** RE4-style attaché case: drag, rotate (R), mix herbs, quick slots, crafting. */
export class CaseUI {
  g: Game;
  root: HTMLElement;
  private wrap: HTMLElement | null = null;
  private grid!: HTMLElement;
  private info!: HTMLElement;
  private actions!: HTMLElement;
  private side!: HTMLElement;
  private sel: ItemInst | null = null;
  private drag: { inst: ItemInst; rot: boolean; ghost: HTMLElement; dom: HTMLElement; ox: number; oy: number; fromPending: boolean } | null = null;
  private pending: Pickup | null = null;
  private pendingInst: ItemInst | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private moveHandler = (e: MouseEvent) => this.onMove(e);
  private upHandler = (e: MouseEvent) => this.onUp(e);

  constructor(g: Game, root: HTMLElement) {
    this.g = g;
    this.root = root;
  }

  get isOpen() {
    return !!this.wrap;
  }

  open(pending: Pickup | null) {
    this.close(false);
    this.pending = pending;
    this.pendingInst = pending ? this.g.inv.newInst(pending.id, pending.count) : null;
    if (pending?.weaponState && this.pendingInst) this.pendingInst.weapon = pending.weaponState;
    this.sel = null;
    this.wrap = el('div', { id: 'case', class: 'interactive' }, this.root);
    const left = el('div', {}, this.wrap);
    el('div', { class: 'case-title' }, left, '手提箱　<span style="color:#666">拖动整理 · 拖动时按 R 旋转 · 把草药拖到另一株草药上合成</span>');
    this.grid = el('div', { class: 'case-grid' }, left);
    this.side = el('div', { class: 'case-side' }, this.wrap);
    this.g.audio.play('ui_ok');
    window.addEventListener('keydown', this.keyHandler, true);
    window.addEventListener('mousemove', this.moveHandler);
    window.addEventListener('mouseup', this.upHandler);
    this.render();
  }

  close(resume = true) {
    if (!this.wrap) return;
    window.removeEventListener('keydown', this.keyHandler, true);
    window.removeEventListener('mousemove', this.moveHandler);
    window.removeEventListener('mouseup', this.upHandler);
    this.drag?.ghost.remove();
    this.drag = null;
    this.wrap.remove();
    this.wrap = null;
    if (resume) {
      this.g.audio.play('ui_back');
      this.g.resume();
    }
  }

  private onKey(e: KeyboardEvent) {
    if (e.code === 'Tab' || e.code === 'Escape' || e.code === 'KeyI') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    } else if (e.code === 'KeyR' && this.drag) {
      e.preventDefault();
      e.stopPropagation();
      this.drag.rot = !this.drag.rot;
      this.updateGhost(this.lastMouse.x, this.lastMouse.y);
    }
  }

  private lastMouse = { x: 0, y: 0 };

  render() {
    const g = this.g;
    const inv = g.inv;
    this.grid.innerHTML = '';
    this.grid.style.width = `${inv.cols * CELL}px`;
    this.grid.style.height = `${inv.rows * CELL}px`;
    for (let y = 0; y < inv.rows; y++)
      for (let x = 0; x < inv.cols; x++) {
        const c = el('div', { class: 'case-cell' }, this.grid);
        c.style.cssText = `left:${x * CELL}px;top:${y * CELL}px;width:${CELL}px;height:${CELL}px`;
      }
    for (const it of inv.items) {
      const [w, h] = itemSize(it);
      const d = el('div', { class: 'case-item' + (this.sel === it ? ' sel' : '') }, this.grid, itemIcon(it.id, it.rot));
      d.style.cssText = `left:${it.x * CELL + 1}px;top:${it.y * CELL + 1}px;width:${w * CELL - 2}px;height:${h * CELL - 2}px;background:${ITEMS[it.id].color}55`;
      const def = ITEMS[it.id];
      if (def.stack > 1) el('span', { class: 'cnt' }, d, String(it.count));
      if (it.weapon) el('span', { class: 'cnt' }, d, `${it.weapon.mag}/${wCap(it.weapon)}`);
      const slot = inv.slots.indexOf(it.uid);
      if (slot >= 0) el('span', { class: 'slot' }, d, String(slot + 1));
      if (it.uid === g.player.weaponUid) d.style.boxShadow = 'inset 0 0 0 2px #d8b46a';
      d.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.sel = it;
        this.startDrag(it, e, d, false);
        this.renderSide();
      });
      d.addEventListener('dblclick', () => this.primary(it));
    }
    this.renderSide();
  }

  private renderSide() {
    const g = this.g;
    const inv = g.inv;
    this.side.innerHTML = '';
    const head = el('div', { class: 'case-info' }, this.side);
    head.innerHTML = `<b>里昂</b>　体力 ${Math.round(g.player.hp)} / ${g.player.maxHp}<br>小刀耐久 ${Math.round((g.player.knife / 1000) * 100)}%　${inv.pesetas.toLocaleString()} PTAS`;
    if (this.pending && this.pendingInst) {
      const p = el('div', { class: 'pending' }, this.side, `<b style="color:#fdd">待放置：${ITEMS[this.pending.id].name}${this.pending.count > 1 ? ' ×' + this.pending.count : ''}</b><br>把它拖进手提箱，或者丢弃其他物品腾出空间。`);
      const pd = el('div', { class: 'case-item' }, p, itemIcon(this.pendingInst.id, this.pendingInst.rot));
      const [w, h] = itemSize(this.pendingInst);
      pd.style.cssText = `position:relative;margin-top:8px;width:${w * CELL}px;height:${h * CELL}px;background:${ITEMS[this.pendingInst.id].color}55`;
      pd.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.startDrag(this.pendingInst!, e, pd, true);
      });
    }
    this.info = el('div', { class: 'case-info' }, this.side);
    this.actions = el('div', { class: 'case-actions' }, this.side);
    const it = this.sel && inv.items.includes(this.sel) ? this.sel : null;
    if (it) {
      const d = ITEMS[it.id];
      let extra = '';
      if (it.weapon) {
        const wd = WEAPONS[it.weapon.id];
        extra = `<br>威力 ${wd.damage[it.weapon.lv.power]} · 装弹 ${wCap(it.weapon)} · 换弹 ${wd.reload[it.weapon.lv.reload]}s`;
      }
      this.info.innerHTML = `<b>${d.name}</b>${d.stack > 1 ? ` ×${it.count}` : ''}<br>${d.desc}${extra}`;
      const btn = (t: string, fn: () => void, dis = false) => {
        const b = el('button', {}, this.actions, t);
        b.disabled = dis;
        b.addEventListener('click', () => {
          fn();
          this.render();
        });
      };
      if (it.weapon) btn(it.uid === g.player.weaponUid ? '已装备' : '装备', () => g.player.equip(it.uid), it.uid === g.player.weaponUid);
      if (d.heal !== undefined) btn('使用', () => this.use(it), g.player.hp >= g.player.maxHp && !d.maxUp);
      if (d.kind === 'herb') {
        const partner = inv.items.find((o) => o !== it && HERB_MIX[mixKey(o.id, it.id)]);
        btn('合成', () => partner && this.mix(it, partner), !partner);
      }
      if (d.kind === 'weapon' || d.kind === 'grenade') {
        for (let s = 0; s < 8; s++) {
          const cur = inv.slots[s];
          const b = el('button', {}, this.actions, `键${s + 1}`);
          if (cur === it.uid) b.style.borderColor = '#d8b46a';
          b.title = '设置为快捷键';
          b.addEventListener('click', () => {
            const old = inv.slots.indexOf(it.uid);
            if (old >= 0) inv.slots[old] = null;
            inv.slots[s] = it.uid;
            this.render();
          });
        }
      }
      btn('旋转', () => {
        if (inv.canPlace(it.id, it.x, it.y, !it.rot, it.uid)) it.rot = !it.rot;
        else g.hud.toast('空间不足，无法旋转');
      });
      btn('丢弃', () => this.discard(it), !!(it.weapon && inv.weapons().length <= 1));
    } else {
      this.info.innerHTML = '<span style="color:#888">选择一个物品查看详情。双击：装备 / 使用。</span>';
    }
    const tools = el('div', { class: 'case-actions' }, this.side);
    const sortBtn = el('button', {}, tools, '自动整理');
    sortBtn.addEventListener('click', () => {
      if (!inv.autoSort()) g.hud.toast('无法整理');
      this.render();
    });
    const closeBtn = el('button', {}, tools, '关闭 (Tab)');
    closeBtn.addEventListener('click', () => this.close());

    // valuables
    const vals = Object.entries(inv.valuables).filter(([, n]) => n > 0);
    const vb = el('div', { class: 'valuables' }, this.side, '<div style="color:var(--gold);margin-bottom:4px">贵重物品 / 材料</div>');
    if (!vals.length) el('div', {}, vb, '<span style="color:#666">（无）</span>');
    for (const [id, n] of vals) el('div', {}, vb, `<span>${ITEMS[id]?.name ?? id}</span><span>×${n}</span>`);
    // crafting
    const cb = el('div', { class: 'valuables' }, this.side, '<div style="color:var(--gold);margin-bottom:4px">制作</div>');
    for (const r of RECIPES) {
      const can = r.needs.every(([id, n]) => inv.count(id) >= n);
      const row = el('div', {}, cb);
      el('span', {}, row, `${ITEMS[r.out].name} ×${r.count}　<span style="color:#777">${r.needs.map(([id, n]) => `${ITEMS[id].name}${n > 1 ? '×' + n : ''}`).join(' + ')}</span>`);
      const b = el('button', {}, row, '制作');
      b.style.cssText = 'background:rgba(216,180,106,.12);border:1px solid var(--line);color:var(--txt);cursor:pointer;font-size:12px;padding:2px 8px;';
      b.disabled = !can;
      b.addEventListener('click', () => this.craft(r.id));
    }
  }

  private primary(it: ItemInst) {
    const d = ITEMS[it.id];
    if (it.weapon) this.g.player.equip(it.uid);
    else if (d.heal !== undefined) this.use(it);
    this.render();
  }

  private use(it: ItemInst) {
    this.g.useItem(it);
    if (this.sel === it && !this.g.inv.items.includes(it)) this.sel = null;
  }

  private mix(a: ItemInst, b: ItemInst) {
    const res = this.g.inv.mix(a, b);
    if (res) {
      this.g.audio.play('heal', undefined, 0.6);
      this.g.hud.toast(`合成了 ${ITEMS[res].name}`);
      this.sel = b;
    }
  }

  private discard(it: ItemInst) {
    const g = this.g;
    g.inv.remove(it);
    if (it.uid === g.player.weaponUid) g.player.equip(g.inv.weapons()[0]?.uid ?? null);
    // drop on the ground so it can be picked up again
    const p = g.player.pos;
    const pk = g.spawnPickup(it.id, it.count, new THREE.Vector3(p.x - Math.sin(g.player.yaw) * 0.6, p.y, p.z - Math.cos(g.player.yaw) * 0.6));
    if (pk && it.weapon) pk.weaponState = it.weapon; // keep mag/upgrades
    this.sel = null;
    g.audio.play('item_drop');
  }

  private craft(id: string) {
    const g = this.g;
    const r = RECIPES.find((x) => x.id === id)!;
    const inv = g.inv;
    // check space
    const test = inv.add(r.out, r.count);
    if (test > 0) {
      inv.take(r.out, r.count - test);
      g.hud.toast('手提箱空间不足');
      g.audio.play('ui_error');
      return;
    }
    for (const [nid, n] of r.needs) inv.take(nid, n);
    g.audio.play('shell');
    g.hud.toast(`制作了 ${ITEMS[r.out].name} ×${r.count}`);
    this.render();
  }

  // ---------------------------------------------------------------- dragging

  private startDrag(inst: ItemInst, e: MouseEvent, dom: HTMLElement, fromPending: boolean) {
    const rect = dom.getBoundingClientRect();
    const ghost = el('div', { class: 'case-ghost' }, this.grid);
    this.drag = { inst, rot: inst.rot, ghost, dom, ox: e.clientX - rect.left, oy: e.clientY - rect.top, fromPending };
    dom.style.opacity = '0.4';
    this.lastMouse = { x: e.clientX, y: e.clientY };
    this.updateGhost(e.clientX, e.clientY);
  }

  private cellAt(cx: number, cy: number): { x: number; y: number } {
    const d = this.drag!;
    const r = this.grid.getBoundingClientRect();
    const [w, h] = itemSize({ id: d.inst.id, rot: d.rot });
    const x = Math.round((cx - r.left - d.ox * (d.rot !== d.inst.rot ? 0 : 1) - (d.rot !== d.inst.rot ? (w * CELL) / 2 : 0)) / CELL);
    const y = Math.round((cy - r.top - d.oy * (d.rot !== d.inst.rot ? 0 : 1) - (d.rot !== d.inst.rot ? (h * CELL) / 2 : 0)) / CELL);
    return { x, y };
  }

  private updateGhost(cx: number, cy: number) {
    const d = this.drag;
    if (!d) return;
    const { x, y } = this.cellAt(cx, cy);
    const [w, h] = itemSize({ id: d.inst.id, rot: d.rot });
    const ok = this.g.inv.canPlace(d.inst.id, x, y, d.rot, d.inst.uid);
    const target = this.herbTarget(cx, cy);
    d.ghost.className = 'case-ghost' + (ok || target ? '' : ' bad');
    d.ghost.style.cssText = `left:${x * CELL}px;top:${y * CELL}px;width:${w * CELL}px;height:${h * CELL}px`;
  }

  private herbTarget(cx: number, cy: number): ItemInst | null {
    const d = this.drag;
    if (!d || !ITEMS[d.inst.id].id.startsWith('herb')) return null;
    const r = this.grid.getBoundingClientRect();
    const gx = Math.floor((cx - r.left) / CELL), gy = Math.floor((cy - r.top) / CELL);
    for (const it of this.g.inv.items) {
      if (it === d.inst) continue;
      const [w, h] = itemSize(it);
      if (gx >= it.x && gx < it.x + w && gy >= it.y && gy < it.y + h && HERB_MIX[mixKey(it.id, d.inst.id)]) return it;
    }
    return null;
  }

  private onMove(e: MouseEvent) {
    this.lastMouse = { x: e.clientX, y: e.clientY };
    if (this.drag) this.updateGhost(e.clientX, e.clientY);
  }

  private onUp(e: MouseEvent) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.ghost.remove();
    d.dom.style.opacity = '1';
    const g = this.g;
    const herb = this.herbTarget(e.clientX, e.clientY);
    if (herb) {
      if (d.fromPending) {
        // pick up then mix
        g.inv.items.push(d.inst);
        this.finishPending();
      }
      this.mix(d.inst, herb);
      this.render();
      return;
    }
    const { x, y } = this.cellAt(e.clientX, e.clientY);
    if (g.inv.placeAt(d.inst, x, y, d.rot)) {
      g.audio.play('ui_move');
      if (d.fromPending) this.finishPending();
    } else if (x !== d.inst.x || y !== d.inst.y) g.audio.play('ui_error');
    this.render();
  }

  private finishPending() {
    const g = this.g;
    const pk = this.pending;
    if (!pk) return;
    pk.taken = true;
    if (pk.flag) g.flags['got_' + pk.flag] = true;
    pk.dispose();
    g.pickups = g.pickups.filter((x) => x !== pk);
    g.audio.play('pickup');
    const d = ITEMS[pk.id];
    if (d.kind === 'weapon') g.hud.toast(`获得 ${d.name}！`);
    this.pending = null;
    this.pendingInst = null;
    g.pendingPickup = null;
  }
}
