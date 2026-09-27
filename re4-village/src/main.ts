import * as THREE from 'three';
import { Game } from './game/game';
import { Hud } from './ui/hud';
import { rng } from './core/rng';
import type { Action } from './core/input';
import type { DifficultyId } from './data/difficulty';
import { ensureTexturesWarm } from './world/props';
import './levels/areas';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const game = new Game(canvas);
const hud = new Hud(game, uiRoot);
game.hud = hud;
game.test = params.has('test');
game.input.allowUnlocked = game.test;
if (params.has('debug')) {
  game.godMode = params.get('debug') === 'god';
  hud.showFps = true;
}
game.loadSettings();
ensureTexturesWarm();

function resize() {
  game.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

hud.menus.onNewGame = (d: DifficultyId) => {
  game.newGame(d);
};

// pointer lock / audio unlock
canvas.addEventListener('click', () => {
  game.audio.init();
  if (game.state === 'play' && !game.input.locked && !game.test) game.input.requestLock();
});
window.addEventListener('keydown', () => game.audio.init(), { once: true });
game.input.onLockChange = (locked) => {
  if (!locked && game.state === 'play' && !game.test) game.pause();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play' && !game.test) game.pause();
});

// start
const startArea = params.get('area');
if (startArea) {
  game.flags.testArea = startArea;
  game.test = true;
  game.input.allowUnlocked = true;
  if (params.has('enemies')) game.flags.testEnemies = parseInt(params.get('enemies')!);
  if (params.has('salvador')) game.flags.testSalvador = true;
  if (params.has('seed')) rng.seed(parseInt(params.get('seed')!));
  const d = (params.get('diff') as DifficultyId) ?? 'standard';
  game.newGame(d);
  hud.setGameplayVisible(true);
} else {
  game.setState('title');
  hud.setGameplayVisible(false);
  hud.menus.title();
}

// main loop
let last = performance.now();
let manual = false;
function frame(now: number) {
  requestAnimationFrame(frame);
  if (manual) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  game.input.endFrame();
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ test harness
declare global {
  interface Window {
    __game: unknown;
  }
}
window.__game = {
  g: game,
  THREE,
  /** Advance the simulation deterministically (disables the rAF loop). */
  step(sec: number, dt = 1 / 60) {
    manual = true;
    const n = Math.round(sec / dt);
    for (let i = 0; i < n; i++) {
      game.update(dt);
      game.input.endFrame();
    }
    game.render();
  },
  resume() {
    manual = false;
    last = performance.now();
  },
  render() {
    game.render();
  },
  press(a: Action) {
    game.input.setVirtual(a, true);
  },
  release(a: Action) {
    game.input.setVirtual(a, false);
  },
  tap(a: Action) {
    game.input.tap(a);
  },
  look(dx: number, dy: number) {
    game.input.mouseDX += dx;
    game.input.mouseDY += dy;
  },
  aimAt(x: number, y: number, z: number) {
    const cam = game.camera;
    const p = game.player.pos;
    let from = new THREE.Vector3(p.x, p.y + 1.58, p.z);
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Vector3(x, y, z).sub(from);
      cam.yaw = Math.atan2(-d.x, -d.z);
      cam.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      cam.recoil = cam.recoilYaw = 0;
      cam.update(0, game.player.pos, game.level?.cw ?? null);
      from = cam.cam.position.clone();
    }
    game.player.yaw = cam.yaw;
  },
  state() {
    const p = game.player;
    return {
      state: game.state,
      area: game.area?.id,
      hp: p.hp,
      pstate: p.state,
      pos: [p.pos.x, p.pos.y, p.pos.z],
      enemies: game.enemies.map((e) => ({ kind: e.kind, hp: e.hp, state: e.state, reaction: e.reaction, aware: e.aware, pos: [e.pos.x, e.pos.y, e.pos.z] })),
      pickups: game.pickups.map((k) => k.id),
      calls: game.renderer.stats.calls,
      tris: game.renderer.stats.triangles,
      mag: p.weapon?.weapon?.mag,
      flags: game.flags,
    };
  },
};
