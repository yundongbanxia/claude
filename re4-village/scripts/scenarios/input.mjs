export default async function (page, base, out) {
  await page.goto(base + `?area=test&enemies=0&seed=4`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const st = () => page.evaluate(() => { const g = window.__game.g; return { pos: g.player.pos.toArray().map(v => +v.toFixed(2)), yaw: +g.camera.yaw.toFixed(2), aim: g.player.aiming, mag: g.player.weapon.weapon.mag, state: g.state, crouch: g.player.crouch }; });
  console.log('start', JSON.stringify(await st()));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1000); await page.keyboard.up('KeyW');
  console.log('after W', JSON.stringify(await st()));
  await page.mouse.move(640, 360); await page.mouse.move(740, 360, { steps: 5 });
  console.log('after mouse', JSON.stringify(await st()));
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(600);
  await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' }); await page.waitForTimeout(400);
  console.log('aim+fire', JSON.stringify(await st()));
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('KeyR'); await page.waitForTimeout(2000);
  console.log('reload', JSON.stringify(await st()));
  await page.keyboard.press('KeyC'); await page.waitForTimeout(200);
  console.log('crouch', JSON.stringify(await st()));
  await page.keyboard.press('Tab'); await page.waitForTimeout(300);
  console.log('tab', JSON.stringify(await st()));
  await page.keyboard.press('Tab'); await page.waitForTimeout(300);
  console.log('tab again', JSON.stringify(await st()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  console.log('esc', JSON.stringify(await st()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  console.log('esc again', JSON.stringify(await st()));
}
