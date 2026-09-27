export default async function (page, base, out) {
  await page.goto(base + `?area=village&seed=5&debug=god`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const G = window.__game; const g = G.g; const out = [];
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.enemies.forEach(e => e.removed = true); G.step(0.1);
    g.flags.siege_started = true; g.flags.siege_done = true;
    for (const s of g.level.shelves) g.pushShelf(s);
    G.step(1.5);
    const loft = g.level.cw.floors.find(f => f.slab === 0.2 && f.y > 2 && f.y < 4);
    const lad = g.level.ladders.find(l => l.pushable);
    // stand at the ladder exit on the loft
    g.player.pos.set(lad.ex, lad.ey, lad.ez); g.player.state = 'move'; g.player.action = null;
    const e = g.spawnEnemy({ kind: 'villager', x: -34, z: -14, aware: true });
    window.__lad = lad; window.__e = e;
    for (let i = 0; i < 400; i++) { G.step(1/30); if (e.traverse && e.traverse.ladder && e.traverse.t > 0.8) break; }
    const used = e.traverse && e.traverse.ladder;
    if (used) { window.__lad = used; g.player.pos.set(used.ex, used.ey, used.ez); G.step(1/30); }
    out.push('climbing: ' + e.state + ' pushable ' + (used && used.pushable) + ' users ' + (used && used.users) + ' y ' + e.pos.y.toFixed(2));
    return out;
  });
  console.log(r.join('\n'));
  // look at the ladder from the loft window
  await page.evaluate(() => { const G = window.__game; const l = window.__lad; const p = G.g.player; G.aimAt(l.bx, l.by + 1, l.bz); G.release('aim'); G.step(0.05); });
  await page.screenshot({ path: out + '/ladder1.png' });
  const r2 = await page.evaluate(() => {
    const G = window.__game; const g = G.g; const l = window.__lad; const e = window.__e;
    const prompt = document.querySelector('#prompt').textContent;
    G.tap('interact'); G.step(1.2);
    return { prompt, down: l.down, e: e.state, hp: Math.round(e.hp) };
  });
  console.log(JSON.stringify(r2));
  await page.screenshot({ path: out + '/ladder2.png' });
}
