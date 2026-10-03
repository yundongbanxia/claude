/* 协和逐日 · 配乐与音效时间线 + 播放器
 *
 * 配乐：80 BPM、D 大调 / b 小调，一共 68 小节（每小节 3 秒，与画面时间线逐小节对齐）。
 * 音效：根据影片里的同步点（起飞、音爆、倒走的钟……）逐一排好。
 * 所有声音都是实时合成的，没有任何采样文件。
 */
(function (G) {
  'use strict';
  const { I, S, mtof, automate } = AE;
  const { clamp, lerp, smooth, ramp } = U;

  const BAR = 3.0, BEAT = 0.75;
  const at = (bar, beat = 0) => bar * BAR + beat * BEAT;
  const R = U.rng(1976);
  const jit = () => (R() - 0.5) * 0.012;
  const vj = (v) => v * (0.92 + R() * 0.16);
  const EV = [];
  const ev = (t, dur, fn) => EV.push({ t, dur, fn });
  const shortEv = (t, fn) => ev(t, 0.02, (E, w, skip) => { if (skip > 0.02) return; fn(E, w); });
  const kf = (pts) => (t) => U.keyframes(pts, t);

  // 追加一个“断奏弦乐”音色
  I.stac = function (E, when, midi, vel = 0.5, len = 0.14, o = {}) {
    const out = AE.gn(E, 1), env = E.ctx.createGain();
    env.gain.setValueAtTime(0.0001, when); env.gain.linearRampToValueAtTime(0.15 * vel, when + 0.006); env.gain.exponentialRampToValueAtTime(0.0001, when + len + 0.12);
    const lp = AE.bq(E, 'lowpass', 900 + 2200 * vel, 0.6);
    for (const dt of [-8, 8]) { const oc = AE.osc(E, 'sawtooth', mtof(midi), when, when + len + 0.2, dt); oc.connect(lp); }
    lp.connect(env); env.connect(out); const pn = AE.panner(E, o.pan || 0); out.connect(pn); pn.connect(E.music); AE.send(E, pn, 0.22, o.dly || 0);
  };

  // ---------------------------------------------------------------- 和弦表
  const CH = {
    Bm: { bass: 35, root: 47, pad: [54, 59, 62, 66], tones: [47, 54, 59, 62, 66, 71, 74, 78, 83], triad: [59, 62, 66] },
    G: { bass: 31, root: 43, pad: [50, 55, 59, 62], tones: [43, 50, 55, 59, 62, 67, 71, 74, 79], triad: [55, 59, 62] },
    D: { bass: 38, root: 50, pad: [50, 54, 57, 62], tones: [50, 54, 57, 62, 66, 69, 74, 78, 81], triad: [54, 57, 62] },
    A: { bass: 33, root: 45, pad: [52, 57, 61, 64], tones: [45, 52, 57, 61, 64, 69, 73, 76, 81], triad: [57, 61, 64] },
    Em: { bass: 40, root: 40, pad: [47, 52, 55, 59], tones: [40, 47, 52, 55, 59, 64, 67, 71, 76], triad: [55, 59, 64] },
    Asus: { bass: 33, root: 45, pad: [52, 57, 62, 64], tones: [45, 52, 57, 62, 64, 69, 74, 76, 81], triad: [57, 62, 64] },
  };

  // ---------------------------------------------------------------- 编曲辅助
  function piano(t, midi, vel, dur, o) { const j = jit(), v = vj(vel); ev(t, 0.05, (E, w, skip) => { if (skip > 0.03) return; I.piano(E, w + j, midi, v, dur, o || {}); }); }
  function bell(t, midi, vel, o) { ev(t, 0.05, (E, w, skip) => { if (skip > 0.03) return; I.bell(E, w, midi, vel, o || {}); }); }
  function stac(t, midi, vel, len, o) { const j = jit(); ev(t, 0.05, (E, w, skip) => { if (skip > 0.03) return; I.stac(E, w + j, midi, vj(vel), len, o); }); }
  function bass(t, midi, vel, dur) { ev(t, dur, (E, w, skip) => { if (skip > 0.03) return; I.bass(E, w, midi, dur, vj(vel)); }); }
  function kick(t, v) { shortEv(t, (E, w) => I.kick(E, w, v)); }
  function taiko(t, v, p) { shortEv(t, (E, w) => I.taiko(E, w, v, p)); }
  function snare(t, v, o) { shortEv(t, (E, w) => I.snare(E, w, v, o)); }
  function hat(t, v, open) { shortEv(t, (E, w) => I.hat(E, w, v, open)); }
  function shaker(t, v) { shortEv(t, (E, w) => I.shaker(E, w, v)); }
  function crash(t, v, len) { shortEv(t, (E, w) => I.crash(E, w, v, len)); }
  function revCrash(t, dur, v) { ev(t, dur, (E, w, skip) => { if (skip > 0.1) return; I.revCrash(E, w, dur, v); }); }
  function riser(t, dur, v, o) { ev(t, dur, (E, w, skip) => { if (skip > 0.1) return; I.riser(E, w, dur, v, o); }); }
  function impact(t, v) { shortEv(t, (E, w) => I.impact(E, w, v)); }
  function duck(t, depth, rel) { ev(t - 0.03, 0.1, (E, w) => { const g = E.musicDuck.gain; g.cancelScheduledValues(w); g.setValueAtTime(1, w); g.linearRampToValueAtTime(depth, w + 0.04); g.setTargetAtTime(1, w + 0.12, rel / 3); }); }
  function padRun(bar0, prog, vol, fn) {
    let i = 0;
    while (i < prog.length) {
      let j = i; while (j + 1 < prog.length && prog[j + 1] === prog[i]) j++;
      const c = CH[prog[i]], n = j - i + 1, t = at(bar0 + i);
      ev(t, n * BAR + 0.4, (E, w, skip) => (fn || I.pad)(E, w, n * BAR + 0.4 - skip * 0, c.pad, vol, skip));
      i = j + 1;
    }
  }
  const P8 = [0, 2, 3, 4, 3, 2, 3, 4];
  const P16 = [0, 2, 3, 4, 3, 2, 3, 5, 0, 2, 3, 5, 4, 3, 2, 3];
  function arp(bar, ch, vel, pat, step, dur, o) {
    const c = CH[ch];
    pat.forEach((ix, k) => piano(at(bar, k * step), c.tones[2 + ix], vel * (k % 4 === 0 ? 1.1 : 0.88), dur, o));
  }
  function bassPulse(bar, ch, vel, pat) { // pat: 8 个八分音符位置的 0/1
    const c = CH[ch];
    pat.forEach((on, k) => { if (on) bass(at(bar, k * 0.5), c.bass + (k % 4 === 3 ? 12 : 0), vel * (k % 2 ? 0.8 : 1), 0.34); });
  }
  function melody(bar0, notes, fn) { // notes: [bar, beat, midi, beats]
    for (const [b, bt, m, d] of notes) fn(at(bar0 + b, bt), m, d * BEAT);
  }

  // ======================================================================
  //  主题旋律（相对小节号）
  // ======================================================================
  const THEME_A = [
    [0, 0, 78, 1.5], [0, 1.5, 74, 0.5], [0, 2, 76, 1], [0, 3, 78, 1],
    [1, 0, 79, 1.5], [1, 1.5, 78, 0.5], [1, 2, 76, 1], [1, 3, 74, 1],
    [2, 0, 74, 1.5], [2, 1.5, 78, 0.5], [2, 2, 81, 1.5], [2, 3.5, 79, 0.5],
    [3, 0, 78, 2], [3, 2, 76, 1], [3, 3, 73, 1],
  ];
  const THEME_A2 = [
    [0, 0, 78, 1.5], [0, 1.5, 74, 0.5], [0, 2, 76, 1], [0, 3, 78, 1],
    [1, 0, 79, 1.5], [1, 1.5, 81, 0.5], [1, 2, 83, 2],
    [2, 0, 83, 1.5], [2, 1.5, 81, 0.5], [2, 2, 79, 1], [2, 3, 76, 1],
    [3, 0, 73, 1], [3, 1, 76, 1], [3, 2, 81, 2],
  ];
  const THEME_C = [ // 高潮：G | D | Bm | A
    [0, 0, 83, 2], [0, 2, 81, 1], [0, 3, 79, 1],
    [1, 0, 78, 1.5], [1, 1.5, 81, 0.5], [1, 2, 86, 2],
    [2, 0, 85, 1.5], [2, 1.5, 83, 0.5], [2, 2, 81, 1], [2, 3, 78, 1],
    [3, 0, 76, 1], [3, 1, 81, 1], [3, 2, 85, 2],
  ];
  const THEME_P = [ // 舷窗：D D A A Bm G
    [0, 0, 74, 2], [0, 2, 78, 1], [0, 3, 81, 1], [1, 0, 79, 2], [1, 2, 78, 2],
    [2, 0, 76, 2], [2, 2, 73, 1], [2, 3, 76, 1], [3, 0, 81, 3],
    [4, 0, 78, 2], [4, 2, 74, 2], [5, 0, 79, 3], [5, 3, 78, 1],
  ];

  // ======================================================================
  //  配乐
  // ======================================================================
  function buildMusic() {
    // ---- 序章 0–6 s ----
    ev(0, 6.6, (E, w, skip) => S.drone(E, w, 0, 6.6, [38, 45], kf([[0, 0], [1.5, 0.03], [6, 0.07], [6.6, 0.0]]), skip));
    [[1.9, 86], [3.1, 81], [3.9, 90], [4.7, 88], [5.3, 93]].forEach(([t, m], i) => bell(t, m, 0.3 + i * 0.03));
    shortEv(1.5, (E, w) => S.thud(E, w, 0.45, 55));

    // ---- 蓝图 6–30 s（第 2–9 小节） ----
    const bp = ['Bm', 'Bm', 'G', 'G', 'D', 'D', 'A', 'A'];
    padRun(2, bp, 0.07);
    padRun(6, bp.slice(4), 0.08, I.stringsSlow);
    bp.forEach((ch, i) => {
      const bar = 2 + i;
      arp(bar, ch, 0.30 + 0.04 * i, P8, 0.5, 2.2, { verb: 0.4, dly: 0.2 });
      if (i % 2 === 0) ev(at(bar), 6.2, (E, w, skip) => I.sub(E, w, CH[ch].bass + 12, 6.0, 0.075 + 0.005 * i, skip));
      if (i >= 4) for (let k = 0; k < 4; k++) piano(at(bar, k), CH[ch].tones[7], 0.22, 2, { verb: 0.5 }); // 高音点缀
      for (let k = 0; k < 4; k++) shortEv(at(bar, k), (E, w) => S.clock(E, w, k === 0 ? 0.32 : 0.2, k % 2 === 1));
    });
    // 蓝图结尾：弦乐渐强 + 鼓点滚奏 + 冲击
    riser(at(8), at(10) - at(8) - 0.04, 0.8);
    revCrash(at(9, 1), at(10) - at(9, 1), 0.7);
    for (let k = 0; k < 12; k++) { const t = at(9, 1.0) + k * 0.1875 * 2 * (1 - k * 0.012); snare(t, 0.15 + k * 0.045, { len: 0.12 }); }
    taiko(at(9, 3.5), 0.7, 0.9);

    // ---- 起飞 30–54 s（第 10–17 小节）----
    const to = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A'];
    impact(at(10), 1); crash(at(10), 0.8, 4); taiko(at(10), 1, 0.9);
    duck(at(10), 0.55, 1.6);
    padRun(10, to, 0.09);
    padRun(10, to, 0.10, I.strings);
    to.forEach((ch, i) => {
      const bar = 10 + i;
      arp(bar, ch, i < 2 ? 0.30 : 0.36, P8, 0.5, 1.6, { verb: 0.4, dly: 0.2 });
      taiko(at(bar, 0), i === 0 ? 1 : 0.8, 1); if (i >= 1) taiko(at(bar, 2), 0.62, 1.1);
      if (i >= 2) { taiko(at(bar, 1.5), 0.45, 1.25); taiko(at(bar, 3.5), 0.5, 1.2); }
      if (i >= 2) for (let k = 0; k < 8; k++) stac(at(bar, k * 0.5), CH[ch].tones[3 + (k % 4 === 3 ? 2 : k % 4)], 0.42 + 0.02 * i, 0.12, { pan: k % 2 ? 0.25 : -0.25 });
      if (i >= 3) bassPulse(bar, ch, 0.7, [1, 0, 1, 0, 1, 0, 1, 1]);
      if (i >= 4) { for (let k = 0; k < 4; k++) kick(at(bar, k), 0.55); for (let k = 0; k < 8; k++) hat(at(bar, k * 0.5), k % 2 ? 0.3 : 0.4); }
      if (i >= 5) { snare(at(bar, 1), 0.6); snare(at(bar, 3), 0.65); }
      if (i === 7) {
        for (let k = 0; k < 16; k++) snare(at(bar, 2 + k * 0.125), 0.2 + k * 0.04, { len: 0.1 });
        riser(at(bar), at(bar + 1) - at(bar) - 0.04, 0.9); revCrash(at(bar, 1.5), at(bar + 1) - at(bar, 1.5), 0.8);
      }
    });

    // ---- 突破 54–84 s（第 18–27 小节）----
    const mach = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G'];
    // 第 18–20 小节：蓄势；第 21 小节(63 s)音爆后进入完整节奏
    crash(at(18), 0.9, 4); impact(at(18), 0.7); duck(at(18), 0.6, 1.2);
    const mc = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A', 'D', 'D'];
    padRun(18, mc, 0.10, I.strings);
    padRun(18, mc, 0.07);
    for (let i = 0; i < 10; i++) {
      const bar = 18 + i, ch = mc[i];
      const big = bar >= 21 && bar <= 26;
      // 16 分音符弦乐 ostinato
      if (bar <= 19 || big) for (let k = 0; k < 16; k++) stac(at(bar, k * 0.25), CH[ch].tones[2 + [0, 2, 3, 2][k % 4]], big ? 0.5 : 0.4, 0.09, { pan: ((k % 4) - 1.5) * 0.18 });
      // 低音脉冲
      if (bar !== 20 && bar <= 26) bassPulse(bar, ch, big ? 0.9 : 0.7, [1, 1, 1, 1, 1, 1, 1, 1]);
      // 鼓
      if (bar !== 20 && bar <= 26) {
        for (let k = 0; k < 4; k++) kick(at(bar, k), 0.75);
        snare(at(bar, 1), 0.7); snare(at(bar, 3), 0.75);
        for (let k = 0; k < 16; k++) hat(at(bar, k * 0.25), k % 4 === 2 ? 0.55 : 0.28, k % 8 === 6);
        if (big) { taiko(at(bar, 0), 0.8, 0.95); taiko(at(bar, 2.5), 0.6, 1.05); }
      }
      // 铜管重音
      if (big) {
        ev(at(bar, 0), 1.8, (E, w, skip) => { if (skip > 0.1) return; I.brass(E, w, 1.4, [CH[ch].root + 12, CH[ch].root + 19, CH[ch].root + 24], 0.07); });
        ev(at(bar, 2.5), 0.6, (E, w, skip) => { if (skip > 0.1) return; I.brass(E, w, 0.45, [CH[ch].root + 12, CH[ch].root + 19, CH[ch].root + 24], 0.06); });
      }
    }
    // 第 20 小节：音爆前的静默与蓄积（60–63 s）
    riser(at(20), BAR - 0.02, 0.9, { f0: 200, f1: 9000 }); revCrash(at(20, 1.5), at(21) - at(20, 1.5), 0.9);
    for (let k = 0; k < 8; k++) taiko(at(20, 2 + k * 0.25), 0.3 + k * 0.08, 1.1 + k * 0.03);
    // 第 21 小节：音爆
    impact(at(21), 1.1); crash(at(21), 1.0, 4.5); duck(at(21), 0.3, 2.4);
    // 马赫 2（74.6 s）与第 25 小节
    shortEv(TL.mach2 - 0.02, (E, w) => { I.crash(E, w, 0.7, 3); S.ping(E, w, 93, 0.5); });
    impact(at(25), 0.9); duck(at(25), 0.6, 1.4);
    // 一首高亢的旋律片段（弦乐 + 铜管）在第 25–26 小节
    melody(25, [[0, 0, 78, 2], [0, 2, 81, 2], [1, 0, 83, 2], [1, 2, 86, 2]], (t, m, d) => {
      ev(t, d + 0.3, (E, w, skip) => { if (skip > 0.1) return; I.strings(E, w, d, [m, m + 12], 0.07); });
      ev(t, d + 0.3, (E, w, skip) => { if (skip > 0.1) return; I.brass(E, w, d, [m - 12, m], 0.045, { bright: 3000 }); });
    });
    // 第 27 小节：收束，渐弱，进入舷窗
    riser(at(27, 1), at(28) - at(27, 1) - 0.03, 0.5, { f0: 500, f1: 5000 }); revCrash(at(27, 1.5), at(28) - at(27, 1.5), 0.5);
    for (let k = 0; k < 4; k++) piano(at(27, k), CH.G.tones[7 - (k % 2)], 0.25, 2.5, { verb: 0.55 });

    // ---- 舷窗 84–102 s（第 28–33 小节）----
    const ph = ['D', 'D', 'A', 'A', 'Bm', 'G'];
    padRun(28, ph, 0.12);
    padRun(30, ph.slice(2), 0.08, I.stringsSlow);
    ph.forEach((ch, i) => {
      arp(28 + i, ch, 0.18, [0, 2, 4, 3], 1, 3.2, { verb: 0.55, dly: 0.3 });
      ev(at(28 + i), BAR + 0.2, (E, w, skip) => { if (skip > 0.1) return; I.bass(E, w, CH[ch].bass, 2.8, 0.55); });
    });
    melody(28, THEME_P, (t, m, d) => piano(t, m, 0.52, d + 0.6, { verb: 0.5, dly: 0.25 }));
    [[at(28, 2), 90], [at(29, 3), 93], [at(31, 2), 88], [at(32, 3), 91]].forEach(([t, m]) => bell(t, m, 0.28));
    // 通往追日的蓄势
    ev(at(33, 2), at(34) - at(33, 2) + 0.5, (E, w, skip) => I.stringsSlow(E, w, at(34) - at(33, 2) + 0.5, [62, 66, 69, 74], 0.1, skip));
    riser(at(33, 2), at(34) - at(33, 2) - 0.02, 0.6, { f0: 600, f1: 6000 });

    // ---- 追日 102–126 s（第 34–41 小节）----
    const ch1 = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A'];
    crash(at(34), 0.8, 4); duck(at(34), 0.65, 1.2);
    padRun(34, ch1, 0.10);
    padRun(34, ch1, 0.085, I.stringsSlow);
    ch1.forEach((ch, i) => {
      const bar = 34 + i;
      ev(at(bar), BAR + 0.1, (E, w, skip) => { if (skip > 0.1) return; I.bass(E, w, CH[ch].bass, 2.7, 0.7); });
      ev(at(bar, 2), 1.4, (E, w, skip) => { if (skip > 0.1) return; I.bass(E, w, CH[ch].bass + 12, 1.0, 0.45); });
      arp(bar, ch, 0.24, P8, 0.5, 2.2, { verb: 0.45, dly: 0.25 });
      kick(at(bar, 0), 0.55); kick(at(bar, 2), 0.45); if (i >= 4) { snare(at(bar, 1), 0.3); snare(at(bar, 3), 0.35); }
      for (let k = 0; k < 8; k++) shaker(at(bar, k * 0.5), k % 2 ? 0.28 : 0.4);
      if (i >= 4) for (let k = 0; k < 8; k++) hat(at(bar, k * 0.5 + 0.25), 0.2);
    });
    const leadA = (t, m, d) => {
      ev(t, d + 0.4, (E, w, skip) => { if (skip > 0.1) return; I.strings(E, w, d, [m], 0.075, 0, 0.1); });
      piano(t, m, 0.42, d + 0.4, { verb: 0.45, dly: 0.2 });
    };
    melody(34, THEME_A, leadA); melody(38, THEME_A2, leadA);
    [[at(35, 0), 86], [at(37, 2), 93], [at(39, 2), 95], [at(41, 2), 90]].forEach(([t, m]) => bell(t, m, 0.3));
    // 追日尾声：渐强通往“倒走的时钟”
    riser(at(41, 0), BAR - 0.03, 0.4, { f0: 800, f1: 5000 });

    // ---- 倒走的时钟 126–138 s（第 42–45 小节）----
    const rc = ['Bm', 'Em', 'G', 'Asus'];
    padRun(42, rc, 0.09);
    padRun(42, rc, 0.08, I.stringsSlow);
    ev(at(42), at(46) - at(42) + 0.2, (E, w, skip) => S.drone(E, w, at(42), at(46) + 0.2, [35, 42], kf([[at(42), 0.0], [at(43), 0.07], [at(46), 0.11]]), skip));
    rc.forEach((ch, i) => {
      const bar = 42 + i;
      for (let k = 0; k < 16; k++) piano(at(bar, k * 0.25), CH[ch].tones[2 + [0, 2, 4, 2][k % 4]] + (i >= 2 ? 12 : 0), 0.2 + 0.015 * i, 0.5, { verb: 0.3, dly: 0.08 });
      ev(at(bar), BAR + 0.1, (E, w, skip) => { if (skip > 0.1) return; I.bass(E, w, CH[ch].bass, 2.7, 0.55 + i * 0.05); });
      if (i >= 2) { for (let k = 0; k < 4; k++) kick(at(bar, k), 0.35 + 0.1 * i); }
    });
    melody(44, [[0, 0, 74, 1.5], [0, 2, 76, 1], [0, 3, 78, 1], [1, 0, 81, 3], [1, 3, 80, 1]], (t, m, d) => ev(t, d + 0.3, (E, w, skip) => { if (skip > 0.1) return; I.strings(E, w, d, [m], 0.07); }));
    for (let k = 0; k < 24; k++) snare(at(45, 0.5 + k * 0.1458), 0.14 + k * 0.03, { len: 0.1 });
    riser(at(44, 2), at(46) - at(44, 2) - 0.03, 1.0, { f0: 300, f1: 9500 }); revCrash(at(45, 1), at(46) - at(45, 1), 0.9);

    // ---- 高潮 138–150 s（第 46–49 小节）----
    const cl = ['G', 'D', 'Bm', 'A'];
    impact(at(46), 1.2); crash(at(46), 1.0, 5); duck(at(46), 0.55, 2.0);
    padRun(46, cl, 0.12);
    padRun(46, cl, 0.12, I.strings);
    ev(at(46), at(50) - at(46) + 0.2, (E, w, skip) => I.choir(E, w, at(50) - at(46), [62, 67, 71, 74], 0.1, skip));
    cl.forEach((ch, i) => {
      const bar = 46 + i, c = CH[ch];
      bassPulse(bar, ch, 1.0, [1, 1, 1, 1, 1, 1, 1, 1]);
      for (let k = 0; k < 4; k++) kick(at(bar, k), 0.8);
      taiko(at(bar, 0), 0.9, 0.95); taiko(at(bar, 2), 0.7, 1.0); taiko(at(bar, 3.5), 0.6, 1.1);
      snare(at(bar, 1), 0.8); snare(at(bar, 3), 0.85);
      for (let k = 0; k < 16; k++) hat(at(bar, k * 0.25), k % 4 === 2 ? 0.55 : 0.3, k % 8 === 6);
      for (let k = 0; k < 16; k++) piano(at(bar, k * 0.25), c.tones[2 + [0, 2, 3, 4, 3, 2, 3, 5][k % 8]] + 12, 0.26, 0.6, { verb: 0.4, dly: 0.12 });
      if (i === 2) crash(at(bar), 0.7, 3.5);
    });
    melody(46, THEME_C, (t, m, d) => {
      ev(t, d + 0.5, (E, w, skip) => { if (skip > 0.1) return; I.brass(E, w, d, [m, m - 12], 0.075, { bright: 3400 }); });
      ev(t, d + 0.5, (E, w, skip) => { if (skip > 0.1) return; I.strings(E, w, d, [m, m + 12], 0.09); });
      piano(t, m + 12, 0.38, d + 0.4, { verb: 0.5 });
    });
    [[at(46, 2), 95], [at(47, 2), 98], [at(48, 2), 97], [at(49, 2), 93]].forEach(([t, m]) => bell(t, m, 0.35));
    // 末尾：向航线过渡
    riser(at(49, 1.5), at(50) - at(49, 1.5) - 0.03, 0.5, { f0: 600, f1: 7000 });

    // ---- 航线 150–174 s（第 50–57 小节）----
    const rt = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'Asus'];
    crash(at(50), 0.5, 3.5); duck(at(50), 0.7, 1.0);
    padRun(50, rt, 0.10, I.strings);
    padRun(50, rt, 0.07);
    rt.forEach((ch, i) => {
      const bar = 50 + i;
      arp(bar, ch, 0.33, P16, 0.25, 0.9, { verb: 0.35, dly: 0.28 });
      ev(at(bar), BAR + 0.1, (E, w, skip) => { if (skip > 0.1) return; I.bass(E, w, CH[ch].bass, 2.7, 0.6); });
      if (i >= 1) { kick(at(bar, 0), 0.6); kick(at(bar, 2), 0.5); }
      if (i >= 1) for (let k = 0; k < 8; k++) shaker(at(bar, k * 0.5), 0.3);
      if (i >= 2) { snare(at(bar, 1), 0.38); snare(at(bar, 3), 0.42); }
      if (i >= 3) bassPulse(bar, ch, 0.55, [1, 0, 0, 1, 1, 0, 1, 0]);
    });
    melody(50, THEME_A, (t, m, d) => ev(t, d + 0.4, (E, w, skip) => { if (skip > 0.1) return; I.strings(E, w, d, [m + 12], 0.06, 0, 0.15); }));
    // 纪录计时（164.6–169.8 s）：音乐收束成脉冲
    riser(150 + 14.4, 5.4, 0.6, { f0: 500, f1: 6500 });
    shortEv(150 + 19.8, (E, w) => { I.crash(E, w, 0.6, 3.5); I.impact(E, w, 0.5); });
    // 统计数字（171.0 / 171.35 / 171.7）
    [150 + 21.0, 150 + 21.35, 150 + 21.7].forEach((t, i) => { shortEv(t, (E, w) => { S.thud(E, w, 0.6, 70 + i * 8); }); bell(t + 0.02, 81 + i * 3, 0.4); });
    // 向终章过渡
    riser(at(57, 0.5), at(58) - at(57, 0.5) - 0.03, 0.55, { f0: 300, f1: 4000 });
    ev(at(57), BAR + 0.1, (E, w, skip) => I.sub(E, w, 33, BAR + 0.1, 0.13, skip));

    // ---- 终章 174–204 s（第 58–67 小节）----
    const en = ['Bm', 'G', 'A', 'D', 'Bm', 'G', 'D', 'A', 'D', 'D'];
    padRun(58, en, 0.10, I.stringsSlow);
    padRun(58, en, 0.08);
    en.forEach((ch, i) => {
      const bar = 58 + i;
      // 缓慢的分解和弦（钢琴）
      const c = CH[ch];
      [0, 1, 2, 3].forEach((k) => piano(at(bar, k), c.tones[2 + [0, 2, 3, 4][k]], 0.26 + (i > 5 ? 0.05 : 0), 3.2, { verb: 0.55, dly: 0.2 }));
      ev(at(bar), BAR + 0.1, (E, w, skip) => { if (skip > 0.1) return; I.bass(E, w, c.bass, 2.8, 0.45); });
    });
    // 触地（183 s = 第 61 小节）：温柔的一击
    shortEv(TL.touchdown, (E, w) => { I.taiko(E, w, 0.5, 0.8); I.bell(E, w, 62, 0.4, {}); });
    duck(TL.touchdown, 0.6, 1.0);
    // 主旋律放慢 1.5 倍，在钢琴上缓缓奏出（第 62–67 小节）
    THEME_A.forEach(([b, bt, m, d]) => {
      const tb = (b * 4 + bt) * 1.5;
      piano(at(62, 0) + tb * BEAT, m, 0.48, Math.min(d * 1.5 * BEAT, 3.4) + 0.9, { verb: 0.55, dly: 0.22 });
      if (b >= 2) ev(at(62, 0) + tb * BEAT, d * 1.5 * BEAT + 0.5, (E, w, skip) => { if (skip > 0.1) return; I.stringsSlow(E, w, d * 1.5 * BEAT, [m - 12], 0.06, 0); });
    });
    // 片尾：合唱 + 钟声 + 最后的和弦
    ev(at(64), at(68) - at(64), (E, w, skip) => I.choir(E, w, at(68) - at(64) - 1.2, [62, 66, 69, 74, 76], 0.09, skip));
    [[at(65, 1), 93], [at(65, 3), 90], [at(66, 0), 86], [at(66, 2), 88], [at(66, 3), 93], [at(67, 0), 98], [at(67, 1.5), 93], [at(67, 3), 86]].forEach(([t, m], i) => bell(t, m, 0.32 - i * 0.015, { long: 1.6 }));
    shortEv(at(66), (E, w) => { I.taiko(E, w, 0.4, 0.8); I.crash(E, w, 0.4, 5); });
    ev(at(66), at(68) - at(66) + 0.5, (E, w, skip) => I.sub(E, w, 26, at(68) - at(66), 0.14, skip));
  }

  // ======================================================================
  //  音效时间线
  // ======================================================================
  function buildSfx() {
    // ---- 打字声 ----
    for (const ty of Film.typing || []) {
      for (let i = 0; i < ty.n; i++) {
        const t = ty.t0 + i / ty.cps;
        if (i % 1 === 0 && ty.kind !== 'soft' || i % 2 === 0) shortEv(t, (E, w) => S.tick(E, w, ty.kind === 'tick' ? 'tick' : 'soft', ty.kind === 'tick' ? 0.8 : 0.55));
      }
    }
    // ---- 序章 ----
    ev(0, 6.5, (E, w, skip) => S.ambience(E, w, 0, 6.5, { level: kf([[0, 0], [2, 0.04], [6.5, 0.06]]), freq: 600, filter: 'lowpass' }, skip));
    // ---- 蓝图 ----
    ev(6.8, 11, (E, w, skip) => S.ambience(E, w, 6.8, 17.8, { filter: 'bandpass', freq: 4300, q: 1.1, type: 'w', level: kf([[6.8, 0], [8, 0.05], [15, 0.05], [17.8, 0]]), lfo: [11, 1200] }, skip));
    [16.8, 17.5, 18.2].forEach((t, i) => shortEv(t, (E, w) => S.ping(E, w, 91 + i * 2, 0.35)));
    shortEv(20.6, (E, w) => S.ping(E, w, 93, 0.35));
    ev(6 + 17.2, 3.6, (E, w, skip) => { if (skip > 0.5) return; S.whoosh(E, w, 3.4, { f0: 500, f1: 7000, vol: 0.14, pan: -0.7, panTo: 0.7, peak: 0.7 }); });
    ev(6 + 22.2, 1.9, (E, w, skip) => { if (skip > 0.5) return; S.whoosh(E, w, 1.8, { f0: 300, f1: 6000, vol: 0.3, peak: 0.95 }); });

    // ---- 起飞（30–54）----
    const T0 = TL.takeoff[0];
    const tkLevel = kf([[30, 0], [30.6, 0.22], [34, 0.42], [36.5, 0.5], [42.5, 0.66], [47, 0.9], [48.4, 1.0], [49.2, 0.76], [54, 0.45]]);
    const tkSpool = kf([[30, 0.3], [32.5, 0.66], [36, 0.86], [46, 1.0], [54, 0.95]]);
    const tkAb = (t) => smooth(ramp(t, 30.9, 31.5)) * (1 - 0.3 * smooth(ramp(t, 52.5, 54)));
    const dop = (t) => 1 - 0.17 * Math.tanh((t - 48.4) / 0.3);
    const pan = (t) => (t < 42.5 || t > 49 ? 0 : 0.9 * Math.tanh((t - 48.4) / 0.45));
    ev(30, 24, (E, w, skip) => S.engine(E, w, 30, 54, { level: tkLevel, spool: tkSpool, ab: tkAb, dop, pan, verb: 0.15 }, skip));
    // 滑跑的轮胎隆隆声
    ev(30, 17.6, (E, w, skip) => S.ambience(E, w, 30, 47.6, { filter: 'lowpass', freq: 150, level: (t) => 0.18 * smooth(ramp(t, 30, 36)) * (t > 47.4 ? 0 : 1), lfo: [7, 40] }, skip));
    shortEv(31.0, (E, w) => { S.thud(E, w, 0.5, 58); S.whoosh(E, w, 1.4, { f0: 120, f1: 900, vol: 0.28, peak: 0.3 }); });
    shortEv(47.6, (E, w) => S.thud(E, w, 0.35, 70));
    [36.5, 42.5, 49.0].forEach((t) => shortEv(t - 0.05, (E, w) => S.whoosh(E, w, 0.5, { f0: 700, f1: 3000, vol: 0.14, peak: 0.4 })));
    shortEv(50.7, (E, w) => S.hydraulic(E, w, 2.9, 0.8));
    shortEv(53.65, (E, w) => S.clunk(E, w, 0.7));
    shortEv(32.0, (E, w) => S.squelch(E, w, false)); shortEv(35.2, (E, w) => S.squelch(E, w, true));
    shortEv(36.4, (E, w) => S.squelch(E, w, false)); shortEv(38.0, (E, w) => S.squelch(E, w, true));
    ev(52.2, 1.9, (E, w, skip) => { if (skip > 0.5) return; S.whoosh(E, w, 1.8, { f0: 400, f1: 6000, vol: 0.3, peak: 0.95 }); });

    // ---- 突破（54–84）----
    const mLevel = kf([[54, 0.5], [58, 0.58], [62, 0.7], [63, 0.76], [66, 0.6], [70, 0.54], [71.2, 0.3], [78, 0.26], [84, 0.2]]);
    const mSpool = kf([[54, 0.88], [63, 0.97], [70, 1], [71.5, 0.84], [84, 0.8]]);
    const mAb = kf([[54, 1], [70.2, 1], [71.2, 0]]);
    ev(54, 30, (E, w, skip) => S.engine(E, w, 54, 84, { level: mLevel, spool: mSpool, ab: mAb, verb: 0.2, rumble: 0.8 }, skip));
    ev(54, 30, (E, w, skip) => S.ambience(E, w, 54, 84, { filter: 'bandpass', freq: 1800, q: 0.5, type: 'w', level: kf([[54, 0.02], [63, 0.05], [75, 0.09], [84, 0.07]]) }, skip));
    ev(63.0, 0.1, (E, w, skip) => { if (skip > 0.03) return; S.boom(E, w, 1); S.whoosh(E, w, 1.6, { f0: 6000, f1: 300, vol: 0.4, peak: 0.1 }); });
    duck(63.0, 0.25, 2.6);
    shortEv(70.2, (E, w) => { S.thud(E, w, 0.5, 72); S.whoosh(E, w, 1.0, { f0: 2000, f1: 200, vol: 0.25, peak: 0.1 }); });
    shortEv(TL.mach2, (E, w) => S.whoosh(E, w, 1.4, { f0: 300, f1: 6500, vol: 0.28, peak: 0.6 }));
    ev(54, 1.2, (E, w, skip) => { if (skip > 0.2) return; S.whoosh(E, w, 1.1, { f0: 5000, f1: 300, vol: 0.25, peak: 0.1 }); });
    ev(82.4, 1.6, (E, w, skip) => { if (skip > 0.3) return; S.whoosh(E, w, 1.5, { f0: 800, f1: 5000, vol: 0.2, peak: 0.9 }); });

    // ---- 舷窗（84–102）----
    ev(84, 18.5, (E, w, skip) => S.ambience(E, w, 84, 102.5, { filter: 'lowpass', freq: 420, q: 0.6, type: 'p', level: kf([[84, 0.0], [86, 0.1], [102, 0.1], [102.5, 0.0]]), lfo: [0.2, 60] }, skip));
    ev(84, 18.5, (E, w, skip) => S.ambience(E, w, 84, 102.5, { filter: 'highpass', freq: 4500, q: 0.4, type: 'w', level: kf([[84, 0.0], [87, 0.012], [102, 0.012], [102.5, 0]]) }, skip));
    shortEv(86.0, (E, w) => S.pop(E, w, 0.3, 500));
    shortEv(96.9, (E, w) => S.chime(E, w));
    shortEv(86.5, (E, w) => S.ping(E, w, 98, 0.3));

    // ---- 追日（102–126）----
    ev(101.5, 25, (E, w, skip) => S.ambience(E, w, 101.5, 126.5, { filter: 'bandpass', freq: 700, q: 0.4, type: 'p', level: kf([[101.5, 0], [104, 0.08], [124, 0.08], [126.5, 0]]), lfo: [0.12, 260] }, skip));
    ev(102, 24, (E, w, skip) => S.engine(E, w, 102, 126, { level: kf([[102, 0.0], [105, 0.12], [124, 0.12], [126, 0]]), spool: kf([[102, 0.7], [126, 0.7]]), whine: 0.5, roar: 0.4, hiss: 0.4, verb: 0.3 }, skip));
    shortEv(102.0, (E, w) => S.whoosh(E, w, 1.5, { f0: 3000, f1: 300, vol: 0.28, peak: 0.1 }));

    // ---- 倒走的时钟（126–138）----
    const uOf = (T) => Film.race.u(T);
    const nTick = 90;
    for (let k = 1; k <= nTick; k++) {
      let lo = Film.race.U0, hi = Film.race.U1;
      for (let it = 0; it < 24; it++) { const mid = (lo + hi) / 2; if (uOf(mid) * nTick < k) lo = mid; else hi = mid; }
      const t = (lo + hi) / 2;
      shortEv(t, (E, w) => S.clock(E, w, k % 5 === 0 ? 0.9 : 0.55, k % 2 === 0));
    }
    ev(Film.race.U0, Film.race.U1 - Film.race.U0, (E, w, skip) => { if (skip > 1) return; S.whoosh(E, w, Film.race.U1 - Film.race.U0, { f0: 5000, f1: 500, vol: 0.12, peak: 0.5 }); });
    shortEv(Film.race.U1, (E, w) => { S.ping(E, w, 93, 0.55); S.ping(E, w + 0.18, 86, 0.45); });
    ev(135.0, 3.0, (E, w, skip) => { if (skip > 0.4) return; S.whoosh(E, w, 3.0, { f0: 400, f1: 8000, vol: 0.3, peak: 0.95 }); });

    // ---- 标题（138）----
    shortEv(138.0, (E, w) => { S.boom(E, w, 0.55); });
    ev(138, 12, (E, w, skip) => S.ambience(E, w, 138, 150, { filter: 'bandpass', freq: 900, q: 0.4, type: 'p', level: kf([[138, 0.06], [146, 0.05], [150, 0]]) }, skip));
    shortEv(139.2, (E, w) => { S.ping(E, w, 98, 0.4); });
    shortEv(144.0, (E, w) => S.whoosh(E, w, 2.4, { f0: 200, f1: 3000, vol: 0.22, peak: 0.3, pan: 0.5, panTo: -0.6 }));

    // ---- 航线（150–174）----
    const rtPing = [[152.2, 88], [153.2, 91], [158.8, 90], [159.8, 93]];
    rtPing.forEach(([t, m]) => shortEv(t, (E, w) => { S.ping(E, w, m, 0.4); S.whoosh(E, w, 0.9, { f0: 600, f1: 3500, vol: 0.1, peak: 0.4 }); }));
    [151.2, 151.4, 152.4, 153.6, 154.6, 158.4].forEach((t, i) => shortEv(t, (E, w) => S.pop(E, w, 0.35, 600 + i * 40)));
    for (let k = 0; k < 120; k++) {
      const u = k / 119, t = 150 + lerp(14.6, 19.8, Math.asin(2 * u - 1) / Math.PI + 0.5);
      shortEv(t, (E, w) => S.clock(E, w, 0.34, k % 2 === 0));
    }
    shortEv(150 + 19.8, (E, w) => { S.ping(E, w, 93, 0.6); S.ping(E, w + 0.12, 98, 0.45); });
    ev(172.6, 1.6, (E, w, skip) => { if (skip > 0.3) return; S.whoosh(E, w, 1.5, { f0: 300, f1: 5000, vol: 0.26, peak: 0.95 }); });

    // ---- 终章（174–204）----
    const tdT = TL.touchdown;
    ev(174, 9.4, (E, w, skip) => S.engine(E, w, 174, 183.4, { level: kf([[174, 0], [177, 0.1], [180.5, 0.34], [183, 0.7], [183.4, 0.8]]), spool: kf([[174, 0.5], [183.4, 0.66]]), whine: 0.8, ab: () => 0, verb: 0.25 }, skip));
    ev(183, 14, (E, w, skip) => S.engine(E, w, 183, 197, { level: kf([[183, 0.95], [184.5, 0.8], [188, 0.36], [192, 0.14], [197, 0]]), spool: kf([[183, 0.95], [187, 0.5], [192, 0.3], [197, 0.25]]), whine: 0.6, roar: 1.2, rumble: 1.1, verb: 0.3 }, skip));
    shortEv(tdT, (E, w) => { S.thud(E, w, 1.0, 80); S.squeal(E, w + 0.02, 0.8, 0.7); S.thud(E, w + 0.1, 0.6, 62); });
    shortEv(tdT + 2.3, (E, w) => S.thud(E, w, 0.5, 70)); // 前轮着地
    [tdT, 189.0].forEach((t) => shortEv(t - 0.05, (E, w) => S.whoosh(E, w, 0.5, { f0: 500, f1: 3000, vol: 0.12, peak: 0.4 })));
    ev(188, 16, (E, w, skip) => S.ambience(E, w, 188, 204, { filter: 'lowpass', freq: 700, q: 0.4, type: 'p', level: kf([[188, 0], [192, 0.05], [204, 0.05]]), lfo: [0.1, 200] }, skip));
    ev(196.2, 7.2, (E, w, skip) => { // 远去光点的细长滑音
      if (skip > 0.5) return;
      const o1 = AE.osc(E, 'sine', 2600, w, w + 7.3); const g = AE.gn(E, 0.0001);
      o1.frequency.exponentialRampToValueAtTime(380, w + 7); g.gain.setValueAtTime(0.0001, w); g.gain.linearRampToValueAtTime(0.018, w + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, w + 7);
      o1.connect(g); g.connect(E.sfx); AE.send(E, g, 0.6, 0.4);
    });
    shortEv(198.4, (E, w) => { S.ping(E, w, 86, 0.5); S.ping(E, w + 0.3, 90, 0.4); });
  }

  buildMusic();
  buildSfx();
  EV.sort((a, b) => a.t - b.t);

  // ======================================================================
  //  播放器
  // ======================================================================
  const DURATION = TL.DURATION;
  const FADE_OUT_AT = 200.4;

  // 配乐整体的力度曲线（dB）：序章/蓝图轻柔，起飞与突破渐强，舷窗回落，高潮最强，终章再次沉静
  const DYN = [[0, -6], [6, -5], [18, -3], [24, -2], [30, 0], [54, 0], [60, -1], [63, 0], [83, -1], [88, -3.5], [100, -3.5], [102, -1.5], [124, -1.5], [126, -3.5], [134, -1], [138, 2.5], [148, 2.5], [150, -1.5], [170, -1.5], [174, -4], [183, -3], [192, -3.5], [196, -2], [204, -2]];
  const dynGain = (t) => Math.pow(10, U.keyframes(DYN, t) / 20);
  function applyDyn(E, base, T, nowT) {
    const g = E.musicDyn.gain;
    g.cancelScheduledValues(nowT);
    g.setValueAtTime(dynGain(T), nowT);
    for (const [t] of DYN) if (t > T) g.linearRampToValueAtTime(dynGain(t), base + t);
  }

  function applyMasterFade(E, base, T) {
    const g = E.out.gain, now = E.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0.0001, now);
    g.linearRampToValueAtTime(0.9, now + (T < 0.5 ? 0.45 : 0.12));
    const tf = base + FADE_OUT_AT;
    if (tf > now + 0.2) { g.setValueAtTime(0.9, tf); g.linearRampToValueAtTime(0.0001, base + DURATION - 0.05); }
  }

  const Player = {
    ctx: null, E: null, base: 0, cursor: 0, idx: 0, timer: null, ready: false, playing: false,
    init() {
      if (this.ready) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.E = AE.createEngine(this.ctx, { seed: 1969 });
      this.ready = true;
    },
    time() { return this.ctx ? this.ctx.currentTime - this.base : 0; },
    freshBuses() {
      const E = this.E, ctx = this.ctx;
      const oldM = E.music, oldS = E.sfx, oldD = E.musicDuck;
      if (oldM) { const t = ctx.currentTime; oldD.gain.cancelScheduledValues(t); oldS.gain.setValueAtTime(oldS.gain.value, t); oldS.gain.linearRampToValueAtTime(0, t + 0.06); oldD.gain.setValueAtTime(oldD.gain.value, t); oldD.gain.linearRampToValueAtTime(0, t + 0.06); setTimeout(() => { try { oldD.disconnect(); oldS.disconnect(); } catch (e) { /* noop */ } }, 400); }
      E.musicDuck = ctx.createGain(); E.musicDuck.gain.value = 1;
      E.musicDyn = ctx.createGain(); E.musicDyn.gain.value = 1;
      E.music = ctx.createGain(); E.music.gain.value = 0.9; E.music.connect(E.musicDyn); E.musicDyn.connect(E.musicDuck); E.musicDuck.connect(E.master);
      E.sfx = ctx.createGain(); E.sfx.gain.value = 1; E.sfx.connect(E.master);
    },
    /** 从影片时间 T 开始播放（秒） */
    start(T = 0) {
      this.init();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.seek(T);
      if (!this.timer) this.timer = setInterval(() => this.pump(), 70);
      this.playing = true;
    },
    seek(T) {
      this.freshBuses();
      const ctx = this.ctx;
      this.base = ctx.currentTime + 0.08 - T;
      applyMasterFade(this.E, this.base, T);
      applyDyn(this.E, this.base, T, ctx.currentTime);
      this.cursor = T;
      // 找到第一个未来事件；同时补播仍在持续的长事件
      let i = 0; while (i < EV.length && EV[i].t < T) i++;
      this.idx = i;
      for (let k = 0; k < i; k++) {
        const e = EV[k];
        if (e.dur > 0.5 && e.t + e.dur > T + 0.2) this.run(e, T);
      }
    },
    run(e, nowT) {
      const skip = Math.max(0, nowT - e.t);
      const when = this.base + Math.max(e.t, nowT);
      try { e.fn(this.E, when, skip); } catch (err) { console.warn('audio event failed', err); }
    },
    pump() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.time(), horizon = now + 1.6;
      while (this.idx < EV.length && EV[this.idx].t < horizon) {
        const e = EV[this.idx++];
        const late = e.t < now;
        if (late && e.dur < 0.5 && now - e.t > 0.12) continue; // 来不及的短事件丢弃
        this.run(e, late && e.dur >= 0.5 ? now : e.t);
      }
    },
    pause() { if (this.ctx) this.ctx.suspend(); this.playing = false; },
    resume() { if (this.ctx) this.ctx.resume(); this.playing = true; },
    setMuted(m) { if (this.E) this.E.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05); },
    stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.ctx) this.ctx.suspend(); this.playing = false; },
  };

  /**
   * 离线渲染整条音轨（用于导出视频）。返回 AudioBuffer。
   * 事件按时间窗口分批创建（借助 suspend/resume），避免一次性把几万个节点塞进音频图里导致渲染极慢。
   */
  async function renderOffline(sampleRate = 44100, seconds = DURATION) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
    const E = AE.createEngine(ctx, { seed: 1969, offline: true });
    E.out.gain.setValueAtTime(0.0001, 0);
    E.out.gain.linearRampToValueAtTime(0.9, 0.45);
    E.out.gain.setValueAtTime(0.9, FADE_OUT_AT);
    E.out.gain.linearRampToValueAtTime(0.0001, DURATION - 0.05);
    applyDyn(E, 0, 0, 0);
    let idx = 0;
    const scheduleUntil = (T) => {
      while (idx < EV.length && EV[idx].t < T) { const e = EV[idx++]; try { e.fn(E, e.t, 0); } catch (err) { console.warn('audio event failed', err); } }
    };
    const STEP = 1.5, AHEAD = 3.2;
    scheduleUntil(AHEAD);
    for (let t = STEP; t < seconds; t += STEP) {
      ctx.suspend(t).then(() => { scheduleUntil(t + AHEAD); ctx.resume(); });
    }
    return ctx.startRendering();
  }

  G.AudioShow = { Player, renderOffline, EV, DURATION };
})(typeof window !== 'undefined' ? window : globalThis);
