import { makeClip, mirrorSpec, type PoseSpec, type Clip } from './animator';

/**
 * Hand-authored keyframe clips (degrees / meters).
 * Rotation conventions (character faces -Z):
 *  - limbs hanging down: +X swings forward, shin/knee bend = -X, elbow bend = +X
 *  - spine/chest/head: -X leans/nods forward, +Y turns left
 *  - left arm outward = -Z, right arm outward = +Z
 */

// ---------------------------------------------------------------- Ganado base
const GB: PoseSpec = {
  spine: [-8, 0, 0],
  chest: [-5, 0, 0],
  neck: [8, 0, 0],
  head: [2, 0, 6],
  lArm: [4, 0, -6],
  rArm: [4, 0, 6],
  lFore: [14, 0, 0],
  rFore: [14, 0, 0],
};

function cycle(name: string, dur: number, A: PoseSpec, P: PoseSpec, base: PoseSpec, events?: { t: number; name: string }[]): Clip {
  return makeClip(
    name,
    [
      [0, A],
      [dur * 0.25, P],
      [dur * 0.5, mirrorSpec(A)],
      [dur * 0.75, mirrorSpec(P)],
      [dur, A],
    ],
    { loop: true, base, events },
  );
}

const walkA: PoseSpec = {
  lThigh: [24, 0, 0], lShin: [-6, 0, 0], lFoot: [10, 0, 0],
  rThigh: [-18, 0, 0], rShin: [-22, 0, 0], rFoot: [-12, 0, 0],
  lArm: [-14, 0, -6], rArm: [18, 0, 6],
  hips: [0, 6, 0], chest: [-5, -6, 0], y: -0.02,
};
const walkP: PoseSpec = {
  lThigh: [-2, 0, 0], lShin: [-4, 0, 0], lFoot: [0, 0, 0],
  rThigh: [24, 0, 0], rShin: [-52, 0, 0], rFoot: [0, 0, 0],
  lArm: [2, 0, -6], rArm: [2, 0, 6], hips: [0, 0, 0], chest: [-5, 0, 0], y: 0.012,
};
const runA: PoseSpec = {
  lThigh: [48, 0, 0], lShin: [-14, 0, 0], lFoot: [10, 0, 0],
  rThigh: [-32, 0, 0], rShin: [-62, 0, 0], rFoot: [-20, 0, 0],
  lArm: [-38, 0, -10], rArm: [42, 0, 10], lFore: [60, 0, 0], rFore: [60, 0, 0],
  spine: [-18, 0, 0], chest: [-10, -8, 0], hips: [0, 8, 0], y: -0.03,
};
const runP: PoseSpec = {
  lThigh: [4, 0, 0], lShin: [-12, 0, 0], lFoot: [0, 0, 0],
  rThigh: [42, 0, 0], rShin: [-100, 0, 0], rFoot: [0, 0, 0],
  lArm: [4, 0, -10], rArm: [4, 0, 10], lFore: [60, 0, 0], rFore: [60, 0, 0],
  spine: [-18, 0, 0], chest: [-10, 0, 0], hips: [0, 0, 0], y: 0.05,
};

