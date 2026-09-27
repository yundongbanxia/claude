import * as THREE from 'three';
import { raycastHitboxes, type HitZone } from '../anim/rig';
import { DEG } from '../core/math';
import { rng } from '../core/rng';
import { wDamage, type WeaponDef, type WeaponState } from '../data/weapons';
import type { Breakable } from '../world/level';
import type { Collider } from '../world/collision';
import type { Game } from './game';
import type { Enemy } from './enemies/enemy';
import type { Player } from './player/player';

export interface ShotHit {
  t: number;
  point: THREE.Vector3;
  enemy?: Enemy;
  zone?: HitZone;
  breakable?: Breakable;
  target?: { onShot: (p: THREE.Vector3, dir: THREE.Vector3) => void; pos: THREE.Vector3; r: number };
  normal?: THREE.Vector3;
  collider?: Collider | null;
  terrain?: boolean;
}

const _sphereCenter = new THREE.Vector3();

export class Combat {
  g: Game;
  shots = 0;
  hits = 0;
  headshots = 0;

  constructor(g: Game) {
    this.g = g;
  }

  /** Ray-sphere helper. */
  private raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number): number {
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
    const b = ox * d.x + oy * d.y + oz * d.z;
    const cc = ox * ox + oy * oy + oz * oz - r * r;
    const disc = b * b - cc;
    if (disc < 0) return -1;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : cc < 0 ? 0 : -1;
  }

  /** Collect everything a ray touches, nearest first, stopping at the first solid static hit. */
  trace(o: THREE.Vector3, dir: THREE.Vector3, maxDist: number, ignoreEnemy?: Enemy): ShotHit[] {
    const g = this.g;
    const lv = g.level!;
    const out: ShotHit[] = [];
    const st = lv.cw.raycast(o, dir, maxDist, 'bullet');
    const limit = st ? st.t : maxDist;
    for (const e of g.enemies) {
      if (!e.alive || e === ignoreEnemy) continue;
      _sphereCenter.set(e.pos.x, e.pos.y + 0.9, e.pos.z);
      const ts = this.raySphere(o, dir, _sphereCenter, e.isSalvador ? 1.7 : 1.5);
      if (ts < 0 || ts > limit) continue;
      const h = raycastHitboxes(e.rig.bones, e.hitboxes, o, dir, limit);
      if (h) out.push({ t: h.t, point: o.clone().addScaledVector(dir, h.t), enemy: e, zone: h.zone });
    }
    for (const t of g.shootables) {
      const ts = this.raySphere(o, dir, t.pos, t.r);
      if (ts >= 0 && ts < limit) out.push({ t: ts, point: o.clone().addScaledVector(dir, ts), target: t });
    }
    if (st) {
      const br = st.collider?.tag === 'breakable' ? (st.collider.ref as Breakable) : undefined;
      out.push({ t: st.t, point: o.clone().addScaledVector(dir, st.t), normal: st.normal, collider: st.collider, terrain: st.terrain, breakable: br });
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  fireWeapon(p: Player, ws: WeaponState, wd: WeaponDef, spread: number, focused: boolean) {
    const g = this.g;
    const cam = g.camera.cam;
    const baseDir = g.camera.forward(new THREE.Vector3());
    const origin = cam.position.clone();
    // skip geometry between camera and the player's shoulder plane
    const toPivot = new THREE.Vector3().subVectors(g.camera.pivot, origin).dot(baseDir);
    origin.addScaledVector(baseDir, Math.max(0, toPivot - 0.3));
    const muzzle = new THREE.Vector3(), mdir = new THREE.Vector3();
    p.muzzle(muzzle, mdir);
    g.fx.muzzle(muzzle, mdir, wd.kind !== 'pistol');
    const snd = wd.kind === 'shotgun' ? 'sg_shot' : wd.kind === 'rifle' ? 'rf_shot' : ws.id === 'red9' ? 'red9_shot' : 'hg_shot';
    g.audio.play(snd, muzzle);
    this.shots++;

    const perEnemy = new Map<Enemy, { dmg: number; zone: HitZone; pellets: number; point: THREE.Vector3; dir: THREE.Vector3; crit: boolean; head: number }>();
    const baseDmg = wDamage(ws);
    let anyHit = false;
    for (let i = 0; i < wd.pellets; i++) {
      const dir = baseDir.clone();
      // spread cone (gaussian-ish)
      const s = (wd.pellets > 1 ? wd.spreadMin : spread) * DEG;
      const r = s * Math.sqrt(rng.next()) * (wd.pellets > 1 ? 1 : 0.8);
      const a = rng.range(0, Math.PI * 2);
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
      dir.addScaledVector(right, Math.cos(a) * Math.tan(r)).addScaledVector(up2, Math.sin(a) * Math.tan(r)).normalize();
      const hits = this.trace(origin, dir, wd.range);
      let pierceLeft = wd.pierce;
      for (const h of hits) {
        if (h.enemy) {
          const dist = h.point.distanceTo(muzzle);
          let dmg = baseDmg;
          if (dist > wd.falloffStart) dmg *= Math.max(0.3, 1 - (dist - wd.falloffStart) / (wd.range - wd.falloffStart));
          const zm = h.zone === 'head' ? wd.headMult : h.zone === 'torso' ? 1 : wd.limbMult;
          dmg *= zm;
          let crit = false;
          if (h.zone === 'head' && wd.critBase > 0 && !h.enemy.isSalvador) {
            const c = wd.critBase * (focused ? 3 : 1);
            if (rng.chance(c)) {
              crit = true;
              dmg *= 6;
            }
          }
          const prev = perEnemy.get(h.enemy);
          if (prev) {
            prev.dmg += dmg;
            prev.pellets++;
            if (h.zone === 'head') prev.head++;
            prev.crit ||= crit;
          } else perEnemy.set(h.enemy, { dmg, zone: h.zone!, pellets: 1, point: h.point, dir: dir.clone(), crit, head: h.zone === 'head' ? 1 : 0 });
          g.fx.blood(h.point, dir, wd.pellets > 1 ? 0.35 : 1);
          anyHit = true;
          pierceLeft--;
          if (pierceLeft <= 0) break;
          continue;
        }
        if (h.target) {
          h.target.onShot(h.point, dir);
          anyHit = true;
          break;
        }
        // static
        if (h.breakable) {
          g.damageBreakable(h.breakable, baseDmg, h.point);
        } else {
          const tag = h.collider?.tag;
          const kind = h.terrain ? 'dirt' : tag === 'rock' || tag === 'wall' ? (tag === 'rock' ? 'stone' : 'wood') : 'wood';
          g.fx.impact(h.point, h.normal ?? dir.clone().negate(), kind);
          if (h.collider?.tag === 'door') g.audio.play('thud', h.point, 0.3, 1.6);
        }
        break;
      }
    }
    for (const [e, info] of perEnemy) {
      const zone = wd.pellets > 1 ? (info.head >= 2 ? 'head' : info.zone) : info.zone;
      if (zone === 'head') {
        this.headshots++;
        g.dda.onHeadshot();
      }
      this.hits++;
      g.audio.play(zone === 'head' ? 'headshot' : 'flesh', info.point, 0.8);
      // spatter on a wall/ground behind the target
      const behind = g.level!.cw.raycast(info.point, info.dir, 3.5, 'bullet');
      if (behind) g.fx.bloodSplat(info.point.clone().addScaledVector(info.dir, behind.t), behind.normal, zone === 'head' ? 0.7 : 0.45);
      e.takeDamage({
        dmg: info.dmg,
        zone,
        dir: info.dir,
        kind: wd.kind === 'shotgun' ? 'shotgun' : wd.kind === 'rifle' ? 'rifle' : 'bullet',
        crit: info.crit,
        pellets: info.pellets,
        point: info.point,
      });
      if (info.crit) g.hud.toast('暴击!');
    }
    if (anyHit) g.hud.hitMarker();
  }

  /** Current aim target (for reticle color / gun orientation). */
  updateAim(p: Player) {
    const g = this.g;
    const cam = g.camera.cam;
    const dir = g.camera.forward(new THREE.Vector3());
    const origin = cam.position.clone();
    const toPivot = new THREE.Vector3().subVectors(g.camera.pivot, origin).dot(dir);
    origin.addScaledVector(dir, Math.max(0, toPivot - 0.3));
    const hits = this.trace(origin, dir, 80);
    const h = hits[0];
    p.aimHitEnemy = h?.enemy ?? null;
    p.aimHitZone = h?.zone ?? '';
    p.aimPoint.copy(h ? h.point : origin.clone().addScaledVector(dir, 60));
  }

  explode(pos: THREE.Vector3, radius: number, dmg: number, source: string) {
    const g = this.g;
    g.fx.explosion(pos, radius / 3.5);
    g.audio.play('explosion', pos);
    const pd = g.player.center.distanceTo(pos);
    g.camera.shake(Math.max(0, 1.2 - pd / 20));
    g.renderer.post.flash = Math.max(g.renderer.post.flash, Math.max(0, 0.35 - pd / 60));
    g.alertNoise(pos, 40);
    const lv = g.level!;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const c = e.center;
      const d = c.distanceTo(pos);
      if (d > radius) continue;
      if (!lv.cw.clear(pos.clone().add(new THREE.Vector3(0, 0.3, 0)), c, 'bullet')) continue;
      const f = 1 - d / radius;
      const dir = c.clone().sub(pos).setY(0).normalize();
      const killed = e.takeDamage({ dmg: dmg * (0.35 + 0.65 * f) * (e.isSalvador ? 0.6 : 1), zone: 'torso', dir, kind: 'explosion' });
      if (killed && rng.chance(0.5)) e.explodeHead(dir);
    }
    if (pd < radius && g.player.alive) {
      if (lv.cw.clear(pos.clone().add(new THREE.Vector3(0, 0.3, 0)), g.player.center, 'bullet')) {
        const f = 1 - pd / radius;
        g.player.hurt(dmg * (0.3 + 0.7 * f) * (source === 'grenade' ? 0.5 : 1) * g.enemyDamageMult(), pos, 'explosion');
      }
    }
    for (const b of lv.breakables) {
      if (b.broken) continue;
      const d = Math.hypot(b.x - pos.x, b.y - pos.y, b.z - pos.z);
      if (d < radius) g.damageBreakable(b, 999, new THREE.Vector3(b.x, b.y, b.z));
    }
    for (const a of g.animals) if (a.alive && a.pos.distanceTo(pos) < radius) a.kill();
    for (const pr of g.projectiles) {
      if (pr.kind === 'dynamite' && pr.alive && pr.pos.distanceTo(pos) < radius * 0.8 && pr.fuse > 0.15) pr.fuse = 0.12;
    }
    g.fx.bloodPool(pos, 0.01); // no-op scorch placeholder
  }

  /** Knife slash: hits the nearest enemy in a short frontal arc, or breakables. */
  knifeSlash(p: Player) {
    const g = this.g;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best: Enemy | null = null;
    let bestD = 1.9;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || Math.abs(e.pos.y - p.pos.y) > 1.2) continue;
      if ((dx * fx + dz * fz) / (d || 1) < 0.35) continue;
      best = e;
      bestD = d;
    }
    if (best) {
      const low = best.state === 'react' && best.reaction === 'kneel';
      const zone: HitZone = low ? 'head' : best.isDown ? 'torso' : 'torso';
      const dmg = best.isDown ? 130 : low ? 110 : 70;
      const dir = new THREE.Vector3(fx, 0, fz);
      g.audio.play('knife_hit', best.center);
      g.fx.blood(best.center, dir, 0.6);
      best.takeDamage({ dmg, zone, dir, kind: 'knife' });
      g.hud.hitMarker();
      return;
    }
    // breakables
    for (const b of g.level!.breakables) {
      if (b.broken) continue;
      const dx = b.x - p.pos.x, dz = b.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.4 + b.radius && (dx * fx + dz * fz) / (d || 1) > 0.3) {
        g.damageBreakable(b, 100, new THREE.Vector3(b.x, b.y, b.z));
        return;
      }
    }
    for (const a of g.animals) {
      if (!a.alive) continue;
      if (a.pos.distanceTo(p.pos) < 1.3) {
        a.kill();
        return;
      }
    }
  }
}
