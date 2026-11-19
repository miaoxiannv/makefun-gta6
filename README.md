[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/miaoxiannv/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/miaoxiannv/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Port Solano: Sun. Sand. Sirens.

An open-world crime game for the desktop browser, built on Three.js. Port Solano is an
original coastal city on the Gulf: glass towers in Solano Center, pastel deco along Marisol
Beach, stucco bungalows under terracotta roofs in Palm Heights, warehouses in Dockside, palm
parks with fountains, and a sea that rolls in under the sunset. Walk it, steal any parked car,
and drive it while the clock rolls on into night.

![Tearing up Solano Blvd at golden hour](screenshots/1-drive.jpg)

## Play

```sh
node serve.ts     # then open http://localhost:8080
```

There is no build step and nothing is fetched at runtime. Everything is static files under
`game/`, and Three.js is vendored as a minified module (`game/vendor/three.min.js`) loaded
through an import map.

## Controls

| Key | On foot | In a car |
| --- | --- | --- |
| `W` `A` `S` `D` / arrows | walk, relative to the camera | throttle, brake / reverse, steer |
| `Shift` | sprint | |
| `Space` | jump | handbrake (kick the tail out) |
| `E` | steal the nearest car | get out (when slow) |
| `F` | punch | |
| `M` | mute sound | mute sound |
| `Q` / `E`, mouse drag | turn the camera | look around (it swings back behind you) |
| mouse wheel | zoom | zoom |
| `H` | show or hide the controls card | |
| `Esc` / `P` | pause | pause |

## What's in it (Day 1)

- **The city.** An 8 × 8 grid of blocks planned from a seed, split into six districts, each
  with its own building heights, facade styles and colours. Roads have double yellow centre
  lines, lane dashes, stop lines and zebra crossings. Sidewalks are raised, with lamps, palms,
  shade trees, park benches and fountains. Facades are painted procedurally on canvases, and
  their windows light up after dark. Towers carry crowns with blinking beacons. A sloping
  beach leads down to an animated sea.
- **On foot.** A jointed third-person character with walk, sprint and jump poses who steps up
  kerbs and collides with buildings, street furniture and cars.
- **Cars.** Five types (Vela GT coupe, Mariner sedan, Sol Cab, Cayo Ridge SUV, Tarpon 1500
  pickup) with arcade handling: an engine that tails off toward top speed, brakes and reverse,
  speed-sensitive steering, tyre grip, handbrake drifts, body roll and pitch, wall bounces,
  and mass-weighted car-to-car shoves. Headlights and brake lights work.
- **Camera.** A chase camera that orbits on foot and swings in behind the car. It widens its
  field of view with speed, pulls in rather than clip through walls, and shakes on crashes.
- **HUD.** A heading-up radar (districts, parks, beach, cars, cash, hospital, north), health,
  a rolling money counter, the clock, wanted stars, street and district names, an objective
  card, a speedometer, context prompts and toasts.
- **Day and night.** The running clock drives the sky gradient, sun, moon, stars, fog, the
  baked reflection map, window lights, lamp glow and headlights.
- **Cash drops** around town, marked on the radar. Crash hard enough and you wake up at
  Solano Mercy Hospital, minus the bill.

## What's in it (Day 2–4)

- **Traffic and cops.** Fourteen AI traffic cars drive the grid, twenty-two pedestrians
  walk the sidewalks, and Solano PD pursues on wanted stars — get busted and pay the $200
  fine (or walk free).
- **Jobs.** Four story missions from the fixer Marla — steal a car, a timed getaway, a
  drop-off ambush, and a payback fight — with punch combat (fists and knuckle dusters),
  rival crew AI, a boss fight, unlocks (knuckle dusters, armored jacket, a getaway coupe,
  a garage safehouse), and a localStorage save with Continue on the title screen.
- **Effects.** Impact spark bursts, exhaust puffs, handbrake skid marks, a damage flash,
  and screen shake on hard hits and busts.
- **Sound.** Synthesized WebAudio only — an engine hum that follows your speed, a police
  siren while wanted, collision thuds, punch hits, cash pickups, UI clicks, and
  mission-complete / fail stingers. `M` or the 🔊 button mutes it.
- **Menus.** A title screen with the job list and progress, mission complete / fail cards,
  a pause screen with stats, and a busted screen.

## Screenshots and checks

`shots.json` lists the deterministic scenes (`?shot=drive|foot|night|title`). Each one
starts a fresh session and runs the real simulation forward with scripted controls.

```sh
node tools/shoot.ts      # capture screenshots/ in headless Chromium (1280x800 JPEG, <256 KiB)
node tools/playtest.ts   # play with real key presses: start, walk, steal, drive, steer, brake, exit
```

Both tools use Playwright's Chromium headless shell by default (set `CHROME` to use another
browser) and fail if the page logs any error.

## Source layout

```
game/index.html, styles.css    page, HUD markup, title and pause screens
game/src/main.js               renderer, frame loop, screens, ?shot= staging
game/src/game.js               the session: world, player, cars, camera, HUD, clock
game/src/controls.js           keyboard -> control record
game/src/config.js             every tuning number
game/src/shots.js              screenshot scenes
game/src/core/                 input, seeded RNG + maths, mesh builder, canvas textures
game/src/city/                 plan (districts, lots, parking), collision, streets, buildings, props
game/src/world/                daylight curve, sky + lights, ocean, cash drops
game/src/actors/               person rig, player
game/src/vehicles/             car catalogue + bodies, car handling, garage (fleet)
game/src/camera/               chase camera
game/src/ui/                   HUD, radar, title/pause screens
tools/                         headless browser helper, screenshot tool, playtest
```

## Licence

MIT. Three.js is © its authors and MIT licensed.

<sub>Entered on [make.fun](https://make.fun/?ref=98fayedq&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
