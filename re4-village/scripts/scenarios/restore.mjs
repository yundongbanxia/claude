export default async function (page, base, out) {
  await page.goto(base + `?area=village&seed=4`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const G = window.__game; const g = G.g;
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.player.place(-2, 16, 0); G.step(3);
    const before = g.enemies.map(e => e.state + (e.aware ? '*' : '')).join(',');
    g.player.hurt(5000, g.player.pos.clone().add(new G.THREE.Vector3(1,0,0)), 'heavy');
    G.step(1);
    const st = g.state;
    g.continueFromCheckpoint();
    G.step(0.1);
    const out = [before, st, g.state, g.area.id, JSON.stringify(g.flags)];
    for (let k = 0; k < 6; k++) { G.step(2); out.push(g.enemies.map(e => e.state + (e.aware ? '*' : '') + ':' + e.pos.distanceTo(g.player.pos).toFixed(0)).join(',') + ' | pl=' + g.player.state + ' hp=' + Math.round(g.player.hp) + ' field=' + !!g.director.field); }
    return out;
  });
  console.log(r.join('\n'));
}
