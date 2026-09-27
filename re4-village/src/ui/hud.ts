import { CSS } from './styles';
import type { Game } from '../game/game';
import type { Pickup } from '../game/entities';
import { WEAPONS, wCap } from '../data/weapons';
import { KNIFE_MAX } from '../game/player/player';
import { angleDiff } from '../core/math';
import { CaseUI } from './case';
import { MerchantUI } from './merchant';
import { Menus } from './menus';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}
export { el };

export class Hud {
  g: Game;
  root: HTMLElement;
  private reticle: HTMLElement;
  private ticks: HTMLElement[];
  private hitmark: HTMLElement;
  private scope: HTMLElement;
  private status: HTMLElement;
  private magEl: HTMLElement;
  private resEl: HTMLElement;
  private wnameEl: HTMLElement;
  private hpFill: HTMLElement;
  private hpLag: HTMLElement;
  private hpState: HTMLElement;
  private kFill: HTMLElement;
  private nadesEl: HTMLElement;
  private prompt: HTMLElement;
  private toasts: HTMLElement;
  private feed: HTMLElement;
  private pesetasEl: HTMLElement;
  private subtitleEl: HTMLElement;
  private areaTitleEl: HTMLElement;
  objectiveEl: HTMLElement;
  private mashEl: HTMLElement;
  private mashFill: HTMLElement;
  private dmgInd: HTMLElement;
  private fpsEl: HTMLElement;
  timerEl: HTMLElement;
  private subT = 0;
  private areaT = 0;
  private pesT = 0;
  private last = { mag: -1, res: -1, wname: '', hp: -1, knife: -1, nades: '' };
  private hitT = 0;
  caseUI: CaseUI;
  merchantUI: MerchantUI;
  menus: Menus;
  private fpsAcc = { t: 0, n: 0 };
  showFps = false;

  constructor(g: Game, root: HTMLElement) {
    this.g = g;
    this.root = root;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.scope = el('div', { id: 'scope', class: 'hidden' }, root);
    this.reticle = el('div', { id: 'reticle', class: 'hidden' }, root);
    el('div', { class: 'dot' }, this.reticle);
    this.ticks = ['t', 'b', 'l', 'r'].map((c) => el('div', { class: 'tick ' + c }, this.reticle));
    this.hitmark = el('div', { id: 'hitmark' }, root);
    this.dmgInd = el('div', { id: 'dmgind' }, root);

    this.status = el('div', { id: 'status', class: 'hidden' }, root);
    const wrow = el('div', { class: 'weapon' }, this.status);
    this.wnameEl = el('span', { class: 'wname' }, wrow);
    this.magEl = el('span', { class: 'mag' }, wrow, '0');
    this.resEl = el('span', { class: 'reserve' }, wrow, '/ 0');
    const hpw = el('div', { class: 'hpwrap' }, this.status);
    this.hpState = el('span', { class: 'hpstate' }, hpw, 'FINE');
    const bar = el('div', { class: 'hpbar' }, hpw);
    this.hpLag = el('div', { class: 'hplag' }, bar);
    this.hpFill = el('div', { class: 'hpfill' }, bar);
    const kn = el('div', { class: 'knife' }, this.status, '小刀');
    const kb = el('div', { class: 'kbar' }, kn);
    this.kFill = el('div', { class: 'kfill' }, kb);
    this.nadesEl = el('div', { class: 'nades' }, this.status);

    this.prompt = el('div', { id: 'prompt', class: 'hidden' }, root);
    this.toasts = el('div', { id: 'toasts' }, root);
    this.feed = el('div', { id: 'feed' }, root);
    this.pesetasEl = el('div', { id: 'pesetas' }, root);
    this.pesetasEl.style.opacity = '0';
    this.subtitleEl = el('div', { id: 'subtitle' }, root);
    this.areaTitleEl = el('div', { id: 'areatitle' }, root);
    this.objectiveEl = el('div', { id: 'objective', class: 'hidden' }, root);
    this.timerEl = el('div', { id: 'timer', class: 'hidden' }, root);
    this.mashEl = el('div', { id: 'mash', class: 'hidden' }, root);
    el('div', { class: 'label' }, this.mashEl, '<span class="key">F</span> 连按挣脱　<span class="key">Q</span> 小刀反击');
    const mb = el('div', { class: 'bar' }, this.mashEl);
    this.mashFill = el('div', { class: 'fill' }, mb);
    this.fpsEl = el('div', { id: 'fps', class: 'hidden' }, root);

    this.caseUI = new CaseUI(g, root);
    this.merchantUI = new MerchantUI(g, root);
    this.menus = new Menus(g, root);
  }

