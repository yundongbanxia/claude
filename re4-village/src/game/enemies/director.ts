import * as THREE from 'three';
import type { FlowField } from '../../world/nav';
import type { Game } from '../game';
import type { Enemy } from './enemy';

/**
 * Coordinates enemies: melee attack tokens (only a few swing at once, the rest
 * close in and circle — the RE4 "surround" feel), ranged throw slots, the shared
 * flow field toward the player, and alert propagation.
 */
export class Director {
  g: Game;
  field: FlowField | null = null;
  leaveField: FlowField | null = null;
  private fieldT = 0;
  private lastTarget = new THREE.Vector3(1e9, 0, 0);
  private lastLayer = -1;
  private tokens = new Set<Enemy>();
  private ranged = new Set<Enemy>();
  grabBonusT = 0;
  intensity = 0;

  constructor(g: Game) {
    this.g = g;
  }

  reset() {
    this.field = null;
    this.leaveField = null;
    this.tokens.clear();
    this.ranged.clear();
    this.lastTarget.set(1e9, 0, 0);
    this.fieldT = 0;
  }

  maxTokens(): number {
    return this.g.diff.tokens + (this.g.dda.rankN() > 0.75 ? 1 : 0) + (this.grabBonusT > 0 ? 2 : 0);
  }

  requestToken(e: Enemy): boolean {
    if (this.tokens.has(e)) return true;
    // prune
    const pp = this.g.player.pos;
    for (const t of this.tokens) if (!t.alive || (t.state !== 'attack' && t.state !== 'chase') || t.pos.distanceTo(pp) > 4.5) this.tokens.delete(t);
    if (e.isSalvador) {
      this.tokens.add(e);
      return true;
    }
    let count = 0;
    for (const t of this.tokens) if (!t.isSalvador) count++;
    if (count >= this.maxTokens()) return false;
    this.tokens.add(e);
    return true;
  }

  releaseToken(e: Enemy) {
    this.tokens.delete(e);
  }

  requestRanged(e: Enemy): boolean {
    if (this.ranged.has(e)) return true;
    for (const t of this.ranged) if (!t.alive || (t.state !== 'throw' && t.state !== 'light')) this.ranged.delete(t);
    if (this.ranged.size >= (this.g.diff.tokens >= 2 ? 2 : 1)) return false;
    this.ranged.add(e);
    return true;
  }

  releaseRanged(e: Enemy) {
    this.ranged.delete(e);
  }

  onPlayerGrabbed(_by: Enemy) {
    // others get a free swing at the helpless player
    this.grabBonusT = 3;
  }

  alertAround(pos: THREE.Vector3, radius: number) {
    for (const e of this.g.enemies) {
      if (e.aware || !e.alive) continue;
      const d = e.pos.distanceTo(pos);
      if (d < radius) e.becomeAware(0.2 + d * 0.06, d < radius * 0.5);
    }
  }

  update(dt: number) {
    const g = this.g;
    this.grabBonusT = Math.max(0, this.grabBonusT - dt);
    const lv = g.level;
    if (!lv) return;
    const p = g.player;
    this.fieldT -= dt;
    const floorId = lv.cw.floorIdAt(p.pos.x, p.pos.z, p.pos.y);
    const layer = lv.nav.layerForFloor(floorId);
    const anyChasing = g.enemies.some((e) => e.alive && e.aware);
    if (anyChasing && (this.fieldT <= 0 || layer !== this.lastLayer || p.pos.distanceTo(this.lastTarget) > 1.2)) {
      if (this.fieldT <= 0 || p.pos.distanceTo(this.lastTarget) > 0.4 || layer !== this.lastLayer) {
        this.field = lv.nav.computeField(p.pos.x, p.pos.z, layer, 80, g.time);
        this.lastTarget.copy(p.pos);
        this.lastLayer = layer;
        this.fieldT = 0.35;
      }
    }
    // combat intensity for music
    let near = 0;
    for (const e of g.enemies) {
      if (!e.alive || !e.aware) continue;
      const d = e.pos.distanceTo(p.pos);
      if (d < 25) near += e.isSalvador ? 3 : d < 8 ? 1 : 0.5;
    }
    const target = near === 0 ? 0 : near < 2 ? 0.5 : 1;
    this.intensity = target;
    if (g.audio.music) g.audio.music.target = g.state === 'play' ? target : g.audio.music.target;
  }

  computeLeaveField(x: number, z: number) {
    const lv = this.g.level;
    if (!lv) return;
    this.leaveField = lv.nav.computeField(x, z, 0, 200);
  }
}
