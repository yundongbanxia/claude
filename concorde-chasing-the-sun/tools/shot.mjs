// 开发辅助：用无头 Chromium 打开页面，调用 window[fn](...args)，保存 PNG 截图。
// 用法： node tools/shot.mjs <page.html> <out.png> [fn] [arg1] [arg2]...
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const [, , page, out, fn, ...args] = process.argv;
const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const p = await ctx.newPage();
p.on('console', (m) => console.log('[page]', m.text()));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(pathToFileURL(path.resolve(page)).href);
if (fn) {
  const parsed = args.map((a) => (isNaN(+a) ? a : +a));
  const t0 = Date.now();
  await p.evaluate(([f, a]) => window[f](...a), [fn, parsed]);
  console.log('render ms', Date.now() - t0);
}
await p.locator('canvas').first().screenshot({ path: out });
await browser.close();
