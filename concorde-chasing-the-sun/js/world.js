/* 协和逐日 · 环境：天空穹顶、远山、地面与跑道、灯光、尾焰、云海 */
(function (G) {
  'use strict';
  const { W, H } = gfx;
  const { clamp, lerp, TAU, smooth, mixc, rng } = U;
  const NEAR = 0.6;

  const World = {};

  /** 相机的地平线屏幕 y（假设无滚转） */
  World.horizonY = function (cam) {
    const fy = clamp(cam.fwd[1], -0.9999, 0.9999);
    return cam.cy + cam.f * (fy / Math.sqrt(1 - fy * fy));
  };
  World.yaw = (cam) => Math.atan2(cam.fwd[2], cam.fwd[0]);

  /** 把世界多边形做近裁剪并投影为屏幕点；返回 null 表示全部在相机后方 */
  World.clipProject = function (cam, pts) {
    const cs = pts.map((p) => {
      const dx = p[0] - cam.eye[0], dy = p[1] - cam.eye[1], dz = p[2] - cam.eye[2];
      return [dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2], dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2], dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2]];
    });
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length];
      const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        const u = (NEAR - a[2]) / (b[2] - a[2]);
        out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), NEAR]);
      }
    }
    if (out.length < 3) return null;
    return out.map((c) => [cam.cx + (c[0] * cam.f) / c[2], cam.cy - (c[1] * cam.f) / c[2], c[2]]);
  };
  World.fillPoly = function (ctx, poly) {
    ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath(); ctx.fill();
  };

  // ----------------------------------------------------------------------
  // 天空
  // S: {zenith, mid, low, horizon (rgb 数组), sunDir, sunR(px 半径系数), sunVis(0..1), sunWarm, glowK, band:[r,g,b], bandK, stars}
  World.sky = function (ctx, cam, S) {
    const yh = World.horizonY(cam);
    const f = cam.f;
    const top = yh - f * Math.tan(S.topEl || 1.05);
    const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    ctx.fillStyle = css(S.zenith); ctx.fillRect(0, 0, W, H);
    if (yh > 0) {
      const g = ctx.createLinearGradient(0, top, 0, yh);
      g.addColorStop(0, css(S.zenith)); g.addColorStop(0.45, css(mixc(S.zenith, S.mid, 0.6)));
      g.addColorStop(0.73, css(S.mid)); g.addColorStop(0.94, css(S.low)); g.addColorStop(1, css(S.horizon));
      ctx.fillStyle = g; ctx.fillRect(0, Math.max(0, top), W, Math.min(H, yh) - Math.max(0, top) + 1);
    }
    if (S.stars > 0) gfx.drawStars(ctx, S.time || 0, S.stars, Math.max(10, Math.min(H, yh)), { fadeY: true, dx: -World.yaw(cam) * 900 });
    // 太阳
    const sd = S.sunDir;
    const sp = cam.project([cam.eye[0] + sd[0] * 8000, cam.eye[1] + sd[1] * 8000, cam.eye[2] + sd[2] * 8000]);
    const visible = sp[2] > 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (S.band && S.bandK > 0) {
      // 地平线上的暖色光带：以太阳方位为中心
      const bx = visible ? sp[0] : W / 2;
      const kk = S.bandK * (visible ? 1 : 0.35);
      gfx.put(ctx, gfx.glow(S.band[0], S.band[1], S.band[2], 1.1), bx, yh, 1500, kk, 0.28);
      gfx.put(ctx, gfx.glow(S.band[0], S.band[1], S.band[2], 0.8), bx, yh, 600, kk * 0.8, 0.22);
    }
    ctx.restore();
    World.lastSun = null;
    if (visible && S.sunVis > 0) {
      const r = (S.sunR || 1) * f * 0.018;
      ctx.save();
      // 地平线以下被地面遮挡，由 ground() 之后再叠加；这里先画
      gfx.sun(ctx, sp[0], sp[1], r, S.sunVis, S.sunWarm === undefined ? 0.6 : S.sunWarm);
      ctx.restore();
      World.lastSun = { x: sp[0], y: sp[1], r };
    }
    return { yh, sun: World.lastSun };
  };

  // ----------------------------------------------------------------------
  // 远山剪影 + 地面
  World.hills = function (ctx, cam, yh, color, amp, scale, seed, haze) {
    const yaw = World.yaw(cam);
    const f = cam.f;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const az = yaw - Math.atan((x - cam.cx) / f);
      const n = U.fbm(az * scale + seed, seed * 3.1, 4);
      ctx.lineTo(x, yh - amp * f * 0.02 * (n - 0.25));
    }
    ctx.lineTo(W, H); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  };

  World.ground = function (ctx, cam, G_) {
    const yh = World.horizonY(cam);
    if (yh >= H) return yh;
    const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const y0 = Math.max(0, yh);
    // 远山
    if (G_.hills) {
      for (let i = 0; i < G_.hills.length; i++) {
        const h = G_.hills[i];
        World.hills(ctx, cam, yh, css(h.color), h.amp, h.scale, h.seed);
      }
    }
    const g = ctx.createLinearGradient(0, yh, 0, H);
    g.addColorStop(0, css(G_.haze)); g.addColorStop(0.12, css(mixc(G_.haze, G_.far, 0.6))); g.addColorStop(0.45, css(G_.far)); g.addColorStop(1, css(G_.near));
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
    return yh;
  };

  /** 远处的城市灯光（位于地平线附近的暖色小点，随相机方位平移） */
  World.farLights = function (ctx, cam, yh, o) {
    const yaw = World.yaw(cam), f = cam.f;
    const r = rng(o.seed || 5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < (o.n || 260); i++) {
      const az = r() * TAU, d = r();
      const cluster = Math.pow(Math.sin(az * 2.3 + 1.1) * 0.5 + 0.5, 2.5);
      if (r() > cluster) continue;
      let dx = ((az - yaw + Math.PI * 3) % TAU) - Math.PI; // 相对方位
      const sx = cam.cx - Math.tan(dx) * f;
      if (sx < -20 || sx > W + 20 || Math.abs(dx) > 1.3) continue;
      const sy = yh + 2 + d * d * f * 0.012;
      const tw = 0.6 + 0.4 * Math.sin((o.time || 0) * (1 + r() * 3) + r() * 9);
      const c = r() < 0.2 ? [255, 255, 235] : r() < 0.6 ? [255, 200, 120] : [255, 150, 80];
      gfx.put(ctx, gfx.glow(c[0], c[1], c[2], 1.3), sx, sy, 2 + r() * 3.2, (0.35 + 0.65 * (1 - d)) * tw * (o.k || 1));
    }
    ctx.restore();
  };

  // ----------------------------------------------------------------------
  // 跑道
  World.shadow = function (ctx, cam, cx, cz, rx, rz, a, yaw = 0) {
    if (a <= 0.01) return;
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const th = (i / 28) * TAU;
      const x = Math.cos(th) * rx, z = Math.sin(th) * rz;
      pts.push([cx + x * Math.cos(yaw) + z * Math.sin(yaw), 0.02, cz - x * Math.sin(yaw) + z * Math.cos(yaw)]);
    }
    const poly = World.clipProject(cam, pts);
    if (!poly) return;
    ctx.fillStyle = `rgba(0,0,0,${a})`; World.fillPoly(ctx, poly);
  };

  /**
   * 跑道。R: {x0,x1, hw, fog:[r,g,b], fogD, col:[r,g,b], light:[r,g,b], prev: cam(上一瞬间，用于拉丝), lightK}
   */
  World.runway = function (ctx, cam, R) {
    const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    const fogAt = (d) => 1 - Math.exp(-d / R.fogD);
    const seg = 60;
    const camx = cam.eye[0];
    // 路面
    for (let x = R.x0; x < R.x1; x += seg) {
      const xe = Math.min(R.x1, x + seg);
      const dmid = Math.hypot(((x + xe) / 2) - camx, cam.eye[1], cam.eye[2]);
      if (((x + xe) / 2 - camx) * cam.fwd[0] < -300 && Math.abs(cam.fwd[0]) > 0.5) { /* 在身后，仍可能进入视野侧边，不做强行剔除 */ }
      const poly = World.clipProject(cam, [[x, 0, -R.hw], [xe, 0, -R.hw], [xe, 0, R.hw], [x, 0, R.hw]]);
      if (!poly) continue;
      const c = mixc(R.col, R.fog, fogAt(dmid));
      ctx.fillStyle = css(c); World.fillPoly(ctx, poly);
    }
    // 白色边线 + 中线虚线
    const line = (x, xe, z0, z1, a) => {
      const poly = World.clipProject(cam, [[x, 0.01, z0], [xe, 0.01, z0], [xe, 0.01, z1], [x, 0.01, z1]]);
      if (!poly) return;
      const dmid = Math.hypot((x + xe) / 2 - camx, cam.eye[1], cam.eye[2] - (z0 + z1) / 2);
      const fa = 1 - fogAt(dmid);
      ctx.fillStyle = `rgba(210,205,200,${a * fa})`; World.fillPoly(ctx, poly);
    };
    for (let x = R.x0; x < R.x1; x += seg) { const xe = Math.min(R.x1, x + seg); line(x, xe, -R.hw + 0.7, -R.hw + 1.3, 0.55); line(x, xe, R.hw - 1.3, R.hw - 0.7, 0.55); }
    for (let x = R.x0; x < R.x1; x += 50) line(x, x + 30, -0.45, 0.45, 0.6);
    // 灯光
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const tmp = [0, 0, 0], tmp0 = [0, 0, 0];
    const L = (x, y, z, c, size, a) => {
      cam.project([x, y, z], tmp);
      if (tmp[2] < NEAR) return;
      const fa = 1 - 0.85 * fogAt(tmp[2]);
      const px = cam.f * size / tmp[2];
      if (px < 0.25) return;
      const rad = clamp(px * 2.4, 1.6, 90);
      if (tmp[0] < -200 || tmp[0] > W + 200 || tmp[1] < -200 || tmp[1] > H + 200) return;
      if (R.prev) {
        R.prev.project([x, y, z], tmp0);
        const dx = tmp[0] - tmp0[0], dy = tmp[1] - tmp0[1];
        const d = Math.hypot(dx, dy);
        if (d > 3 && tmp0[2] > NEAR) {
          const g = ctx.createLinearGradient(tmp0[0], tmp0[1], tmp[0], tmp[1]);
          g.addColorStop(0, css(c, 0)); g.addColorStop(1, css(c, 0.95 * a * fa));
          ctx.strokeStyle = g; ctx.lineWidth = clamp(px * 0.7, 1, 12); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(tmp0[0], tmp0[1]); ctx.lineTo(tmp[0], tmp[1]); ctx.stroke();
        }
      }
      gfx.put(ctx, gfx.glow(c[0], c[1], c[2], 1.1), tmp[0], tmp[1], rad, a * fa * (R.lightK || 1));
      if (rad > 4) gfx.put(ctx, gfx.glow(255, 255, 255, 1.6), tmp[0], tmp[1], rad * 0.35, a * fa * 0.9);
    };
    const xs = Math.floor(Math.max(R.x0, camx - 400) / 30) * 30;
    const xe2 = Math.min(R.x1, camx + 3600);
    for (let x = xs; x < xe2; x += 60) { L(x, 0.3, -R.hw - 1.4, R.light, 0.55, 0.9); L(x, 0.3, R.hw + 1.4, R.light, 0.55, 0.9); }
    for (let x = Math.floor(Math.max(R.x0, camx - 400) / 30) * 30; x < xe2; x += 30) L(x, 0.12, 0, [255, 244, 225], 0.4, 0.9);
    // 滑行道蓝灯
    for (let x = Math.floor(Math.max(R.x0, camx - 400) / 40) * 40; x < xe2; x += 40) { L(x, 0.3, -R.hw - 24, [70, 120, 255], 0.5, 0.8); L(x, 0.3, R.hw + 24, [70, 120, 255], 0.5, 0.8); }
    ctx.restore();
  };

  // ----------------------------------------------------------------------
  // 发动机尾焰（加力）：base 世界坐标，dir 为喷流方向单位向量
  World.flame = function (ctx, cam, base, dir, len, wid, k, t, seed) {
    if (k <= 0.01) return;
    const flick = 0.9 + 0.1 * Math.sin(t * 61 + seed * 2.7) + 0.06 * Math.sin(t * 113 + seed);
    const L = len * flick * k;
    const tip = [base[0] + dir[0] * L, base[1] + dir[1] * L, base[2] + dir[2] * L];
    const a = cam.project(base), b = cam.project(tip);
    if (a[2] < NEAR) return;
    const bz = Math.max(b[2], NEAR);
    const ppm = cam.f / a[2];
    const w0 = wid * ppm * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 外焰
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const ln = Math.hypot(dx, dy) || 1;
    const nx = -dy / ln, ny = dx / ln;
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, `rgba(255,250,235,${0.95 * k})`); g.addColorStop(0.15, `rgba(255,205,130,${0.85 * k})`);
    g.addColorStop(0.5, `rgba(255,120,40,${0.5 * k})`); g.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * w0, a[1] + ny * w0);
    ctx.quadraticCurveTo(lerp(a[0], b[0], 0.45) + nx * w0 * 1.15, lerp(a[1], b[1], 0.45) + ny * w0 * 1.15, b[0], b[1]);
    ctx.quadraticCurveTo(lerp(a[0], b[0], 0.45) - nx * w0 * 1.15, lerp(a[1], b[1], 0.45) - ny * w0 * 1.15, a[0] - nx * w0, a[1] - ny * w0);
    ctx.closePath(); ctx.fill();
    // 马赫盘（激波钻石）
    for (let i = 0; i < 5; i++) {
      const u = 0.1 + i * 0.12;
      const px = lerp(a[0], b[0], u), py = lerp(a[1], b[1], u);
      const r = w0 * (0.8 - i * 0.1) * (0.7 + 0.3 * Math.sin(t * 40 + i * 1.7));
      gfx.put(ctx, gfx.glow(190, 215, 255, 1.2), px, py, Math.max(2, r * 1.4), (0.8 - i * 0.14) * k);
    }
    // 喷口强光
    gfx.put(ctx, gfx.glow(255, 190, 110, 1.0), a[0], a[1], Math.max(6, w0 * 4.2), 0.55 * k);
    gfx.put(ctx, gfx.glow(255, 255, 240, 1.4), a[0], a[1], Math.max(3, w0 * 1.6), 0.95 * k);
    ctx.restore();
  };

  /** 航行灯 / 频闪灯 */
  World.navLights = function (ctx, cam, an, t, k = 1, night = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const dot = (p, c, size, a) => {
      const s = cam.project(p);
      if (s[2] < NEAR) return;
      const r = Math.max(2.5, cam.f * size / s[2]);
      gfx.put(ctx, gfx.glow(c[0], c[1], c[2], 1.2), s[0], s[1], r * 2.5, a * k);
      gfx.put(ctx, gfx.glow(255, 255, 255, 1.6), s[0], s[1], r * 0.7, a * k * 0.9);
    };
    dot(an.tipR, [60, 255, 130], 0.5, 0.9 * night);
    dot(an.tipL, [255, 50, 50], 0.5, 0.9 * night);
    const ph = (t * 0.72) % 1;
    const strobe = ph < 0.06 || (ph > 0.14 && ph < 0.2) ? 1 : 0;
    dot(an.tail, [255, 255, 255], 0.8, strobe);
    dot(an.finTop, [255, 255, 255], 0.5, strobe * 0.9);
    ctx.restore();
  };

  // ----------------------------------------------------------------------
  // 高空：云海、地球弧线与大气辉光
  const cloudField = [];
  (function () {
    const r = rng(8841);
    for (let i = 0; i < 1500; i++) cloudField.push({ bx: r(), bz: (r() * 2 - 1), s: 0.55 + r() * 1.25, k: (r() * 6) | 0, a: 0.6 + r() * 0.4, f: r() < 0.5 ? 1 : -1 });
  })();

  /**
   * 云海：云朵固定在世界坐标里，围绕 originX 做环绕，从远到近绘制 billboards。
   * C: {pal, light, deckY, originX, span, lat, size, hazeD, haze, squash, k}
   */
  World.cloudDeck = function (ctx, cam, C) {
    const sets = gfx.cloudSet(C.pal, C.light === undefined ? 1 : C.light);
    const items = [];
    const span = C.span, half = span / 2;
    const e = cam.eye;
    const nUse = Math.floor(cloudField.length * (C.density === undefined ? 1 : C.density));
    for (let i = 0; i < nUse; i++) {
      const c = cloudField[i];
      const x0 = c.bx * span * 7.3; // 世界中的固定位置（跨度大于窗口，模运算后环绕）
      let wx = C.originX + ((((x0 - C.originX + half) % span) + span) % span) - half;
      const wz = c.bz * C.lat;
      const dx = wx - e[0], dy = C.deckY - e[1], dz = wz - e[2];
      const zc = dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2];
      if (zc < 200) continue;
      const xc = dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2];
      const yc = dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2];
      const k = cam.f / zc;
      const wm = C.size * c.s;
      const wpx = wm * k;
      const sx = cam.cx + xc * k, sy = cam.cy - yc * k;
      if (wpx < 3 || sx < -wpx || sx > W + wpx || sy < -wpx || sy > H + wpx * 0.5) continue;
      items.push({ x: sx, y: sy, d: zc, w: wpx, c });
    }
    items.sort((a, b) => b.d - a.d);
    const squash = C.squash === undefined ? 0.5 : C.squash;
    for (const it of items) {
      const spr = sets[it.c.k];
      const fog = 1 - Math.exp(-it.d / C.hazeD);
      const h = it.w * (spr.height / spr.width) * squash;
      ctx.globalAlpha = it.c.a * (1 - fog * 0.6) * (C.k === undefined ? 1 : C.k);
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.c.f < 0) ctx.scale(-1, 1);
      ctx.drawImage(spr, -it.w / 2, -h * 0.8, it.w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  World.prepCam = function (cam) {
    const l = Math.hypot(cam.fwd[0], cam.fwd[2]) || 1;
    cam.fwdFlat = [cam.fwd[0] / l, 0, cam.fwd[2] / l];
    return cam;
  };

  /**
   * 高空整体背景：天空 + 弯曲地球 + 云海 + 蓝色大气辉光。
   * P: { sky:{...World.sky 参数}, sunDir, time, deckY, originX, pal, light, haze, base:[near,far], limb:[r,g,b], sag, size, hazeD, span, lat, squash }
   */
  World.highAlt = function (ctx, cam, P) {
    World.prepCam(cam);
    const sky = Object.assign({}, P.sky, { sunDir: P.sunDir, time: P.time });
    const info = World.sky(ctx, cam, sky);
    const yh = info.yh;
    const sag = P.sag === undefined ? 14 : P.sag;
    const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    if (yh < H + 80) {
      // 大气辉光：贴着地球边缘的一条蓝色光带
      const L = P.limb || [110, 180, 255];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gy0 = yh - 120;
      const g = ctx.createLinearGradient(0, gy0, 0, yh + sag);
      g.addColorStop(0, css(L, 0)); g.addColorStop(0.7, css(L, 0.22 * (P.limbK === undefined ? 1 : P.limbK))); g.addColorStop(1, css(L, 0.55 * (P.limbK === undefined ? 1 : P.limbK)));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-10, yh + sag + 6); ctx.quadraticCurveTo(W / 2, yh - sag, W + 10, yh + sag + 6); ctx.lineTo(W + 10, gy0); ctx.lineTo(-10, gy0); ctx.closePath(); ctx.fill();
      ctx.restore();
      // 地球：弧线以下
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-10, H + 10); ctx.lineTo(-10, yh + sag + 4); ctx.quadraticCurveTo(W / 2, yh - sag, W + 10, yh + sag + 4); ctx.lineTo(W + 10, H + 10); ctx.closePath();
      ctx.clip();
      const bg = ctx.createLinearGradient(0, Math.max(0, yh - sag), 0, H);
      const bs = P.base;
      bg.addColorStop(0, css(bs[1])); bg.addColorStop(0.18, css(U.mixc(bs[1], bs[0], 0.4))); bg.addColorStop(1, css(bs[0]));
      ctx.fillStyle = bg; ctx.fillRect(0, Math.max(0, yh - sag - 4), W, H);
      World.cloudDeck(ctx, cam, { pal: P.pal, light: P.light, deckY: P.deckY, originX: P.originX, span: P.span || 160000, lat: P.lat || 90000, size: P.size || 7000, hazeD: P.hazeD || 45000, haze: P.haze, squash: P.squash, k: P.cloudK, density: P.density });
      // 太阳在云面上的反光带
      if (P.glint && info.sun) {
        ctx.globalCompositeOperation = 'lighter';
        gfx.put(ctx, gfx.glow(P.glint[0], P.glint[1], P.glint[2], 1.0), info.sun.x, yh + 30, 700, P.glintK || 0.5, 0.2);
        ctx.globalCompositeOperation = 'source-over';
      }
      // 贴地平线的雾
      const hk = (P.hazeK === undefined ? 1 : P.hazeK);
      const hz = ctx.createLinearGradient(0, yh - 4, 0, yh + 300);
      hz.addColorStop(0, css(P.haze, 0.8 * hk)); hz.addColorStop(0.3, css(P.haze, 0.38 * hk)); hz.addColorStop(1, css(P.haze, 0));
      ctx.fillStyle = hz; ctx.fillRect(0, yh - 6, W, 310);
      ctx.restore();
      // 弧线上沿的亮边
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = css(P.limbEdge || [190, 225, 255], 0.55); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-10, yh + sag + 4); ctx.quadraticCurveTo(W / 2, yh - sag, W + 10, yh + sag + 4); ctx.stroke();
      ctx.restore();
    }
    return info;
  };

  /** 高速气流线：在飞机周围的空间里相对向后飞掠 */
  const streakSeeds = (function () { const r = rng(4242); const a = []; for (let i = 0; i < 160; i++) a.push([r(), r(), r(), 0.4 + r() * 0.6]); return a; })();
  World.streaks = function (ctx, cam, S) {
    const lx = S.box[0], ly = S.box[1], lz = S.box[2];
    const tmpA = [0, 0, 0], tmpB = [0, 0, 0];
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < Math.min(S.n, streakSeeds.length); i++) {
      const sd = streakSeeds[i];
      const xr = ((((sd[0] * lx - S.dist) % lx) + lx) % lx) - lx / 2;
      const y = (sd[1] - 0.5) * ly, z = (sd[2] - 0.5) * lz;
      if (Math.abs(z) < 16 && Math.abs(y) < 7 && Math.abs(xr) < 36) continue;
      const p0 = [S.origin[0] + xr, S.origin[1] + y, S.origin[2] + z];
      const p1 = [p0[0] + S.len * sd[3], p0[1], p0[2]];
      cam.project(p0, tmpA); cam.project(p1, tmpB);
      if (tmpA[2] < 1 || tmpB[2] < 1) continue;
      const near = tmpA[2] < S.planeDepth;
      if (S.pass === 'far' && near) continue;
      if (S.pass === 'near' && !near) continue;
      const gr = ctx.createLinearGradient(tmpA[0], tmpA[1], tmpB[0], tmpB[1]);
      const al = S.alpha * sd[3] * clamp(1 - Math.abs(xr) / (lx * 0.5)) * 1.4;
      gr.addColorStop(0, `rgba(255,255,255,${al})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = clamp(cam.f * 0.35 / tmpA[2], 0.8, 3.2);
      ctx.beginPath(); ctx.moveTo(tmpA[0], tmpA[1]); ctx.lineTo(tmpB[0], tmpB[1]); ctx.stroke();
    }
    ctx.restore();
  };

  G.World = World;
})(typeof window !== 'undefined' ? window : globalThis);
