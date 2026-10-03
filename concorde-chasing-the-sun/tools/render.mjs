// 离线渲染：把动画逐帧截下来，把 WebAudio 音轨用 OfflineAudioContext 渲染出来，再用 ffmpeg 合成 MP4。
//
// 用法：
//   node tools/render.mjs [--out video/concorde-chasing-the-sun.mp4] [--fps 30] [--width 1920]
//                         [--workers 4] [--crf 23] [--preset slow] [--tmp /path/to/tmp]
//                         [--audio-only] [--video-only] [--mux-only]
//                         [--start 0] [--end 204]
//
// 依赖：Node 18+、Playwright（含 Chromium）、ffmpeg。
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require = createRequire(process.env.PLAYWRIGHT_NODE_PATH ? process.env.PLAYWRIGHT_NODE_PATH + '/' : '/opt/node22/lib/node_modules/');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i < 0 ? def : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.resolve(root, opt('out', 'video/concorde-chasing-the-sun.mp4'));
const FPS = +opt('fps', 30);
const WIDTH = +opt('width', 1920);
const WORKERS = +opt('workers', Math.max(1, Math.min(4, os.cpus().length)));
const CRF = +opt('crf', 23);
const PRESET = opt('preset', 'slow');
const MUX_ONLY = !!opt('mux-only', false);
const TMP = path.resolve(opt('tmp', path.join(os.tmpdir(), 'concorde-render')));
const AUDIO_ONLY = !!opt('audio-only', false), VIDEO_ONLY = !!opt('video-only', false);
const DURATION = 204;
const START = +opt('start', 0), END = +opt('end', DURATION);
fs.mkdirSync(path.join(TMP, 'frames'), { recursive: true });

const url = pathToFileURL(path.join(root, 'index.html')).href + `?render=1&w=${WIDTH}`;
const launch = () => chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu-vsync'] });
async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: Math.round(WIDTH * 9 / 16) }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (['warning', 'error'].includes(m.type())) console.error('[page]', m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__film && window.__film.ready, null, { timeout: 120000 });
  return page;
}

async function renderAudio() {
  console.log('▶ 渲染音轨（OfflineAudioContext）…');
  const browser = await launch();
  const page = await openPage(browser);
  const t0 = Date.now();
  const info = await page.evaluate((sec) => window.__film.audio(44100, sec), +opt('audio-seconds', DURATION));
  console.log(`  音轨渲染完成：${(info.n / info.sr).toFixed(1)} s，用时 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const pcm = path.join(TMP, 'audio.pcm');
  const fd = fs.openSync(pcm, 'w');
  const CH = 44100 * 2;
  for (let i = 0; i < info.n; i += CH) {
    const b64 = await page.evaluate(([a, n]) => window.__film.pcmChunk(a, n), [i, CH]);
    fs.writeSync(fd, Buffer.from(b64, 'base64'));
  }
  fs.closeSync(fd);
  await browser.close();
  // 同时导出 wav 方便试听/分析
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(info.sr), '-ac', '2', '-i', pcm, path.join(TMP, 'audio.wav')]);
  return pcm;
}

async function renderFrames() {
  const total = Math.round((END - START) * FPS);
  console.log(`▶ 渲染画面：${total} 帧 @ ${FPS}fps，${WORKERS} 个并行工作进程`);
  let next = 0, done = 0;
  const t0 = Date.now();
  const worker = async (id) => {
    const browser = await launch();
    const page = await openPage(browser);
    for (;;) {
      const i = next++;
      if (i >= total) break;
      const T = START + i / FPS;
      const b64 = await page.evaluate((t) => window.__film.jpeg(t, 0.95), T);
      fs.writeFileSync(path.join(TMP, 'frames', String(i).padStart(6, '0') + '.jpg'), Buffer.from(b64, 'base64'));
      done++;
      if (done % 60 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`  ${done}/${total}  (${((done / total) * 100).toFixed(1)}%)  已用 ${el.toFixed(0)}s，预计剩余 ${(((total - done) / (done / el))).toFixed(0)}s`);
      }
    }
    await browser.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k)));
  console.log(`  画面渲染完成，用时 ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

function mux(pcm) {
  console.log('▶ 合成 MP4 …');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const args = ['-y', '-loglevel', 'error', '-stats', '-framerate', String(FPS), '-i', path.join(TMP, 'frames', '%06d.jpg')];
  if (START > 0) args.push('-f', 's16le', '-ar', '44100', '-ac', '2', '-ss', String(START), '-i', pcm);
  else args.push('-f', 's16le', '-ar', '44100', '-ac', '2', '-i', pcm);
  // 胶片颗粒是逐帧随机的、几乎不可压缩，编码前轻度时域降噪，体积能小一个数量级（观看时画面基本无差别）
  args.push('-t', String(END - START), '-vf', 'hqdn3d=3:2:7:7', '-c:v', 'libx264', '-preset', PRESET, '-crf', String(CRF), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT);
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg 失败');
  console.log('✔ 已生成', OUT, (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB');
}

(async () => {
  let pcm = path.join(TMP, 'audio.pcm');
  if (MUX_ONLY) { mux(pcm); return; }
  if (!VIDEO_ONLY) pcm = await renderAudio();
  if (AUDIO_ONLY) { console.log('✔ 音轨已输出到', path.join(TMP, 'audio.wav')); return; }
  await renderFrames();
  mux(pcm);
})().catch((e) => { console.error(e); process.exit(1); });
