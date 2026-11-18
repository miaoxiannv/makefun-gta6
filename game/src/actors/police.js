// Solano PD: wanted stars bring police cars. They spawn on a road near the player, drive
// the street grid toward the player's intersection, then chase directly and try to pin the
// player down. Pinned — slow in a car, or caught on foot — for long enough and the bust
// lands: a fine, the stars clear, and the player wakes up at Solano Mercy. Lose the cars —
// out of a cruiser's close sight for a while, and no fresh crime — and the stars tick down
// one at a time; a cruiser that cannot reach the player for a while gives up and leaves.
import { CELL, GRID, POLICE, WANTED } from '../config.js';
import { blockIndex, roadCentre } from '../city/plan.js';
import { clamp, makeRng, wrapAngle } from '../core/rng.js';
import { RoadDriver, lanePointAt, legHeading, legInfo, nearestIntersection } from '../vehicles/road-driver.js';

export class Police {
  constructor(scene, garage, state, seed = 1, notify = () => {}) {
    this.scene = scene;
    this.garage = garage;
    this.state = state; // game state, holds `wanted`
    this.notify = notify;
    this.rng = makeRng(seed * 541 + 11);
    this.cars = []; // {car, driver, chaseTime, closest}
    this.playerPos = { x: 0, z: 0 };
    this.time = 0;
    this.smoothPlayerSpeed = 0;
    this.lastCrimeAt = -1e9;
    this.lastSeenAt = -1e9;
    this.bustTimer = 0;
    this.bustReady = false;
    this.spawnTimer = 0;
    this.cooldowns = { ram: 0, speed: 0 };
  }

  /** One more star (clamped), and the lose-the-cops clocks restart. */
  addHeat(n) {
    const before = this.state.wanted;
    this.state.wanted = clamp(this.state.wanted + n, 0, WANTED.max);
    if (this.state.wanted > before) this.lastCrimeAt = this.time;
  }

