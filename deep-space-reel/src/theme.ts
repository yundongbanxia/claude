import { Easing } from "remotion";

/**
 * Visual tokens. CLAUDE.md is the source of truth — change both together.
 */

// Palette: deep-space black + three inks. Nothing else.
export const COLOR = {
  space: "#04060A",
  white: "#E4E9EF", // cold white — text, hairlines, stars
  gold: "#CBB682", // pale gold — key numbers, milestones
  rust: "#B4552F", // Mars rust — Mars only
} as const;

// Hairline opacities, so lines stay quiet under text.
export const ALPHA = {
  faint: 0.14,
  line: 0.28,
  muted: 0.55,
  text: 0.92,
} as const;

// Timing curves. No overshoot, no bounce, anywhere.
export const EASE = {
  // Text / line reveals: fast start, long settle (expo-out feel).
  reveal: Easing.bezier(0.16, 1, 0.3, 1),
  // Camera moves and anything that travels: symmetric, slow in and out.
  camera: Easing.bezier(0.65, 0, 0.35, 1),
  // Exits: accelerate away.
  exit: Easing.bezier(0.7, 0, 0.84, 0),
  linear: Easing.linear,
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene lengths (frames). Transitions overlap neighbours by TRANSITION frames.
export const TRANSITION = 20;
export const SCENE = {
  prologue: 150,
  voyager: 290,
  lightDay: 180,
  mars: 270,
  outro: 90,
} as const;

export const TOTAL_FRAMES =
  SCENE.prologue +
  SCENE.voyager +
  SCENE.lightDay +
  SCENE.mars +
  SCENE.outro -
  4 * TRANSITION; // = 900 → 30 s

// Absolute start frame of each scene in the master timeline.
export const SCENE_START = {
  prologue: 0,
  voyager: SCENE.prologue - TRANSITION,
  lightDay: SCENE.prologue + SCENE.voyager - 2 * TRANSITION,
  mars: SCENE.prologue + SCENE.voyager + SCENE.lightDay - 3 * TRANSITION,
  outro:
    SCENE.prologue +
    SCENE.voyager +
    SCENE.lightDay +
    SCENE.mars -
    4 * TRANSITION,
} as const;

// Safe area (px) for anything that must be read.
export const SAFE = { x: 140, y: 110 } as const;

// clamp both sides — the default for every interpolate() in this project.
export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
