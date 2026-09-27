import { describe, it, expect } from 'vitest';
import { DDA } from '../../src/game/dda';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { Inventory } from '../../src/game/inventory';
import { rng } from '../../src/core/rng';

describe('Dynamic difficulty', () => {
  it('drops rank on damage and death, raises on kills', () => {
    const d = new DDA(DIFFICULTIES.standard);
    const r0 = d.rank;
    d.onPlayerDamaged(500);
    expect(d.rank).toBeLessThan(r0);
    const r1 = d.rank;
    for (let i = 0; i < 20; i++) d.onKill();
    expect(d.rank).toBeGreaterThan(r1);
    d.onPlayerDeath();
    expect(d.rank).toBeGreaterThanOrEqual(DIFFICULTIES.standard.ddaMin);
  });

  it('professional is pinned at max rank', () => {
    const d = new DDA(DIFFICULTIES.professional);
    d.onPlayerDeath();
    expect(d.rankN()).toBe(1);
  });

  it('biases drops toward scarce ammo', () => {
    rng.seed(42);
    const d = new DDA(DIFFICULTIES.standard);
    const inv = new Inventory();
    inv.add('sg09');
    let ammo = 0, total = 0;
    for (let i = 0; i < 400; i++) {
      const r = d.rollDrop(inv, 1, 1);
      if (r) {
        total++;
        if (r[0] === 'ammo_hg') ammo++;
      }
    }
    expect(total).toBeGreaterThan(100);
    expect(ammo / total).toBeGreaterThan(0.35);
  });
});
