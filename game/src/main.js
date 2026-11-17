// Entry point: creates the WebGL renderer and the game, wires the title and pause screens and
// runs the frame loop. With ?shot=<name> it instead stages a deterministic screenshot scene,
// draws it and raises window.__shotReady for the capture tool.
import * as THREE from 'three';
import { Game } from './game.js';
import { Input } from './core/input.js';
import { Screens } from './ui/screens.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') ?? 1) || 1;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(shot ? 1 : Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const game = new Game(renderer, { seed });
// compile every shader up front so the first drive does not hitch on a shader build
renderer.compile(game.scene, game.camera);
window.portSolano = game; // for poking at from the dev console

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  game.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

const input = new Input(canvas);

function setPaused(paused) {
  if (game.mode === 'title') return;
  game.mode = paused ? 'paused' : 'play';
  screens.showPause(paused);
}

const screens = new Screens({
  onStart() {
    if (game.mode !== 'title') return;
    game.mode = 'play';
    screens.showTitle(false);
    game.hud.show(true);
    game.spawn();
    game.hud.toast('Welcome to <b>Port Solano</b>', 3);
  },
  onResume: () => setPaused(false),
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') setPaused(game.mode === 'play');
});

if (shot) {
  const isTitle = stageShot(shot, game);
  game.mode = isTitle ? 'title' : 'play';
  screens.showTitle(isTitle);
  game.hud.show(!isTitle);
  document.getElementById('help').hidden = true;
  const draw = () => (isTitle ? game.attract(0) : game.present(0));
  draw();
  requestAnimationFrame(() => {
    draw();
    requestAnimationFrame(() => (window.__shotReady = true));
  });
} else {
  screens.showTitle(true);
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (game.mode === 'title') game.attract(dt);
    else if (game.mode === 'play') game.frame(dt, input);
    else game.present(0);
    input.endFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
