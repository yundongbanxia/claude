import type { Game } from '../game/game';
import { Game as GameClass } from '../game/game';
import { DIFFICULTIES, type DifficultyId } from '../data/difficulty';
import { el } from './hud';

const CONTROLS: [string, string][] = [
  ['W A S D', '移动'],
  ['Shift', '奔跑（后退+Shift：快速转身）'],
  ['鼠标右键', '瞄准（瞄准时可缓慢移动，静止时准星会收拢）'],
  ['鼠标左键', '开火'],
  ['R', '换弹'],
  ['F / 空格', '互动 · 体术（敌人硬直时）· 挣脱'],
  ['Q / 鼠标中键', '小刀：挥砍 / 按住格挡 / 时机按下完美格挡'],
  ['C', '蹲下（潜行，可躲避电锯横扫）'],
  ['G', '投掷手雷 / 闪光弹'],
  ['H', '快速回复'],
  ['1 - 8 / 滚轮', '切换武器'],
  ['Tab / I', '手提箱'],
  ['Esc', '暂停'],
];

export class Menus {
  g: Game;
  root: HTMLElement;
  private screen: HTMLElement | null = null;
  onNewGame: ((d: DifficultyId) => void) | null = null;

  constructor(g: Game, root: HTMLElement) {
    this.g = g;
    this.root = root;
  }

  private clear() {
    this.screen?.remove();
    this.screen = null;
  }

  private make(cls = 'screen dim'): HTMLElement {
    this.clear();
    this.screen = el('div', { class: cls }, this.root);
    return this.screen;
  }

