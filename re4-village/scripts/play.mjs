// Drive the game through the __game harness and take screenshots.
// Usage: node scripts/play.mjs <scenario> [outdir]
import { chromium } from 'playwright';
const [, , scenario = 'basic', outDir = '/tmp/claude-0/-home-user-claude/45642ddb-1f80-5bb8-8ecb-135918cc6613/scratchpad'] = process.argv;
const base = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + e.stack));
const scen = (await import(`./scenarios/${scenario}.mjs`)).default;
await scen(page, base, outDir);
if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 15).join('\n'));
await browser.close();
