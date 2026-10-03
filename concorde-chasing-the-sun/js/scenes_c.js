/* 协和逐日 · 第三幕「突破」（54–84 s）：音障、马赫锥、两倍音速 */
(function (G) {
  'use strict';
  const { W, H, BAR } = gfx;
  const { clamp, lerp, smooth, ramp, ease, V, TAU } = U;
  const D2R = Math.PI / 180;
  const lin = (c) => c.map((v) => Math.pow(v / 255, 2.2));

  const T0 = TL.mach[0];
  const BOOM = TL.boom - T0;      // 9.0
  const M2T = TL.mach2 - T0;      // 20.6

  // ---------------------------------------------------------------- 马赫数时间表
  function machAt(t) {
    if (t < BOOM) return 0.78 + 0.22 * Math.pow(t / BOOM, 1.6);
    return 1 + smooth(ramp(t, BOOM + 0.2, M2T)) + 0.04 * smooth(ramp(t, M2T, 24));
  }
  const KMH_PER_MACH = 1068;
  // 积分得到航程（用于图示和云层滚动）
  const DT = 0.005, NT = Math.ceil(36 / DT);
  const DIST = new Float64Array(NT + 1);
  for (let i = 1; i <= NT; i++) DIST[i] = DIST[i - 1] + machAt(i * DT) * DT;
  const distAt = (t) => { const f = clamp(t, 0, 35.9) / DT, i = Math.floor(f); return lerp(DIST[i], DIST[i + 1], f - i); };

  const SUN_L = V.norm([-0.25, 0.8, 0.55]);
  const SKY_DAY = { zenith: [8, 32, 108], mid: [34, 84, 176], low: [96, 150, 220], horizon: [176, 208, 240], topEl: 0.5, sunVis: 1, sunR: 0.55, sunWarm: 0.0, band: [255, 250, 235], bandK: 0.03, stars: 0.0 };
  const ENV_DAY = { L: SUN_L, sun: [1.2, 1.12, 1.0], skyTop: lin([60, 100, 190]), skyMid: lin([150, 180, 225]), ground: lin([190, 208, 232]), amb: 0.5, spec: 0.8, refl: 0.7, rim: [0.8, 0.9, 1.0], rimK: 0.12, exposure: 0.86 };

  const cam = new Concorde.Camera(W, H);
  const PLANE_H = 9500;

  function poseAt(t) {
    const d = distAt(t) * 295 * 2.5; // 世界中的前进距离（放大 2.5 倍，让云层有明显移动）
    return {
      pos: [d, PLANE_H + 2600 * smooth(t / 30), 0], yaw: 0,
      pitch: lerp(4.5, 0.8, smooth(ramp(t, 4, 16))) * D2R, roll: Math.sin(t * 0.55) * 1.4 * D2R, droop: 0, gear: 0,
    };
  }

  function camAt(t, pose) {
    let phi, el, dist, fov, ty = 0, tx = 0;
    if (t < 7.0) {
      const u = ease.inOutSine(t / 7);
      phi = lerp(98, 66, u); el = lerp(-9, -3, u); dist = lerp(175, 122, u); fov = 30; tx = lerp(2, 6, u);
    } else if (t < M2T) {
      const u = (t - 7) / (M2T - 7);
      phi = lerp(97, 102, u); el = -9; dist = lerp(222, 205, u); fov = 30; tx = 6;
    } else {
      const u = ease.inOutSine(ramp(t, M2T, 30));
      phi = lerp(24, 206, u); el = lerp(34, 6, u); dist = lerp(115, 168, u); fov = lerp(30, 33, u);
    }
    const ph = phi * D2R, e = el * D2R;
    const eye = [pose.pos[0] + tx + dist * Math.cos(e) * Math.cos(ph), pose.pos[1] + dist * Math.sin(e) + ty, pose.pos[2] + dist * Math.cos(e) * Math.sin(ph)];
    cam.lookAt(eye, [pose.pos[0] + tx, pose.pos[1], pose.pos[2]], 0, fov);
    return t < 7 ? 1 : t < M2T ? 2 : 3;
  }

  // ---------------------------------------------------------------- 马赫锥示意（二维叠加）
  const C_PX = 330, EMIT = 0.09, MAX_AGE = 6.0;
  function machWaves(ctx, t, noseX, noseY, alpha) {
    if (t < 2.5) return;
    const M = machAt(t);
    const D = distAt(t) * C_PX; // 屏幕像素航程
    const kStart = Math.floor(Math.max(0, t - MAX_AGE) / EMIT), kEnd = Math.floor(t / EMIT);
    ctx.save();
    ctx.lineWidth = 1.5;
    for (let k = kStart; k <= kEnd; k++) {
      const tau = k * EMIT, age = t - tau;
      if (age <= 0.02 || age >= MAX_AGE) continue;
      const cx = noseX - (D - distAt(tau) * C_PX);
      const r = C_PX * age;
      const a = alpha * 0.34 * Math.pow(1 - age / MAX_AGE, 1.4) * smooth(ramp(t, 2.5, 4));
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(cx, noseY, r, 0, TAU); ctx.stroke();
    }
    // 马赫锥包络线
    if (M > 1.02) {
      const mu = Math.asin(1 / M);
      const Ln = 1300;
      const ka = alpha * smooth(ramp(M, 1.02, 1.3));
      for (const sg of [-1, 1]) {
        const ex = noseX - Ln * Math.cos(mu), ey = noseY + sg * Ln * Math.sin(mu);
        const g = ctx.createLinearGradient(noseX, noseY, ex, ey);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * ka})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(noseX, noseY); ctx.lineTo(ex, ey); ctx.stroke();
      }
      // 锥内微亮
      const g2 = ctx.createLinearGradient(noseX, 0, noseX - Ln * Math.cos(mu), 0);
      g2.addColorStop(0, `rgba(255,255,255,${0.1 * ka})`); g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.moveTo(noseX, noseY); ctx.lineTo(noseX - Ln * Math.cos(mu), noseY - Ln * Math.sin(mu)); ctx.lineTo(noseX - Ln * Math.cos(mu), noseY + Ln * Math.sin(mu)); ctx.closePath(); ctx.fill();
    }
    // “音障之墙”：马赫 1 附近，圆圈在机头前堆叠成一道亮弧
    const wall = Math.exp(-Math.pow((M - 1) / 0.07, 2));
    if (wall > 0.02) {
      gfx.put(ctx, gfx.glow(255, 255, 255, 1.2), noseX + 20, noseY, 220, wall * 0.55 * alpha, 2.4);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 普朗特-格劳厄脱凝结云
  function vaporCone(ctx, pose, t, k) {
    if (k <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spr = gfx.glow(255, 255, 255, 0.7);
    for (let s = 20; s <= 74; s += 1.1) {
      const u = (s - 20) / 54;
      const r = 2.2 + u * 12 + 1.8 * Math.sin(u * 9 + t * 3);
      const nx = (U.fbm(s * 0.22, t * 1.4, 3) - 0.5) * 3.2, ny = (U.fbm(s * 0.31 + 9, t * 1.1, 3) - 0.5) * 2.4;
      const c = cam.project(Concorde.toWorld(pose, [Concorde.X0 - s, 0.4 + ny, nx]));
      if (c[2] < 5) continue;
      const rp = r * cam.f / c[2];
      const a = k * (0.55 - 0.3 * u) * (0.45 + 0.55 * smooth(ramp(u, 0, 0.18)));
      ctx.globalAlpha = a * 0.2;
      ctx.drawImage(spr, c[0] - rp, c[1] - rp * 0.8, rp * 2, rp * 1.6);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 绘制
  function draw(ctx, t, T) {
    const pose = poseAt(t);
    const shot = camAt(t, pose);
    const M = machAt(t);
    const dist = distAt(t);
    const P = {
      sky: SKY_DAY, sunDir: SUN_L, time: T, deckY: 0, originX: pose.pos[0], pal: 'day', light: 1,
      haze: [170, 204, 240], base: [[26, 66, 140], [120, 164, 220]], limb: [80, 150, 255], limbK: 1.0, sag: 16, hazeK: 0.7,
      size: 8500, hazeD: 70000, span: 190000, lat: 110000, squash: lerp(0.42, 0.9, clamp(-cam.fwd[1] * 2.2)),
      density: t < M2T ? 0.8 : lerp(0.8, 0.3, smooth(ramp(t, M2T, M2T + 3))),
    };
    // 深色天顶随高度加深
    P.sky = Object.assign({}, SKY_DAY, { zenith: [lerp(10, 4, smooth(t / 30)), lerp(40, 18, smooth(t / 30)), lerp(120, 78, smooth(t / 30))] });
    const info = World.highAlt(ctx, cam, P);
    if (info.sun) gfx.lensFlare(ctx, info.sun.x, info.sun.y, 0.35, { size: 0.9 });

    // 气流线
    const an = Concorde.anchors(pose);
    const planeDepth = cam.project(pose.pos)[2];
    const streak = { origin: pose.pos, dist: dist * 295 * 0.9, len: 70, n: 150, box: [1800, 520, 900], alpha: 0.22 + 0.12 * smooth(ramp(M, 0.8, 2)), planeDepth };
    World.streaks(ctx, cam, Object.assign({ pass: 'far' }, streak));

    // 马赫波（二维图示，仅在侧视镜头）
    const nose = cam.project(an.nose);
    if (shot === 2) machWaves(ctx, t, nose[0], nose[1], smooth(ramp(t, 7.0, 7.6)) * (1 - smooth(ramp(t, M2T - 1.2, M2T + 0.6)) * 0.7));

    // 飞机
    Concorde.draw(ctx, cam, pose, ENV_DAY, { fog: { color: lin([210, 226, 244]), density: 0.00012 } });

    // 尾焰（加力至约马赫 1.7 后关闭）
    const reheat = 1 - smooth(ramp(t, 15.8, 17.2));
    if (reheat > 0.01) {
      const dir = V.scale(an.dirFwd, -1);
      for (let i = 0; i < 4; i++) World.flame(ctx, cam, an.nozzles[i], dir, 15 + 8 * smooth(ramp(M, 1, 1.6)), 1.15, reheat, T, i);
    }

    // 凝结云 + 冲击波环
    const vap = smooth(ramp(t, BOOM - 0.15, BOOM + 0.35)) * (1 - smooth(ramp(t, BOOM + 1.6, BOOM + 3.8)));
    vaporCone(ctx, pose, t, vap);
    World.streaks(ctx, cam, Object.assign({ pass: 'near' }, streak));
    World.navLights(ctx, cam, an, T, 0.5, 0.5);

    // 音爆：冲击波环 + 闪白
    const bt = t - BOOM;
    if (bt > 0 && bt < 1.6) {
      const cpos = cam.project(pose.pos);
      const r = 80 + bt * 1700;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const rr = r * (1 - i * 0.07);
        const a = (1 - bt / 1.6) * (0.55 - i * 0.15);
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3.5 - i;
        ctx.beginPath(); ctx.ellipse(cpos[0] + 80, cpos[1], rr, rr * 0.82, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    if (bt > -0.02 && bt < 0.5) { ctx.fillStyle = `rgba(255,255,255,${0.55 * Math.pow(1 - clamp(bt / 0.5), 2)})`; ctx.fillRect(0, 0, W, H); }
    const bt2 = t - M2T;
    if (bt2 > 0 && bt2 < 0.4) { ctx.fillStyle = `rgba(255,248,230,${0.3 * (1 - bt2 / 0.4)})`; ctx.fillRect(0, 0, W, H); }

    // 开场自白光淡入，结尾沉入深蓝
    if (t < 1.0) { ctx.fillStyle = `rgba(255,236,200,${1 - t / 1.0})`; ctx.fillRect(0, 0, W, H); }
    const out = ramp(t, 28.4, 30);
    if (out > 0) { ctx.fillStyle = `rgba(4,18,52,${ease.inCubic(out)})`; ctx.fillRect(0, 0, W, H); }
  }

  Film.register({ id: 'mach', t0: TL.mach[0], t1: TL.mach[1], post: { bloom: 0.2 }, draw });

  // ---------------------------------------------------------------- 马赫表
  function gauge(ctx, T, a) {
    const t = T - T0;
    const M = machAt(t);
    const x0 = 1330, w = 470, y = BAR + 128;
    const mx = (m) => x0 + (m - 0.6) / (2.2 - 0.6) * w;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,214,150,0.9)'; ctx.fillRect(x0 - 18, y - 74, 2, 112);
    ctx.restore();
    gfx.text(ctx, 'MACH', x0, y - 52, { size: 14, family: 'mono', color: 'rgba(255,214,150,0.9)', track: 6, alpha: a });
    gfx.text(ctx, M.toFixed(2), x0, y - 4, { size: 58, family: 'mono', color: '#fff', track: 2, weight: 500, alpha: a, shadow: { blur: 10 } });
    gfx.text(ctx, `${Math.round(M * KMH_PER_MACH).toLocaleString('en-US')} km/h`, x0 + 190, y - 6, { size: 20, family: 'mono', color: 'rgba(255,255,255,0.88)', track: 2, alpha: a });
    gfx.text(ctx, `REHEAT ${t < 16.2 ? 'ON' : 'OFF'}`, x0 + 190, y - 34, { size: 14, family: 'mono', color: t < 16.2 ? 'rgba(255,170,90,0.95)' : 'rgba(160,215,255,0.9)', track: 4, alpha: a });
    // 刻度尺
    const ly = y + 22;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0, ly, w, 3);
    const gr = ctx.createLinearGradient(x0, 0, mx(M), 0); gr.addColorStop(0, 'rgba(255,214,150,0.15)'); gr.addColorStop(1, 'rgba(255,224,170,0.95)');
    ctx.fillStyle = gr; ctx.fillRect(x0, ly, Math.max(0, mx(M) - x0), 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
    for (let m = 0.6; m <= 2.2001; m += 0.2) { ctx.beginPath(); ctx.moveTo(mx(m), ly + 6); ctx.lineTo(mx(m), ly + 12); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,110,90,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx(1), ly - 9); ctx.lineTo(mx(1), ly + 16); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,215,255,0.95)'; ctx.beginPath(); ctx.moveTo(mx(2), ly - 9); ctx.lineTo(mx(2), ly + 16); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx(M), ly - 3); ctx.lineTo(mx(M) - 6, ly - 13); ctx.lineTo(mx(M) + 6, ly - 13); ctx.closePath(); ctx.fill();
    ctx.restore();
    gfx.text(ctx, '音障', mx(1) - 14, ly + 36, { size: 14, family: 'sans', color: 'rgba(255,140,120,0.95)', track: 2, alpha: a });
    gfx.text(ctx, '2 倍音速', mx(2) - 24, ly + 36, { size: 14, family: 'sans', color: 'rgba(170,220,255,0.95)', track: 2, alpha: a });
  }

  Film.cue({ kind: 'draw', t0: 55.4, t1: 82.4, fi: 1.0, fo: 1.0, draw: gauge });
  Film.cue({ kind: 'hud', t0: 55.4, t1: 82.4, fi: 1.0, fo: 1.0, rows: (T) => {
    const t = T - T0; const alt = lerp(9800, 17900, smooth(t / 30));
    return [['SPEED', `${Math.round(machAt(t) * KMH_PER_MACH).toLocaleString('en-US')} km/h`], ['ALT', `${Math.round(alt).toLocaleString('en-US')} m`], ['TEMP', `${Math.round(lerp(-52, -57, smooth(t / 20)))} °C`]];
  } });
  Film.cue({ kind: 'chapter', t0: 54.6, t1: 58.8, num: 'CHAPTER  III', zh: '突破', en: 'BREAKTHROUGH' });
  Film.cue({ t0: 55.8, t1: 61.8, zh: '1969 年 10 月 1 日，协和首次突破音障。', en: '1 OCTOBER 1969  ·  FIRST SUPERSONIC FLIGHT', y: 904, type: 2.0, scrim: 0.8 });
  Film.cue({ kind: 'big', t0: 63.2, t1: 66.2, zh: '马赫 1', y: 330, x: 760, size: 150, track: 24, glow: { color: 'rgba(255,255,255,0.7)', blur: 40 }, en: 'THE SOUND BARRIER', enSize: 22, enTrack: 14, enDy: 70, fi: 0.15, fo: 1.2, align: 'center' });
  Film.cue({ t0: 67.4, t1: 73.0, zh: '1970 年 11 月 4 日，达到两倍音速。', en: '4 NOVEMBER 1970  ·  MACH 2', y: 904, type: 1.8, scrim: 0.8 });
  Film.cue({ kind: 'big', t0: 74.6, t1: 77.4, zh: '马赫 2', y: 330, x: 760, size: 150, track: 24, glow: { color: 'rgba(170,220,255,0.8)', blur: 40 }, en: 'TWICE THE SPEED OF SOUND', enSize: 22, enTrack: 12, enDy: 70, fi: 0.15, fo: 1.2 });
  Film.cue({ t0: 77.8, t1: 83.0, zh: '1976 年 1 月 21 日，伦敦与巴黎同时开航，首批乘客登机。', en: '21 JANUARY 1976  ·  LONDON AND PARIS  ·  THE FIRST PASSENGERS', y: 904, type: 2.4, scrim: 0.8, size: 38, fo: 1.0 });
  Film.typing.push({ t0: 55.8, n: 19, cps: 9.5, kind: 'soft' }, { t0: 67.4, n: 15, cps: 8.5, kind: 'soft' }, { t0: 77.8, n: 28, cps: 11.5, kind: 'soft' });

  Film.mach = { machAt, distAt };
})(typeof window !== 'undefined' ? window : globalThis);
