/* 协和逐日 · 协和客机 3D 模型 + 软件渲染器（Canvas 2D，画家算法）
 *
 * 模型坐标：X 向前（机头 +X），Y 向上，Z 向右舷，单位：米。
 * 数据来源于真实尺寸：机长 61.66 m、翼展 25.6 m、全高约 12.2 m，
 * 细长的哥特式（ogival）三角翼、下垂机头、4 台并列在翼下的发动机短舱。
 */
(function (G) {
  'use strict';
  const { clamp, lerp, smooth } = U;

  const LEN = 61.66;
  const X0 = LEN * 0.5; // x = X0 - s，s 为距机头距离
  const SPAN_HALF = 12.8;
  const GROUND_Y = -4.55; // 起落架放下时，轮子最低点距机身轴线的高度

  const toLin = (c) => [(c[0] / 255) ** 2.2, (c[1] / 255) ** 2.2, (c[2] / 255) ** 2.2];

  // ---------- 1D 查表插值 ----------
  function interp(tab, x) {
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) {
      if (x <= tab[i][0]) {
        const u = (x - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]);
        return tab[i - 1][1] + (tab[i][1] - tab[i - 1][1]) * u;
      }
    }
    return tab[tab.length - 1][1];
  }

  // ---------- 机身剖面 ----------
  const NOSE_L = 14.0, R_W = 1.45, R_H = 1.68;
  function ogive(s, L, R) {
    if (s >= L) return R;
    const rho = (R * R + L * L) / (2 * R);
    return Math.sqrt(Math.max(0, rho * rho - (L - s) * (L - s))) + R - rho;
  }
  function tailU(s) { return clamp((s - 46) / (LEN - 46)); }
  function fusHW(s) {
    if (s < NOSE_L) return ogive(s, NOSE_L, R_W);
    if (s <= 46) return R_W;
    const u = tailU(s);
    return 0.34 + (R_W - 0.34) * (1 - smooth(u) ** 1.05);
  }
  function fusHH(s) {
    if (s < NOSE_L) return ogive(s, NOSE_L, R_H);
    if (s <= 46) return R_H;
    const u = tailU(s);
    return 0.42 + (R_H - 0.42) * (1 - smooth(u) ** 1.05);
  }
  function fusYC(s) {
    if (s < NOSE_L) return -0.22 * (1 - smooth(s / NOSE_L)) ** 1.2;
    if (s <= 46) return 0;
    const u = tailU(s);
    return 0.62 * smooth(u) ** 1.35;
  }
  const fusTop = (s) => fusYC(s) + fusHH(s);

  // ---------- 机翼平面形状（哥特式 ogee 三角翼） ----------
  const LE_TAB = [
    [1.2, 16.2], [1.6, 19.2], [2.0, 22.0], [3.0, 27.4], [4.0, 31.6], [5.0, 35.0], [6.0, 38.2],
    [7.0, 41.0], [8.5, 44.4], [10.0, 47.2], [11.5, 49.8], [12.8, 52.0],
  ];
  const TE_TAB = [[1.2, 58.4], [4.0, 58.1], [8.0, 57.3], [11.0, 56.5], [12.8, 55.7]];
  const wingLE = (z) => interp(LE_TAB, z);
  const wingTE = (z) => interp(TE_TAB, z);
  const WING_Y0 = -1.0;
  const wingT = (z) => Math.max(0.1, 0.034 * (wingTE(z) - wingLE(z)));

  // ---------- 垂尾平面形状 ----------
  const FIN_ROOT_Y = 0.75, FIN_TIP_Y = 7.45;
  const finLE = (y) => lerp(44.6, 56.4, clamp((y - FIN_ROOT_Y) / (FIN_TIP_Y - FIN_ROOT_Y)) ** 0.96);
  const finTE = (y) => lerp(61.5, 61.0, clamp((y - FIN_ROOT_Y) / (FIN_TIP_Y - FIN_ROOT_Y)));

  // ---------- 发动机短舱 ----------
  const NAC_Z = [3.55, 5.2];     // 内侧、外侧发动机中心 z
  const NAC_W = 0.74;            // 半宽
  const NAC_S0 = 29.4, NAC_S1 = 59.6;
  const NAC_TOP = -1.35;
  function nacBottom(s) { return s < 36 ? -2.95 : lerp(-2.95, -2.1, smooth((s - 36) / (NAC_S1 - 36))); }

  // ---------- 材质 ----------
  const MAT_PAINT = { spec: 0.55, shin: 60, refl: 0.7 };
  const MAT_MATTE = { spec: 0.12, shin: 14, refl: 0.12 };
  const MAT_METAL = { spec: 0.9, shin: 30, refl: 0.5 };
  const MAT_GLASS = { spec: 1.0, shin: 120, refl: 1.0 };

  const WHITE = toLin([240, 242, 246]);
  const WHITE2 = toLin([226, 229, 235]);
  const GREY_BELLY = toLin([196, 202, 211]);
  const NAVY = toLin([22, 38, 86]);
  const RED = toLin([170, 24, 40]);
  const DARK = toLin([34, 36, 44]);
  const METAL = toLin([78, 74, 74]);
  const GLASS = toLin([14, 22, 40]);
  const TYRE = toLin([20, 20, 22]);
  const STRUT = toLin([150, 154, 160]);
  const NAV_RED = toLin([255, 40, 40]);
  const NAV_GREEN = toLin([40, 255, 120]);

  const F_DECAL = 1, F_COCKPIT = 2, F_EMIT = 4, F_TWOSIDE = 8;
  const G_BODY = 0, G_NOSEGEAR = 1, G_MAINGEAR_R = 2, G_MAINGEAR_L = 3;

  // ---------- 网格构建 ----------
  // 分层类别：用于解决大面积机翼与机身之间的画家算法错序
  const K_UP = 0, K_WING = 1, K_LOW = 2, K_NG = 3;
  class Mesh {
    constructor() { this.v = []; this.nw = []; this.grp = []; this.f = []; this.cls = K_UP; }
    vert(x, y, z, nw = 0, grp = 0) { this.v.push(x, y, z); this.nw.push(nw); this.grp.push(grp); return this.v.length / 3 - 1; }
    quad(a, b, c, d, col, mat, flags = 0, cls = this.cls) { this.f.push({ i: [a, b, c, d], col, mat, flags, cls }); }
    tri(a, b, c, col, mat, flags = 0, cls = this.cls) { this.f.push({ i: [a, b, c, -1], col, mat, flags, cls }); }
  }
  const noseWeight = (s) => 1 - smooth((s - 8.5) / (15.2 - 8.5));

  function buildFuselage(m) {
    m.cls = K_UP;
    const N = 26;
    const sts = [];
    for (let i = 0; i <= 18; i++) sts.push(NOSE_L * Math.pow(i / 18, 1.35));
    for (const s of [17, 21, 26, 32, 38, 43, 46]) sts.push(s);
    for (let i = 1; i <= 12; i++) sts.push(46 + (LEN - 46) * Math.pow(i / 12, 0.92));
    const rings = [];
    for (const s of sts) {
      const hw = fusHW(s), hh = fusHH(s), yc = fusYC(s);
      const ring = [];
      for (let k = 0; k < N; k++) {
        const th = (k / N) * Math.PI * 2;
        ring.push(m.vert(X0 - s, yc + hh * Math.cos(th), hw * Math.sin(th), noseWeight(s), G_BODY));
      }
      rings.push(ring);
    }
    for (let j = 0; j < rings.length - 1; j++) {
      const s = (sts[j] + sts[j + 1]) / 2;
      const hh = fusHH(s);
      for (let k = 0; k < N; k++) {
        const k2 = (k + 1) % N;
        const th = ((k + 0.5) / N) * Math.PI * 2;
        const dy = hh * Math.cos(th);              // 相对机身轴线的高度
        const side = Math.abs(Math.sin(th));
        let col = WHITE, mat = MAT_PAINT;
        // 海军蓝腰线 + 红色细线（只在两侧）
        if (side > 0.55 && s > 12.5 && s < 57.5) {
          if (dy < -0.1 && dy > -0.34) col = NAVY;
          else if (dy < -0.42 && dy > -0.49) col = RED;
        }
        if (s < 0.9) col = DARK;
        if (s > 60.6) col = DARK;
        if (dy < -hh * 0.82) col = WHITE2;
        m.quad(rings[j][k], rings[j + 1][k], rings[j + 1][k2], rings[j][k2], col, mat, 0, dy < -0.5 ? K_LOW : K_UP);
      }
    }
    // 头部风挡 / 座舱窗（仅在机头下垂时才可见）
    for (const sg of [-1, 1]) {
      const sa = 8.5, sb = 11.0;
      for (let q = 0; q < 2; q++) {
        const s0 = lerp(sa, sb, q / 2), s1 = lerp(sa, sb, (q + 1) / 2);
        const pt = (s, th) => {
          const hw = fusHW(s) * 1.012, hh = fusHH(s) * 1.012, yc = fusYC(s);
          return m.vert(X0 - s, yc + hh * Math.cos(th), sg * hw * Math.sin(th), noseWeight(s), G_BODY);
        };
        const t0 = 0.30, t1 = 0.78;
        const a = pt(s0, t0), b = pt(s1, t0), c = pt(s1, t1), d = pt(s0, t1);
        if (sg > 0) m.quad(a, b, c, d, GLASS, MAT_GLASS, F_COCKPIT);
        else m.quad(a, d, c, b, GLASS, MAT_GLASS, F_COCKPIT);
      }
    }
    // 客舱小圆窗（协和的窗口非常小）
    for (const sg of [-1, 1]) {
      for (let s = 13.4; s < 47; s += 0.86) {
        const hw = fusHW(s), hh = fusHH(s), yc = fusYC(s);
        const wy = 0.36, wh = 0.15, ww = 0.1;
        const corner = (ds, dy) => {
          const ss = s + ds;
          const hw2 = fusHW(ss), hh2 = fusHH(ss), yc2 = fusYC(ss);
          const y = yc2 + dy;
          const zz = hw2 * Math.sqrt(Math.max(0, 1 - ((y - yc2) / hh2) ** 2)) + 0.012;
          return m.vert(X0 - ss, y, sg * zz, noseWeight(ss), G_BODY);
        };
        const a = corner(-ww, wy + wh), b = corner(ww, wy + wh), c = corner(ww, wy - wh), d = corner(-ww, wy - wh);
        // 顶点顺序保证法线朝外
        if (sg > 0) m.quad(a, b, c, d, GLASS, MAT_GLASS, F_DECAL);
        else m.quad(a, d, c, b, GLASS, MAT_GLASS, F_DECAL);
      }
    }
  }

  function buildWing(m, side) {
    m.cls = K_WING;
    // 机翼网格：nu 个展向站位 × nc 个弦向站位
    const zs = [1.0, 1.45, 1.9, 2.5, 3.2, 4.0, 4.9, 5.9, 7.0, 8.2, 9.4, 10.6, 11.7, 12.35, SPAN_HALF];
    const cs = [];
    const nc = 14;
    for (let j = 0; j <= nc; j++) cs.push(0.5 - 0.5 * Math.cos((j / nc) * Math.PI));
    const top = [], bot = [];
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      const le = wingLE(Math.max(z, 1.2)) - (z < 1.2 ? (1.2 - z) * 3 : 0);
      const te = wingTE(z);
      const t = wingT(z);
      const rt = [], rb = [];
      for (let j = 0; j <= nc; j++) {
        const c = cs[j];
        const x = X0 - (le + (te - le) * c);
        const h = Math.pow(4 * c * (1 - c), 0.85) * t * 0.5;
        // 前缘处略微下垂（圆锥翼型）
        const droop = -0.28 * Math.pow(1 - c, 6) * smooth(z / 6) * (t > 0.2 ? 1 : 0.4);
        const y0 = WING_Y0 + droop;
        rt.push(m.vert(x, y0 + h + 0.012, side * z, 0, G_BODY));
        rb.push(m.vert(x, y0 - h - 0.012, side * z, 0, G_BODY));
      }
      top.push(rt); bot.push(rb);
    }
    const rev = side < 0;
    const addQ = (a, b, c, d, col, mat, fl) => (rev ? m.quad(a, d, c, b, col, mat, fl) : m.quad(a, b, c, d, col, mat, fl));
    for (let i = 0; i < zs.length - 1; i++) {
      for (let j = 0; j < nc; j++) {
        const cm = (cs[j] + cs[j + 1]) / 2;
        let ct = cm > 0.78 ? WHITE2 : WHITE;
        let cb = GREY_BELLY;
        if (cm < 0.03) { ct = toLin([205, 210, 218]); cb = toLin([170, 176, 186]); }
        // 上表面：展向外 → 弦向后（法线朝上），下表面反过来
        addQ(top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j], ct, MAT_PAINT);
        addQ(bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1], cb, MAT_MATTE);
      }
    }
    // 翼尖封口（带红绿航行灯）
    const iT = zs.length - 1;
    for (let j = 0; j < nc; j++) {
      const lamp = j > 3 && j < 9;
      const col = lamp ? (side > 0 ? NAV_GREEN : NAV_RED) : WHITE2;
      addQ(top[iT][j], bot[iT][j], bot[iT][j + 1], top[iT][j + 1], col, MAT_MATTE, lamp ? F_EMIT : 0);
    }
    // 后缘钝边
    for (let i = 0; i < zs.length - 1; i++) {
      addQ(top[i][nc], top[i + 1][nc], bot[i + 1][nc], bot[i][nc], WHITE2, MAT_MATTE);
    }
  }

  function buildFin(m) {
    m.cls = K_UP;
    const ys = [];
    for (let i = 0; i <= 10; i++) ys.push(FIN_ROOT_Y + (FIN_TIP_Y - FIN_ROOT_Y) * (i / 10));
    const nc = 10;
    const cs = [];
    for (let j = 0; j <= nc; j++) cs.push(0.5 - 0.5 * Math.cos((j / nc) * Math.PI));
    const L = [], R = [];
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      const le = finLE(y), te = finTE(y);
      const tt = lerp(0.46, 0.12, (y - FIN_ROOT_Y) / (FIN_TIP_Y - FIN_ROOT_Y));
      const rl = [], rr = [];
      for (let j = 0; j <= nc; j++) {
        const c = cs[j];
        const x = X0 - (le + (te - le) * c);
        const h = Math.pow(4 * c * (1 - c), 0.8) * tt * 0.5;
        rl.push(m.vert(x, y, -h - 0.01, 0, G_BODY));
        rr.push(m.vert(x, y, h + 0.01, 0, G_BODY));
      }
      L.push(rl); R.push(rr);
    }
    const hFrac = (y) => (y - FIN_ROOT_Y) / (FIN_TIP_Y - FIN_ROOT_Y);
    for (let i = 0; i < ys.length - 1; i++) {
      const hf = hFrac((ys[i] + ys[i + 1]) / 2);
      for (let j = 0; j < nc; j++) {
        const cm = (cs[j] + cs[j + 1]) / 2;
        let col = cm > 0.72 ? WHITE2 : WHITE;
        if (hf > 0.62) col = NAVY;
        else if (hf > 0.55) col = RED;
        // 右侧 (z>0)
        m.quad(R[i][j], R[i][j + 1], R[i + 1][j + 1], R[i + 1][j], col, MAT_PAINT);
        // 左侧 (z<0) 反绕
        m.quad(L[i][j], L[i + 1][j], L[i + 1][j + 1], L[i][j + 1], col, MAT_PAINT);
      }
    }
    // 垂尾顶封口
    const iT = ys.length - 1;
    for (let j = 0; j < nc; j++) m.quad(R[iT][j], L[iT][j], L[iT][j + 1], R[iT][j + 1], NAVY, MAT_PAINT);
    // 垂尾尾缘
    for (let i = 0; i < ys.length - 1; i++) m.quad(R[i][nc], R[i + 1][nc], L[i + 1][nc], L[i][nc], WHITE2, MAT_PAINT);
  }

  function buildNacelle(m, zc) {
    m.cls = K_NG;
    const N = 16;
    const sts = [29.4, 29.9, 31, 33.5, 37, 42, 47, 52, 55.5, 57.8, 59.6];
    const rings = [];
    for (const s of sts) {
      const yb = nacBottom(s), yt = NAC_TOP;
      const hh = (yt - yb) / 2, yc = (yt + yb) / 2;
      const aft = clamp((s - 52) / 7.6);
      const hw = lerp(NAC_W, 0.6, aft * aft);
      const hh2 = hh * lerp(1, 0.92, aft);
      const ring = [];
      for (let k = 0; k < N; k++) {
        const th = (k / N) * Math.PI * 2;
        const sn = Math.sin(th), cn = Math.cos(th);
        const e = 0.55;
        ring.push(m.vert(X0 - s, yc + hh2 * Math.sign(cn) * Math.pow(Math.abs(cn), e), zc + hw * Math.sign(sn) * Math.pow(Math.abs(sn), e), 0, G_BODY));
      }
      rings.push(ring);
    }
    for (let j = 0; j < rings.length - 1; j++) {
      const s = (sts[j] + sts[j + 1]) / 2;
      const jet = s > 56.2;
      const lip = s < 30.6;
      for (let k = 0; k < N; k++) {
        const k2 = (k + 1) % N;
        const col = jet ? METAL : lip ? WHITE2 : WHITE;
        m.quad(rings[j][k], rings[j + 1][k], rings[j + 1][k2], rings[j][k2], col, jet ? MAT_METAL : MAT_PAINT);
      }
    }
    // 进气口（深色）
    const f = rings[0];
    const cx = m.vert(X0 - 29.4 - 1.1, (NAC_TOP + nacBottom(29.4)) / 2, zc, 0, G_BODY);
    for (let k = 0; k < N; k++) m.tri(f[(k + 1) % N], f[k], cx, DARK, MAT_MATTE);
    // 尾喷口
    const r = rings[rings.length - 1];
    const cb = m.vert(X0 - 59.6 + 0.6, (NAC_TOP + nacBottom(59.6)) / 2, zc, 0, G_BODY);
    for (let k = 0; k < N; k++) m.tri(r[k], r[(k + 1) % N], cb, DARK, MAT_MATTE);
  }

  function cyl(m, cx, cy, cz, r, w, grp, col, axis = 'z', n = 12) {
    // 沿 axis 方向的圆柱（轮子）
    const rows = [];
    for (const side of [-1, 1]) {
      const ring = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const u = Math.cos(a) * r, v = Math.sin(a) * r;
        if (axis === 'z') ring.push(m.vert(cx + u, cy + v, cz + side * w / 2, 0, grp));
        else ring.push(m.vert(cx + side * w / 2, cy + u, cz + v, 0, grp));
      }
      rows.push(ring);
    }
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      m.quad(rows[0][k], rows[0][k2], rows[1][k2], rows[1][k], col, MAT_MATTE);
    }
    for (let k = 1; k < n - 1; k++) {
      m.tri(rows[1][0], rows[1][k], rows[1][k + 1], TYRE, MAT_MATTE);
      m.tri(rows[0][0], rows[0][k + 1], rows[0][k], TYRE, MAT_MATTE);
    }
  }
  function box(m, x0, x1, y0, y1, z0, z1, grp, col, mat = MAT_METAL) {
    const p = (x, y, z) => m.vert(x, y, z, 0, grp);
    const a = p(x0, y0, z0), b = p(x1, y0, z0), c = p(x1, y1, z0), d = p(x0, y1, z0);
    const e = p(x0, y0, z1), f = p(x1, y0, z1), g = p(x1, y1, z1), h = p(x0, y1, z1);
    m.quad(a, d, c, b, col, mat); m.quad(e, f, g, h, col, mat);
    m.quad(a, e, h, d, col, mat); m.quad(b, c, g, f, col, mat);
    m.quad(d, h, g, c, col, mat); m.quad(a, b, f, e, col, mat);
  }

  function buildGear(m) {
    m.cls = K_NG;
    // 前起落架：位于 s≈9.8，轴线正下方
    const nx = X0 - 9.8;
    box(m, nx - 0.09, nx + 0.09, -3.9, -1.5, -0.09, 0.09, G_NOSEGEAR, STRUT);
    cyl(m, nx, -4.1, -0.3, 0.46, 0.2, G_NOSEGEAR, TYRE);
    cyl(m, nx, -4.1, 0.3, 0.46, 0.2, G_NOSEGEAR, TYRE);
    box(m, nx - 0.04, nx + 0.04, -4.15, -4.05, -0.34, 0.34, G_NOSEGEAR, STRUT);
    // 着陆灯
    const lampv = (x, y, z) => m.vert(x, y, z, 0, G_NOSEGEAR);
    const a = lampv(nx + 0.4, -2.1, -0.2), b = lampv(nx + 0.4, -2.1, 0.2), c = lampv(nx + 0.4, -1.8, 0.2), d = lampv(nx + 0.4, -1.8, -0.2);
    m.quad(a, b, c, d, [8, 8, 8], MAT_MATTE, F_EMIT);
    // 主起落架：每侧 4 轮（两排）
    for (const sg of [1, -1]) {
      const grp = sg > 0 ? G_MAINGEAR_R : G_MAINGEAR_L;
      const mx = X0 - 41.0, z = sg * 2.7;
      box(m, mx - 0.13, mx + 0.13, -3.9, -1.6, z - 0.13, z + 0.13, grp, STRUT);
      box(m, mx - 1.35, mx + 1.35, -4.12, -3.98, z - 0.1, z + 0.1, grp, STRUT);
      for (const dx of [-0.95, 0.95]) for (const dz of [-0.36, 0.36]) cyl(m, mx + dx, -4.0, z + dz, 0.56, 0.3, grp, TYRE);
    }
  }

  function finalize(m) {
    const nv = m.v.length / 3, nf = m.f.length;
    const M = {
      nv, nf,
      V: new Float64Array(m.v), NW: new Float32Array(m.nw), GRP: new Uint8Array(m.grp),
      F: new Int32Array(nf * 4), FC: new Float32Array(nf * 3), FM: new Float32Array(nf * 3), FF: new Uint8Array(nf), FK: new Uint8Array(nf),
    };
    for (let i = 0; i < nf; i++) {
      const f = m.f[i];
      for (let k = 0; k < 4; k++) M.F[i * 4 + k] = f.i[k];
      M.FC[i * 3] = f.col[0]; M.FC[i * 3 + 1] = f.col[1]; M.FC[i * 3 + 2] = f.col[2];
      M.FM[i * 3] = f.mat.spec; M.FM[i * 3 + 1] = f.mat.shin; M.FM[i * 3 + 2] = f.mat.refl;
      M.FF[i] = f.flags; M.FK[i] = f.cls;
    }
    return M;
  }

  // ---------- 摄像机 ----------
  class Camera {
    constructor(W = 1920, H = 1080) {
      this.W = W; this.H = H; this.cx = W / 2; this.cy = H / 2;
      this.eye = [0, 0, 0]; this.fwd = [1, 0, 0]; this.right = [0, 0, 1]; this.up = [0, 1, 0];
      this.fovDeg = 40; this.f = (H / 2) / Math.tan((40 * Math.PI) / 360);
    }
    lookAt(eye, target, roll = 0, fovDeg = this.fovDeg) {
      this.eye = eye;
      const f = U.V.norm(U.V.sub(target, eye));
      let r = U.V.cross(f, [0, 1, 0]);
      if (Math.hypot(r[0], r[1], r[2]) < 1e-6) r = [0, 0, 1];
      r = U.V.norm(r);
      let u = U.V.cross(r, f);
      if (roll) {
        const c = Math.cos(roll), s = Math.sin(roll);
        const r2 = U.V.add(U.V.scale(r, c), U.V.scale(u, s));
        const u2 = U.V.add(U.V.scale(u, c), U.V.scale(r, -s));
        r = r2; u = u2;
      }
      this.fwd = f; this.right = r; this.up = u;
      this.fovDeg = fovDeg;
      this.f = (this.H / 2) / Math.tan((fovDeg * Math.PI) / 360);
      return this;
    }
    /** 把世界点投影到屏幕，返回 [x, y, depth]；depth<=0 表示在相机后方 */
    project(p, out) {
      const dx = p[0] - this.eye[0], dy = p[1] - this.eye[1], dz = p[2] - this.eye[2];
      const f = this.fwd, r = this.right, u = this.up;
      const zc = dx * f[0] + dy * f[1] + dz * f[2];
      const xc = dx * r[0] + dy * r[1] + dz * r[2];
      const yc = dx * u[0] + dy * u[1] + dz * u[2];
      const k = this.f / (zc > 1e-4 ? zc : 1e-4);
      out = out || [0, 0, 0];
      out[0] = this.cx + xc * k; out[1] = this.cy - yc * k; out[2] = zc;
      return out;
    }
    /** 屏幕上 1 米对应多少像素（在 depth 处） */
    ppm(depth) { return this.f / Math.max(depth, 1e-3); }
  }

  // ---------- 主模型 ----------
  const MESH = new Mesh();
  buildFuselage(MESH);
  buildWing(MESH, 1); buildWing(MESH, -1);
  buildFin(MESH);
  for (const sg of [1, -1]) for (const zc of NAC_Z) buildNacelle(MESH, sg * zc);
  buildGear(MESH);
  const MODEL = finalize(MESH);

  const NOSE_PIVOT = [X0 - 12.6, 0.1];
  const NOSEGEAR_PIVOT = [X0 - 9.8, -1.45];
  const MAINGEAR_PIVOT_Y = -1.6, MAINGEAR_Z = 2.7;

  // 预分配缓冲
  const wx = new Float64Array(MODEL.nv), wy = new Float64Array(MODEL.nv), wz = new Float64Array(MODEL.nv);
  const px = new Float64Array(MODEL.nv), py = new Float64Array(MODEL.nv), pz = new Float64Array(MODEL.nv);
  const order = new Array(MODEL.nf);
  const depthA = new Float64Array(MODEL.nf);
  const colA = new Array(MODEL.nf);
  const sh = { r: 0, g: 0, b: 0 };

  const tone = (x) => { x = Math.max(0, x); return x < 0.82 ? x : 0.82 + 0.18 * Math.tanh((x - 0.82) / 0.18); };
  const toSRGB = (x) => Math.round(255 * Math.pow(tone(x), 1 / 2.2));

  function envColor(env, dy, rdotl) {
    // 简化的天空/地面环境色
    let r, g, b;
    if (dy >= 0) {
      const t = Math.sqrt(dy);
      r = lerp(env.skyMid[0], env.skyTop[0], t); g = lerp(env.skyMid[1], env.skyTop[1], t); b = lerp(env.skyMid[2], env.skyTop[2], t);
    } else {
      const t = Math.sqrt(-dy);
      r = lerp(env.skyMid[0], env.ground[0], t); g = lerp(env.skyMid[1], env.ground[1], t); b = lerp(env.skyMid[2], env.ground[2], t);
    }
    if (rdotl > 0) {
      const glow = Math.pow(rdotl, 6) * 0.25 + Math.pow(rdotl, 90) * 2.5;
      r += env.sun[0] * glow; g += env.sun[1] * glow; b += env.sun[2] * glow;
    }
    sh.r = r; sh.g = g; sh.b = b;
  }

  /**
   * 绘制飞机
   * pose: {pos:[x,y,z], yaw, pitch, roll, droop(度), gear(0..1，1=放下), scale}
   * env:  光照环境，见上
   * opts: {wire: {color, alpha, width}, noFill, fog:{color,density}}
   */
  function draw(ctx, cam, pose, env, opts = {}) {
    const M = MODEL;
    const R = U.rotYPR(pose.yaw || 0, pose.pitch || 0, pose.roll || 0);
    const sc = pose.scale || 1;
    const T = pose.pos;
    const droop = ((pose.droop || 0) * Math.PI) / 180;
    const gear = pose.gear === undefined ? 1 : pose.gear;
    const gearRet = (1 - gear) * Math.PI * 0.5;
    const showGear = gear > 0.02;
    const cn = Math.cos(-droop), sn = Math.sin(-droop);
    const ngc = Math.cos(-gearRet), ngs = Math.sin(-gearRet);
    const V = M.V;
    // 变形 + 世界变换
    for (let i = 0; i < M.nv; i++) {
      let x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2];
      const g = M.GRP[i];
      if (g === G_BODY) {
        const w = M.NW[i];
        if (w > 0 && droop !== 0) {
          const a = -droop * w;
          const ca = Math.cos(a), sa = Math.sin(a);
          const dx = x - NOSE_PIVOT[0], dy = y - NOSE_PIVOT[1];
          x = NOSE_PIVOT[0] + dx * ca - dy * sa; y = NOSE_PIVOT[1] + dx * sa + dy * ca;
        }
      } else if (g === G_NOSEGEAR) {
        if (gearRet > 0) {
          const dx = x - NOSEGEAR_PIVOT[0], dy = y - NOSEGEAR_PIVOT[1];
          x = NOSEGEAR_PIVOT[0] + dx * ngc - dy * ngs; y = NOSEGEAR_PIVOT[1] + dx * ngs + dy * ngc;
        }
      } else if (gearRet > 0) {
        const sg = g === G_MAINGEAR_R ? 1 : -1;
        const dy = y - MAINGEAR_PIVOT_Y, dz = (z - sg * MAINGEAR_Z);
        const b = gearRet * sg;
        const cb = Math.cos(b), sb = Math.sin(b);
        y = MAINGEAR_PIVOT_Y + dy * cb - dz * sb; z = sg * MAINGEAR_Z + dy * sb + dz * cb;
      }
      x *= sc; y *= sc; z *= sc;
      wx[i] = R[0] * x + R[1] * y + R[2] * z + T[0];
      wy[i] = R[3] * x + R[4] * y + R[5] * z + T[1];
      wz[i] = R[6] * x + R[7] * y + R[8] * z + T[2];
      // 屏幕投影
      const dx = wx[i] - cam.eye[0], dy = wy[i] - cam.eye[1], dz = wz[i] - cam.eye[2];
      const zc = dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2];
      const xc = dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2];
      const yc = dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2];
      const k = cam.f / (zc > 0.05 ? zc : 0.05);
      px[i] = cam.cx + xc * k; py[i] = cam.cy - yc * k; pz[i] = zc;
    }

    const L = env.L;
    const ex = cam.eye[0], ey = cam.eye[1], ez = cam.eye[2];
    const F = M.F, FC = M.FC, FM = M.FM, FF = M.FF;
    let cnt = 0;
    const showCockpit = droop > 0.04;
    for (let fi = 0; fi < M.nf; fi++) {
      const flags = FF[fi];
      if ((flags & F_COCKPIT) && !showCockpit) continue;
      const i0 = F[fi * 4], i1 = F[fi * 4 + 1], i2 = F[fi * 4 + 2], i3 = F[fi * 4 + 3];
      if (!showGear && M.GRP[i0] > 0) continue;
      const quad = i3 >= 0;
      const d3 = quad ? i3 : i2;
      // 法线：对角线叉积
      const ax = wx[i2] - wx[i0], ay = wy[i2] - wy[i0], az = wz[i2] - wz[i0];
      const bx = wx[d3] - wx[i1], by = wy[d3] - wy[i1], bz = wz[d3] - wz[i1];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-9) continue;
      nx /= nl; ny /= nl; nz /= nl;
      // 面中心
      const cxw = quad ? (wx[i0] + wx[i1] + wx[i2] + wx[i3]) * 0.25 : (wx[i0] + wx[i1] + wx[i2]) / 3;
      const cyw = quad ? (wy[i0] + wy[i1] + wy[i2] + wy[i3]) * 0.25 : (wy[i0] + wy[i1] + wy[i2]) / 3;
      const czw = quad ? (wz[i0] + wz[i1] + wz[i2] + wz[i3]) * 0.25 : (wz[i0] + wz[i1] + wz[i2]) / 3;
      let vx = ex - cxw, vy = ey - cyw, vz = ez - czw;
      const vl = Math.hypot(vx, vy, vz);
      vx /= vl; vy /= vl; vz /= vl;
      const ndv = nx * vx + ny * vy + nz * vz;
      if (ndv <= 0 && !(flags & F_TWOSIDE)) continue;
      // 近裁剪
      if (pz[i0] < 0.3 || pz[i1] < 0.3 || pz[i2] < 0.3 || (quad && pz[i3] < 0.3)) continue;

      // ---- 着色（线性空间）----
      const cr = FC[fi * 3], cg = FC[fi * 3 + 1], cb = FC[fi * 3 + 2];
      let r, g, b;
      if (flags & F_EMIT) {
        r = cr; g = cg; b = cb;
      } else {
        const ndl = nx * L[0] + ny * L[1] + nz * L[2];
        const wrap = Math.max(0, (ndl + 0.18) / 1.18);
        // 半球环境光
        let ar, ag, ab;
        if (ny >= 0) { ar = lerp(env.skyMid[0], env.skyTop[0], ny); ag = lerp(env.skyMid[1], env.skyTop[1], ny); ab = lerp(env.skyMid[2], env.skyTop[2], ny); }
        else { ar = lerp(env.skyMid[0], env.ground[0], -ny); ag = lerp(env.skyMid[1], env.ground[1], -ny); ab = lerp(env.skyMid[2], env.ground[2], -ny); }
        const A = env.amb;
        r = cr * (ar * A + env.sun[0] * wrap); g = cg * (ag * A + env.sun[1] * wrap); b = cb * (ab * A + env.sun[2] * wrap);
        // 高光 + 环境反射
        const spec = FM[fi * 3], shin = FM[fi * 3 + 1], refl = FM[fi * 3 + 2];
        if (spec > 0) {
          const hx = L[0] + vx, hy = L[1] + vy, hz = L[2] + vz;
          const hl = Math.hypot(hx, hy, hz) || 1;
          const nh = (nx * hx + ny * hy + nz * hz) / hl;
          if (nh > 0 && ndl > 0) {
            const sp = Math.pow(nh, shin) * spec * env.spec;
            r += env.sun[0] * sp; g += env.sun[1] * sp; b += env.sun[2] * sp;
          }
          const fres = 0.05 + 0.95 * Math.pow(1 - ndv, 5);
          const rx = 2 * ndv * nx - vx, ry = 2 * ndv * ny - vy, rz = 2 * ndv * nz - vz;
          envColor(env, ry, rx * L[0] + ry * L[1] + rz * L[2]);
          const k = refl * env.refl * (0.25 + fres * 1.6);
          r += sh.r * k; g += sh.g * k; b += sh.b * k;
        }
        // 边缘光（逆光时的金边）
        if (env.rimK > 0) {
          const back = 0.5 - 0.5 * (vx * L[0] + vy * L[1] + vz * L[2]); // 逆光程度 0..1
          const rim = Math.pow(1 - ndv, 2.6) * env.rimK * (0.2 + 0.8 * back) * clamp(0.1 + 1.1 * (ndl + 0.3), 0, 1);
          r += env.rim[0] * rim; g += env.rim[1] * rim; b += env.rim[2] * rim;
        }
        // 大气雾
        if (opts.fog) {
          const f = 1 - Math.exp(-opts.fog.density * vl);
          r = lerp(r, opts.fog.color[0], f); g = lerp(g, opts.fog.color[1], f); b = lerp(b, opts.fog.color[2], f);
        }
        r *= env.exposure; g *= env.exposure; b *= env.exposure;
      }
      // 贴花略微靠前
      depthA[fi] = (pz[i0] + pz[i1] + pz[i2] + (quad ? pz[i3] : pz[i2])) * 0.25 - ((flags & (F_DECAL | F_COCKPIT)) ? 0.35 : 0);
      colA[fi] = `rgb(${toSRGB(r)},${toSRGB(g)},${toSRGB(b)})`;
      order[cnt++] = fi;
    }
    // 画家算法：先按分层（相机在翼面上方/下方有不同的层序），层内再按深度由远到近
    const camLocalY = (() => {
      // 相机相对机翼平面的高度（沿机体 Y 轴）
      const dx = cam.eye[0] - T[0], dy = cam.eye[1] - T[1], dz = cam.eye[2] - T[2];
      return (R[1] * dx + R[4] * dy + R[7] * dz) / sc - WING_Y0;
    })();
    const camDist = Math.hypot(cam.eye[0] - T[0], cam.eye[1] - T[1], cam.eye[2] - T[2]) / sc;
    const above = camLocalY / camDist > 0.1;
    const rankAbove = [3, 2, 1, 0], rankBelow = [0, 1, 2, 3]; // 索引：K_UP, K_WING, K_LOW, K_NG
    const rk = above ? rankAbove : rankBelow;
    const FK = M.FK;
    for (let n = 0; n < cnt; n++) { const fi = order[n]; depthA[fi] = rk[FK[fi]] * 1e6 - depthA[fi]; }
    const ord = order.slice(0, cnt);
    ord.sort((a, b) => depthA[a] - depthA[b]);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.9;
    for (let n = 0; n < cnt; n++) {
      const fi = ord[n];
      const i0 = F[fi * 4], i1 = F[fi * 4 + 1], i2 = F[fi * 4 + 2], i3 = F[fi * 4 + 3];
      ctx.beginPath();
      ctx.moveTo(px[i0], py[i0]); ctx.lineTo(px[i1], py[i1]); ctx.lineTo(px[i2], py[i2]);
      if (i3 >= 0) ctx.lineTo(px[i3], py[i3]);
      ctx.closePath();
      if (!opts.noFill) { ctx.fillStyle = colA[fi]; ctx.strokeStyle = colA[fi]; ctx.fill(); ctx.stroke(); }
      if (opts.wire) {
        ctx.strokeStyle = opts.wire.color; ctx.globalAlpha = opts.wire.alpha === undefined ? 1 : opts.wire.alpha;
        ctx.lineWidth = opts.wire.width || 0.8; ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 0.9;
      }
    }
    ctx.restore();
    return cnt;
  }

  /** 世界坐标锚点：尾喷口、翼尖灯、尾灯、机头灯等 */
  function anchors(pose) {
    const R = U.rotYPR(pose.yaw || 0, pose.pitch || 0, pose.roll || 0);
    const sc = pose.scale || 1;
    const T = pose.pos;
    const droop = ((pose.droop || 0) * Math.PI) / 180;
    const tf = (x, y, z) => {
      x *= sc; y *= sc; z *= sc;
      return [R[0] * x + R[1] * y + R[2] * z + T[0], R[3] * x + R[4] * y + R[5] * z + T[1], R[6] * x + R[7] * y + R[8] * z + T[2]];
    };
    const nozzles = [];
    for (const sg of [-1, 1]) for (const zc of NAC_Z) nozzles.push(tf(X0 - 59.6, (NAC_TOP + nacBottom(59.6)) / 2, sg * zc));
    // 机头尖端（含下垂）
    const dx = LEN * 0 + X0 - NOSE_PIVOT[0], dy = 0 - NOSE_PIVOT[1];
    const ca = Math.cos(-droop), sa = Math.sin(-droop);
    const nose = tf(NOSE_PIVOT[0] + dx * ca - dy * sa, NOSE_PIVOT[1] + dx * sa + dy * ca, 0);
    return {
      nozzles, nose,
      tipR: tf(X0 - 54.5, WING_Y0, SPAN_HALF), tipL: tf(X0 - 54.5, WING_Y0, -SPAN_HALF),
      tail: tf(X0 - 61.5, 4.5, 0), finTop: tf(X0 - 60.4, FIN_TIP_Y, 0),
      belly: tf(X0 - 30, -1.7, 0), noseGear: tf(X0 - 9.8 + 0.5, -2.0, 0),
      mainGearL: tf(X0 - 41, GROUND_Y, -2.7), mainGearR: tf(X0 - 41, GROUND_Y, 2.7), dirFwd: [R[0], R[3], R[6]],
      dirUp: [R[1], R[4], R[7]], dirRight: [R[2], R[5], R[8]],
    };
  }

  /** 机体坐标（X 向前）→ 世界坐标 */
  function toWorld(pose, p) {
    const R = U.rotYPR(pose.yaw || 0, pose.pitch || 0, pose.roll || 0);
    const sc = pose.scale || 1;
    const x = p[0] * sc, y = p[1] * sc, z = p[2] * sc;
    return [R[0] * x + R[1] * y + R[2] * z + pose.pos[0], R[3] * x + R[4] * y + R[5] * z + pose.pos[1], R[6] * x + R[7] * y + R[8] * z + pose.pos[2]];
  }

  G.Concorde = {
    LEN, X0, SPAN_HALF, GROUND_Y, Camera, draw, anchors, toWorld, MODEL,
    profile: { fusHW, fusHH, fusYC, fusTop, wingLE, wingTE, finLE, finTE, FIN_ROOT_Y, FIN_TIP_Y, NAC_Z, NAC_W, NAC_S0, NAC_S1, NAC_TOP, nacBottom, WING_Y0, NOSE_L },
  };
})(typeof window !== 'undefined' ? window : globalThis);
