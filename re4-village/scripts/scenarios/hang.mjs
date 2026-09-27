export default async function (page, base, out) {
  await page.goto(base + '?area=test&enemies=0&seed=5');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 30000 });
  const t0 = Date.now();
  await page.evaluate(`(() => { const G = window.__game; const g = G.g; const p = g.player;
    const s = g.spawnEnemy({ kind: 'salvador', x: p.pos.x, z: p.pos.z - 12, aware: true });
    for (let i = 0; i < 60; i++) { G.step(0.1); }
  })()`);
  console.log('evaluate done', Date.now() - t0);
  for (let i = 0; i < 5; i++) {
    const t1 = Date.now();
    const r = await Promise.race([page.evaluate('performance.now()'), new Promise(r => setTimeout(() => r('timeout'), 5000))]);
    console.log('ping', r, Date.now() - t1);
  }
  const t2 = Date.now(); await page.screenshot({ path: out + '/h.png' }); console.log('shot', Date.now() - t2);
  const st = await page.evaluate(`JSON.stringify(window.__game.state().pstate)`);
  console.log(st);
}
