import { ITEMS, HERB_MIX, mixKey, type ItemDef } from '../data/items';
import { newWeaponState, type WeaponState } from '../data/weapons';

export interface ItemInst {
  uid: number;
  id: string;
  count: number;
  x: number;
  y: number;
  rot: boolean;
  weapon?: WeaponState;
}

let UID = 1;

export function itemSize(it: { id: string; rot: boolean }): [number, number] {
  const d = ITEMS[it.id];
  return it.rot ? [d.h, d.w] : [d.w, d.h];
}

/** Attaché case grid + valuables. Pure logic (no DOM) so it can be unit tested. */
export class Inventory {
  cols: number;
  rows: number;
  items: ItemInst[] = [];
  valuables: Record<string, number> = {};
  pesetas = 0;
  /** quick slots 1..8 -> item uid */
  slots: (number | null)[] = [null, null, null, null, null, null, null, null];

  constructor(cols = 10, rows = 7) {
    this.cols = cols;
    this.rows = rows;
  }

  static def(id: string): ItemDef {
    const d = ITEMS[id];
    if (!d) throw new Error('unknown item ' + id);
    return d;
  }

  canPlace(id: string, x: number, y: number, rot: boolean, ignoreUid = -1): boolean {
    const [w, h] = itemSize({ id, rot });
    if (x < 0 || y < 0 || x + w > this.cols || y + h > this.rows) return false;
    for (const it of this.items) {
      if (it.uid === ignoreUid) continue;
      const [iw, ih] = itemSize(it);
      if (x < it.x + iw && x + w > it.x && y < it.y + ih && y + h > it.y) return false;
    }
    return true;
  }

