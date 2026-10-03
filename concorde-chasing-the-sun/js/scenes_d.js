/* 协和逐日 · 第四幕「逐日」（84–150 s）：舷窗 · 追日 · 倒走的时钟 · 穿过落日 */
(function (G) {
  'use strict';
  const { W, H, BAR } = gfx;
  const { clamp, lerp, smooth, ramp, ease, V, TAU, fbm } = U;
  const D2R = Math.PI / 180;
  const lin = (c) => c.map((v) => Math.pow(v / 255, 2.2));

  // ---------------------------------------------------------------- 日落高空的天空
  const SUNSKY = {
    zenith: [3, 8, 40], mid: [22, 32, 100], low: [140, 80, 134], horizon: [255, 148, 74], topEl: 0.55,
    sunVis: 1, sunR: 1.8, sunWarm: 0.9, band: [255, 140, 60], bandK: 0.42, stars: 0.55,
  };
  const BASE_SUN = [[56, 36, 74], [220, 120, 90]];

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }

  function skyParams(P, camx, sunDir, T, extra) {
    return Object.assign({
      sky: SUNSKY, sunDir, time: T, pal: 'gold', light: 1,
      haze: [244, 150, 110], base: BASE_SUN, limb: [255, 150, 90], limbK: 0.9, limbEdge: [255, 210, 160], sag: 18, hazeK: 0.8,
      size: 8000, hazeD: 70000, span: 190000, lat: 110000, glint: [255, 170, 90], glintK: 0.55,
    }, extra || {});
  }

  // ======================================================================
  // 4a  舷窗（84–102 s）
  // ======================================================================
  const camW = new Concorde.Camera(W, H);
  const WIN = { cx: 1000, cy: 500, w: 430, h: 590, r: 205 };

  function drawFlute(ctx, x, y, t, k) {
    // 香槟杯：y 为杯脚底部
    ctx.save();
    ctx.translate(x, y);
    // 杯脚与底座
    const stem = ctx.createLinearGradient(-30, 0, 30, 0);
    stem.addColorStop(0, 'rgba(255,230,190,0.5)'); stem.addColorStop(0.5, 'rgba(255,255,255,0.16)'); stem.addColorStop(1, 'rgba(255,200,140,0.18)');
    ctx.fillStyle = stem;
    ctx.beginPath(); ctx.ellipse(0, 0, 44, 8, 0, 0, TAU); ctx.fill();
    ctx.fillRect(-3, -96, 6, 96);
    // 杯身
    const body = new Path2D();
    body.moveTo(-26, -96); body.bezierCurveTo(-40, -150, -34, -230, -22, -300); body.lineTo(22, -300);
    body.bezierCurveTo(34, -230, 40, -150, 26, -96); body.bezierCurveTo(14, -88, -14, -88, -26, -96);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill(body);
    ctx.save(); ctx.clip(body);
    const liq = ctx.createLinearGradient(0, -280, 0, -96);
    liq.addColorStop(0, 'rgba(255,222,140,0.55)'); liq.addColorStop(1, 'rgba(240,160,70,0.7)');
    ctx.fillStyle = liq; ctx.fillRect(-50, -268, 100, 180);
    // 气泡
    for (let i = 0; i < 16; i++) {
      const sp = 26 + (i * 7) % 19, ph = (i * 0.137) % 1;
      const yy = -96 - ((t * sp + ph * 180) % 172);
      const xx = Math.sin(i * 2.3 + t * 1.3) * (8 + (i % 4) * 3) + ((i % 5) - 2) * 3;
      ctx.fillStyle = `rgba(255,248,220,${0.5 * (1 - (-96 - yy) / 172)})`;
      ctx.beginPath(); ctx.arc(xx, yy, 1.2 + (i % 3) * 0.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // 高光
    ctx.strokeStyle = 'rgba(255,240,210,0.7)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-27, -150); ctx.bezierCurveTo(-32, -200, -28, -250, -19, -292); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,140,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(24, -150); ctx.bezierCurveTo(31, -200, 28, -250, 20, -292); ctx.stroke();
    // 杯沿
    ctx.strokeStyle = 'rgba(255,245,225,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -300, 22, 4.2, 0, 0, TAU); ctx.stroke();
    // 暖光掠过
    ctx.globalCompositeOperation = 'lighter';
    gfx.put(ctx, gfx.glow(255, 170, 80, 1.2), -26, -210, 70, 0.55 * k);
    ctx.restore();
  }

  function machMeter(ctx, T, x, y, a, M, alt, oat) {
    ctx.save(); ctx.globalAlpha = a;
    // 面板
    const g = ctx.createLinearGradient(0, y, 0, y + 150);
    g.addColorStop(0, '#16141a'); g.addColorStop(1, '#09080b');
    ctx.fillStyle = g; rrect(ctx, x, y, 330, 150, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(210,190,160,0.45)'; ctx.lineWidth = 3; rrect(ctx, x, y, 330, 150, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; rrect(ctx, x + 5, y + 5, 320, 140, 7); ctx.stroke();
    ctx.restore();
    const flick = 0.92 + 0.08 * Math.sin(T * 17);
    const col = `rgba(255,150,40,${a * flick})`;
    gfx.text(ctx, 'MACH', x + 22, y + 34, { size: 14, family: 'mono', color: `rgba(255,170,80,${a * 0.8})`, track: 6 });
    gfx.text(ctx, M.toFixed(2), x + 22, y + 92, { size: 62, family: 'mono', weight: 700, color: col, track: 3, glow: { color: 'rgba(255,120,20,0.9)', blur: 14 } });
    gfx.text(ctx, 'ALT', x + 226, y + 34, { size: 14, family: 'mono', color: `rgba(255,170,80,${a * 0.8})`, track: 5 });
    gfx.text(ctx, alt, x + 226, y + 62, { size: 22, family: 'mono', weight: 700, color: col, track: 1, glow: { color: 'rgba(255,120,20,0.8)', blur: 10 } });
    gfx.text(ctx, 'OAT', x + 226, y + 96, { size: 14, family: 'mono', color: `rgba(255,170,80,${a * 0.8})`, track: 5 });
    gfx.text(ctx, oat, x + 226, y + 124, { size: 22, family: 'mono', weight: 700, color: col, track: 1, glow: { color: 'rgba(255,120,20,0.8)', blur: 10 } });
    gfx.text(ctx, 'SUPERSONIC', x + 22, y + 130, { size: 11, family: 'mono', color: `rgba(255,170,80,${a * 0.6})`, track: 5 });
  }

  function porthole(ctx, t, T) {
    // 轻微的机舱摇晃
    const sx = Math.sin(t * 0.9) * 1.6 + Math.sin(t * 2.3) * 0.5, sy = Math.sin(t * 1.3 + 1) * 1.1;
    ctx.save();
    ctx.translate(sx, sy);
    const push = 1 + 0.035 * (t / 18);
    ctx.translate(WIN.cx, WIN.cy); ctx.scale(push, push); ctx.translate(-WIN.cx, -WIN.cy);

    // —— 舱壁 ——
    const wall = ctx.createLinearGradient(0, 0, W, 0);
    wall.addColorStop(0, '#120f12'); wall.addColorStop(0.28, '#2b2326'); wall.addColorStop(0.5, '#3a2e2c'); wall.addColorStop(0.72, '#2a2225'); wall.addColorStop(1, '#0f0c0f');
    ctx.fillStyle = wall; ctx.fillRect(-40, -40, W + 80, H + 80);
    // 壁板接缝
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
    for (const x of [262, 1744]) { ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, H + 40); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,225,190,0.06)'; ctx.lineWidth = 1.5;
    for (const x of [265, 1747]) { ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, H + 40); ctx.stroke(); }
    // 纹理：微弱的织物纹
    ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#fff';
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 1);
    ctx.restore();

    // —— 窗外景色 ——
    const eyeY = 0;
    const t2 = t + 0.0;
    const ox = 900000 + t2 * 520; // 沿航向前进
    const dir = V.norm([0.5, -0.045 - 0.004 * t, 0.86]);
    camW.lookAt([ox, eyeY, 0], [ox + dir[0], eyeY + dir[1], dir[2]], Math.sin(t * 0.37) * 0.012, 50);
    camW.cx = WIN.cx; camW.cy = WIN.cy + 40; camW.f = 640;
    const sunDir = V.norm([0.72, 0.012 - 0.0005 * t, 0.69]);

    ctx.save();
    rrect(ctx, WIN.cx - WIN.w / 2, WIN.cy - WIN.h / 2, WIN.w, WIN.h, WIN.r); ctx.clip();
    const info = World.highAlt(ctx, camW, skyParams(null, null, sunDir, T, { deckY: -9800, originX: ox, light: 1, size: 7000, density: 0.85, sag: 12, squash: 0.5 }));
    // 云面金色反光
    // 玻璃：内部边缘暗角 + 太阳眩光
    const sunP = camW.project([camW.eye[0] + sunDir[0] * 9000, camW.eye[1] + sunDir[1] * 9000, camW.eye[2] + sunDir[2] * 9000]);
    ctx.globalCompositeOperation = 'lighter';
    if (sunP[2] > 0) {
      gfx.put(ctx, gfx.glow(255, 170, 80, 1.1), sunP[0], sunP[1], 420, 0.55 + 0.3 * smooth(ramp(t, 14, 18)));
      gfx.put(ctx, gfx.glow(255, 245, 220, 1.3), sunP[0], sunP[1], 160, 0.9);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 玻璃斜向反光
    const rf = ctx.createLinearGradient(WIN.cx - 260, WIN.cy - 300, WIN.cx + 60, WIN.cy + 300);
    rf.addColorStop(0, 'rgba(255,255,255,0)'); rf.addColorStop(0.42, 'rgba(255,255,255,0.0)'); rf.addColorStop(0.5, 'rgba(255,240,220,0.09)'); rf.addColorStop(0.58, 'rgba(255,255,255,0)'); rf.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rf; ctx.fillRect(WIN.cx - 300, WIN.cy - 330, 600, 660);
    // 边缘压暗 (舷窗内壁)
    const vg = ctx.createRadialGradient(WIN.cx, WIN.cy, WIN.h * 0.2, WIN.cx, WIN.cy, WIN.h * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg; ctx.fillRect(WIN.cx - 300, WIN.cy - 330, 600, 660);
    // 微尘
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const px = WIN.cx + (U.hash1(i * 3.1) - 0.5) * WIN.w * 0.9, py = WIN.cy + (U.hash1(i * 7.7) - 0.5) * WIN.h * 0.9;
      gfx.put(ctx, gfx.glow(255, 220, 170, 1.4), px, py, 1.5 + U.hash1(i) * 2.5, 0.22 * (0.5 + 0.5 * Math.sin(T * 0.7 + i)));
    }
    ctx.restore();

    // 窗框：多层高光/阴影
    const bx = WIN.cx - WIN.w / 2, by = WIN.cy - WIN.h / 2;
    for (let i = 0; i < 4; i++) {
      const g = ctx.createLinearGradient(bx, by, bx + WIN.w, by + WIN.h);
      g.addColorStop(0, `rgba(235,215,185,${0.55 - i * 0.1})`); g.addColorStop(0.5, `rgba(90,70,60,${0.5})`); g.addColorStop(1, `rgba(20,14,14,${0.8})`);
      ctx.strokeStyle = g; ctx.lineWidth = 12 - i * 2.4;
      rrect(ctx, bx - 6 - i * 7, by - 6 - i * 7, WIN.w + 12 + i * 14, WIN.h + 12 + i * 14, WIN.r + 6 + i * 7); ctx.stroke();
    }
    // 窗框外的暖色光溢
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const spill = ctx.createRadialGradient(WIN.cx, WIN.cy, WIN.h * 0.45, WIN.cx, WIN.cy, 700);
    spill.addColorStop(0, 'rgba(255,150,70,0.20)'); spill.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = spill; ctx.fillRect(0, 0, W, H);
    // 光斑投到壁板/座椅上（随时间缓慢移动）
    const shift = Math.sin(t * 0.25) * 30;
    const beam = ctx.createLinearGradient(WIN.cx - 160, WIN.cy + 300, WIN.cx - 760 + shift, H);
    beam.addColorStop(0, 'rgba(255,170,90,0.20)'); beam.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(WIN.cx - 190, WIN.cy + 280); ctx.lineTo(WIN.cx + 20, WIN.cy + 280); ctx.lineTo(WIN.cx - 480 + shift, H + 20); ctx.lineTo(WIN.cx - 900 + shift, H + 20); ctx.closePath(); ctx.fill();
    ctx.restore();

    // 前景：座椅头枕剪影
    ctx.save();
    const seat = ctx.createLinearGradient(0, 0, 360, 0);
    seat.addColorStop(0, '#050405'); seat.addColorStop(1, '#171114');
    ctx.fillStyle = seat;
    rrect(ctx, -140, 380, 440, 800, 120); ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,100,0.35)'; ctx.lineWidth = 2.5; rrect(ctx, -140, 380, 440, 800, 120); ctx.stroke();
    ctx.restore();
    // 小桌板与香槟杯（右下）
    ctx.save();
    const tray = ctx.createLinearGradient(0, 840, 0, 940);
    tray.addColorStop(0, 'rgba(70,56,52,0.96)'); tray.addColorStop(1, 'rgba(20,16,18,1)');
    ctx.fillStyle = tray;
    ctx.beginPath(); ctx.moveTo(1180, 905); ctx.lineTo(1880, 905); ctx.lineTo(1960, 1100); ctx.lineTo(1100, 1100); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,120,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1180, 905); ctx.lineTo(1880, 905); ctx.stroke();
    ctx.restore();
    drawFlute(ctx, 1450, 936, T, 0.6 + 0.4 * smooth(ramp(t, 6, 14)));
    ctx.restore(); // translate/scale

    // 马赫表（固定在舱壁，不随摇晃）
    const ma = smooth(ramp(t, 1.4, 2.8));
    const M = 2.02 + 0.015 * Math.sin(t * 0.8);
    machMeter(ctx, T, 1450, BAR + 76, ma, M, `${Math.round(58000 + 40 * Math.sin(t * 0.5)).toLocaleString('en-US')}`, '-57');

    // 进出场
    const fin = 1 - ramp(t, 0, 1.4);
    if (fin > 0) { ctx.fillStyle = `rgba(4,18,52,${fin})`; ctx.fillRect(0, 0, W, H); }
    const wo = ramp(t, 15.8, 18);
    if (wo > 0) { ctx.fillStyle = `rgba(255,200,130,${ease.inQuad(wo)})`; ctx.fillRect(0, 0, W, H); }
  }

  Film.register({ id: 'porthole', t0: 84, t1: 102, post: { bloom: 0.5, vignette: 1 }, draw: porthole });
  Film.cue({ kind: 'chapter', t0: 84.8, t1: 89.6, num: 'CHAPTER  IV', zh: '逐日', en: 'CHASING THE SUN' });
  Film.cue({ t0: 86.4, t1: 91.6, zh: '舷窗外，是一万八千米的高空。', en: 'OUTSIDE THE WINDOW  ·  18,000 METRES', y: 904, type: 1.7, scrim: 0.9 });
  Film.cue({ t0: 92.2, t1: 97.6, zh: '天空是深蓝色的，地平线微微弯曲。', en: 'THE SKY TURNS DEEP BLUE  ·  THE HORIZON BEGINS TO BEND', y: 904, type: 2.0, scrim: 0.9 });
  Film.cue({ t0: 98.2, t1: 101.8, zh: '而太阳，就停在窗边。', en: 'AND THE SUN HANGS BESIDE YOU', y: 904, type: 1.3, scrim: 0.9, fo: 0.5 });
  Film.typing.push({ t0: 86.4, n: 14, cps: 8.5, kind: 'soft' }, { t0: 92.2, n: 16, cps: 8, kind: 'soft' }, { t0: 98.2, n: 10, cps: 7.5, kind: 'soft' });

  // ======================================================================
  // 4b  追日（102–126 s）
  // ======================================================================
  const camC = new Concorde.Camera(W, H);
  const SUN_B = V.norm([1, 0.028, 0.14]);
  const ENV_B = { L: SUN_B, sun: [1.7, 0.95, 0.46], skyTop: lin([26, 40, 118]), skyMid: lin([255, 140, 90]), ground: lin([200, 120, 100]), amb: 0.3, spec: 0.9, refl: 0.5, rim: [2.0, 1.1, 0.55], rimK: 1.0, exposure: 0.84 };
  const PLANE_B = { pos: [0, 0, 0], yaw: 0, pitch: 0.012, roll: 0, droop: 0, gear: 0 };

  function chase(ctx, t, T) {
    const base = 1.2e6;
    const ox = base + t * 560;
    const pose = Object.assign({}, PLANE_B, { pos: [ox, 0, 0], roll: Math.sin(t * 0.33) * 0.03 });
    const u = ease.inOutSine(clamp(t / 24));
    const phi = lerp(196, 322, u) * D2R;
    const el = lerp(9, 2.5, u) * D2R;
    const dist = lerp(92, 148, Math.sin(u * Math.PI * 0.5)) - 18 * Math.sin(u * Math.PI);
    const eye = [ox + dist * Math.cos(el) * Math.cos(phi), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(phi)];
    camC.lookAt(eye, [ox + 12 + 6 * u, 1.5, 0], 0, lerp(34, 30, u));
    const sunDirNow = SUN_B;
    const P = skyParams(null, null, sunDirNow, T, { deckY: -9400, originX: ox, light: (V.dot(sunDirNow, camC.right) > 0 ? 1 : -1), density: 0.9, squash: 0.45 });
    const info = World.highAlt(ctx, camC, P);
    if (info.sun) {
      // 太阳光芒
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      gfx.put(ctx, gfx.glow(255, 150, 70, 1.3), info.sun.x, info.sun.y, 800, 0.07, 0.5);
      ctx.restore();
    }
    const an = Concorde.anchors(pose);
    // 远景气流线
    const planeDepth = camC.project(pose.pos)[2];
    const streak = { origin: pose.pos, dist: t * 500, len: 60, n: 90, box: [1500, 420, 700], alpha: 0.14, planeDepth };
    World.streaks(ctx, camC, Object.assign({ pass: 'far' }, streak));
    Concorde.draw(ctx, camC, pose, ENV_B, { fog: { color: lin([244, 150, 110]), density: 0.00018 } });
    World.streaks(ctx, camC, Object.assign({ pass: 'near' }, streak));
    World.navLights(ctx, camC, an, T, 1, 1);
    if (info.sun) gfx.lensFlare(ctx, info.sun.x, info.sun.y, 0.8 * (info.sun.x > -200 && info.sun.x < W + 200 ? 1 : 0), { size: 1.0 });
    // 进场白光 / 出场
    const fi = 1 - ramp(t, 0, 1.0);
    if (fi > 0) { ctx.fillStyle = `rgba(255,200,130,${fi})`; ctx.fillRect(0, 0, W, H); }
  }
  Film.register({ id: 'chase', t0: 102, t1: 126, post: { bloom: 0.5 }, draw: chase });
  Film.cue({ kind: 'hud', t0: 103.5, t1: 125, fi: 1.2, fo: 1.0, rows: (T) => [['MACH', (2.02 + 0.012 * Math.sin(T * 0.7)).toFixed(2)], ['SPEED', '2,179 km/h'], ['ALT', '18,300 m'], ['NOSE', `${Math.round(125 + 2 * Math.sin(T * 0.4))} °C`]] });
  Film.cue({ t0: 103.4, t1: 109.2, zh: '地球自转，在伦敦的纬度，约每小时 1,040 公里。', en: 'THE EARTH TURNS AT ABOUT 1,040 KM/H BENEATH LONDON', y: 904, type: 2.4, scrim: 0.9, size: 38 });
  Film.cue({ t0: 109.9, t1: 115.0, zh: '协和，每小时 2,179 公里。', en: 'CONCORDE FLIES AT 2,179 KM/H', y: 904, type: 1.6, scrim: 0.9 });
  Film.cue({ t0: 115.7, t1: 120.8, zh: '向西飞去，它追上了落日。', en: 'FLYING WEST, IT CATCHES THE SETTING SUN', y: 904, type: 1.6, scrim: 0.9 });
  Film.cue({ t0: 121.4, t1: 125.4, zh: '夕阳，仿佛停在了地平线上。', en: 'THE SUNSET SEEMS TO STAND STILL', y: 904, type: 1.6, scrim: 0.9, fo: 0.8 });
  Film.typing.push({ t0: 103.4, n: 22, cps: 9.5, kind: 'soft' }, { t0: 109.9, n: 13, cps: 8.5, kind: 'soft' }, { t0: 115.7, n: 12, cps: 7.5, kind: 'soft' }, { t0: 121.4, n: 13, cps: 8, kind: 'soft' });

  // ======================================================================
  // 4c  倒走的时钟（126–138 s）
  // ======================================================================
  const RACE = { t0: 126 };
  const RACE_U0 = 2.8, RACE_U1 = 9.6; // 局部秒：飞行进度从 0 到 1
  const raceU = (t) => ease.inOutSine(ramp(t, RACE_U0, RACE_U1));
  Film.race = { U0: RACE.t0 + RACE_U0, U1: RACE.t0 + RACE_U1, u: (T) => raceU(T - RACE.t0) };

  function fmtClock(h) {
    h = ((h % 24) + 24) % 24;
    let hh = Math.floor(h + 1e-6), mm = Math.round((h - hh) * 60);
    if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function race(ctx, t, T) {
    // 背景：深海军蓝 + 星 + 极淡的地平线暖光
    gfx.gradV(ctx, 0, H, [[0, '#030a1e'], [0.7, '#081a3c'], [1, '#2a1a3a']]);
    gfx.drawStars(ctx, T, 0.9 * ramp(t, 0, 1.5), H, {});
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    gfx.put(ctx, gfx.glow(255, 130, 60, 1.2), W * 0.5, H + 140, 1200, 0.35, 0.3);
    ctx.restore();
    const u = raceU(t);
    const fadeIn = smooth(ramp(t, 0, 1.2));

    // —— 左：时钟 ——
    const cx = 520, cy = 470, R = 222;
    ctx.save(); ctx.globalAlpha = fadeIn;
    const dial = ctx.createRadialGradient(cx - 40, cy - 60, 10, cx, cy, R);
    dial.addColorStop(0, 'rgba(26,52,100,0.92)'); dial.addColorStop(1, 'rgba(6,14,36,0.95)');
    ctx.fillStyle = dial; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,214,150,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(160,215,255,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, R - 14, 0, TAU); ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2, major = i % 5 === 0;
      const r0 = R - (major ? 38 : 26), r1 = R - 14;
      ctx.strokeStyle = major ? 'rgba(255,224,170,0.95)' : 'rgba(160,215,255,0.45)'; ctx.lineWidth = major ? 3 : 1.2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
    for (const n of [12, 3, 6, 9]) {
      const a = (n / 12) * TAU - Math.PI / 2;
      gfx.text(ctx, String(n), cx + Math.cos(a) * (R - 64), cy + Math.sin(a) * (R - 64) + 11, { size: 32, family: 'serif', weight: 500, color: 'rgba(255,236,205,0.95)', align: 'center', alpha: fadeIn });
    }
    // 当地太阳时：10:30 → 09:00（倒着走）
    const localH = 10.5 - 1.5 * u;
    const ha = ((localH % 12) / 12) * TAU - Math.PI / 2, ma = ((localH * 60) % 60) / 60 * TAU - Math.PI / 2;
    ctx.save(); ctx.globalAlpha = fadeIn; ctx.lineCap = 'round';
    // 光晕
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,170,80,0.28)'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * 120, cy + Math.sin(ha) * 120); ctx.stroke();
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * 176, cy + Math.sin(ma) * 176); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffe2b0'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(cx - Math.cos(ha) * 22, cy - Math.sin(ha) * 22); ctx.lineTo(cx + Math.cos(ha) * 128, cy + Math.sin(ha) * 128); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - Math.cos(ma) * 28, cy - Math.sin(ma) * 28); ctx.lineTo(cx + Math.cos(ma) * 188, cy + Math.sin(ma) * 188); ctx.stroke();
    ctx.fillStyle = '#ffb060'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, TAU); ctx.fill();
    // 逆时针箭头标记
    const arcA = 0.12 + 1.15 * u;
    ctx.strokeStyle = 'rgba(255,150,100,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R + 24, -Math.PI / 2 - 0.2, -Math.PI / 2 - 0.2 - arcA, true); ctx.stroke();
    const ea = -Math.PI / 2 - 0.2 - arcA;
    ctx.fillStyle = 'rgba(255,150,100,0.95)';
    ctx.save(); ctx.translate(cx + Math.cos(ea) * (R + 24), cy + Math.sin(ea) * (R + 24)); ctx.rotate(ea - Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(-11, 10); ctx.lineTo(11, 10); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
    gfx.text(ctx, fmtClock(localH), cx, cy + R + 96, { size: 70, family: 'mono', weight: 500, color: '#fff', align: 'center', track: 6, alpha: fadeIn });
    gfx.text(ctx, '飞机所在位置的当地太阳时', cx, cy + R + 134, { size: 18, family: 'sans', color: 'rgba(255,214,150,0.9)', align: 'center', track: 5, alpha: fadeIn });

    // —— 右：航程对比 ——
    const x0 = 1020, x1 = 1760, y1 = 420, y2 = 560;
    gfx.text(ctx, 'LONDON', x0, y1 - 78, { size: 20, family: 'mono', color: 'rgba(255,224,170,0.95)', track: 6, alpha: fadeIn });
    gfx.text(ctx, 'NEW YORK', x1, y1 - 78, { size: 20, family: 'mono', color: 'rgba(255,224,170,0.95)', track: 6, align: 'right', alpha: fadeIn });
    gfx.text(ctx, '5,570 km', (x0 + x1) / 2, y1 - 78, { size: 16, family: 'mono', color: 'rgba(160,215,255,0.9)', track: 5, align: 'center', alpha: fadeIn });
    const planeFrac = u, sunFrac = u * (1040 / 2179);
    for (const [y, frac, label, sub, col, isSun] of [[y1, sunFrac, '太阳 · 地面推进', '1,040 km/h', [255, 200, 110], true], [y2, planeFrac, '协和', '2,179 km/h', [190, 230, 255], false]]) {
      ctx.save(); ctx.globalAlpha = fadeIn;
      ctx.strokeStyle = 'rgba(160,215,255,0.28)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 8]);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
      const px = lerp(x0, x1, frac);
      const g = ctx.createLinearGradient(x0, 0, px, 0); g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0)`); g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0.9)`);
      ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(px, y); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      gfx.put(ctx, gfx.glow(col[0], col[1], col[2], 1.2), px, y, isSun ? 70 : 54, 0.8 * fadeIn);
      ctx.restore();
      if (isSun) {
        ctx.fillStyle = `rgba(255,236,190,${fadeIn})`; ctx.beginPath(); ctx.arc(px, y, 13, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,214,150,${0.8 * fadeIn})`; ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + T * 0.4; ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 19, y + Math.sin(a) * 19); ctx.lineTo(px + Math.cos(a) * 27, y + Math.sin(a) * 27); ctx.stroke(); }
      } else {
        // 三角翼图标
        ctx.save(); ctx.translate(px, y); ctx.fillStyle = `rgba(255,255,255,${fadeIn})`;
        ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-14, -15); ctx.lineTo(-8, 0); ctx.lineTo(-14, 15); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      gfx.text(ctx, label, x0, y + 46, { size: 24, family: 'sans', weight: 500, color: '#fff', track: 4, alpha: fadeIn });
      gfx.text(ctx, sub, x1, y + 46, { size: 22, family: 'mono', color: `rgba(${col[0]},${col[1]},${col[2]},1)`, track: 3, align: 'right', alpha: fadeIn });
    }
    // 读数
    const elapsedMin = Math.round(210 * u);
    gfx.text(ctx, 'FLIGHT TIME', x0, 700, { size: 14, family: 'mono', color: 'rgba(160,215,255,0.9)', track: 5, alpha: fadeIn });
    gfx.text(ctx, `+${Math.floor(elapsedMin / 60)}:${String(elapsedMin % 60).padStart(2, '0')}`, x0, 760, { size: 60, family: 'mono', color: '#fff', track: 4, alpha: fadeIn });
    gfx.text(ctx, 'CLOCK SHIFT', x0 + 340, 700, { size: 14, family: 'mono', color: 'rgba(255,214,150,0.95)', track: 5, alpha: fadeIn });
    const shift = -90 * u; // 分钟
    const sm = Math.round(Math.abs(shift));
    gfx.text(ctx, `${shift <= -0.5 ? '−' : ''}${Math.floor(sm / 60)}:${String(sm % 60).padStart(2, '0')}`, x0 + 340, 760, { size: 60, family: 'mono', color: shift < -0.5 ? '#ffb070' : '#fff', track: 4, alpha: fadeIn, glow: shift < -45 ? { color: 'rgba(255,140,60,0.7)', blur: 22 } : undefined });
    // 到达后的强调
    const done = smooth(ramp(t, RACE_U1 - 0.2, RACE_U1 + 0.8));
    if (done > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      gfx.put(ctx, gfx.glow(255, 150, 70, 1.2), cx, cy, 520 + 30 * Math.sin(T * 3), 0.2 * done);
      ctx.restore();
    }
    const out = ramp(t, 11.0, 12);
    if (out > 0) { ctx.fillStyle = `rgba(255,190,110,${ease.inQuad(out)})`; ctx.fillRect(0, 0, W, H); }
    const fi = 1 - ramp(t, 0, 0.5);
    if (fi > 0) { ctx.fillStyle = `rgba(255,190,110,${fi})`; ctx.fillRect(0, 0, W, H); }
  }
  Film.register({ id: 'race', t0: 126, t1: 138, post: { bloom: 0.45 }, draw: race });
  Film.cue({ t0: 126.9, t1: 130.8, zh: '伦敦，上午 10:30，起飞。', en: 'LONDON  ·  10:30  ·  DEPARTURE', y: 904, type: 1.5, scrim: 0.8 });
  Film.cue({ t0: 131.3, t1: 135.3, zh: '三个半小时后，纽约当地时间——', en: '3 HOURS 30 MINUTES LATER, NEW YORK LOCAL TIME', y: 904, type: 1.6, scrim: 0.8 });
  Film.cue({ t0: 135.9, t1: 137.9, zh: '09:00。比起飞，还早。', en: '09:00  ·  BEFORE YOU LEFT', y: 904, type: 0.9, scrim: 0.8, fo: 0.4 });
  Film.typing.push({ t0: 126.9, n: 12, cps: 8.5, kind: 'soft' }, { t0: 131.3, n: 15, cps: 9, kind: 'soft' }, { t0: 135.9, n: 11, cps: 12, kind: 'soft' });

  // ======================================================================
  // 4d  穿过落日 · 标题（138–150 s）
  // ======================================================================
  const camK = new Concorde.Camera(W, H);
  const SUN_K = V.norm([0, Math.tan(1.9 * D2R), 1]);
  const ENV_K = { L: SUN_K, sun: [3.0, 1.6, 0.7], skyTop: lin([20, 32, 100]), skyMid: lin([255, 140, 80]), ground: lin([240, 130, 90]), amb: 0.07, spec: 0.8, refl: 0.12, rim: [2.4, 1.3, 0.6], rimK: 1.5, exposure: 0.9 };
  const SUNSKY_K = Object.assign({}, SUNSKY, { sunR: 3.3, bandK: 0.5 });

  function rays(ctx, x, y, t, k) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const N = 34;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + t * 0.015;
      const n = fbm(i * 1.7, 3.3, 3);
      const w = 0.012 + 0.018 * n, len = 1900;
      const al = k * (0.03 + 0.1 * n * n) * (0.5 + 0.5 * Math.sin(t * 0.4 + i));
      const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.addColorStop(0, `rgba(255,190,110,${al})`); g.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len); ctx.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function climax(ctx, t, T) {
    const zoom = 1 + 0.02 * (t / 12);
    camK.lookAt([0, 0, 0], [0, 22, 400], 0, 32 / zoom);
    const ox = 1.6e6 + t * 380;
    const P = skyParams(null, null, SUN_K, T, { sky: SUNSKY_K, deckY: -9600, originX: ox, light: 1, density: 0.95, squash: 0.42, glintK: 0.9, sag: 20 });
    const info = World.highAlt(ctx, camK, P);
    const sun = info.sun;
    if (sun) {
      rays(ctx, sun.x, sun.y, T, 1.0);
    }
    // 飞机穿过太阳
    const v = 38;
    const dz = 380;
    const xw = -270 + v * (t - 0.4);
    const sunPt = [SUN_K[0] * dz / SUN_K[2], SUN_K[1] * dz / SUN_K[2], dz];
    const pose = { pos: [xw, sunPt[1] - 0.5, dz], yaw: Math.PI, pitch: 0.02, roll: -0.09 + Math.sin(t * 0.5) * 0.02, droop: 0, gear: 0 };
    const an = Concorde.anchors(pose);
    // 尾迹：金色蒸汽尾
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let tau = 0.15; tau < 13; tau += 0.12) {
      const pxw = xw + v * tau; // 飞机朝 -X 飞，尾迹在 +X
      const k0 = ramp(tau, 0, 0.8) * (1 - ramp(tau, 6, 13));
      if (k0 <= 0) continue;
      for (const zc of [-1.1, 1.1]) {
        const p = camK.project([pxw, pose.pos[1] - 0.9 + 0.5 * zc, dz]);
        if (p[2] < 5) continue;
        const rad = (1.6 + tau * 1.5) * camK.f / p[2];
        gfx.put(ctx, gfx.glow(255, 190, 120, 1.3), p[0], p[1] + (zc > 0 ? 3 : -3), rad, 0.14 * k0, 0.5);
      }
    }
    ctx.restore();
    Concorde.draw(ctx, camK, pose, ENV_K, {});
    World.navLights(ctx, camK, an, T, 0.9, 1);
    // 过日面时太阳亮度被挡，边缘闪光
    if (sun) {
      const d = Math.hypot(sun.x - camK.project(pose.pos)[0], sun.y - camK.project(pose.pos)[1]);
      const eclipse = 1 - smooth(ramp(d, 40, 380));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      gfx.put(ctx, gfx.glow(255, 214, 160, 1.4), sun.x, sun.y, 600, 0.06 + 0.1 * eclipse);
      ctx.restore();
      gfx.lensFlare(ctx, sun.x, sun.y, 0.7 + 0.3 * eclipse, { size: 1.15 });
    }
    // 标题的背景暗化
    const tt = smooth(ramp(t, 0.6, 2.4));
    ctx.save();
    const tg = ctx.createLinearGradient(0, BAR, 0, BAR + 520);
    tg.addColorStop(0, `rgba(2,6,30,${0.55 * tt})`); tg.addColorStop(1, 'rgba(2,6,30,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, BAR, W, 520);
    ctx.restore();

    const fi = 1 - ramp(t, 0, 0.6);
    if (fi > 0) { ctx.fillStyle = `rgba(255,190,110,${fi})`; ctx.fillRect(0, 0, W, H); }
    const out = ramp(t, 10.6, 12);
    if (out > 0) { ctx.fillStyle = `rgba(3,10,30,${ease.inQuad(out)})`; ctx.fillRect(0, 0, W, H); }
  }
  Film.register({ id: 'climax', t0: 138, t1: 150, post: { bloom: 0.4 }, draw: climax });
  Film.cue({ kind: 'big', t0: 139.2, t1: 148.2, zh: '协和 · 逐日', y: 330, size: 156, track: 34, weight: 600, fi: 1.6, fo: 1.4, glow: { color: 'rgba(255,170,90,0.7)', blur: 46 }, en: 'CONCORDE   ·   CHASING THE SUN', enSize: 26, enTrack: 16, enDy: 78, type: 2.6 });
  Film.cue({ t0: 143.4, t1: 148.4, zh: '人类，曾以两倍音速，追赶落日。', en: 'WE ONCE FLEW TWICE AS FAST AS SOUND, AFTER THE SETTING SUN', y: 904, type: 2.2, scrim: 0.9, fo: 1.0, size: 38 });
  Film.typing.push({ t0: 139.2, n: 6, cps: 2.4, kind: 'soft' }, { t0: 143.4, n: 15, cps: 6.8, kind: 'soft' });
})(typeof window !== 'undefined' ? window : globalThis);
