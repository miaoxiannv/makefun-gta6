// A session of Port Solano. Builds the city and everything in it, owns the player, the cars,
// the camera, the clock and the HUD, and runs it all: fixed-step simulation (walk, drive,
// pick up cash, get hurt, get patched up), then lighting for the hour, the HUD and the render.
import * as THREE from 'three';
import { CHASE_CAM, CLOCK, DRIVING, GRID, HOSPITAL, PLAYER_START, STEP, WALKER } from './config.js';
import { buildPlan, districtAt, streetAt } from './city/plan.js';
import { CityCollision } from './city/collision.js';
import { Buildings } from './city/buildings.js';
import { buildStreets } from './city/streets.js';
import { StreetProps } from './city/props.js';
import { Sky } from './world/sky.js';
import { Ocean } from './world/ocean.js';
import { CashDrops } from './world/cash-drops.js';
import { Garage } from './vehicles/garage.js';
import { Player } from './actors/player.js';
import { ChaseCamera } from './camera/chase-camera.js';
import { Hud } from './ui/hud.js';
import { Radar } from './ui/radar.js';
import { NO_CONTROLS, readControls } from './controls.js';

const FREE_ROAM = {
  title: 'Welcome to Port Solano',
  text: 'Fresh off the bus with $350 and no plan. Take any parked car with <kbd>E</kbd> and grab the <b class="cash">$</b> cash drops on the radar.',
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

    this.hud = new Hud();
    this.radar = new Radar(document.getElementById('minimap'), this.plan);

    // what the player and the cars ask of the world
    this.world = {
      resolveCircle: (p, r) => this.collision.resolveCircle(p, r),
      groundHeight: (x, z) => this.collision.groundHeight(x, z),
      pushOutOfCars: (p, r) => this.garage.pushOutOfCars(p, r),
    };
    this.state = { health: PLAYER_START.health, cash: PLAYER_START.cash, hour: CLOCK.start, wanted: 0, objective: FREE_ROAM };
    this.time = 0;
    this.carry = 0;
    this.frames = 0;
    this.mode = 'title';
    this.day = null;
    this.spawn();
  }

  /** A showcase line-up by the bus stop on Solano Blvd, then cars at the kerbs all over town. */
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

  /** Two spotlights that ride on whichever car the player is driving. */
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

  /** What the camera, radar and HUD follow: the player, or the car they drive. */
  focus() {
    const car = this.player.vehicle;
    if (car) return { position: car.position, heading: car.heading, inCar: true, speed: car.forwardSpeed };
    return { position: this.player.position, heading: this.player.heading, inCar: false, speed: 0 };
  }

  nearbyCar() {
    if (this.player.vehicle) return null;
    return this.garage.nearest(this.player.position.x, this.player.position.z, WALKER.reach);
  }

  enterCar(car) {
    car.driver = this.player;
    car.asleep = false;
    this.player.vehicle = car;
    this.player.object.visible = false;
    this.hud.toast(`You took the <b>${car.label}</b>`);
  }

  exitCar() {
    const car = this.player.vehicle;
    const s = Math.sin(car.heading);
    const c = Math.cos(car.heading);
    const reach = car.type.width / 2 + 0.75;
    // driver's door first (left of the nose), then the passenger side, then behind the car
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

  /** One fixed simulation step. */
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
    if (!driving) this.player.update(dt, controls, this.chase.yaw, this.world);
    this.garage.update(dt, this.world, driving, driving ? controls : null);
    if (driving) {
      this.player.position.copy(driving.position);
      this.player.heading = driving.heading;
      if (driving.lastImpact > DRIVING.hurtImpact) this.hurt((driving.lastImpact - DRIVING.hurtImpact) * 2.2);
      if (driving.lastImpact > 4) this.chase.shake = Math.min(1.4, this.chase.shake + driving.lastImpact * 0.06);
    }

    const at = this.focus().position;
    const found = this.cash.update(dt, this.time, at.x, at.z, driving ? 1.6 : 0);
    if (found) {
      this.state.cash += found;
      this.hud.toast(`<b class="cash">+$${found}</b> cash drop`);
    }
  }

  hurt(amount) {
    this.state.health -= amount;
    this.hud.hurt();
    if (this.state.health > 0) return;
    if (this.player.vehicle) this.exitCar();
    const fee = Math.min(this.state.cash, HOSPITAL.fee);
    this.state.cash -= fee;
    this.state.health = PLAYER_START.health;
    this.player.placeAt(HOSPITAL.x, HOSPITAL.z, Math.PI / 2, GRID.curb);
    this.chase.snap(this.focus(), Math.PI / 2, 0.25, this.collision);
    this.hud.toast(`Patched up at <b>${HOSPITAL.name}</b> · bill $${fee}`, 4);
  }

  /** A real frame of play: read input, run the fixed steps, move the camera, draw. */
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

  /** Step the simulation with scripted controls (the ?shot= autopilot). */
  simulate(seconds, controls) {
    const steps = Math.round(seconds / STEP);
    const still = { x: 0, y: 0, wheel: 0 };
    for (let k = 0; k < steps; k += 1) {
      const c = typeof controls === 'function' ? controls(k * STEP) : controls;
      this.step(STEP, { ...NO_CONTROLS, ...c });
      this.chase.update(STEP, this.focus(), still, c.turn ?? 0, this.collision);
    }
  }

  /** The slow aerial orbit behind the title screen. */
  attract(frameDt) {
    this.time += frameDt;
    const a = this.time * 0.025 + 2.6;
    this.camera.position.set(40 + Math.cos(a) * 300, 95, -20 + Math.sin(a) * 300);
    this.camera.lookAt(20, 25, -10);
    this.present(frameDt, false);
  }

  /** Light the scene for the hour, update the HUD and radar, render. */
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
      this.hud.update(dt, {
        ...this.state,
        street: streetAt(focus.position.x, focus.position.z),
        district: districtAt(focus.position.x, focus.position.z),
        vehicle: car,
        prompt,
      });
      this.radar.draw({ x: focus.position.x, z: focus.position.z, yaw: this.chase.yaw, heading: focus.heading, inCar: focus.inCar, cars: this.garage.cars, cash: this.cash.drops });
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

