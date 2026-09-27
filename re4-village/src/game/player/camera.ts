import * as THREE from 'three';
import { clamp, damp, DEG, lerp, valueNoise } from '../../core/math';
import type { CollisionWorld } from '../../world/collision';

/** Over-the-shoulder camera (right shoulder, RE4R style). */
export class OTSCamera {
  cam: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = -0.08;
  /** 0 = explore, 1 = aiming */
  aimT = 0;
  scope = 0; // rifle scope blend
  recoil = 0; // pitch kick (rad), recovers
  recoilYaw = 0;
  trauma = 0;
  private t = 0;
  private dist = 2.2;
  pivot = new THREE.Vector3();
  private desired = new THREE.Vector3();
  fovBase = 60;
  /** cinematic override */
  override: { pos: THREE.Vector3; look: THREE.Vector3; fov: number; blend: number } | null = null;
  crouch = 0;
  sens = 1;
  invertY = false;

  constructor(aspect: number) {
    this.cam = new THREE.PerspectiveCamera(60, aspect, 0.05, 260);
  }

  addLook(dx: number, dy: number) {
    const s = 0.0022 * this.sens * (this.aimT > 0.5 ? (this.scope > 0.5 ? 0.3 : 0.7) : 1);
    this.yaw -= dx * s;
    this.pitch -= dy * s * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.25, 1.05);
  }

  kick(pitchDeg: number, yawDeg = 0) {
    this.recoil += pitchDeg * DEG;
    this.recoilYaw += yawDeg * DEG;
  }

  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Forward direction including recoil. */
  forward(out: THREE.Vector3): THREE.Vector3 {
    const p = this.pitch + this.recoil;
    const y = this.yaw + this.recoilYaw;
    return out.set(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  }

  update(dt: number, target: THREE.Vector3, cw: CollisionWorld | null) {
    this.t += dt;
    // recoil recovery: most of the kick returns (like RE4R), some stays
    const rec = damp(9, dt);
    const applied = this.recoil * rec;
    this.recoil -= applied;
    this.pitch += applied * 0.25;
    const appliedY = this.recoilYaw * rec;
    this.recoilYaw -= appliedY;
    this.yaw += appliedY * 0.3;

    const aim = this.aimT;
    const pivotH = lerp(1.58, 1.12, this.crouch);
    this.pivot.set(target.x, target.y + pivotH, target.z);
    const side = lerp(0.55, 0.7, aim);
    const up = lerp(0.12, 0.1, aim);
    const back = lerp(2.3, 1.45, aim) * (1 - this.scope * 0.95);
    const fwd = this.forward(new THREE.Vector3());
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.desired
      .copy(this.pivot)
      .addScaledVector(right, side * (1 - this.scope))
      .addScaledVector(new THREE.Vector3(0, 1, 0), up)
      .addScaledVector(fwd, -back);
    // collision: sweep from pivot (slightly shifted right) to desired
    const from = this.pivot.clone().addScaledVector(right, 0.15 * (1 - this.scope));
    const dir = this.desired.clone().sub(from);
    let len = dir.length();
    dir.divideScalar(len || 1);
    if (cw && len > 0.01) {
      const hit = cw.raycast(from, dir, len + 0.25, 'cam');
      if (hit) len = Math.max(0.15, hit.t - 0.25);
    }
    // smooth only when pulling out (snap in to avoid clipping)
    if (len < this.dist) this.dist = len;
    else this.dist += (len - this.dist) * damp(6, dt);
    const pos = from.addScaledVector(dir, this.dist);

    // shake
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const sh = this.trauma * this.trauma;
    const sx = (valueNoise(this.t * 25, 1.3) - 0.5) * sh * 0.25;
    const sy = (valueNoise(this.t * 25, 7.7) - 0.5) * sh * 0.25;

    const look = pos.clone().add(fwd);
    this.cam.position.copy(pos);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(look);
    this.cam.rotateX(sy);
    this.cam.rotateY(sx);
    const fov = lerp(lerp(this.fovBase, this.fovBase - 15, aim), 14, this.scope);

    if (this.override) {
      const o = this.override;
      const b = o.blend;
      this.cam.position.lerp(o.pos, b);
      const q0 = this.cam.quaternion.clone();
      this.cam.lookAt(o.look);
      const q1 = this.cam.quaternion.clone();
      this.cam.quaternion.copy(q0).slerp(q1, b);
      this.cam.fov = lerp(fov, o.fov, b);
    } else this.cam.fov = fov;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
  }
}
