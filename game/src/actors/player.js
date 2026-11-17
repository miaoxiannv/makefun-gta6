// The player on foot: camera-relative walking and running, jumping with gravity, turning to
// face the way they move, collision with buildings and cars, and the walk animation.
import * as THREE from 'three';
import { PLAYER } from '../config.js';
import { damp, lerpAngle } from '../core/math.js';
import { buildCharacter, poseCharacter } from './character-model.js';

export class Player {
  constructor() {
    const { root, rig } = buildCharacter({ skin: '#c98d62', shirt: '#f2f2ee', pants: '#3a5f8f', shoes: '#e24b3b', hair: '#1d1611' });
    // A loud floral-print overshirt look: open shirt panels over the white tee.
    const print = new THREE.MeshStandardMaterial({ color: '#2bb3a3', roughness: 0.8 });
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.26), print);
      panel.position.set(side * 0.16, 0.27, 0.005);
      panel.castShadow = true;
      rig.chest.add(panel);
    }
    for (const arm of rig.arms) arm.shoulder.children[0].material = print;
    this.model = root;
    this.rig = rig;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.grounded = true;
    this.phase = 0;
    this.stride = 0;
    this.time = 0;
    this.vehicle = null;
  }

  placeAt(x, z, heading, ground = 0) {
    this.position.set(x, ground, z);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.syncModel();
  }

  /**
   * Walk for one step. `controls` = { moveX, moveY, run, jump }, `cameraYaw` orients them;
   * `world` offers resolveCircle, groundHeight and pushOutOfCars.
   */
  update(dt, controls, cameraYaw, world) {
    this.time += dt;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    let dirX = forwardX * controls.moveY + rightX * controls.moveX;
    let dirZ = forwardZ * controls.moveY + rightZ * controls.moveX;
    const length = Math.hypot(dirX, dirZ);
    const speed = length > 0 ? (controls.run ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
    if (length > 0) {
      dirX /= length;
      dirZ /= length;
      this.heading = lerpAngle(this.heading, Math.atan2(dirX, dirZ), damp(PLAYER.turnRate, dt));
    }
    const grip = this.grounded ? 12 : 2.5;
    this.velocity.x += (dirX * speed - this.velocity.x) * damp(grip, dt);
    this.velocity.z += (dirZ * speed - this.velocity.z) * damp(grip, dt);

    if (controls.jump && this.grounded) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.grounded = false;
    }
    this.velocity.y -= PLAYER.gravity * dt;
    this.position.addScaledVector(this.velocity, dt);

    world.resolveCircle(this.position, PLAYER.radius);
    world.pushOutOfCars(this.position, PLAYER.radius);
    const ground = world.groundHeight(this.position.x, this.position.z);
    const stepDown = this.grounded && this.velocity.y <= 0 && this.position.y - ground < 0.25;
    if (this.position.y <= ground || stepDown) {
      // Landed, or stepping up or down a kerb.
      this.position.y = ground;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    const planar = Math.hypot(this.velocity.x, this.velocity.z);
    this.stride += (Math.min(1, planar / PLAYER.runSpeed) - this.stride) * damp(10, dt);
    this.phase += planar * dt * 1.6;
    this.syncModel();
  }

  syncModel() {
    this.model.position.copy(this.position);
    this.model.rotation.y = this.heading;
    poseCharacter(this.rig, { phase: this.phase, stride: this.stride, airborne: !this.grounded, time: this.time });
  }
}
