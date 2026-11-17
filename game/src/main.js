// Entry point: sets up the WebGL renderer, the game session, menus and the frame loop, or
// stages a deterministic ?shot= scene for screenshots.
import * as THREE from 'three';
import { Game } from './game.js';
import { Input } from './core/input.js';
import { Menus } from './ui/menus.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') ?? 1) || 1;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, shot ? 1 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const game = new Game(renderer, { seed });
window.portSolano = game; // handy from the dev console

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  game.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

const input = new Input(canvas);
const menus = new Menus({
  onStart: () => {
    if (game.mode !== 'title') return;
    game.mode = 'play';
    menus.showTitle(false);
    game.hud.show(true);
    game.spawnPlayer();
    game.hud.toast('Welcome to <b>Port Solano</b>', 3);
  },
  onResume: () => setPaused(false),
});

function setPaused(paused) {
  if (game.mode === 'title') return;
  game.mode = paused ? 'paused' : 'play';
  menus.showPause(paused);
}
window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' || event.code === 'KeyP') setPaused(game.mode === 'play');
});

if (shot) {
  const showTitle = stageShot(shot, game);
  menus.showTitle(showTitle);
  game.hud.show(!showTitle);
  game.mode = showTitle ? 'title' : 'play';
  const draw = () => (showTitle ? game.attract(0) : game.present(0));
  draw();
  requestAnimationFrame(() => {
    draw();
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
} else {
  menus.showTitle(true);
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
