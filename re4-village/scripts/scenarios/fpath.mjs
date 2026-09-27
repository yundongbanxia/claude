export default async function (page, base, out) {
  await page.goto(base + `?area=forest&seed=5&debug=god`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const G = window.__game; const g = G.g;
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.enemies.forEach(e => e.removed = true); G.step(0.1);
    g.flags.lodge_intro = true; g.flags.lodge_intro_done = true;
    g.player.place(8, -92, 0);
    const pts = [[2, -124], [16, -129], [-8, -128], [13, -80], [-19, -48], [5, -150]];
    const es = pts.map(([x, z]) => g.spawnEnemy({ kind: 'villager', x, z, aware: true }));
    es.forEach(e => e.attackCd = 999);
    G.step(30, 1/30);
    return es.map((e, i) => pts[i].join(',') + ' -> ' + e.pos.distanceTo(g.player.pos).toFixed(1) + ' y=' + e.pos.y.toFixed(1) + ' ' + e.state);
  });
  console.log(r.join('\n'));
}
