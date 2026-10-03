/* 协和逐日 · 基础工具：数学、缓动、伪随机、噪声、向量 */
(function (G) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const unlerp = (a, b, x) => (x - a) / (b - a);
  /** 0..1 区间进度：t 在 [a,b] 内线性映射到 0..1 并夹紧 */
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  /** 区间平滑：在 [a,b] 之间做 smoothstep */
  const sstep = (t, a, b) => smooth((t - a) / (b - a));
  const map = (x, a, b, c, d) => c + ((x - a) / (b - a)) * (d - c);

  const ease = {
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };

  /** mulberry32 伪随机数 —— 同一个种子永远得到同一个序列，保证画面是时间的纯函数 */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash1(n) {
    n = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }
  function hash2(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  /** 二维值噪声 + fbm */
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
    return s;
  }
  function noise1(x) {
    const xi = Math.floor(x), xf = x - xi;
    const u = xf * xf * (3 - 2 * xf);
    return hash1(xi) * (1 - u) + hash1(xi + 1) * u;
  }

  // ---- 颜色 ----
  const rgba = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // ---- 向量（数组形式，仅用于非热点路径）----
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
  };

  /** 机体姿态矩阵：X 向前，Y 向上，Z 向右舷。R = Ry(yaw)·Rz(pitch)·Rx(roll)，行主序 */
  function rotYPR(yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    // Rz(pitch)·Rx(roll)
    const a00 = cp, a01 = -sp * cr, a02 = sp * sr;
    const a10 = sp, a11 = cp * cr, a12 = -cp * sr;
    const a20 = 0, a21 = sr, a22 = cr;
    // Ry(yaw)·A
    return [
      cy * a00 + sy * a20, cy * a01 + sy * a21, cy * a02 + sy * a22,
      a10, a11, a12,
      -sy * a00 + cy * a20, -sy * a01 + cy * a21, -sy * a02 + cy * a22,
    ];
  }
  const mulMV = (m, v) => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];

  // 分段线性关键帧： keys = [[t, v], ...]
  function keyframes(keys, t, easing) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        let u = (t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
        if (easing) u = easing(u);
        return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * u;
      }
    }
    return keys[keys.length - 1][1];
  }

  G.U = {
    TAU, clamp, lerp, unlerp, ramp, smooth, smoother, sstep, map, ease, rng, hash1, hash2,
    noise1, noise2, fbm, rgba, mixc, hex, css, V, rotYPR, mulMV, keyframes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
