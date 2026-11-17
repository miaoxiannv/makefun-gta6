// Every car in town: parks them along the kerbs from the plan, steps the ones that are awake,
// shoves cars apart when they touch (the heavier one moves less), keeps people from walking
// through bodywork and finds the nearest car to get into.
import { makeRng } from '../core/rng.js';
import { Car } from './car.js';
import { CAR_TYPES } from './car-models.js';

const MIX = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'cab', 'coupe', 'pickup'];

export class Garage {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
  }

  add(typeName, colour, x, z, heading) {
    const car = new Car(typeName, colour ?? CAR_TYPES[typeName].colours[0], x, z, heading);
    car.index = this.cars.length;
    this.cars.push(car);
    this.scene.add(car.object);
    return car;
  }

  /** Fill a share of the kerbside spots, skipping any that `keepClear(spot)` rejects. */
  parkAlongKerbs(spots, seed, keepClear = () => true) {
    const rng = makeRng(seed);
    for (const s of spots) {
      if (!keepClear(s) || rng() > 0.55) continue;
      const type = rng.pick(MIX);
      this.add(type, rng.pick(CAR_TYPES[type].colours), s.x, s.z, s.heading + rng.range(-0.03, 0.03));
    }
  }

  nearest(x, z, range) {
    let best = null;
    let bestD = range;
    for (const car of this.cars) {
      const d = Math.hypot(car.position.x - x, car.position.z - z) - car.type.length * 0.25;
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  /** Step awake cars; `driven` gets the player's controls. */
  update(dt, world, driven, controls) {
    for (const car of this.cars) {
      if (car === driven) car.update(dt, controls, world);
      else if (!car.asleep) car.update(dt, null, world);
    }
    this.separate();
  }

  /** Circle-vs-circle contacts between moving cars and anything near them. */
  separate() {
    const awake = this.cars.filter((c) => !c.asleep);
    for (const a of awake) {
      for (const b of this.cars) {
        if (a === b || (!b.asleep && b.index < a.index)) continue;
        if (Math.abs(a.position.x - b.position.x) > 7 || Math.abs(a.position.z - b.position.z) > 7) continue;
        for (const pa of a.circles()) {
          for (const pb of b.circles()) {
            const dx = pb.x - pa.x;
            const dz = pb.z - pa.z;
            const d = Math.hypot(dx, dz);
            const min = a.radius + b.radius;
            if (d >= min || d < 1e-6) continue;
            const nx = dx / d;
            const nz = dz / d;
            const depth = min - d;
            const wa = b.type.mass / (a.type.mass + b.type.mass);
            a.position.x -= nx * depth * wa;
            a.position.z -= nz * depth * wa;
            b.position.x += nx * depth * (1 - wa);
            b.position.z += nz * depth * (1 - wa);
            // exchange momentum along the contact normal
            const rel = (a.velocity.x - b.velocity.x) * nx + (a.velocity.z - b.velocity.z) * nz;
            if (rel > 0) {
              const j = rel * 1.2;
              a.velocity.x -= nx * j * wa;
              a.velocity.z -= nz * j * wa;
              b.velocity.x += nx * j * (1 - wa);
              b.velocity.z += nz * j * (1 - wa);
              a.lastImpact = Math.max(a.lastImpact, rel * 0.6);
              b.asleep = false;
            }
          }
        }
        a.sync();
        b.sync();
      }
    }
  }

  /** Push a walker's circle out of any car body (an oriented box). */
  pushOutOfCars(p, radius) {
    for (const car of this.cars) {
      const dx = p.x - car.position.x;
      const dz = p.z - car.position.z;
      if (dx * dx + dz * dz > 16) continue;
      const s = Math.sin(car.heading);
      const c = Math.cos(car.heading);
      // into the car's frame: along the nose and across to its right
      const lz = dx * s + dz * c;
      const lx = -dx * c + dz * s;
      const hx = car.type.width / 2;
      const hz = car.type.length / 2;
      const cx = Math.max(-hx, Math.min(lx, hx));
      const cz = Math.max(-hz, Math.min(lz, hz));
      let ox = lx - cx;
      let oz = lz - cz;
      let d = Math.hypot(ox, oz);
      if (d >= radius) continue;
      if (d < 1e-6) {
        // inside: leave by the nearest side
        const outX = hx - Math.abs(lx);
        const outZ = hz - Math.abs(lz);
        if (outX < outZ) { ox = Math.sign(lx) || 1; oz = 0; d = -outX; } else { ox = 0; oz = Math.sign(lz) || 1; d = -outZ; }
      } else {
        ox /= d; oz /= d;
      }
      const push = radius - d;
      // back to world space
      p.x += (-ox * c + oz * s) * push;
      p.z += (ox * s + oz * c) * push;
    }
  }

  setLights(night) {
    for (const car of this.cars) car.setLights(night);
  }
}
