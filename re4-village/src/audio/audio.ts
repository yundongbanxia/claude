import * as THREE from 'three';
import { rng } from '../core/rng';

/**
 * Fully synthesized audio: no sample files. Everything is built from
 * oscillators, noise and filters at play time.
 */
export type Sfx =
  | 'hg_shot' | 'red9_shot' | 'sg_shot' | 'rf_shot' | 'dry' | 'mag_out' | 'mag_in' | 'slide' | 'shell' | 'bolt'
  | 'step' | 'step_wood' | 'knife_swing' | 'knife_hit' | 'parry' | 'parry_perfect' | 'kick_whoosh' | 'kick_hit'
  | 'flesh' | 'headshot' | 'head_burst' | 'body_fall' | 'leon_hurt' | 'leon_hurt_big' | 'leon_grunt'
  | 'door_open' | 'door_close' | 'door_bash' | 'wood_break' | 'explosion' | 'flash_bang' | 'fuse' | 'throw'
  | 'whoosh' | 'axe_hit_wall' | 'pickup' | 'pesetas' | 'ui_move' | 'ui_ok' | 'ui_back' | 'ui_error' | 'typewriter'
  | 'crow' | 'chicken' | 'ladder_fall' | 'thud' | 'metal' | 'heal' | 'grab' | 'choke' | 'decap' | 'bear_trap'
  | 'item_drop' | 'glass' | 'moo' | 'crank' | 'gate' | 'buy' | 'medal';

export interface LoopHandle {
  setPos(p: THREE.Vector3): void;
  set(param: number): void;
  stop(): void;
}

