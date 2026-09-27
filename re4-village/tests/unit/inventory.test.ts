import { describe, it, expect } from 'vitest';
import { Inventory } from '../../src/game/inventory';

describe('Inventory (attaché case)', () => {
  it('stacks ammo and respects stack size', () => {
    const inv = new Inventory(10, 7);
    expect(inv.add('ammo_hg', 45)).toBe(0);
    expect(inv.count('ammo_hg')).toBe(45);
    expect(inv.items.filter((i) => i.id === 'ammo_hg').length).toBe(2);
  });

  it('places weapons without overlap and fills quick slots', () => {
    const inv = new Inventory(10, 7);
    inv.add('sg09');
    inv.add('w870');
    const [a, b] = inv.items;
    expect(a.x + 3 <= b.x || b.y >= a.y + 2 || a.y >= b.y + 2).toBe(true);
    expect(inv.slots.filter((s) => s !== null).length).toBe(2);
  });

  it('reports leftover when full', () => {
    const inv = new Inventory(2, 2);
    expect(inv.add('herb_g')).toBe(0);
    expect(inv.add('herb_g')).toBe(0);
    expect(inv.add('herb_g')).toBe(1);
  });

  it('rotates to fit', () => {
    const inv = new Inventory(2, 1);
    expect(inv.add('herb_g')).toBe(0); // 1x2 only fits rotated
    expect(inv.items[0].rot).toBe(true);
  });

  it('mixes herbs', () => {
    const inv = new Inventory(10, 7);
    inv.add('herb_g');
    inv.add('herb_r');
    const [g, r] = inv.items;
    expect(inv.mix(g, r)).toBe('herb_gr');
    expect(inv.items.length).toBe(1);
    expect(inv.items[0].id).toBe('herb_gr');
  });

  it('take() consumes across stacks and valuables', () => {
    const inv = new Inventory(10, 7);
    inv.add('ammo_hg', 35);
    expect(inv.take('ammo_hg', 32)).toBe(32);
    expect(inv.count('ammo_hg')).toBe(3);
    inv.add('gunpowder', 3);
    expect(inv.take('gunpowder', 5)).toBe(3);
    expect(inv.count('gunpowder')).toBe(0);
  });

  it('autoSort packs and serialization round-trips', () => {
    const inv = new Inventory(10, 7);
    inv.add('sg09');
    inv.add('herb_g');
    inv.add('ammo_hg', 12);
    inv.add('w870');
    expect(inv.autoSort()).toBe(true);
    const copy = Inventory.deserialize(JSON.parse(JSON.stringify(inv.serialize())));
    expect(copy.count('ammo_hg')).toBe(12);
    expect(copy.weapons().length).toBe(2);
  });
});
