
import { BONE_COUNT, BONE_NAMES, MIRROR, type Rig, type BoneName } from './rig';
import { DEG, wrapAngle } from '../core/math';

/**
 * Pose layout: BONE_COUNT * 3 euler angles (radians) followed by ROOT channels.
 * Root channels drive the rig.body object: vertical drop, pitch, roll, yaw, forward offset.
 */
export const R_Y = BONE_COUNT * 3;
export const R_PITCH = R_Y + 1;
export const R_ROLL = R_Y + 2;
export const R_YAW = R_Y + 3;
export const R_Z = R_Y + 4;
export const R_X = R_Y + 5;
export const POSE_SIZE = R_Y + 6;

export type Pose = Float32Array;
type Vec3Deg = [number, number, number];
export type PoseSpec = Partial<Record<BoneName, Vec3Deg>> & {
  y?: number; // meters
  pitch?: number; // degrees
  roll?: number;
  yaw?: number;
  z?: number; // meters (local forward = -z)
  x?: number;
};

export interface ClipEvent {
  t: number;
  name: string;
}

export interface Clip {
  name: string;
  duration: number;
  loop: boolean;
  times: number[];
  poses: Pose[];
  events: ClipEvent[];
  /** bones that this clip animates (for upper-body masks) */
  ease: 'smooth' | 'linear';
}

export function poseFromSpec(spec: PoseSpec, base?: Pose): Pose {
  const p = base ? new Float32Array(base) : new Float32Array(POSE_SIZE);
  for (let i = 0; i < BONE_COUNT; i++) {
    const v = spec[BONE_NAMES[i]];
    if (v) {
      p[i * 3] = v[0] * DEG;
      p[i * 3 + 1] = v[1] * DEG;
      p[i * 3 + 2] = v[2] * DEG;
    }
  }
  if (spec.y !== undefined) p[R_Y] = spec.y;
  if (spec.pitch !== undefined) p[R_PITCH] = spec.pitch * DEG;
  if (spec.roll !== undefined) p[R_ROLL] = spec.roll * DEG;
  if (spec.yaw !== undefined) p[R_YAW] = spec.yaw * DEG;
  if (spec.z !== undefined) p[R_Z] = spec.z;
  if (spec.x !== undefined) p[R_X] = spec.x;
  return p;
}

/** Mirror a spec left<->right. */
export function mirrorSpec(spec: PoseSpec): PoseSpec {
  const out: PoseSpec = {};
  for (let i = 0; i < BONE_COUNT; i++) {
    const v = spec[BONE_NAMES[i]];
    if (v) out[BONE_NAMES[MIRROR[i]]] = [v[0], -v[1], -v[2]];
  }
  if (spec.y !== undefined) out.y = spec.y;
  if (spec.pitch !== undefined) out.pitch = spec.pitch;
  if (spec.roll !== undefined) out.roll = -spec.roll;
  if (spec.yaw !== undefined) out.yaw = -spec.yaw;
  if (spec.z !== undefined) out.z = spec.z;
  if (spec.x !== undefined) out.x = -spec.x;
  return out;
}

export function makeClip(
  name: string,
  keys: [number, PoseSpec][],
  opts: { loop?: boolean; events?: ClipEvent[]; ease?: 'smooth' | 'linear'; base?: PoseSpec } = {},
): Clip {
  const base = opts.base ? poseFromSpec(opts.base) : undefined;
  const times = keys.map((k) => k[0]);
  const poses = keys.map((k) => poseFromSpec(k[1], base));
  return {
    name,
    duration: times[times.length - 1],
    loop: !!opts.loop,
    times,
    poses,
    events: opts.events ?? [],
    ease: opts.ease ?? 'smooth',
  };
}

