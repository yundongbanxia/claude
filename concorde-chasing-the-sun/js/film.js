/* 协和逐日 · 影片总控：时间线常量、场景注册、字幕、章节标题、后期 */
(function (G) {
  'use strict';
  const { W, H, BAR } = gfx;
  const { clamp } = U;

  /** 全片时间线（秒）。80 BPM，一小节 = 3.0 秒，全片 68 小节。音乐与画面共用这些同步点。 */
  const BAR_S = 3.0;
  const TL = {
    BAR: BAR_S,
    DURATION: 204,
    intro: [0, 6], blueprint: [6, 30], takeoff: [30, 54], mach: [54, 84],
    sun: [84, 150], routes: [150, 174], end: [174, 204],
    // 关键同步点
    liftoff: 47.6,        // 离地
    boom: 63.0,           // 音爆
    mach2: 74.6,          // 达到 2 马赫
    portholeEnd: 102,
    race: 126,
    title: 138.0,         // 标题揭幕
    touchdown: 183.0,     // 终场着陆
  };

  const Film = {
    W, H, TL, scenes: [], cues: [],
    register(s) { this.scenes.push(s); this.scenes.sort((a, b) => a.t0 - b.t0); },
    cue(c) { this.cues.push(c); },
    sceneAt(T) { for (const s of this.scenes) if (T >= s.t0 && T < s.t1) return s; return this.scenes[this.scenes.length - 1]; },

    /** 绘制一帧。ctx 的变换由外部设定为 1920×1080 逻辑坐标。 */
    draw(ctx, T, opts = {}) {
      T = clamp(T, 0, TL.DURATION - 0.0001);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const s = this.sceneAt(T);
      ctx.save();
      s.draw(ctx, T - s.t0, T);
      ctx.restore();
      // 后期（含辉光）
      gfx.post(ctx, T, s.post || {});
      if (opts.idle) return;
      // 字幕与章节标题（在后期之上，保持清晰）
      this.drawCues(ctx, T);
      // 遮幅
      const lb = clamp((T - 0.2) / 1.6);
      gfx.letterbox(ctx, 1 + (1 - U.ease.outCubic(lb)) * 0.9);
      // 全局淡入淡出
      if (T < 1.0) { ctx.fillStyle = `rgba(0,0,0,${1 - T / 1.0})`; ctx.fillRect(0, 0, W, H); }
      if (T > TL.DURATION - 3.5) { ctx.fillStyle = `rgba(0,0,0,${clamp((T - (TL.DURATION - 3.5)) / 3.2)})`; ctx.fillRect(0, 0, W, H); }
    },

    drawCues(ctx, T) {
      for (const c of this.cues) {
        if (T < c.t0 - 0.01 || T > c.t1 + 0.01) continue;
        const fi = c.fi === undefined ? 0.7 : c.fi, fo = c.fo === undefined ? 0.7 : c.fo;
        const a = gfx.env(T, c.t0, c.t1, fi, fo);
        if (a <= 0.001) continue;
        const rise = (1 - U.ease.outCubic(clamp((T - c.t0) / 0.9))) * 12;
        if (c.kind === 'chapter') { this.drawChapter(ctx, T, c, a); continue; }
        if (c.kind === 'big') { this.drawBig(ctx, T, c, a); continue; }
        if (c.kind === 'draw') { c.draw(ctx, T, a); continue; }
        if (c.kind === 'hud') { Film.hud(ctx, a, c.rows(T), c.x, c.y); continue; }
        if (c.kind === 'radio') { this.radio(ctx, T, c.t0, c.t1, c.who, c.msg, c.y); continue; }
        const y = c.y || (H - BAR - 64);
        // 底部柔和压暗，保证字幕可读
        if (!c.noScrim) {
          const g = ctx.createLinearGradient(0, y - 120, 0, H - BAR);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.5 * a * (c.scrim === undefined ? 1 : c.scrim)})`);
          ctx.fillStyle = g; ctx.fillRect(0, y - 120, W, H - BAR - (y - 120));
        }
        const prog = c.type ? clamp((T - c.t0) / (c.type)) : undefined;
        gfx.text(ctx, c.zh, W / 2, y + rise, {
          size: c.size || 40, family: c.family || 'serif', weight: c.weight || 500, color: c.color || '#fff', track: c.track === undefined ? 7 : c.track,
          align: 'center', alpha: a, progress: prog, shadow: { blur: 16, color: 'rgba(0,0,0,0.65)' },
        });
        if (c.en) {
          gfx.text(ctx, c.en, W / 2, y + 36 + rise, { size: 17, family: 'sans', weight: 400, color: c.enColor || 'rgba(235,225,210,0.82)', track: 5, align: 'center', alpha: a * 0.9, shadow: { blur: 8 } });
        }
      }
    },

    drawChapter(ctx, T, c, a) {
      const x = 120, y = BAR + 70;
      const w = 26 + 150 * U.ease.outCubic(clamp((T - c.t0) / 1.2));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = c.color || 'rgba(255,214,150,0.9)';
      ctx.fillRect(x, y - 26, 3, 52);
      ctx.restore();
      gfx.text(ctx, c.num, x + 22, y - 4, { size: 15, family: 'mono', color: c.color || 'rgba(255,214,150,0.95)', track: 6, alpha: a });
      gfx.text(ctx, c.zh, x + 22, y + 26, { size: 30, family: 'serif', weight: 600, color: '#fff', track: 8, alpha: a, shadow: { blur: 14 } });
      gfx.text(ctx, c.en, x + 22 + gfx.measure(ctx, c.zh, { size: 30, family: 'serif', weight: 600, track: 8 }) + 22, y + 26, { size: 14, family: 'sans', color: 'rgba(255,255,255,0.7)', track: 5, alpha: a });
    },

    drawBig(ctx, T, c, a) {
      const prog = c.type ? clamp((T - c.t0) / c.type) : undefined;
      const rise = (1 - U.ease.outCubic(clamp((T - c.t0) / 1.4))) * 20;
      gfx.text(ctx, c.zh, c.x === undefined ? W / 2 : c.x, c.y + rise, {
        size: c.size || 120, family: c.family || 'serif', weight: c.weight || 600, color: c.color || '#fff',
        track: c.track === undefined ? 30 : c.track, align: c.align || 'center', alpha: a, progress: prog,
        glow: c.glow || { color: 'rgba(255,200,130,0.55)', blur: 36 },
      });
      if (c.en) gfx.text(ctx, c.en, c.x === undefined ? W / 2 : c.x, c.y + (c.enDy || 60) + rise, { size: c.enSize || 24, family: 'sans', color: c.enColor || 'rgba(255,235,205,0.9)', track: c.enTrack || 12, align: c.align || 'center', alpha: a * 0.95 });
    },
  };

  G.Film = Film;
  G.TL = TL;
})(typeof window !== 'undefined' ? window : globalThis);
