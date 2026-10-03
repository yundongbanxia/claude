/* 协和逐日 · 第五幕「航线」（150–174 s）+ 终章「落日」（174–204 s） */
(function (G) {
  'use strict';
  const { W, H, BAR } = gfx;
  const { clamp, lerp, smooth, ramp, ease, V, TAU, mixc } = U;
  const D2R = Math.PI / 180;
  const lin = (c) => c.map((v) => Math.pow(v / 255, 2.2));
  const C = Geo.CITIES;

  // ======================================================================
  // 第五幕 航线：点阵地球 + 航线 + 纪录
  // ======================================================================
  const DOTS = Geo.landDots(1.7);
  const GC = { x: 600, y: 522, R: 340 };
  const toV = (lon, lat) => { const a = lon * D2R, b = lat * D2R; return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)]; };
  function view(lon0, lat0) { const a = lon0 * D2R, b = lat0 * D2R; return { ca: Math.cos(a), sa: Math.sin(a), cb: Math.cos(b), sb: Math.sin(b) }; }
  function rot(v, Vw) {
    const x1 = v[0] * Vw.ca + v[1] * Vw.sa, y1 = -v[0] * Vw.sa + v[1] * Vw.ca, z1 = v[2];
    return [x1 * Vw.cb + z1 * Vw.sb, y1, -x1 * Vw.sb + z1 * Vw.cb]; // [深度, 右, 上]
  }
  const scr = (p, R, k = 1) => [GC.x + p[1] * R * k, GC.y - p[2] * R * k];
  function arcPoint(A, B, u, lift) {
    const dot = clamp(V.dot(A, B), -1, 1), om = Math.acos(dot), so = Math.sin(om) || 1;
    const a = Math.sin((1 - u) * om) / so, b = Math.sin(u * om) / so;
    const k = 1 + lift * Math.sin(Math.PI * u);
    return [(A[0] * a + B[0] * b) * k, (A[1] * a + B[1] * b) * k, (A[2] * a + B[2] * b) * k];
  }

  // 路线：from → [via] → to，出现与消失的时间（局部秒）
  const ROUTES = [
    { id: 'bah', pts: ['LHR', 'BAH'], t0: 2.2, t1: 6.0, col: [255, 210, 130] },
    { id: 'rio', pts: ['CDG', 'DKR', 'GIG'], t0: 3.2, t1: 7.6, col: [255, 210, 130] },
    { id: 'lhr-jfk', pts: ['LHR', 'JFK'], t0: 8.8, t1: 12.4, col: [150, 215, 255] },
    { id: 'cdg-jfk', pts: ['CDG', 'JFK'], t0: 9.8, t1: 13.4, col: [150, 215, 255] },
  ];
  const REC = { t0: 14.6, t1: 19.8, jfk: 'JFK', lhr: 'LHR' };
  const lonAt = (t) => U.keyframes([[0, 24], [6.5, 6], [8.4, -4], [12.5, -36], [24, -30]], t, ease.inOutSine);
  const latAt = (t) => U.keyframes([[0, 24], [8, 26], [14, 38], [24, 36]], t, ease.inOutSine);

  function routeSegments(ro) {
    const segs = []; let tot = 0;
    for (let i = 0; i < ro.pts.length - 1; i++) {
      const A = toV(C[ro.pts[i]].lon, C[ro.pts[i]].lat), B = toV(C[ro.pts[i + 1]].lon, C[ro.pts[i + 1]].lat);
      const L = Math.acos(clamp(V.dot(A, B), -1, 1));
      segs.push({ A, B, L }); tot += L;
    }
    return { segs, tot };
  }
  ROUTES.forEach((r) => Object.assign(r, routeSegments(r)));

  function routePoint(ro, u) {
    let d = u * ro.tot;
    for (const s of ro.segs) {
      if (d <= s.L + 1e-9) return arcPoint(s.A, s.B, s.L ? d / s.L : 0, 0.12 * Math.min(1, s.L / 0.9));
      d -= s.L;
    }
    const s = ro.segs[ro.segs.length - 1];
    return arcPoint(s.A, s.B, 1, 0);
  }

  function globe(ctx, t, T) {
    // 背景
    gfx.gradV(ctx, 0, H, [[0, '#02061a'], [0.65, '#071634'], [1, '#0d1a38']]);
    gfx.drawStars(ctx, T, 0.8, H, {});
    const appear = ease.outCubic(ramp(t, 0, 2.0));
    const R = GC.R * lerp(0.9, 1, appear) * (1 + 0.04 * smooth(ramp(t, 13.2, 15)) - 0.04 * smooth(ramp(t, 20, 22)));
    const lon0 = lonAt(t) + t * 0.18, lat0 = latAt(t);
    const Vw = view(lon0, lat0);

    ctx.save();
    ctx.globalAlpha = appear;
    // 大气辉光
    ctx.globalCompositeOperation = 'lighter';
    gfx.put(ctx, gfx.glow(70, 140, 255, 1.4), GC.x, GC.y, R * 1.42, 0.55);
    ctx.globalCompositeOperation = 'source-over';
    // 球体
    const sg = ctx.createRadialGradient(GC.x - R * 0.3, GC.y - R * 0.35, R * 0.1, GC.x, GC.y, R);
    sg.addColorStop(0, '#16356e'); sg.addColorStop(0.7, '#0b1f48'); sg.addColorStop(1, '#040c24');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(GC.x, GC.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(140,200,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(GC.x, GC.y, R, 0, TAU); ctx.stroke();

    // 经纬网
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(120,180,255,0.14)';
    const gline = (pts) => {
      let pen = false; ctx.beginPath();
      for (const v of pts) { const p = rot(v, Vw); if (p[0] > 0.02) { const s = scr(p, R); pen ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); pen = true; } else pen = false; }
      ctx.stroke();
    };
    for (let lat = -60; lat <= 60; lat += 20) { const pts = []; for (let lon = -180; lon <= 180; lon += 4) pts.push(toV(lon, lat)); gline(pts); }
    for (let lon = -180; lon < 180; lon += 20) { const pts = []; for (let lat = -80; lat <= 80; lat += 4) pts.push(toV(lon, lat)); gline(pts); }

    // 陆地点阵（按亮度分桶，减少状态切换）
    const sunV = toV(-30 + t * 0.4, 12);
    const buckets = [[], [], [], [], [], [], []];
    for (const d of DOTS) {
      const p = rot(d, Vw);
      if (p[0] <= 0.03) continue;
      const lit = 0.2 + 0.8 * clamp(V.dot(d, sunV) * 0.8 + 0.35);
      const k = clamp(Math.pow(p[0], 0.55) * lit);
      const bi = Math.min(6, (k * 7) | 0);
      buckets[bi].push(GC.x + p[1] * R, GC.y - p[2] * R);
    }
    const dsz = R / 150;
    for (let b = 0; b < 7; b++) {
      const arr = buckets[b]; if (!arr.length) continue;
      ctx.fillStyle = `rgba(${130 + b * 18},${190 + b * 9},255,${0.18 + b * 0.11})`;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i += 2) ctx.rect(arr[i] - dsz * 0.5, arr[i + 1] - dsz * 0.5, dsz * 1.15, dsz * 1.15);
      ctx.fill();
    }
    ctx.restore();

    // 航线
    ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = appear;
    const heads = [];
    for (const ro of ROUTES) {
      const u = ease.inOutSine(ramp(t, ro.t0, ro.t1));
      if (u <= 0) continue;
      const fade = ro.id.endsWith('jfk') ? 1 : 1 - 0.45 * smooth(ramp(t, 9, 11));
      const N = 90, uEnd = u;
      let pen = false, last = null;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const uu = (i / N) * uEnd;
        const p = rot(routePoint(ro, uu), Vw);
        if (p[0] > -0.05) { const s = scr(p, R); pen ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); pen = true; last = s; } else pen = false;
      }
      const col = ro.col;
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.25 * fade})`; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.95 * fade})`; ctx.lineWidth = 2; ctx.stroke();
      if (u < 1) {
        const p0 = rot(routePoint(ro, Math.max(0, uEnd - 0.02)), Vw), p1 = rot(routePoint(ro, uEnd), Vw);
        if (p1[0] > 0) heads.push({ s: scr(p1, R), a: Math.atan2(-(p1[2] - p0[2]), p1[1] - p0[1]), col });
      }
    }
    // 纪录航线（纽约 → 伦敦）
    const ru = ease.inOutSine(ramp(t, REC.t0, REC.t1));
    if (t > REC.t0 - 0.8) {
      const ro = { segs: [{ A: toV(C.JFK.lon, C.JFK.lat), B: toV(C.LHR.lon, C.LHR.lat), L: Math.acos(clamp(V.dot(toV(C.JFK.lon, C.JFK.lat), toV(C.LHR.lon, C.LHR.lat)), -1, 1)) }] };
      ro.tot = ro.segs[0].L;
      const a0 = smooth(ramp(t, REC.t0 - 0.8, REC.t0));
      ctx.beginPath(); let pen = false;
      for (let i = 0; i <= 90; i++) { const uu = (i / 90) * ru; const p = rot(routePoint(ro, uu), Vw); if (p[0] > -0.05) { const s = scr(p, R); pen ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); pen = true; } else pen = false; }
      ctx.strokeStyle = `rgba(255,255,255,${0.3 * a0})`; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.98 * a0})`; ctx.lineWidth = 3; ctx.stroke();
      if (ru > 0 && ru < 1) {
        const p0 = rot(routePoint(ro, Math.max(0, ru - 0.02)), Vw), p1 = rot(routePoint(ro, ru), Vw);
        heads.push({ s: scr(p1, R), a: Math.atan2(-(p1[2] - p0[2]), p1[1] - p0[1]), col: [255, 255, 255], big: true });
      }
    }
    ctx.restore();
    // 机头：小飞机图标
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const h of heads) {
      gfx.put(ctx, gfx.glow(h.col[0], h.col[1], h.col[2], 1.2), h.s[0], h.s[1], h.big ? 54 : 38, 0.9);
    }
    ctx.restore();
    for (const h of heads) {
      ctx.save(); ctx.translate(h.s[0], h.s[1]); ctx.rotate(h.a); ctx.fillStyle = '#fff';
      const k = h.big ? 1.4 : 1;
      ctx.beginPath(); ctx.moveTo(12 * k, 0); ctx.lineTo(-8 * k, -8 * k); ctx.lineTo(-4 * k, 0); ctx.lineTo(-8 * k, 8 * k); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // 城市
    const showCity = (id, t0) => {
      const c = C[id]; const p = rot(toV(c.lon, c.lat), Vw);
      if (p[0] <= 0.05) return;
      const s = scr(p, R);
      const a = smooth(ramp(t, t0, t0 + 0.8)) * appear;
      if (a <= 0) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      gfx.put(ctx, gfx.glow(255, 220, 150, 1.3), s[0], s[1], 20, 0.9 * a);
      ctx.restore();
      ctx.fillStyle = `rgba(255,248,230,${a})`; ctx.beginPath(); ctx.arc(s[0], s[1], 3.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,224,170,${0.7 * a})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(s[0], s[1], 8 + 2 * Math.sin(T * 3 + c.lon), 0, TAU); ctx.stroke();
      const off = { LHR: [-14, -12, 'right'], CDG: [14, 22, 'left'], JFK: [-14, 22, 'right'] }[id] || [14, -10, 'left'];
      gfx.text(ctx, c.name, s[0] + off[0], s[1] + off[1], { size: 14, family: 'mono', color: `rgba(255,236,200,${a})`, track: 3, align: off[2] });
    };
    showCity('LHR', 1.2); showCity('CDG', 1.4); showCity('BAH', 2.4); showCity('DKR', 3.6); showCity('GIG', 4.6); showCity('JFK', 8.4);

    // —— 右侧信息卡 ——
    const cardX = 1250;
    const card = (t0, t1, date, title, lines, en) => {
      const a = gfx.env(t, t0, t1, 0.8, 0.8);
      if (a <= 0) return;
      const dy = (1 - ease.outCubic(ramp(t, t0, t0 + 1.2))) * 24;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(255,214,150,0.9)'; ctx.fillRect(cardX - 28, 280 + dy, 2, 250);
      ctx.restore();
      gfx.text(ctx, date, cardX, 300 + dy, { size: 18, family: 'mono', color: 'rgba(255,214,150,0.95)', track: 7, alpha: a });
      gfx.text(ctx, title, cardX, 372 + dy, { size: 60, family: 'serif', weight: 600, color: '#fff', track: 8, alpha: a, glow: { color: 'rgba(120,180,255,0.4)', blur: 18 } });
      lines.forEach((l, i) => gfx.text(ctx, l, cardX, 432 + i * 40 + dy, { size: 27, family: 'sans', color: 'rgba(226,238,255,0.92)', track: 4, alpha: a }));
      gfx.text(ctx, en, cardX, 432 + lines.length * 40 + 14 + dy, { size: 15, family: 'mono', color: 'rgba(150,205,255,0.85)', track: 4, alpha: a });
    };
    card(1.4, 8.2, '21 JAN 1976', '首批商业航班', ['伦敦 → 巴林', '巴黎 → 达喀尔 → 里约热内卢'], 'LONDON → BAHRAIN  ·  PARIS → DAKAR → RIO');
    card(8.4, 14.0, '22 NOV 1977', '飞向纽约', ['伦敦、巴黎 → 纽约', '大西洋，从此只需三个半小时'], 'LONDON · PARIS → NEW YORK');
    // 纪录卡
    {
      const a = gfx.env(t, 14.4, 20.4, 0.8, 0.9);
      if (a > 0) {
        const dy = (1 - ease.outCubic(ramp(t, 14.4, 15.6))) * 24;
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,214,150,0.9)'; ctx.fillRect(cardX - 28, 250 + dy, 2, 340); ctx.restore();
        gfx.text(ctx, '7 FEB 1996', cardX, 270 + dy, { size: 18, family: 'mono', color: 'rgba(255,214,150,0.95)', track: 7, alpha: a });
        gfx.text(ctx, '纽约 → 伦敦', cardX, 336 + dy, { size: 54, family: 'serif', weight: 600, color: '#fff', track: 8, alpha: a });
        const sec = Math.round(10379 * ru);
        const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
        gfx.text(ctx, `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, cardX - 4, 470 + dy, { size: 128, family: 'mono', weight: 500, color: '#fff', track: 4, alpha: a, glow: { color: 'rgba(150,210,255,0.6)', blur: 24 } });
        gfx.text(ctx, '越洋飞行最快纪录', cardX, 530 + dy, { size: 28, family: 'sans', color: 'rgba(226,238,255,0.92)', track: 6, alpha: a });
        gfx.text(ctx, 'NEW YORK → LONDON  ·  2 H 52 M 59 S', cardX, 568 + dy, { size: 15, family: 'mono', color: 'rgba(150,205,255,0.85)', track: 4, alpha: a });
      }
    }
    // 总结卡
    {
      const a = gfx.env(t, 20.6, 24.4, 0.9, 0.7);
      if (a > 0) {
        const dy = (1 - ease.outCubic(ramp(t, 20.6, 21.8))) * 20;
        gfx.text(ctx, '1976 — 2003', cardX, 292 + dy, { size: 18, family: 'mono', color: 'rgba(255,214,150,0.95)', track: 7, alpha: a });
        const stats = [['20', '架 · 共造'], ['14', '架 · 载客服役'], ['27', '年 · 翱翔']];
        stats.forEach((s, i) => {
          const x = cardX + i * 190, aa = a * smooth(ramp(t, 21 + i * 0.35, 22 + i * 0.35));
          gfx.text(ctx, s[0], x, 440 + dy, { size: 120, family: 'mono', weight: 500, color: '#fff', track: 0, alpha: aa, glow: { color: 'rgba(255,170,90,0.55)', blur: 22 } });
          gfx.text(ctx, s[1], x + 4, 490 + dy, { size: 22, family: 'sans', color: 'rgba(255,224,180,0.95)', track: 4, alpha: aa });
        });
      }
    }
    const out = ramp(t, 23, 24);
    if (out > 0) { ctx.fillStyle = `rgba(3,8,22,${ease.inQuad(out)})`; ctx.fillRect(0, 0, W, H); }
    const fi = 1 - ramp(t, 0, 0.7);
    if (fi > 0) { ctx.fillStyle = `rgba(3,10,30,${fi})`; ctx.fillRect(0, 0, W, H); }
  }
  Film.register({ id: 'routes', t0: 150, t1: 174, post: { bloom: 0.5 }, draw: globe });
  Film.cue({ kind: 'chapter', t0: 150.8, t1: 154.8, num: 'CHAPTER  V', zh: '航线', en: 'THE ROUTES' });
  Film.cue({ t0: 156.2, t1: 161.0, zh: '它飞过大西洋，飞到海湾，也飞到南美。', en: 'ACROSS THE ATLANTIC, TO THE GULF, TO SOUTH AMERICA', y: 904, type: 2.1, scrim: 0.8, size: 38 });
  Film.cue({ t0: 163.6, t1: 168.4, zh: '那一天，它只用了不到三小时。', en: 'THAT DAY, IT TOOK UNDER THREE HOURS', y: 904, type: 1.8, scrim: 0.8, fo: 0.5 });
  Film.typing.push({ t0: 156.2, n: 19, cps: 9, kind: 'soft' }, { t0: 163.6, n: 14, cps: 8, kind: 'soft' });
  // 纪录计时器的打点（供音频）
  Film.record = { t0: 150 + REC.t0, t1: 150 + REC.t1 };

  // ======================================================================
  // 终章 落日（174–204 s）
  // ======================================================================
  const T0E = 174;
  const camE = new Concorde.Camera(W, H), camEp = new Concorde.Camera(W, H);
  const TD = TL.touchdown - T0E; // 9.0
  const XTD = 150, V_APP = 84, GLIDE = Math.tan(3 * D2R);
  const PIV = [-10.17, -4.55];

  function landing(t) {
    let x, v, contactH = 0, pitch, gear = 1, droop = 12.5, yawExtra = 0;
    if (t < TD) {
      v = V_APP; x = XTD + V_APP * (TD - t);
      contactH = Math.max(0, (x - XTD) * GLIDE * (0.55 + 0.45 * clamp((x - XTD) / 240)));
      pitch = lerp(11, 13, smooth(ramp(t, 4, TD)));
    } else {
      const s = t - TD;
      v = Math.max(7, V_APP * Math.exp(-s / 5.2));
      x = XTD - (V_APP * 5.2) * (1 - Math.exp(-s / 5.2)) - (v <= 7.0001 ? 0 : 0);
      if (V_APP * Math.exp(-s / 5.2) < 7) { const s0 = 5.2 * Math.log(V_APP / 7); x = XTD - V_APP * 5.2 * (1 - 7 / V_APP) - 7 * (s - s0); }
      contactH = 0;
      pitch = lerp(13, 0.3, smooth(ramp(s, 0.4, 3.4)));
      droop = 12.5;
      yawExtra = smooth(ramp(t, 15.2, 20.5)) * 0.65;
    }
    // 机体姿态：yaw = π（向 -X 滑行），以主起落架接地点为枢轴
    const yaw = Math.PI + yawExtra;
    const base = { pos: [0, 0, 0], yaw, pitch: pitch * D2R, roll: 0, droop, gear };
    const pw = Concorde.toWorld(base, [PIV[0], PIV[1], 0]);
    const pos = [x - pw[0], contactH - pw[1], -pw[2]];
    return { pose: Object.assign(base, { pos }), x, v, h: contactH, onGround: t >= TD };
  }

  // 昼夜过渡
  function skyAt(t, facingSun) {
    const d = ramp(t, 3, 21);
    const gold = { zenith: [24, 34, 104], mid: [142, 80, 126], low: [250, 128, 78], horizon: [255, 158, 88] };
    const dusk = { zenith: [6, 10, 44], mid: [34, 34, 88], low: [128, 72, 112], horizon: [226, 116, 96] };
    const night = { zenith: [2, 4, 20], mid: [8, 12, 44], low: [26, 30, 72], horizon: [70, 54, 96] };
    const a = d < 0.55 ? mixKeys(gold, dusk, d / 0.55) : mixKeys(dusk, night, (d - 0.55) / 0.45);
    return Object.assign({ topEl: 1.0, sunWarm: 0.9, sunR: 1, sunVis: facingSun ? 1 : 0, band: [255, 110, 50], bandK: facingSun ? 0.5 * (1 - d) : 0.3 * (1 - d), stars: smooth(ramp(t, 11, 20)) }, a);
  }
  function mixKeys(a, b, k) { return { zenith: mixc(a.zenith, b.zenith, k), mid: mixc(a.mid, b.mid, k), low: mixc(a.low, b.low, k), horizon: mixc(a.horizon, b.horizon, k) }; }

  function endDraw(ctx, t, T) {
    if (t >= 21) return endCard(ctx, t, T);
    const L = landing(t);
    const pose = L.pose;
    const shot = t < TD ? 'A' : t < 15 ? 'B' : 'C';
    let facingSun = true;
    const dusk = ramp(t, 3, 21);
    const sunEl = (1.25 - 0.22 * t) * D2R;
    const sunDir = V.norm([1, Math.tan(sunEl), 0.0]);
    const setCam = (cam, tt) => {
      const Lx = landing(tt);
      const p = Lx.pose.pos;
      if (shot === 'A') {
        const k = ease.inOutSine(clamp(tt / TD));
        cam.lookAt([-640, 2.0, 12], [p[0] + 0, p[1] + 3, 0], 0, lerp(10.5, 8, k));
      } else if (shot === 'B') {
        cam.lookAt([Lx.x + 24, 3.2, 150], [Lx.x - 6, 4.5, 0], 0, 23);
      } else {
        const xe = landing(15).x + 220;
        cam.lookAt([xe, 2.6, 34], [Lx.x, 5, 0], 0, lerp(17, 13, ramp(tt, 15, 21)));
        facingSun = false;
      }
    };
    setCam(camE, t); setCam(camEp, Math.max(0, t - 1 / 40));
    World.prepCam(camE);
    const sky = Object.assign({ time: T, sunDir }, skyAt(t, shot !== 'C'));
    sky.sunR = 70 / (camE.f * 0.018);
    const info = World.sky(ctx, camE, sky);
    const dim = 1 - 0.82 * dusk;
    const gnd = {
      haze: mixc([255, 190, 120], [90, 60, 100], dusk), far: [60 * dim + 8, 40 * dim + 8, 56 * dim + 14], near: [14 * dim + 3, 10 * dim + 3, 14 * dim + 6],
      hills: [{ color: [88 * dim + 6, 56 * dim + 6, 72 * dim + 12], amp: 1.5, scale: 1.8, seed: 31 }, { color: [58 * dim + 5, 40 * dim + 5, 56 * dim + 10], amp: 0.9, scale: 3.0, seed: 37 }],
    };
    World.ground(ctx, camE, gnd);
    const hz = World.horizonY(camE);
    World.farLights(ctx, camE, hz, { seed: 41, n: 360, time: T, k: 0.5 + dusk });
    {
      const g = ctx.createLinearGradient(0, Math.max(0, hz) - 40, 0, Math.max(0, hz) + 80);
      const hc = gnd.haze;
      g.addColorStop(0, `rgba(${hc[0] | 0},${hc[1] | 0},${hc[2] | 0},0)`); g.addColorStop(0.45, `rgba(${hc[0] | 0},${hc[1] | 0},${hc[2] | 0},0.5)`); g.addColorStop(1, `rgba(${hc[0] | 0},${hc[1] | 0},${hc[2] | 0},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, Math.max(0, hz) - 40, W, 120);
    }
    const R = { x0: -900, x1: 2600, hw: 22.5, col: [34 * dim + 8, 34 * dim + 8, 44 * dim + 12], fog: mixc([240, 160, 110], [70, 50, 90], dusk), fogD: lerp(2400, 1400, dusk), light: [255, 226, 180], lightK: 0.7 + 1.1 * dusk, prev: camEp };
    World.runway(ctx, camE, R);

    // 飞机
    const dl = 1 - 0.85 * dusk;
    const env = {
      L: sunDir, sun: [2.2 * dl, 1.2 * dl, 0.55 * dl], skyTop: lin(mixc([26, 38, 108], [4, 8, 36], dusk)), skyMid: lin(mixc([255, 150, 92], [90, 56, 100], dusk)), ground: lin(mixc([200, 120, 100], [40, 30, 50], dusk)),
      amb: shot === 'A' ? 0.1 : 0.4, spec: 0.9, refl: shot === 'A' ? 0.15 : 0.45, rim: [2.2, 1.2, 0.6], rimK: 1.5 * (1 - 0.6 * dusk), exposure: 0.92,
    };
    if (shot === 'C') { env.L = V.norm([-0.3, 0.2, 0.9]); env.sun = [0.35, 0.3, 0.45]; env.rimK = 0; env.amb = 0.5; env.exposure = 0.95; }
    const alt = L.h;
    World.shadow(ctx, camE, pose.pos[0] + 4, 0, 34, 11, 0.4 * clamp(1 - alt / 70) * (1 - dusk * 0.7), 0);
    Concorde.draw(ctx, camE, pose, env, { fog: { color: lin(mixc([240, 160, 110], [60, 40, 80], dusk)), density: 0.0003 } });
    const an = Concorde.anchors(pose);

    // 起落架附近的着陆烟尘（轮胎擦地产生）
    if (t > TD - 0.1 && t < TD + 7) {
      ctx.save();
      for (let tau = TD; tau < Math.min(t, TD + 4.2); tau += 0.045) {
        const age = t - tau;
        const k = Math.pow(Math.max(0, 1 - age / 6), 2) * (1 - ramp(tau, TD + 1.6, TD + 4.2));
        if (k <= 0.004) continue;
        const Lp = landing(tau);
        for (const zs of [-2.7, 2.7]) {
          const wp = Concorde.toWorld(Lp.pose, [-10.17, -4.1, zs]);
          const q = camE.project([wp[0] + 5 * age, 0.4 + 1.6 * age + 0.6 * U.noise1(tau * 9 + zs), wp[2] + zs * 0.5 + 1.4 * age * Math.sign(zs)]);
          if (q[2] < 5) continue;
          const rad = (1.4 + age * 3.0) * camE.f / q[2];
          const col = shot === 'A' ? [255, 214, 160] : mixc([236, 214, 190], [110, 96, 120], dusk);
          gfx.put(ctx, gfx.glow(col[0] | 0, col[1] | 0, col[2] | 0, 0.7), q[0], q[1] - rad * 0.15, Math.min(rad, 900), 0.36 * k, 0.7);
        }
      }
      ctx.restore();
    }

    // 灯光
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    {
      const a = camE.project(an.noseGear);
      if (a[2] > 1) {
        const fwd = an.dirFwd;
        const tipW = [an.noseGear[0] + fwd[0] * 120, Math.max(0.3, an.noseGear[1] + fwd[1] * 120 - 5), an.noseGear[2] + fwd[2] * 120];
        const tip = camE.project(tipW);
        const kk = (shot === 'A' ? 1.0 : 0.38) * (0.3 + 0.7 * dusk);
        if (tip[2] > 1 && shot !== 'A') {
          const g = ctx.createLinearGradient(a[0], a[1], tip[0], tip[1]);
          g.addColorStop(0, `rgba(255,248,230,${0.55 * kk})`); g.addColorStop(1, 'rgba(255,248,230,0)');
          const dx = tip[0] - a[0], dy = tip[1] - a[1], ln = Math.hypot(dx, dy) || 1;
          const w = 30;
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(tip[0] - dy / ln * w, tip[1] + dx / ln * w); ctx.lineTo(tip[0] + dy / ln * w, tip[1] - dx / ln * w); ctx.closePath(); ctx.fill();
        }
        gfx.put(ctx, gfx.glow(255, 246, 228, 1.2), a[0], a[1], clamp(camE.f * 1.0 / a[2], 6, 220), 0.9 * (0.4 + dusk));
        gfx.put(ctx, gfx.glow(255, 255, 255, 1.6), a[0], a[1], clamp(camE.f * 0.3 / a[2], 2, 60), 1);
      }
    }
    ctx.restore();
    World.navLights(ctx, camE, an, T, 1, 0.4 + dusk);
    // 发动机怠速余热
    if (shot !== 'A') {
      const dir = V.scale(an.dirFwd, -1);
      const rev = t > TD && t < TD + 8 ? 0.55 * (1 - ramp(t, TD + 3, TD + 8)) : 0.05;
      for (let i = 0; i < 4; i++) World.flame(ctx, camE, an.nozzles[i], dir, 3.5, 1.0, rev, T, i);
    }

    // 太阳穿越时的镜头光晕
    if (shot === 'A' && info.sun) {
      const pp = camE.project(pose.pos);
      const d = Math.hypot(info.sun.x - pp[0], info.sun.y - pp[1]);
      gfx.lensFlare(ctx, info.sun.x, info.sun.y, 0.75 * (1 - ramp(t, 7.5, 9)) , { size: 1.0 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      gfx.put(ctx, gfx.glow(255, 190, 120, 1.4), info.sun.x, info.sun.y, 500, 0.08 + 0.12 * (1 - smooth(ramp(d, 30, 300))));
      ctx.restore();
    }

    // 镜头切换闪烁
    for (const cut of [TD, 15]) { const dd = t - cut; if (dd >= 0 && dd < 0.2) { ctx.fillStyle = `rgba(255,214,160,${0.45 * (1 - dd / 0.2)})`; ctx.fillRect(0, 0, W, H); } }
    const fi = 1 - ramp(t, 0, 1.4);
    if (fi > 0) { ctx.fillStyle = `rgba(3,10,30,${fi})`; ctx.fillRect(0, 0, W, H); }
    const toNight = ramp(t, 20, 21);
    if (toNight > 0) { ctx.fillStyle = `rgba(2,5,22,${ease.inQuad(toNight)})`; ctx.fillRect(0, 0, W, H); }
  }

  // 片尾：星空与一颗远去的光点
  function endCard(ctx, t, T) {
    gfx.gradV(ctx, 0, H, [[0, '#01030f'], [0.62, '#050b24'], [0.9, '#1a1236'], [1, '#2c1a3a']]);
    const a = smooth(ramp(t, 21, 23));
    gfx.drawStars(ctx, T, a, H, { dx: -t * 2 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    gfx.put(ctx, gfx.glow(255, 130, 70, 1.3), W / 2, H * 0.96, 1300, 0.28 * a, 0.2);
    ctx.restore();
    // 地平线细线
    ctx.fillStyle = `rgba(255,170,110,${0.35 * a})`; ctx.fillRect(0, H * 0.935, W, 1);
    // 远去的光点（沿弧线飞向地平线的暖光）
    const u = ramp(t, 22.4, 29.2);
    if (u > 0 && u < 1) {
      const px = lerp(W * 0.92, W * 0.34, ease.inOutSine(u)), py = lerp(H * 0.2, H * 0.915, Math.pow(u, 1.6));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 46; i++) {
        const uu = u - i * 0.0035; if (uu < 0) break;
        const qx = lerp(W * 0.92, W * 0.34, ease.inOutSine(uu)), qy = lerp(H * 0.2, H * 0.915, Math.pow(uu, 1.6));
        gfx.put(ctx, gfx.glow(255, 190, 130, 1.4), qx, qy, 14 - i * 0.2, 0.22 * (1 - i / 46));
      }
      gfx.put(ctx, gfx.glow(255, 230, 190, 1.4), px, py, 26 * (1 - u * 0.6), 0.9 * (1 - ramp(u, 0.85, 1)));
      gfx.put(ctx, gfx.glow(255, 255, 255, 1.6), px, py, 7 * (1 - u * 0.6), 1 * (1 - ramp(u, 0.85, 1)));
      ctx.restore();
    }
    const fi = 1 - ramp(t, 21, 21.8);
    if (fi > 0) { ctx.fillStyle = `rgba(2,5,22,${fi})`; ctx.fillRect(0, 0, W, H); }
  }

  Film.register({ id: 'end', t0: 174, t1: 204, post: { bloom: 0.36 }, draw: endDraw });
  Film.cue({ kind: 'chapter', t0: 174.8, t1: 178.8, num: 'CHAPTER  VI', zh: '落日', en: 'SUNSET' });
  Film.cue({ t0: 175.4, t1: 182.0, zh: '2003 年 10 月 24 日，最后一班商业航班降落在希思罗机场。', en: '24 OCTOBER 2003  ·  THE LAST COMMERCIAL FLIGHT LANDS AT LONDON HEATHROW', y: 904, type: 3.2, scrim: 0.9, size: 36, fo: 0.9 });
  Film.cue({ t0: 185.2, t1: 190.6, zh: '此后，天空再没有这样的速度。', en: 'AFTER THAT, THE SKY NEVER HELD SUCH SPEED AGAIN', y: 904, type: 1.8, scrim: 0.9 });
  Film.cue({ t0: 192.0, t1: 195.4, zh: '但那条追逐落日的航线，仍在人们心中。', en: 'YET THE ROUTE THAT CHASED THE SUN REMAINS', y: 904, type: 2.0, scrim: 0.9, fo: 0.9, size: 38 });
  Film.cue({ kind: 'big', t0: 196.2, t1: 202.0, zh: '人类曾以两倍音速，追赶落日。', y: 470, size: 62, track: 14, weight: 500, type: 3.2, fi: 1.0, fo: 1.2, glow: { color: 'rgba(255,200,150,0.45)', blur: 26 } });
  Film.cue({ kind: 'big', t0: 198.4, t1: 202.4, zh: '协和 · 逐日', y: 640, size: 104, track: 30, weight: 600, fi: 1.4, fo: 1.3, glow: { color: 'rgba(255,170,90,0.6)', blur: 36 }, en: 'CONCORDE   1976 — 2003', enSize: 24, enTrack: 16, enDy: 70, type: 1.8 });
  Film.cue({ t0: 200.6, t1: 203.4, zh: '全部画面与声音，均由代码实时生成', en: 'CANVAS 2D  ×  WEBAUDIO  —  NO ASSETS', y: 984 - 30, size: 20, family: 'sans', weight: 400, track: 6, noScrim: true, fi: 0.8, fo: 0.8 });
  Film.typing.push({ t0: 175.4, n: 27, cps: 8.5, kind: 'soft' }, { t0: 185.2, n: 14, cps: 8, kind: 'soft' }, { t0: 192.0, n: 18, cps: 9, kind: 'soft' }, { t0: 196.2, n: 14, cps: 4.4, kind: 'soft' }, { t0: 198.4, n: 6, cps: 3.3, kind: 'soft' });
  Film.landing = { landing };
})(typeof window !== 'undefined' ? window : globalThis);