  setGameplayVisible(v: boolean) {
    this.status.classList.toggle('hidden', !v);
    if (!v) {
      this.reticle.classList.add('hidden');
      this.scope.classList.add('hidden');
      this.prompt.classList.add('hidden');
      this.objectiveEl.classList.add('hidden');
      this.timerEl.classList.add('hidden');
    }
  }

  update(dt: number) {
    const g = this.g;
    const p = g.player;
    const playing = g.state === 'play' && !g.cutscene;
    this.status.classList.toggle('hidden', !playing);
    // fps
    this.fpsAcc.t += dt;
    this.fpsAcc.n++;
    if (this.fpsAcc.t > 0.5) {
      if (this.showFps) {
        this.fpsEl.classList.remove('hidden');
        const s = g.renderer.stats;
        this.fpsEl.textContent = `${Math.round(this.fpsAcc.n / this.fpsAcc.t)} fps · ${s.calls} calls · ${(s.triangles / 1000).toFixed(0)}k tris · ${g.enemies.length} enemies`;
      }
      this.fpsAcc = { t: 0, n: 0 };
    }
    // reticle
    const wd = p.wdef;
    const aimVis = playing && p.aiming && g.camera.aimT > 0.6;
    const scoped = aimVis && wd?.kind === 'rifle' && g.camera.scope > 0.7;
    this.scope.classList.toggle('hidden', !scoped);
    this.reticle.classList.toggle('hidden', !aimVis || scoped);
    if (aimVis && wd) {
      // spread (deg) -> pixels
      const fovRad = (g.camera.cam.fov * Math.PI) / 180;
      const px = (Math.tan((p.spread * Math.PI) / 180) / Math.tan(fovRad / 2)) * (window.innerHeight / 2);
      const r = Math.max(5, px);
      this.ticks[0].style.top = `${-r - 9}px`;
      this.ticks[1].style.top = `${r}px`;
      this.ticks[2].style.left = `${-r - 9}px`;
      this.ticks[3].style.left = `${r}px`;
      this.reticle.classList.toggle('enemy', !!p.aimHitEnemy);
      this.reticle.classList.toggle('focused', p.focusT > 0.05);
    }
    this.hitT -= dt;
    this.hitmark.style.opacity = this.hitT > 0 ? '1' : '0';
    if (!playing) return;
    // weapon
    const w = p.weapon;
    const mag = w?.weapon ? w.weapon.mag : -1;
    const res = wd ? g.inv.count(wd.ammo) : -1;
    const wname = w?.weapon ? WEAPONS[w.weapon.id].name : '无武器';
    if (mag !== this.last.mag || res !== this.last.res || wname !== this.last.wname) {
      this.last.mag = mag;
      this.last.res = res;
      this.last.wname = wname;
      this.wnameEl.textContent = wname;
      this.magEl.textContent = mag >= 0 ? String(mag) : '-';
      this.magEl.classList.toggle('empty', mag === 0);
      this.resEl.textContent = res >= 0 ? `/ ${res}` : '';
      if (w?.weapon && mag >= 0) this.magEl.title = `${mag}/${wCap(w.weapon)}`;
    }
    const hp = Math.round(p.hp);
    if (hp !== this.last.hp) {
      this.last.hp = hp;
      const f = p.hp / p.maxHp;
      this.hpFill.style.width = `${f * 100}%`;
      this.hpLag.style.width = `${f * 100}%`;
      this.hpFill.style.background = f > 0.5 ? 'linear-gradient(90deg,#3a9a3a,#6ad060)' : f > 0.25 ? 'linear-gradient(90deg,#a08a20,#e0c040)' : 'linear-gradient(90deg,#8a1a14,#d83a2a)';
      this.hpState.textContent = f > 0.5 ? 'FINE' : f > 0.25 ? 'CAUTION' : 'DANGER';
      this.hpState.style.color = f > 0.5 ? '#7ad070' : f > 0.25 ? '#e0c040' : '#ff4a3a';
    }
    const k = Math.round(p.knife);
    if (k !== this.last.knife) {
      this.last.knife = k;
      this.kFill.style.width = `${(p.knife / KNIFE_MAX) * 100}%`;
      this.kFill.style.background = p.knife <= 0 ? '#555' : p.knife < 250 ? '#d84a3a' : '#b8bcc0';
    }
    const nades = `手雷 ${g.inv.count('nade')}　闪光弹 ${g.inv.count('flash')}`;
    if (nades !== this.last.nades) {
      this.last.nades = nades;
      this.nadesEl.textContent = nades;
    }
    // timers
    if (this.subT > 0) {
      this.subT -= dt;
      if (this.subT <= 0) this.subtitleEl.textContent = '';
    }
    if (this.areaT > 0) {
      this.areaT -= dt;
      if (this.areaT <= 0) this.areaTitleEl.style.opacity = '0';
    }
    if (this.pesT > 0) {
      this.pesT -= dt;
      if (this.pesT <= 0) this.pesetasEl.style.opacity = '0';
    }
  }

