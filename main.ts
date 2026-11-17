// Port Solano, an entry for make.fun's gta6-01 bounty. Node 22, standard library only.
//
// The game itself is the static folder game/: index.html, its ES modules under game/src, and
// Three.js vendored as the minified game/vendor/three.min.js, loaded through an import map. A
// desktop browser plays it offline; nothing is fetched from the network. This program packs the
// entry for judging: it copies game/ and screenshots/ next to this file into /output and writes
// /output/dossier.json, the summary the judge reads, using the vendored make.fun library.
//
// What you play: Port Solano, an original sun-soaked coastal city (downtown towers, Marisol
// Beach deco, Palm Heights bungalows, the Dockside warehouses), on foot and behind the wheel of
// any car you can steal, under a running day/night clock, with a radar minimap and HUD.
// The screenshots are deterministic ?shot= scenes listed in shots.json; `node tools/shoot.ts`
// captures them and `node tools/playtest.ts` plays a scripted session with real key presses.
//
// Play locally: `node serve.ts`, then open http://localhost:8080.
// Pack locally (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader's container):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The scorer's limits: more screenshots, bigger images or a bigger game/ would be refused. */
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

mkdirSync(output, { recursive: true });
cpSync(join(here, 'game'), join(output, 'game'), { recursive: true });
const shots = join(here, 'screenshots');
mkdirSync(join(output, 'screenshots'), { recursive: true });
if (existsSync(shots)) cpSync(shots, join(output, 'screenshots'), { recursive: true });

writeFileSync(join(output, 'dossier.json'), buildDossier(output, LIMITS));
console.log(`packed Port Solano into ${output}`);
