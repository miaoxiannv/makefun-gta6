// The game session: builds Port Solano, owns the player, cars, camera, HUD and clock, turns
// keyboard and mouse into controls, runs the fixed-step simulation and renders each frame.
import * as THREE from 'three';
import { CITY, CLOCK, PLAYER, START, STEP } from './config.js';
import { buildCityLayout, districtAt, streetAt } from './city/layout.js';
import { CityColliders } from './city/colliders.js';
import { BuildingSet } from './city/buildings.js';
import { buildStreets } from './city/streets.js';
import { StreetProps } from './city/street-props.js';
import { Sky } from './world/sky.js';
import { Coast } from './world/coast.js';
import { SkyEnvironment } from './world/environment.js';
import { CashDrops } from './world/cash-drops.js';
import { Fleet } from './vehicles/fleet.js';
import { Player } from './actors/player.js';
import { FollowCamera } from './camera/follow-camera.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';

/** Where a new game starts: the sidewalk on Solano Blvd, downtown, by a parked sports car. */
export const SPAWN = { x: 10.5, z: -40, heading: -Math.PI / 2, cameraYaw: Math.PI / 2 + 0.5 };
const HOSPITAL = { x: -90, z: 10 };

const FREE_ROAM = {
  title: 'Free roam',
  text: 'Explore Port Solano. Grab the green $ cash drops on the radar, and take any parked car with E.',
};

export const IDLE_CONTROLS = Object.freeze({ moveX: 0, moveY: 0, run: false, jump: false, throttle: 0, brake: 0, steer: 0, handbrake: false, interact: false, turn: 0 });

