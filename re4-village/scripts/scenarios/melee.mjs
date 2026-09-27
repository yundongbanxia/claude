export default async function (page, base, out) {
  await page.goto(base + '?area=test&enemies=1&seed=3');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 30000 });
  const log = (x) => console.log(JSON.stringify(x));
  const setup = `
    const G = window.__game; const g = G.g; const e = g.enemies[0];
    g.player.hp = 1000; g.player.state = 'move'; g.player.invuln = 0;
    e.pos.set(g.player.pos.x, g.player.pos.y, g.player.pos.z - 3); e.attackCd = 5; e.aware = true; e.setState('chase');
    G.step(0.05);`;
  // headshot -> kick
  log(await page.evaluate(`(() => { ${setup}
    const h = e.headPos; G.aimAt(h.x, h.y, h.z); G.press('aim'); G.step(0.9);
    const h2 = e.headPos; G.aimAt(h2.x, h2.y, h2.z); G.tap('fire'); G.step(0.05);
    const after = [e.state, e.reaction, Math.round(e.hp)];
    G.release('aim'); G.step(0.25);
    G.tap('interact'); G.step(0.3);
    const kick = [g.player.action && g.player.action.name, e.state];
    return { after, kick };
  })()`));
  await page.screenshot({ path: out + '/m1.png' });
  await page.evaluate(`window.__game.step(0.5)`);
  await page.screenshot({ path: out + '/m2.png' });
  log(await page.evaluate(`(() => { const G = window.__game; const e = G.g.enemies[0]; return [e.state, e.anim.clipName, Math.round(e.hp)]; })()`));
  // leg shot -> kneel -> suplex from behind
  log(await page.evaluate(`(() => { const G = window.__game; const g = G.g;
    const e = g.spawnEnemy({ kind: 'villager', x: 0, z: 0, aware: true, weapon: 'sickle' });
    g.player.hp = 1000; g.player.state = 'move';
    e.state = 'chase'; e.pos.set(g.player.pos.x, g.player.pos.y, g.player.pos.z - 4); e.yaw = 0; e.attackCd = 5; e.staggerImmune = 0;
    G.step(0.05);
    const k = e.rig.bones[12].getWorldPosition(new G.THREE.Vector3());
    G.aimAt(k.x, k.y + 0.1, k.z); G.press('aim'); G.step(0.9);
    const k2 = e.rig.bones[12].getWorldPosition(new G.THREE.Vector3());
    G.aimAt(k2.x, k2.y + 0.1, k2.z); G.tap('fire'); G.step(0.1); G.release('aim');
    const r = [e.state, e.reaction];
    // teleport behind the kneeling enemy
    g.pickups.forEach(p => p.dispose()); g.pickups = [];
    g.player.pos.set(e.pos.x + Math.sin(e.yaw) * 1.2, e.pos.y, e.pos.z + Math.cos(e.yaw) * 1.2);
    G.step(0.3);
    const prompt = document.querySelector('#prompt')?.textContent;
    G.tap('interact'); G.step(0.8);
    return { r, prompt, act: g.player.action && g.player.action.name, st: e.state, hp: Math.round(e.hp) };
  })()`));
  await page.screenshot({ path: out + '/m3.png' });
  await page.evaluate(`window.__game.step(1.2)`);
  log(await page.evaluate(`(() => { const e = window.__game.g.enemies.find(x=>x.state==='dead' || x.state==='down' || x.state==='suplexed'); return e ? [e.state, Math.round(e.hp)] : null; })()`));
}
