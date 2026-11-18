// One car and its arcade handling: engine force that tails off toward top speed, brakes and
// reverse, speed-sensitive steering on a bicycle model, tyre grip that bleeds off sideways
// slip (much less with the handbrake on, so the rear steps out), wall impacts that bounce and
// scrub speed, and body roll and pitch for feel. Parked cars sleep until something hits them.
import * as THREE from 'three';
import { clamp, damp } from '../core/rng.js';
import { CAR_TYPES, makeCarModel } from './car-models.js';

export class Car {
  constructor(typeName, colour, x, z, heading) {
    this.typeName = typeName;
    this.type = CAR_TYPES[typeName];
    this.label = this.type.label;
    this.colour = colour;
    this.model = makeCarModel(typeName, colour);
    this.position = new THREE.Vector3(x, 0, z);
    this.velocity = new THREE.Vector3();
    this.heading = heading;
    this.steer = 0;
    this.roll = 0;
    this.pitch = 0;
    this.driver = null;
    this.ai = null; // 'traffic' | 'police' when an AI system drives this car, else null
    this.asleep = true;
    this.lastImpact = 0;
    this.braking = false;
    this.radius = this.type.width / 2;
    this.lightRed = null;
    this.lightBlue = null;
    if (this.type.lightbar) {
      // the red/blue bar on the roof of a Solano PD cruiser
      const bar = (x, color) => {
        const mat = new THREE.MeshStandardMaterial({ color: '#202224', emissive: color, emissiveIntensity: 0.2, roughness: 0.4 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.32), mat);
        mesh.position.set(x, this.type.roof + 0.1, (this.type.r0 + this.type.r1) / 2);
        this.model.chassis.add(mesh);
        return mat;
      };
      this.lightRed = bar(-0.35, '#ff2211');
      this.lightBlue = bar(0.35, '#2266ff');
    }
    this.sync();
  }

  get object() {
    return this.model.root;
  }

  /** Signed speed along the car's nose, m/s. */
  get forwardSpeed() {
    return this.velocity.x * Math.sin(this.heading) + this.velocity.z * Math.cos(this.heading);
  }

  placeAt(x, z, heading) {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.steer = 0;
    this.sync();
  }

  /** Centres of the two circles (nose and tail) that stand in for the body in collisions. */
  circles() {
    const off = this.type.length / 2 - this.radius;
    const fx = Math.sin(this.heading) * off;
    const fz = Math.cos(this.heading) * off;
    return [
      { x: this.position.x + fx, z: this.position.z + fz },
      { x: this.position.x - fx, z: this.position.z - fz },
    ];
  }

