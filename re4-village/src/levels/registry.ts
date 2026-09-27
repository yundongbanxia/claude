import type { Game } from '../game/game';
import type { AreaBuilder, AreaInstance } from './area';
import { buildTest } from './test';

const AREAS: Record<string, AreaBuilder> = {
  test: buildTest,
};

export function registerArea(id: string, b: AreaBuilder) {
  AREAS[id] = b;
}

export function buildArea(id: string, g: Game): AreaInstance {
  const b = AREAS[id] ?? AREAS.test;
  return b(g);
}
