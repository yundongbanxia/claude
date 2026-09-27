export default async function (page, base, out) {
  await page.goto(base + '?area=test&enemies=1&seed=3');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 30000 });
  const log = (x) => console.log(JSON.stringify(x));
  // 1) let the enemy come and attack us
  const r1 = await page.evaluate(() => {
    const G = window.__game; const g = G.g;
    const out = [];
    for (let i = 0; i < 40; i++) { G.step(0.25); const e = g.enemies[0]; out.push([+(i*0.25).toFixed(2), e.state, e.anim.clipName, +e.pos.distanceTo(g.player.pos).toFixed(2), Math.round(g.player.hp), g.player.state]); }
    return out;
  });
  for (const r of r1) if (r[0] % 1 === 0 || r[5] !== 'move') log(r);
  await page.screenshot({ path: out + '/c1.png' });
  // 2) headshot -> stagger -> kick
  const r2 = await page.evaluate(() => {
    const G = window.__game; const g = G.g; const e = g.enemies[0];
    g.player.hp = 1000; g.player.state = 'move'; g.player.invuln = 0;
    // put enemy in front at 3m
    e.pos.set(g.player.pos.x, g.player.pos.y, g.player.pos.z - 3); e.attackCd = 5; e.setState('chase');
    G.step(0.05);
    const h = e.headPos; G.aimAt(h.x, h.y, h.z); G.press('aim'); G.step(0.9);
    const h2 = e.headPos; G.aimAt(h2.x, h2.y, h2.z); G.tap('fire'); G.step(0.05);
    const after = [e.state, e.reaction, Math.round(e.hp)];
    G.release('aim'); G.step(0.3);
    const melee = e.stunnedForMelee;
    G.tap('interact'); G.step(0.4);
    const kick = [g.player.action && g.player.action.name, e.state];
    G.step(1.0);
    return { after, melee, kick, end: [e.state, Math.round(e.hp)] };
  });
  log(r2);
  await page.screenshot({ path: out + '/c2.png' });
}
