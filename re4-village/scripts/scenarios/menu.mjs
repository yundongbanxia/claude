export default async function (page, base, out) {
  await page.goto(base);
  await page.waitForSelector('h1.title');
  await page.click('text=新游戏');
  await page.click('text=标准');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/menu_intro.png' });
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => window.__game.g.state === 'play', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '/menu_start.png' });
  console.log(JSON.stringify(await page.evaluate(() => ({ area: window.__game.g.area.id, cut: !!window.__game.g.cutscene, diff: window.__game.g.diff.id, test: window.__game.g.test }))));
}
