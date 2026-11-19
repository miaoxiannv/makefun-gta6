import * as THREE from 'three';
import { Input } from './core/input.js';
import { Screens } from './ui/screens.js';
import { stageShot } from './shots.js';
import { Game } from './game.js';
import { MISSIONS } from './story/missions.js';
import { clearSave, loadSave } from './story/save.js';

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

renderer.compile(game.scene, game.camera);
window.portSolano = game;
window.addEventListener('keydown', () => game.sound.ensure());
window.addEventListener('pointerdown', () => game.sound.ensure());

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  game.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

const input = new Input(canvas);

function missionListData() {
  return {
    list: MISSIONS.map((m) => ({
      id: m.id,
      name: m.name,
      reward: m.reward,
      state: game.missions.isComplete(m.id) ? 'done' : game.missions.isUnlocked(m.id) ? 'open' : 'locked',
    })),
    completed: game.missions.completed.length,
    total: MISSIONS.length,
    earned: game.progression.stats.earned,
    knockouts: game.progression.stats.knockouts,
  };
}

function enterGame() {
  game.mode = 'play';
  screens.showTitle(false);
  game.hud.show(true);
}

function setPaused(paused) {
  if (game.mode === 'title' || game.mode === 'busted') return;
  game.mode = paused ? 'paused' : 'play';
  if (paused) {
    screens.renderStats({
      missionsDone: game.missions.completed.length,
      total: MISSIONS.length,
      earned: game.progression.stats.earned,
      knockouts: game.progression.stats.knockouts,
      unlocks: game.progression.earnedNames(),
    });
  }
  screens.showPause(paused);
}

const save = loadSave();

if (save && !shot) game.applySave(save);
const screens = new Screens({
  onStart() {
    if (game.mode !== 'title') return;
    enterGame();
    game.spawn();
    game.hud.toast('Welcome to <b>Port Solano</b>', 3);
  },
  onContinue() {
    if (game.mode !== 'title') return;
    if (save) game.applySave(save);
    enterGame();
    game.spawn();
    game.hud.toast('Welcome back to <b>Port Solano</b>', 3);
  },
  onNewGame() {
    if (game.mode !== 'title') return;
    clearSave();
    game.resetProgress();
    enterGame();
    game.spawn();
    game.hud.toast('Welcome to <b>Port Solano</b>', 3);
  },
  onMission(id) {
    if (game.mode !== 'title') return;
    if (save) game.applySave(save);
    enterGame();
    if (!game.missions.start(id)) {
      game.mode = 'title';
      screens.showTitle(true);
      game.hud.show(false);
    }
  },
  onResume: () => setPaused(false),
  onBusted: () => game.releaseBusted(),
  onReset() {
    game.resetProgress();
    location.reload();
  },
});
game.screens = screens;
screens.renderTitle(save, missionListData());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') setPaused(game.mode === 'play');
  else if (e.code === 'KeyM') game.toggleMute();
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