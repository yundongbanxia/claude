// Usage: AREA=forest SHOTS="x,z,yaw,pitch;..." node scripts/play.mjs area
export default async function (page, base, out) {
  const area = process.env.AREA ?? 'forest';
  await page.goto(base + `?area=${area}&seed=1${process.env.EXTRA ?? ''}`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  await page.evaluate(() => { const G = window.__game; G.g.cutscene = null; G.g.camera.override = null; G.g.renderer.post.letterbox = 0; G.step(0.5); });
  const shots = (process.env.SHOTS ?? '').split(';').filter(Boolean);
  let i = 0;
  for (const s of shots) {
    const [x, z, yaw, pitch] = s.split(',').map(Number);
    const info = await page.evaluate(([x, z, yaw, pitch]) => {
      const G = window.__game; const g = G.g;
      g.player.place(x, z, yaw); g.camera.pitch = pitch || -0.1; g.godMode = true;
      g.enemies.forEach(e => { e.aware = false; });
      G.step(0.3);
      return { calls: g.renderer.stats.calls, tris: g.renderer.stats.triangles, y: g.player.pos.y.toFixed(2) };
    }, [x, z, yaw, pitch]);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${area}_${i}.png` });
    console.log(i, s, JSON.stringify(info));
    i++;
  }
  const st = await page.evaluate(() => { const g = window.__game.g; return { enemies: g.enemies.length, nav: g.level.nav.total, colliders: g.level.cw.colliders.filter(Boolean).length }; });
  console.log(JSON.stringify(st));
}
