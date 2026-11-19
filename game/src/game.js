import * as THREE from 'three';
import { CHASE_CAM, CLOCK, COMBAT, DRIVING, ENEMIES, GRID, HOSPITAL, PLAYER_START, POLICE, STEP, WALKER } from './config.js';
import { Missions } from './story/missions.js';
import { Progression } from './story/progression.js';
import { clearSave, writeSave } from './story/save.js';
import { Hud } from './ui/hud.js';
import { Radar } from './ui/radar.js';
import { NO_CONTROLS, readControls } from './controls.js';
import { Sound } from './sound.js';
import { Effects } from './effects.js';
import { Player } from './actors/player.js';
import { Enemies } from './actors/enemies.js';
import { Police } from './actors/police.js';
import { Pedestrians } from './actors/pedestrians.js';
import { Traffic } from './vehicles/traffic.js';
import { Garage } from './vehicles/garage.js';
import { ChaseCamera } from './camera/chase-camera.js';
import { buildPlan, districtAt, streetAt } from './city/plan.js';
import { CityCollision } from './city/collision.js';
import { Buildings } from './city/buildings.js';
import { buildStreets } from './city/streets.js';
import { StreetProps } from './city/props.js';
import { Sky } from './world/sky.js';
import { Ocean } from './world/ocean.js';
import { CashDrops } from './world/cash-drops.js';

const FREE_ROAM = {
  title: 'Welcome to Port Solano',
  text: 'Fresh off the bus with $350 and no plan. Take any parked car with <kbd>E</kbd> — jacking one in front of Solano PD earns stars. Grab the <b class="cash">$</b> cash drops on the radar.',
};

