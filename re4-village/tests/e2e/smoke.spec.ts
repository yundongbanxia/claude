import { test, expect } from '@playwright/test';
import path from 'node:path';

const file = 'file://' + path.resolve('dist/index.html');

test('title screen loads from file:// without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(file);
  await expect(page.locator('h1.title')).toBeVisible();
  expect(errors).toEqual([]);
});

test('sandbox: headshot damages an enemy', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(file + '?area=test&enemies=1&seed=7');
  await page.waitForFunction(() => (window as any).__game?.g.state === 'play');
  const hp = await page.evaluate(() => {
    const G = (window as any).__game;
    G.step(0.5);
    const e = G.g.enemies[0];
    const h = e.headPos;
    G.aimAt(h.x, h.y, h.z);
    G.press('aim');
    G.step(0.9);
    const h2 = e.headPos;
    G.aimAt(h2.x, h2.y, h2.z);
    G.tap('fire');
    G.step(0.1);
    return e.hp / e.maxHp;
  });
  expect(hp).toBeLessThan(1);
  expect(errors).toEqual([]);
});

for (const area of ['forest', 'village', 'farm']) {
  test(`area "${area}" loads and simulates without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(file + `?area=${area}&seed=3`);
    await page.waitForFunction(() => (window as any).__game?.g.state === 'play', null, { timeout: 60_000 });
    const st = await page.evaluate(() => {
      const G = (window as any).__game;
      G.step(5, 1 / 30);
      return G.state();
    });
    expect(st.area).toBe(area);
    expect(st.enemies.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}
