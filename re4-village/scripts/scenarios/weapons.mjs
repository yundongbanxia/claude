export default async function (page, base, out) {
  await page.goto(base + `?area=test&enemies=0&seed=9`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const log = (x) => console.log(JSON.stringify(x));
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { const g = window.__game.g; g.inv.add('w870'); g.inv.add('sr1903'); g.inv.add('red9'); g.inv.add('ammo_sg', 12); g.inv.add('ammo_rf', 10); g.inv.add('nade'); g.inv.add('flash'); g.godMode = true; });
  // shotgun vs a group at 4m
  log(await ev(() => { const G = window.__game; const g = G.g; const p = g.player;
    const es = [0, 1, 2].map(i => g.spawnEnemy({ kind: 'villager', x: p.pos.x - 0.8 + i * 0.8, z: p.pos.z - 4, aware: true }));
    es.forEach(e => e.attackCd = 10);
    const sg = g.inv.weapons().find(w => w.weapon.id === 'w870'); p.equip(sg.uid); G.step(0.5);
    G.aimAt(p.pos.x, p.pos.y + 1.2, p.pos.z - 4); G.press('aim'); G.step(0.6);
    G.aimAt(p.pos.x, p.pos.y + 1.2, p.pos.z - 4); G.tap('fire'); G.step(0.15);
    const r = es.map(e => [e.state, Math.round(e.hp)]);
    G.release('aim'); G.step(0.2);
    return { shotgun: r };
  }));
  await page.screenshot({ path: out + '/w_sg.png' });
  // rifle scope + pierce
  log(await ev(() => { const G = window.__game; const g = G.g; const p = g.player;
    g.enemies.forEach(e => e.removed = true); G.step(0.1);
    const es = [0, 1].map(i => g.spawnEnemy({ kind: 'villager', x: p.pos.x, z: p.pos.z - 14 - i * 1.2, aware: false, state: 'idle', yaw: Math.PI }));
    const rf = g.inv.weapons().find(w => w.weapon.id === 'sr1903'); p.equip(rf.uid); G.step(0.5);
    G.step(0.05);
    const h = es[0].center; G.aimAt(h.x, h.y, h.z); G.press('aim'); G.step(1.0);
    const scope = g.camera.scope.toFixed(2);
    const h2 = es[0].center; G.aimAt(h2.x, h2.y, h2.z); G.tap('fire'); G.step(0.1);
    return { rifle: es.map(e => [e.state, Math.round(e.hp)]), scope };
  }));
  await ev(() => window.__game.step(0.1));
  await page.screenshot({ path: out + '/w_rf.png' });
  // grenade into a group
  log(await ev(() => { const G = window.__game; const g = G.g; const p = g.player;
    G.release('aim'); g.enemies.forEach(e => e.removed = true); G.step(0.1);
    const es = [0, 1, 2].map(i => g.spawnEnemy({ kind: 'villager', x: p.pos.x - 1 + i, z: p.pos.z - 9, aware: false, state: 'idle' }));
    G.aimAt(p.pos.x, p.pos.y, p.pos.z - 9); G.step(0.05); G.aimAt(p.pos.x, p.pos.y, p.pos.z - 9);
    G.tap('grenade'); G.step(3.2);
    return { grenade: es.map(e => [e.state, Math.round(e.hp)]), hp: Math.round(p.hp) };
  }));
  // flash grenade stuns
  log(await ev(() => { const G = window.__game; const g = G.g; const p = g.player;
    g.enemies.forEach(e => e.removed = true); G.step(0.1);
    const es = [0, 1].map(i => g.spawnEnemy({ kind: 'villager', x: p.pos.x - 1 + 2 * i, z: p.pos.z - 7, aware: true }));
    es.forEach(e => e.attackCd = 10);
    G.aimAt(p.pos.x, p.pos.y, p.pos.z - 6); G.tap('grenade'); G.step(2.0);
    return { flash: es.map(e => e.state), post: g.renderer.post.flash.toFixed(2) };
  }));
  // dynamite thrower: shoot the lit stick
  log(await ev(() => { const G = window.__game; const g = G.g; const p = g.player;
    g.enemies.forEach(e => e.removed = true); G.step(0.1);
    const d = g.spawnEnemy({ kind: 'dynamite', x: p.pos.x, z: p.pos.z - 10, aware: true });
    const buddy = g.spawnEnemy({ kind: 'villager', x: p.pos.x + 1.2, z: p.pos.z - 10.5, aware: true });
    buddy.attackCd = 10;
    const hg = g.inv.weapons().find(w => w.weapon.id === 'sg09'); p.equip(hg.uid);
    let lit = false;
    for (let i = 0; i < 300; i++) { G.step(1/60); if (d.lit && d.state === 'light') { lit = true; break; } }
    G.step(0.2);
    const w = d.weaponObj.getWorldPosition(new G.THREE.Vector3());
    G.aimAt(w.x, w.y, w.z); G.press('aim'); G.step(0.8); const w2 = d.weaponObj.getWorldPosition(new G.THREE.Vector3()); G.aimAt(w2.x, w2.y, w2.z);
    G.tap('fire'); G.step(0.5);
    return { lit, dyn: [d.state, Math.round(d.hp)], buddy: [buddy.state, Math.round(buddy.hp)] };
  }));
  await page.screenshot({ path: out + '/w_dyn.png' });
}
