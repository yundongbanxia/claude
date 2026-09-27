export default async function (page, base, out) {
  await page.goto(base + '?area=test&enemies=0&seed=5');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 30000 });
  const r = await page.evaluate(`(() => { const G = window.__game; const g = G.g; const p = g.player;
    const out = [];
    const t0 = performance.now(); G.render(); out.push(['base', Math.round(performance.now()-t0), g.renderer.stats.calls]);
    const s = g.spawnEnemy({ kind: 'salvador', x: p.pos.x, z: p.pos.z - 12, aware: true });
    for (let i = 0; i < 60; i++) { G.step(0.1); if (i % 10 === 0) { const t = performance.now(); G.render(); out.push([i, Math.round(performance.now()-t), g.renderer.stats.calls, g.renderer.stats.triangles, p.state, g.fx.normal ? 0 : 0]); } }
    const t1 = performance.now(); G.render(); out.push(['end', Math.round(performance.now()-t1), g.renderer.stats.calls, g.renderer.stats.triangles, p.state, g.renderer.post.damage, g.renderer.post.fade, g.renderer.post.blur]);
    return out;
  })()`);
  console.log(JSON.stringify(r));
}
