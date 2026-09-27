import type * as THREE from 'three';
import type { Level } from '../world/level';
import type { Game } from '../game/game';
import type { Enemy } from '../game/enemies/enemy';

export interface AreaInstance {
  id: string;
  name: string;
  level: Level;
  entries: Record<string, { x: number; z: number; yaw: number }>;
  fog: { color: number; density: number };
  sky: { top: number; bottom: number };
  sunDir: THREE.Vector3;
  sunColor: number;
  sunIntensity: number;
  hemi: { sky: number; ground: number; intensity: number };
  exposure?: number;
  ambience: 'forest' | 'village' | 'farm' | 'none';
  spawn(g: Game): void;
  onEnter?(g: Game, entry: string): void;
  update?(g: Game, dt: number): void;
  onEnemyKilled?(g: Game, e: Enemy): void;
}

export type AreaBuilder = (g: Game) => AreaInstance;
