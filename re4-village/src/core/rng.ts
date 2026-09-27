/** Seedable PRNG (mulberry32). Use `rng` everywhere so tests can seed deterministically. */
export class Rng {
  private s: number;
  constructor(seed = Date.now() | 0) {
    this.s = seed >>> 0;
  }
  seed(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }
  weighted<T>(entries: readonly (readonly [T, number])[]): T | null {
    let total = 0;
    for (const [, w] of entries) total += Math.max(0, w);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= Math.max(0, w);
      if (r <= 0) return v;
    }
    return entries[entries.length - 1][0];
  }
}

export const rng = new Rng(12345);