  /** The neighbour of `to` that gets closest to the player's intersection. */
  chaseNext(from, to) {
    const target = nearestIntersection(this.playerPos.x, this.playerPos.z);
    let best = null;
    let bestD = Infinity;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = to.ix + dx;
      const nz = to.iz + dz;
      if (nx < 0 || nx > GRID.blocks || nz < 0 || nz > GRID.blocks) continue;
      if (nx === from.ix && nz === from.iz) continue; // no U-turns while chasing
      const d = Math.abs(nx - target.ix) + Math.abs(nz - target.iz);
      if (d < bestD) { bestD = d; best = { ix: nx, iz: nz }; }
    }
    return best ?? from;
  }

  /** An intersection 70-110 m from the player to spawn a cruiser at, or null. */
  spawnIntersection(playerPos) {
    for (let tries = 0; tries < 12; tries += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(POLICE.spawnDistMin, POLICE.spawnDistMax);
      const near = nearestIntersection(playerPos.x + Math.cos(a) * d, playerPos.z + Math.sin(a) * d);
      if (Math.hypot(roadCentre(near.ix) - playerPos.x, roadCentre(near.iz) - playerPos.z) < 50) continue;
      return near;
    }
    return null;
  }

  /** Bring in one cruiser, on a leg from a nearby intersection toward the player. */
  spawnOne(playerPos) {
    const at = this.spawnIntersection(playerPos);
    if (!at) return null;
    const next = this.chaseNext(at, at); // from == to: every neighbour is a candidate
    const info = legInfo(at, next);
    const spot = lanePointAt(info, 3);
    const car = this.garage.add('police', null, spot.x, spot.z, legHeading(info));
    car.ai = 'police';
    const driver = new RoadDriver(car, (f, t) => this.chaseNext(f, t));
    driver.setLeg(at, next);
    const entry = { car, driver, chaseTime: 0, closest: Infinity };
    this.cars.push(entry);
    return car;
  }

  /** How hard this cruiser should brake for the traffic ahead of it (0 = clear). */
  blockedFor(car) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let brake = 0;
    for (const other of this.garage.cars) {
      if (other === car || other.ai === 'police') continue;
      const dx = other.position.x - car.position.x;
      const dz = other.position.z - car.position.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 0 || ahead > 14) continue;
      const side = Math.abs(dx * fz - dz * fx);
      if (side > 2.4) continue;
      if (ahead < 6 || Math.abs(other.forwardSpeed) < Math.abs(car.forwardSpeed)) {
        brake = Math.max(brake, ahead < 6 ? 1 : 0.6);
      }
    }
    return brake;
  }

  /** Take a cruiser out of the world entirely. */
  remove(entry) {
    this.garage.remove(entry.car);
    const i = this.cars.indexOf(entry);
    if (i >= 0) this.cars.splice(i, 1);
  }

  /** All cruisers leave (wanted cleared, or the bust is served). */
  clearAll() {
    for (const entry of [...this.cars]) this.remove(entry);
    this.bustTimer = 0;
    this.bustReady = false;
  }

  /** The player stole this cruiser: it stops being police. */
  release(car) {
    const entry = this.cars.find((e) => e.car === car);
    if (entry) this.cars.splice(this.cars.indexOf(entry), 1);
    car.ai = null;
  }

  /** Metres from (x, z) to the nearest road centre line. */
  roadDistance(x, z) {
    const dist = (v) => {
      const i = Math.max(0, Math.min(GRID.blocks, Math.round((v - roadCentre(0)) / CELL)));
      return Math.abs(v - roadCentre(i));
    };
    return Math.min(dist(x), dist(z));
  }

  update(dt, world, focus, player) {
    this.time += dt;
    this.playerPos = focus.position;
    this.cooldowns.ram = Math.max(0, this.cooldowns.ram - dt);
    this.cooldowns.speed = Math.max(0, this.cooldowns.speed - dt);
    if (this.state.wanted > 0 && this.lastCrimeAt < -1e8) this.lastCrimeAt = this.time;

    if (this.state.wanted <= 0) {
      if (this.cars.length) {
        this.clearAll();
        this.notify('You lost the cops');
      }
      return;
    }

    // keep the heat on, while the trail is warm: up to one cruiser per star, at most three
    const want = Math.min(this.state.wanted, POLICE.maxActive);
    const trailWarm = this.time - this.lastCrimeAt < POLICE.spawnWarmSeconds
      || this.time - this.lastSeenAt < POLICE.spawnSeenSeconds;
    this.spawnTimer -= dt;
    if (this.cars.length < want && trailWarm && this.spawnTimer <= 0) {
      if (this.spawnOne(focus.position)) this.spawnTimer = 1.5;
    }

    // the player is reachable by car when driving, or on foot near a road; deeper inside
    // a block, the cruisers can only drive to the nearest intersection and wait
    const reachable = focus.inCar
      || blockIndex(focus.position.x) < 0
      || blockIndex(focus.position.z) < 0
      || this.roadDistance(focus.position.x, focus.position.z) < POLICE.roadReach;

    let nearest = Infinity;
    for (const entry of [...this.cars]) {
      const { car, driver } = entry;
      const dx = focus.position.x - car.position.x;
      const dz = focus.position.z - car.position.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      entry.chaseTime += dt;
      entry.closest = Math.min(entry.closest, dist);
      // cannot reach the player for a long while: give up and leave
      if (entry.chaseTime > POLICE.giveUpSeconds && entry.closest > POLICE.giveUpRadius) {
        this.remove(entry);
        this.notify('A cruiser lost your trail');
        continue;
      }
      let controls;
      if (reachable && dist <= 35) {
        // close in: steer straight at the player and ram
        const desired = Math.atan2(dx, dz);
        const diff = wrapAngle(desired - car.heading);
        controls = {
          throttle: Math.abs(diff) > 1.2 ? 0.4 : 1,
          brake: Math.abs(diff) > 1.6 ? 0.7 : 0,
          steer: clamp(diff * 2.2, -1, 1),
          handbrake: false,
        };
      } else {
        // drive the grid toward the player's intersection
        controls = driver.controls(16, this.blockedFor(car));
      }
      car.update(dt, controls, world);
    }
    if (nearest < WANTED.seenRadius) this.lastSeenAt = this.time;

    // pinned down: slow in a car, or caught on foot. The player car's speed is smoothed
    // over ~0.5 s first: a cruiser ramming a stopped car shoves it to 2-3 m/s in brief
    // spikes, which must not break the pin — only a sustained drive-away does.
    const playerCar = player.vehicle;
    if (playerCar) {
      const target = Math.abs(playerCar.forwardSpeed);
      this.smoothPlayerSpeed += (target - this.smoothPlayerSpeed) * Math.min(1, dt * 2);
    } else {
      this.smoothPlayerSpeed = 0;
    }
    const pinned = playerCar
      ? nearest < 3.5 && this.smoothPlayerSpeed < 2
      : nearest < 2.5;
    if (this.cars.length && pinned) {
      this.bustTimer += dt;
      if (this.bustTimer > POLICE.bustSeconds) this.bustReady = true;
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    // out of sight and no fresh crime: the stars tick down one at a time
    if (this.time - this.lastCrimeAt > WANTED.crimeCooldown
      && this.time - this.lastSeenAt > WANTED.unseenSeconds) {
      this.state.wanted -= 1;
      this.lastCrimeAt = this.time;
      this.notify(this.state.wanted > 0 ? 'You lost a star — keep out of sight' : 'You lost the cops');
    }

    // speeding past the police, and ramming a cruiser, both earn heat
    if (playerCar && Math.abs(playerCar.forwardSpeed) > POLICE.speedLimit && nearest < 45 && this.cooldowns.speed <= 0) {
      this.addHeat(1);
      this.cooldowns.speed = POLICE.speedCooldown;
      this.notify('Speeding past Solano PD — wanted up');
    }
    if (playerCar && playerCar.lastImpact > 6 && nearest < 6 && this.cooldowns.ram <= 0) {
      this.addHeat(1);
      this.cooldowns.ram = POLICE.ramCooldown;
      this.notify('You rammed a Solano PD cruiser');
    }
  }
}
