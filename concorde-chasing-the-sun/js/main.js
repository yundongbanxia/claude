/* 协和逐日 · 播放器：时钟（以音频时钟为准）、控制条、键盘、自适应分辨率、离线渲染钩子 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  const DUR = TL.DURATION;
  const $ = (id) => document.getElementById(id);
  const canvas = $('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  const Player = AudioShow.Player;
  const CHAPTERS = [[0, '序章'], [6, '第一幕 · 图纸'], [30, '第二幕 · 起飞'], [54, '第三幕 · 突破'], [84, '第四幕 · 逐日'], [150, '第五幕 · 航线'], [174, '终章 · 落日']];

  // ---------------------------------------------------------------- 分辨率
  let scale = 1;
  function setScale(s) {
    scale = s;
    canvas.width = Math.round(1920 * s); canvas.height = Math.round(1080 * s);
  }
  function initialScale() {
    const cssW = Math.min(window.innerWidth, window.innerHeight * 16 / 9) * (window.devicePixelRatio || 1);
    return cssW >= 1700 ? 1 : cssW >= 1300 ? 0.8 : cssW >= 950 ? 0.6667 : 0.5;
  }
  function drawFrame(T, opts) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    Film.draw(ctx, T, opts);
  }

  // ---------------------------------------------------------------- 预热（字体、云精灵、点阵）
  function warmup() {
    for (const [p, l] of [['day', 1], ['gold', 1], ['gold', -1]]) gfx.cloudSet(p, l);
    const fonts = ['600 40px CCSerif', '400 30px CCSerif', '400 20px CCSansLatin', '500 20px CCSansLatin', '400 20px CCSans', '400 20px CCMono', '700 20px CCMono'];
    return Promise.all(fonts.map((f) => (document.fonts && document.fonts.load ? document.fonts.load(f, '协和逐日0123 ABC') : Promise.resolve()).catch(() => 0)))
      .then(() => (document.fonts && document.fonts.ready) || 0);
  }

  // ---------------------------------------------------------------- 渲染模式（供 tools/render.mjs 调用）
  if (RENDER) {
    document.body.classList.add('render');
    const w = +params.get('w') || 1920;
    const s = w / 1920;
    setScale(s);
    window.__film = {
      ready: false,
      duration: DUR,
      draw(T) { drawFrame(T); return true; },
      jpeg(T, q = 0.93) { drawFrame(T); return canvas.toDataURL('image/jpeg', q).slice(23); },
      async audio(sr = 44100, seconds = DUR) {
        const buf = await AudioShow.renderOffline(sr, seconds);
        const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
        window.__pcm = { L, R: Rr, sr: buf.sampleRate, n: buf.length };
        return { n: buf.length, sr: buf.sampleRate };
      },
      pcmChunk(i0, n) { // 返回 s16le 交错立体声的 base64
        const { L, R } = window.__pcm;
        const m = Math.min(n, L.length - i0);
        const buf = new Int16Array(m * 2);
        for (let i = 0; i < m; i++) { buf[2 * i] = Math.max(-1, Math.min(1, L[i0 + i])) * 32767; buf[2 * i + 1] = Math.max(-1, Math.min(1, R[i0 + i])) * 32767; }
        const u8 = new Uint8Array(buf.buffer);
        let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
      },
    };
    warmup().then(() => { window.__film.ready = true; });
    return;
  }

  // ---------------------------------------------------------------- 播放状态
  setScale(initialScale());
  let state = 'idle';        // idle | playing | paused | ended
  let Tbase = 0, tPerf0 = 0;  // 无音频时用 performance 时钟兜底
  let muted = false;
  let lastUI = 0, uiOn = false;

  const audioOK = () => Player.ready && Player.ctx && Player.ctx.state === 'running';
  function nowT() {
    if (state === 'idle') return 0.9 + ((performance.now() / 1000) % 5);
    if (state === 'paused' || state === 'ended') return Tbase;
    return audioOK() ? Player.time() : Tbase + (performance.now() - tPerf0) / 1000;
  }
  const fmt = (t) => { t = Math.max(0, Math.floor(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1400); }

  function begin(T0 = 0) {
    state = 'playing'; Tbase = T0; tPerf0 = performance.now();
    $('start').classList.add('gone'); $('end').classList.remove('on');
    try { Player.start(T0); } catch (e) { console.warn('audio failed', e); }
    Player.setMuted(muted);
    setPlayIcon();
    showUI();
  }
  function togglePlay() {
    if (state === 'idle') return begin(0);
    if (state === 'ended') return begin(0);
    if (state === 'playing') { Tbase = nowT(); state = 'paused'; Player.pause(); }
    else if (state === 'paused') { tPerf0 = performance.now(); state = 'playing'; Player.resume(); }
    setPlayIcon(); showUI();
  }
  function seekTo(T) {
    T = Math.max(0, Math.min(DUR - 0.05, T));
    if (state === 'idle') return begin(T);
    Tbase = T; tPerf0 = performance.now();
    if (state === 'ended') { state = 'paused'; $('end').classList.remove('on'); }
    if (Player.ready) Player.seek(T);
    showUI();
  }
  function setPlayIcon() { $('ico-pause').style.display = state === 'playing' ? '' : 'none'; $('ico-play').style.display = state === 'playing' ? 'none' : ''; }
  function setMute(m) { muted = m; Player.setMuted(m); $('ico-vol').style.display = m ? 'none' : ''; $('ico-mute').style.display = m ? '' : 'none'; toast(m ? '已静音' : '声音已开启'); }
  function fullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen || (() => 0)).call(el);
  }
  function chapterJump(dir) {
    const T = nowT();
    let idx = 0; CHAPTERS.forEach((c, i) => { if (T >= c[0] - 0.01) idx = i; });
    let target;
    if (dir > 0) target = CHAPTERS[Math.min(CHAPTERS.length - 1, idx + 1)][0];
    else target = T - CHAPTERS[idx][0] > 2 ? CHAPTERS[idx][0] : CHAPTERS[Math.max(0, idx - 1)][0];
    seekTo(target); toast(CHAPTERS[CHAPTERS.findIndex((c) => c[0] === target)][1]);
  }

  // ---------------------------------------------------------------- 控制条
  function showUI() { lastUI = performance.now(); if (!uiOn) { uiOn = true; document.body.classList.add('ui-on'); document.body.classList.remove('hide-cursor'); } }
  function tickUI(now) {
    if (uiOn && state === 'playing' && now - lastUI > 2600 && !$('bar').matches(':hover')) { uiOn = false; document.body.classList.remove('ui-on'); document.body.classList.add('hide-cursor'); }
    if (state !== 'playing' && !uiOn && state !== 'idle') showUI();
  }
  const bar = $('bar');
  CHAPTERS.slice(1).forEach(([t]) => { const m = document.createElement('div'); m.className = 'mark'; m.style.left = `${(t / DUR) * 100}%`; bar.querySelector('.track').appendChild(m); });
  let dragging = false;
  function barT(e) { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * DUR; }
  bar.addEventListener('pointerdown', (e) => { dragging = true; bar.setPointerCapture(e.pointerId); seekTo(barT(e)); });
  bar.addEventListener('pointermove', (e) => {
    const T = barT(e), r = bar.getBoundingClientRect();
    let name = ''; CHAPTERS.forEach((c) => { if (T >= c[0]) name = c[1]; });
    const tip = $('tip'); tip.textContent = `${fmt(T)}  ${name}`; tip.style.left = `${Math.max(60, Math.min(r.width - 60, e.clientX - r.left))}px`;
    if (dragging) seekTo(T);
  });
  bar.addEventListener('pointerup', () => { dragging = false; });
  $('pp').onclick = togglePlay; $('mute').onclick = () => setMute(!muted); $('fs').onclick = fullscreen;
  canvas.addEventListener('click', () => { if (state !== 'idle') togglePlay(); });
  canvas.addEventListener('dblclick', fullscreen);
  $('again').onclick = () => begin(0);
  $('go').onclick = () => begin(+params.get('t') || 0);
  window.addEventListener('mousemove', showUI);
  window.addEventListener('touchstart', showUI, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' || k === 'k' || k === 'K') { e.preventDefault(); if (state === 'idle' && $('go').disabled) return; togglePlay(); }
    else if (k === 'ArrowRight') { e.preventDefault(); seekTo(nowT() + (e.shiftKey ? 15 : 5)); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seekTo(nowT() - (e.shiftKey ? 15 : 5)); }
    else if (k === ']' || k === 'PageDown') chapterJump(1);
    else if (k === '[' || k === 'PageUp') chapterJump(-1);
    else if (k === 'm' || k === 'M') setMute(!muted);
    else if (k === 'f' || k === 'F') fullscreen();
    else if (k === 'Home') seekTo(0);
    else if (k === 'End') seekTo(DUR - 8);
    else if (/^[0-9]$/.test(k) && state !== 'idle') seekTo((+k / 10) * DUR);
    else return;
    showUI();
  });

  // ---------------------------------------------------------------- 主循环
  let lastNow = performance.now(), slow = 0, fast = 0, lastDegrade = 0;
  function loop(now) {
    const dtMs = now - lastNow; lastNow = now;
    const T = nowT();
    // 自适应分辨率：连续掉帧则降级，长时间流畅再回升
    if (state === 'playing' && dtMs > 0 && dtMs < 250) {
      if (dtMs > 26) { slow++; fast = 0; } else if (dtMs < 18.5) { fast++; slow = Math.max(0, slow - 1); } else { fast = 0; }
      const steps = [1, 0.8, 0.6667, 0.5];
      const i = steps.findIndex((s) => Math.abs(s - scale) < 0.01);
      if (slow > 36 && i >= 0 && i < steps.length - 1) { setScale(steps[i + 1]); slow = 0; lastDegrade = now; }
      else if (fast > 480 && i > 0 && now - lastDegrade > 12000 && steps[i - 1] * 1920 <= window.innerWidth * (window.devicePixelRatio || 1) * 1.05) { setScale(steps[i - 1]); fast = 0; lastDegrade = now; }
    }
    drawFrame(Math.min(T, DUR - 0.001), state === 'idle' ? { idle: true } : undefined);
    if (state === 'playing') {
      if (T >= DUR - 0.02) { state = 'ended'; Tbase = DUR; Player.pause(); $('end').classList.add('on'); setPlayIcon(); }
      const p = Math.min(1, T / DUR);
      $('fill').style.width = `${p * 100}%`; $('knob').style.left = `${p * 100}%`;
      $('time').textContent = `${fmt(T)} / ${fmt(DUR)}`;
    }
    tickUI(now);
    requestAnimationFrame(loop);
  }

  // 启动
  document.body.classList.add('hide-cursor');
  requestAnimationFrame(loop);
  warmup().then(() => {
    const b = $('go'); b.disabled = false; b.textContent = '▶  开始观看';
    if (params.has('autoplay')) begin(+params.get('t') || 0);
  });
  window.__debug = { seekTo, Player, state: () => state, scale: () => scale };
})();