export class Game {
  constructor(renderer, { seed = 1 } = {}) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.2, 2200);
    this.layout = buildCityLayout(CITY.seed);
    this.colliders = new CityColliders(this.layout);

    this.buildings = new BuildingSet(this.layout);
    this.props = new StreetProps(this.layout);
    this.scene.add(buildStreets(this.layout), this.buildings.group, this.props.group);
    this.sky = new Sky(this.scene);
    this.coast = new Coast(this.scene);
    this.environment = new SkyEnvironment(renderer, this.scene);
    this.scene.environmentIntensity = 0.7;
    this.cash = new CashDrops(this.scene, this.layout.cashSpots);

    this.fleet = new Fleet(this.scene);
    this.parkCars(seed);
    this.player = new Player();
    this.scene.add(this.player.model);
    this.followCamera = new FollowCamera(this.camera);
    this.makeHeadlights();

    this.hud = new Hud();
    this.minimap = new Minimap(document.getElementById('minimap'), this.layout);

    this.world = {
      resolveCircle: (point, radius) => this.colliders.resolveCircle(point, radius),
      groundHeight: (x, z) => this.colliders.groundHeight(x, z),
      pushOutOfCars: (point, radius) => this.fleet.pushOutOfCars(point, radius),
    };
    this.state = { health: START.health, money: START.money, hour: CLOCK.startHour, wanted: 0, objective: FREE_ROAM };
    this.time = 0;
    this.accumulator = 0;
    this.mode = 'title';
    this.eLocked = false;
    this.lighting = null;
    this.spawnPlayer();
  }

  /** The showcase cars by the spawn point, then the kerbside cars everywhere else. */
  parkCars(seed) {
    this.starterCar = this.fleet.add('sports', '#e8443a', 6.6, -34, 0);
    this.fleet.add('suv', '#f7f4ee', 6.6, -52, 0);
    this.fleet.add('taxi', null, -6.6, -24, Math.PI);
    const clear = (spot) => Math.hypot(spot.x - 0, spot.z + 40) > 26;
    this.fleet.parkAlongKerbs({ parking: this.layout.parking.filter(clear) }, seed * 7919 + 3);
  }

  spawnPlayer() {
    this.player.placeAt(SPAWN.x, SPAWN.z, SPAWN.heading, CITY.curb);
    this.followCamera.snap(this.focus(), SPAWN.cameraYaw, 0.24);
  }

  makeHeadlights() {
    this.headlights = [-1, 1].map(() => {
      const light = new THREE.SpotLight('#fff1cf', 0, 60, 0.5, 0.45, 1.2);
      light.castShadow = false;
      return light;
    });
  }

  /** The thing the camera, radar and HUD follow: the player or the car they drive. */
  focus() {
    const car = this.player.vehicle;
    if (car) return { position: car.position, heading: car.heading, inCar: true, speed: car.forwardSpeed };
    return { position: this.player.position, heading: this.player.heading, inCar: false, speed: 0 };
  }

  /** Turn held keys into this frame's controls. */
  readControls(input) {
    const moveY = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const moveX = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const interact = input.consume('KeyE') || input.consume('KeyF');
    if (interact) this.eLocked = true;
    if (!input.isHeld('KeyE')) this.eLocked = false;
    const nearCar = !this.player.vehicle && this.fleet.nearest(this.player.position.x, this.player.position.z, PLAYER.enterRange);
    const turnRight = input.isHeld('KeyE') && !this.eLocked && !nearCar;
    return {
      moveX,
      moveY,
      run: input.isHeld('ShiftLeft', 'ShiftRight'),
      jump: input.consume('Space'),
      throttle: moveY > 0 ? 1 : 0,
      brake: moveY < 0 ? 1 : 0,
      steer: -moveX,
      handbrake: input.isHeld('Space'),
      interact,
      turn: (turnRight ? 1 : 0) - (input.isHeld('KeyQ') ? 1 : 0),
    };
  }

  enterCar(car) {
    car.driver = this.player;
    car.asleep = false;
    this.player.vehicle = car;
    this.player.model.visible = false;
    for (const [index, light] of this.headlights.entries()) {
      light.position.set((index ? 1 : -1) * car.type.width * 0.33, 0.7, car.type.length / 2);
      light.target.position.set((index ? 1 : -1) * 1.5, 0, car.type.length / 2 + 20);
      car.model.add(light, light.target);
    }
    this.hud.toast(`You took the <b>${car.label}</b>`);
  }

  exitCar() {
    const car = this.player.vehicle;
    const acrossX = Math.cos(car.heading);
    const acrossZ = -Math.sin(car.heading);
    const reach = car.type.width / 2 + 0.7;
    let spot = null;
    for (const side of [1, -1]) {
      const p = { x: car.position.x + acrossX * reach * side, z: car.position.z + acrossZ * reach * side };
      const push = this.colliders.resolveCircle({ ...p }, PLAYER.radius);
      if (Math.hypot(push.x, push.z) < 0.05) { spot = p; break; }
    }
    spot ??= { x: car.position.x + Math.sin(car.heading) * (car.type.length / 2 + 1), z: car.position.z + Math.cos(car.heading) * (car.type.length / 2 + 1) };
    car.driver = null;
    for (const light of this.headlights) car.model.remove(light, light.target);
    this.player.vehicle = null;
    this.player.model.visible = true;
    this.player.placeAt(spot.x, spot.z, car.heading, this.colliders.groundHeight(spot.x, spot.z));
    this.followCamera.yaw = car.heading + Math.PI;
  }

  /** One fixed simulation step with the given controls. */
  step(dt, controls) {
    this.time += dt;
    this.state.hour = (this.state.hour + (dt * CLOCK.minutesPerSecond) / 60) % 24;
    const car = this.player.vehicle;

    if (controls.interact) {
      if (car) {
        if (Math.abs(car.forwardSpeed) < 6) this.exitCar();
      } else {
        const target = this.fleet.nearest(this.player.position.x, this.player.position.z, PLAYER.enterRange);
        if (target) this.enterCar(target);
      }
    }

    const driving = this.player.vehicle;
    if (!driving) this.player.update(dt, controls, this.followCamera.yaw, this.world);
    this.fleet.update(dt, this.world, driving, driving ? controls : null);
    if (driving) {
      this.player.position.copy(driving.position);
      this.player.heading = driving.heading;
      if (driving.lastImpact > 9) this.hurt((driving.lastImpact - 9) * 2.4);
    }

    const at = this.focus().position;
    const found = this.cash.update(dt, this.time, at.x, at.z, driving ? 1.5 : 0);
    if (found > 0) {
      this.state.money += found;
      this.hud.toast(`<b class="cash">+$${found}</b> cash drop`);
    }
  }

  hurt(amount) {
    this.state.health -= amount;
    this.hud.damageFlash();
    this.followCamera.shake = Math.min(1.5, this.followCamera.shake + amount * 0.08);
    if (this.state.health > 0) return;
    if (this.player.vehicle) this.exitCar();
    this.state.health = START.health;
    const bill = Math.min(this.state.money, 100);
    this.state.money -= bill;
    this.player.placeAt(HOSPITAL.x, HOSPITAL.z, 0, CITY.curb);
    this.followCamera.snap(this.focus(), Math.PI);
    this.hud.toast(`<b>Patched up</b> at Solano General · hospital bill $${bill}`, 4);
  }

  /** Run as many fixed steps as `frameDt` covers, then move the camera and draw. */
  frame(frameDt, input) {
    const dt = Math.min(frameDt, 0.1);
    if (input.consume('KeyH')) this.hud.toggleHelp();
    const controls = this.readControls(input);
    this.accumulator += dt;
    let first = true;
    while (this.accumulator >= STEP) {
      this.step(STEP, first ? controls : { ...controls, interact: false, jump: false });
      first = false;
      this.accumulator -= STEP;
    }
    this.followCamera.update(dt, this.focus(), input.takeMouse(), controls.turn, this.colliders);
    this.present(dt);
  }

  /** Slow aerial orbit over downtown behind the title screen. */
  attract(frameDt) {
    this.time += frameDt;
    const angle = this.time * 0.03 + 0.2;
    this.camera.position.set(60 + Math.cos(angle) * 330, 105, Math.sin(angle) * 330);
    this.camera.lookAt(-10, 20, -20);
    this.present(frameDt, false);
  }

  /** Lighting, HUD, radar and the render itself. */
  present(dt, withHud = true) {
    const focus = this.focus();
    this.lighting = this.sky.update(this.state.hour, focus.position, this.camera.position);
    this.environment.update(this.state.hour, this.lighting);
    const night = this.lighting.night;
    this.buildings.setNight(night);
    this.props.setNight(night);
    this.coast.update(this.time, this.lighting, this.scene.fog);
    for (const light of this.headlights) light.intensity = 40 * Math.max(0.15, night);
    this.renderer.toneMappingExposure = 1.05 - night * 0.15;

    if (withHud) {
      const near = !this.player.vehicle && this.fleet.nearest(this.player.position.x, this.player.position.z, PLAYER.enterRange);
      const prompt = this.player.vehicle
        ? (Math.abs(this.player.vehicle.forwardSpeed) < 6 ? '<kbd>E</kbd> Get out' : null)
        : near ? `<kbd>E</kbd> Take the ${near.label}` : null;
      this.hud.update(dt, {
        ...this.state,
        street: streetAt(focus.position.x, focus.position.z),
        district: districtAt(focus.position.x, focus.position.z),
        vehicle: this.player.vehicle,
        prompt,
      });
      this.minimap.draw({
        x: focus.position.x,
        z: focus.position.z,
        yaw: this.followCamera.yaw,
        heading: focus.heading,
        inCar: focus.inCar,
        cars: this.fleet.cars,
        cash: this.cash.drops,
      });
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