  findSpot(id: string, preferRot = false): { x: number; y: number; rot: boolean } | null {
    const d = Inventory.def(id);
    const rots = d.w === d.h ? [false] : preferRot ? [true, false] : [false, true];
    for (const rot of rots) {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.canPlace(id, x, y, rot)) return { x, y, rot };
        }
      }
    }
    return null;
  }

  /** Add an item (stacking where possible). Returns leftover count that didn't fit. */
  add(id: string, count = 1, weapon?: WeaponState): number {
    const d = Inventory.def(id);
    if (d.valuable) {
      this.valuables[id] = (this.valuables[id] ?? 0) + count;
      return 0;
    }
    let left = count;
    if (d.stack > 1) {
      for (const it of this.items) {
        if (it.id !== id || it.count >= d.stack) continue;
        const n = Math.min(left, d.stack - it.count);
        it.count += n;
        left -= n;
        if (!left) return 0;
      }
    }
    while (left > 0) {
      const spot = this.findSpot(id);
      if (!spot) return left;
      const n = Math.min(left, d.stack);
      const inst: ItemInst = { uid: UID++, id, count: n, ...spot };
      if (d.kind === 'weapon' && d.weapon) inst.weapon = weapon ?? newWeaponState(d.weapon);
      this.items.push(inst);
      left -= n;
      if (d.kind === 'weapon') this.autoSlot(inst);
    }
    return 0;
  }

  autoSlot(inst: ItemInst) {
    if (this.slots.includes(inst.uid)) return;
    const i = this.slots.indexOf(null);
    if (i >= 0) this.slots[i] = inst.uid;
  }

  placeAt(inst: ItemInst, x: number, y: number, rot: boolean): boolean {
    if (!this.canPlace(inst.id, x, y, rot, inst.uid)) return false;
    inst.x = x;
    inst.y = y;
    inst.rot = rot;
    if (!this.items.includes(inst)) {
      this.items.push(inst);
      const d = ITEMS[inst.id];
      if (d.kind === 'weapon' || d.kind === 'grenade') this.autoSlot(inst);
    }
    return true;
  }

  newInst(id: string, count = 1): ItemInst {
    const d = ITEMS[id];
    const inst: ItemInst = { uid: UID++, id, count, x: -1, y: -1, rot: false };
    if (d.kind === 'weapon' && d.weapon) inst.weapon = newWeaponState(d.weapon);
    return inst;
  }

  remove(inst: ItemInst) {
    const i = this.items.indexOf(inst);
    if (i >= 0) this.items.splice(i, 1);
    const s = this.slots.indexOf(inst.uid);
    if (s >= 0) this.slots[s] = null;
  }

  byUid(uid: number | null): ItemInst | undefined {
    if (uid === null) return undefined;
    return this.items.find((i) => i.uid === uid);
  }

  count(id: string): number {
    const d = ITEMS[id];
    if (d?.valuable) return this.valuables[id] ?? 0;
    let n = 0;
    for (const it of this.items) if (it.id === id) n += it.count;
    return n;
  }

  /** Take up to n of item id (smallest stacks first). Returns amount taken. */
  take(id: string, n: number): number {
    const d = ITEMS[id];
    if (d?.valuable) {
      const have = this.valuables[id] ?? 0;
      const t = Math.min(have, n);
      this.valuables[id] = have - t;
      if (!this.valuables[id]) delete this.valuables[id];
      return t;
    }
    let taken = 0;
    const stacks = this.items.filter((i) => i.id === id).sort((a, b) => a.count - b.count);
    for (const s of stacks) {
      const t = Math.min(s.count, n - taken);
      s.count -= t;
      taken += t;
      if (s.count <= 0) this.remove(s);
      if (taken >= n) break;
    }
    return taken;
  }

  weapons(): ItemInst[] {
    return this.items.filter((i) => !!i.weapon);
  }

  hasWeapon(id: string) {
    return this.items.some((i) => i.weapon?.id === id);
  }

  /** Mix herb a into herb b; returns result id or null. */
  mix(a: ItemInst, b: ItemInst): string | null {
    const res = HERB_MIX[mixKey(a.id, b.id)];
    if (!res) return null;
    this.remove(a);
    b.id = res;
    b.count = 1;
    // result is same size (1x2) so it stays in b's place
    return res;
  }

  /** Re-pack all items largest-first. Returns false (and keeps layout) if it fails. */
  autoSort(): boolean {
    const backup = this.items.map((i) => ({ ...i }));
    const sorted = [...this.items].sort((a, b) => {
      const [aw, ah] = [ITEMS[a.id].w, ITEMS[a.id].h];
      const [bw, bh] = [ITEMS[b.id].w, ITEMS[b.id].h];
      return bw * bh - aw * ah || bw - aw || a.id.localeCompare(b.id);
    });
    this.items = [];
    for (const it of sorted) {
      const spot = this.findSpot(it.id, ITEMS[it.id].h > ITEMS[it.id].w);
      if (!spot) {
        this.items = backup.map((b) => {
          const orig = sorted.find((s) => s.uid === b.uid)!;
          Object.assign(orig, b);
          return orig;
        });
        return false;
      }
      it.x = spot.x;
      it.y = spot.y;
      it.rot = spot.rot;
      this.items.push(it);
    }
    return true;
  }

  resize(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  serialize() {
    return {
      cols: this.cols,
      rows: this.rows,
      items: this.items.map((i) => ({ ...i, weapon: i.weapon ? { ...i.weapon, lv: { ...i.weapon.lv } } : undefined })),
      valuables: { ...this.valuables },
      pesetas: this.pesetas,
      slots: [...this.slots],
    };
  }

  static deserialize(d: ReturnType<Inventory['serialize']>): Inventory {
    const inv = new Inventory(d.cols, d.rows);
    inv.items = d.items.map((i) => ({ ...i, weapon: i.weapon ? { ...i.weapon, lv: { ...i.weapon.lv } } : undefined }));
    for (const it of inv.items) UID = Math.max(UID, it.uid + 1);
    inv.valuables = { ...d.valuables };
    inv.pesetas = d.pesetas;
    inv.slots = [...d.slots];
    return inv;
  }
}
