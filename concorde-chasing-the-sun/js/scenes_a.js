/* 协和逐日 · 序章 + 第一幕「图纸」 */
(function (G) {
  'use strict';
  const { W, H, BAR } = gfx;
  const { clamp, lerp, smooth, ramp, ease } = U;
  const P = Concorde.profile;
  const LEN = Concorde.LEN;
  Film.typing = Film.typing || [];

  // =====================================================================
  // 序章（0–6 s）：黑暗、星光、一道地平线
  // =====================================================================
  Film.register({
    id: 'intro', t0: TL.intro[0], t1: TL.intro[1], post: { bloom: 0.6 },
    draw(ctx, t, T) {
      ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
      // 夜空渐变
      gfx.gradV(ctx, 0, H, [[0, '#02030a'], [0.6, '#070b1d'], [1, '#1a1330']]);
      gfx.drawStars(ctx, T, ramp(t, 0.3, 2.2), H, { dx: t * 3 });
      // 地平线暖光缓缓升起
      const k = smooth(ramp(t, 0.5, 6));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      gfx.put(ctx, gfx.glow(255, 140, 70, 1.3), W / 2, H * 0.55 + (1 - k) * 160, 1100, 0.5 * k, 0.32);
      gfx.put(ctx, gfx.glow(255, 200, 150, 1.0), W / 2, H * 0.55 + (1 - k) * 160, 380, 0.5 * k, 0.12);
      ctx.restore();
      // 一道发光的线：从中心向两侧展开
      const lw = ease.outCubic(ramp(t, 0.5, 3.2)) * 1500;
      const la = (1 - smooth(ramp(t, 3.6, 5.6))) * 0.9 * smooth(ramp(t, 0.5, 1.2));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createLinearGradient(W / 2 - lw / 2, 0, W / 2 + lw / 2, 0);
      lg.addColorStop(0, 'rgba(255,200,140,0)'); lg.addColorStop(0.5, `rgba(255,236,205,${la})`); lg.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = lg; ctx.fillRect(W / 2 - lw / 2, H * 0.5 - 1, lw, 2);
      gfx.put(ctx, gfx.glow(255, 200, 140, 1.2), W / 2, H * 0.5, lw * 0.5, la * 0.25, 0.04);
      ctx.restore();
      // 向蓝图过渡
      const f = ramp(t, 5.2, 6);
      if (f > 0) { ctx.fillStyle = `rgba(4,22,45,${f})`; ctx.fillRect(0, 0, W, H); }
    },
  });
  Film.cue({ kind: 'big', t0: 0.9, t1: 4.6, zh: '曾有一架客机，', y: 500, size: 62, track: 16, weight: 400, type: 1.3, fo: 0.9, glow: { color: 'rgba(255,200,150,0.35)', blur: 24 } });
  Film.cue({ kind: 'big', t0: 2.3, t1: 5.6, zh: '飞得比太阳还快。', y: 590, size: 62, track: 16, weight: 400, type: 1.5, fo: 0.9, glow: { color: 'rgba(255,200,150,0.35)', blur: 24 },
    en: 'THERE WAS ONCE AN AIRLINER THAT OUTRAN THE SUN', enSize: 17, enDy: 54, enTrack: 9 });
  Film.typing.push({ t0: 0.9, n: 7, cps: 5.4, kind: 'soft' }, { t0: 2.3, n: 8, cps: 5.4, kind: 'soft' });

  // =====================================================================
  // 第一幕「图纸」（6–30 s）
  // =====================================================================
  const K = 16.4, XL = 150, YT = 318, YS = 692;
  const TX = (s) => XL + (LEN - s) * K;
  const TYz = (z) => YT + z * K;
  const SYy = (y) => YS - y * K;

  function mkPath(pts, o) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return Object.assign({ pts, cum, len: cum[cum.length - 1], w: 1.6, a: 1, dash: null, closed: false }, o);
  }

  const paths = [];
  (function build() {
    // —— 俯视图 ——
    const fusTop = [], fusBot = [];
    for (let s = 0; s <= LEN + 0.001; s += 0.7) {
      const ss = Math.min(s, LEN);
      fusTop.push([TX(ss), TYz(-P.fusHW(ss))]); fusBot.push([TX(ss), TYz(P.fusHW(ss))]);
    }
    const fus = fusTop.concat(fusBot.reverse());
    fus.push(fus[0]);
    paths.push(mkPath(fus, { t0: 0.8, t1: 4.2, closed: true, fill: true, id: 'fusT' }));
    for (const sg of [-1, 1]) {
      const pts = [];
      // 前缘 → 翼尖 → 后缘
      for (let z = 1.2; z <= 12.8001; z += 0.4) pts.push([TX(P.wingLE(z)), TYz(sg * z)]);
      pts.push([TX(P.wingLE(12.8)), TYz(sg * 12.8)]);
      pts.push([TX(P.wingTE(12.8)), TYz(sg * 12.8)]);
      for (let z = 12.8; z >= 1.2; z -= 0.8) pts.push([TX(P.wingTE(z)), TYz(sg * z)]);
      pts.push([TX(P.wingTE(1.2)), TYz(sg * 1.2)]);
      paths.push(mkPath(pts, { t0: 2.6 + (sg > 0 ? 0.5 : 0), t1: 6.2 + (sg > 0 ? 0.5 : 0), fill: true, id: 'wing' }));
      // 升降副翼分割线
      const el = [];
      for (let z = 1.8; z <= 12.5; z += 0.9) el.push([TX(lerp(P.wingLE(z), P.wingTE(z), 0.78)), TYz(sg * z)]);
      paths.push(mkPath(el, { t0: 6.0, t1: 7.4, dash: [6, 6], w: 1, a: 0.7 }));
      // 发动机
      for (const zc of P.NAC_Z) {
        const z0 = sg * (zc - P.NAC_W), z1 = sg * (zc + P.NAC_W);
        paths.push(mkPath([[TX(P.NAC_S0), TYz(z0)], [TX(P.NAC_S0), TYz(z1)], [TX(P.NAC_S1), TYz(z1)], [TX(P.NAC_S1), TYz(z0)], [TX(P.NAC_S0), TYz(z0)]], { t0: 5.0 + zc * 0.1, t1: 7.2, w: 1.3, a: 0.9 }));
      }
    }
    // 中心线（点划线）
    paths.push(mkPath([[TX(-3), YT], [TX(LEN + 3), YT]], { t0: 0.4, t1: 2.5, dash: [18, 5, 3, 5], w: 1, a: 0.5 }));
    paths.push(mkPath([[TX(-3), YS], [TX(LEN + 3), YS]], { t0: 5.4, t1: 7, dash: [18, 5, 3, 5], w: 1, a: 0.5 }));

    // —— 侧视图 ——
    const top = [], bot = [];
    for (let s = 0; s <= LEN + 0.001; s += 0.7) {
      const ss = Math.min(s, LEN);
      top.push([TX(ss), SYy(P.fusYC(ss) + P.fusHH(ss))]); bot.push([TX(ss), SYy(P.fusYC(ss) - P.fusHH(ss))]);
    }
    const sfus = top.concat(bot.reverse()); sfus.push(sfus[0]);
    paths.push(mkPath(sfus, { t0: 5.4, t1: 8.8, closed: true, fill: true, id: 'fusS' }));
    // 垂尾
    const fin = [];
    for (let y = P.FIN_ROOT_Y; y <= P.FIN_TIP_Y + 0.001; y += 0.5) fin.push([TX(P.finLE(y)), SYy(y)]);
    fin.push([TX(P.finTE(P.FIN_TIP_Y)), SYy(P.FIN_TIP_Y)]);
    for (let y = P.FIN_TIP_Y; y >= P.FIN_ROOT_Y; y -= 0.5) fin.push([TX(P.finTE(y)), SYy(y)]);
    paths.push(mkPath(fin, { t0: 7.0, t1: 9.0, fill: true, id: 'fin' }));
    // 机翼（侧视）
    paths.push(mkPath([[TX(P.wingLE(1.2)), SYy(P.WING_Y0)], [TX(P.wingTE(1.2)), SYy(P.WING_Y0)]], { t0: 7.6, t1: 8.6, w: 2.2 }));
    // 发动机短舱（侧视）
    const nac = [];
    for (let s = P.NAC_S0; s <= P.NAC_S1; s += 1) nac.push([TX(s), SYy(P.nacBottom(s))]);
    nac.push([TX(P.NAC_S1), SYy(P.NAC_TOP)]);
    nac.push([TX(P.NAC_S0), SYy(P.NAC_TOP)]);
    nac.push([TX(P.NAC_S0), SYy(P.nacBottom(P.NAC_S0))]);
    paths.push(mkPath(nac, { t0: 8.2, t1: 10, fill: true, id: 'nac' }));
    // 舷窗
    const win = [];
    for (let s = 13.4; s < 47; s += 0.86) win.push([[TX(s), SYy(0.36 + 0.14)], [TX(s), SYy(0.36 - 0.14)]]);
    for (let i = 0; i < win.length; i++) paths.push(mkPath(win[i], { t0: 9 + i * 0.03, t1: 9.15 + i * 0.03, w: 1.6, a: 0.8 }));
    // 起落架
    const g0 = Concorde.X0;
    const gnx = TX(9.8), gmx = TX(41);
    paths.push(mkPath([[gnx, SYy(-1.45)], [gnx, SYy(-4.0)]], { t0: 9.4, t1: 10.0, w: 1.6 }));
    paths.push(mkPath([[gmx, SYy(-1.6)], [gmx, SYy(-4.0)]], { t0: 9.4, t1: 10.0, w: 1.6 }));
    const circ = (cx, cy, r, t0) => { const pts = []; for (let i = 0; i <= 24; i++) pts.push([cx + Math.cos(i / 24 * Math.PI * 2) * r, cy + Math.sin(i / 24 * Math.PI * 2) * r]); return mkPath(pts, { t0, t1: t0 + 0.7, w: 1.4 }); };
    paths.push(circ(gnx, SYy(-4.1), 0.46 * K, 9.8));
    paths.push(circ(gmx - 0.95 * K, SYy(-4.0), 0.56 * K, 9.9)); paths.push(circ(gmx + 0.95 * K, SYy(-4.0), 0.56 * K, 9.9));
    // 地面线
    paths.push(mkPath([[XL - 40, SYy(Concorde.GROUND_Y)], [XL + LEN * K + 60, SYy(Concorde.GROUND_Y)]], { t0: 8.5, t1: 11, dash: [10, 6], w: 1, a: 0.55 }));
  })();

  function drawPartial(ctx, p, frac) {
    if (frac <= 0) return null;
    const L = p.len * Math.min(1, frac);
    ctx.beginPath(); ctx.moveTo(p.pts[0][0], p.pts[0][1]);
    let head = p.pts[0];
    for (let i = 1; i < p.pts.length; i++) {
      if (p.cum[i] <= L) { ctx.lineTo(p.pts[i][0], p.pts[i][1]); head = p.pts[i]; }
      else {
        const u = (L - p.cum[i - 1]) / (p.cum[i] - p.cum[i - 1]);
        head = [lerp(p.pts[i - 1][0], p.pts[i][0], u), lerp(p.pts[i - 1][1], p.pts[i][1], u)];
        ctx.lineTo(head[0], head[1]); break;
      }
    }
    return head;
  }

  function dimLine(ctx, x1, y1, x2, y2, label, prog, side = 1, numProg = 1, valueStr) {
    if (prog <= 0) return;
    const mx = lerp(x1, x2, 0.5), my = lerp(y1, y2, 0.5);
    const ex = lerp(mx, x1, prog), ey = lerp(my, y1, prog), fx = lerp(mx, x2, prog), fy = lerp(my, y2, prog);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,214,150,0.95)'; ctx.fillStyle = 'rgba(255,214,150,0.95)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(fx, fy); ctx.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    for (const [px, py, d] of [[ex, ey, 1], [fx, fy, -1]]) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang + (d > 0 ? 0 : Math.PI));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, -4.5); ctx.lineTo(14, 4.5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    if (prog > 0.6 && label) {
      const a = clamp((prog - 0.6) / 0.4);
      const str = valueStr || label;
      const w = gfx.measure(ctx, str, { size: 19, family: 'mono', track: 2 });
      ctx.save();
      ctx.translate(mx, my);
      if (Math.abs(y2 - y1) > Math.abs(x2 - x1)) ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = 'rgba(6,34,66,0.92)'; ctx.fillRect(-w / 2 - 10, -14, w + 20, 28);
      gfx.text(ctx, str, 0, 6, { size: 19, family: 'mono', color: 'rgba(255,224,170,1)', track: 2, align: 'center', alpha: a });
      ctx.restore();
    }
  }

  const ROWS = [
    ['AIRCRAFT', 'CONCORDE'],
    ['PROGRAMME', 'BAC × SUD AVIATION'],
    ['TREATY', '1962 . 11 . 29'],
    ['LENGTH', '61.66 m'],
    ['WINGSPAN', '25.60 m'],
    ['HEIGHT', '12.20 m'],
    ['TAKE-OFF WT', '185,000 kg'],
    ['ENGINES', '4 × OLYMPUS 593'],
    ['THRUST / REHEAT', '4 × 169 kN'],
    ['CRUISE', 'MACH 2.04'],
    ['CEILING', '18,300 m'],
  ];
  const ROW_T0 = 11.4, ROW_DT = 0.78;
  ROWS.forEach((r, i) => Film.typing.push({ t0: TL.blueprint[0] + ROW_T0 + i * ROW_DT, n: r[1].length + r[0].length * 0.4, cps: 28, kind: 'tick' }));

  function bp(ctx, t, T) {
    // —— 背景：深蓝晒图纸 ——
    gfx.gradV(ctx, 0, H, [[0, '#031427'], [1, '#08305a']]);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    gfx.put(ctx, gfx.glow(40, 120, 200, 1.4), W * 0.42, H * 0.5, 1100, 0.22, 0.6);
    ctx.restore();
    const ga = smooth(ramp(t, 0, 1.4));
    ctx.save();
    ctx.globalAlpha = ga;
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 24) { ctx.strokeStyle = (x % 120 === 0) ? 'rgba(150,205,255,0.13)' : 'rgba(150,205,255,0.05)'; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 24) { ctx.strokeStyle = (y % 120 === 0) ? 'rgba(150,205,255,0.13)' : 'rgba(150,205,255,0.05)'; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    ctx.restore();

    // —— 描线 ——
    const scanX = lerp(XL - 80, XL + LEN * K + 120, ramp(t, 17.2, 20.6));
    const heads = [];
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const p of paths) {
      const fr = ramp(t, p.t0, p.t1);
      if (fr <= 0) continue;
      ctx.setLineDash(p.dash || []);
      // 光晕层
      ctx.strokeStyle = 'rgba(110,200,255,0.22)'; ctx.lineWidth = p.w * 4.5; ctx.globalAlpha = p.a;
      const h = drawPartial(ctx, p, ease.inOutSine(fr)); ctx.stroke();
      ctx.strokeStyle = 'rgba(214,238,255,0.96)'; ctx.lineWidth = p.w;
      drawPartial(ctx, p, ease.inOutSine(fr)); ctx.stroke();
      ctx.globalAlpha = 1;
      if (fr < 1 && h) heads.push(h);
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 完成后的淡青色填充（随扫描线推进）
    if (t > 17.2) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, scanX, H); ctx.clip();
      ctx.fillStyle = 'rgba(150,215,255,0.12)';
      for (const p of paths) if (p.fill) { drawPartial(ctx, p, 1); ctx.fill(); }
      ctx.restore();
      // 扫描线
      const sa = 1 - ramp(t, 20.4, 21.4);
      if (sa > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const sg = ctx.createLinearGradient(scanX - 90, 0, scanX + 2, 0);
        sg.addColorStop(0, 'rgba(120,210,255,0)'); sg.addColorStop(1, `rgba(180,230,255,${0.35 * sa})`);
        ctx.fillStyle = sg; ctx.fillRect(scanX - 90, 92, 92, H - 184);
        ctx.fillStyle = `rgba(230,248,255,${0.9 * sa})`; ctx.fillRect(scanX, 92, 2, H - 184);
        ctx.restore();
      }
    }
    // 笔尖光点
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const h of heads) { gfx.put(ctx, gfx.glow(170, 225, 255, 1.2), h[0], h[1], 26, 0.9); gfx.put(ctx, gfx.glow(255, 255, 255, 1.2), h[0], h[1], 8, 1); }
    ctx.restore();

    // —— 视图标注 ——
    const lab = (s, x, y, t0, o = {}) => gfx.text(ctx, s, x, y, Object.assign({ size: 15, family: 'mono', color: 'rgba(160,215,255,0.8)', track: 4, alpha: smooth(ramp(t, t0, t0 + 0.8)) }, o));
    lab('PLAN  俯视', 520, 134, 3.0);
    lab('SIDE  侧视', 560, 612, 6.5);
    lab('SCALE 1:100', XL + LEN * K - 150, 134, 3.2);

    // —— 尺寸线 ——
    const dLen = ramp(t, 10.6, 12.6), dSpan = ramp(t, 11.2, 13.2), dH = ramp(t, 11.8, 13.6);
    dimLine(ctx, XL, 838, XL + LEN * K, 838, 'L', dLen, 1, 1, `${(61.66 * ease.outCubic(ramp(t, 11, 13.4))).toFixed(2)} m`);
    if (dLen > 0) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,214,150,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(XL, 700); ctx.lineTo(XL, 846); ctx.moveTo(XL + LEN * K, SYy(0)); ctx.lineTo(XL + LEN * K, 846); ctx.stroke(); ctx.restore();
    }
    dimLine(ctx, 88, TYz(-12.8), 88, TYz(12.8), 'S', dSpan, 1, 1, `${(25.6 * ease.outCubic(ramp(t, 11.6, 13.8))).toFixed(2)} m`);
    if (dSpan > 0) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,214,150,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(80, TYz(-12.8)); ctx.lineTo(TX(55) , TYz(-12.8)); ctx.moveTo(80, TYz(12.8)); ctx.lineTo(TX(55), TYz(12.8)); ctx.stroke(); ctx.restore();
    }
    dimLine(ctx, 118, SYy(P.FIN_TIP_Y), 118, SYy(Concorde.GROUND_Y), 'H', dH, 1, 1, `${(12.2 * ease.outCubic(ramp(t, 12.2, 14.2))).toFixed(2)} m`);

    // 角度标注：前缘后掠
    const aA = smooth(ramp(t, 14, 15));
    if (aA > 0) {
      const x0 = TX(P.wingLE(6)), y0 = TYz(-6);
      ctx.save(); ctx.globalAlpha = aA; ctx.strokeStyle = 'rgba(255,214,150,0.9)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(x0, y0, 5, 0, U.TAU); ctx.moveTo(x0 + 4, y0 - 4); ctx.lineTo(x0 + 70, y0 - 54); ctx.lineTo(x0 + 400, y0 - 54); ctx.stroke(); ctx.restore();
      gfx.text(ctx, 'LE SWEEP  75° → 60°', x0 + 84, y0 - 64, { size: 15, family: 'mono', color: 'rgba(255,224,170,1)', track: 3, alpha: aA });
    }

    // —— 右侧数据面板 ——
    const px = 1290, py = 150, pw = 520, ph = 640;
    const pa = smooth(ramp(t, 10.6, 11.8));
    if (pa > 0) {
      ctx.save(); ctx.globalAlpha = pa;
      ctx.fillStyle = 'rgba(4,28,56,0.55)'; ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(160,215,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
      ctx.strokeStyle = 'rgba(255,214,150,0.95)'; ctx.lineWidth = 2;
      for (const [cx, cy, dx, dy] of [[px, py, 1, 1], [px + pw, py, -1, 1], [px, py + ph, 1, -1], [px + pw, py + ph, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(cx + dx * 22, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * 22); ctx.stroke();
      }
      ctx.restore();
      gfx.text(ctx, 'SPECIFICATION  /  技术参数', px + 28, py + 44, { size: 15, family: 'mono', color: 'rgba(160,215,255,0.9)', track: 5, alpha: pa });
    }
    ROWS.forEach((r, i) => {
      const t0 = ROW_T0 + i * ROW_DT;
      const prog = ramp(t, t0, t0 + 0.65);
      if (prog <= 0) return;
      const y = py + 100 + i * 48;
      gfx.text(ctx, r[0], px + 28, y, { size: 16, family: 'mono', color: 'rgba(150,205,250,0.85)', track: 3 });
      // 引导点线
      const lw = gfx.measure(ctx, r[0], { size: 16, family: 'mono', track: 3 });
      ctx.save(); ctx.fillStyle = 'rgba(150,205,250,0.28)';
      for (let x = px + 28 + lw + 14; x < px + pw - 28 - gfx.measure(ctx, r[1], { size: 21, family: 'mono', track: 2 }) - 14; x += 8) ctx.fillRect(x, y - 3, 2, 2);
      ctx.restore();
      gfx.text(ctx, r[1], px + pw - 28, y + 1, { size: 21, family: 'mono', color: i === 0 ? 'rgba(255,224,170,1)' : '#eaf6ff', track: 2, align: 'right', progress: prog, weight: i === 0 ? 700 : 400 });
    });

    // 左上角标：日期戳
    const da = smooth(ramp(t, 1.2, 2.2));
    gfx.text(ctx, 'PROJECT  CONCORDE', 120, BAR + 52, { size: 15, family: 'mono', color: 'rgba(255,214,150,0.95)', track: 6, alpha: da * (1 - ramp(t, 4.2, 5)) });

    // —— 结尾：白光闪过，切入第二幕 ——
    const fl = ramp(t, 22.6, 24);
    if (fl > 0) { ctx.fillStyle = `rgba(255,248,235,${ease.inCubic(fl)})`; ctx.fillRect(0, 0, W, H); }
  }

  Film.register({ id: 'blueprint', t0: TL.blueprint[0], t1: TL.blueprint[1], post: { bloom: 0.55 }, draw: bp });
  Film.cue({ kind: 'chapter', t0: 6.6, t1: 10.6, num: 'CHAPTER  I', zh: '图纸', en: 'BLUEPRINT' });
  Film.cue({ t0: 8.2, t1: 14.0, zh: '1962 年 11 月 29 日，英国与法国签署条约，', en: '29 NOVEMBER 1962  ·  BRITAIN AND FRANCE SIGN THE TREATY', type: 2.2 });
  Film.cue({ t0: 14.6, t1: 20.5, zh: '决定共同研制一架超音速客机。', en: 'ONE AIRLINER. TWICE THE SPEED OF SOUND.', type: 1.8 });
  Film.cue({ t0: 22.0, t1: 28.6, zh: '那时，还没有人造出过。', en: 'NO ONE HAD EVER BUILT ONE.', type: 1.4, fo: 0.9 });
  Film.typing.push({ t0: 8.2, n: 21, cps: 9.5, kind: 'soft' }, { t0: 14.6, n: 14, cps: 8, kind: 'soft' }, { t0: 22.0, n: 11, cps: 8, kind: 'soft' });
})(typeof window !== 'undefined' ? window : globalThis);
