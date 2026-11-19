import * as THREE from 'three';
import { WALKER } from '../config.js';
import { approachAngle, damp } from '../core/rng.js';
import { PersonModel } from './person-model.js';

export class Player {
  constructor() {
    this.model = new PersonModel();
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.onGround = true;
    this.phase = 0;
    this.gait = 0;
    this.vehicle = null;
    this.time = 0;
    this.punchTimer = 0; 
    this.attackCooldown = 0; 
  }

  get object() {
    return this.model.root;
  }

  placeAt(x, z, heading, y = 0) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.onGround = true;
    this.sync();
  }

  punch() {
    this.punchTimer = 0.25;
    this.attackCooldown = 0.45;
  }

  update(dt, controls, yaw, world) {
    this.time += dt;
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    
    let wx = fx * controls.moveY - fz * controls.moveX;
    let wz = fz * controls.moveY + fx * controls.moveX;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const speed = controls.run ? WALKER.sprint : WALKER.walk;

    const k = damp(this.onGround ? WALKER.accel / speed : 1.5, dt);
    this.velocity.x += (wx * speed - this.velocity.x) * k;
    this.velocity.z += (wz * speed - this.velocity.z) * k;
    if (len > 0.1) this.heading = approachAngle(this.heading, Math.atan2(wx, wz), WALKER.turn * dt);

    if (controls.jump && this.onGround) {
      this.velocity.y = WALKER.jump;
      this.onGround = false;
    }
    this.velocity.y -= WALKER.gravity * dt;
    this.position.addScaledVector(this.velocity, dt);

    world.resolveCircle(this.position, WALKER.radius);
    world.pushOutOfCars(this.position, WALKER.radius);
    const ground = world.groundHeight(this.position.x, this.position.z);
    if (this.position.y <= ground + 0.02 || (this.onGround && this.position.y - ground < 0.35)) {
      
      this.position.y = ground;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    const flat = Math.hypot(this.velocity.x, this.velocity.z);
    this.gait = flat < 0.2 ? 0 : flat <= WALKER.walk ? flat / WALKER.walk : 1 + (flat - WALKER.walk) / (WALKER.sprint - WALKER.walk);
    this.phase += dt * flat * 2.1;
    this.sync();
  }

  sync() {
    const root = this.model.root;
    root.position.copy(this.position);
    root.rotation.y = this.heading;
    this.model.pose(this.phase, this.gait, !this.onGround, this.time);
    if (this.punchTimer > 0) {
      
      this.model.armR.rotation.x = -1.5;
      this.model.armR.rotation.z = 0;
      this.model.armR.knee.rotation.x = -0.1;
    }
  }
}