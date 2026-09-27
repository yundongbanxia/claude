// Simple bot that plays the village siege. Env: DIFF=standard, DUR=seconds
export default async function (page, base, out) {
  const diff = process.env.DIFF ?? 'standard';
  await page.goto(base + `?area=village&seed=${process.env.SEED ?? 4}&diff=${diff}`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  await page.evaluate(() => {
    const G = window.__game; const g = G.g; const V = G.THREE.Vector3;
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.player.place(-2, 16, 0);
    // give the shotgun like a real player who explored the house
    g.inv.add('w870'); g.inv.add('ammo_sg', 8);
    window.__bot = { t: 0, deaths: 0, log: [], fireCd: 0, minHp: 1000, heals: 0 };
    window.__botStep = (dt) => {
      const B = window.__bot; const p = g.player; B.t += dt; B.fireCd -= dt;
      if (g.state === 'dead') { B.deaths++; g.continueFromCheckpoint(); G.step(0.1); return; }
      if (g.cutscene) { G.tap('interact'); return; }
      B.minHp = Math.min(B.minHp, p.hp);
      const alive = g.enemies.filter(e => e.alive && e.state !== 'leave');
      let tgt = null, td = 1e9;
      for (const e of alive) { const d = e.pos.distanceTo(p.pos); if (d < td && d < 30) { td = d; tgt = e; } }
      G.release('back'); G.release('forward');
      if (p.hp < p.maxHp * 0.35 && p.state === 'move') { G.tap('heal'); B.heals++; }
      if (!tgt) { G.release('aim'); return; }
      const melee = alive.find(e => e.stunnedForMelee && e.pos.distanceTo(p.pos) < 3);
      if (melee && p.state === 'move') { G.release('aim'); G.tap('interact'); return; }
      if (p.state === 'grabbed') { G.tap('interact'); return; }
      // swap to shotgun when crowded
      const close = alive.filter(e => e.pos.distanceTo(p.pos) < 5).length;
      const want = close >= 2 || tgt.isSalvador ? 'w870' : 'sg09';
      const wInst = g.inv.weapons().find(w => w.weapon.id === want && (w.weapon.mag > 0 || g.inv.count(want === 'w870' ? 'ammo_sg' : 'ammo_hg') > 0));
      if (wInst && p.weaponUid !== wInst.uid) p.equip(wInst.uid);
      if (td < 2.2 && tgt.state !== 'react') G.press('back');
      const h = tgt.headPos; const err = 0.12;
      const aimP = new V(h.x + (Math.random()-0.5)*err, h.y - 0.05 + (Math.random()-0.5)*err, h.z + (Math.random()-0.5)*err);
      G.press('aim');
      const cam = g.camera; const dx = aimP.x - cam.cam.position.x, dy = aimP.y - cam.cam.position.y, dz = aimP.z - cam.cam.position.z;
      const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
      // turn speed limit (human-ish)
      const lim = 5 * dt; const d1 = Math.atan2(Math.sin(ty - cam.yaw), Math.cos(ty - cam.yaw));
      cam.yaw += Math.max(-lim, Math.min(lim, d1)); cam.pitch += Math.max(-lim, Math.min(lim, tp - cam.pitch));
      const ready = Math.abs(d1) < 0.05 && (p.focusT > 0.1 || td < 6);
      const w = p.weapon && p.weapon.weapon;
      if (w && w.mag === 0 && p.reloadT < 0) G.tap('reload');
      if (ready && B.fireCd <= 0 && tgt.state !== 'react' && tgt.state !== 'down') { G.tap('fire'); B.fireCd = 0.35; }
    };
  });
  const dur = parseInt(process.env.DUR ?? '240');
  const shotsAt = (process.env.SHOTAT ?? '').split(',').filter(Boolean).map(Number);
  for (let s = 0; s < dur; s += 10) {
    const r = await page.evaluate((s) => {
      const G = window.__game; const g = G.g; const B = window.__bot;
      for (let i = 0; i < 300; i++) { window.__botStep(1/30); G.step(1/30, 1/30); }
      const inv = g.inv;
      return { t: s + 10, hp: Math.round(g.player.hp), minHp: Math.round(B.minHp), deaths: B.deaths, kills: g.stats.kills, hg: inv.count('ammo_hg') + (g.inv.weapons().find(w=>w.weapon.id==='sg09')?.weapon.mag ?? 0), sg: inv.count('ammo_sg'), herbs: inv.items.filter(i => i.id.startsWith('herb')).length, alive: g.enemies.filter(e => e.alive).length, done: !!g.flags.siege_done, pst: g.player.state, sal: g.enemies.some(e=>e.isSalvador&&e.alive) };
    }, s);
    console.log(JSON.stringify(r));
    if (shotsAt.includes(s + 10)) await page.screenshot({ path: out + `/bot_${s + 10}.png` });
    if (r.done) break;
  }
  await page.screenshot({ path: out + '/bot.png' });
  console.log(JSON.stringify(await page.evaluate(() => ({ shots: window.__game.g.combat.shots, hits: window.__game.g.combat.hits, heads: window.__game.g.combat.headshots, dmg: Math.round(window.__game.g.stats.damage), rank: window.__game.g.dda.rank.toFixed(2), heals: window.__bot.heals }))));
}
