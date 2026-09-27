export default async function (page, base, out) {
  await page.goto(base + `?area=village&seed=5&debug=god`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const G = window.__game; const g = G.g; const out = [];
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.enemies.forEach(e => e.removed = true); G.step(0.1);
    g.flags.siege_started = true; g.flags.siege_done = true; // no spawner
    // push both door shelves
    for (const s of g.level.shelves) if (s.target.kind === 'door') g.pushShelf(s);
    G.step(1.5);
    // put player on the loft
    const loft = g.level.cw.floors.find(f => f.slab === 0.2 && f.y > 2 && f.y < 4);
    g.player.pos.set(loft.x, loft.y, loft.z); g.player.state = 'move'; g.player.action = null;
    G.step(0.2);
    out.push('player floor ' + g.level.cw.floorIdAt(g.player.pos.x, g.player.pos.z, g.player.pos.y) + ' layer ' + g.level.nav.layerForFloor(loft.id) + ' layers ' + g.level.nav.layers.length + ' links ' + g.level.nav.links.map(l => l.type + (l.enabled ? '' : '(off)')).join(','));
    const es = [[-40, -8], [-30, 10], [-8, -8], [-30, -24]].map(([x, z]) => g.spawnEnemy({ kind: 'villager', x, z, aware: true }));
    for (let k = 0; k < 12; k++) {
      G.step(2.5);
      out.push(es.map(e => e.state + (e.traverse ? '(' + e.traverse.kind + ')' : '') + ':' + e.pos.distanceTo(g.player.pos).toFixed(1) + '@' + e.pos.y.toFixed(1)).join('  ') + ' | shelves ' + g.level.shelves.map(s => s.hp).join('/') + ' ladders ' + g.level.ladders.map(l => l.users + (l.down ? 'D' : '')).join('/'));
    }
    return out;
  });
  console.log(r.join('\n'));
  await page.screenshot({ path: out + '/house.png' });
}
