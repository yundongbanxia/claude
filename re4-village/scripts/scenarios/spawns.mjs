// verify every siege spawn point can reach the square
export default async function (page, base, out) {
  await page.goto(base + `?area=village&seed=5&debug=god`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const G = window.__game; const g = G.g;
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.enemies.forEach(e => e.removed = true); G.step(0.1);
    g.flags.siege_started = true; g.flags.siege_done = true;
    g.player.place(0, 8, 0);
    const pts = [[-43, 4], [-40, -26], [-22, -44], [18, -44], [40, -8], [41, 20], [22, 44], [-30, 41], [0, 50], [-42, 24], [2, -32]];
    const es = pts.map(([x, z]) => g.spawnEnemy({ kind: 'villager', x, z, aware: true }));
    es.forEach(e => e.attackCd = 999);
    G.step(25, 1/30);
    return es.map((e, i) => pts[i].join(',') + ' -> ' + e.pos.distanceTo(g.player.pos).toFixed(1) + ' ' + e.state);
  });
  console.log(r.join('\n'));
}
