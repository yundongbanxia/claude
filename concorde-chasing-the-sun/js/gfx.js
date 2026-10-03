/* 协和逐日 · 图形基础：精灵、云、星空、镜头光晕、后期（辉光/暗角/胶片颗粒）、排版 */
(function (G) {
  'use strict';
  const { clamp, lerp, rng, TAU, smooth } = U;

  const W = 1920, H = 1080;
  const BAR = 92; // 电影遮幅高度

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  // ---------------------------------------------------------------- 发光精灵
  const spriteCache = {};
  /** 径向渐变发光精灵：stops = [[pos, 'rgba(...)'], ...] */
  function radialSprite(key, size, stops) {
    if (spriteCache[key]) return spriteCache[key];
    const c = makeCanvas(size, size), g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [p, col] of stops) gr.addColorStop(p, col);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return (spriteCache[key] = c);
  }
  function glow(r, g, b, soft = 1) {
    const k = `glow${r}_${g}_${b}_${soft}`;
    const e = soft; // 衰减指数
    const stops = [];
    for (let i = 0; i <= 12; i++) {
      const p = i / 12;
      stops.push([p, `rgba(${r},${g},${b},${Math.pow(1 - p, 1.6 * e) * (1 - p * p * 0.0)})`]);
    }
    stops[stops.length - 1][1] = `rgba(${r},${g},${b},0)`;
    return radialSprite(k, 256, stops);
  }
  function ring(r, g, b) {
    return radialSprite(`ring${r}_${g}_${b}`, 256, [
      [0, `rgba(${r},${g},${b},0)`], [0.62, `rgba(${r},${g},${b},0.02)`], [0.82, `rgba(${r},${g},${b},0.42)`],
      [0.9, `rgba(${r},${g},${b},0.14)`], [1, `rgba(${r},${g},${b},0)`],
    ]);
  }
  function disc(r, g, b) {
    return radialSprite(`disc${r}_${g}_${b}`, 128, [
      [0, `rgba(${r},${g},${b},0.5)`], [0.78, `rgba(${r},${g},${b},0.32)`], [0.94, `rgba(${r},${g},${b},0.55)`], [1, `rgba(${r},${g},${b},0)`],
    ]);
  }
  /** 以 (x,y) 为中心、半径 rad 像素绘制精灵 */
  function put(ctx, spr, x, y, rad, alpha = 1, sy = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(spr, x - rad, y - rad * sy, rad * 2, rad * 2 * sy);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- 太阳 & 镜头光晕
  /** 太阳：核心 + 多层光晕。intensity 0..1.4，temp: 0=白 1=金橙 */
  function sun(ctx, x, y, r, intensity = 1, warm = 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const c1 = [255, 214 - 50 * warm | 0, 150 - 90 * warm | 0];
    const c2 = [255, 150 - 40 * warm | 0, 80 - 30 * warm | 0];
    put(ctx, glow(c2[0], c2[1], c2[2], 1.5), x, y, r * 15, 0.2 * intensity);
    put(ctx, glow(c1[0], c1[1], c1[2], 1.3), x, y, r * 6, 0.3 * intensity);
    put(ctx, glow(255, 232, 190, 1.1), x, y, r * 2.6, 0.5 * intensity);
    ctx.restore();
    // 日面
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const k = Math.min(1, intensity);
    g.addColorStop(0, `rgba(255,252,238,${k})`);
    g.addColorStop(0.82, `rgba(255,${250 - 14 * warm | 0},${226 - 40 * warm | 0},${k})`);
    g.addColorStop(1, `rgba(255,${226 - 30 * warm | 0},${170 - 60 * warm | 0},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.04, 0, U.TAU); ctx.fill();
  }

  /** 镜头光晕：变形宽银幕光条 + 沿画面中心轴排布的鬼影 */
  function lensFlare(ctx, sx, sy, k = 1, o = {}) {
    if (k <= 0.001) return;
    const cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 宽银幕光条
    const streak = glow(120, 170, 255, 1.4);
    ctx.globalAlpha = 0.5 * k;
    ctx.drawImage(streak, sx - 1100, sy - 7, 2200, 14);
    ctx.globalAlpha = 0.22 * k;
    ctx.drawImage(glow(255, 200, 140, 1.2), sx - 1500, sy - 20, 3000, 40);
    ctx.globalAlpha = 1;
    // 鬼影
    const dx = cx - sx, dy = cy - sy;
    const ghosts = [
      [0.35, 90, [255, 170, 90], 0.12, 'disc'], [0.62, 46, [120, 200, 255], 0.18, 'ring'],
      [1.0, 180, [255, 120, 60], 0.08, 'ring'], [1.35, 70, [180, 120, 255], 0.14, 'disc'],
      [1.7, 130, [90, 210, 200], 0.1, 'ring'], [2.2, 240, [255, 190, 120], 0.07, 'ring'],
    ];
    for (const [pos, rad, c, a, kind] of ghosts) {
      const spr = kind === 'ring' ? ring(c[0], c[1], c[2]) : disc(c[0], c[1], c[2]);
      put(ctx, spr, sx + dx * pos, sy + dy * pos, rad * (o.size || 1), a * k);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 星空
  let starLayer = null;
  const stars = [];
  (function () {
    const r = rng(20031024);
    for (let i = 0; i < 900; i++) {
      const m = r();
      stars.push({ x: r() * W, y: r() * H, s: 0.4 + m * m * 1.9, a: 0.25 + r() * 0.75, ph: r() * TAU, sp: 0.4 + r() * 1.8, hue: r() });
    }
  })();
  function drawStars(ctx, t, alpha = 1, yMax = H, o = {}) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const dx = o.dx || 0, dy = o.dy || 0;
    for (const s of stars) {
      if (s.y > yMax) continue;
      const tw = 0.65 + 0.35 * Math.sin(t * s.sp + s.ph);
      const a = s.a * tw * alpha * (o.fadeY ? clamp(1 - s.y / yMax, 0, 1) ** 0.7 : 1);
      if (a < 0.02) continue;
      ctx.fillStyle = s.hue < 0.15 ? `rgba(190,215,255,${a})` : s.hue > 0.88 ? `rgba(255,220,180,${a})` : `rgba(255,255,255,${a})`;
      const x = ((s.x + dx) % W + W) % W, y = s.y + dy;
      ctx.fillRect(x, y, s.s, s.s);
      if (s.s > 1.9 && a > 0.4) {
        ctx.globalAlpha = a * 0.35; ctx.fillRect(x - 3, y + s.s * 0.4, 7 + s.s, 0.7); ctx.fillRect(x + s.s * 0.4, y - 3, 0.7, 7 + s.s); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 云
  const CLOUD_PAL = {
    day: { lit: [255, 255, 255], mid: [228, 236, 248], shade: [150, 172, 208] },
    dawn: { lit: [255, 228, 205], mid: [250, 172, 165], shade: [108, 100, 152] },
    gold: { lit: [255, 238, 196], mid: [255, 178, 112], shade: [130, 92, 132] },
    dusk: { lit: [255, 196, 128], mid: [216, 112, 102], shade: [60, 58, 112] },
    high: { lit: [255, 242, 220], mid: [226, 204, 222], shade: [120, 134, 182] },
    night: { lit: [150, 168, 214], mid: [84, 98, 152], shade: [26, 36, 80] },
  };
  const cloudCache = {};
  function cloudSet(pal, light = 1) {
    const key = pal + light;
    if (cloudCache[key]) return cloudCache[key];
    const P = CLOUD_PAL[pal];
    const out = [];
    const shapes = [
      { w: 640, h: 300, n: 46, flat: 0.45, seed: 11 }, { w: 720, h: 260, n: 52, flat: 0.35, seed: 23 },
      { w: 560, h: 320, n: 40, flat: 0.55, seed: 37 }, { w: 800, h: 240, n: 58, flat: 0.28, seed: 41 },
      { w: 620, h: 280, n: 44, flat: 0.5, seed: 59 }, { w: 880, h: 220, n: 60, flat: 0.22, seed: 71 },
    ];
    for (const sh of shapes) {
      const c = makeCanvas(sh.w, sh.h), g = c.getContext('2d');
      const r = rng(sh.seed * 977 + (light > 0 ? 1 : 2));
      const blobs = [];
      for (let i = 0; i < sh.n; i++) {
        const u = (r() + r() + r()) / 3; // 趋向中间
        const bx = sh.w * (0.1 + 0.8 * u);
        const dome = Math.sin(Math.PI * clamp((bx - sh.w * 0.08) / (sh.w * 0.84))) ** 0.8;
        const rad = sh.h * (0.1 + 0.2 * r()) * (0.55 + 0.7 * dome);
        const by = sh.h * (0.86 - sh.flat * dome * (0.35 + 0.65 * r())) - rad * 0.3;
        blobs.push({ x: bx, y: by, r: rad });
      }
      blobs.sort((a, b) => b.y - a.y); // 下面的先画
      for (const b of blobs) {
        const fx = b.x + light * b.r * 0.38, fy = b.y - b.r * 0.42;
        const gr = g.createRadialGradient(fx, fy, b.r * 0.04, b.x, b.y, b.r);
        // 越靠下的团块越偏暗；上部团块边缘融入受光色，避免出现“泡泡环”
        const sa = clamp((b.y / sh.h - 0.32) / 0.55);
        const ec = [lerp(P.mid[0], P.shade[0], sa * 0.85), lerp(P.mid[1], P.shade[1], sa * 0.85), lerp(P.mid[2], P.shade[2], sa * 0.85)];
        gr.addColorStop(0, `rgba(${P.lit[0]},${P.lit[1]},${P.lit[2]},0.96)`);
        gr.addColorStop(0.45, `rgba(${(P.lit[0] + P.mid[0]) / 2 | 0},${(P.lit[1] + P.mid[1]) / 2 | 0},${(P.lit[2] + P.mid[2]) / 2 | 0},0.9)`);
        gr.addColorStop(0.78, `rgba(${ec[0] | 0},${ec[1] | 0},${ec[2] | 0},0.55)`);
        gr.addColorStop(1, `rgba(${ec[0] | 0},${ec[1] | 0},${ec[2] | 0},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill();
      }
      // 云底压暗、边缘柔化
      g.globalCompositeOperation = 'source-atop';
      const sg = g.createLinearGradient(0, sh.h * 0.45, 0, sh.h);
      sg.addColorStop(0, `rgba(${P.shade[0]},${P.shade[1]},${P.shade[2]},0)`);
      sg.addColorStop(1, `rgba(${P.shade[0]},${P.shade[1]},${P.shade[2]},0.55)`);
      g.fillStyle = sg; g.fillRect(0, 0, sh.w, sh.h);
      out.push(c);
    }
    return (cloudCache[key] = out);
  }

  // ---------------------------------------------------------------- 后期
  let vignette = null, grainTile = null, bloomA = null, bloomB = null;
  function initPost() {
    if (vignette) return;
    vignette = makeCanvas(W / 4, H / 4);
    {
      const g = vignette.getContext('2d');
      const gr = g.createRadialGradient(W / 8, H / 8, H / 12, W / 8, H / 8, W / 3.1);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.65, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.72)');
      g.fillStyle = gr; g.fillRect(0, 0, W / 4, H / 4);
    }
    grainTile = makeCanvas(256, 256);
    {
      const g = grainTile.getContext('2d'), id = g.createImageData(256, 256), r = rng(777);
      for (let i = 0; i < 256 * 256; i++) {
        const v = 128 + (r() - 0.5) * 255;
        id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
      }
      g.putImageData(id, 0, 0);
    }
    bloomA = makeCanvas(W / 8, H / 8); bloomB = makeCanvas(W / 24, H / 24);
  }

  /** 全帧后期：辉光 → 暗角 → 颗粒 → 遮幅 */
  function post(ctx, T, o = {}) {
    initPost();
    const cvs = ctx.canvas;
    // 辉光：缩小 → 自乘压暗中间调 → 放大叠加
    if (o.bloom !== 0) {
      const a = bloomA.getContext('2d'), b = bloomB.getContext('2d');
      a.globalCompositeOperation = 'source-over';
      a.drawImage(cvs, 0, 0, bloomA.width, bloomA.height);
      a.globalCompositeOperation = 'multiply';
      a.drawImage(bloomA, 0, 0);
      a.globalCompositeOperation = 'source-over';
      b.drawImage(bloomA, 0, 0, bloomB.width, bloomB.height);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (o.bloom === undefined ? 0.55 : o.bloom);
      ctx.drawImage(bloomB, 0, 0, cvs.width, cvs.height);
      ctx.globalAlpha = (o.bloom === undefined ? 0.5 : o.bloom) * 0.6;
      ctx.drawImage(bloomA, 0, 0, cvs.width, cvs.height);
      ctx.restore();
    }
    // 暗角
    ctx.save();
    ctx.globalAlpha = o.vignette === undefined ? 1 : o.vignette;
    ctx.drawImage(vignette, 0, 0, W, H);
    ctx.restore();
    // 颗粒
    const f = Math.floor(T * 24);
    const gx = (f * 97) % 256, gy = (f * 57) % 256;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = o.grain === undefined ? 0.1 : o.grain;
    for (let x = -gx; x < W; x += 256) for (let y = -gy; y < H; y += 256) ctx.drawImage(grainTile, x, y);
    ctx.restore();
  }

  function letterbox(ctx, k = 1) {
    const h = BAR * k;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
  }

  // ---------------------------------------------------------------- 排版
  const FONT = {
    serif: '"CCSerif","Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun","Noto Serif CJK SC","Noto Serif",Georgia,"WenQuanYi Zen Hei",serif',
    sans: '"CCSansLatin","CCSans","Noto Sans SC","PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans CJK SC","Helvetica Neue",Arial,"WenQuanYi Zen Hei",sans-serif',
    mono: '"CCMono","CCSans","JetBrains Mono","SF Mono","Menlo","Consolas","DejaVu Sans Mono","Liberation Mono","Noto Sans Mono CJK SC","WenQuanYi Zen Hei Mono","WenQuanYi Zen Hei",monospace',
  };
  const widthCache = new Map();
  function charW(ctx, ch) {
    const k = ctx.font + '|' + ch;
    let w = widthCache.get(k);
    if (w === undefined) { w = ctx.measureText(ch).width; widthCache.set(k, w); }
    return w;
  }
  /**
   * 绘制文字。o: {size, family, weight, color, track(px), align, alpha, glow:{color,blur}, shadow, progress(0..1 打字机), caret, italic}
   * 返回实际绘制宽度。
   */
  function text(ctx, str, x, y, o = {}) {
    const size = o.size || 32;
    ctx.save();
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${FONT[o.family || 'sans']}`;
    ctx.textBaseline = o.baseline || 'alphabetic';
    const track = o.track || 0;
    const chars = Array.from(str);
    let total = 0;
    const ws = chars.map((c) => { const w = charW(ctx, c); total += w + track; return w; });
    total -= track;
    let sx = x;
    if (o.align === 'center') sx = x - total / 2; else if (o.align === 'right') sx = x - total;
    ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha);
    if (o.glow) { ctx.shadowColor = o.glow.color; ctx.shadowBlur = o.glow.blur; }
    else if (o.shadow) { ctx.shadowColor = o.shadow.color || 'rgba(0,0,0,0.6)'; ctx.shadowBlur = o.shadow.blur || 12; ctx.shadowOffsetY = o.shadow.dy || 2; }
    ctx.fillStyle = o.color || '#fff';
    const n = o.progress === undefined ? chars.length : o.progress * chars.length;
    let cx = sx;
    for (let i = 0; i < chars.length; i++) {
      if (i > n) break;
      const a = clamp(n - i, 0, 1);
      if (a < 1) ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * a;
      ctx.fillText(chars[i], cx, y);
      cx += ws[i] + track;
    }
    if (o.caret && o.progress !== undefined && o.progress < 1) {
      ctx.globalAlpha = 1; ctx.fillRect(cx + 2, y - size * 0.85, size * 0.5, size * 0.95);
    }
    ctx.restore();
    return total;
  }
  function measure(ctx, str, o = {}) {
    ctx.save();
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${o.size || 32}px ${FONT[o.family || 'sans']}`;
    const track = o.track || 0;
    let total = 0;
    const chars = Array.from(str);
    for (const c of chars) total += charW(ctx, c) + track;
    ctx.restore();
    return total - track;
  }

  /** 淡入淡出包络：在 [t0,t1] 区间内，前 fi 秒淡入，后 fo 秒淡出 */
  function env(t, t0, t1, fi = 0.6, fo = 0.6) {
    return clamp((t - t0) / fi) * clamp((t1 - t) / fo);
  }

  // ---------------------------------------------------------------- 通用小件
  function gradV(ctx, y0, y1, stops, x0 = 0, x1 = W) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [p, c] of stops) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  G.gfx = { W, H, BAR, makeCanvas, glow, ring, disc, put, sun, lensFlare, drawStars, cloudSet, CLOUD_PAL, post, letterbox, text, measure, FONT, env, gradV, stars };
})(typeof window !== 'undefined' ? window : globalThis);
