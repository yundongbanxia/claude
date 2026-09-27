export default async function (page, base, out) {
  await page.goto(base + `?area=test&enemies=0&seed=4`);
  await page.waitForFunction(() => window.__game && window.__game.g.state === 'play', null, { timeout: 60000 });
  const shots = [
    ['aim', `G.press('aim'); G.step(0.6);`],
    ['reload', `G.release('aim'); G.step(0.3); G.g.player.weapon.weapon.mag = 3; G.tap('reload'); G.step(0.7);`],
    ['slash', `G.step(1.2); G.tap('knife'); G.step(0.16);`],
    ['guard', `G.press('knife'); G.step(0.8);`],
    ['throw', `G.release('knife'); G.step(0.5); G.g.inv.add('nade'); G.tap('grenade'); G.step(0.3);`],
    ['shotgun', `G.step(2.5); G.g.inv.add('w870'); G.g.player.equip(G.g.inv.weapons().find(w => w.weapon.id === 'w870').uid); G.step(0.5); G.press('aim'); G.step(0.6);`],
  ];
  for (const [name, code] of shots) {
    await page.evaluate(`(() => { const G = window.__game; ${code}
      const p = G.g.player.pos; const yaw = G.g.player.yaw;
      G.g.camera.override = { pos: new G.THREE.Vector3(p.x + Math.cos(yaw) * 2.6 - Math.sin(yaw) * 1.2, p.y + 1.4, p.z - Math.sin(yaw) * 2.6 - Math.cos(yaw) * 1.2), look: new G.THREE.Vector3(p.x - Math.sin(yaw) * 0.3, p.y + 1.1, p.z - Math.cos(yaw) * 0.3), fov: 45, blend: 1 };
      G.g.camera.update(0, G.g.player.pos, null);
    })()`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/pose_${name}.png`, clip: { x: 320, y: 60, width: 640, height: 600 } });
    await page.evaluate(`window.__game.g.camera.override = null`);
  }
}
