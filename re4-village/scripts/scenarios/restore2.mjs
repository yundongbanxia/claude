export default async function (page, base, out) {
  await page.goto(base + `?area=village&seed=4`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const G = window.__game; const g = G.g; const out = [];
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.player.place(-2, 16, 0); G.step(3);
    for (let d = 0; d < 2; d++) {
      g.player.hurt(5000, g.player.pos.clone().add(new G.THREE.Vector3(1,0,0)), 'heavy'); G.step(1);
      g.continueFromCheckpoint(); G.step(0.1);
      out.push('restored: pos=' + g.player.pos.toArray().map(v=>v.toFixed(1)) + ' cp=' + JSON.stringify(g.checkpointData.pos) + ' entry=' + g.checkpointData.entry);
    }
    for (let k = 0; k < 5; k++) { G.step(3); out.push(g.enemies.map(e => e.state + ':' + e.pos.distanceTo(g.player.pos).toFixed(0) + (e.token?'T':'')).join(',') + ' | pl=' + g.player.state + ' hp=' + Math.round(g.player.hp) + ' inv=' + g.player.invuln.toFixed(1)); }
    return out;
  });
  console.log(r.join('\n'));
}