  /** One step. `controls` is null for a car with nobody at the wheel. */
  update(dt, controls, world) {
    const t = this.type;
    const sin = Math.sin(this.heading);
    const cos = Math.cos(this.heading);
    let vf = this.velocity.x * sin + this.velocity.z * cos;
    let vl = this.velocity.x * -cos + this.velocity.z * sin;
    const c = controls ?? { throttle: 0, brake: 0, steer: 0, handbrake: false };

    // engine, brakes and reverse
    let accel = 0;
    this.braking = false;
    if (c.throttle > 0) {
      accel += vf < -0.5 ? 18 : t.power * c.throttle * Math.max(0, 1 - vf / t.top) + 1.2;
      if (vf < -0.5) this.braking = true;
    }
    if (c.brake > 0) {
      if (vf > 0.5) { accel -= 20 * c.brake; this.braking = true; } else accel -= t.power * 0.55 * c.brake * Math.max(0, 1 + vf / 13);
    }
    // rolling resistance and air drag
    const drag = Math.sign(vf) * (0.35 + Math.abs(vf) * 0.04) + (c.throttle || c.brake ? 0 : Math.sign(vf) * 1.1);
    const before = vf;
    vf += (accel - drag) * dt;
    if (!c.throttle && !c.brake && Math.sign(vf) !== Math.sign(before)) vf = 0;
    if (c.handbrake) {
      this.braking = true;
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
    }

    // steering: less lock the faster you go, wheel returns to centre on its own
    const lock = t.lock / (1 + Math.abs(vf) * 0.045);
    this.steer += (c.steer * lock - this.steer) * damp(c.steer ? 7 : 10, dt);
    const wheelbase = t.axle * 2;
    let yawRate = (vf * Math.tan(this.steer)) / wheelbase;
    if (c.handbrake && Math.abs(vf) > 6) yawRate *= 1.45;
    this.heading += yawRate * dt;

    // tyre grip removes sideways slip; the handbrake lets the back slide out
    const grip = c.handbrake ? t.grip * 0.12 : t.grip;
    vl *= Math.exp(-grip * dt);
    // when the car turns, part of the old forward motion becomes slip (that is the drift)
    const turn = yawRate * dt;
    vl += vf * Math.sin(turn) * (c.handbrake ? 0.9 : 0.25);

    const ns = Math.sin(this.heading);
    const nc = Math.cos(this.heading);
    const prevX = this.velocity.x;
    const prevZ = this.velocity.z;
    this.velocity.set(ns * vf - nc * vl, 0, nc * vf + ns * vl);
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    this.lastImpact = this.collideWorld(world);

    // body roll from lateral acceleration, pitch from longitudinal
    const ax = (this.velocity.x - prevX) / dt;
    const az = (this.velocity.z - prevZ) / dt;
    const along = ax * ns + az * nc;
    const side = -ax * nc + az * ns;
    this.roll += (clamp(side * 0.012, -0.09, 0.09) - this.roll) * damp(6, dt);
    this.pitch += (clamp(-along * 0.006, -0.06, 0.06) - this.pitch) * damp(6, dt);

    // ride height follows the ground (bumping up kerbs)
    const ground = world.groundHeight(this.position.x, this.position.z);
    this.position.y += (ground - this.position.y) * damp(14, dt);

    for (const w of this.model.wheels) {
      w.spin.rotation.x += (this.forwardSpeed / t.wheel) * dt;
      if (w.front) w.steer.rotation.y = this.steer;
    }
    if (!this.driver && Math.hypot(this.velocity.x, this.velocity.z) < 0.05) this.asleep = true;
    this.sync();
  }

  /** Push both body circles out of the city; bounce off walls. Returns the impact speed. */
  collideWorld(world) {
    let impact = 0;
    for (const p of this.circles()) {
      const before = { x: p.x, z: p.z };
      const hit = world.resolveCircle(p, this.radius);
      if (!hit) continue;
      this.position.x += p.x - before.x;
      this.position.z += p.z - before.z;
      const vn = this.velocity.x * hit.nx + this.velocity.z * hit.nz;
      if (vn < 0) {
        this.velocity.x -= hit.nx * vn * 1.35;
        this.velocity.z -= hit.nz * vn * 1.35;
        this.velocity.multiplyScalar(0.8);
        impact = Math.max(impact, -vn);
      }
    }
    return impact;
  }

  /** Lamps: headlights at night when someone drives; brake lights on braking. AI cars count as driven. */
  setLights(night) {
    const m = this.model;
    const driven = this.driver || this.ai;
    const on = driven ? Math.max(0.25, night) : 0;
    m.headMat.emissiveIntensity = on * 3;
    m.tailMat.emissiveIntensity = (driven ? 0.6 + night * 0.8 : 0) + (this.braking && driven ? 2.2 : 0);
  }

  /** Alternate the red and blue light bar (police cars only). */
  flashLights(time) {
    if (!this.lightRed) return;
    const phase = Math.floor(time * 5) % 2 === 0;
    this.lightRed.emissiveIntensity = phase ? 3 : 0.15;
    this.lightBlue.emissiveIntensity = phase ? 0.15 : 3;
  }

  sync() {
    const m = this.model;
    m.root.position.copy(this.position);
    m.root.rotation.y = this.heading;
    m.chassis.rotation.set(this.pitch, 0, this.roll);
  }
}

