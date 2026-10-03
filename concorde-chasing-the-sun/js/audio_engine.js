/* 协和逐日 · 音频引擎：混音总线、卷积混响、乐器与音效合成器（全部由 WebAudio 实时合成，无任何采样素材）
 *
 * 所有合成函数形如 fn(E, when, ...params)，其中 E 为引擎实例，when 为 AudioContext 的绝对时间。
 * 同一份代码既可跑在实时 AudioContext 上，也可跑在 OfflineAudioContext 上（用于导出 MP4 的音轨）。
 */
(function (G) {
  'use strict';
  const { rng, clamp, lerp } = U;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const dB = (x) => Math.pow(10, x / 20);

  // ---------------------------------------------------------------- 引擎
  function createEngine(ctx, opts = {}) {
    const E = { ctx, rand: rng(opts.seed || 1969), sr: ctx.sampleRate, offline: !!opts.offline };
    // ---- 主链路：总线 → 压缩 → 软削波 → 总音量 → 输出
    const master = ctx.createGain(); master.gain.value = 0.42;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -17; comp.knee.value = 14; comp.ratio.value = 3.2; comp.attack.value = 0.012; comp.release.value = 0.28;
    const makeup = ctx.createGain(); makeup.gain.value = 1.0;
    const shaper = ctx.createWaveShaper();
    { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); } shaper.curve = c; shaper.oversample = '2x'; }
    const tilt = ctx.createBiquadFilter(); tilt.type = 'highshelf'; tilt.frequency.value = 7500; tilt.gain.value = -2.5;
    const out = ctx.createGain(); out.gain.value = 0.9;
    master.connect(comp); comp.connect(makeup); makeup.connect(tilt); tilt.connect(shaper); shaper.connect(out); out.connect(ctx.destination);
    E.master = master; E.out = out;

    // ---- 混响（合成脉冲响应：指数衰减的立体声噪声，随时间逐渐变暗）
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 4.2), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch), rr = rng(7000 + ch * 13);
      let y = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / ctx.sampleRate;
        const a = Math.exp(-t / 0.62) * (t < 0.03 ? t / 0.03 : 1);
        const alpha = lerp(0.85, 0.07, Math.min(1, t / 2.6));
        y += ((rr() * 2 - 1) - y) * alpha;
        d[i] = y * a * (1 + (i < 2200 && rr() < 0.01 ? 3 : 0));
      }
    }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const verbIn = ctx.createGain(); verbIn.gain.value = 1;
    const verbPre = ctx.createDelay(0.1); verbPre.delayTime.value = 0.022;
    const verbHP = ctx.createBiquadFilter(); verbHP.type = 'highpass'; verbHP.frequency.value = 180;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.9;
    verbIn.connect(verbPre); verbPre.connect(verbHP); verbHP.connect(verb); verb.connect(verbOut); verbOut.connect(master);

    // ---- 回声（附点八分音符，用于钢琴/拨弦）
    const dly = ctx.createDelay(1.5); dly.delayTime.value = 0.5625;
    const dlyFb = ctx.createGain(); dlyFb.gain.value = 0.36;
    const dlyLP = ctx.createBiquadFilter(); dlyLP.type = 'lowpass'; dlyLP.frequency.value = 2400;
    const dlyIn = ctx.createGain(); dlyIn.gain.value = 1;
    const dlyOut = ctx.createGain(); dlyOut.gain.value = 0.5;
    dlyIn.connect(dly); dly.connect(dlyLP); dlyLP.connect(dlyFb); dlyFb.connect(dly); dlyLP.connect(dlyOut); dlyOut.connect(master); dlyOut.connect(verbIn);
    E.verbIn = verbIn; E.dlyIn = dlyIn;

    // ---- 音乐/音效总线（带“闪避”增益，音爆时压低音乐）
    E.musicDuck = ctx.createGain(); E.musicDuck.gain.value = 1;
    E.musicDyn = ctx.createGain(); E.musicDyn.gain.value = 1;
    E.music = ctx.createGain(); E.music.gain.value = 0.9;
    E.music.connect(E.musicDyn); E.musicDyn.connect(E.musicDuck); E.musicDuck.connect(master);
    E.sfx = ctx.createGain(); E.sfx.gain.value = 1; E.sfx.connect(master);

    // ---- 噪声缓冲（白/粉）
    const nlen = ctx.sampleRate * 3;
    E.noiseW = ctx.createBuffer(1, nlen, ctx.sampleRate);
    E.noiseP = ctx.createBuffer(1, nlen, ctx.sampleRate);
    {
      const w = E.noiseW.getChannelData(0), p = E.noiseP.getChannelData(0), rr = rng(31337);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < nlen; i++) {
        const x = rr() * 2 - 1;
        w[i] = x;
        b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
        b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
        p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
      }
    }

    // ---- 乐器用的 PeriodicWave
    const mk = (amps) => { const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1); amps.forEach((a, i) => { im[i + 1] = a; }); return ctx.createPeriodicWave(re, im, { disableNormalization: false }); };
    E.waves = {
      piano: mk([1, 0.5, 0.26, 0.14, 0.08, 0.05, 0.03, 0.02]),
      ep: mk([1, 0.18, 0.5, 0.06, 0.14, 0.02, 0.05]),
      soft: mk([1, 0.3, 0.12, 0.05]),
    };
    return E;
  }

  // ---------------------------------------------------------------- 工具
  function noiseSrc(E, when, dur, type = 'w', offset) {
    const s = E.ctx.createBufferSource();
    s.buffer = type === 'p' ? E.noiseP : E.noiseW;
    s.loop = true;
    s.start(when, offset === undefined ? E.rand() * 2.5 : offset);
    s.stop(when + dur + 0.05);
    return s;
  }
  function bq(E, type, freq, q = 0.7, gain = 0) {
    const f = E.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.gain.value = gain; return f;
  }
  function gn(E, v = 1) { const g = E.ctx.createGain(); g.gain.value = v; return g; }
  function osc(E, type, freq, when, stop, detune = 0) {
    const o = E.ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; o.start(when); if (stop !== undefined) o.stop(stop); return o;
  }
  function panner(E, p) { if (E.ctx.createStereoPanner) { const n = E.ctx.createStereoPanner(); n.pan.value = p; return n; } return gn(E, 1); }
  function adsr(param, when, peak, a, d, s, dur, r) {
    const sus = Math.max(0.0001, peak * s);
    param.setValueAtTime(0.0001, when);
    param.linearRampToValueAtTime(peak, when + a);
    param.exponentialRampToValueAtTime(sus, when + a + Math.max(0.005, Math.min(d, dur - a)));
    param.setValueAtTime(sus, when + Math.max(a + 0.01, dur));
    param.exponentialRampToValueAtTime(0.0001, when + Math.max(a + 0.01, dur) + r);
  }
  /** 把关键帧 pts=[[t,v],...]（相对 when，单位秒）写入 AudioParam；skip 为已经过去的秒数（用于拖动进度条） */
  function automate(param, pts, when, skip = 0, mul = 1) {
    let started = false;
    const val = (t) => {
      if (t <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const u = (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1); return lerp(pts[i - 1][1], pts[i][1], u); }
      return pts[pts.length - 1][1];
    };
    param.setValueAtTime(val(skip) * mul, when);
    for (const [t, v] of pts) if (t > skip) param.linearRampToValueAtTime(v * mul, when + (t - skip));
  }
  function sample(fn, t0, t1, step = 0.1) { const a = []; for (let t = t0; t <= t1 + 1e-9; t += step) a.push([t - t0, fn(t)]); return a; }
  function send(E, node, verb = 0, dly = 0) {
    if (verb > 0) { const g = gn(E, verb); node.connect(g); g.connect(E.verbIn); }
    if (dly > 0) { const g = gn(E, dly); node.connect(g); g.connect(E.dlyIn); }
  }

  const I = {};   // 乐器
  const S = {};   // 音效

  // ---------------------------------------------------------------- 乐器：钢琴（柔和的毡槌钢琴 / 电钢琴混合音色）
  I.piano = function (E, when, midi, vel = 0.7, dur = 1.5, o = {}) {
    const ctx = E.ctx, f = mtof(midi);
    const out = gn(E, 1);
    const g = ctx.createGain();
    const lp = bq(E, 'lowpass', Math.min(f * 7, 900 + vel * 5200), 0.5);
    const decay = clamp(3.4 - (midi - 40) * 0.035, 0.7, 3.6) * (o.decay || 1);
    const peak = 0.34 * vel * (o.gain || 1);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.004);
    g.gain.exponentialRampToValueAtTime(peak * 0.42, when + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    lp.frequency.setValueAtTime(Math.min(f * 7, 900 + vel * 5200), when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 2.2), when + Math.min(1.6, decay));
    const a = osc(E, 'sine', f, when, when + decay + 0.1); a.setPeriodicWave(E.waves.piano);
    const b = osc(E, 'sine', f * 2.0, when, when + 0.9, 3);
    const bg = gn(E, 0.0001); bg.gain.setValueAtTime(0.1 * vel, when); bg.gain.exponentialRampToValueAtTime(0.0001, when + 0.7);
    b.connect(bg); bg.connect(lp);
    a.connect(lp); lp.connect(g); g.connect(out);
    // 琴槌声
    const h = noiseSrc(E, when, 0.03); const hf = bq(E, 'bandpass', 1800 + f * 0.6, 1.2); const hg = gn(E, 0.0001);
    hg.gain.setValueAtTime(0.06 * vel, when); hg.gain.exponentialRampToValueAtTime(0.0001, when + 0.025);
    h.connect(hf); hf.connect(hg); hg.connect(out);
    const pn = panner(E, o.pan === undefined ? (midi - 66) * 0.012 : o.pan);
    out.connect(pn); pn.connect(o.dest || E.music);
    send(E, pn, o.verb === undefined ? 0.34 : o.verb, o.dly === undefined ? 0.12 : o.dly);
  };

  // ---------------------------------------------------------------- 钟琴 / 铃音
  I.bell = function (E, when, midi, vel = 0.5, o = {}) {
    const f = mtof(midi), ctx = E.ctx;
    const out = gn(E, 1);
    const parts = [[1, 1, 2.4], [2.76, 0.35, 1.3], [5.4, 0.16, 0.7], [8.93, 0.07, 0.4]];
    for (const [r, a, d] of parts) {
      const o1 = osc(E, 'sine', f * r, when, when + d * (o.long || 1) + 0.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.16 * vel * a, when + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d * (o.long || 1));
      o1.connect(g); g.connect(out);
    }
    const pn = panner(E, o.pan === undefined ? (E.rand() - 0.5) * 0.9 : o.pan);
    out.connect(pn); pn.connect(o.dest || E.music);
    send(E, pn, 0.55, 0.3);
  };

  // ---------------------------------------------------------------- 弦乐/铺底
  function sustainVoice(E, when, dur, freqs, o) {
    const ctx = E.ctx;
    const skip = o.skip || 0;
    if (skip > 0) { when = when + 0; dur = dur - skip; if (dur < 0.2) return; }
    const a = skip > 0 ? Math.min(o.a, 0.08) : o.a, r = o.r;
    const out = gn(E, 1);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(o.vol, when + a);
    env.gain.setValueAtTime(o.vol, when + Math.max(a, dur));
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(a, dur) + r);
    const stopT = when + Math.max(a, dur) + r + 0.1;
    const lp = bq(E, 'lowpass', o.cut || 1500, o.q || 0.5);
    if (o.cutLfo) {
      const l = osc(E, 'sine', o.cutLfo[0], when, stopT); const lg = gn(E, o.cutLfo[1]); l.connect(lg); lg.connect(lp.frequency);
    }
    for (const m of freqs) {
      const f = mtof(m);
      for (const dt of o.detune || [-8, 0, 8]) {
        const oc = osc(E, o.type || 'sawtooth', f, when, stopT, dt);
        if (o.vib) { const l = osc(E, 'sine', o.vib[0] * (1 + E.rand() * 0.1), when, stopT); const lg = gn(E, o.vib[1]); l.connect(lg); lg.connect(oc.detune); }
        oc.connect(lp);
      }
      if (o.sub) { const so = osc(E, 'sine', f / 2, when, stopT); const sg = gn(E, o.sub); so.connect(sg); sg.connect(lp); }
    }
    lp.connect(env); env.connect(out);
    const pn = panner(E, o.pan || 0);
    out.connect(pn); pn.connect(o.dest || E.music);
    send(E, pn, o.verb === undefined ? 0.3 : o.verb);
    return env;
  }
  I.pad = (E, when, dur, midis, vol = 0.05, skip = 0) => sustainVoice(E, when, dur, midis, { vol: vol / Math.max(1, midis.length * 0.55), a: 1.6, r: 2.2, cut: 900, q: 0.4, cutLfo: [0.11, 260], detune: [-9, 0, 9], sub: 0.5, skip, verb: 0.38, pan: 0 });
  I.strings = (E, when, dur, midis, vol = 0.05, skip = 0, pan = 0) => sustainVoice(E, when, dur, midis, { vol: vol / Math.max(1, midis.length * 0.55), a: 0.55, r: 1.0, cut: 2500, q: 0.3, vib: [5.2, 6], detune: [-11, 0, 11], skip, verb: 0.34, pan });
  I.stringsSlow = (E, when, dur, midis, vol = 0.05, skip = 0) => sustainVoice(E, when, dur, midis, { vol: vol / Math.max(1, midis.length * 0.55), a: 2.2, r: 2.0, cut: 2000, q: 0.3, vib: [4.9, 5], detune: [-12, 0, 12], skip, verb: 0.4 });
  I.brass = function (E, when, dur, midis, vol = 0.05, o = {}) {
    const ctx = E.ctx;
    const out = gn(E, 1);
    const env = ctx.createGain();
    const a = o.a === undefined ? 0.07 : o.a;
    env.gain.setValueAtTime(0.0001, when); env.gain.linearRampToValueAtTime(vol / Math.max(1, midis.length * 0.7), when + a);
    env.gain.setValueAtTime(vol / Math.max(1, midis.length * 0.7) * 0.85, when + Math.max(a + 0.02, dur * 0.7));
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur + (o.r || 0.35));
    const stopT = when + dur + (o.r || 0.35) + 0.1;
    const lp = bq(E, 'lowpass', 600, 0.9);
    lp.frequency.setValueAtTime(500, when); lp.frequency.linearRampToValueAtTime(o.bright || 2600, when + 0.28); lp.frequency.linearRampToValueAtTime((o.bright || 2600) * 0.7, when + dur);
    for (const m of midis) {
      const f = mtof(m);
      for (const dt of [-5, 5]) { const oc = osc(E, 'sawtooth', f, when, stopT, dt); const l = osc(E, 'sine', 5.4, when + 0.25, stopT); const lg = gn(E, 5); l.connect(lg); lg.connect(oc.detune); oc.connect(lp); }
      const so = osc(E, 'square', f / 2, when, stopT); const sg = gn(E, 0.25); so.connect(sg); sg.connect(lp);
    }
    lp.connect(env); env.connect(out);
    out.connect(o.dest || E.music); send(E, out, 0.32);
  };
  I.choir = function (E, when, dur, midis, vol = 0.05, skip = 0) {
    const ctx = E.ctx;
    if (skip > 0) { dur -= skip; if (dur < 0.3) return; }
    const a = skip > 0 ? 0.1 : 1.8, r = 2.2;
    const out = gn(E, 1), env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when); env.gain.linearRampToValueAtTime(vol / Math.max(1, midis.length * 0.6), when + a);
    env.gain.setValueAtTime(vol / Math.max(1, midis.length * 0.6), when + Math.max(a, dur));
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(a, dur) + r);
    const stopT = when + Math.max(a, dur) + r + 0.1;
    const forms = [[800, 6, 1], [1150, 7, 0.55], [2900, 8, 0.18]];
    const fb = forms.map(([fr, q, g]) => { const f = bq(E, 'bandpass', fr, q); const gg = gn(E, g); f.connect(gg); gg.connect(env); return f; });
    for (const m of midis) {
      for (const dt of [-14, -5, 6, 15]) {
        const oc = osc(E, 'sawtooth', mtof(m), when, stopT, dt);
        const l = osc(E, 'sine', 5 + E.rand(), when + 0.5, stopT); const lg = gn(E, 7); l.connect(lg); lg.connect(oc.detune);
        for (const f of fb) oc.connect(f);
      }
    }
    env.connect(out); out.connect(E.music); send(E, out, 0.5);
  };

  // ---------------------------------------------------------------- 低音与次低频
  I.bass = function (E, when, midi, dur = 0.5, vel = 0.7, o = {}) {
    const ctx = E.ctx, f = mtof(midi);
    const out = gn(E, 1), env = ctx.createGain();
    adsr(env.gain, when, 0.34 * vel, 0.012, 0.18, 0.7, dur, 0.18);
    const lp = bq(E, 'lowpass', 340 + vel * 260, 0.8);
    const stopT = when + dur + 0.4;
    const o1 = osc(E, 'sine', f, when, stopT); const o2 = osc(E, 'sawtooth', f, when, stopT); const g2 = gn(E, 0.22); o2.connect(g2); g2.connect(lp);
    const o3 = osc(E, 'triangle', f * 2, when, stopT); const g3 = gn(E, 0.12); o3.connect(g3); g3.connect(lp);
    o1.frequency.setValueAtTime(f * 1.5, when); o1.frequency.exponentialRampToValueAtTime(f, when + 0.04);
    o1.connect(lp); lp.connect(env); env.connect(out); out.connect(E.music);
    send(E, out, 0.05);
  };
  I.sub = function (E, when, midi, dur, vol = 0.3, skip = 0) {
    if (skip > 0) { dur -= skip; if (dur < 0.3) return; }
    const f = mtof(midi), env = E.ctx.createGain();
    const a = skip > 0 ? 0.1 : 0.6;
    env.gain.setValueAtTime(0.0001, when); env.gain.linearRampToValueAtTime(vol, when + a);
    env.gain.setValueAtTime(vol, when + Math.max(a, dur)); env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(a, dur) + 1.2);
    const o1 = osc(E, 'sine', f, when, when + Math.max(a, dur) + 1.4);
    o1.connect(env); env.connect(E.music);
  };

  // ---------------------------------------------------------------- 打击乐
  I.kick = function (E, when, vel = 0.8) {
    const ctx = E.ctx, env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when); env.gain.linearRampToValueAtTime(0.75 * vel, when + 0.002); env.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);
    const o1 = osc(E, 'sine', 160, when, when + 0.5);
    o1.frequency.setValueAtTime(165, when); o1.frequency.exponentialRampToValueAtTime(46, when + 0.1); o1.frequency.exponentialRampToValueAtTime(34, when + 0.4);
    o1.connect(env); env.connect(E.music);
    const c = noiseSrc(E, when, 0.02); const cf = bq(E, 'highpass', 1500); const cg = gn(E, 0.0001);
    cg.gain.setValueAtTime(0.18 * vel, when); cg.gain.exponentialRampToValueAtTime(0.0001, when + 0.012); c.connect(cf); cf.connect(cg); cg.connect(E.music);
  };
  I.taiko = function (E, when, vel = 0.8, pitch = 1) {
    const ctx = E.ctx, env = ctx.createGain(), out = gn(E, 1);
    env.gain.setValueAtTime(0.0001, when); env.gain.linearRampToValueAtTime(0.72 * vel, when + 0.004); env.gain.exponentialRampToValueAtTime(0.0001, when + 1.5);
    const o1 = osc(E, 'sine', 120 * pitch, when, when + 1.6);
    o1.frequency.setValueAtTime(130 * pitch, when); o1.frequency.exponentialRampToValueAtTime(62 * pitch, when + 0.3); o1.frequency.exponentialRampToValueAtTime(52 * pitch, when + 1.4);
    o1.connect(env); env.connect(out);
    const o2 = osc(E, 'triangle', 200 * pitch, when, when + 0.5); const g2 = gn(E, 0.0001); g2.gain.setValueAtTime(0.25 * vel, when); g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
    o2.frequency.exponentialRampToValueAtTime(90 * pitch, when + 0.25); o2.connect(g2); g2.connect(out);
    const n = noiseSrc(E, when, 0.12); const nf = bq(E, 'lowpass', 900); const ng = gn(E, 0.0001); ng.gain.setValueAtTime(0.4 * vel, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    n.connect(nf); nf.connect(ng); ng.connect(out);
    out.connect(E.music); send(E, out, 0.5);
  };
  I.snare = function (E, when, vel = 0.7, o = {}) {
    const ctx = E.ctx, out = gn(E, 1);
    const n = noiseSrc(E, when, 0.3); const f = bq(E, 'bandpass', 1900, 0.7); const hp = bq(E, 'highpass', 700); const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.5 * vel, when + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, when + (o.len || 0.2));
    n.connect(f); f.connect(hp); hp.connect(g); g.connect(out);
    const b = osc(E, 'triangle', 200, when, when + 0.15); const bg = gn(E, 0.0001); bg.gain.setValueAtTime(0.34 * vel, when); bg.gain.exponentialRampToValueAtTime(0.0001, when + 0.11);
    b.frequency.exponentialRampToValueAtTime(130, when + 0.1); b.connect(bg); bg.connect(out);
    out.connect(E.music); send(E, out, o.verb === undefined ? 0.28 : o.verb);
  };
  I.hat = function (E, when, vel = 0.4, open = false) {
    const n = noiseSrc(E, when, 0.3); const hp = bq(E, 'highpass', 7200); const bp = bq(E, 'bandpass', 10000, 0.6); const g = gn(E, 0.0001);
    const d = open ? 0.22 : 0.045;
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.16 * vel, when + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(E.music);
  };
  I.shaker = function (E, when, vel = 0.4) {
    const n = noiseSrc(E, when, 0.2); const bp = bq(E, 'bandpass', 5200, 1.4); const g = gn(E, 0.0001);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.12 * vel, when + 0.018); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    n.connect(bp); bp.connect(g); g.connect(E.music);
  };
  I.crash = function (E, when, vel = 0.7, len = 3.2) {
    const out = gn(E, 1);
    const n = noiseSrc(E, when, len + 0.2); const hp = bq(E, 'highpass', 3200); const g = gn(E, 0.0001);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.42 * vel, when + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    n.connect(hp); hp.connect(g); g.connect(out);
    const n2 = noiseSrc(E, when, 1.2); const bp = bq(E, 'bandpass', 800, 0.6); const g2 = gn(E, 0.0001);
    g2.gain.setValueAtTime(0.25 * vel, when); g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.6); n2.connect(bp); bp.connect(g2); g2.connect(out);
    out.connect(E.music); send(E, out, 0.4);
  };
  I.revCrash = function (E, when, dur, vel = 0.7) {
    const n = noiseSrc(E, when, dur + 0.1); const hp = bq(E, 'highpass', 2600); const g = gn(E, 0.0001);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.4 * vel, when + dur); g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.04);
    hp.frequency.setValueAtTime(1500, when); hp.frequency.exponentialRampToValueAtTime(5500, when + dur);
    n.connect(hp); hp.connect(g); g.connect(E.music); send(E, g, 0.3);
  };
  I.riser = function (E, when, dur, vel = 0.7, o = {}) {
    const out = gn(E, 1);
    const n = noiseSrc(E, when, dur + 0.2, 'p'); const bp = bq(E, 'bandpass', 300, 1.2); const g = gn(E, 0.0001);
    bp.frequency.setValueAtTime(o.f0 || 260, when); bp.frequency.exponentialRampToValueAtTime(o.f1 || 7800, when + dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.5 * vel, when + dur * 0.96); g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.05);
    n.connect(bp); bp.connect(g); g.connect(out);
    const o1 = osc(E, 'sawtooth', 110, when, when + dur + 0.1); const lp = bq(E, 'lowpass', 400, 1); const og = gn(E, 0.0001);
    o1.frequency.setValueAtTime(110, when); o1.frequency.exponentialRampToValueAtTime(880, when + dur); lp.frequency.setValueAtTime(300, when); lp.frequency.exponentialRampToValueAtTime(3000, when + dur);
    og.gain.setValueAtTime(0.0001, when); og.gain.exponentialRampToValueAtTime(0.12 * vel, when + dur * 0.95); og.gain.linearRampToValueAtTime(0.0001, when + dur + 0.05);
    o1.connect(lp); lp.connect(og); og.connect(out);
    out.connect(o.sfx ? E.sfx : E.music); send(E, out, 0.3);
  };
  /** 低频冲击：次低频下沉 + 噪声 + 长混响，用于重大转场 */
  I.impact = function (E, when, vel = 1) {
    const out = gn(E, 1);
    const env = E.ctx.createGain();
    env.gain.setValueAtTime(0.0001, when); env.gain.linearRampToValueAtTime(0.7 * vel, when + 0.005); env.gain.exponentialRampToValueAtTime(0.0001, when + 2.8);
    const o1 = osc(E, 'sine', 90, when, when + 3); o1.frequency.exponentialRampToValueAtTime(30, when + 1.6); o1.connect(env); env.connect(out);
    const n = noiseSrc(E, when, 1.5); const lp = bq(E, 'lowpass', 1200); const ng = gn(E, 0.0001);
    lp.frequency.setValueAtTime(5000, when); lp.frequency.exponentialRampToValueAtTime(200, when + 1.3);
    ng.gain.setValueAtTime(0.5 * vel, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 1.3); n.connect(lp); lp.connect(ng); ng.connect(out);
    out.connect(E.music); send(E, out, 0.55);
  };

  // ======================================================================
  //  音效
  // ======================================================================
  /** 打字机 / 电传机 / 键盘声 */
  S.tick = function (E, when, kind = 'soft', vel = 1) {
    const ctx = E.ctx, out = gn(E, 1);
    const jit = 1 + (E.rand() - 0.5) * 0.25;
    if (kind === 'tick') { // 电传机：干脆的“嗒”
      const n = noiseSrc(E, when, 0.03); const bp = bq(E, 'bandpass', 3400 * jit, 2.2); const g = gn(E, 0.0001);
      g.gain.setValueAtTime(0.28 * vel, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.016); n.connect(bp); bp.connect(g); g.connect(out);
      const o1 = osc(E, 'square', 1800 * jit, when, when + 0.02); const og = gn(E, 0.0001); og.gain.setValueAtTime(0.06 * vel, when); og.gain.exponentialRampToValueAtTime(0.0001, when + 0.012);
      o1.connect(og); og.connect(out);
    } else { // 轻柔的键帽声
      const n = noiseSrc(E, when, 0.03); const bp = bq(E, 'bandpass', 2300 * jit, 1.4); const g = gn(E, 0.0001);
      g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.1 * vel, when + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.02); n.connect(bp); bp.connect(g); g.connect(out);
      const o1 = osc(E, 'sine', 900 * jit, when, when + 0.03); const og = gn(E, 0.0001); og.gain.setValueAtTime(0.04 * vel, when); og.gain.exponentialRampToValueAtTime(0.0001, when + 0.02);
      o1.connect(og); og.connect(out);
    }
    const pn = panner(E, (E.rand() - 0.5) * 0.3); out.connect(pn); pn.connect(E.sfx);
    send(E, pn, 0.12);
  };
  S.clock = function (E, when, vel = 1, tock = false) {
    const n = noiseSrc(E, when, 0.04); const bp = bq(E, 'bandpass', tock ? 1500 : 2500, 3); const g = gn(E, 0.0001);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.26 * vel, when + 0.0008); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    n.connect(bp); bp.connect(g); g.connect(E.sfx);
    const o1 = osc(E, 'sine', tock ? 720 : 1150, when, when + 0.05); const og = gn(E, 0.0001); og.gain.setValueAtTime(0.12 * vel, when); og.gain.exponentialRampToValueAtTime(0.0001, when + 0.04); o1.connect(og); og.connect(E.sfx);
  };
  S.ping = function (E, when, midi = 88, vel = 0.5) { I.bell(E, when, midi, vel, { dest: E.sfx, long: 0.5 }); };
  S.pop = function (E, when, vel = 0.5, f0 = 700) {
    const o1 = osc(E, 'sine', f0, when, when + 0.15); const g = gn(E, 0.0001);
    o1.frequency.exponentialRampToValueAtTime(f0 * 2.2, when + 0.06);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.16 * vel, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    o1.connect(g); g.connect(E.sfx); send(E, g, 0.25);
  };
  S.chime = function (E, when) { // 客舱提示音 “叮咚”
    I.bell(E, when, 88, 0.55, { dest: E.sfx, long: 0.9, pan: -0.1 });
    I.bell(E, when + 0.46, 84, 0.55, { dest: E.sfx, long: 1.2, pan: -0.1 });
  };
  S.squelch = function (E, when, beep = true) { // 无线电静噪 + 提示音
    const n = noiseSrc(E, when, 0.3); const bp = bq(E, 'bandpass', 2100, 0.9); const hp = bq(E, 'highpass', 900); const g = gn(E, 0.0001);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.22, when + 0.004); g.gain.setValueAtTime(0.22, when + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(E.sfx);
    if (beep) { const o1 = osc(E, 'sine', 1320, when + 0.22, when + 0.32); const og = gn(E, 0.0001); og.gain.setValueAtTime(0.0001, when + 0.22); og.gain.linearRampToValueAtTime(0.06, when + 0.226); og.gain.setValueAtTime(0.06, when + 0.28); og.gain.exponentialRampToValueAtTime(0.0001, when + 0.31); o1.connect(og); og.connect(E.sfx); }
  };
  S.whoosh = function (E, when, dur, o = {}) {
    const out = gn(E, 1);
    const n = noiseSrc(E, when, dur + 0.2, 'p'); const bp = bq(E, 'bandpass', o.f0 || 400, o.q || 0.9); const g = gn(E, 0.0001);
    bp.frequency.setValueAtTime(o.f0 || 400, when); bp.frequency.exponentialRampToValueAtTime(o.f1 || 4000, when + dur);
    const peak = (o.vol || 0.3), pk = (o.peak === undefined ? 0.5 : o.peak) * dur;
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(peak, when + pk); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    n.connect(bp); bp.connect(g); g.connect(out);
    const pn = panner(E, o.pan || 0);
    if (o.panTo !== undefined) pn.pan.linearRampToValueAtTime(o.panTo, when + dur);
    out.connect(pn); pn.connect(E.sfx); send(E, pn, 0.25);
  };
  /** 音爆：双响（N 波）+ 低频冲击 + 隆隆余波 */
  S.boom = function (E, when, vel = 1) {
    const out = gn(E, 1);
    const crack = (t, v, f0) => {
      const n = noiseSrc(E, t, 0.3); const hp = bq(E, 'highpass', f0); const g = gn(E, 0.0001);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * v * vel, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      n.connect(hp); hp.connect(g); g.connect(out);
    };
    crack(when, 1, 700); crack(when + 0.11, 0.7, 500);
    const o1 = osc(E, 'sine', 70, when, when + 2.4); const og = gn(E, 0.0001);
    o1.frequency.setValueAtTime(78, when); o1.frequency.exponentialRampToValueAtTime(30, when + 1.5);
    og.gain.setValueAtTime(0.0001, when); og.gain.linearRampToValueAtTime(1.0 * vel, when + 0.008); og.gain.exponentialRampToValueAtTime(0.0001, when + 2.2);
    o1.connect(og); og.connect(out);
    const n2 = noiseSrc(E, when, 4.2, 'p'); const lp = bq(E, 'lowpass', 260, 0.7); const ng = gn(E, 0.0001);
    lp.frequency.setValueAtTime(900, when); lp.frequency.exponentialRampToValueAtTime(110, when + 3);
    ng.gain.setValueAtTime(0.0001, when); ng.gain.linearRampToValueAtTime(0.9 * vel, when + 0.05); ng.gain.exponentialRampToValueAtTime(0.0001, when + 4);
    n2.connect(lp); lp.connect(ng); ng.connect(out);
    out.connect(E.sfx); send(E, out, 0.55);
  };
  S.thud = function (E, when, vel = 0.8, f = 85) {
    const o1 = osc(E, 'sine', f, when, when + 0.6); const g = gn(E, 0.0001);
    o1.frequency.exponentialRampToValueAtTime(f * 0.4, when + 0.3);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.8 * vel, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.45);
    o1.connect(g); g.connect(E.sfx);
    const n = noiseSrc(E, when, 0.12); const lp = bq(E, 'lowpass', 600); const ng = gn(E, 0.0001); ng.gain.setValueAtTime(0.35 * vel, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
    n.connect(lp); lp.connect(ng); ng.connect(E.sfx);
  };
  S.clunk = function (E, when, vel = 0.6) { // 起落架到位的机械声
    const o1 = osc(E, 'triangle', 140, when, when + 0.3); const g = gn(E, 0.0001);
    o1.frequency.exponentialRampToValueAtTime(70, when + 0.18);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.5 * vel, when + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    o1.connect(g); g.connect(E.sfx);
    const n = noiseSrc(E, when, 0.1); const bp = bq(E, 'bandpass', 1100, 1.5); const ng = gn(E, 0.0001); ng.gain.setValueAtTime(0.3 * vel, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    n.connect(bp); bp.connect(ng); ng.connect(E.sfx); send(E, ng, 0.2);
  };
  S.hydraulic = function (E, when, dur, vel = 0.4) {
    const o1 = osc(E, 'sawtooth', 160, when, when + dur + 0.1); const lp = bq(E, 'lowpass', 700, 2); const g = gn(E, 0.0001);
    o1.frequency.setValueAtTime(150, when); o1.frequency.linearRampToValueAtTime(260, when + dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.06 * vel, when + 0.2); g.gain.setValueAtTime(0.06 * vel, when + dur - 0.2); g.gain.linearRampToValueAtTime(0.0001, when + dur);
    o1.connect(lp); lp.connect(g); g.connect(E.sfx); send(E, g, 0.15);
  };
  S.squeal = function (E, when, dur = 0.7, vel = 0.5) { // 轮胎接地的“吱”
    const n = noiseSrc(E, when, dur + 0.1); const bp = bq(E, 'bandpass', 1700, 6); const g = gn(E, 0.0001);
    bp.frequency.setValueAtTime(1400, when); bp.frequency.linearRampToValueAtTime(2100, when + dur * 0.5); bp.frequency.linearRampToValueAtTime(1500, when + dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.28 * vel, when + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    n.connect(bp); bp.connect(g); g.connect(E.sfx); send(E, g, 0.2);
  };

  /**
   * 喷气发动机 / 风噪层：用若干关键帧函数驱动。
   * o: { level(T), spool(T), ab(T), dop(T), pan(T), whine(0..1), roar(0..1), hiss(0..1) }  T 为全片时间
   * t0/t1 为全片时间区间；when 为 t0 对应的 ctx 绝对时间；skip 为已经过去的秒数。
   */
  S.engine = function (E, when, t0, t1, o, skip = 0) {
    const ctx = E.ctx;
    const dur = t1 - t0;
    const stopT = when + (dur - skip) + 0.3;
    const L = (fn, mul = 1) => sample((t) => fn(t) * mul, t0, t1, 0.12);
    const master = gn(E, 0);
    automate(master.gain, L(o.level), when, skip, 1);
    const pan = panner(E, 0);
    if (o.pan) automate(pan.pan, L(o.pan), when, skip, 1);
    master.connect(pan); pan.connect(E.sfx); send(E, pan, o.verb === undefined ? 0.12 : o.verb);

    // 隆隆声（低频）
    const rum = noiseSrc(E, when, dur, 'p'); const rl = bq(E, 'lowpass', 240, 0.8); const rg = gn(E, 0);
    automate(rg.gain, L((t) => 0.45 * (0.4 + 0.6 * o.spool(t)) * (o.rumble === undefined ? 1 : o.rumble)), when, skip, 1);
    rum.connect(rl); rl.connect(rg); rg.connect(master);
    const sb = osc(E, 'sine', 44, when, stopT); const sbg = gn(E, 0); sb.frequency.value = 40;
    automate(sb.frequency, L((t) => 36 + 20 * o.spool(t)), when, skip, 1); automate(sbg.gain, L((t) => 0.17 * o.spool(t) * (o.rumble === undefined ? 1 : o.rumble)), when, skip, 1);
    sb.connect(sbg); sbg.connect(master);
    // 咆哮（中频）
    const roar = noiseSrc(E, when, dur, 'w'); const rb = bq(E, 'bandpass', 700, 0.7); const rbg = gn(E, 0);
    automate(rb.frequency, L((t) => (420 + 1100 * o.spool(t)) * (o.dop ? o.dop(t) : 1)), when, skip, 1);
    automate(rbg.gain, L((t) => 0.5 * o.spool(t) * (o.roar === undefined ? 1 : o.roar)), when, skip, 1);
    roar.connect(rb); rb.connect(rbg); rbg.connect(master);
    // 嘶声（高频）
    const hs = noiseSrc(E, when, dur, 'w'); const hb = bq(E, 'bandpass', 3200, 0.5); const hg = gn(E, 0);
    automate(hg.gain, L((t) => 0.16 * o.spool(t) * (o.hiss === undefined ? 1 : o.hiss)), when, skip, 1);
    hs.connect(hb); hb.connect(hg); hg.connect(master);
    // 涡轮啸叫
    if (o.whine !== 0) {
      for (const [mul, gv] of [[1, 1], [1.505, 0.55], [2.01, 0.3]]) {
        const w = osc(E, 'sawtooth', 600, when, stopT); const wb = bq(E, 'bandpass', 900, 10); const wg = gn(E, 0);
        automate(w.frequency, L((t) => (380 + 1500 * o.spool(t)) * mul * (o.dop ? o.dop(t) : 1)), when, skip, 1);
        automate(wb.frequency, L((t) => (380 + 1500 * o.spool(t)) * mul * 1.1 * (o.dop ? o.dop(t) : 1)), when, skip, 1);
        automate(wg.gain, L((t) => 0.05 * gv * o.spool(t) * (o.whine === undefined ? 1 : o.whine)), when, skip, 1);
        w.connect(wb); wb.connect(wg); wg.connect(master);
      }
    }
    // 加力：低频轰鸣 + 爆裂噪声
    if (o.ab) {
      const ab = noiseSrc(E, when, dur, 'p'); const al = bq(E, 'bandpass', 160, 0.6); const ag = gn(E, 0);
      automate(ag.gain, L((t) => 0.9 * o.ab(t)), when, skip, 1);
      ab.connect(al); al.connect(ag); ag.connect(master);
      const cr = noiseSrc(E, when, dur, 'w'); const ch = bq(E, 'highpass', 1500); const cg = gn(E, 0); const cl = osc(E, 'square', 26, when, stopT); const clg = gn(E, 0);
      automate(cg.gain, L((t) => 0.08 * o.ab(t)), when, skip, 1); automate(clg.gain, L((t) => 0.08 * o.ab(t)), when, skip, 1);
      cl.connect(clg); clg.connect(cg.gain);
      cr.connect(ch); ch.connect(cg); cg.connect(master);
    }
  };
  /** 环境层：滤波噪声，用于客舱、风声、夜晚 */
  S.ambience = function (E, when, t0, t1, o, skip = 0) {
    const dur = t1 - t0;
    const n = noiseSrc(E, when, dur, o.type || 'p');
    const f = bq(E, o.filter || 'lowpass', o.freq || 400, o.q || 0.7);
    const g = gn(E, 0);
    automate(g.gain, sample(o.level, t0, t1, 0.25), when, skip, 1);
    n.connect(f); f.connect(g); g.connect(o.music ? E.music : E.sfx);
    if (o.lfo) { const l = osc(E, 'sine', o.lfo[0], when, when + dur + 0.1); const lg = gn(E, o.lfo[1]); l.connect(lg); lg.connect(f.frequency); }
    send(E, g, o.verb || 0.1);
  };
  S.drone = function (E, when, t0, t1, midis, level, skip = 0) { // 低沉持续音
    const dur = t1 - t0;
    const g = gn(E, 0); automate(g.gain, sample(level, t0, t1, 0.25), when, skip, 1);
    const lp = bq(E, 'lowpass', 500, 0.5);
    for (const m of midis) { const a = osc(E, 'sine', mtof(m), when, when + dur + 0.1); const b = osc(E, 'triangle', mtof(m) * 1.002, when, when + dur + 0.1); const bg = gn(E, 0.3); b.connect(bg); bg.connect(lp); a.connect(lp); }
    lp.connect(g); g.connect(E.music); send(E, g, 0.4);
  };

  G.AE = { createEngine, mtof, dB, I, S, automate, sample, noiseSrc, bq, gn, osc, panner, adsr, send };
})(typeof window !== 'undefined' ? window : globalThis);