  private button(parent: HTMLElement, text: string, fn: () => void, desc = '', disabled = false) {
    const b = el('button', {}, parent, text + (desc ? `<span class="desc">${desc}</span>` : ''));
    b.disabled = disabled;
    b.addEventListener('mouseenter', () => this.g.audio.play('ui_move'));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.g.audio.init();
      this.g.audio.play('ui_ok');
      fn();
    });
    return b;
  }

  title() {
    const g = this.g;
    g.audio.music?.setMode('title');
    const s = this.make('screen');
    s.style.background = 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,.15), rgba(0,0,0,.85) 80%)';
    el('h1', { class: 'title' }, s, '生化危机 <em>4</em>');
    el('div', { class: 'subtitle2' }, s, 'RE:4 VILLAGE · 村庄篇 · 同人复刻');
    const m = el('div', { class: 'menu' }, s);
    this.button(m, '新游戏', () => this.difficulty());
    let hasCp = false;
    try {
      hasCp = !!localStorage.getItem('re4v_checkpoint');
    } catch {
      /* ignore */
    }
    this.button(m, '继续游戏', () => this.continueCheckpoint(), '从最近的检查点继续', !hasCp);
    this.button(m, '读取存档', () => this.load(() => this.title()));
    this.button(m, '设置', () => this.settings(() => this.title()));
    this.button(m, '操作说明', () => this.controls(() => this.title()));
    el(
      'div',
      { class: 'fine' },
      s,
      '非官方同人作品，与 CAPCOM 无关，仅供个人学习交流。所有模型、贴图、声音均由程序实时生成。<br>建议使用 Chrome / Edge 浏览器，戴耳机游玩效果更佳。',
    );
  }

  private continueCheckpoint() {
    try {
      const raw = localStorage.getItem('re4v_checkpoint');
      if (!raw) return;
      const s = JSON.parse(raw);
      this.clear();
      this.g.checkpointData = s;
      this.g.restore(s);
      this.startPlay();
    } catch {
      /* ignore */
    }
  }

  private startPlay() {
    this.clear();
    this.g.hud.setGameplayVisible(true);
    if (!this.g.test) this.g.input.requestLock();
  }

  difficulty() {
    const s = this.make('screen');
    s.style.background = 'rgba(0,0,0,.9)';
    const p = el('div', { class: 'panel' }, s);
    el('h2', {}, p, '选择难度');
    const m = el('div', { class: 'menu' }, p);
    for (const d of Object.values(DIFFICULTIES)) {
      this.button(m, d.name, () => this.intro(d.id), d.desc);
    }
    this.button(m, '返回', () => this.title());
  }

  intro(d: DifficultyId) {
    const s = this.make('screen');
    s.style.background = '#000';
    const lines = [
      '2004 年，美国总统的女儿阿什莉·格拉汉姆被神秘组织绑架。',
      '六年前从浣熊市地狱中生还的里昂·S·肯尼迪，如今是总统直属的特工。',
      '线索指向欧洲一处偏远的乡村。',
      '两名当地警察开车把他送到了山林的入口……',
    ];
    const box = el('div', {}, s);
    box.style.cssText = 'max-width:680px;font-family:var(--serif);font-size:20px;line-height:2.2;color:#cfc8b8;letter-spacing:2px;';
    lines.forEach((l, i) => {
      const d2 = el('div', {}, box, l);
      d2.style.opacity = '0';
      d2.style.transition = 'opacity 1.4s';
      setTimeout(() => (d2.style.opacity = '1'), 600 + i * 1500);
    });
    const hint = el('div', {}, s, '点击继续');
    hint.style.cssText = 'position:absolute;bottom:40px;color:#777;font-size:13px;letter-spacing:4px;';
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      this.g.audio.init();
      this.clear();
      this.onNewGame?.(d);
      this.startPlay();
    };
    s.addEventListener('click', go);
    setTimeout(() => {
      if (this.screen === s) hint.textContent = '点击开始';
    }, 6500);
  }

  private escHandler = (e: KeyboardEvent) => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && this.g.state === 'pause' && this.screen?.dataset.kind === 'pause') {
      e.preventDefault();
      this.g.resume();
    }
  };

  pause(v: boolean) {
    window.removeEventListener('keydown', this.escHandler);
    if (!v) {
      this.clear();
      return;
    }
    const g = this.g;
    const s = this.make();
    s.dataset.kind = 'pause';
    setTimeout(() => window.addEventListener('keydown', this.escHandler), 200);
    el('h2', {}, s, '暂停').style.cssText = 'font-weight:400;letter-spacing:10px;color:var(--gold2);margin-bottom:24px;';
    const m = el('div', { class: 'menu' }, s);
    this.button(m, '继续游戏', () => g.resume());
    this.button(m, '手提箱', () => {
      this.clear();
      g.openInventory();
    });
    this.button(m, '设置', () => this.settings(() => this.pause(true)));
    this.button(m, '操作说明', () => this.controls(() => this.pause(true)));
    this.button(m, '从检查点重来', () => {
      this.clear();
      if (g.checkpointData) g.restore(g.checkpointData);
      this.startPlay();
    });
    this.button(m, '返回标题', () => this.toTitle());
    this.stats(s);
  }

  private stats(s: HTMLElement) {
    const g = this.g;
    const st = g.stats;
    const acc = g.combat.shots ? Math.round((g.combat.hits / g.combat.shots) * 100) : 0;
    const t = Math.floor(g.playTime);
    const info = el('div', {}, s, `${g.area?.name ?? ''} · 难度：${g.diff.name} · 用时 ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · 击杀 ${st.kills} · 命中率 ${acc}% · ${g.inv.pesetas.toLocaleString()} PTAS`);
    info.style.cssText = 'position:absolute;bottom:26px;color:#8a8478;font-size:13px;letter-spacing:1px;';
  }

  death(v: boolean) {
    if (!v) {
      this.clear();
      return;
    }
    if (this.screen?.id === 'death') return;
    const g = this.g;
    const s = this.make('screen');
    s.id = 'death';
    s.style.background = 'rgba(0,0,0,.35)';
    el('h1', {}, s, 'YOU ARE DEAD');
    const m = el('div', { class: 'menu' }, s);
    this.button(m, '继续', () => {
      this.clear();
      g.continueFromCheckpoint();
      this.startPlay();
    });
    this.button(m, '返回标题', () => this.toTitle());
  }

  toTitle() {
    const g = this.g;
    g.setState('title');
    g.hud.setGameplayVisible(false);
    g.showTitleBackdrop();
    this.title();
  }

  settings(back: () => void) {
    const g = this.g;
    const st = g.settings;
    const s = this.make();
    const p = el('div', { class: 'panel interactive' }, s);
    el('h2', {}, p, '设置');
    const slider = (label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void) => {
      const r = el('div', { class: 'row' }, p, `<span>${label}</span>`);
      const i = el('input', { type: 'range', min: String(min), max: String(max), step: String(step) }, r);
      i.value = String(get());
      i.addEventListener('input', () => {
        set(parseFloat(i.value));
        g.applySettings();
      });
    };
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
      const r = el('div', { class: 'row' }, p, `<span>${label}</span>`);
      const i = el('input', { type: 'checkbox' }, r);
      i.checked = get();
      i.addEventListener('change', () => {
        set(i.checked);
        g.applySettings();
      });
    };
    slider('鼠标灵敏度', 0.3, 2.5, 0.05, () => st.sens, (v) => (st.sens = v));
    toggle('反转 Y 轴', () => st.invertY, (v) => (st.invertY = v));
    slider('视野 (FOV)', 50, 80, 1, () => st.fov, (v) => (st.fov = v));
    const qr = el('div', { class: 'row' }, p, '<span>画质</span>');
    const q = el('select', {}, qr, '<option value="low">低（推荐核显）</option><option value="medium">中</option><option value="high">高</option>');
    q.value = st.quality;
    q.addEventListener('change', () => {
      st.quality = q.value as typeof st.quality;
      g.applySettings();
    });
    toggle('血腥效果', () => st.gore, (v) => (st.gore = v));
    toggle('敌人西班牙语喊话（浏览器语音）', () => st.tts, (v) => (st.tts = v));
    slider('主音量', 0, 1, 0.05, () => st.master, (v) => (st.master = v));
    slider('音乐', 0, 1, 0.05, () => st.music, (v) => (st.music = v));
    slider('音效', 0, 1, 0.05, () => st.sfx, (v) => (st.sfx = v));
    toggle('显示帧率', () => g.hud.showFps, (v) => (g.hud.showFps = v));
    toggle('全屏', () => !!document.fullscreenElement, (v) => {
      try {
        if (v) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      } catch {
        /* ignore */
      }
    });
    const m = el('div', { class: 'menu' }, p);
    m.style.marginTop = '14px';
    this.button(m, '返回', back);
  }

  controls(back: () => void) {
    const s = this.make();
    const p = el('div', { class: 'panel' }, s);
    el('h2', {}, p, '操作说明');
    const c = el('div', { class: 'controls' }, p);
    for (const [k, v] of CONTROLS) {
      el('div', {}, c, k.split(' / ').map((x) => `<span class="key">${x}</span>`).join(' '));
      el('div', {}, c, v);
    }
    el(
      'div',
      {},
      p,
      '<br><b style="color:var(--gold2);font-weight:400">战斗要点</b><br>· 爆头会让敌人捂脸硬直，打腿会让敌人跪地——此时靠近按 <span class="key">F</span> 使用回旋踢或背摔。<br>· 敌人攻击挥下的瞬间按 <span class="key">Q</span> 可以完美格挡，按住 <span class="key">Q</span> 可以持续防御（消耗小刀耐久）。<br>· 从背后接近没有发现你的敌人，按 <span class="key">Q</span> 潜行击杀。<br>· 射击敌人手中的炸药会直接引爆。电锯男的抓取是一击必杀，保持距离！',
    ).style.cssText = 'font-size:13px;line-height:1.9;color:#bbb;margin-top:8px;max-width:620px;';
    const m = el('div', { class: 'menu' }, p);
    m.style.marginTop = '14px';
    this.button(m, '返回', back);
  }

  load(back: () => void) {
    const s = this.make();
    const p = el('div', { class: 'panel' }, s);
    el('h2', {}, p, '读取存档');
    const m = el('div', { class: 'menu' }, p);
    for (let i = 1; i <= 3; i++) {
      const d = GameClass.readSlot(i);
      if (d) {
        const when = new Date(d.savedAt).toLocaleString();
        this.button(m, `存档 ${i}　${d.areaName}`, () => {
          this.clear();
          this.g.checkpointData = d;
          this.g.restore(d);
          this.startPlay();
        }, `${when} · ${DIFFICULTIES[d.difficulty]?.name ?? ''}`);
      } else this.button(m, `存档 ${i}　—— 空 ——`, () => {}, '', true);
    }
    this.button(m, '返回', back);
  }

  typewriter() {
    const g = this.g;
    g.setState('pause');
    g.input.exitLock();
    g.audio.play('typewriter');
    g.audio.music?.setMode('safe');
    const s = this.make();
    const p = el('div', { class: 'panel' }, s);
    el('h2', {}, p, '打字机 —— 保存进度');
    const m = el('div', { class: 'menu' }, p);
    const close = () => {
      this.clear();
      g.resume();
    };
    for (let i = 1; i <= 3; i++) {
      const d = GameClass.readSlot(i);
      const label = d ? `存档 ${i}　${d.areaName}　${new Date(d.savedAt).toLocaleString()}` : `存档 ${i}　—— 空 ——`;
      this.button(m, label, () => {
        if (g.saveSlot(i)) {
          g.audio.play('typewriter');
          g.hud.toast(`已保存到存档 ${i}`);
        }
        close();
      });
    }
    this.button(m, '取消', close);
  }

  results() {
    const g = this.g;
    g.setState('results');
    g.input.exitLock();
    g.hud.setGameplayVisible(false);
    const st = g.stats;
    const acc = g.combat.shots ? Math.round((g.combat.hits / g.combat.shots) * 100) : 0;
    const t = Math.floor(g.playTime);
    const score = (st.deaths === 0 ? 2 : st.deaths < 3 ? 1 : 0) + (acc > 60 ? 2 : acc > 40 ? 1 : 0) + (t < 1800 ? 2 : t < 2700 ? 1 : 0) + (g.diff.id === 'hardcore' || g.diff.id === 'professional' ? 1 : 0);
    const rank = score >= 6 ? 'S' : score >= 4 ? 'A' : score >= 2 ? 'B' : 'C';
    const s = this.make('screen');
    s.style.background = 'rgba(0,0,0,.92)';
    const p = el('div', { class: 'panel results' }, s);
    el('h2', {}, p, '第一章 · 村庄　完');
    const rows: [string, string][] = [
      ['难度', g.diff.name],
      ['通关用时', `${Math.floor(t / 60)} 分 ${t % 60} 秒`],
      ['击杀数', String(st.kills)],
      ['命中率', `${acc}%`],
      ['爆头数', String(g.combat.headshots)],
      ['完美/普通格挡', String(st.parries)],
      ['死亡次数', String(st.deaths)],
      ['获得比塞塔', `${st.pesetas.toLocaleString()} PTAS`],
    ];
    for (const [a, b] of rows) el('div', { class: 'row' }, p, `<span>${a}</span><span>${b}</span>`);
    el('div', { class: 'row' }, p, `<span>评级</span><span class="big">${rank}</span>`);
    el('p', {}, p, '里昂穿过了村庄的大门……但阿什莉仍然下落不明。<br><span style="color:#888">—— To be continued ——</span>').style.cssText = 'line-height:1.9;color:#bbb;margin-top:18px;';
    const m = el('div', { class: 'menu' }, p);
    this.button(m, '返回标题', () => this.toTitle());
  }

  loading(text = '载入中……') {
    const s = this.make('screen');
    s.style.background = '#000';
    el('div', {}, s, text).style.cssText = 'color:#888;letter-spacing:6px;';
  }

  close() {
    this.clear();
  }
}