export const G = {
  idle: makeClip(
    'idle',
    [
      [0, {}],
      [1.2, { chest: [-8, 0, 0], head: [4, 6, 8], lArm: [6, 0, -8], y: -0.008 }],
      [2.4, {}],
    ],
    { loop: true, base: GB },
  ),
  walk: cycle('walk', 1.3, walkA, walkP, GB, [{ t: 0, name: 'step' }, { t: 0.65, name: 'step' }]),
  run: cycle('run', 0.72, runA, runP, GB, [{ t: 0, name: 'step' }, { t: 0.36, name: 'step' }]),
  sidestep: makeClip(
    'sidestep',
    [
      [0, { lThigh: [0, 0, -14], rThigh: [0, 0, 4] }],
      [0.4, { lThigh: [0, 0, -2], rThigh: [0, 0, 14], y: -0.02 }],
      [0.8, { lThigh: [0, 0, -14], rThigh: [0, 0, 4] }],
    ],
    { loop: true, base: GB },
  ),
  shout: makeClip(
    'shout',
    [
      [0, {}],
      [0.25, { chest: [8, 0, 0], neck: [10, 0, 0], head: [12, 0, 0], rArm: [85, 0, 12], rFore: [5, 0, 0], lArm: [10, 0, -30] }],
      [0.8, { chest: [6, 0, 0], neck: [6, 0, 0], head: [8, 0, 0], rArm: [80, 0, 14], rFore: [8, 0, 0], lArm: [10, 0, -25] }],
      [1.1, {}],
    ],
    { base: GB },
  ),
  // one-handed overhead swing (sickle / axe / hatchet / torch)
  swing: makeClip(
    'swing',
    [
      [0, {}],
      [0.62, { rArm: [205, 0, 12], rFore: [45, 0, 0], chest: [10, -18, 0], spine: [4, -8, 0], lArm: [30, 0, -18], head: [6, 0, 0], lThigh: [10, 0, 0], rThigh: [-6, 0, 0] }],
      [0.78, { rArm: [55, 0, -8], rFore: [8, 0, 0], chest: [-22, 16, 0], spine: [-14, 8, 0], lArm: [-10, 0, -12], head: [-6, 0, 0], lThigh: [26, 0, 0], lShin: [-18, 0, 0], rThigh: [-14, 0, 0] }],
      [1.05, { rArm: [30, 0, 0], rFore: [20, 0, 0], chest: [-16, 8, 0], spine: [-12, 4, 0] }],
      [1.4, {}],
    ],
    { base: GB, events: [{ t: 0.3, name: 'windup' }, { t: 0.74, name: 'hit' }] },
  ),
  // two-handed thrust (pitchfork)
  thrust: makeClip(
    'thrust',
    [
      [0, {}],
      [0.66, { rArm: [-15, 0, 18], rFore: [95, 0, 0], lArm: [30, 0, -10], lFore: [70, 0, 0], spine: [2, -22, 0], chest: [6, -12, 0], lThigh: [12, 0, 0], rThigh: [-8, 0, 0] }],
      [0.82, { rArm: [72, 0, 6], rFore: [18, 0, 0], lArm: [82, 0, -4], lFore: [8, 0, 0], spine: [-16, 8, 0], chest: [-14, 6, 0], lThigh: [30, 0, 0], lShin: [-20, 0, 0], rThigh: [-18, 0, 0] }],
      [1.1, { rArm: [55, 0, 8], rFore: [30, 0, 0], lArm: [60, 0, -6], lFore: [25, 0, 0], spine: [-12, 4, 0] }],
      [1.5, {}],
    ],
    { base: GB, events: [{ t: 0.3, name: 'windup' }, { t: 0.78, name: 'hit' }] },
  ),
  throw: makeClip(
    'throw',
    [
      [0, {}],
      [0.55, { rArm: [210, 0, 20], rFore: [70, 0, 0], chest: [14, -28, 0], spine: [4, -10, 0], lArm: [60, 0, -12], lFore: [20, 0, 0], lThigh: [14, 0, 0] }],
      [0.7, { rArm: [70, 0, -6], rFore: [5, 0, 0], chest: [-18, 20, 0], spine: [-10, 8, 0], lArm: [0, 0, -12], lThigh: [24, 0, 0], lShin: [-14, 0, 0], rThigh: [-10, 0, 0] }],
      [1.2, {}],
    ],
    { base: GB, events: [{ t: 0.25, name: 'windup' }, { t: 0.66, name: 'release' }] },
  ),
  light: makeClip(
    'light',
    [
      [0, {}],
      [0.3, { rArm: [50, 0, -10], rFore: [70, 0, 0], lArm: [55, 0, 10], lFore: [70, 0, 0], head: [-15, 0, 0] }],
      [1.1, { rArm: [52, 0, -10], rFore: [72, 0, 0], lArm: [56, 0, 12], lFore: [68, 0, 0], head: [-15, 0, 0] }],
      [1.3, {}],
    ],
    { base: GB, events: [{ t: 0.4, name: 'lit' }] },
  ),
  grabLunge: makeClip(
    'grabLunge',
    [
      [0, {}],
      [0.45, { lArm: [70, 0, -26], rArm: [70, 0, 26], lFore: [10, 0, 0], rFore: [10, 0, 0], chest: [-12, 0, 0], spine: [-6, 0, 0], y: -0.06, lThigh: [14, 0, 0], lShin: [-18, 0, 0], rThigh: [8, 0, 0], rShin: [-18, 0, 0] }],
      [0.68, { lArm: [92, 0, 6], rArm: [92, 0, -6], lFore: [4, 0, 0], rFore: [4, 0, 0], chest: [-24, 0, 0], spine: [-14, 0, 0], lThigh: [34, 0, 0], lShin: [-10, 0, 0], rThigh: [-20, 0, 0] }],
      [1.2, { lArm: [40, 0, -10], rArm: [40, 0, 10], chest: [-12, 0, 0] }],
    ],
    { base: GB, events: [{ t: 0.25, name: 'windup' }, { t: 0.64, name: 'grab' }] },
  ),
  grabHold: makeClip(
    'grabHold',
    [
      [0, { lArm: [88, 0, 14], rArm: [88, 0, -14], lFore: [40, 0, 0], rFore: [40, 0, 0], chest: [-18, 0, 0], head: [10, 0, 0], lThigh: [16, 0, 0], lShin: [-10, 0, 0] }],
      [0.35, { lArm: [92, 0, 10], rArm: [86, 0, -16], lFore: [46, 0, 0], rFore: [36, 0, 0], chest: [-20, 4, 0], head: [14, 0, 4], lThigh: [16, 0, 0], lShin: [-10, 0, 0] }],
      [0.7, { lArm: [88, 0, 14], rArm: [88, 0, -14], lFore: [40, 0, 0], rFore: [40, 0, 0], chest: [-18, 0, 0], head: [10, 0, 0], lThigh: [16, 0, 0], lShin: [-10, 0, 0] }],
    ],
    { loop: true, base: GB },
  ),
  flinch: makeClip(
    'flinch',
    [
      [0, {}],
      [0.1, { chest: [14, 0, 0], spine: [6, 0, 0], head: [14, 0, 0], lArm: [-10, 0, -14], rArm: [-10, 0, 14], z: 0.05 }],
      [0.5, { z: 0.08 }],
    ],
    { base: GB },
  ),
  armHitR: makeClip(
    'armHitR',
    [
      [0, {}],
      [0.1, { rArm: [-50, 0, 30], rFore: [30, 0, 0], chest: [4, -24, 0], head: [6, -10, 0] }],
      [0.6, { rArm: [10, 0, 10], chest: [-4, -6, 0] }],
      [0.7, {}],
    ],
    { base: GB },
  ),
  armHitL: makeClip(
    'armHitL',
    [
      [0, {}],
      [0.1, { lArm: [-50, 0, -30], lFore: [30, 0, 0], chest: [4, 24, 0], head: [6, 10, 0] }],
      [0.6, { lArm: [10, 0, -10], chest: [-4, 6, 0] }],
      [0.7, {}],
    ],
    { base: GB },
  ),
  staggerHead: makeClip(
    'staggerHead',
    [
      [0, {}],
      [0.1, { head: [30, 0, 8], neck: [18, 0, 0], chest: [18, 0, 0], spine: [8, 0, 0], lArm: [30, 0, -30], rArm: [30, 0, 30], z: 0.1 }],
      [0.35, { head: [-10, 0, 0], neck: [-6, 0, 0], chest: [-12, 0, 0], spine: [-12, 0, 0], lArm: [115, 0, 14], rArm: [115, 0, -14], lFore: [115, 0, 0], rFore: [115, 0, 0], lThigh: [-12, 0, 0], rThigh: [14, 0, 0], rShin: [-10, 0, 0], z: 0.28 }],
      [1.2, { head: [-18, 12, 6], neck: [-6, 0, 0], chest: [-18, 8, 0], spine: [-14, 0, 0], lArm: [110, 0, 18], rArm: [112, 0, -12], lFore: [118, 0, 0], rFore: [112, 0, 0], lThigh: [-8, 0, 0], rThigh: [18, 0, 0], rShin: [-16, 0, 0], z: 0.35 }],
      [1.7, { z: 0.35 }],
    ],
    { base: GB },
  ),
  kneel: makeClip(
    'kneel',
    [
      [0, {}],
      [0.25, { y: -0.47, lThigh: [88, 0, -4], lShin: [-92, 0, 0], lFoot: [4, 0, 0], rThigh: [-4, 0, 6], rShin: [-88, 0, 0], rFoot: [-40, 0, 0], spine: [-24, 0, 0], chest: [-12, 0, 0], head: [-10, 0, 0], lArm: [34, 0, -6], lFore: [30, 0, 0], rArm: [14, 0, 10], rFore: [10, 0, 0] }],
      [1.55, { y: -0.47, lThigh: [88, 0, -4], lShin: [-92, 0, 0], lFoot: [4, 0, 0], rThigh: [-4, 0, 6], rShin: [-88, 0, 0], rFoot: [-40, 0, 0], spine: [-28, 0, 0], chest: [-14, 6, 0], head: [-6, 8, 0], lArm: [38, 0, -6], lFore: [34, 0, 0], rArm: [18, 0, 10], rFore: [16, 0, 0] }],
      [2.1, {}],
    ],
    { base: GB },
  ),
  fallBack: makeClip(
    'fallBack',
    [
      [0, {}],
      [0.3, { pitch: 38, y: 0.05, spine: [10, 0, 0], head: [20, 0, 0], lArm: [40, 0, -50], rArm: [40, 0, 50], lThigh: [20, 0, 0], lShin: [-30, 0, 0], rThigh: [10, 0, 0], z: 0.2 }],
      [0.62, { pitch: 90, y: 0.13, spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [-8, 20, 0], lArm: [30, 0, -70], rArm: [20, 0, 76], lFore: [20, 0, 0], rFore: [10, 0, 0], lThigh: [14, 0, -8], lShin: [-20, 0, 0], rThigh: [4, 0, 8], rShin: [-6, 0, 0], z: 0.35 }],
    ],
    { base: {}, events: [{ t: 0.6, name: 'land' }] },
  ),
  lieBack: makeClip(
    'lieBack',
    [
      [0, { pitch: 90, y: 0.13, head: [-8, 20, 0], lArm: [30, 0, -70], rArm: [20, 0, 76], lFore: [20, 0, 0], rFore: [10, 0, 0], lThigh: [14, 0, -8], lShin: [-20, 0, 0], rThigh: [4, 0, 8], rShin: [-6, 0, 0], z: 0.35 }],
      [1, { pitch: 90, y: 0.13, head: [-4, 14, 0], lArm: [34, 0, -66], rArm: [22, 0, 72], lFore: [26, 0, 0], rFore: [16, 0, 0], lThigh: [18, 0, -8], lShin: [-26, 0, 0], rThigh: [4, 0, 8], rShin: [-6, 0, 0], z: 0.35 }],
      [2, { pitch: 90, y: 0.13, head: [-8, 20, 0], lArm: [30, 0, -70], rArm: [20, 0, 76], lFore: [20, 0, 0], rFore: [10, 0, 0], lThigh: [14, 0, -8], lShin: [-20, 0, 0], rThigh: [4, 0, 8], rShin: [-6, 0, 0], z: 0.35 }],
    ],
    { loop: true },
  ),
  getUpBack: makeClip(
    'getUpBack',
    [
      [0, { pitch: 90, y: 0.13, head: [-8, 20, 0], lArm: [30, 0, -70], rArm: [20, 0, 76], lThigh: [14, 0, -8], lShin: [-20, 0, 0], rThigh: [4, 0, 8], z: 0.35 }],
      [0.45, { pitch: 55, y: 0.05, spine: [-50, 0, 0], chest: [-20, 0, 0], head: [-10, 0, 0], lArm: [-20, 0, -20], rArm: [-20, 0, 20], lThigh: [90, 0, 0], lShin: [-110, 0, 0], rThigh: [60, 0, 0], rShin: [-40, 0, 0], z: 0.2 }],
      [0.95, { pitch: 10, y: -0.38, spine: [-40, 0, 0], chest: [-14, 0, 0], lArm: [40, 0, -10], rArm: [40, 0, 10], lThigh: [100, 0, 0], lShin: [-120, 0, 0], rThigh: [70, 0, 0], rShin: [-100, 0, 0], z: 0.05 }],
      [1.45, {}],
    ],
    { base: GB },
  ),
  fallFront: makeClip(
    'fallFront',
    [
      [0, {}],
      [0.3, { pitch: -30, spine: [-20, 0, 0], lArm: [40, 0, -20], rArm: [40, 0, 20], lThigh: [10, 0, 0], lShin: [-40, 0, 0] }],
      [0.6, { pitch: -88, y: 0.12, head: [10, -20, 0], spine: [0, 0, 0], lArm: [150, 0, -20], rArm: [100, 0, 30], lFore: [30, 0, 0], rFore: [20, 0, 0], lThigh: [0, 0, -6], rThigh: [0, 0, 6], lShin: [-10, 0, 0], z: -0.3 }],
    ],
    { events: [{ t: 0.58, name: 'land' }] },
  ),
  lieFront: makeClip(
    'lieFront',
    [
      [0, { pitch: -88, y: 0.12, head: [10, -20, 0], lArm: [150, 0, -20], rArm: [100, 0, 30], lFore: [30, 0, 0], rFore: [20, 0, 0], lThigh: [0, 0, -6], rThigh: [0, 0, 6], lShin: [-10, 0, 0], z: -0.3 }],
      [1.5, { pitch: -88, y: 0.12, head: [12, -16, 0], lArm: [146, 0, -22], rArm: [104, 0, 30], lFore: [34, 0, 0], rFore: [24, 0, 0], lThigh: [0, 0, -6], rThigh: [0, 0, 6], lShin: [-16, 0, 0], z: -0.3 }],
      [3, { pitch: -88, y: 0.12, head: [10, -20, 0], lArm: [150, 0, -20], rArm: [100, 0, 30], lFore: [30, 0, 0], rFore: [20, 0, 0], lThigh: [0, 0, -6], rThigh: [0, 0, 6], lShin: [-10, 0, 0], z: -0.3 }],
    ],
    { loop: true },
  ),
  getUpFront: makeClip(
    'getUpFront',
    [
      [0, { pitch: -88, y: 0.12, head: [10, -20, 0], lArm: [150, 0, -20], rArm: [100, 0, 30], z: -0.3 }],
      [0.5, { pitch: -45, y: -0.1, spine: [-20, 0, 0], lArm: [70, 0, -10], rArm: [70, 0, 10], lFore: [10, 0, 0], lThigh: [100, 0, 0], lShin: [-120, 0, 0], rThigh: [80, 0, 0], rShin: [-120, 0, 0], z: -0.2 }],
      [1.0, { pitch: -5, y: -0.38, spine: [-40, 0, 0], lArm: [40, 0, -10], rArm: [40, 0, 10], lThigh: [100, 0, 0], lShin: [-120, 0, 0], rThigh: [70, 0, 0], rShin: [-100, 0, 0] }],
      [1.5, {}],
    ],
    { base: GB },
  ),
  dieCollapse: makeClip(
    'dieCollapse',
    [
      [0, {}],
      [0.35, { y: -0.35, lThigh: [60, 0, 0], lShin: [-90, 0, 0], rThigh: [40, 0, 0], rShin: [-80, 0, 0], spine: [-20, 0, 0], head: [-30, 0, 20], lArm: [10, 0, -10], rArm: [10, 0, 10] }],
      [0.85, { pitch: -88, y: 0.12, head: [10, 30, 0], lArm: [60, 0, -40], rArm: [20, 0, 50], lThigh: [10, 0, -4], lShin: [-40, 0, 0], rThigh: [4, 0, 6], rShin: [-20, 0, 0], z: -0.45 }],
    ],
    { events: [{ t: 0.8, name: 'land' }] },
  ),
  work: makeClip(
    'work',
    [
      [0, { spine: [-30, 0, 0], chest: [-10, 0, 0], rArm: [40, 0, 0], rFore: [40, 0, 0], lArm: [40, 0, 0], lFore: [40, 0, 0], lThigh: [14, 0, 0], lShin: [-10, 0, 0] }],
      [0.7, { spine: [-6, 0, 0], chest: [4, 0, 0], rArm: [160, 0, -4], rFore: [30, 0, 0], lArm: [150, 0, 4], lFore: [30, 0, 0], lThigh: [14, 0, 0], lShin: [-10, 0, 0] }],
      [0.95, { spine: [-36, 0, 0], chest: [-14, 0, 0], rArm: [30, 0, 0], rFore: [20, 0, 0], lArm: [30, 0, 0], lFore: [20, 0, 0], lThigh: [16, 0, 0], lShin: [-12, 0, 0] }],
      [1.8, { spine: [-30, 0, 0], chest: [-10, 0, 0], rArm: [40, 0, 0], rFore: [40, 0, 0], lArm: [40, 0, 0], lFore: [40, 0, 0], lThigh: [14, 0, 0], lShin: [-10, 0, 0] }],
    ],
    { loop: true, base: GB, events: [{ t: 0.95, name: 'thud' }] },
  ),
  bash: makeClip(
    'bash',
    [
      [0, { lArm: [60, 0, -10], rArm: [60, 0, 10], lFore: [60, 0, 0], rFore: [60, 0, 0], chest: [4, 0, 0], z: 0.1 }],
      [0.35, { lArm: [95, 0, 0], rArm: [95, 0, 0], lFore: [5, 0, 0], rFore: [5, 0, 0], chest: [-20, 0, 0], lThigh: [30, 0, 0], lShin: [-20, 0, 0], z: -0.15 }],
      [0.9, { lArm: [60, 0, -10], rArm: [60, 0, 10], lFore: [60, 0, 0], rFore: [60, 0, 0], chest: [4, 0, 0], z: 0.1 }],
    ],
    { loop: true, base: GB, events: [{ t: 0.33, name: 'bash' }] },
  ),
  climb: makeClip(
    'climb',
    [
      [0, { lArm: [170, 0, -8], lFore: [20, 0, 0], rArm: [120, 0, 8], rFore: [60, 0, 0], lThigh: [70, 0, 0], lShin: [-100, 0, 0], rThigh: [30, 0, 0], rShin: [-40, 0, 0], spine: [4, 0, 0], chest: [4, 0, 0] }],
      [0.4, { rArm: [170, 0, 8], rFore: [20, 0, 0], lArm: [120, 0, -8], lFore: [60, 0, 0], rThigh: [70, 0, 0], rShin: [-100, 0, 0], lThigh: [30, 0, 0], lShin: [-40, 0, 0], spine: [4, 0, 0], chest: [4, 0, 0] }],
      [0.8, { lArm: [170, 0, -8], lFore: [20, 0, 0], rArm: [120, 0, 8], rFore: [60, 0, 0], lThigh: [70, 0, 0], lShin: [-100, 0, 0], rThigh: [30, 0, 0], rShin: [-40, 0, 0], spine: [4, 0, 0], chest: [4, 0, 0] }],
    ],
    { loop: true },
  ),
  vault: makeClip(
    'vault',
    [
      [0, {}],
      [0.2, { y: -0.2, lThigh: [50, 0, 0], lShin: [-70, 0, 0], rThigh: [40, 0, 0], rShin: [-70, 0, 0], spine: [-30, 0, 0], lArm: [60, 0, 0], rArm: [60, 0, 0] }],
      [0.5, { y: 0.4, lThigh: [80, 0, 0], lShin: [-110, 0, 0], rThigh: [70, 0, 0], rShin: [-110, 0, 0], spine: [-35, 0, 0], lArm: [100, 0, -20], rArm: [100, 0, 20] }],
      [0.8, { y: -0.25, lThigh: [50, 0, 0], lShin: [-80, 0, 0], rThigh: [40, 0, 0], rShin: [-80, 0, 0], spine: [-20, 0, 0], lArm: [30, 0, -20], rArm: [30, 0, 20] }],
      [1.0, {}],
    ],
    { base: GB },
  ),
  stunned: makeClip(
    'stunned',
    [
      [0, { lArm: [100, 0, 20], rArm: [100, 0, -20], lFore: [110, 0, 0], rFore: [110, 0, 0], head: [-20, 0, 0], spine: [-20, 0, 0], y: -0.05 }],
      [0.8, { lArm: [104, 0, 16], rArm: [98, 0, -22], lFore: [116, 0, 0], rFore: [106, 0, 0], head: [-24, 10, 6], spine: [-22, 6, 0], y: -0.05 }],
      [1.6, { lArm: [100, 0, 20], rArm: [100, 0, -20], lFore: [110, 0, 0], rFore: [110, 0, 0], head: [-20, 0, 0], spine: [-20, 0, 0], y: -0.05 }],
    ],
    { loop: true, base: GB },
  ),
  suplexed: makeClip(
    'suplexed',
    [
      [0, { y: -0.47, lThigh: [88, 0, 0], lShin: [-92, 0, 0], rThigh: [-4, 0, 0], rShin: [-88, 0, 0], spine: [-24, 0, 0] }],
      [0.4, { y: 0.05, pitch: 10, lArm: [60, 0, -40], rArm: [60, 0, 40] }],
      [0.75, { y: 0.9, pitch: 100, lArm: [100, 0, -60], rArm: [100, 0, 60], lThigh: [20, 0, 0], rThigh: [30, 0, 0] }],
      [0.95, { y: 0.25, pitch: 160, lArm: [150, 0, -50], rArm: [150, 0, 50], head: [30, 0, 0] }],
      [1.3, { y: 0.13, pitch: 92, z: 0.3, head: [-8, 20, 0], lArm: [30, 0, -70], rArm: [20, 0, 76], lThigh: [14, 0, -8], lShin: [-20, 0, 0], rThigh: [4, 0, 8] }],
    ],
    { events: [{ t: 0.95, name: 'land' }] },
  ),
  stealthDie: makeClip(
    'stealthDie',
    [
      [0, {}],
      [0.3, { head: [30, 0, 0], neck: [20, 0, 0], chest: [14, 0, 0], lArm: [60, 0, -20], rArm: [60, 0, 20], lFore: [90, 0, 0], rFore: [90, 0, 0] }],
      [0.9, { y: -0.4, lThigh: [70, 0, 0], lShin: [-90, 0, 0], rThigh: [50, 0, 0], rShin: [-90, 0, 0], spine: [-10, 0, 0], head: [20, 0, 0], lArm: [20, 0, -10], rArm: [20, 0, 10] }],
      [1.4, { pitch: -88, y: 0.12, head: [10, 30, 0], lArm: [60, 0, -40], rArm: [20, 0, 50], z: -0.4 }],
    ],
    { events: [{ t: 1.35, name: 'land' }] },
  ),
};