export function sampleClip(clip: Clip, t: number, out: Pose): Pose {
  const { times, poses } = clip;
  if (clip.loop && clip.duration > 0) {
    t = t % clip.duration;
    if (t < 0) t += clip.duration;
  } else {
    t = Math.min(Math.max(t, 0), clip.duration);
  }
  if (poses.length === 1 || t <= times[0]) {
    out.set(poses[0]);
    return out;
  }
  let i = 0;
  while (i < times.length - 2 && t > times[i + 1]) i++;
  const t0 = times[i], t1 = times[i + 1];
  let f = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
  f = Math.min(Math.max(f, 0), 1);
  if (clip.ease === 'smooth') f = f * f * (3 - 2 * f);
  const a = poses[i], b = poses[i + 1];
  for (let k = 0; k < POSE_SIZE; k++) out[k] = a[k] + (b[k] - a[k]) * f;
  return out;
}

/** Blend b into a by w, using shortest arcs for angles (so spins don't unwind). */
export function blendPose(a: Pose, b: Pose, w: number, out: Pose, mask?: Uint8Array) {
  for (let k = 0; k < POSE_SIZE; k++) {
    if (mask && k < R_Y && !mask[(k / 3) | 0]) {
      out[k] = a[k];
      continue;
    }
    if (mask && k >= R_Y) {
      out[k] = a[k];
      continue;
    }
    const isLinear = k === R_Y || k === R_Z || k === R_X;
    const d = isLinear ? b[k] - a[k] : wrapAngle(b[k] - a[k]);
    out[k] = a[k] + d * w;
  }
}

interface Track {
  clip: Clip;
  time: number;
  speed: number;
}

export interface PlayOpts {
  fade?: number;
  speed?: number;
  restart?: boolean;
  time?: number;
}

const UPPER_MASK = new Uint8Array(BONE_COUNT);
for (const n of ['spine', 'chest', 'neck', 'head', 'lArm', 'lFore', 'lHand', 'rArm', 'rFore', 'rHand'] as BoneName[]) {
  UPPER_MASK[BONE_NAMES.indexOf(n)] = 1;
}
const ARMS_MASK = new Uint8Array(BONE_COUNT);
for (const n of ['lArm', 'lFore', 'lHand', 'rArm', 'rFore', 'rHand'] as BoneName[]) {
  ARMS_MASK[BONE_NAMES.indexOf(n)] = 1;
}

export class Animator {
  rig: Rig;
  cur: Track | null = null;
  prev: Track | null = null;
  fade = 0;
  fadeDur = 0;
  upper: Track | null = null;
  upperWeight = 0;
  upperTarget = 0;
  upperMaskArmsOnly = false;
  /** Additive per-bone offsets driven by springs (hit reactions, recoil). */
  private add = new Float32Array(BONE_COUNT * 3);
  private vel = new Float32Array(BONE_COUNT * 3);
  /** Extra static additive (procedural aim, look-at, leg yaw). Cleared each frame by owner. */
  extra = new Float32Array(POSE_SIZE);
  stiffness = 170;
  damping = 16;
  onEvent: ((name: string) => void) | null = null;
  private pA = new Float32Array(POSE_SIZE);
  private pB = new Float32Array(POSE_SIZE);
  private pU = new Float32Array(POSE_SIZE);
  readonly pose = new Float32Array(POSE_SIZE);
  finished = false;

  constructor(rig: Rig) {
    this.rig = rig;
  }

  get clipName(): string {
    return this.cur?.clip.name ?? '';
  }
  get time(): number {
    return this.cur?.time ?? 0;
  }
  get progress(): number {
    if (!this.cur) return 0;
    return this.cur.clip.duration > 0 ? this.cur.time / this.cur.clip.duration : 1;
  }

  play(clip: Clip, opts: PlayOpts = {}) {
    if (this.cur && this.cur.clip === clip && !opts.restart) {
      if (opts.speed !== undefined) this.cur.speed = opts.speed;
      return;
    }
    const fade = opts.fade ?? 0.18;
    if (this.cur && fade > 0) {
      this.prev = this.cur;
      this.fade = 0;
      this.fadeDur = fade;
    } else {
      this.prev = null;
      this.fade = 1;
      this.fadeDur = 0;
    }
    this.cur = { clip, time: opts.time ?? 0, speed: opts.speed ?? 1 };
    this.finished = false;
  }

  setSpeed(s: number) {
    if (this.cur) this.cur.speed = s;
  }

