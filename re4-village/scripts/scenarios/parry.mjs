export default async function (page, base, out) {
  await page.goto(base + '?area=test&enemies=0&seed=5');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 30000 });
  const log = (x) => console.log(JSON.stringify(x));
  // parry: press knife right before the strike
  log(await page.evaluate(`(() => { const G = window.__game; const g = G.g; const p = g.player;
    const e = g.spawnEnemy({ kind: 'villager', x: p.pos.x, z: p.pos.z - 1.6, aware: true, weapon: 'sickle', yaw: Math.PI });
    e.yaw = 0; // faces -z... player is at +z relative -> face player
    e.faceTo(p.pos, 10); p.yaw = Math.atan2(-(e.pos.x-p.pos.x), -(e.pos.z-p.pos.z));
    let res = null; const t0 = g.time; let pressed = false;
    const trace = [];
    for (let i = 0; i < 240; i++) {
      if (i % 20 === 0) trace.push([e.state, e.anim.clipName, +e.pos.distanceTo(p.pos).toFixed(2), e.token, +e.attackCd.toFixed(2)]);
      G.step(1/60);
      if (e.state === 'attack' && !pressed) {
        const clip = e.attackClip; const hitT = clip.events.find(x => x.name==='hit' || x.name==='grab').t;
        if (e.anim.time > hitT - 0.12) { G.tap('knife'); pressed = true; }
      }
      if (e.state === 'react' || e.state === 'grab' || p.hp < 1000) { res = [e.state, e.reaction, e.attackKind, Math.round(p.hp), g.stats.parries, Math.round(p.knife)]; break; }
    }
    return res || trace;
  })()`));
  await page.screenshot({ path: out + '/k1.png' });
  // grab & mash escape
  log(await page.evaluate(`(() => { const G = window.__game; const g = G.g; const p = g.player;
    g.enemies.forEach(e => { e.hp = 0; e.state='dead'; e.removed = true; });
    G.step(0.05);
    p.hp = 1000; p.state = 'move';
    const e = g.spawnEnemy({ kind: 'villager', x: p.pos.x, z: p.pos.z - 1.4, aware: true, weapon: 'none' });
    e.faceTo(p.pos, 10);
    let grabbed = false, t = 0;
    for (let i = 0; i < 400; i++) {
      G.step(1/60); t += 1/60;
      if (p.state === 'grabbed') { grabbed = true; if (i % 6 === 0) G.tap('interact'); }
      if (grabbed && p.state !== 'grabbed') break;
    }
    return { grabbed, state: p.state, hp: Math.round(p.hp), t: t.toFixed(2), e: e.state };
  })()`));
  // salvador approaches and attacks
  log(await page.evaluate(`(() => { const G = window.__game; const g = G.g; const p = g.player;
    g.enemies.forEach(e => { e.removed = true; }); G.step(0.05);
    p.hp = 1000; p.state = 'move'; p.invuln = 0;
    const s = g.spawnEnemy({ kind: 'salvador', x: p.pos.x, z: p.pos.z - 12, aware: true });
    const rows = [];
    for (let i = 0; i < 60; i++) { G.step(0.1); rows.push([s.state, s.anim.clipName, +s.pos.distanceTo(p.pos).toFixed(1), Math.round(p.hp), p.state]); if (p.state === 'dead') break; }
    return rows.filter((r, i) => i % 3 === 0 || r[4] !== 'move');
  })()`));
  await page.screenshot({ path: out + '/k2.png' });
}
