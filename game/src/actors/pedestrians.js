// The people of Port Solano: they stroll the sidewalks around a block, wait and look
// around, cross the road to the next block, run from cars that get too close, and get
// knocked down when a car actually hits them. They reuse the player's person rig with
// different looks, and stay near the player (far ones are moved to a sidewalk nearby).
import * as THREE from 'three';
import { CELL, CITY_HALF, GRID, PEDESTRIANS } from '../config.js';
import { blockStart } from '../city/plan.js';
import { approachAngle, clamp, makeRng } from '../core/rng.js';
import { PersonModel } from './person-model.js';

const SKINS = ['#b07850', '#e8b98a', '#8a5a3b', '#f0c8a0', '#6e4426'];
const SHIRTS = ['#c94f4f', '#4f7ac9', '#4fae6b', '#e8a13c', '#8a5fc9', '#e8e8e8', '#3a3a3a', '#2ab3a6', '#d95f8e'];
const PANTS = ['#2b3a4a', '#6b5a44', '#3a3a3a', '#7a8b99', '#f2ede2', '#4a2b3a'];
const HAIRS = ['#1b1410', '#3a2a1a', '#8a8a8a', '#d9a441', '#2a1a0a', '#5a1a1a'];
const SHOES = ['#1d1d1f', '#4a2b1a', '#f2f2f2', '#2b3a4a'];

function randomLook(rng) {
  return {
    skin: rng.pick(SKINS),
    shirt: rng.pick(SHIRTS),
    print: null,
    pants: rng.pick(PANTS),
    shoes: rng.pick(SHOES),
    hair: rng.pick(HAIRS),
    shades: rng.chance(0.25),
  };
}

/** The sidewalk rectangle around a block, inset from its edges. */
function edgeRect(bx, bz) {
  return {
    x0: blockStart(bx) + 2.2, x1: blockStart(bx) + GRID.block - 2.2,
    z0: blockStart(bz) + 2.2, z1: blockStart(bz) + GRID.block - 2.2,
  };
}

/** The four sidewalk edges, walked clockwise: start, end, heading, outward normal, opposite. */
const EDGES = [
  { from: (r) => ({ x: r.x0, z: r.z0 }), to: (r) => ({ x: r.x1, z: r.z0 }), heading: Math.PI / 2, normal: { x: 0, z: -1 }, opposite: 2 },
  { from: (r) => ({ x: r.x1, z: r.z0 }), to: (r) => ({ x: r.x1, z: r.z1 }), heading: 0, normal: { x: 1, z: 0 }, opposite: 3 },
  { from: (r) => ({ x: r.x1, z: r.z1 }), to: (r) => ({ x: r.x0, z: r.z1 }), heading: -Math.PI / 2, normal: { x: 0, z: 1 }, opposite: 0 },
  { from: (r) => ({ x: r.x0, z: r.z1 }), to: (r) => ({ x: r.x0, z: r.z0 }), heading: Math.PI, normal: { x: -1, z: 0 }, opposite: 1 },
];

class Pedestrian {
  constructor(scene, rng) {
    this.model = new PersonModel(randomLook(rng));
    this.position = this.model.root.position;
    this.heading = 0;
    this.phase = rng.range(0, Math.PI * 2);
    this.gait = 0;
    this.speed = rng.range(PEDESTRIANS.walkMin, PEDESTRIANS.walkMax);
    this.speedNow = 0;
    this.dir = rng.chance(0.5) ? 1 : -1;
    this.state = 'walk';
    this.waitTimer = 0;
    this.downTimer = 0;
    this.fleeTimer = 0;
    this.fleeDir = { x: 0, z: 0 };
    this.knock = { x: 0, z: 0 };
    this.crossTarget = null;
    this.rng = rng;
    this.block = { bx: rng.int(0, GRID.blocks - 1), bz: rng.int(0, GRID.blocks - 1) };
    this.edge = rng.int(0, 3);
    const r = edgeRect(this.block.bx, this.block.bz);
    const e = EDGES[this.edge];
    const from = e.from(r);
    const to = e.to(r);
    const t = rng();
    this.position.set(from.x + (to.x - from.x) * t, 0, from.z + (to.z - from.z) * t);
    this.heading = e.heading + (this.dir > 0 ? 0 : Math.PI);
    scene.add(this.model.root);
  }

  get x() { return this.position.x; }
  get z() { return this.position.z; }

  /** The edge end this pedestrian is walking toward. */
  edgeEnd() {
    const r = edgeRect(this.block.bx, this.block.bz);
    return this.dir > 0 ? EDGES[this.edge].to(r) : EDGES[this.edge].from(r);
  }