// ---------------------------------------------------------------- Salvador (chainsaw)
const SB: PoseSpec = {
  ...GB,
  spine: [-6, 0, 0],
  chest: [-4, 0, 0],
  rArm: [40, 0, 14],
  rFore: [55, 0, 0],
  lArm: [48, 0, -4],
  lFore: [62, 0, 0],
};
export const S = {
  idle: makeClip(
    'idle',
    [
      [0, {}],
      [1, { chest: [-8, 4, 0], head: [6, 8, 8], y: -0.01 }],
      [2, {}],
    ],
    { loop: true, base: SB },
  ),
  walk: cycle('walk', 1.35, { ...walkA, lArm: SB.lArm!, rArm: SB.rArm! }, { ...walkP, lArm: SB.lArm!, rArm: SB.rArm! }, SB, [
    { t: 0, name: 'step' },
    { t: 0.675, name: 'step' },
  ]),
  run: cycle('run', 0.7, { ...runA, lArm: [50, 0, -4], rArm: [44, 0, 14], lFore: [62, 0, 0], rFore: [55, 0, 0] }, { ...runP, lArm: [50, 0, -4], rArm: [44, 0, 14], lFore: [62, 0, 0], rFore: [55, 0, 0] }, SB, [
    { t: 0, name: 'step' },
    { t: 0.35, name: 'step' },
  ]),
  swing: makeClip(
    'swing',
    [
      [0, {}],
      [0.55, { chest: [4, -55, 0], spine: [0, -25, 0], rArm: [70, 0, 50], rFore: [40, 0, 0], lArm: [80, 0, 20], lFore: [50, 0, 0], lThigh: [10, 0, 0], y: -0.06 }],
      [0.8, { chest: [-8, 55, 0], spine: [-6, 25, 0], rArm: [80, 0, -10], rFore: [20, 0, 0], lArm: [85, 0, -40], lFore: [20, 0, 0], lThigh: [30, 0, 0], lShin: [-20, 0, 0], rThigh: [-14, 0, 0], y: -0.08 }],
      [1.25, { chest: [-4, 30, 0], spine: [-4, 10, 0] }],
      [1.6, {}],
    ],
    { base: SB, events: [{ t: 0.25, name: 'windup' }, { t: 0.72, name: 'hit' }] },
  ),
  grab: makeClip(
    'grab',
    [
      [0, {}],
      [0.5, { chest: [10, 0, 0], rArm: [150, 0, 10], rFore: [40, 0, 0], lArm: [150, 0, -10], lFore: [40, 0, 0], head: [10, 0, 0], y: 0.02 }],
      [0.75, { chest: [-26, 0, 0], spine: [-14, 0, 0], rArm: [85, 0, -5], rFore: [10, 0, 0], lArm: [85, 0, 5], lFore: [14, 0, 0], lThigh: [34, 0, 0], lShin: [-16, 0, 0], rThigh: [-18, 0, 0] }],
      [1.4, { chest: [-10, 0, 0] }],
    ],
    { base: SB, events: [{ t: 0.2, name: 'windup' }, { t: 0.72, name: 'grab' }] },
  ),
  decap: makeClip(
    'decap',
    [
      [0, { rArm: [95, 0, -5], rFore: [30, 0, 0], lArm: [95, 0, 5], lFore: [30, 0, 0], chest: [-10, 0, 0] }],
      [0.6, { rArm: [110, 0, -10], rFore: [50, 0, 0], lArm: [110, 0, 10], lFore: [50, 0, 0], chest: [-4, 8, 0] }],
      [1.2, { rArm: [100, 0, -5], rFore: [40, 0, 0], lArm: [100, 0, 5], lFore: [40, 0, 0], chest: [-8, -8, 0] }],
      [2.0, { rArm: [60, 0, 10], rFore: [60, 0, 0], lArm: [60, 0, -4], lFore: [60, 0, 0], chest: [8, 0, 0], head: [20, 0, 0] }],
    ],
    { base: SB },
  ),
  roar: makeClip(
    'roar',
    [
      [0, {}],
      [0.35, { chest: [18, 0, 0], neck: [14, 0, 0], head: [22, 0, 0], rArm: [150, 0, 20], rFore: [30, 0, 0], lArm: [40, 0, -40], y: 0.02 }],
      [1.3, { chest: [16, 0, 0], neck: [10, 0, 0], head: [18, 6, 0], rArm: [155, 0, 22], rFore: [26, 0, 0], lArm: [44, 0, -40] }],
      [1.7, {}],
    ],
    { base: SB, events: [{ t: 0.3, name: 'roar' }] },
  ),
};

