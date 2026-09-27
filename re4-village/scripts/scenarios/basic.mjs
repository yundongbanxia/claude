export default async function (page, base, out) {
  await page.goto(base + '?area=test&enemies=3&seed=1');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 30000 });
  await page.evaluate(() => window.__game.step(1.0));
  await page.screenshot({ path: out + '/p1.png' });
  const s = await page.evaluate(() => window.__game.state());
  console.log(JSON.stringify({ ...s, flags: undefined }));
  // aim and shoot the first enemy in the head
  await page.evaluate(() => {
    const G = window.__game; const e = G.g.enemies[0];
    const h = e.headPos; G.aimAt(h.x, h.y, h.z); G.press('aim'); G.step(0.8);
  });
  await page.screenshot({ path: out + '/p2.png' });
  await page.evaluate(() => { const G = window.__game; const e = G.g.enemies[0]; const h = e.headPos; G.aimAt(h.x, h.y, h.z); G.tap('fire'); G.step(0.25); });
  await page.screenshot({ path: out + '/p3.png' });
  const s2 = await page.evaluate(() => window.__game.state());
  console.log(JSON.stringify(s2.enemies));
}
