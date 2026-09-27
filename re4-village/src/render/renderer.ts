import * as THREE from 'three';

export type Quality = 'low' | 'medium' | 'high';

export interface PostParams {
  damage: number; // 0..1 red edge flash
  lowHealth: number; // 0..1 desaturate + pulse
  flash: number; // 0..1 white flash (flash grenade)
  fade: number; // 0..1 fade to black
  letterbox: number; // 0..1 cinematic bars
  grain: number;
  saturation: number;
  exposure: number;
  tint: THREE.Color;
  blur: number; // 0..1 (menus)
}

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uTime, uDamage, uLow, uFlash, uFade, uLetter, uGrain, uSat, uExposure, uBlur;
uniform vec3 uTint;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  // subtle chromatic aberration grows with damage
  float ca = 0.0012 + uDamage * 0.006 + uLow * 0.002;
  vec3 col;
  if (uBlur > 0.0) {
    vec2 px = uBlur * 3.0 / uRes;
    col = vec3(0.0);
    for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) col += texture2D(tScene, uv + vec2(float(i), float(j)) * px).rgb;
    col /= 25.0;
  } else {
    col.r = texture2D(tScene, uv + c * ca).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - c * ca).b;
  }
  col *= uExposure;
  col = aces(col);
  // grade: warm, slightly desaturated, lifted blacks
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  float sat = uSat * (1.0 - uLow * 0.75);
  col = mix(vec3(l), col, sat);
  col *= uTint;
  col = col * 0.96 + 0.012;
  col = toSRGB(clamp(col, 0.0, 1.0));
  // vignette
  float vig = smoothstep(0.85, 0.25, r2 * 1.9);
  col *= mix(0.55, 1.0, vig);
  // damage/low health red edges
  float edge = smoothstep(0.08, 0.5, r2);
  float pulse = 0.55 + 0.45 * sin(uTime * 6.0);
  col = mix(col, vec3(0.45, 0.0, 0.0), edge * (uDamage * 0.85 + uLow * 0.45 * pulse));
  // grain
  float g = hash(uv * uRes + fract(uTime * 17.0) * 100.0) - 0.5;
  col += g * uGrain;
  // flash + fade
  col = mix(col, vec3(1.0), uFlash);
  col *= 1.0 - uFade;
  // letterbox
  float bar = uLetter * 0.12;
  if (uv.y < bar || uv.y > 1.0 - bar) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  private rt: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private postMat: THREE.ShaderMaterial;
  post: PostParams;
  quality: Quality = 'medium';
  renderScale = 1;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.info.autoReset = false;
    const halfFloat = this.gl.capabilities.isWebGL2;
    this.rt = new THREE.WebGLRenderTarget(4, 4, {
      type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      samples: 0,
    });
    this.post = {
      damage: 0,
      lowHealth: 0,
      flash: 0,
      fade: 0,
      letterbox: 0,
      grain: 0.045,
      saturation: 0.78,
      exposure: 1.0,
      tint: new THREE.Color(1.04, 0.99, 0.9),
      blur: 0,
    };
    this.postMat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        tScene: { value: this.rt.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uDamage: { value: 0 },
        uLow: { value: 0 },
        uFlash: { value: 0 },
        uFade: { value: 0 },
        uLetter: { value: 0 },
        uGrain: { value: 0.04 },
        uSat: { value: 0.8 },
        uExposure: { value: 1 },
        uBlur: { value: 0 },
        uTint: { value: new THREE.Color(1, 1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.setQuality('medium');
  }

  setQuality(q: Quality) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : 1);
    this.gl.setPixelRatio(dpr);
    this.rt.samples = q === 'high' ? 4 : q === 'medium' ? 2 : 0;
    this.renderScale = q === 'low' ? 0.75 : 1;
    this.resize(this.width, this.height);
  }

  get shadowMapSize() {
    return this.quality === 'high' ? 2048 : this.quality === 'medium' ? 1536 : 1024;
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.gl.setSize(this.width, this.height, false);
    const pr = this.gl.getPixelRatio();
    const rw = Math.max(1, Math.floor(this.width * pr * this.renderScale));
    const rh = Math.max(1, Math.floor(this.height * pr * this.renderScale));
    this.rt.setSize(rw, rh);
    (this.postMat.uniforms.uRes.value as THREE.Vector2).set(rw, rh);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, time: number) {
    const u = this.postMat.uniforms;
    const p = this.post;
    u.uTime.value = time;
    u.uDamage.value = p.damage;
    u.uLow.value = p.lowHealth;
    u.uFlash.value = p.flash;
    u.uFade.value = p.fade;
    u.uLetter.value = p.letterbox;
    u.uGrain.value = p.grain;
    u.uSat.value = p.saturation;
    u.uExposure.value = p.exposure;
    u.uBlur.value = p.blur;
    (u.uTint.value as THREE.Color).copy(p.tint);
    this.gl.info.reset();
    this.gl.setRenderTarget(this.rt);
    this.gl.render(scene, camera);
    this.stats.calls = this.gl.info.render.calls;
    this.stats.triangles = this.gl.info.render.triangles;
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCam);
  }

  /** Draw stats of the last scene pass (includes shadow passes). */
  stats = { calls: 0, triangles: 0 };
}
