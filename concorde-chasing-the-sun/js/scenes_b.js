/* 协和逐日 · 第二幕「起飞」（30–54 s） */
(function (G) {
  'use strict';
  const { W, H, BAR } = gfx;
  const { clamp, lerp, smooth, ramp, ease, V } = U;
  const D2R = Math.PI / 180;

  const lin = (c) => c.map((v) => Math.pow(v / 255, 2.2));

  // ---------------------------------------------------------------- 通用 HUD
  Film.hud = function (ctx, a, rows, x = 120, y = H - BAR - 150) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,214,150,0.9)'; ctx.fillRect(x - 16, y - 24, 2, rows.length * 34 + 8);
    ctx.restore();
    rows.forEach((r, i) => {
      gfx.text(ctx, r[0], x, y + i * 34 - 2, { size: 13, family: 'mono', color: 'rgba(255,214,150,0.85)', track: 4, alpha: a });
      gfx.text(ctx, r[1], x + 108, y + i * 34 + 2, { size: 24, family: 'mono', color: '#fff', track: 2, alpha: a, weight: 500 });
    });
  };
  Film.radio = function (ctx, T, t0, t1, who, msg, y = BAR + 150) {
    const a = gfx.env(T, t0, t1, 0.25, 0.5);
    if (a <= 0) return;
    const prog = clamp((T - t0) / (msg.length / 30));
    const blink = Math.floor(T * 2.4) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = a; ctx.fillStyle = blink ? 'rgba(255,90,70,0.95)' : 'rgba(255,90,70,0.25)';
    ctx.beginPath(); ctx.arc(128, y - 6, 4.5, 0, U.TAU); ctx.fill(); ctx.restore();
    gfx.text(ctx, who, 146, y - 1, { size: 15, family: 'mono', color: 'rgba(255,214,150,0.95)', track: 4, alpha: a });
    gfx.text(ctx, msg, 146 + gfx.measure(ctx, who, { size: 15, family: 'mono', track: 4 }) + 18, y - 1, { size: 15, family: 'mono', color: 'rgba(255,255,255,0.92)', track: 3, alpha: a, progress: prog });
  };

  // ---------------------------------------------------------------- 飞行模型（局部时间 t，单位秒）
  const V0 = 20, ACC = 3.9, T_ROT = 14.8, T_LO = 17.6;
  const PIV = [-10.17, -4.55];
  const FL = (function () {
    const dt = 0.01, N = 2500;
    const S = { dt, x: new Float64Array(N), y: new Float64Array(N), th: new Float64Array(N), gam: new Float64Array(N), v: new Float64Array(N) };
    let cx = 0, px = 0, py = 4.55;
    for (let i = 0; i < N; i++) {
      const t = i * dt;
      const v = V0 + ACC * t;
      S.v[i] = v;
      let th;
      if (t < T_ROT) th = 0.4;
      else if (t < T_LO) th = 0.4 + (t - T_ROT) * 4.4;
      else th = 12.76 + 4.6 * (1 - Math.exp(-(t - T_LO) / 1.7));
      S.th[i] = th * D2R;
      if (t <= T_LO) {
        cx = V0 * t + 0.5 * ACC * t * t;
        const r = th * D2R;
        px = cx - PIV[0] * Math.cos(r) + PIV[1] * Math.sin(r);
        py = -(PIV[0] * Math.sin(r) + PIV[1] * Math.cos(r));
        S.gam[i] = 0;
      } else {
        const gam = (1.2 + 8.6 * (1 - Math.exp(-(t - T_LO) / 3.2))) * D2R;
        S.gam[i] = gam;
        px += v * Math.cos(gam) * dt; py += v * Math.sin(gam) * dt;
      }
      S.x[i] = px; S.y[i] = py;
    }
    return S;
  })();
  function flight(t) {
    const f = clamp(t, 0, 24.9) / FL.dt;
    const i = Math.floor(f), u = f - i;
    const g = (a) => lerp(a[i], a[i + 1], u);
    const T = clamp(t, 0, 24.9);
    return {
      x: g(FL.x), y: g(FL.y), th: g(FL.th), gam: g(FL.gam), v: g(FL.v),
      airborne: t > T_LO,
      gear: t < T_LO + 3.0 ? 1 : 1 - ease.inOutQuad(ramp(t, T_LO + 3.0, T_LO + 6.0)),
      droop: t < T_LO + 1.4 ? 12.5 : lerp(12.5, 4.5, smooth(ramp(t, T_LO + 1.4, T_LO + 4.6))) * (1 - smooth(ramp(t, T_LO + 5.2, T_LO + 7.2))),
    };
  }
  function poseAt(t) {
    const f = flight(t);
    return { pos: [f.x, f.y, 0], yaw: 0, pitch: f.th, roll: 0, droop: f.droop, gear: f.gear, _f: f };
  }

  // ---------------------------------------------------------------- 光照环境
  function envFor(shot) {
    const base = {
      amb: 0.5, spec: 1.0, refl: 0.7, exposure: 0.82,
    };
    if (shot === 'A') return Object.assign({ L: V.norm([0.95, 0.1, 0.3]), sun: [1.5, 0.82, 0.4], skyTop: lin([20, 28, 70]), skyMid: lin([120, 80, 100]), ground: lin([55, 40, 45]), rim: [1.2, 0.7, 0.4], rimK: 0.5 }, base);
    if (shot === 'B') return Object.assign({ L: V.norm([0.8, 0.12, 0.6]), sun: [1.55, 0.86, 0.4], skyTop: lin([60, 80, 150]), skyMid: lin([230, 150, 120]), ground: lin([70, 50, 50]), rim: [1.2, 0.7, 0.4], rimK: 0.4 }, base);
    if (shot === 'C') return Object.assign({ L: V.norm([0.7, 0.14, 0.7]), sun: [1.6, 0.9, 0.42], skyTop: lin([60, 85, 160]), skyMid: lin([240, 160, 120]), ground: lin([70, 52, 50]), rim: [1.2, 0.7, 0.4], rimK: 0.4 }, base);
    return Object.assign({ L: V.norm([0.97, 0.1, 0.2]), sun: [1.8, 1.0, 0.45], skyTop: lin([60, 80, 160]), skyMid: lin([255, 170, 120]), ground: lin([90, 60, 55]), rim: [1.9, 1.05, 0.5], rimK: 1.3 }, base, { amb: 0.16, refl: 0.35, exposure: 0.95 });
  }

  const SKY = {
    A: { zenith: [8, 12, 38], mid: [34, 36, 82], low: [110, 86, 124], horizon: [200, 130, 130], sunDir: V.norm([0.95, 0.1, 0.3]), sunVis: 0, band: [255, 140, 100], bandK: 0.25, stars: 0.7 },
    B: { zenith: [16, 28, 84], mid: [88, 84, 140], low: [222, 140, 120], horizon: [250, 166, 108], sunDir: V.norm([0.8, 0.12, 0.6]), sunVis: 0, band: [255, 150, 90], bandK: 0.4, stars: 0.2 },
    C: { zenith: [16, 30, 88], mid: [96, 88, 146], low: [232, 146, 120], horizon: [250, 168, 110], sunDir: V.norm([0.7, 0.14, 0.7]), sunVis: 0, band: [255, 150, 90], bandK: 0.4, stars: 0.1 },
    D: { zenith: [24, 42, 112], mid: [130, 96, 150], low: [248, 150, 108], horizon: [250, 176, 108], sunDir: V.norm([0.97, 0.1, 0.2]), sunVis: 1, sunR: 1.7, sunWarm: 0.8, band: [255, 150, 80], bandK: 0.55, stars: 0 },
  };
  const GROUND = {
    A: { haze: [120, 84, 100], far: [38, 34, 52], near: [8, 8, 14], hills: [{ color: [46, 40, 62], amp: 3.2, scale: 2.0, seed: 3 }, { color: [32, 28, 46], amp: 2.0, scale: 3.4, seed: 8 }] },
    B: { haze: [236, 150, 112], far: [74, 56, 70], near: [14, 12, 18], hills: [{ color: [96, 66, 86], amp: 3.4, scale: 1.8, seed: 5 }, { color: [64, 48, 64], amp: 2.0, scale: 3.0, seed: 9 }] },
    C: { haze: [240, 156, 112], far: [76, 58, 70], near: [14, 12, 18], hills: [{ color: [100, 70, 88], amp: 3.4, scale: 1.8, seed: 15 }, { color: [66, 50, 66], amp: 2.0, scale: 3.0, seed: 19 }] },
    D: { haze: [255, 196, 120], far: [120, 78, 76], near: [24, 18, 24], hills: [{ color: [140, 84, 84], amp: 3.0, scale: 1.8, seed: 25 }, { color: [96, 62, 72], amp: 2.0, scale: 3.0, seed: 29 }] },
  };
  const RUNWAY = (shot) => ({ x0: -400, x1: 4200, hw: 22.5, col: [34, 34, 44], fog: shot === 'A' ? [110, 80, 100] : [235, 150, 112], fogD: shot === 'A' ? 900 : 1500, light: [255, 226, 180], lightK: 1 });

  // ---------------------------------------------------------------- 机位
  const camMain = new Concorde.Camera(W, H), camPrev = new Concorde.Camera(W, H);
  function shotCam(cam, t) {
    const p = poseAt(t);
    const pos = p.pos;
    if (t < 6.5) { // A 迎面
      const tt = t;
      const eye = [300, 1.5, 7];
      const tgt = [pos[0] + 8, pos[1] + 1.2, 0];
      cam.lookAt(eye, tgt, 0, lerp(30, 22, ease.inOutSine(tt / 6.5)));
      return 'A';
    }
    if (t < 12.5) { // B 侧向跟拍
      const u = t - 6.5;
      const eye = [pos[0] + 14 - 1.6 * u, 1.6, 104 - 3.2 * u];
      const tgt = [pos[0] + 1.5, pos[1] - 0.2, 0];
      cam.lookAt(eye, tgt, 0, 30);
      return 'B';
    }
    if (t < 19.0) { // C 地面固定机位，平移追随
      const xC = 1030;
      const eye = [xC, 1.5, 132];
      const lag = flight(t - 0.15);
      cam.lookAt(eye, [lerp(lag.x, pos[0], 0.4), pos[1] * 0.9 + 1, 0], 0, lerp(27, 24, ramp(t, 12.5, 19)));
      return 'C';
    }
    { // D 后上方追随
      const u = t - 19.0;
      const f = p._f;
      const fwd = [Math.cos(f.gam), Math.sin(f.gam), 0];
      const back = 120 - 6 * u;
      const eye = [pos[0] - fwd[0] * back + 4, pos[1] - fwd[1] * back + 14 - 0.6 * u, 22 - 4 * u];
      const tgt = [pos[0] + 46, pos[1] + 9 + 2.2 * u, 0];
      cam.lookAt(eye, tgt, -0.02 + 0.015 * Math.sin(u * 0.8), lerp(34, 38, ease.inOutSine(clamp(u / 5))));
      return 'D';
    }
  }

  function takeoffDraw(ctx, t, T) {
    const shot = shotCam(camMain, t);
    World.prepCam(camMain);
    // 上一瞬的相机（拉丝光点）
    const dtp = 1 / 40;
    shotCam(camPrev, Math.max(0, t - dtp));
    const cam = camMain;
    const sky = Object.assign({ time: T }, SKY[shot]);
    const gnd = GROUND[shot];
    const R = RUNWAY(shot);
    const horizon = World.sky(ctx, cam, sky).yh;
    // 太阳处于 D 镜头：先画远景
    if (shot === 'D') {
      World.farLights(ctx, cam, horizon, { seed: 7, n: 420, time: T, k: 0.8 });
    } else if (shot === 'A') {
      World.farLights(ctx, cam, horizon, { seed: 3, n: 520, time: T, k: 1.0 });
    }
    World.ground(ctx, cam, gnd);
    if (shot === 'A') World.farLights(ctx, cam, horizon, { seed: 11, n: 300, time: T, k: 0.9 });
    // 贴地薄雾
    {
      const hy = Math.max(0, horizon);
      const g = ctx.createLinearGradient(0, hy - 40, 0, hy + 90);
      const hc = gnd.haze;
      g.addColorStop(0, `rgba(${hc[0]},${hc[1]},${hc[2]},0)`); g.addColorStop(0.45, `rgba(${hc[0]},${hc[1]},${hc[2]},0.55)`); g.addColorStop(1, `rgba(${hc[0]},${hc[1]},${hc[2]},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, hy - 40, W, 130);
    }
    const prevCam = (shot === 'B' || shot === 'D') ? camPrev : null;
    R.prev = prevCam;
    World.runway(ctx, cam, R);

    const pose = poseAt(t);
    const f = pose._f;
    // 影子
    const alt = f.y - 4.55;
    World.shadow(ctx, cam, pose.pos[0] - 4, 0, 34, 11, 0.42 * clamp(1 - alt / 90), 0);
    // 飞机
    const env = envFor(shot);
    // 机头灯光束
    const an = Concorde.anchors(pose);
    // 夕阳光斑落在机体上的暖色辉光在 draw 内处理
    Concorde.draw(ctx, cam, pose, env, { fog: { color: lin(shot === 'A' ? [110, 80, 100] : [240, 160, 120]), density: shot === 'C' ? 0.0007 : 0.0004 } });

    // 尾焰
    const ab = 1;
    if (shot !== 'A') {
      const dir = V.scale(an.dirFwd, -1);
      for (let i = 0; i < 4; i++) World.flame(ctx, cam, an.nozzles[i], dir, 15, 1.15, ab, T, i);
    }
    // 着陆灯与航行灯
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    {
      const a = cam.project(an.noseGear);
      if (a[2] > 1) {
        const fwd = an.dirFwd;
        const tip = cam.project([an.noseGear[0] + fwd[0] * 60, an.noseGear[1] + fwd[1] * 60 - 3, an.noseGear[2] + fwd[2] * 60]);
        const k = shot === 'A' ? 1 : 0.18;
        if (shot !== 'D' && tip[2] > 1) {
          const g = ctx.createLinearGradient(a[0], a[1], tip[0], tip[1]);
          g.addColorStop(0, `rgba(255,245,220,${0.5 * k})`); g.addColorStop(1, 'rgba(255,245,220,0)');
          const dx = tip[0] - a[0], dy = tip[1] - a[1], ln = Math.hypot(dx, dy) || 1;
          const w = shot === 'A' ? 120 : 16;
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(tip[0] - dy / ln * w, tip[1] + dx / ln * w); ctx.lineTo(tip[0] + dy / ln * w, tip[1] - dx / ln * w); ctx.closePath(); ctx.fill();
        }
        if (shot !== 'D') {
          gfx.put(ctx, gfx.glow(255, 245, 225, 1.2), a[0], a[1], clamp(cam.f * 1.2 / a[2], 8, 260), 0.9);
          gfx.put(ctx, gfx.glow(255, 255, 255, 1.6), a[0], a[1], clamp(cam.f * 0.3 / a[2], 3, 70), 1);
        }
      }
    }
    ctx.restore();
    World.navLights(ctx, cam, an, T, 1, 1);

    // 镜头光晕（D：正对太阳）
    if (shot === 'D' && World.lastSun) {
      const s = World.lastSun;
      gfx.lensFlare(ctx, s.x, s.y, 0.6 * smooth(ramp(t, 19, 20.5)), { size: 1.0 });
    }

    // 开场淡入 / 转场
    if (t < 0.8) { ctx.fillStyle = `rgba(255,248,235,${1 - t / 0.8})`; ctx.fillRect(0, 0, W, H); }
    // 镜头切换时的短促闪白
    for (const cut of [6.5, 12.5, 19.0]) {
      const d = t - cut;
      if (d >= 0 && d < 0.18) { ctx.fillStyle = `rgba(255,236,210,${0.55 * (1 - d / 0.18)})`; ctx.fillRect(0, 0, W, H); }
    }
    const out = ramp(t, 22.4, 24);
    if (out > 0) { ctx.fillStyle = `rgba(255,236,200,${ease.inCubic(out)})`; ctx.fillRect(0, 0, W, H); }

  }

  Film.register({ id: 'takeoff', t0: TL.takeoff[0], t1: TL.takeoff[1], post: { bloom: 0.32 }, draw: takeoffDraw });
  Film.cue({ kind: 'hud', t0: 31.5, t1: 52.5, fi: 1.2, fo: 1.0, rows: (T) => { const f = flight(T - TL.takeoff[0]); return [['SPEED', `${Math.round(f.v * 3.6)} km/h`], ['ALT', `${Math.max(0, Math.round(f.y - 4.55))} m`], ['REHEAT', 'ON']]; } });
  Film.cue({ kind: 'chapter', t0: 30.9, t1: 35.0, num: 'CHAPTER  II', zh: '起飞', en: 'TAKEOFF' });
  Film.cue({ t0: 31.4, t1: 36.4, zh: '1969 年 3 月 2 日，法国图卢兹。', en: '2 MARCH 1969  ·  TOULOUSE, FRANCE', y: 904, type: 1.8, scrim: 0.8 });
  Film.cue({ t0: 37.2, t1: 42.2, zh: '协和 001 号，驶上跑道。', en: 'PROTOTYPE 001  ·  TEST PILOT ANDRÉ TURCAT', y: 904, type: 1.4, scrim: 0.8 });
  Film.cue({ t0: 42.8, t1: 47.0, zh: '四台发动机，同时点燃加力。', en: 'FOUR OLYMPUS ENGINES  ·  FULL REHEAT', y: 904, type: 1.4, scrim: 0.8 });
  Film.cue({ t0: 48.2, t1: 52.6, zh: '轮子，离开了地面。', en: 'AND THEN, IT FLEW.', y: 904, type: 1.2, scrim: 0.8 });
  Film.typing.push({ t0: 31.4, n: 15, cps: 8.5, kind: 'soft' }, { t0: 37.2, n: 12, cps: 9, kind: 'soft' }, { t0: 42.8, n: 13, cps: 9, kind: 'soft' }, { t0: 48.2, n: 9, cps: 8, kind: 'soft' });
  // 无线电
  Film.cue({ kind: 'radio', t0: 32.0, t1: 36.0, who: 'TWR ▸', msg: 'CONCORDE, WIND CALM. CLEARED FOR TAKEOFF.' });
  Film.cue({ kind: 'radio', t0: 36.4, t1: 39.6, who: 'CONCORDE ▸', msg: 'ROGER. ROLLING.', y: BAR + 150 });
  Film.takeoff = { flight, T_LO, T_ROT };
})(typeof window !== 'undefined' ? window : globalThis);
