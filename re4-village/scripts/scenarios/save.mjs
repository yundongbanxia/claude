export default async function (page, base, out) {
  await page.goto(base + `?area=village&seed=5`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const a = await page.evaluate(() => {
    const G = window.__game; const g = G.g;
    for (let i = 0; i < 20 && g.cutscene; i++) { G.tap('interact'); G.step(0.5); }
    g.inv.add('w870'); g.inv.pesetas = 4321; g.flags.siege_done = true; g.player.hp = 555; g.player.knife = 700;
    g.player.place(18, -14, 0);
    const ok = g.saveSlot(2);
    return { ok, slot: !!window.__game.g.constructor.readSlot(2) };
  });
  console.log(JSON.stringify(a));
  // reload page, load from title
  await page.goto(base);
  await page.waitForSelector('h1.title');
  await page.click('text=读取存档');
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/load.png' });
  await page.click('text=存档 2');
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const b = await page.evaluate(() => { const g = window.__game.g; return { area: g.area.id, pes: g.inv.pesetas, w870: g.inv.hasWeapon('w870'), hp: g.player.hp, knife: g.player.knife, pos: g.player.pos.toArray().map(v => +v.toFixed(1)), siege: g.flags.siege_done }; });
  console.log(JSON.stringify(b));
}
