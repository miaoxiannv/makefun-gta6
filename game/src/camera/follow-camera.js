// Third-person chase camera: orbits the player on foot (mouse drag, Q/E), swings in behind
// the car while driving (drag to look around, it recentres), zooms with the wheel, widens
// its field of view with speed and pulls in rather than clip through buildings.
import * as THREE from 'three';
import { CAMERA } from '../config.js';
import { clamp, damp, lerpAngle, wrapAngle } from '../core/math.js';

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.28;
    this.lookOffset = 0;
    this.zoom = 1;
    this.distance = CAMERA.footDistance;
    this.target = new THREE.Vector3();
    this.sinceDrag = 99;
    this.shake = 0;
  }

  /** Jump straight to a framing with no smoothing (spawns, cut-scenes, shots). */
  snap(focus, yaw, pitch = this.pitch) {
    this.target.copy(focus.position);
    this.target.y += focus.inCar ? CAMERA.carHeight : CAMERA.footHeight;
    this.yaw = yaw;
    this.pitch = pitch;
    this.lookOffset = 0;
    this.distance = focus.inCar ? CAMERA.carDistance : CAMERA.footDistance;
    this.place(focus, null);
  }

  /**
   * Follow `focus` = { position, heading, inCar, speed }. `mouse` = { dragX, dragY, wheel },
   * `turn` = -1..1 from Q/E. `colliders` keeps the lens out of walls.
   */
  update(dt, focus, mouse, turn, colliders) {
    const dragging = mouse.dragX !== 0 || mouse.dragY !== 0;
    this.sinceDrag = dragging ? 0 : this.sinceDrag + dt;
    this.zoom = clamp(this.zoom + mouse.wheel * 0.1, 0.6, 1.8);
    this.pitch = clamp(this.pitch + mouse.dragY * CAMERA.dragSensitivity, CAMERA.minPitch, CAMERA.maxPitch);

    if (focus.inCar) {
      this.lookOffset = wrapAngle(this.lookOffset - mouse.dragX * CAMERA.dragSensitivity - turn * CAMERA.keyTurnSpeed * dt);
      if (this.sinceDrag > CAMERA.recenterDelay && turn === 0) this.lookOffset += (0 - this.lookOffset) * damp(2.5, dt);
      const behind = (focus.speed < -1 ? focus.heading : focus.heading + Math.PI) + this.lookOffset;
      this.yaw = lerpAngle(this.yaw, behind, damp(this.sinceDrag < 0.2 ? 30 : 4, dt));
      if (this.sinceDrag > CAMERA.recenterDelay) this.pitch += (0.2 - this.pitch) * damp(1.5, dt);
    } else {
      this.yaw = wrapAngle(this.yaw - mouse.dragX * CAMERA.dragSensitivity - turn * CAMERA.keyTurnSpeed * dt);
      this.lookOffset = 0;
    }

    const height = focus.inCar ? CAMERA.carHeight : CAMERA.footHeight;
    const goal = this.target.clone().set(focus.position.x, focus.position.y + height, focus.position.z);
    this.target.lerp(goal, damp(focus.inCar ? 14 : 18, dt));
    const wanted = (focus.inCar ? CAMERA.carDistance + Math.abs(focus.speed) * 0.07 : CAMERA.footDistance) * this.zoom;
    this.distance += (wanted - this.distance) * damp(3, dt);
    const fov = CAMERA.fov + (focus.inCar ? Math.min(14, Math.abs(focus.speed) * 0.3) : 0);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * damp(3, dt);
      this.camera.updateProjectionMatrix();
    }
    this.shake = Math.max(0, this.shake - dt * 2);
    this.place(focus, colliders);
  }

  /** Put the lens at yaw/pitch/distance around the target, shortened if a building is in the way. */
  place(focus, colliders) {
    const cosPitch = Math.cos(this.pitch);
    const ox = Math.sin(this.yaw) * cosPitch;
    const oy = Math.sin(this.pitch);
    const oz = Math.cos(this.yaw) * cosPitch;
    let distance = this.distance;
    if (colliders) {
      const steps = 14;
      for (let k = 1; k <= steps; k += 1) {
        const d = (this.distance * k) / steps;
        if (colliders.insideBuilding(this.target.x + ox * d, this.target.y + oy * d, this.target.z + oz * d, 0.5)) {
          distance = Math.max(1.2, (this.distance * (k - 1)) / steps);
          break;
        }
      }
    }
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.4 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.4 : 0;
    this.camera.position.set(this.target.x + ox * distance + shakeX, Math.max(0.4, this.target.y + oy * distance) + shakeY, this.target.z + oz * distance);
    this.camera.lookAt(this.target.x, this.target.y + 0.2, this.target.z);
  }
}
