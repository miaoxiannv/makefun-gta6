// The self-driving cars of Port Solano: they follow the road network in the right-hand
// lane, pick a new street at every intersection, brake for the car or pedestrian ahead,
// and keep the city alive around the player (cars that end up far away are moved to a road
// near the player). A traffic car is an ordinary garage car with car.ai = 'traffic'; when
// it has slowed or stopped, the player can steal it with E like any other car.
import { CELL, GRID, TRAFFIC } from '../config.js';
import { roadCentre } from '../city/plan.js';
import { makeRng } from '../core/rng.js';
import { RoadDriver, lanePointAt, legHeading, legInfo } from './road-driver.js';
import { CAR_TYPES } from './car-models.js';

const MIX = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'cab', 'coupe', 'pickup'];

export class Traffic {
  constructor(scene, garage, plan, seed = 1, avoid = { x: 0, z: 0 }) {
    this.scene = scene;
    this.garage = garage;
    this.plan = plan;
    this.avoid = avoid;
    this.rng = makeRng(seed * 331 + 7);
    this.cars = []; // {car, driver, cruise}
    for (let k = 0; k < TRAFFIC.count; k += 1) this.spawnFar();
  }

  /** A random next intersection from `to`: any neighbour, rarely back the way it came. */
  wanderNext(from, to) {
    const options = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = to.ix + dx;
      const nz = to.iz + dz;
      if (nx < 0 || nx > GRID.blocks || nz < 0 || nz > GRID.blocks) continue;
      if (nx === from.ix && nz === from.iz) {
        if (this.rng.chance(0.1)) options.push({ ix: nx, iz: nz });
        continue;
      }
      options.push({ ix: nx, iz: nz });
    }
    return options.length ? this.rng.pick(options) : from;
  }

  /** The leg a car at (x, z) heading `heading` is on, snapped to its lane. */
  legAt(x, z, heading) {
    const axis = Math.abs(Math.sin(heading)) > Math.abs(Math.cos(heading)) ? 'x' : 'z';
    if (axis === 'z') {
      const ix = Math.max(0, Math.min(GRID.blocks, Math.round((x - roadCentre(0)) / CELL)));
      const k = Math.max(0, Math.min(GRID.blocks - 1, Math.floor((z - roadCentre(0)) / CELL)));
      // north-south road: heading 0 runs south (+z), heading PI runs north (-z)
      const dir = Math.cos(heading) >= 0 ? 1 : -1;
      const from = dir > 0 ? { ix, iz: k } : { ix, iz: k + 1 };
      const to = dir > 0 ? { ix, iz: k + 1 } : { ix, iz: k };
      return { from, to, info: legInfo(from, to) };
    }
    const iz = Math.max(0, Math.min(GRID.blocks, Math.round((z - roadCentre(0)) / CELL)));
    const k = Math.max(0, Math.min(GRID.blocks - 1, Math.floor((x - roadCentre(0)) / CELL)));
    // east-west road: heading PI/2 runs east (+x), -PI/2 runs west (-x)
    const dir = Math.sin(heading) >= 0 ? 1 : -1;
    const from = dir > 0 ? { ix: k, iz } : { ix: k + 1, iz };
    const to = dir > 0 ? { ix: k + 1, iz } : { ix: k, iz };
    return { from, to, info: legInfo(from, to) };
  }

  /**
   * Put a traffic car of `typeName` on the road at (x, z) heading `heading`, driving its
   * lane at `cruise` m/s (random when omitted). Returns the car.
   */
  spawnAt(typeName, colour, x, z, heading, cruise = null) {
    const { from, to, info } = this.legAt(x, z, heading);
    const along = info.axis === 'z' ? z : x;
    const distAlong = Math.max(2, Math.min(CELL - 2, (along - info.start) * info.dir));
    const at = lanePointAt(info, distAlong);
    const car = this.garage.add(typeName, colour ?? CAR_TYPES[typeName].colours[0], at.x, at.z, legHeading(info));
    car.ai = 'traffic';
    const driver = new RoadDriver(car, (f, t) => this.wanderNext(f, t));
    driver.setLeg(from, to);
    const entry = { car, driver, cruise: cruise ?? this.rng.range(TRAFFIC.cruiseMin, TRAFFIC.cruiseMax) };
    this.cars.push(entry);
    return car;
  }

  /** A fresh traffic car on a random road, away from the player's start. */
  spawnFar() {
    for (let tries = 0; tries < 8; tries += 1) {
      const ix = this.rng.int(0, GRID.blocks);
      const iz = this.rng.int(0, GRID.blocks);
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const at = axis === 'z'
        ? { x: roadCentre(ix), z: roadCentre(iz) + dir * this.rng.range(10, 70) }
        : { x: roadCentre(ix) + dir * this.rng.range(10, 70), z: roadCentre(iz) };
      if (Math.hypot(at.x - this.avoid.x, at.z - this.avoid.z) < 60) continue;
      const heading = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const type = this.rng.pick(MIX);
      this.spawnAt(type, null, at.x, at.z, heading);
      return;
    }
  }

  /** Move a car that drifted far from the player onto a road near the player. */
  relocateNear(entry, player) {
    const a = this.rng.range(0, Math.PI * 2);
    const d = this.rng.range(TRAFFIC.respawnNearMin, TRAFFIC.respawnNearMax);
    const at = { x: player.position.x + Math.cos(a) * d, z: player.position.z + Math.sin(a) * d };
    const axis = this.rng.chance(0.5) ? 'x' : 'z';
    const heading = axis === 'z' ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const { from, to, info } = this.legAt(at.x, at.z, heading);
    const along = info.axis === 'z' ? at.z : at.x;
    const distAlong = Math.max(2, Math.min(CELL - 2, (along - info.start) * info.dir));
    const spot = lanePointAt(info, distAlong);
    entry.car.placeAt(spot.x, spot.z, legHeading(info));
    entry.driver.setLeg(from, to);
  }

  /** How hard this car should brake for whatever is ahead of it (0 = clear). */
  blockedFor(car, peds) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const mySpeed = Math.abs(car.forwardSpeed);
    let brake = 0;
    for (const other of this.garage.cars) {
      if (other === car) continue;
      const dx = other.position.x - car.position.x;
      const dz = other.position.z - car.position.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 0 || ahead > 16) continue;
      const side = Math.abs(dx * fz - dz * fx);
      if (side > 2.4) continue;
      if (ahead < 7 || Math.abs(other.forwardSpeed) < mySpeed) brake = Math.max(brake, ahead < 7 ? 1 : 0.6);
    }
    for (const ped of peds.list) {
      if (ped.state === 'down') continue;
      const dx = ped.position.x - car.position.x;
      const dz = ped.position.z - car.position.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 0 || ahead > 11) continue;
      const side = Math.abs(dx * fz - dz * fx);
      if (side > 2.0) continue;
      brake = Math.max(brake, ahead < 6 ? 1 : 0.7);
    }
    return brake;
  }

  /** Step every traffic car; `player` is the Player, for the respawn distance. */
  update(dt, world, peds, player) {
    for (const entry of this.cars) {
      const brake = this.blockedFor(entry.car, peds);
      const controls = entry.driver.controls(entry.cruise, brake);
      entry.car.update(dt, controls, world);
      if (Math.hypot(entry.car.position.x - player.position.x, entry.car.position.z - player.position.z) > TRAFFIC.respawnDist) {
        this.relocateNear(entry, player);
      }
    }
  }

  /** Hand a traffic car to the player: it stops being traffic. */
  release(car) {
    const i = this.cars.findIndex((e) => e.car === car);
    if (i >= 0) this.cars.splice(i, 1);
    car.ai = null;
  }
}
