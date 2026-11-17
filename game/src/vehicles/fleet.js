// All the cars in town: parking them along the kerbs, stepping their physics, resolving
// car-to-car bumps, keeping pedestrians out of them and finding the nearest one to steal.
import * as THREE from 'three';
import { makeRandom } from '../core/random.js';
import { Car } from './car.js';
import { CAR_COLORS } from './car-models.js';

const TYPE_MIX = ['sedan', 'sedan', 'suv', 'taxi', 'sports', 'sedan', 'suv'];

export class Fleet {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.group = new THREE.Group();
    this.group.name = 'cars';
    scene.add(this.group);
  }

  add(typeName, color, x, z, heading) {
    const car = new Car(typeName, color);
    car.placeAt(x, z, heading);
    this.cars.push(car);
    this.group.add(car.model);
    return car;
  }

  /** Park cars on the layout's kerbside spots, with colours and types from `seed`. */
  parkAlongKerbs(layout, seed) {
    const random = makeRandom(seed);
    for (const spot of layout.parking) {
      this.add(random.pick(TYPE_MIX), random.pick(CAR_COLORS), spot.x, spot.z, spot.heading + (spot.flip ? Math.PI : 0));
    }
  }

  /** Step every awake car; `driven` is the player's car with its controls. */
  update(dt, world, driven, controls) {
    for (const car of this.cars) {
      if (car === driven) car.update(dt, controls, world);
      else if (!car.asleep) car.update(dt, null, world);
    }
    this.resolveBumps();
  }

  /** Push overlapping cars apart and trade momentum along the contact. */
  resolveBumps() {
    const a = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
    const b = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
    for (let i = 0; i < this.cars.length; i += 1) {
      const one = this.cars[i];
      for (let j = i + 1; j < this.cars.length; j += 1) {
        const two = this.cars[j];
        if (one.asleep && two.asleep) continue;
        const dx0 = one.position.x - two.position.x;
        const dz0 = one.position.z - two.position.z;
        if (dx0 * dx0 + dz0 * dz0 > 49) continue;
        one.circles(a);
        two.circles(b);
        for (const p of a) {
          for (const q of b) {
            const dx = p.x - q.x;
            const dz = p.z - q.z;
            const reach = one.radius + two.radius;
            const d2 = dx * dx + dz * dz;
            if (d2 >= reach * reach || d2 < 1e-8) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const nz = dz / d;
            const overlap = reach - d;
            const massOne = one.type.mass;
            const massTwo = two.type.mass;
            const share = massTwo / (massOne + massTwo);
            one.position.x += nx * overlap * share;
            one.position.z += nz * overlap * share;
            two.position.x -= nx * overlap * (1 - share);
            two.position.z -= nz * overlap * (1 - share);
            const closing = (one.velocity.x - two.velocity.x) * nx + (one.velocity.z - two.velocity.z) * nz;
            if (closing < 0) {
              const impulse = (-1.3 * closing) / (1 / massOne + 1 / massTwo);
              one.velocity.x += (nx * impulse) / massOne;
              one.velocity.z += (nz * impulse) / massOne;
              two.velocity.x -= (nx * impulse) / massTwo;
              two.velocity.z -= (nz * impulse) / massTwo;
              one.lastImpact = Math.max(one.lastImpact, -closing);
              two.lastImpact = Math.max(two.lastImpact, -closing);
              one.asleep = false;
              two.asleep = false;
            }
          }
        }
      }
    }
  }

  /** Push a person-sized circle at `point` out of every car's box. */
  pushOutOfCars(point, radius) {
    for (const car of this.cars) {
      const dx = point.x - car.position.x;
      const dz = point.z - car.position.z;
      if (dx * dx + dz * dz > 16) continue;
      const sin = Math.sin(car.heading);
      const cos = Math.cos(car.heading);
      // Into the car's frame: local x across, local z along.
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const hx = car.type.width / 2 + radius;
      const hz = car.type.length / 2 + radius;
      if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
      let nx = lx;
      let nz = lz;
      if (hx - Math.abs(lx) < hz - Math.abs(lz)) nx = Math.sign(lx) * hx;
      else nz = Math.sign(lz) * hz;
      point.x = car.position.x + nx * cos + nz * sin;
      point.z = car.position.z - nx * sin + nz * cos;
    }
  }

  /** The closest car within `range` of (x, z), or null. */
  nearest(x, z, range) {
    let best = null;
    let bestDistance = range;
    for (const car of this.cars) {
      const d = Math.hypot(car.position.x - x, car.position.z - z) - car.type.length * 0.3;
      if (d < bestDistance) { bestDistance = d; best = car; }
    }
    return best;
  }
}
