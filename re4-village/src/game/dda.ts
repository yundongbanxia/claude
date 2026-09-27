import { clamp, lerp } from '../core/math';
import { rng } from '../core/rng';
import { ITEMS } from '../data/items';
import { WEAPONS } from '../data/weapons';
import type { DifficultyDef } from '../data/difficulty';
import type { Inventory } from './inventory';

/**
 * Hidden dynamic difficulty (RE4-style "action rank").
 * Rank rises when the player plays cleanly, drops when they take damage or die.
 * It scales enemy damage/aggression and biases item drops toward what the player needs.
 */
export class DDA {
  rank: number;
  min: number;
  max: number;
  private cleanT = 0;

  constructor(d: DifficultyDef) {
    this.min = d.ddaMin;
    this.max = d.ddaMax;
    this.rank = d.ddaStart;
  }

  setDifficulty(d: DifficultyDef) {
    this.min = d.ddaMin;
    this.max = d.ddaMax;
    this.rank = clamp(this.rank, this.min, this.max);
  }

  rankN(): number {
    return this.max === this.min ? 1 : (this.rank - this.min) / (this.max - this.min);
  }

  private bump(v: number) {
    this.rank = clamp(this.rank + v, this.min, this.max);
  }

  onPlayerDamaged(amount: number) {
    this.bump(-(amount / 1000) * 1.3);
    this.cleanT = 0;
  }
  onPlayerDeath() {
    this.bump(-1.5);
  }
  onKill() {
    this.bump(0.07);
  }
  onHeadshot() {
    this.bump(0.02);
  }
  update(dt: number) {
    this.cleanT += dt;
    if (this.cleanT > 30) {
      this.cleanT = 0;
      this.bump(0.12);
    }
  }

  damageMult(): number {
    return lerp(0.8, 1.2, this.rankN());
  }
  cooldownMult(): number {
    return lerp(1.2, 0.85, this.rankN());
  }

  /** Decide an enemy drop. Returns [itemId, count] or null. */
  rollDrop(inv: Inventory, hpFrac: number, lootMult: number, big = false): [string, number] | null {
    const chance = clamp((big ? 1 : 0.56) * lootMult * lerp(1.15, 0.9, this.rankN()), 0, 1);
    if (!rng.chance(chance)) return null;
    const entries: [string, number][] = [];
    // ammo for owned weapons, weighted by scarcity
    const owned = inv.weapons().map((w) => WEAPONS[w.weapon!.id]);
    const ammoSeen = new Set<string>();
    for (const wd of owned) {
      if (ammoSeen.has(wd.ammo)) continue;
      ammoSeen.add(wd.ammo);
      const comfort = wd.ammo === 'ammo_hg' ? 30 : wd.ammo === 'ammo_sg' ? 10 : 8;
      const have = inv.count(wd.ammo) + inv.weapons().filter((w) => WEAPONS[w.weapon!.id].ammo === wd.ammo).reduce((a, w) => a + w.weapon!.mag, 0);
      const need = clamp(1 - have / comfort, 0, 1);
      entries.push([wd.ammo, 8 + need * 40]);
    }
    entries.push(['pesetas', 26]);
    entries.push(['herb_g', 4 + clamp(1 - hpFrac, 0, 1) * 30]);
    entries.push(['gunpowder', 9]);
    entries.push(['res_s', 5]);
    entries.push(['res_l', 3]);
    if (big) entries.push(['nade', 6]);
    const pick = rng.weighted(entries);
    if (!pick) return null;
    switch (pick) {
      case 'pesetas':
        return ['pesetas', rng.pick([100, 150, 200, 300, 500])];
      case 'ammo_hg':
        return ['ammo_hg', rng.int(6, 12)];
      case 'ammo_sg':
        return ['ammo_sg', rng.int(2, 4)];
      case 'ammo_rf':
        return ['ammo_rf', rng.int(2, 3)];
      default:
        return ITEMS[pick] ? [pick, 1] : null;
    }
  }
}
