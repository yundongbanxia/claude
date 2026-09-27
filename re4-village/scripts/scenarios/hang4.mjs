export default async function (page, base, out) {
  await page.goto(base + '?area=test&enemies=0&seed=5');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 30000 });
  await page.evaluate(`(() => { const G = window.__game; const g = G.g; const p = g.player;
    window.__s = g.spawnEnemy({ kind: 'salvador', x: p.pos.x, z: p.pos.z - 12, aware: true }); G.step(0.1); })()`);
  for (let k = 0; k < 8; k++) {
    const st = await page.evaluate(`(() => { window.__game.step(0.8); const g = window.__game.g; return [g.player.state, window.__s.state, g.time.toFixed(1)]; })()`);
    const t = Date.now();
    await page.screenshot({ path: out + `/h${k}.png`, timeout: 60000 });
    console.log(k, JSON.stringify(st), 'shot ms', Date.now() - t);
  }
}