export class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  voiceBus!: GainNode;
  ambBus!: GainNode;
  reverbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private listenerPos = new THREE.Vector3();
  volumes = { master: 0.8, sfx: 1, music: 0.55, voice: 1 };
  tts = true;
  private ttsVoice: SpeechSynthesisVoice | null = null;
  private ttsEnVoice: SpeechSynthesisVoice | null = null;
  private lastSpeak = 0;
  music: Music | null = null;
  private ambience: { stop: () => void } | null = null;
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    for (const b of [this.sfxBus, this.musicBus, this.voiceBus, this.ambBus]) b.connect(this.master);
    // reverb
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(2.4, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.5;
    this.reverbSend.connect(conv);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    conv.connect(wet);
    wet.connect(this.master);
    // noise
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.music = new Music(this);
    this.pickVoices();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => this.pickVoices();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.musicBus.gain.value = this.volumes.music;
    this.voiceBus.gain.value = this.volumes.voice;
    this.ambBus.gain.value = this.volumes.sfx * 0.8;
  }

  private pickVoices() {
    if (typeof speechSynthesis === 'undefined') return;
    const vs = speechSynthesis.getVoices();
    this.ttsVoice = vs.find((v) => v.lang.startsWith('es-ES')) ?? vs.find((v) => v.lang.startsWith('es')) ?? null;
    this.ttsEnVoice = vs.find((v) => v.lang.startsWith('en-GB')) ?? vs.find((v) => v.lang.startsWith('en')) ?? null;
  }

  private impulse(dur: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setListener(pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3) {
    this.listenerPos.copy(pos);
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const t = ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02);
      l.positionY.setTargetAtTime(pos.y, t, 0.02);
      l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02);
      l.upY.setTargetAtTime(up.y, t, 0.02);
      l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      (l as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(pos.x, pos.y, pos.z);
    }
  }

  /** Output node: optionally spatialized. */
  private out(pos: THREE.Vector3 | undefined, vol: number, bus: GainNode, reverb = 0.25, refDist = 2.5): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = vol;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = refDist;
      p.rolloffFactor = 1.1;
      p.maxDistance = 80;
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
      (g as unknown as { __panner?: PannerNode }).__panner = p;
      g.connect(p);
      p.connect(bus);
      if (reverb > 0) {
        const rs = ctx.createGain();
        rs.gain.value = reverb;
        p.connect(rs);
        rs.connect(this.reverbSend);
      }
    } else {
      g.connect(bus);
      if (reverb > 0) {
        const rs = ctx.createGain();
        rs.gain.value = reverb;
        g.connect(rs);
        rs.connect(this.reverbSend);
      }
    }
    return g;
  }

  private noise(t: number, dur: number, dest: AudioNode, filt: { type: BiquadFilterType; f: number; q?: number; f2?: number }[], env: [number, number][], rate = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    let node: AudioNode = src;
    for (const f of filt) {
      const b = ctx.createBiquadFilter();
      b.type = f.type;
      b.frequency.setValueAtTime(f.f, t);
      if (f.f2) b.frequency.exponentialRampToValueAtTime(f.f2, t + dur);
      b.Q.value = f.q ?? 0.7;
      node.connect(b);
      node = b;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (const [tt, v] of env) g.gain.linearRampToValueAtTime(v, t + tt);
    node.connect(g);
    g.connect(dest);
    src.start(t, rng.range(0, 1.5));
    src.stop(t + dur + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, dest: AudioNode, env: [number, number][], filt?: { type: BiquadFilterType; f: number; q?: number }) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    let node: AudioNode = o;
    if (filt) {
      const b = ctx.createBiquadFilter();
      b.type = filt.type;
      b.frequency.value = filt.f;
      b.Q.value = filt.q ?? 0.7;
      o.connect(b);
      node = b;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (const [tt, v] of env) g.gain.linearRampToValueAtTime(v, t + tt);
    node.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name: Sfx, pos?: THREE.Vector3, vol = 1, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (pos && pos.distanceTo(this.listenerPos) > 70) return;
    const t = ctx.currentTime + 0.005;
    const p = pitch * rng.range(0.94, 1.06);
    switch (name) {
      case 'hg_shot':
      case 'red9_shot': {
        const big = name === 'red9_shot';
        const o = this.out(pos, vol * (big ? 1.1 : 0.9), this.sfxBus, 0.7, 6);
        this.noise(t, 0.25, o, [{ type: 'highpass', f: 400 }, { type: 'lowpass', f: 6000 * p, f2: 900 }], [[0.002, 1], [0.03, 0.45], [0.25, 0]]);
        this.tone(t, 'sine', 160 * p, 45, 0.18, o, [[0.003, big ? 1.1 : 0.8], [0.18, 0]]);
        this.noise(t, 0.012, o, [{ type: 'highpass', f: 3000 }], [[0.001, 0.8], [0.012, 0]]);
        break;
      }
      case 'sg_shot': {
        const o = this.out(pos, vol * 1.2, this.sfxBus, 0.8, 7);
        this.noise(t, 0.5, o, [{ type: 'lowpass', f: 4000 * p, f2: 300 }], [[0.003, 1.2], [0.08, 0.6], [0.5, 0]]);
        this.tone(t, 'sine', 120 * p, 30, 0.35, o, [[0.004, 1.3], [0.35, 0]]);
        this.tone(t, 'square', 70, 40, 0.1, o, [[0.003, 0.3], [0.1, 0]], { type: 'lowpass', f: 500 });
        break;
      }
      case 'rf_shot': {
        const o = this.out(pos, vol * 1.2, this.sfxBus, 1, 8);
        this.noise(t, 0.7, o, [{ type: 'highpass', f: 200 }, { type: 'lowpass', f: 9000 * p, f2: 500 }], [[0.001, 1.3], [0.05, 0.5], [0.7, 0]]);
        this.tone(t, 'sine', 200 * p, 40, 0.3, o, [[0.002, 1.1], [0.3, 0]]);
        break;
      }
      case 'dry': {
        const o = this.out(pos, vol * 0.5, this.sfxBus, 0);
        this.noise(t, 0.03, o, [{ type: 'bandpass', f: 3500, q: 3 }], [[0.001, 1], [0.03, 0]]);
        break;
      }
      case 'mag_out':
      case 'mag_in':
      case 'slide':
      case 'shell':
      case 'bolt': {
        const o = this.out(pos, vol * 0.45, this.sfxBus, 0.05);
        const f = name === 'mag_out' ? 2200 : name === 'mag_in' ? 1600 : name === 'shell' ? 1300 : 2600;
        this.noise(t, 0.04, o, [{ type: 'bandpass', f: f * p, q: 4 }], [[0.001, 1], [0.04, 0]]);
        this.noise(t + 0.05, 0.05, o, [{ type: 'bandpass', f: f * 0.7 * p, q: 5 }], [[0.001, 0.7], [0.05, 0]]);
        if (name === 'slide' || name === 'bolt') this.noise(t + 0.12, 0.06, o, [{ type: 'bandpass', f: 3200, q: 3 }], [[0.001, 0.9], [0.06, 0]]);
        break;
      }
      case 'step':
      case 'step_wood': {
        const o = this.out(pos, vol * 0.25, this.sfxBus, 0.05, 1.5);
        const wood = name === 'step_wood';
        this.noise(t, 0.09, o, [{ type: 'lowpass', f: (wood ? 900 : 600) * p }], [[0.005, 1], [0.09, 0]]);
        if (wood) this.tone(t, 'sine', 140 * p, 90, 0.06, o, [[0.003, 0.4], [0.06, 0]]);
        break;
      }
      case 'knife_swing':
      case 'whoosh':
      case 'kick_whoosh': {
        const o = this.out(pos, vol * 0.5, this.sfxBus, 0.05);
        this.noise(t, 0.22, o, [{ type: 'bandpass', f: 800 * p, f2: 3000 * p, q: 2 }], [[0.06, 1], [0.22, 0]]);
        break;
      }
      case 'knife_hit':
      case 'flesh':
      case 'kick_hit': {
        const o = this.out(pos, vol * (name === 'kick_hit' ? 1 : 0.7), this.sfxBus, 0.1);
        this.tone(t, 'sine', 110 * p, 50, 0.15, o, [[0.003, 1], [0.15, 0]]);
        this.noise(t, 0.12, o, [{ type: 'lowpass', f: 1400 * p }], [[0.003, 0.8], [0.12, 0]]);
        if (name === 'knife_hit') this.noise(t, 0.08, o, [{ type: 'bandpass', f: 2500, q: 2 }], [[0.002, 0.5], [0.08, 0]]);
        break;
      }
      case 'parry':
      case 'parry_perfect': {
        const o = this.out(pos, vol * 0.9, this.sfxBus, 0.5);
        const perf = name === 'parry_perfect';
        for (const f of perf ? [1760, 2637, 3520] : [1500, 2250]) this.tone(t, 'triangle', f * p, f * p * 0.98, perf ? 0.9 : 0.4, o, [[0.002, 0.35], [perf ? 0.9 : 0.4, 0]]);
        this.noise(t, 0.05, o, [{ type: 'highpass', f: 2000 }], [[0.001, 1], [0.05, 0]]);
        break;
      }
      case 'headshot': {
        const o = this.out(pos, vol * 0.9, this.sfxBus, 0.1);
        this.noise(t, 0.2, o, [{ type: 'lowpass', f: 1800 * p, f2: 300 }], [[0.003, 1], [0.2, 0]]);
        this.tone(t, 'sine', 90, 40, 0.2, o, [[0.003, 0.8], [0.2, 0]]);
        break;
      }
      case 'head_burst': {
        const o = this.out(pos, vol * 1.1, this.sfxBus, 0.3);
        this.noise(t, 0.45, o, [{ type: 'lowpass', f: 2200 * p, f2: 200 }], [[0.003, 1.2], [0.1, 0.5], [0.45, 0]]);
        this.noise(t + 0.03, 0.3, o, [{ type: 'bandpass', f: 600, q: 1 }], [[0.01, 0.7], [0.3, 0]], 0.5);
        this.tone(t, 'sine', 70, 30, 0.3, o, [[0.003, 1], [0.3, 0]]);
        break;
      }
      case 'body_fall':
      case 'thud': {
        const o = this.out(pos, vol * 0.8, this.sfxBus, 0.1);
        this.tone(t, 'sine', 80 * p, 35, 0.25, o, [[0.005, 1], [0.25, 0]]);
        this.noise(t, 0.2, o, [{ type: 'lowpass', f: 500 }], [[0.005, 0.9], [0.2, 0]]);
        break;
      }
      case 'leon_hurt':
      case 'leon_hurt_big':
      case 'leon_grunt': {
        const o = this.out(undefined, vol * 0.7, this.voiceBus, 0.05);
        this.vox(t, o, name === 'leon_hurt_big' ? 0.5 : 0.28, 125 * p, 90, name === 'leon_grunt' ? 'u' : 'a', 0.7);
        break;
      }
      case 'door_open':
      case 'door_close': {
        const o = this.out(pos, vol * 0.6, this.sfxBus, 0.2);
        this.tone(t, 'sawtooth', 300 * p, 520 * p, 0.35, o, [[0.05, 0.12], [0.35, 0]], { type: 'bandpass', f: 900, q: 6 });
        if (name === 'door_close') this.tone(t + 0.3, 'sine', 90, 60, 0.15, o, [[0.003, 0.8], [0.15, 0]]);
        break;
      }
      case 'door_bash': {
        const o = this.out(pos, vol, this.sfxBus, 0.3);
        this.tone(t, 'sine', 95 * p, 50, 0.3, o, [[0.003, 1.2], [0.3, 0]]);
        this.noise(t, 0.25, o, [{ type: 'lowpass', f: 1200 }], [[0.003, 0.8], [0.25, 0]]);
        break;
      }
      case 'wood_break': {
        const o = this.out(pos, vol, this.sfxBus, 0.3);
        for (let i = 0; i < 5; i++) this.noise(t + i * 0.03 + rng.range(0, 0.02), 0.08, o, [{ type: 'bandpass', f: rng.range(600, 2500), q: 3 }], [[0.002, 1], [0.08, 0]]);
        this.tone(t, 'sine', 120, 50, 0.25, o, [[0.003, 0.8], [0.25, 0]]);
        break;
      }
      case 'glass': {
        const o = this.out(pos, vol * 0.8, this.sfxBus, 0.3);
        for (let i = 0; i < 8; i++) this.tone(t + i * 0.02, 'triangle', rng.range(2500, 6000), rng.range(2000, 5000), 0.2, o, [[0.002, 0.2], [0.2, 0]]);
        this.noise(t, 0.3, o, [{ type: 'highpass', f: 3000 }], [[0.002, 0.8], [0.3, 0]]);
        break;
      }
      case 'explosion': {
        const o = this.out(pos, vol * 1.6, this.sfxBus, 1, 10);
        this.noise(t, 1.6, o, [{ type: 'lowpass', f: 3000, f2: 120 }], [[0.005, 1.5], [0.2, 0.8], [1.6, 0]]);
        this.tone(t, 'sine', 70, 22, 1.0, o, [[0.005, 1.6], [1.0, 0]]);
        this.noise(t + 0.3, 1.2, o, [{ type: 'bandpass', f: 1500, q: 0.8 }], [[0.1, 0.2], [1.2, 0]]);
        break;
      }
      case 'flash_bang': {
        const o = this.out(pos, vol * 1.2, this.sfxBus, 0.8, 8);
        this.noise(t, 0.4, o, [{ type: 'highpass', f: 1500 }], [[0.002, 1.3], [0.4, 0]]);
        this.tone(t, 'sine', 3800, 3700, 2.0, o, [[0.01, 0.15], [2.0, 0]]);
        break;
      }
      case 'fuse': {
        const o = this.out(pos, vol * 0.35, this.sfxBus, 0);
        this.noise(t, 0.5, o, [{ type: 'highpass', f: 4000 }], [[0.02, 0.8], [0.45, 0.8], [0.5, 0]]);
        break;
      }
      case 'throw': {
        const o = this.out(pos, vol * 0.6, this.sfxBus, 0.05);
        this.noise(t, 0.35, o, [{ type: 'bandpass', f: 500, f2: 1800, q: 2 }], [[0.1, 1], [0.35, 0]]);
        break;
      }
      case 'axe_hit_wall':
      case 'metal': {
        const o = this.out(pos, vol * 0.8, this.sfxBus, 0.3);
        this.tone(t, 'triangle', 900 * p, 850 * p, 0.3, o, [[0.002, 0.4], [0.3, 0]]);
        this.tone(t, 'triangle', 1430 * p, 1400 * p, 0.25, o, [[0.002, 0.25], [0.25, 0]]);
        this.noise(t, 0.05, o, [{ type: 'highpass', f: 2000 }], [[0.001, 0.9], [0.05, 0]]);
        break;
      }
      case 'pickup': {
        const o = this.out(undefined, vol * 0.4, this.sfxBus, 0.1);
        this.tone(t, 'triangle', 880, 880, 0.08, o, [[0.005, 0.6], [0.08, 0]]);
        this.tone(t + 0.07, 'triangle', 1320, 1320, 0.12, o, [[0.005, 0.6], [0.12, 0]]);
        break;
      }
      case 'pesetas':
      case 'buy': {
        const o = this.out(undefined, vol * 0.4, this.sfxBus, 0.1);
        for (let i = 0; i < 4; i++) this.tone(t + i * 0.045, 'square', 1800 + i * 300, 1800 + i * 300, 0.08, o, [[0.002, 0.2], [0.08, 0]], { type: 'bandpass', f: 3000, q: 2 });
        break;
      }
      case 'ui_move': {
        const o = this.out(undefined, vol * 0.25, this.sfxBus, 0);
        this.tone(t, 'triangle', 660, 660, 0.05, o, [[0.003, 0.5], [0.05, 0]]);
        break;
      }
      case 'ui_ok': {
        const o = this.out(undefined, vol * 0.3, this.sfxBus, 0);
        this.tone(t, 'triangle', 880, 880, 0.06, o, [[0.003, 0.5], [0.06, 0]]);
        this.tone(t + 0.05, 'triangle', 1175, 1175, 0.1, o, [[0.003, 0.5], [0.1, 0]]);
        break;
      }
      case 'ui_back':
      case 'ui_error': {
        const o = this.out(undefined, vol * 0.3, this.sfxBus, 0);
        this.tone(t, 'triangle', name === 'ui_error' ? 220 : 660, name === 'ui_error' ? 200 : 440, 0.12, o, [[0.003, 0.5], [0.12, 0]]);
        break;
      }
      case 'typewriter': {
        const o = this.out(undefined, vol * 0.5, this.sfxBus, 0.1);
        for (let i = 0; i < 9; i++) this.noise(t + i * 0.09 + rng.range(0, 0.03), 0.03, o, [{ type: 'bandpass', f: rng.range(2000, 3500), q: 4 }], [[0.001, 1], [0.03, 0]]);
        this.tone(t + 0.95, 'triangle', 2600, 2600, 0.4, o, [[0.002, 0.3], [0.4, 0]]);
        break;
      }
      case 'crow': {
        const o = this.out(pos, vol * 0.5, this.ambBus, 0.4, 4);
        for (let i = 0; i < rng.int(2, 3); i++) {
          const tt = t + i * 0.32;
          this.tone(tt, 'sawtooth', 560 * p, 380 * p, 0.22, o, [[0.02, 0.5], [0.22, 0]], { type: 'bandpass', f: 1300, q: 3 });
        }
        break;
      }
      case 'chicken': {
        const o = this.out(pos, vol * 0.35, this.ambBus, 0.2, 2);
        for (let i = 0; i < 3; i++) this.tone(t + i * 0.12, 'sawtooth', 700 * p, 900 * p, 0.09, o, [[0.01, 0.4], [0.09, 0]], { type: 'bandpass', f: 1500, q: 4 });
        break;
      }
      case 'moo': {
        const o = this.out(pos, vol * 0.6, this.ambBus, 0.3, 4);
        this.vox(t, o, 1.2, 110 * p, 95 * p, 'o', 0.9);
        break;
      }
      case 'ladder_fall': {
        const o = this.out(pos, vol, this.sfxBus, 0.3);
        this.noise(t, 0.2, o, [{ type: 'bandpass', f: 800, q: 2 }], [[0.01, 0.5], [0.2, 0]]);
        this.tone(t + 0.45, 'sine', 100, 45, 0.3, o, [[0.003, 1.2], [0.3, 0]]);
        this.noise(t + 0.45, 0.3, o, [{ type: 'lowpass', f: 1500 }], [[0.003, 0.9], [0.3, 0]]);
        break;
      }
      case 'heal': {
        const o = this.out(undefined, vol * 0.35, this.sfxBus, 0.2);
        for (let i = 0; i < 3; i++) this.tone(t + i * 0.08, 'sine', 660 * (1 + i * 0.25), 660 * (1 + i * 0.25), 0.3, o, [[0.01, 0.4], [0.3, 0]]);
        break;
      }
      case 'grab': {
        const o = this.out(pos, vol * 0.8, this.sfxBus, 0.1);
        this.noise(t, 0.15, o, [{ type: 'lowpass', f: 900 }], [[0.005, 1], [0.15, 0]]);
        break;
      }
      case 'choke': {
        const o = this.out(undefined, vol * 0.5, this.voiceBus, 0.05);
        this.vox(t, o, 0.5, 150, 130, 'u', 0.5);
        break;
      }
      case 'decap': {
        const o = this.out(pos, vol * 1.2, this.sfxBus, 0.4);
        this.noise(t, 0.8, o, [{ type: 'lowpass', f: 2500, f2: 300 }], [[0.005, 1.4], [0.8, 0]]);
        this.tone(t, 'sine', 60, 30, 0.6, o, [[0.005, 1.2], [0.6, 0]]);
        break;
      }
      case 'bear_trap': {
        const o = this.out(pos, vol, this.sfxBus, 0.3);
        this.tone(t, 'square', 400, 200, 0.12, o, [[0.001, 0.5], [0.12, 0]], { type: 'bandpass', f: 1200, q: 3 });
        this.noise(t, 0.1, o, [{ type: 'highpass', f: 1500 }], [[0.001, 1], [0.1, 0]]);
        break;
      }
      case 'item_drop': {
        const o = this.out(pos, vol * 0.4, this.sfxBus, 0.1);
        this.tone(t, 'triangle', 1200, 900, 0.1, o, [[0.002, 0.4], [0.1, 0]]);
        break;
      }
      case 'crank': {
        const o = this.out(pos, vol * 0.5, this.sfxBus, 0.2);
        for (let i = 0; i < 4; i++) this.noise(t + i * 0.08, 0.03, o, [{ type: 'bandpass', f: 1800, q: 6 }], [[0.001, 1], [0.03, 0]]);
        break;
      }
      case 'gate': {
        const o = this.out(pos, vol, this.sfxBus, 0.6, 6);
        this.tone(t, 'sawtooth', 70, 60, 2.5, o, [[0.2, 0.3], [2.3, 0.3], [2.5, 0]], { type: 'lowpass', f: 400 });
        this.tone(t + 2.4, 'sine', 80, 40, 0.5, o, [[0.003, 1.2], [0.5, 0]]);
        break;
      }
      case 'medal': {
        const o = this.out(pos, vol * 0.8, this.sfxBus, 0.5, 6);
        this.tone(t, 'triangle', 1400, 1380, 0.8, o, [[0.002, 0.4], [0.8, 0]]);
        this.noise(t, 0.2, o, [{ type: 'highpass', f: 2500 }], [[0.002, 0.8], [0.2, 0]]);
        break;
      }
    }
  }

  /** Crude formant voice (grunts, shouts). */
  private vox(t: number, dest: AudioNode, dur: number, f0: number, f1: number, vowel: 'a' | 'o' | 'u' | 'e', loud = 1) {
    const ctx = this.ctx!;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0, t);
    src.frequency.linearRampToValueAtTime(f0 * 1.08, t + dur * 0.3);
    src.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = rng.range(5, 8);
    const vg = ctx.createGain();
    vg.gain.value = f0 * 0.03;
    vib.connect(vg);
    vg.connect(src.frequency);
    const formants: Record<string, [number, number, number]> = { a: [750, 1150, 2600], o: [450, 800, 2600], u: [320, 800, 2300], e: [480, 1750, 2500] };
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(loud, t + 0.04);
    g.gain.setValueAtTime(loud, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const n = this.ctx!.createBufferSource();
    n.buffer = this.noiseBuf;
    const ng = ctx.createGain();
    ng.gain.value = 0.15;
    n.connect(ng);
    for (const [k, fr] of formants[vowel].entries()) {
      const b = ctx.createBiquadFilter();
      b.type = 'bandpass';
      b.frequency.value = fr * rng.range(0.92, 1.08);
      b.Q.value = 6 + k * 2;
      const bg = ctx.createGain();
      bg.gain.value = [1, 0.5, 0.2][k] * 2.2;
      src.connect(b);
      ng.connect(b);
      b.connect(bg);
      bg.connect(g);
    }
    g.connect(dest);
    src.start(t);
    vib.start(t);
    n.start(t, rng.range(0, 1));
    src.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
    n.stop(t + dur + 0.05);
  }

  /** Enemy vocalization at a position. */
  grunt(pos: THREE.Vector3, kind: 'idle' | 'alert' | 'attack' | 'pain' | 'death' | 'female_pain' | 'salvador', pitchMul = 1) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (pos.distanceTo(this.listenerPos) > 45) return;
    const t = ctx.currentTime + 0.01;
    const o = this.out(pos, kind === 'salvador' ? 1.2 : 0.8, this.voiceBus, 0.3, 3);
    const base = 105 * pitchMul * rng.range(0.9, 1.12);
    switch (kind) {
      case 'idle':
        this.vox(t, o, rng.range(0.5, 0.9), base, base * 0.85, rng.pick(['o', 'u', 'e']), 0.4);
        break;
      case 'alert':
        this.vox(t, o, 0.7, base * 1.4, base * 1.1, 'a', 1);
        break;
      case 'attack':
        this.vox(t, o, 0.45, base * 1.5, base * 1.2, 'a', 1);
        break;
      case 'pain':
      case 'female_pain':
        this.vox(t, o, 0.35, base * (kind === 'female_pain' ? 2.2 : 1.6), base * 1.1, rng.pick(['a', 'u']), 0.9);
        break;
      case 'death':
        this.vox(t, o, 0.9, base * 1.3, base * 0.6, 'a', 0.9);
        break;
      case 'salvador':
        this.vox(t, o, 1.2, 80, 60, 'o', 1.3);
        this.noise(t, 1.2, o, [{ type: 'lowpass', f: 700 }], [[0.1, 0.4], [1.2, 0]]);
        break;
    }
  }

  /** Spanish shout via speech synthesis (throttled), plus a formant bark for spatial cue. */
  shout(pos: THREE.Vector3, text: string, pitchMul = 1, female = false) {
    this.grunt(pos, 'alert', female ? 1.8 : pitchMul);
    if (!this.tts || typeof speechSynthesis === 'undefined' || !this.ctx) return;
    const now = performance.now();
    if (now - this.lastSpeak < 1600) return;
    const d = pos.distanceTo(this.listenerPos);
    if (d > 30) return;
    this.lastSpeak = now;
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (this.ttsVoice) u.voice = this.ttsVoice;
      u.lang = 'es-ES';
      u.pitch = female ? 1.1 : 0.35 * pitchMul;
      u.rate = 0.92;
      u.volume = Math.max(0.15, Math.min(1, (1 - d / 32) * this.volumes.voice * this.volumes.master));
      speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }

  say(text: string, lang: 'en' | 'es', pitch = 0.6, rate = 0.95) {
    if (!this.tts || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = lang === 'en' ? this.ttsEnVoice : this.ttsVoice;
      if (v) u.voice = v;
      u.lang = lang === 'en' ? 'en-GB' : 'es-ES';
      u.pitch = pitch;
      u.rate = rate;
      u.volume = this.volumes.voice * this.volumes.master;
      speechSynthesis.speak(u);
      this.lastSpeak = performance.now();
    } catch {
      /* ignore */
    }
  }

  // ------------------------------------------------------------------ loops

  chainsaw(pos: THREE.Vector3): LoopHandle {
    const ctx = this.ctx;
    if (!ctx) return nullLoop;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 48;
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 97;
    const am = ctx.createOscillator();
    am.frequency.value = 26;
    const amG = ctx.createGain();
    amG.gain.value = 0.35;
    const mix = ctx.createGain();
    mix.gain.value = 0.6;
    am.connect(amG);
    amG.connect(mix.gain);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 3.5);
    }
    shaper.curve = curve;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 1100;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 2200;
    nf.Q.value = 1;
    const ng = ctx.createGain();
    ng.gain.value = 0.08;
    o1.connect(mix);
    o2.connect(mix);
    mix.connect(shaper);
    shaper.connect(bp);
    n.connect(nf);
    nf.connect(ng);
    const out = this.out(pos, 0.0, this.sfxBus, 0.2, 5);
    bp.connect(out);
    ng.connect(out);
    o1.start();
    o2.start();
    am.start();
    n.start();
    out.gain.setTargetAtTime(0.38, ctx.currentTime, 0.2);
    let stopped = false;
    const panner = findPanner(out);
    return {
      setPos: (p) => {
        if (panner) {
          panner.positionX.setTargetAtTime(p.x, ctx.currentTime, 0.03);
          panner.positionY.setTargetAtTime(p.y, ctx.currentTime, 0.03);
          panner.positionZ.setTargetAtTime(p.z, ctx.currentTime, 0.03);
        }
      },
      set: (rev) => {
        const t = ctx.currentTime;
        o1.frequency.setTargetAtTime(48 + rev * 52, t, 0.08);
        o2.frequency.setTargetAtTime(97 + rev * 105, t, 0.08);
        am.frequency.setTargetAtTime(26 + rev * 30, t, 0.1);
        bp.frequency.setTargetAtTime(1100 + rev * 2400, t, 0.08);
        out.gain.setTargetAtTime(0.38 + rev * 0.35, t, 0.08);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.15);
        for (const s of [o1, o2, am, n]) s.stop(t + 1);
      },
    };
  }

  fireLoop(pos: THREE.Vector3, vol = 0.5): LoopHandle {
    const ctx = this.ctx;
    if (!ctx) return nullLoop;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const out = this.out(pos, vol, this.ambBus, 0.1, 2.5);
    n.connect(f);
    f.connect(out);
    n.start();
    // crackles
    let alive = true;
    const crackle = () => {
      if (!alive || !this.ctx) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < rng.int(1, 3); i++) this.noise(t + rng.range(0, 0.1), 0.02, out, [{ type: 'highpass', f: 2500 }], [[0.001, rng.range(0.5, 2)], [0.02, 0]]);
      setTimeout(crackle, rng.range(60, 260));
    };
    crackle();
    return {
      setPos: () => {},
      set: () => {},
      stop: () => {
        alive = false;
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        n.stop(ctx.currentTime + 1);
      },
    };
  }

  startAmbience(kind: 'forest' | 'village' | 'farm' | 'none') {
    this.ambience?.stop();
    this.ambience = null;
    const ctx = this.ctx;
    if (!ctx || kind === 'none') return;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 400;
    f.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 250;
    lfo.connect(lg);
    lg.connect(f.frequency);
    const g = ctx.createGain();
    g.gain.value = kind === 'forest' ? 0.16 : 0.1;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lg2 = ctx.createGain();
    lg2.gain.value = 0.05;
    lfo2.connect(lg2);
    lg2.connect(g.gain);
    n.connect(f);
    f.connect(g);
    g.connect(this.ambBus);
    n.start();
    lfo.start();
    lfo2.start();
    let alive = true;
    const birds = () => {
      if (!alive || !this.ctx) return;
      if (rng.chance(0.5)) {
        const p = this.listenerPos.clone().add(new THREE.Vector3(rng.range(-30, 30), 8, rng.range(-30, 30)));
        this.play('crow', p, 0.6);
      }
      setTimeout(birds, rng.range(6000, 16000));
    };
    setTimeout(birds, 3000);
    this.ambience = {
      stop: () => {
        alive = false;
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        n.stop(ctx.currentTime + 2);
        lfo.stop(ctx.currentTime + 2);
        lfo2.stop(ctx.currentTime + 2);
      },
    };
  }

  /** Church bell toll. */
  bell(pos: THREE.Vector3, count = 5, gap = 2.6) {
    const ctx = this.ctx;
    if (!ctx) return;
    const partials: [number, number, number][] = [
      [0.5, 0.9, 7],
      [1, 1, 5],
      [1.19, 0.7, 4],
      [1.5, 0.5, 3.5],
      [2, 0.6, 3],
      [2.51, 0.35, 2.4],
      [2.66, 0.3, 2.2],
      [3.01, 0.25, 2],
      [4.16, 0.15, 1.4],
    ];
    const f0 = 180;
    for (let k = 0; k < count; k++) {
      const t = ctx.currentTime + 0.05 + k * gap;
      const out = this.out(pos, 0.9, this.sfxBus, 1.2, 25);
      for (const [r, a, d] of partials) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f0 * r * (1 + rng.range(-0.002, 0.002));
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(a * 0.3, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0005, t + d);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + d + 0.1);
      }
      this.noise(t, 0.08, out, [{ type: 'bandpass', f: 1800, q: 1 }], [[0.001, 0.4], [0.08, 0]]);
    }
  }

  heartbeat() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = this.out(undefined, 0.5, this.sfxBus, 0);
    this.tone(t, 'sine', 60, 40, 0.12, o, [[0.01, 1], [0.12, 0]]);
    this.tone(t + 0.22, 'sine', 55, 38, 0.12, o, [[0.01, 0.7], [0.12, 0]]);
  }

  // expose helpers for Music
  _tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, dest: AudioNode, env: [number, number][], filt?: { type: BiquadFilterType; f: number; q?: number }) {
    this.tone(t, type, f0, f1, dur, dest, env, filt);
  }
  _noise(t: number, dur: number, dest: AudioNode, filt: { type: BiquadFilterType; f: number; q?: number; f2?: number }[], env: [number, number][]) {
    this.noise(t, dur, dest, filt, env);
  }
}