  /** The block across the road from `edge`, or null at the edge of the city. */
  acrossBlock(edge) {
    const { bx, bz } = this.block;
    const n = EDGES[edge].normal;
    const nx = bx + n.x;
    const nz = bz + n.z;
    if (nx < 0 || nx >= GRID.blocks || nz < 0 || nz >= GRID.blocks) return null;
    return { bx: nx, bz: nz };
  }

  /** Drop this pedestrian on the nearest sidewalk edge of the nearest block. */
  snapToPerimeter() {
    // re-anchor to the block this pedestrian is standing in now, so a knocked-down
    // pedestrian does not teleport back to the block it started on
    this.block = {
      bx: clamp(Math.floor((this.position.x + CITY_HALF - GRID.road) / CELL), 0, GRID.blocks - 1),
      bz: clamp(Math.floor((this.position.z + CITY_HALF - GRID.road) / CELL), 0, GRID.blocks - 1),
    };
    const r = edgeRect(this.block.bx, this.block.bz);
    const cands = [
      { edge: 0, d: Math.abs(this.position.z - r.z0), point: { x: clamp(this.position.x, r.x0, r.x1), z: r.z0 } },
      { edge: 1, d: Math.abs(this.position.x - r.x1), point: { x: r.x1, z: clamp(this.position.z, r.z0, r.z1) } },
      { edge: 2, d: Math.abs(this.position.z - r.z1), point: { x: clamp(this.position.x, r.x0, r.x1), z: r.z1 } },
      { edge: 3, d: Math.abs(this.position.x - r.x0), point: { x: r.x0, z: clamp(this.position.z, r.z0, r.z1) } },
    ];
    cands.sort((a, b) => a.d - b.d);
    this.edge = cands[0].edge;
    this.position.x = cands[0].point.x;
    this.position.z = cands[0].point.z;
  }

