export default async function (page, base, out) {
  await page.goto(base + '?area=test&enemies=0&seed=5');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 30000 });
  const r = await page.evaluate(`(() => { const G = window.__game; const g = G.g; const p = g.player;
    const gl = g.renderer.gl.getContext();
    const time = (label) => { const t = performance.now(); G.render(); gl.finish(); return [label, Math.round(performance.now()-t)]; };
    const out = [time('base')];
    const s = g.spawnEnemy({ kind: 'salvador', x: p.pos.x, z: p.pos.z - 12, aware: true });
    out.push(time('spawned'));
    for (let i = 0; i < 60; i++) { G.step(0.1); if (i % 5 === 0) out.push(time(i + ':' + p.state + ':' + s.state)); }
    g.fx.clear(); out.push(time('fxclear'));
    return out;
  })()`);
  console.log(JSON.stringify(r));
}