// ---------------------------------------------------------------- Leon
const LB: PoseSpec = {
  lArm: [2, 0, -5],
  rArm: [2, 0, 5],
  lFore: [12, 0, 0],
  rFore: [12, 0, 0],
};
const lwA: PoseSpec = {
  lThigh: [30, 0, 0], lShin: [-8, 0, 0], lFoot: [12, 0, 0],
  rThigh: [-24, 0, 0], rShin: [-26, 0, 0], rFoot: [-14, 0, 0],
  lArm: [-18, 0, -6], rArm: [22, 0, 6], lFore: [26, 0, 0], rFore: [28, 0, 0],
  hips: [0, 7, 0], chest: [-2, -7, 0], spine: [-4, 0, 0], y: -0.025,
};
const lwP: PoseSpec = {
  lThigh: [-2, 0, 0], lShin: [-6, 0, 0], lFoot: [0, 0, 0],
  rThigh: [30, 0, 0], rShin: [-66, 0, 0], rFoot: [0, 0, 0],
  lArm: [2, 0, -6], rArm: [2, 0, 6], lFore: [20, 0, 0], rFore: [20, 0, 0],
  hips: [0, 0, 0], chest: [-2, 0, 0], spine: [-4, 0, 0], y: 0.02,
};
const lrA: PoseSpec = {
  lThigh: [52, 0, 0], lShin: [-14, 0, 0], lFoot: [14, 0, 0],
  rThigh: [-36, 0, 0], rShin: [-72, 0, 0], rFoot: [-22, 0, 0],
  lArm: [-42, 0, -10], rArm: [48, 0, 10], lFore: [80, 0, 0], rFore: [80, 0, 0],
  spine: [-12, 0, 0], chest: [-6, -9, 0], hips: [0, 9, 0], y: -0.03,
};
const lrP: PoseSpec = {
  lThigh: [6, 0, 0], lShin: [-12, 0, 0], lFoot: [0, 0, 0],
  rThigh: [48, 0, 0], rShin: [-104, 0, 0], rFoot: [0, 0, 0],
  lArm: [4, 0, -10], rArm: [4, 0, 10], lFore: [80, 0, 0], rFore: [80, 0, 0],
  spine: [-12, 0, 0], chest: [-6, 0, 0], hips: [0, 0, 0], y: 0.06,
};
const CROUCH: PoseSpec = {
  y: -0.34,
  lThigh: [70, 0, -4], lShin: [-100, 0, 0], lFoot: [30, 0, 0],
  rThigh: [40, 0, 4], rShin: [-90, 0, 0], rFoot: [50, 0, 0],
  spine: [-20, 0, 0], chest: [-6, 0, 0], head: [16, 0, 0],
};
export const L = {
  idle: makeClip(
    'idle',
    [
      [0, {}],
      [1.5, { chest: [-2, 0, 0], head: [2, 4, 0], y: -0.006 }],
      [3, {}],
    ],
    { loop: true, base: LB },
  ),
  walk: cycle('walk', 0.9, lwA, lwP, LB, [{ t: 0, name: 'step' }, { t: 0.45, name: 'step' }]),
  run: cycle('run', 0.62, lrA, lrP, LB, [{ t: 0, name: 'step' }, { t: 0.31, name: 'step' }]),
  crouchIdle: makeClip('crouchIdle', [[0, {}], [1, {}]], { loop: true, base: { ...LB, ...CROUCH } }),
  crouchWalk: makeClip(
    'crouchWalk',
    [
      [0, { lThigh: [80, 0, -4], lShin: [-96, 0, 0], rThigh: [30, 0, 4], rShin: [-100, 0, 0] }],
      [0.5, { lThigh: [30, 0, -4], lShin: [-100, 0, 0], rThigh: [80, 0, 4], rShin: [-96, 0, 0], y: -0.32 }],
      [1.0, { lThigh: [80, 0, -4], lShin: [-96, 0, 0], rThigh: [30, 0, 4], rShin: [-100, 0, 0] }],
    ],
    { loop: true, base: { ...LB, ...CROUCH }, events: [{ t: 0, name: 'step' }, { t: 0.5, name: 'step' }] },
  ),
  // upper body layers
  aimPistol: makeClip(
    'aimPistol',
    [
      [0, { rArm: [95, 0, -8], rFore: [4, 0, 0], rHand: [0, 0, 0], lArm: [90, 0, 30], lFore: [24, 0, 0], lHand: [0, 0, 0], chest: [0, 0, 0], head: [0, -4, 0] }],
      [1, { rArm: [95, 0, -8], rFore: [4, 0, 0], rHand: [0, 0, 0], lArm: [90, 0, 30], lFore: [24, 0, 0], lHand: [0, 0, 0], chest: [0, 0, 0], head: [0, -4, 0] }],
    ],
    { loop: true },
  ),
  aimLong: makeClip(
    'aimLong',
    [
      [0, { rArm: [62, 0, 38], rFore: [72, 0, 0], lArm: [78, 0, 22], lFore: [14, 0, 0], chest: [0, 8, 0], head: [-4, 0, -10] }],
      [1, { rArm: [62, 0, 38], rFore: [72, 0, 0], lArm: [78, 0, 22], lFore: [14, 0, 0], chest: [0, 8, 0], head: [-4, 0, -10] }],
    ],
    { loop: true },
  ),
  holdPistol: makeClip(
    'holdPistol',
    [
      [0, { rArm: [20, 0, 6], rFore: [36, 0, 0], lArm: [22, 0, 6], lFore: [40, 0, 0] }],
      [1, { rArm: [20, 0, 6], rFore: [36, 0, 0], lArm: [22, 0, 6], lFore: [40, 0, 0] }],
    ],
    { loop: true },
  ),
  holdLong: makeClip(
    'holdLong',
    [
      [0, { rArm: [18, 0, 14], rFore: [50, 0, 0], lArm: [40, 0, 18], lFore: [50, 0, 0] }],
      [1, { rArm: [18, 0, 14], rFore: [50, 0, 0], lArm: [40, 0, 18], lFore: [50, 0, 0] }],
    ],
    { loop: true },
  ),
  reloadPistol: makeClip(
    'reloadPistol',
    [
      [0, { rArm: [40, 0, 0], rFore: [70, 0, 0], lArm: [40, 0, 20], lFore: [70, 0, 0] }],
      [0.35, { rArm: [40, 0, 0], rFore: [74, 0, 0], lArm: [0, 0, -14], lFore: [20, 0, 0], head: [-18, 0, 0] }],
      [0.8, { rArm: [40, 0, 0], rFore: [74, 0, 0], lArm: [44, 0, 18], lFore: [84, 0, 0], head: [-20, 0, 0] }],
      [1.15, { rArm: [44, 0, 0], rFore: [80, 0, 0], lArm: [52, 0, 22], lFore: [100, 0, 0], head: [-14, 0, 0] }],
      [1.4, { rArm: [40, 0, 0], rFore: [70, 0, 0], lArm: [40, 0, 20], lFore: [70, 0, 0] }],
    ],
    { events: [{ t: 0.3, name: 'magout' }, { t: 0.85, name: 'magin' }, { t: 1.15, name: 'slide' }] },
  ),
  reloadShell: makeClip(
    'reloadShell',
    [
      [0, { rArm: [30, 0, 14], rFore: [60, 0, 0], lArm: [10, 0, -10], lFore: [30, 0, 0], head: [-16, 0, 0] }],
      [0.25, { rArm: [30, 0, 14], rFore: [60, 0, 0], lArm: [44, 0, 20], lFore: [80, 0, 0], head: [-18, 0, 0] }],
      [0.5, { rArm: [30, 0, 14], rFore: [60, 0, 0], lArm: [10, 0, -10], lFore: [30, 0, 0], head: [-16, 0, 0] }],
    ],
    { loop: true, events: [{ t: 0.24, name: 'shell' }] },
  ),
  reloadRifle: makeClip(
    'reloadRifle',
    [
      [0, { rArm: [30, 0, 14], rFore: [70, 0, 0], lArm: [40, 0, 20], lFore: [60, 0, 0] }],
      [0.4, { rArm: [30, 0, 14], rFore: [70, 0, 0], lArm: [0, 0, -12], lFore: [30, 0, 0], head: [-16, 0, 0] }],
      [1.1, { rArm: [30, 0, 14], rFore: [70, 0, 0], lArm: [50, 0, 22], lFore: [80, 0, 0], head: [-20, 0, 0] }],
      [1.6, { rArm: [30, 0, 14], rFore: [70, 0, 0], lArm: [50, 0, 26], lFore: [90, 0, 0], head: [-18, 0, 0] }],
      [2.1, { rArm: [30, 0, 14], rFore: [70, 0, 0], lArm: [40, 0, 20], lFore: [60, 0, 0] }],
    ],
    { events: [{ t: 0.4, name: 'magout' }, { t: 1.2, name: 'magin' }, { t: 1.7, name: 'slide' }] },
  ),
  knifeSlash: makeClip(
    'knifeSlash',
    [
      [0, { rArm: [60, 0, 60], rFore: [50, 0, 0], chest: [0, -24, 0], spine: [0, -10, 0], lArm: [40, 0, -20], lFore: [60, 0, 0] }],
      [0.09, { rArm: [70, 0, 78], rFore: [30, 0, 0], chest: [0, -30, 0], spine: [0, -12, 0], lArm: [40, 0, -20], lFore: [60, 0, 0] }],
      [0.2, { rArm: [86, 0, -36], rFore: [8, 0, 0], chest: [-6, 32, 0], spine: [-4, 12, 0], lArm: [20, 0, -30], lFore: [40, 0, 0] }],
      [0.42, { rArm: [60, 0, -10], rFore: [60, 0, 0], chest: [-4, 10, 0], lArm: [40, 0, 20], lFore: [80, 0, 0] }],
    ],
    { events: [{ t: 0.14, name: 'hit' }] },
  ),
  knifeGuard: makeClip(
    'knifeGuard',
    [
      [0, { rArm: [62, 0, -12], rFore: [80, 0, 0], lArm: [58, 0, 26], lFore: [92, 0, 0], chest: [-6, 0, 0], head: [4, 0, 0] }],
      [1, { rArm: [62, 0, -12], rFore: [80, 0, 0], lArm: [58, 0, 26], lFore: [92, 0, 0], chest: [-6, 0, 0], head: [4, 0, 0] }],
    ],
    { loop: true },
  ),
  parry: makeClip(
    'parry',
    [
      [0, { rArm: [62, 0, -12], rFore: [80, 0, 0], lArm: [58, 0, 26], lFore: [92, 0, 0], chest: [-6, 0, 0] }],
      [0.12, { rArm: [110, 0, 40], rFore: [30, 0, 0], lArm: [40, 0, 10], lFore: [60, 0, 0], chest: [10, -20, 0], z: 0.08 }],
      [0.5, { rArm: [62, 0, -12], rFore: [80, 0, 0], lArm: [58, 0, 26], lFore: [92, 0, 0], chest: [-6, 0, 0] }],
    ],
    {},
  ),
  knifeStab: makeClip(
    'knifeStab',
    [
      [0, {}],
      [0.25, { ...CROUCH, y: -0.5, spine: [-40, 0, 0], rArm: [150, 0, 0], rFore: [40, 0, 0], lArm: [40, 0, -10] }],
      [0.42, { ...CROUCH, y: -0.52, spine: [-48, 0, 0], rArm: [55, 0, 0], rFore: [10, 0, 0], lArm: [40, 0, -10] }],
      [0.85, {}],
    ],
    { base: LB, events: [{ t: 0.4, name: 'hit' }] },
  ),
  stealthKill: makeClip(
    'stealthKill',
    [
      [0, {}],
      [0.25, { lArm: [100, 0, 30], lFore: [60, 0, 0], rArm: [60, 0, -10], rFore: [90, 0, 0], chest: [-10, 0, 0] }],
      [0.45, { lArm: [100, 0, 34], lFore: [64, 0, 0], rArm: [90, 0, -30], rFore: [30, 0, 0], chest: [-14, 10, 0] }],
      [1.1, { lArm: [70, 0, 20], lFore: [60, 0, 0], rArm: [40, 0, 0], rFore: [60, 0, 0], chest: [-6, 0, 0] }],
      [1.4, {}],
    ],
    { base: LB, events: [{ t: 0.45, name: 'hit' }] },
  ),
  kick: makeClip(
    'kick',
    [
      [0, { yaw: 0 }],
      [0.14, { yaw: 40, y: -0.06, lThigh: [20, 0, 0], lShin: [-30, 0, 0], rThigh: [10, 0, 0], rShin: [-40, 0, 0], lArm: [30, 0, -40], rArm: [30, 0, 40], chest: [0, 20, 0] }],
      [0.3, { yaw: 210, y: 0.02, rThigh: [85, 0, 30], rShin: [-6, 0, 0], rFoot: [30, 0, 0], lThigh: [-10, 0, 0], lShin: [-8, 0, 0], spine: [16, 0, 0], chest: [10, 0, 0], lArm: [40, 0, -70], rArm: [20, 0, 60], head: [-10, 0, 0] }],
      [0.46, { yaw: 330, y: -0.02, rThigh: [40, 0, 10], rShin: [-40, 0, 0], lArm: [20, 0, -30], rArm: [20, 0, 30] }],
      [0.7, { yaw: 360 }],
    ],
    { base: LB, events: [{ t: 0.28, name: 'hit' }] },
  ),
  suplex: makeClip(
    'suplex',
    [
      [0, {}],
      [0.4, { lArm: [90, 0, 30], rArm: [90, 0, -30], lFore: [40, 0, 0], rFore: [40, 0, 0], chest: [-20, 0, 0], y: -0.2, lThigh: [40, 0, 0], lShin: [-60, 0, 0], rThigh: [30, 0, 0], rShin: [-60, 0, 0] }],
      [0.75, { lArm: [160, 0, 20], rArm: [160, 0, -20], lFore: [20, 0, 0], rFore: [20, 0, 0], chest: [20, 0, 0], spine: [20, 0, 0], pitch: 30, y: 0.05 }],
      [0.95, { lArm: [180, 0, 20], rArm: [180, 0, -20], chest: [30, 0, 0], spine: [30, 0, 0], neck: [20, 0, 0], pitch: 55, y: 0.3, lThigh: [20, 0, 0], lShin: [-70, 0, 0], rThigh: [20, 0, 0], rShin: [-70, 0, 0] }],
      [1.3, { pitch: 20, y: -0.3, spine: [-30, 0, 0], lThigh: [80, 0, 0], lShin: [-110, 0, 0], rThigh: [60, 0, 0], rShin: [-110, 0, 0], lArm: [40, 0, -20], rArm: [40, 0, 20] }],
      [1.7, {}],
    ],
    { base: LB, events: [{ t: 0.95, name: 'hit' }] },
  ),
  hurt: makeClip(
    'hurt',
    [
      [0, {}],
      [0.1, { chest: [22, 0, 0], spine: [10, 0, 0], head: [20, 0, 0], lArm: [-10, 0, -30], rArm: [-10, 0, 30], z: 0.12 }],
      [0.55, { z: 0.2 }],
    ],
    { base: LB },
  ),
  grabbed: makeClip(
    'grabbed',
    [
      [0, { lArm: [80, 0, 20], rArm: [80, 0, -20], lFore: [70, 0, 0], rFore: [70, 0, 0], chest: [12, 0, 0], head: [16, 0, 0], lThigh: [-10, 0, 0], rThigh: [8, 0, 0] }],
      [0.2, { lArm: [90, 0, 16], rArm: [76, 0, -24], lFore: [60, 0, 0], rFore: [76, 0, 0], chest: [14, 8, 0], head: [20, 6, 0], lThigh: [-12, 0, 0], rThigh: [10, 0, 0] }],
      [0.4, { lArm: [80, 0, 20], rArm: [80, 0, -20], lFore: [70, 0, 0], rFore: [70, 0, 0], chest: [12, 0, 0], head: [16, 0, 0], lThigh: [-10, 0, 0], rThigh: [8, 0, 0] }],
    ],
    { loop: true, base: LB },
  ),
  throwNade: makeClip(
    'throwNade',
    [
      [0, {}],
      [0.3, { rArm: [200, 0, 20], rFore: [60, 0, 0], chest: [10, -25, 0], lArm: [70, 0, -10] }],
      [0.45, { rArm: [70, 0, -6], rFore: [5, 0, 0], chest: [-12, 18, 0], lArm: [0, 0, -12] }],
      [0.8, {}],
    ],
    { base: LB, events: [{ t: 0.42, name: 'release' }] },
  ),
  pickup: makeClip(
    'pickup',
    [
      [0, {}],
      [0.25, { ...CROUCH, y: -0.4, rArm: [70, 0, 0], rFore: [10, 0, 0] }],
      [0.6, {}],
    ],
    { base: LB },
  ),
  push: makeClip(
    'push',
    [
      [0, { lArm: [85, 0, 10], rArm: [85, 0, -10], lFore: [20, 0, 0], rFore: [20, 0, 0], chest: [-16, 0, 0], spine: [-10, 0, 0], lThigh: [30, 0, 0], lShin: [-20, 0, 0], rThigh: [-20, 0, 0] }],
      [0.5, { lArm: [90, 0, 10], rArm: [90, 0, -10], lFore: [10, 0, 0], rFore: [10, 0, 0], chest: [-22, 0, 0], spine: [-12, 0, 0], lThigh: [-10, 0, 0], lShin: [-20, 0, 0], rThigh: [30, 0, 0], rShin: [-20, 0, 0] }],
      [1.0, { lArm: [85, 0, 10], rArm: [85, 0, -10], lFore: [20, 0, 0], rFore: [20, 0, 0], chest: [-16, 0, 0], spine: [-10, 0, 0], lThigh: [30, 0, 0], lShin: [-20, 0, 0], rThigh: [-20, 0, 0] }],
    ],
    { loop: true, base: LB, events: [{ t: 0, name: 'step' }, { t: 0.5, name: 'step' }] },
  ),
  crank: makeClip(
    'crank',
    [
      [0, { rArm: [60, 0, -10], rFore: [60, 0, 0], lArm: [60, 0, 10], lFore: [60, 0, 0], spine: [-14, 0, 0], lThigh: [20, 0, 0], lShin: [-20, 0, 0] }],
      [0.4, { rArm: [95, 0, -10], rFore: [30, 0, 0], lArm: [95, 0, 10], lFore: [30, 0, 0], spine: [-6, 0, 0], lThigh: [20, 0, 0], lShin: [-20, 0, 0] }],
      [0.8, { rArm: [60, 0, -10], rFore: [90, 0, 0], lArm: [60, 0, 10], lFore: [90, 0, 0], spine: [-20, 0, 0], lThigh: [20, 0, 0], lShin: [-20, 0, 0] }],
      [1.2, { rArm: [60, 0, -10], rFore: [60, 0, 0], lArm: [60, 0, 10], lFore: [60, 0, 0], spine: [-14, 0, 0], lThigh: [20, 0, 0], lShin: [-20, 0, 0] }],
    ],
    { loop: true, base: LB, events: [{ t: 0.4, name: 'crank' }] },
  ),
  doorKick: makeClip(
    'doorKick',
    [
      [0, {}],
      [0.2, { rThigh: [80, 0, 0], rShin: [-90, 0, 0], lArm: [30, 0, -30], rArm: [20, 0, 30], chest: [6, 0, 0] }],
      [0.35, { rThigh: [85, 0, 0], rShin: [-4, 0, 0], rFoot: [20, 0, 0], chest: [10, 0, 0], spine: [10, 0, 0], lArm: [30, 0, -40] }],
      [0.7, {}],
    ],
    { base: LB, events: [{ t: 0.33, name: 'hit' }] },
  ),
  climb: G.climb,
  vault: makeClip(
    'vault',
    [
      [0, {}],
      [0.2, { y: -0.2, lThigh: [50, 0, 0], lShin: [-70, 0, 0], rThigh: [40, 0, 0], rShin: [-70, 0, 0], spine: [-30, 0, 0], lArm: [60, 0, 0], rArm: [60, 0, 0] }],
      [0.5, { y: 0.45, lThigh: [80, 0, 0], lShin: [-110, 0, 0], rThigh: [70, 0, 0], rShin: [-110, 0, 0], spine: [-35, 0, 0], lArm: [100, 0, -20], rArm: [100, 0, 20] }],
      [0.8, { y: -0.3, lThigh: [60, 0, 0], lShin: [-90, 0, 0], rThigh: [50, 0, 0], rShin: [-90, 0, 0], spine: [-20, 0, 0], lArm: [30, 0, -20], rArm: [30, 0, 20] }],
      [1.0, {}],
    ],
    { base: LB },
  ),
  fallBack: G.fallBack,
  lieBack: G.lieBack,
  getUpBack: makeClip(
    'getUpBack',
    [
      [0, { pitch: 90, y: 0.13, head: [-8, 20, 0], lArm: [30, 0, -70], rArm: [20, 0, 76], lThigh: [14, 0, -8], lShin: [-20, 0, 0], rThigh: [4, 0, 8], z: 0.35 }],
      [0.4, { pitch: 50, y: 0.05, spine: [-50, 0, 0], chest: [-20, 0, 0], lArm: [-20, 0, -20], rArm: [-20, 0, 20], lThigh: [90, 0, 0], lShin: [-110, 0, 0], rThigh: [60, 0, 0], rShin: [-40, 0, 0], z: 0.2 }],
      [0.8, { pitch: 8, y: -0.38, spine: [-40, 0, 0], chest: [-14, 0, 0], lArm: [40, 0, -10], rArm: [40, 0, 10], lThigh: [100, 0, 0], lShin: [-120, 0, 0], rThigh: [70, 0, 0], rShin: [-100, 0, 0], z: 0.05 }],
      [1.15, {}],
    ],
    { base: LB },
  ),
  dieFront: G.dieCollapse,
  decapDeath: makeClip(
    'decapDeath',
    [
      [0, { lArm: [80, 0, 20], rArm: [80, 0, -20], lFore: [70, 0, 0], rFore: [70, 0, 0], chest: [12, 0, 0] }],
      [1.2, { lArm: [60, 0, 30], rArm: [60, 0, -30], lFore: [80, 0, 0], rFore: [80, 0, 0], chest: [16, 0, 0], y: -0.05 }],
      [1.7, { y: -0.4, lThigh: [70, 0, 0], lShin: [-90, 0, 0], rThigh: [50, 0, 0], rShin: [-90, 0, 0], lArm: [10, 0, -10], rArm: [10, 0, 10] }],
      [2.3, { pitch: 88, y: 0.13, lArm: [30, 0, -70], rArm: [20, 0, 76], z: 0.35 }],
    ],
    { events: [{ t: 1.2, name: 'decap' }] },
  ),
};

export type ClipSet = Record<string, Clip>;