function findPanner(g: GainNode): PannerNode | null {
  // our out() connects gain -> panner; we can't query graph, so store on creation
  return (g as unknown as { __panner?: PannerNode }).__panner ?? null;
}

const nullLoop: LoopHandle = { setPos() {}, set() {}, stop() {} };

/**
 * Adaptive music: an ambient drone always, a tension pulse when enemies are alerted,
 * and percussion/strings stabs in full combat. Also merchant & save-room themes.
 */
export class Music {
  a: AudioSys;
  intensity = 0; // 0 calm, 0.5 tension, 1 combat
  target = 0;
  private nextBeat = 0;
  private beat = 0;
  private drone: { stop: () => void; g: GainNode } | null = null;
  mode: 'game' | 'merchant' | 'safe' | 'none' | 'title' = 'none';
  private bpm = 88;

  constructor(a: AudioSys) {
    this.a = a;
  }

  setMode(m: Music['mode']) {
    if (this.mode === m) return;
    this.mode = m;
    this.beat = 0;
    this.nextBeat = this.a.ctx ? this.a.ctx.currentTime + 0.1 : 0;
    if (m === 'game' || m === 'title') this.startDrone(m === 'title' ? 0.22 : 0.14);
    else this.stopDrone();
  }

  private startDrone(vol: number) {
    const ctx = this.a.ctx;
    if (!ctx || this.drone) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(vol, ctx.currentTime, 2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const oscs: OscillatorNode[] = [];
    for (const [f, type] of [
      [55, 'sawtooth'],
      [55.4, 'sawtooth'],
      [82.4, 'triangle'],
      [110.7, 'sine'],
      [77.8, 'sine'],
    ] as [number, OscillatorType][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = type === 'sawtooth' ? 0.25 : 0.35;
      o.connect(og);
      og.connect(lp);
      o.start();
      oscs.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lg = ctx.createGain();
    lg.gain.value = 160;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    lfo.start();
    oscs.push(lfo);
    lp.connect(g);
    g.connect(this.a.musicBus);
    const rs = ctx.createGain();
    rs.gain.value = 0.4;
    g.connect(rs);
    rs.connect(this.a.reverbSend);
    this.drone = {
      g,
      stop: () => {
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(0, t, 0.6);
        for (const o of oscs) o.stop(t + 3);
      },
    };
  }

  private stopDrone() {
    this.drone?.stop();
    this.drone = null;
  }

  update(dt: number) {
    const ctx = this.a.ctx;
    if (!ctx) return;
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * (this.target > this.intensity ? 1.5 : 0.25));
    if (this.mode === 'none') return;
    const spb = 60 / (this.mode === 'merchant' ? 96 : this.mode === 'safe' ? 70 : this.bpm);
    while (this.nextBeat < ctx.currentTime + 0.25) {
      this.scheduleBeat(this.nextBeat, spb);
      this.nextBeat += spb / 2; // eighth notes
      this.beat++;
    }
  }

  private scheduleBeat(t: number, spb: number) {
    const a = this.a;
    const bus = a.musicBus;
    const b = this.beat;
    if (this.mode === 'merchant') {
      // gentle minor waltz-ish arpeggio (original motif)
      const prog = [
        [220, 261.6, 329.6],
        [196, 246.9, 293.7],
        [174.6, 220, 261.6],
        [164.8, 207.7, 246.9],
      ];
      const chord = prog[Math.floor(b / 8) % 4];
      const note = chord[b % 3] * (b % 6 < 3 ? 1 : 2);
      a._tone(t, 'triangle', note, note, spb * 0.45, bus, [[0.01, 0.12], [spb * 0.45, 0]]);
      if (b % 8 === 0) a._tone(t, 'sine', chord[0] / 2, chord[0] / 2, spb * 3.5, bus, [[0.05, 0.2], [spb * 3.5, 0]]);
      return;
    }
    if (this.mode === 'safe') {
      if (b % 8 === 0) {
        const roots = [146.8, 130.8, 110, 123.5];
        const r = roots[Math.floor(b / 8) % 4];
        for (const m of [1, 1.2, 1.5, 2]) a._tone(t, 'sine', r * m, r * m, spb * 4, bus, [[0.4, 0.05], [spb * 4, 0]]);
      }
      if (b % 4 === 2) {
        const n = [587, 523, 440, 494, 392][Math.floor(b / 4) % 5];
        a._tone(t, 'triangle', n, n, spb * 1.5, bus, [[0.02, 0.05], [spb * 1.5, 0]]);
      }
      return;
    }
    if (this.mode === 'title') {
      if (b % 16 === 0) a._tone(t, 'sine', 41.2, 41.2, spb * 8, bus, [[1, 0.25], [spb * 8, 0]]);
      if (b % 32 === 12) a._tone(t, 'triangle', 311, 293, spb * 4, bus, [[0.1, 0.05], [spb * 4, 0]]);
      return;
    }
    const I = this.intensity;
    // tension: low pulse on quarter notes
    if (I > 0.2 && b % 2 === 0) {
      const v = Math.min(1, (I - 0.2) * 2) * 0.22;
      a._tone(t, 'sawtooth', 55, 55, spb * 0.4, bus, [[0.01, v], [spb * 0.4, 0]], { type: 'lowpass', f: 300 });
    }
    if (I > 0.3 && b % 16 === 8) {
      const v = Math.min(1, I) * 0.12;
      for (const f of [233.1, 246.9]) a._tone(t, 'sawtooth', f, f * 0.99, spb * 3, bus, [[0.3, v], [spb * 3, 0]], { type: 'lowpass', f: 1400 });
    }
    // combat percussion
    if (I > 0.6) {
      const v = Math.min(1, (I - 0.6) * 2.5);
      const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
      if (pat[b % 16]) {
        a._tone(t, 'sine', 90, 40, 0.3, bus, [[0.005, 0.55 * v], [0.3, 0]]);
        a._noise(t, 0.15, bus, [{ type: 'lowpass', f: 800 }], [[0.003, 0.25 * v], [0.15, 0]]);
      }
      if (b % 4 === 2) a._noise(t, 0.05, bus, [{ type: 'highpass', f: 5000 }], [[0.002, 0.08 * v], [0.05, 0]]);
      if (b % 32 === 0) {
        for (const f of [110, 116.5, 164.8]) a._tone(t, 'sawtooth', f, f, spb * 2, bus, [[0.02, 0.1 * v], [spb * 2, 0]], { type: 'lowpass', f: 1800 });
      }
      if (b % 32 === 16) {
        for (const f of [103.8, 110, 155.6]) a._tone(t, 'sawtooth', f, f, spb * 2, bus, [[0.02, 0.1 * v], [spb * 2, 0]], { type: 'lowpass', f: 1800 });
      }
    }
  }
}