export class Game {
  constructor(renderer, { seed = 1 } = {}) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CHASE_CAM.fov, 16 / 9, 0.25, 2400);

    this.plan = buildPlan(GRID.seed);
    this.collision = new CityCollision(this.plan);
    this.buildings = new Buildings(this.plan);
    this.props = new StreetProps(this.plan, this.collision);
    this.scene.add(buildStreets(this.plan), this.buildings.group, this.props.group);
    this.sky = new Sky(renderer, this.scene);
    this.ocean = new Ocean(this.scene);
    this.cash = new CashDrops(this.scene, this.plan.cash);

    this.garage = new Garage(this.scene);
    this.parkCars(seed);
    this.player = new Player();
    this.scene.add(this.player.object);
    this.chase = new ChaseCamera(this.camera);
    this.headlights = this.makeHeadlights();
    this.fx = new Effects(this.scene);
    this.sound = new Sound();
    this.exhaustAcc = 0;

    this.hud = new Hud();
    this.hud.onMute = () => this.toggleMute();
    this.hud.setMuted(this.sound.muted);
    this.radar = new Radar(document.getElementById('minimap'), this.plan);

    this.world = {
      resolveCircle: (p, r) => this.collision.resolveCircle(p, r),
      groundHeight: (x, z) => this.collision.groundHeight(x, z),
      pushOutOfCars: (p, r) => this.garage.pushOutOfCars(p, r),
    };
    this.state = { health: PLAYER_START.health, maxHealth: PLAYER_START.health, cash: PLAYER_START.cash, hour: CLOCK.start, wanted: 0, objective: FREE_ROAM };
    this.traffic = new Traffic(this.scene, this.garage, this.plan, seed, { x: PLAYER_START.x, z: PLAYER_START.z });
    this.pedestrians = new Pedestrians(this.scene, this.plan, seed);
    this.police = new Police(this.scene, this.garage, this.state, seed, (html, s) => this.hud.toast(html, s));
    this.enemies = new Enemies(this.scene);
    this.progression = new Progression();
    this.missions = new Missions(this.scene, this);
    this.busted = false;
    this.bustedFine = 0;
    this.hospitalized = false;
    this.time = 0;
    this.carry = 0;
    this.frames = 0;
    this.mode = 'title';
    this.day = null;
    this.spawn();
  }

  parkCars(seed) {
    const kerb = GRID.road / 2 - 1.6;
    this.starterCar = this.garage.add('coupe', '#e3342f', kerb, -30, Math.PI);
    this.garage.add('suv', '#f4f1ea', kerb, -50, Math.PI);
    this.garage.add('cab', null, -kerb, -22, 0);
    const clear = (s) => Math.hypot(s.x, s.z + 36) > 30;
    this.garage.parkAlongKerbs(this.plan.parking, seed * 7907 + 1, clear);
  }

  spawn() {
    const s = PLAYER_START;
    this.player.placeAt(s.x, s.z, s.heading, GRID.curb);
    this.chase.snap(this.focus(), s.heading + s.yaw, 0.2, this.collision);
  }

  applySave(save) {
    this.state.cash = save.cash;
    this.state.maxHealth = save.maxHealth;
    this.state.health = save.maxHealth;
    this.progression.applySave(save);
    this.missions.applySave(save);
    if (this.progression.has('coupe')) this.spawnCoupe();
  }

  saveProgress() {
    writeSave({
      cash: this.state.cash,
      maxHealth: this.state.maxHealth,
      ...this.missions.toSave(),
      ...this.progression.toSave(),
    });
  }

  resetProgress() {
    clearSave();
    if (this.progression.coupeCar) {
      this.garage.remove(this.progression.coupeCar);
      this.progression.coupeCar = null;
    }
    this.state.cash = PLAYER_START.cash;
    this.state.health = PLAYER_START.health;
    this.state.maxHealth = PLAYER_START.health;
    this.state.wanted = 0;
    this.progression.reset();
    this.missions.reset();
    this.police.clearAll();
    this.state.objective = FREE_ROAM;
  }

  spawnCoupe() {
    if (this.progression.coupeCar) return;
    const kerb = GRID.road / 2 - 1.6;
    const car = this.garage.add('coupe', '#f5c518', kerb, -70, Math.PI);
    this.progression.coupeCar = car;
  }

  resolvePunch() {
    const p = this.player;
    p.punch();
    const damage = this.progression.punchDamage;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    let hitAnyone = false;
    for (const enemy of this.enemies.alive) {
      const dx = enemy.position.x - p.position.x;
      const dz = enemy.position.z - p.position.z;
      const d = Math.hypot(dx, dz);
      if (d > COMBAT.range || d < 1e-6) continue;
      if ((dx * fx + dz * fz) / d < Math.cos(COMBAT.arc)) continue;
      hitAnyone = true;
      this.fx.burst(enemy.position.x, 1.2, enemy.position.z, '#ffd54a', 10, 4, 0.5);
      const ko = enemy.hit(damage, (dx / d) * COMBAT.knockback, (dz / d) * COMBAT.knockback);
      if (ko) {
        const prize = enemy.boss ? ENEMIES.bossCash : ENEMIES.koCash;
        this.progression.stats.knockouts += 1;
        this.state.cash += prize;
        this.fx.burst(enemy.position.x, 1.2, enemy.position.z, '#ff5c8a', 18, 6, 0.8);
        if (enemy.boss) this.hud.toast(`Boss down · <b class="cash">+$${prize}</b>`, 3);
      }
    }
    if (hitAnyone) this.sound.punch();
    if (!hitAnyone) {
      const down = this.pedestrians.hitByPunch(p.position.x, p.position.z, p.heading, COMBAT.range, COMBAT.arc);
      if (down > 0) {
        this.police.addHeat(COMBAT.pedHeat);
        this.sound.punch();
        this.fx.burst(p.position.x + fx * 1.6, 1.2, p.position.z + fz * 1.6, '#ffd54a', 10, 4, 0.5);
        this.hud.toast('You decked a bystander — wanted up');
      }
    }
  }

  makeHeadlights() {
    const rig = new THREE.Group();
    for (const side of [-1, 1]) {
      const light = new THREE.SpotLight('#fff1d0', 0, 70, 0.52, 0.5, 1.1);
      light.position.set(side * 0.7, 0.75, 2.2);
      light.target.position.set(side * 1.2, 0, 24);
      rig.add(light, light.target);
    }
    this.scene.add(rig);
    return rig;
  }

  focus() {
    const car = this.player.vehicle;
    if (car) return { position: car.position, heading: car.heading, inCar: true, speed: car.forwardSpeed };
    return { position: this.player.position, heading: this.player.heading, inCar: false, speed: 0 };
  }

  foeInReach() {
    const p = this.player.position;
    const reach = COMBAT.range + 0.6;
    for (const e of this.enemies.alive) {
      if (Math.hypot(e.position.x - p.x, e.position.z - p.z) < reach) return true;
    }
    for (const ped of this.pedestrians.list) {
      if (ped.state !== 'down' && Math.hypot(ped.position.x - p.x, ped.position.z - p.z) < reach) return true;
    }
    return false;
  }

  nearbyCar() {
    if (this.player.vehicle) return null;
    return this.garage.nearest(this.player.position.x, this.player.position.z, WALKER.reach);
  }

  enterCar(car) {
    if (car.ai === 'traffic') {
      
      this.traffic.release(car);
      this.police.addHeat(1);
      this.hud.toast(`You jacked the <b>${car.label}</b> — the cops noticed`);
    } else if (car.ai === 'police') {
      this.police.release(car);
      this.police.addHeat(2);
      this.hud.toast(`You jacked a <b>Solano PD cruiser</b> — big mistake`);
    } else {
      
      const seen = this.police.cars.some((e) => Math.hypot(e.car.position.x - car.position.x, e.car.position.z - car.position.z) < 50);
      if (seen) {
        this.police.addHeat(1);
        this.hud.toast(`You took the <b>${car.label}</b> — Solano PD saw that`);
      } else {
        this.hud.toast(`You took the <b>${car.label}</b>`);
      }
    }
    car.driver = this.player;
    car.asleep = false;
    this.player.vehicle = car;
    this.player.object.visible = false;
  }

  exitCar() {
    const car = this.player.vehicle;
    const s = Math.sin(car.heading);
    const c = Math.cos(car.heading);
    const reach = car.type.width / 2 + 0.75;
    
    const options = [
      { x: car.position.x + c * reach, z: car.position.z - s * reach },
      { x: car.position.x - c * reach, z: car.position.z + s * reach },
      { x: car.position.x - s * (car.type.length / 2 + 1), z: car.position.z - c * (car.type.length / 2 + 1) },
    ];
    const free = options.find((p) => !this.collision.resolveCircle({ ...p }, WALKER.radius)) ?? options[2];
    car.driver = null;
    this.player.vehicle = null;
    this.player.object.visible = true;
    this.player.placeAt(free.x, free.z, car.heading, this.collision.groundHeight(free.x, free.z));
  }

  toggleMute() {
    this.hud.setMuted(this.sound.toggle());
  }

  step(dt, controls) {
    this.time += dt;
    this.state.hour = (this.state.hour + (dt * CLOCK.rate) / 60) % 24;

    if (controls.interact) {
      const car = this.player.vehicle;
      if (car && Math.abs(car.forwardSpeed) < DRIVING.exitSpeed) this.exitCar();
      else if (!car) {
        const near = this.nearbyCar();
        if (near) this.enterCar(near);
      }
    }

    const driving = this.player.vehicle;
    if (controls.attack && !driving && this.player.attackCooldown <= 0) this.resolvePunch();
    if (!driving) {
      this.player.update(dt, controls, this.chase.yaw, this.world);
      this.pedestrians.pushOut(this.player.position, WALKER.radius);
      this.enemies.pushOut(this.player.position, WALKER.radius);
    }
    this.pedestrians.update(dt, this.time, this.world, this.garage.cars, this.player, () => {
      this.police.addHeat(1);
      this.hud.toast('You ran someone over — wanted up');
    });
    this.traffic.update(dt, this.world, this.pedestrians, this.player);
    this.garage.update(dt, this.world, driving, driving ? controls : null);
    this.police.update(dt, this.world, this.focus(), this.player);
    this.enemies.update(dt, this.time, this.world, this.player, (dmg) => this.hurt(dmg));
    this.missions.update(dt);
    if (this.police.bustReady) this.enterBusted();
    if (driving) {
      this.player.position.copy(driving.position);
      this.player.heading = driving.heading;
      if (driving.lastImpact > DRIVING.hurtImpact) this.hurt((driving.lastImpact - DRIVING.hurtImpact) * 2.2);
      if (driving.lastImpact > 4) {
        this.chase.shake = Math.min(1.4, this.chase.shake + driving.lastImpact * 0.06);
        this.sound.thud(driving.lastImpact / 8);
        this.fx.burst(driving.position.x, 0.8, driving.position.z, '#ff9a3c', 14, 5, 0.6);
      }
      if (controls.handbrake && Math.abs(driving.forwardSpeed) > 8) this.fx.skid(driving.position.x, driving.position.z, driving.heading, dt);
      this.exhaustAcc += dt;
      if (controls.throttle && this.exhaustAcc > 0.09) {
        this.exhaustAcc = 0;
        const s = Math.sin(driving.heading), c = Math.cos(driving.heading);
        this.fx.puff(driving.position.x - s * 2.2, 0.5, driving.position.z - c * 2.2);
      }
    }
    this.sound.update(dt, driving ? driving.forwardSpeed : 0, !!driving, this.state.wanted);

    const at = this.focus().position;
    const found = this.cash.update(dt, this.time, at.x, at.z, driving ? 1.6 : 0);
    if (found) {
      this.state.cash += found;
      this.fx.burst(at.x, 1, at.z, '#7dff9b', 10, 3, 0.5);
      this.sound.coin();
      this.hud.toast(`<b class="cash">+$${found}</b> cash drop`);
    }
  }

  hurt(amount) {
    this.state.health -= amount;
    this.hud.hurt();
    this.sound.thud(0.7);
    this.chase.shake = Math.min(1, this.chase.shake + 0.25);
    if (this.state.health > 0) return;
    if (this.player.vehicle) this.exitCar();
    const fee = Math.min(this.state.cash, HOSPITAL.fee);
    this.state.cash -= fee;
    this.state.health = this.state.maxHealth;
    this.hospitalized = true; 
    this.player.placeAt(HOSPITAL.x, HOSPITAL.z, Math.PI / 2, GRID.curb);
    this.chase.snap(this.focus(), Math.PI / 2, 0.25, this.collision);
    this.hud.toast(`Patched up at <b>${HOSPITAL.name}</b> · bill $${fee}`, 4);
  }

  enterBusted() {
    if (this.busted) return;
    this.busted = true;
    this.police.bustReady = false;
    this.mode = 'busted';
    this.missions.fail('busted');
    this.bustedFine = Math.min(this.state.cash, POLICE.bustFine);
    this.chase.shake = 1.4;
    this.sound.bust();
    this.screens?.showBusted(true, this.bustedFine);
    this.hud.show(false);
  }

  releaseBusted() {
    if (!this.busted) return;
    this.busted = false;
    this.mode = 'play';
    this.state.cash -= this.bustedFine;
    this.state.wanted = 0;
    this.police.clearAll();
    if (this.player.vehicle) this.exitCar();
    this.state.health = this.state.maxHealth;
    this.player.placeAt(HOSPITAL.x, HOSPITAL.z, Math.PI / 2, GRID.curb);
    this.chase.snap(this.focus(), Math.PI / 2, 0.25, this.collision);
    this.screens?.showBusted(false);
    this.hud.show(true);
    this.hud.toast(`Solano PD let you go · bail $${this.bustedFine}`, 4);
  }

  frame(frameDt, input) {
    const dt = Math.min(frameDt, 0.1);
    this.frames += 1;
    if (input.take('KeyH')) this.hud.toggleHelp();
    const near = this.nearbyCar();
    const controls = readControls(input, { nearCar: !!near, inCar: !!this.player.vehicle });
    this.carry += dt;
    let first = true;
    while (this.carry >= STEP) {
      this.step(STEP, first ? controls : { ...controls, interact: false, jump: false });
      first = false;
      this.carry -= STEP;
    }
    this.chase.update(dt, this.focus(), input.takeLook(), controls.turn, this.collision);
    this.present(dt);
  }

  simulate(seconds, controls) {
    const steps = Math.round(seconds / STEP);
    const still = { x: 0, y: 0, wheel: 0 };
    for (let k = 0; k < steps; k += 1) {
      const c = typeof controls === 'function' ? controls(k * STEP) : controls;
      this.step(STEP, { ...NO_CONTROLS, ...c });
      this.chase.update(STEP, this.focus(), still, c.turn ?? 0, this.collision);
    }
  }

  attract(frameDt) {
    this.time += frameDt;
    const a = this.time * 0.025 + 2.6;
    this.camera.position.set(40 + Math.cos(a) * 300, 95, -20 + Math.sin(a) * 300);
    this.camera.lookAt(20, 25, -10);
    this.present(frameDt, false);
  }

  present(dt, withHud = true) {
    const focus = this.focus();
    this.day = this.sky.update(this.state.hour, focus.position, this.camera.position);
    const night = this.day.night;
    this.buildings.update(night, this.time);
    this.props.update(night);
    this.ocean.update(this.time, this.day);
    this.garage.setLights(night);
    this.renderer.toneMappingExposure = 1.0 - night * 0.1;

    const car = this.player.vehicle;
    for (const light of this.headlights.children) if (light.isSpotLight) light.intensity = car ? 30 + 90 * night : 0;
    if (car) {
      this.headlights.position.copy(car.position);
      this.headlights.rotation.y = car.heading;
    }

    if (withHud) {
      const near = this.nearbyCar();
      let prompt = null;
      if (car && Math.abs(car.forwardSpeed) < DRIVING.exitSpeed) prompt = '<kbd>E</kbd> Get out';
      else if (near) prompt = `<kbd>E</kbd> Steal the ${near.label}`;
      else if (!car && this.foeInReach()) prompt = '<kbd>F</kbd> Punch';
      this.state.objective = this.missions.objective() ?? FREE_ROAM;
      this.hud.update(dt, {
        ...this.state,
        street: streetAt(focus.position.x, focus.position.z),
        district: districtAt(focus.position.x, focus.position.z),
        vehicle: car,
        prompt,
      });
      this.radar.draw({ x: focus.position.x, z: focus.position.z, yaw: this.chase.yaw, heading: focus.heading, inCar: focus.inCar, cars: this.garage.cars.filter((c) => c.ai !== 'police'), cash: this.cash.drops, police: this.police.cars.map((e) => e.car), mission: this.missions.currentTarget(), enemies: this.enemies.alive, time: this.time });
    }
    for (const car of this.garage.cars) if (car.typeName === 'police') car.flashLights(this.time);
    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
