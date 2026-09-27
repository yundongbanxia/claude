export default async function (page, base, out) {
  await page.goto(base + `?area=village&seed=6`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  await page.evaluate(() => {
    const G = window.__game; const g = G.g;
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.enemies.forEach(e => e.removed = true); G.step(0.1);
    g.flags.siege_started = true; g.flags.siege_done = true;
    g.player.place(0, 20, Math.PI);
    window.__s = g.spawnEnemy({ kind: 'salvador', x: 0, z: 12, aware: true, yaw: 0 });
    window.__s.attackCd = 3;
    G.step(1.2);
  });
  await page.screenshot({ path: out + '/sal1.png' });
  const r = await page.evaluate(() => {
    const G = window.__game; const g = G.g; const s = window.__s; const log = [];
    // force the grab attack
    for (let i = 0; i < 400; i++) {
      G.step(1/30);
      if (s.state === 'attack' && s.attackKind !== 'sawgrab') { s.attackKind = 'sawgrab'; s.anim.play(window.__game.g.enemies[0].anim.cur.clip, {}); }
      if (s.state === 'decap') { log.push('decap at ' + i); break; }
    }
    G.step(1.3);
    return log.concat([g.player.state, g.state]);
  });
  console.log(r.join(' | '));
  await page.screenshot({ path: out + '/sal2.png' });
  await page.evaluate(() => window.__game.step(3));
  await page.screenshot({ path: out + '/sal3.png' });
}