  setPrompt(text: string, key: string) {
    if (!text) {
      this.prompt.classList.add('hidden');
      return;
    }
    this.prompt.classList.remove('hidden');
    this.prompt.classList.toggle('melee', text === '回旋踢' || text === '背摔');
    this.prompt.innerHTML = `<span class="key">${key}</span><span class="t">${text}</span>`;
  }

  toast(text: string, dur = 1.8) {
    const t = el('div', { class: 'toast' }, this.toasts, text);
    while (this.toasts.children.length > 3) this.toasts.firstChild?.remove();
    setTimeout(() => {
      t.style.transition = 'opacity .4s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 450);
    }, dur * 1000);
  }

  pickupFeed(text: string) {
    const t = el('div', { class: 'feed' }, this.feed, text);
    while (this.feed.children.length > 4) this.feed.firstChild?.remove();
    setTimeout(() => t.remove(), 2600);
  }

  pesetas(total: number, delta: number) {
    this.pesetasEl.innerHTML = `${total.toLocaleString()} PTAS<small>+${delta.toLocaleString()}</small>`;
    this.pesetasEl.style.opacity = '1';
    this.pesT = 2.5;
  }

  subtitle(text: string, dur: number) {
    this.subtitleEl.innerHTML = text;
    this.subT = text ? dur : 0;
  }

  areaTitle(name: string, sub = '') {
    this.areaTitleEl.innerHTML = `${name}${sub ? `<small>${sub}</small>` : ''}`;
    this.areaTitleEl.style.opacity = '1';
    this.areaT = 3.5;
  }

  objective(text: string | null) {
    if (!text) {
      this.objectiveEl.classList.add('hidden');
      return;
    }
    this.objectiveEl.classList.remove('hidden');
    this.objectiveEl.innerHTML = `<b>目标</b>${text}`;
  }

  showMash(v: boolean) {
    this.mashEl.classList.toggle('hidden', !v);
    this.mashFill.style.width = '0%';
  }
  setMash(f: number) {
    this.mashFill.style.width = `${Math.min(1, f) * 100}%`;
  }

  damageIndicator(fromYaw: number) {
    const rel = angleDiff(this.g.camera.yaw, fromYaw);
    const a = el('div', { class: 'dmgarc' }, this.dmgInd);
    a.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
    setTimeout(() => a.remove(), 1200);
  }

  hitMarker() {
    this.hitT = 0.12;
  }

  showDeath(v: boolean) {
    this.menus.death(v);
  }
  showPause(v: boolean) {
    this.menus.pause(v);
  }
  openCase(pending: Pickup | null) {
    this.caseUI.open(pending);
  }
  openMerchant() {
    this.merchantUI.open();
  }
}
