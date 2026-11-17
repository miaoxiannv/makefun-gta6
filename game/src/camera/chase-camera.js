// The third-person camera. On foot it orbits the player wherever the mouse or Q/E puts it;
// in a car it swings in behind the bonnet after a moment of no input, hangs further back and
// widens its field of view as speed builds. It never goes below the street, pulls in rather
// than clipping through a wall and shakes on hard crashes.
import * as THREE from 'three';
import { CHASE_CAM } from '../config.js';
import { approachAngle, clamp, damp } from '../core/rng.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.22;
    this.zoom = 1;
    this.shake = 0;
    this.idle = 0;
    this.distance = CHASE_CAM.footDistance;
    this.lift = CHASE_CAM.footLift;
    this.target = new THREE.Vector3();
    this.smoothed = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.time = 0;
  }

  /** Jump straight to a framing with no easing (new game, respawn, screenshots). */
  snap(focus, yaw = focus.heading, pitch = this.pitch, collision = null) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.distance = focus.inCar ? CHASE_CAM.carDistance : CHASE_CAM.footDistance;
    this.lift = focus.inCar ? CHASE_CAM.carLift : CHASE_CAM.footLift;
    this.target.copy(focus.position).y += this.lift;
    this.place(collision);
    this.smoothed.copy(this.desired);
    this.apply(0, Math.abs(focus.speed ?? 0));
  }

  /**
   * Per frame: `look` is mouse movement {x, y, wheel}, `turn` is -1..1 from the Q/E keys.
   * `focus` is {position, heading, inCar, speed}.
   */
  update(dt, focus, look, turn, collision) {
    this.time += dt;
    const manual = Math.abs(look.x) + Math.abs(look.y) > 0 || turn !== 0;
    this.yaw -= look.x * CHASE_CAM.dragRate + turn * CHASE_CAM.keyRate * dt;
    this.pitch = clamp(this.pitch + look.y * CHASE_CAM.dragRate, CHASE_CAM.minPitch, CHASE_CAM.maxPitch);
    this.zoom = clamp(this.zoom + look.wheel * 0.1, 0.55, 1.8);
    this.idle = manual ? 0 : this.idle + dt;

    const speed = Math.abs(focus.speed ?? 0);
    if (focus.inCar && this.idle > CHASE_CAM.settleDelay && speed > 1.5) {
      // swing behind the car, faster the faster it goes; when reversing keep looking forward
      const rate = (0.8 + speed * 0.08) * Math.min(1, (this.idle - CHASE_CAM.settleDelay) * 1.5);
      this.yaw = approachAngle(this.yaw, focus.heading, rate * dt);
      this.pitch += (0.2 - this.pitch) * damp(1.2, dt);
    }

    const wantDistance = (focus.inCar ? CHASE_CAM.carDistance + speed * 0.05 : CHASE_CAM.footDistance) * this.zoom;
    const wantLift = focus.inCar ? CHASE_CAM.carLift : CHASE_CAM.footLift;
    this.distance += (wantDistance - this.distance) * damp(3, dt);
    this.lift += (wantLift - this.lift) * damp(3, dt);
    this.target.copy(focus.position).y += this.lift;
    this.place(collision);
    // follow tightly sideways so fast cornering does not lose the car
    this.smoothed.lerp(this.desired, damp(focus.inCar ? 12 : 16, dt));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.apply(dt, speed);
  }

  /** Work out where the camera wants to be, pulled in front of any wall in the way. */
  place(collision) {
    const cp = Math.cos(this.pitch);
    this.desired.set(
      this.target.x - Math.sin(this.yaw) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z - Math.cos(this.yaw) * cp * this.distance,
    );
    if (collision) {
      const t = collision.castRay(this.target, this.desired);
      if (t < 1) this.desired.lerpVectors(this.target, this.desired, Math.max(0.12, t - 0.04));
    }
    this.desired.y = Math.max(this.desired.y, 0.4);
  }

  apply(dt, speed) {
    const cam = this.camera;
    cam.position.copy(this.smoothed);
    if (this.shake > 0) {
      const s = this.shake * 0.25;
      cam.position.x += Math.sin(this.time * 71) * s;
      cam.position.y += Math.sin(this.time * 53 + 1) * s;
      cam.position.z += Math.sin(this.time * 67 + 2) * s;
    }
    const ahead = 1.5;
    cam.lookAt(this.target.x + Math.sin(this.yaw) * ahead, this.target.y - 0.2, this.target.z + Math.cos(this.yaw) * ahead);
    const fov = CHASE_CAM.fov + Math.min(1, speed / 45) * CHASE_CAM.speedFov;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (dt ? damp(3, dt) : 1);
      cam.updateProjectionMatrix();
    }
  }
}
