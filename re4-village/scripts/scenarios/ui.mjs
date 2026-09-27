export default async function (page, base, out) {
  await page.goto(base + `?area=test&enemies=0&seed=4`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  await page.evaluate(() => {
    const G = window.__game; const g = G.g;
    g.inv.add('w870'); g.inv.add('ammo_sg', 10); g.inv.add('herb_g', 1); g.inv.add('herb_r', 1); g.inv.add('nade'); g.inv.add('flash'); g.inv.add('spray'); g.inv.add('egg_b');
    g.inv.add('ammo_hg', 25); g.inv.add('gunpowder', 3); g.inv.add('res_s', 2); g.inv.add('velvet_blue', 1); g.inv.add('spinel', 3);
    g.inv.pesetas = 23500;
    g.openInventory();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/ui_case.png' });
  // drag the red herb onto the green herb
  const items = await page.$$('.case-item');
  console.log('items', items.length);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__game.g.openMerchant(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/ui_shop.png' });
  await page.click('text=改造');
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/ui_upgrade.png' });
  await page.keyboard.press('Escape');
  // audio smoke test
  const errs = await page.evaluate(async () => {
    const g = window.__game.g; const V = window.__game.THREE.Vector3;
    g.audio.init();
    await new Promise(r => setTimeout(r, 200));
    const names = ['hg_shot','red9_shot','sg_shot','rf_shot','dry','mag_out','mag_in','slide','shell','bolt','step','step_wood','knife_swing','knife_hit','parry','parry_perfect','kick_whoosh','kick_hit','flesh','headshot','head_burst','body_fall','leon_hurt','leon_hurt_big','leon_grunt','door_open','door_close','door_bash','wood_break','explosion','flash_bang','fuse','throw','whoosh','axe_hit_wall','pickup','pesetas','ui_move','ui_ok','ui_back','ui_error','typewriter','crow','chicken','ladder_fall','thud','metal','heal','grab','choke','decap','bear_trap','item_drop','glass','moo','crank','gate','buy','medal'];
    const errors = [];
    for (const n of names) { try { g.audio.play(n, new V(1, 1, 1)); } catch (e) { errors.push(n + ':' + e.message); } }
    try { const c = g.audio.chainsaw(new V(0,1,-5)); c.set(1); c.setPos(new V(1,1,-4)); c.stop(); } catch (e) { errors.push('chainsaw:' + e.message); }
    try { g.audio.bell(new V(0, 10, -30), 2); } catch (e) { errors.push('bell:' + e.message); }
    try { const f = g.audio.fireLoop(new V(0,0,0)); f.stop(); } catch (e) { errors.push('fire:' + e.message); }
    try { g.audio.grunt(new V(0,1,-2), 'alert'); g.audio.grunt(new V(0,1,-2), 'salvador'); g.audio.startAmbience('forest'); g.audio.music.setMode('game'); g.audio.music.target = 1; } catch (e) { errors.push('misc:' + e.message); }
    for (let i = 0; i < 60; i++) { g.audio.music.update(0.05); await new Promise(r => setTimeout(r, 20)); }
    return { errors, state: g.audio.ctx && g.audio.ctx.state };
  });
  console.log(JSON.stringify(errs));
}
