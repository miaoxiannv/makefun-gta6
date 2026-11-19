import * as THREE from 'three';
import { MISSION_UNLOCK, UNLOCKS } from './progression.js';

export const MISSIONS = [
  {
    id: 'm1', name: 'First Wheels', reward: 400,
    brief: 'Marla needs wheels. Take a car — the red Vela GT by the bus stop will do — and drop it at Marina Green.',
    start: { x: 12.5, z: -36, heading: Math.PI },
    stages: [
      { type: 'car', text: 'Get in a car — the red Vela GT by the bus stop is the one Marla wants' },
      { type: 'drive', x: 240, z: 160, text: 'Drive to the Marina Green drop-off' },
    ],
  },
  {
    id: 'm2', name: 'Getaway', reward: 700,
    brief: 'The drop went sideways and Solano PD is on you. Two stars, one clock — get to Little Brisa.',
    start: { x: 240, z: 160, heading: Math.PI },
    stages: [
      { type: 'timed', x: -240, z: -240, limit: 75, text: 'Reach Little Brisa before the clock runs out' },
    ],
  },
  {
    id: 'm3', name: 'The Drop', reward: 900,
    brief: 'A package is waiting on a Dockside corner. Pick it up, and expect company — the crew that lost it wants it back.',
    start: { x: -280, z: 200, heading: Math.PI / 2 },
    stages: [
      { type: 'go', x: -240, z: 240, text: 'Pick up the package on the Dockside corner' },
      { type: 'fight', count: 3, x: -240, z: 240, text: 'The crew jumped you — fight them off' },
      { type: 'go', x: 0, z: -240, text: 'Deliver the package to Coral Row' },
    ],
  },
  {
    id: 'm4', name: 'Payback', reward: 1200,
    brief: 'One last job. The warehouse crew set you up — clear them out, boss included, and drive home to the garage.',
    start: { x: -200, z: 200, heading: Math.PI / 2 },
    stages: [
      { type: 'fight', count: 5, boss: true, x: -160, z: 240, text: 'Clear the warehouse crew out — including their boss' },
      { type: 'drive', x: -320, z: -320, text: 'Get in a car and reach the Solano Sun Garage' },
    ],
  },
];

const FAIL_TEXT = {
  busted: 'Solano PD took you in mid-job — the job fell through.',
  hospital: 'You woke up at Solano Mercy — the job fell through.',
  time: 'The clock ran out — the job fell through.',
};