  /** Move to a random sidewalk 40-90 m from the player. */
  placeNear(player, rng) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(PEDESTRIANS.respawnNearMin, PEDESTRIANS.respawnNearMax);
    const x = player.position.x + Math.cos(a) * d;
    const z = player.position.z + Math.sin(a) * d;
    this.block = {
      bx: clamp(Math.floor((x + CITY_HALF - GRID.road) / CELL), 0, GRID.blocks - 1),
      bz: clamp(Math.floor((z + CITY_HALF - GRID.road) / CELL), 0, GRID.blocks - 1),
    };
    this.edge = rng.int(0, 3);
    const r = edgeRect(this.block.bx, this.block.bz);
    const e = EDGES[this.edge];
    const from = e.from(r);
    const to = e.to(r);
    const t = rng();
    this.position.set(from.x + (to.x - from.x) * t, 0, from.z + (to.z - from.z) * t);
    this.heading = e.heading + (this.dir > 0 ? 0 : Math.PI);
    this.state = 'walk';
  }

  /** Step toward `heading` at `speed`, turning to face the way of travel. */
  walkToward(dt, heading, speed) {
    this.heading = approachAngle(this.heading, heading, 8 * dt);
    this.position.x += Math.sin(this.heading) * speed * dt;
    this.position.z += Math.cos(this.heading) * speed * dt;
    this.speedNow = speed;
  }

  update(dt, time, world, cars, player, onPlayerHit) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      this.position.x += this.knock.x * dt;
      this.position.z += this.knock.z * dt;
      this.knock.x *= Math.exp(-4 * dt);
      this.knock.z *= Math.exp(-4 * dt);
      this.speedNow = 0;
      if (this.downTimer <= 0) {
        this.state = 'flee';
        this.fleeTimer = 1.5;
      }
    } else if (this.state === 'flee') {
      this.fleeTimer -= dt;
      this.walkToward(dt, Math.atan2(this.fleeDir.x, this.fleeDir.z), PEDESTRIANS.run);
      if (this.fleeTimer <= 0) {
        this.state = 'walk';
        this.snapToPerimeter();
      }
    } else if (this.state === 'wait') {
      this.waitTimer -= dt;
      this.speedNow = 0;
      if (this.waitTimer <= 0) this.state = 'walk';
    } else if (this.state === 'cross') {
      const dx = this.crossTarget.x - this.position.x;
      const dz = this.crossTarget.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) {
        this.block = this.crossBlock;
        this.edge = EDGES[this.edge].opposite;
        this.state = 'walk';
      } else {
        this.walkToward(dt, Math.atan2(dx, dz), this.speed);
      }
    } else {
      // walk: occasionally stop and look around
      if (this.rng() < dt * 0.06) {
        this.state = 'wait';
        this.waitTimer = this.rng.range(1, 4);
        this.speedNow = 0;
      } else {
        const edgeHeading = EDGES[this.edge].heading + (this.dir > 0 ? 0 : Math.PI);
        this.walkToward(dt, edgeHeading, this.speed);
        const end = this.edgeEnd();
        if (Math.hypot(end.x - this.position.x, end.z - this.position.z) < 0.7) {
          // corner reached: snap onto it so the walk never drifts off the sidewalk
          this.position.x = end.x;
          this.position.z = end.z;
          // cross the road, or turn onto the next edge
          const across = this.rng.chance(0.25) ? this.acrossBlock(this.edge) : null;
          if (across) {
            const n = EDGES[this.edge].normal;
            this.crossTarget = { x: this.position.x + n.x * (GRID.road + 4.4), z: this.position.z + n.z * (GRID.road + 4.4) };
            this.crossBlock = across;
            this.state = 'cross';
          } else {
            this.edge = (this.edge + this.dir + 4) % 4;
          }
        }
      }
    }

    // cars: run from a close one, get knocked down by one that hits. The hit test uses
    // the car's body as an oriented box, not the distance to its centre: pushOutOfCars
    // below keeps a walker outside that box, so a centre-distance test can never fire
    // for a car coming up behind a fleeing pedestrian — it just snowplows them along.
    for (const car of cars) {
      if (car.asleep && !car.driver && !car.ai) continue;
      const dx = this.position.x - car.position.x;
      const dz = this.position.z - car.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 6) continue;
      const s = Math.sin(car.heading);
      const c = Math.cos(car.heading);
      const along = dx * s + dz * c; // along the nose
      const across = -dx * c + dz * s; // across to its right
      const insideBody = Math.abs(across) < car.type.width / 2 + 0.45
        && Math.abs(along) < car.type.length / 2 + 0.45;
      if (insideBody) {
        if (Math.abs(car.forwardSpeed) > 1.5 && this.state !== 'down') {
          this.state = 'down';
          this.downTimer = 2.5;
          const push = 3 / Math.max(d, 0.5);
          this.knock = { x: dx * push, z: dz * push };
          this.fleeDir = { x: dx / Math.max(d, 0.01), z: dz / Math.max(d, 0.01) };
          if (car === player.vehicle) onPlayerHit();
        }
      } else if (d < 5 && Math.abs(car.forwardSpeed) > 3 && this.state !== 'flee' && this.state !== 'down') {
        this.state = 'flee';
        this.fleeTimer = 1.2;
        this.fleeDir = { x: dx / d, z: dz / d };
      }
    }

    world.pushOutOfCars(this.position, 0.4);
    world.resolveCircle(this.position, 0.4);
    this.position.y = world.groundHeight(this.position.x, this.position.z);

    this.gait = this.speedNow / 2.2;
    this.phase += dt * this.speedNow * 2.1;
    this.model.pose(this.phase, this.gait, false, time);
    if (this.state === 'down') {
      // slumped on the ground after the hit
      this.model.torso.rotation.x = 0.85;
      this.model.head.rotation.x = 0.4;
      this.model.hips.position.y = 0.6;
    }
    this.model.root.rotation.y = this.heading;
  }
}

export class Pedestrians {
  constructor(scene, plan, seed = 1) {
    this.scene = scene;
    this.rng = makeRng(seed * 977 + 3);
    this.list = [];
    for (let k = 0; k < PEDESTRIANS.count; k += 1) {
      const ped = new Pedestrian(scene, this.rng);
      // pedestrians do not cast shadows: the software renderer stays fast
      ped.model.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      this.list.push(ped);
    }
  }

  update(dt, time, world, cars, player, onPlayerHit) {
    for (const ped of this.list) ped.update(dt, time, world, cars, player, onPlayerHit);
    // keep pedestrians from walking through each other
    for (let i = 0; i < this.list.length; i += 1) {
      for (let k = i + 1; k < this.list.length; k += 1) {
        const a = this.list[i];
        const b = this.list[k];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8 && d > 1e-6) {
          const push = (0.8 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.position.x -= nx * push;
          a.position.z -= nz * push;
          b.position.x += nx * push;
          b.position.z += nz * push;
        }
      }
    }
    // keep the crowd near the player
    for (const ped of this.list) {
      if (Math.hypot(ped.position.x - player.position.x, ped.position.z - player.position.z) > PEDESTRIANS.respawnDist) {
        ped.placeNear(player, this.rng);
      }
    }
  }

  /** Push the player's circle out of every pedestrian. */
  pushOut(p, radius) {
    for (const ped of this.list) {
      const dx = p.x - ped.position.x;
      const dz = p.z - ped.position.z;
      const d = Math.hypot(dx, dz);
      const min = radius + 0.4;
      if (d < min && d > 1e-6) {
        p.x += (dx / d) * (min - d);
        p.z += (dz / d) * (min - d);
      }
    }
  }
}
