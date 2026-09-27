export default async function (page, base, out) {
  await page.goto(base + `?area=test&enemies=0&seed=4`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  await page.evaluate(() => { window.__keys = []; window.addEventListener('keydown', (e) => window.__keys.push(e.code), true); });
  await page.keyboard.press('KeyC'); await page.waitForTimeout(800);
  console.log(JSON.stringify(await page.evaluate(() => ({ keys: window.__keys, crouch: window.__game.g.player.crouch, pstate: window.__game.g.player.state, action: window.__game.g.player.action && window.__game.g.player.action.name, cut: !!window.__game.g.cutscene }))));
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  console.log(JSON.stringify(await page.evaluate(() => ({ keys: window.__keys, state: window.__game.g.state }))));
}
