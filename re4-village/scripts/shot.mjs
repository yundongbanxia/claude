// Usage: node scripts/shot.mjs <url-or-file> <out.png> [waitMs]
import { chromium } from 'playwright';
const [, , target, out, wait = '800'] = process.argv;
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(target);
await page.waitForTimeout(parseInt(wait));
await page.screenshot({ path: out });
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close();
