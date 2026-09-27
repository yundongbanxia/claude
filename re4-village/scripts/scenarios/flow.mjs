// End-to-end story flow using teleports; verifies triggers & transitions.
export default async function (page, base, out) {
  await page.goto(base + '?area=forest&seed=2&debug=god');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const log = (x) => console.log(JSON.stringify(x));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const skipCut = () => ev(() => { const G = window.__game; for (let i = 0; i < 20 && G.g.cutscene; i++) { G.tap('interact'); G.step(0.5); } });
  await ev(() => window.__game.step(0.5));
  await skipCut();
  log(await ev(() => ({ area: window.__game.g.area.id, obj: document.querySelector('#objective').textContent })));
  // walk into the lodge
  await ev(() => { const G = window.__game; G.g.player.place(-17.5, -46, 1.5); G.step(0.3); });
  log(await ev(() => ({ cut: !!window.__game.g.cutscene, sub: document.querySelector('#subtitle').textContent })));
  await page.screenshot({ path: out + '/flow_lodge.png' });
  await skipCut();
  // kill lodge villager
  await ev(() => { const G = window.__game; const e = G.g.enemies.find(e => e.tag === 'lodge1'); e.takeDamage({ dmg: 9999, zone: 'torso', dir: new G.THREE.Vector3(1,0,0), kind: 'bullet' }); G.step(3.5); });
  log(await ev(() => ({ siege: window.__game.g.flags.lodge_siege, n: window.__game.g.enemies.filter(e => e.alive).length, obj: document.querySelector('#objective').textContent })));
  // kill everything, go to village
  await ev(() => { const G = window.__game; G.g.enemies.forEach(e => e.alive && e.takeDamage({ dmg: 9999, zone: 'torso', dir: new G.THREE.Vector3(1,0,0), kind: 'bullet' })); G.step(1); G.g.player.place(0, -182, Math.PI); G.step(0.8); }); await page.waitForTimeout(500); await ev(() => window.__game.step(0.1));
  log(await ev(() => ({ area: window.__game.g.area.id })));
  await skipCut();
  // trigger siege
  await ev(() => { const G = window.__game; G.g.player.place(0, 18, 0); G.step(2); });
  log(await ev(() => ({ started: window.__game.g.flags.siege_started, alive: window.__game.g.enemies.filter(e => e.alive).length })));
  // fast forward siege in chunks
  for (let k = 0; k < 8; k++) {
    const r = await ev(() => { const G = window.__game; const g = G.g; g.player.hp = g.player.maxHp; G.step(30, 1/30);
      return { t: g.time.toFixed(0), alive: g.enemies.filter(e => e.alive).length, sal: g.enemies.some(e => e.isSalvador && e.alive), states: g.enemies.filter(e=>e.alive).map(e => e.state).join(','), done: g.flags.siege_done, pst: g.player.state }; });
    log(r);
    if (r.done) break;
  }
  await page.screenshot({ path: out + '/flow_village.png' });
  await skipCut();
  log(await ev(() => ({ done: window.__game.g.flags.siege_done, obj: document.querySelector('#objective').textContent })));
  // crank, gate
  await ev(() => { const G = window.__game; G.g.player.place(35.6, -1.4, 0); });
  await ev(() => { const G = window.__game; const g = G.g; g.inv.add('crank'); g.player.place(46.5, -27.5, 0); G.step(0.2); G.tap('interact'); G.step(3); g.player.place(48.5, -24, -Math.PI/2); G.step(0.8); }); await page.waitForTimeout(500); await ev(() => window.__game.step(0.1));
  log(await ev(() => ({ area: window.__game.g.area.id, gate: window.__game.g.flags.village_gate_open })));
  await skipCut();
  // farm finale
  await ev(() => { const G = window.__game; G.g.player.place(4.5, -100.5, 0); G.press('interact'); G.step(4); });
  log(await ev(() => ({ crank: window.__game.g.flags.farm_crank, act: window.__game.g.player.action && window.__game.g.player.action.name })));
  for (let k = 0; k < 4; k++) {
    const r = await ev(() => { const G = window.__game; const g = G.g; g.player.hp = g.player.maxHp; if (!g.player.action && g.player.state === 'move') g.player.place(4.5, -100.5, 0); G.step(5, 1/30); return { crank: g.flags.farm_crank, open: g.flags.farm_gate_open, alive: g.enemies.filter(e => e.alive).length }; });
    log(r);
  }
  await ev(() => { const G = window.__game; G.release('interact'); G.g.flags.farm_gate_open = true; G.g.player.place(0, -107, 0); G.step(0.5); });
  log(await ev(() => ({ state: window.__game.g.state })));
  await page.screenshot({ path: out + '/flow_results.png' });
}