  playUpper(clip: Clip | null, opts: { restart?: boolean; speed?: number; armsOnly?: boolean } = {}) {
    if (!clip) {
      this.upperTarget = 0;
      return;
    }
    if (!this.upper || this.upper.clip !== clip || opts.restart) {
      this.upper = { clip, time: 0, speed: opts.speed ?? 1 };
    } else if (opts.speed !== undefined) this.upper.speed = opts.speed;
    this.upperMaskArmsOnly = !!opts.armsOnly;
    this.upperTarget = 1;
  }

  get upperClip(): string {
    return this.upperTarget > 0 && this.upper ? this.upper.clip.name : '';
  }
  get upperTime(): number {
    return this.upper?.time ?? 0;
  }
  get upperDone(): boolean {
    return !!this.upper && !this.upper.clip.loop && this.upper.time >= this.upper.clip.duration;
  }

  /** Spring impulse in radians/sec on a bone axis. */
  impulse(bone: number, x: number, y = 0, z = 0) {
    this.vel[bone * 3] += x;
    this.vel[bone * 3 + 1] += y;
    this.vel[bone * 3 + 2] += z;
  }

  update(dt: number) {
    // advance
    if (this.cur) {
      const c = this.cur;
      const before = c.time;
      c.time += dt * c.speed;
      if (!c.clip.loop && c.time >= c.clip.duration) {
        c.time = c.clip.duration;
        this.finished = true;
      }
      if (this.onEvent && c.clip.events.length) {
        const dur = c.clip.duration;
        for (const e of c.clip.events) {
          if (c.clip.loop && dur > 0) {
            const b = before % dur, a = c.time % dur;
            const crossed = a >= b ? e.t > b && e.t <= a : e.t > b || e.t <= a;
            if (crossed && c.time !== before) this.onEvent(e.name);
          } else if (e.t > before && e.t <= c.time) this.onEvent(e.name);
          else if (before === 0 && e.t === 0 && c.time > 0) this.onEvent(e.name);
        }
      }
    }
    if (this.prev) {
      this.prev.time += dt * this.prev.speed;
      this.fade += dt;
      if (this.fade >= this.fadeDur) this.prev = null;
    }
    if (this.upper) {
      this.upper.time += dt * this.upper.speed;
      if (!this.upper.clip.loop && this.upper.time > this.upper.clip.duration) this.upper.time = this.upper.clip.duration;
    }
    const uStep = dt * 8;
    this.upperWeight += Math.max(-uStep, Math.min(uStep, this.upperTarget - this.upperWeight));

    // evaluate
    const pose = this.pose;
    if (this.cur) sampleClip(this.cur.clip, this.cur.time, this.pA);
    else this.pA.fill(0);
    if (this.prev && this.fadeDur > 0) {
      sampleClip(this.prev.clip, this.prev.time, this.pB);
      const w = Math.min(1, this.fade / this.fadeDur);
      const ws = w * w * (3 - 2 * w);
      blendPose(this.pB, this.pA, ws, pose);
    } else pose.set(this.pA);
    if (this.upper && this.upperWeight > 0.001) {
      sampleClip(this.upper.clip, this.upper.time, this.pU);
      blendPose(pose, this.pU, this.upperWeight, this.pB, this.upperMaskArmsOnly ? ARMS_MASK : UPPER_MASK);
      pose.set(this.pB);
    }

    // springs
    const k = this.stiffness, d = this.damping;
    for (let i = 0; i < BONE_COUNT * 3; i++) {
      const a = -k * this.add[i] - d * this.vel[i];
      this.vel[i] += a * dt;
      this.add[i] += this.vel[i] * dt;
      pose[i] += this.add[i];
    }
    for (let i = 0; i < POSE_SIZE; i++) pose[i] += this.extra[i];

    this.apply();
  }

  private apply() {
    const { bones, body, bindPos } = this.rig;
    const p = this.pose;
    for (let i = 0; i < BONE_COUNT; i++) {
      bones[i].rotation.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    }
    bones[0].position.copy(bindPos[0]);
    body.position.set(p[R_X], p[R_Y], p[R_Z]);
    body.rotation.set(p[R_PITCH], p[R_YAW], p[R_ROLL], 'YXZ');
  }
}

export const tmpPose = () => new Float32Array(POSE_SIZE);
