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

  // Day 3: the title screen lists Marla's jobs — the first open, the rest locked.
  const jobs = await page.eval(`(() => {
    const bs = [...document.querySelectorAll('#mission-list .job')];
    return { count: bs.length, first: bs[0]?.disabled === false, second: bs[1]?.disabled === true, label: bs[0]?.textContent ?? '' };
  })()`);
  check(jobs.count === 4 && jobs.first && jobs.second, `title lists 4 jobs, first open, rest locked (${jobs.label.trim()})`);

  // start the first job from the title screen
  await page.eval(`document.querySelector('#mission-list .job').click()`);
  await page.waitFor('window.portSolano.mode === "play"', 10000);
  let s = await state();
  check(s.mode === 'play' && s.hud, `job starts the game, HUD showing (mode=${s.mode})`);
  const start = s;
  // the objective card is written by the frame loop, so wait for a rendered frame
  await page.waitFor("document.getElementById('objective-title').textContent.includes('First Wheels')", 30000);
  const obj = await page.eval(`document.getElementById('objective-title').textContent`);
  check(/First Wheels/.test(obj), `job 1 starts from the title (objective "${obj}")`);

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

  // Brake from a known speed: S stops a slow car in one frame and then reverses, so the
  // check needs a real run-up. Put the car back on Solano Blvd (kerb 6.4, heading south)
  // at 12 m/s and brake for three frames — it should shed speed but stay moving forward.
  await page.eval(`(() => {
    const g = window.portSolano, car = g.player.vehicle;
    car.placeAt(6.4, -30, Math.PI);
    car.velocity.set(Math.sin(Math.PI) * 12, 0, Math.cos(Math.PI) * 12);
  })()`);
  const fast = 12;
  await page.holdFrames(['KeyS'], 3);
  s = await state();
  check(s.speed > 0 && s.speed < fast * 0.6, `S brakes (${(fast * 3.6).toFixed(0)} -> ${(s.speed * 3.6).toFixed(0)} km/h)`);
  await page.waitFor('Math.abs(window.portSolano.player.vehicle.forwardSpeed) < 2', 600000);
  await page.tap('KeyE');
  await page.waitFor('!window.portSolano.player.vehicle', 5000).catch(() => {});
  s = await state();
  check(!s.inCar, 'E gets out again');
  await snap('4-out');

  // Day 3: F punches a bystander down, and the cops notice.
  await page.eval(`(() => {
    const g = window.portSolano;
    // a bystander away from parked cars, so F means punch and not "get in"
    const ped = g.pedestrians.list.find((p) => {
      let nearest = Infinity;
      for (const c of g.garage.cars) nearest = Math.min(nearest, Math.hypot(c.position.x - p.position.x, c.position.z - p.position.z));
      return nearest > 6;
    }) ?? g.pedestrians.list[0];
    window.__punchPed = ped;
    const dx = ped.position.x - g.player.position.x, dz = ped.position.z - g.player.position.z;
    const d = Math.hypot(dx, dz);
    g.player.placeAt(ped.position.x - (dx / d) * 1.2, ped.position.z - (dz / d) * 1.2, Math.atan2(dx, dz), 0.16);
  })()`);
  await page.tap('KeyF');
  await page.waitFor('window.__punchPed.state === "down"', 10000).catch(() => {});
  const punched = await page.eval(`({ down: window.__punchPed.state, wanted: window.portSolano.state.wanted })`);
  check(punched.down === 'down' && punched.wanted >= 1, `F punches a bystander down (state=${punched.down}, wanted=${punched.wanted})`);
  await snap('5-punch');

  // Day 3: getting busted mid-job fails the job.
  await page.eval(`window.portSolano.enterBusted()`);
  // the objective card refreshes on the next rendered frame (busted mode still presents)
  await page.waitFor("document.getElementById('objective-title').textContent.includes('Welcome to Port Solano')", 30000);
  const failed = await page.eval(`({ active: window.portSolano.missions.active, title: document.getElementById('objective-title').textContent })`);
  check(failed.active === null && /Welcome to Port Solano/.test(failed.title), `busted fails the job (active=${failed.active})`);
  await page.tap('Enter');
  await page.waitFor('window.portSolano.mode === "play"', 10000);
  s = await state();
  check(s.mode === 'play', 'Enter walks free after the bust');

  await page.tap('Escape');
  s = await state();
  check(s.mode === 'paused', 'Esc pauses');
  await page.tap('Escape');
} finally {
  browser.close();
}
check(browser.errors.length === 0, `no console errors${browser.errors.length ? `:\n  ${browser.errors.join('\n  ')}` : ''}`);
process.exit(failures.length ? 1 : 0);