export class Missions {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.completed = [];
    this.active = null; 
    this.marker = this.makeMarker();
    this.scene.add(this.marker.group);
    this.marker.group.visible = false;
  }

  makeMarker() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.position.y = 0.35;
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    );
    beacon.position.y = 13;
    group.add(ring, beacon);
    return { group, ring, beacon };
  }

  def(id) {
    return MISSIONS.find((m) => m.id === id);
  }

  indexOf(id) {
    return MISSIONS.findIndex((m) => m.id === id);
  }

  isUnlocked(id) {
    const i = this.indexOf(id);
    return i === 0 || this.completed.includes(MISSIONS[i - 1].id);
  }

  isComplete(id) {
    return this.completed.includes(id);
  }

  currentTarget() {
    if (!this.active) return null;
    const s = this.active.stage;
    return s.x !== undefined ? { x: s.x, z: s.z } : null;
  }

  start(id) {
    const def = this.def(id);
    if (!def || !this.isUnlocked(id)) return false;
    const game = this.game;
    game.enemies.clearAll();
    if (game.player.vehicle) game.exitCar();
    game.player.placeAt(def.start.x, def.start.z, def.start.heading, game.collision.groundHeight(def.start.x, def.start.z));
    game.chase.snap(game.focus(), def.start.heading, 0.2, game.collision);
    this.active = { def, index: 0, stage: def.stages[0], timer: 0 };
    
    if (id === 'm2') {
      const car = game.garage.add('sedan', '#2f4b7c', def.start.x + 6, def.start.z + 2, def.start.heading);
      car.asleep = false;
      game.enterCar(car);
      game.police.addHeat(2);
    }
    this.enterStage();
    game.hud.toast(`<b>${def.name}</b> — ${def.stages[0].text}`, 5);
    return true;
  }

  enterStage() {
    const stage = this.active.stage;
    if (stage.type === 'timed') this.active.timer = stage.limit;
    if (stage.type === 'fight') {
      this.game.enemies.spawn(stage.count, stage.x, stage.z, { boss: !!stage.boss });
    }
    if (stage.type === 'drive') this.ensureCarNearby();
    if (stage.x !== undefined) {
      this.marker.group.position.set(stage.x, this.game.collision.groundHeight(stage.x, stage.z), stage.z);
      this.marker.group.visible = true;
    } else {
      this.marker.group.visible = false;
    }
  }

  ensureCarNearby() {
    const game = this.game;
    const p = game.player.position;
    if (game.garage.nearest(p.x, p.z, 40)) return;
    const spot = { x: p.x + 12, z: p.z + 6 };
    game.collision.resolveCircle(spot, 2);
    const car = game.garage.add('coupe', '#f5c518', spot.x, spot.z, game.player.heading);
    car.asleep = false;
  }

  advance() {
    this.active.index += 1;
    if (this.active.index >= this.active.def.stages.length) {
      this.complete();
      return;
    }
    this.active.stage = this.active.def.stages[this.active.index];
    this.enterStage();
  }

  complete() {
    const game = this.game;
    const def = this.active.def;
    game.state.cash += def.reward;
    game.progression.stats.earned += def.reward;
    game.progression.stats.missionsDone += 1;
    this.completed.push(def.id);
    const unlock = MISSION_UNLOCK[def.id];
    game.progression.earn(unlock);
    this.applyUnlock(unlock);
    this.active = null;
    this.marker.group.visible = false;
    game.enemies.clearAll();
    game.sound.win();
    game.hud.missionCard(`<b>${def.name} complete</b><span>+$${def.reward} · unlocked: <b>${UNLOCKS[unlock].name}</b></span>`, 4.5);
    game.hud.toast(`<b>${def.name} complete</b> · <b class="cash">+$${def.reward}</b>`, 5);
    game.saveProgress();
  }

  applyUnlock(id) {
    const game = this.game;
    if (id === 'jacket') {
      game.state.maxHealth = 150;
      game.state.health = 150;
      game.hud.toast('Unlocked: <b>Armored jacket</b> — max health 150', 4);
    } else if (id === 'knuckles') {
      game.hud.toast('Unlocked: <b>Knuckle dusters</b> — punches hit for 25', 4);
    } else if (id === 'coupe') {
      game.spawnCoupe();
      game.hud.toast('Unlocked: <b>Getaway coupe</b> — a yellow Vela GT of your own by the bus stop', 4);
    } else if (id === 'safehouse') {
      game.hud.toast('Unlocked: <b>Solano Sun Garage</b> — Port Solano is yours now', 5);
    }
  }

  fail(reason) {
    if (!this.active) return;
    const name = this.active.def.name;
    this.active = null;
    this.marker.group.visible = false;
    this.game.enemies.clearAll();
    this.game.sound.fail();
    this.game.hud.missionCard(`<b>${name} failed</b><span>${FAIL_TEXT[reason] ?? 'The job fell through.'}</span>`, 4);
    this.game.hud.toast(FAIL_TEXT[reason] ?? 'The job fell through.', 4);
  }

  objective() {
    if (!this.active) return null;
    const { def, stage, timer } = this.active;
    const n = this.indexOf(def.id) + 1;
    let text = stage.text;
    if (stage.type === 'timed') text += ` — ${Math.max(0, Math.ceil(timer))}s left`;
    if (stage.type === 'fight') {
      const left = this.game.enemies.alive.length;
      text += ` — ${left} left`;
    }
    return { title: `Job ${n} of ${MISSIONS.length} · ${def.name}`, text: `${text} · <b class="cash">$${def.reward}</b>` };
  }

  update(dt) {
    
    if (this.marker.group.visible) {
      const t = this.game.time;
      const s = 1 + Math.sin(t * 3) * 0.08;
      this.marker.ring.scale.set(s, 1, s);
      this.marker.beacon.material.opacity = 0.12 + Math.sin(t * 3) * 0.05;
    }
    if (!this.active) return;
    const game = this.game;
    if (game.hospitalized) {
      game.hospitalized = false;
      this.fail('hospital');
      return;
    }
    const stage = this.active.stage;
    const p = game.player.position;
    const dist = (x, z) => Math.hypot(p.x - x, p.z - z);
    switch (stage.type) {
      case 'car':
        if (game.player.vehicle) this.advance();
        break;
      case 'go':
        if (dist(stage.x, stage.z) < 8) this.advance();
        break;
      case 'drive':
        if (game.player.vehicle && dist(stage.x, stage.z) < 10) this.advance();
        break;
      case 'timed':
        this.active.timer -= dt;
        if (dist(stage.x, stage.z) < 10) this.advance();
        else if (this.active.timer <= 0) this.fail('time');
        break;
      case 'fight':
        if (game.enemies.alive.length === 0) this.advance();
        break;
      default:
        break;
    }
  }

  reset() {
    this.active = null;
    this.completed = [];
    this.marker.group.visible = false;
    this.game.enemies.clearAll();
  }

  toSave() {
    return { missions: [...this.completed] };
  }

  applySave(save) {
    this.completed = [...save.missions];
    for (const id of this.completed) this.game.progression.earn(MISSION_UNLOCK[id]);
  }
}