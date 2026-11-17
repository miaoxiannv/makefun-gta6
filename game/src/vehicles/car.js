// One car: arcade driving physics (engine, brakes, reverse, speed-sensitive steering, tyre
// grip and handbrake slides), collisions with the city, and its wheels, lean and lights.
import * as THREE from 'three';
import { clamp, damp } from '../core/math.js';
import { CAR_TYPES, buildCarModel } from './car-models.js';

const BRAKE = 32;
const REVERSE_ACCEL = 8;
const MAX_REVERSE = 11;
const MAX_STEER = 0.62;

export class Car {
  constructor(typeName, color) {
    this.typeName = typeName;
    this.type = CAR_TYPES[typeName];
    this.color = color;
    const model = buildCarModel(typeName, color);
    this.model = model.root;
    this.body = model.body;
    this.wheels = model.wheels;
    this.wheelbase = model.wheelbase;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.steer = 0;
    this.forwardSpeed = 0;
    this.lean = 0;
    this.pitch = 0;
    this.driver = null;
    this.asleep = true;
    this.lastImpact = 0;
    this.headlights = null;
  }

  get label() { return this.type.label; }
  get radius() { return this.type.width / 2; }

  placeAt(x, z, heading) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.velocity.set(0, 0, 0);
    this.syncModel(0);
  }

  /** The two circle centres (front and back) used for collisions, written into `out`. */
  circles(out) {
    const reach = this.type.length / 2 - this.radius;
    const fx = Math.sin(this.heading) * reach;
    const fz = Math.cos(this.heading) * reach;
    out[0].x = this.position.x + fx; out[0].z = this.position.z + fz;
    out[1].x = this.position.x - fx; out[1].z = this.position.z - fz;
    return out;
  }

  /**
   * Drive one step. `controls` = { throttle, brake, steer, handbrake } (0..1, steer -1..1),
   * or null for an empty car rolling to a stop. `world` resolves collisions.
   */
  update(dt, controls, world) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let forward = this.velocity.x * fx + this.velocity.z * fz;
    let latX = this.velocity.x - fx * forward;
    let latZ = this.velocity.z - fz * forward;
    let grip = 12;

    if (controls) {
      this.asleep = false;
      const steerLimit = MAX_STEER / (1 + Math.abs(forward) * 0.045);
      this.steer += (controls.steer * steerLimit - this.steer) * damp(8, dt);
      if (controls.throttle > 0) {
        if (forward < -0.5) forward += BRAKE * dt;
        else forward += this.type.accel * controls.throttle * (1 - Math.max(0, forward) / this.type.maxSpeed) * dt;
      }
      if (controls.brake > 0) {
        if (forward > 0.5) forward -= BRAKE * dt;
        else if (forward > -MAX_REVERSE) forward -= REVERSE_ACCEL * dt;
      }
      grip = this.type.grip;
      if (controls.handbrake) {
        grip = 1.4;
        forward -= Math.sign(forward) * Math.min(Math.abs(forward), 9 * dt);
      }
      // Air drag and rolling resistance.
      forward -= forward * 0.06 * dt;
      if (!controls.throttle && !controls.brake) forward -= Math.sign(forward) * Math.min(Math.abs(forward), 1.6 * dt);
    } else {
      this.steer += (0 - this.steer) * damp(4, dt);
      forward *= Math.exp(-2.2 * dt);
      if (Math.abs(forward) < 0.05) forward = 0;
    }

    const lateralBefore = Math.hypot(latX, latZ);
    const keep = Math.exp(-grip * dt);
    latX *= keep;
    latZ *= keep;
    const yawRate = (forward * Math.tan(this.steer)) / this.wheelbase * (controls?.handbrake ? 1.35 : 1);
    this.velocity.set(fx * forward + latX, 0, fz * forward + latZ);
    this.heading += yawRate * dt;
    this.forwardSpeed = forward;
    this.position.addScaledVector(this.velocity, dt);

    this.collideWithCity(world);
    // Ride up onto kerbs and sidewalks.
    this.position.y += (world.groundHeight(this.position.x, this.position.z) - this.position.y) * damp(18, dt);
    // Body lean into corners and pitch under acceleration, purely visual.
    this.lean += (clamp(-yawRate * forward * 0.012 - lateralBefore * 0.01, -0.09, 0.09) - this.lean) * damp(6, dt);
    if (this.velocity.lengthSq() < 0.0004 && !controls) this.asleep = true;
    this.syncModel(dt);
  }

  collideWithCity(world) {
    const circles = this.circles(Car.scratch);
    let pushX = 0;
    let pushZ = 0;
    for (const c of circles) {
      const p = { x: c.x + pushX, z: c.z + pushZ };
      const push = world.resolveCircle(p, this.radius);
      pushX += push.x;
      pushZ += push.z;
    }
    this.lastImpact = 0;
    const length = Math.hypot(pushX, pushZ);
    if (length < 1e-6) return;
    this.position.x += pushX;
    this.position.z += pushZ;
    const nx = pushX / length;
    const nz = pushZ / length;
    const into = this.velocity.x * nx + this.velocity.z * nz;
    if (into < 0) {
      this.velocity.x -= nx * into * 1.35;
      this.velocity.z -= nz * into * 1.35;
      this.velocity.multiplyScalar(0.88);
      this.lastImpact = -into;
    }
  }

  syncModel(dt) {
    this.model.position.copy(this.position);
    this.model.rotation.y = this.heading;
    this.body.rotation.z = this.lean;
    for (const wheel of this.wheels) {
      wheel.spin.rotation.x += (this.forwardSpeed / this.type.wheelR) * dt;
      if (wheel.front) wheel.pivot.rotation.y = this.steer;
    }
  }

  /** Speed in km/h for the HUD. */
  get speedKmh() { return Math.abs(this.forwardSpeed) * 3.6; }
}
Car.scratch = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
