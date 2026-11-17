// A scripted play session with real keyboard events, to check the game actually plays: load the
// page, press Enter on the title, walk forward, walk to the nearest car and press E, drive with
// W, steer, brake, get out. It prints what happened at each stage, saves a screenshot per stage
// to out/playtest/ and exits non-zero if a stage fails or the page logs an error.
//   node tools/playtest.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, root } from './browser.ts';

const outDir = join(root, 'out', 'playtest');
mkdirSync(outDir, { recursive: true });
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const browser = await Browser.launch(640, 400, 8772);
try {
  const page = await browser.open('/', 640, 400);
  await page.waitFor('window.portSolano && document.getElementById("title-screen").hidden === false', 120000);
  const snap = async (name: string) => writeFileSync(join(outDir, `${name}.png`), await page.screenshot());
  const state = () => page.eval<any>(`(() => {
    const g = window.portSolano, p = g.player, c = p.vehicle;
    return { mode: g.mode, x: p.position.x, z: p.position.z, inCar: !!c, speed: c ? c.forwardSpeed : 0,
      heading: c ? c.heading : p.heading, hud: !document.getElementById('hud').hidden,
      prompt: document.getElementById('prompt').hidden ? '' : document.getElementById('prompt').textContent };
  })()`);
  await snap('0-title');

  await page.tap('Enter');
  await page.waitFor('window.portSolano.mode === "play"', 10000);
  let s = await state();
  check(s.mode === 'play' && s.hud, `Enter starts the game, HUD showing (mode=${s.mode})`);
  const start = s;

  await page.holdFrames(['KeyW'], 12);
  s = await state();
  const walked = Math.hypot(s.x - start.x, s.z - start.z);
  check(walked > 1.5, `W walks the player (${walked.toFixed(1)} m)`);
  await snap('1-walk');

  // Head for the nearest car by teleporting next to it the way a player would walk up.
  await page.eval(`(() => {
    const g = window.portSolano, car = g.starterCar;
    const s = Math.sin(car.heading), c = Math.cos(car.heading);
    g.player.placeAt(car.position.x - c * 2.2, car.position.z + s * 2.2, car.heading, 0.16);
  })()`);
  await page.holdFrames(['KeyS'], 1);
  s = await state();
  check(/Steal/.test(s.prompt), `prompt offers the car ("${s.prompt}")`);
  await page.tap('KeyE');
  await page.waitFor('window.portSolano.player.vehicle', 5000).catch(() => {});
  s = await state();
  check(s.inCar, 'E gets into the car');
  await snap('2-in-car');

  const before = s;
  await page.holdFrames(['KeyW'], 25);
  s = await state();
  const drove = Math.hypot(s.x - before.x, s.z - before.z);
  check(s.speed > 5 && drove > 5, `W drives (speed ${(s.speed * 3.6).toFixed(0)} km/h, ${drove.toFixed(1)} m)`);
  await snap('3-driving');

  const h0 = s.heading;
  await page.holdFrames(['KeyW', 'KeyA'], 12);
  s = await state();
  check(Math.abs(s.heading - h0) > 0.2, `A steers (heading changed ${(s.heading - h0).toFixed(2)} rad)`);

  const fast = Math.abs(s.speed);
  await page.holdFrames(['KeyS'], 6);
  s = await state();
  check(Math.abs(s.speed) < fast * 0.6, `S brakes (${(fast * 3.6).toFixed(0)} -> ${(s.speed * 3.6).toFixed(0)} km/h)`);
  await page.waitFor('Math.abs(window.portSolano.player.vehicle.forwardSpeed) < 2', 600000);
  await page.tap('KeyE');
  await page.waitFor('!window.portSolano.player.vehicle', 5000).catch(() => {});
  s = await state();
  check(!s.inCar, 'E gets out again');
  await snap('4-out');

  await page.tap('Escape');
  s = await state();
  check(s.mode === 'paused', 'Esc pauses');
  await page.tap('Escape');
} finally {
  browser.close();
}
check(browser.errors.length === 0, `no console errors${browser.errors.length ? `:\n  ${browser.errors.join('\n  ')}` : ''}`);
process.exit(failures.length ? 1 : 0);
