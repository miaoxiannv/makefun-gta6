import { GRID } from '../config.js';
import { roadCentre } from '../city/plan.js';
import { clamp, wrapAngle } from '../core/rng.js';

const LANE = 3.6;

const LOOKAHEAD = 14;

export function legInfo(from, to) {
  const axis = to.ix !== from.ix ? 'x' : 'z';
  const dir = Math.sign(axis === 'x' ? to.ix - from.ix : to.iz - from.iz) || 1;
  const fixed = axis === 'x' ? roadCentre(from.iz) : roadCentre(from.ix);
  
  const lane = fixed + (axis === 'z' ? (dir > 0 ? -LANE : LANE) : (dir > 0 ? LANE : -LANE));
  const start = axis === 'x' ? roadCentre(from.ix) : roadCentre(from.iz);
  return { axis, dir, lane, start, from, to };
}

export function lanePointAt(info, dist) {
  const s = info.start + info.dir * dist;
  return info.axis === 'z' ? { x: info.lane, z: s } : { x: s, z: info.lane };
}

export function legHeading(info) {
  if (info.axis === 'z') return info.dir > 0 ? 0 : Math.PI;
  return info.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}

export class RoadDriver {
  
  constructor(car, pickNext) {
    this.car = car;
    this.pickNext = pickNext;
    this.leg = null;
    this.nextLeg = null;
  }

  setLeg(from, to) {
    this.leg = legInfo(from, to);
    this.nextLeg = null;
  }

  get target() {
    return this.leg?.to ?? null;
  }

  distToTarget() {
    if (!this.leg) return Infinity;
    const s = this.leg.axis === 'z' ? this.car.position.z : this.car.position.x;
    const end = this.leg.axis === 'z' ? roadCentre(this.leg.to.iz) : roadCentre(this.leg.to.ix);
    return Math.abs(end - s);
  }

  maybeAdvance() {
    if (!this.leg) return;
    if (this.distToTarget() < LOOKAHEAD + 8 && !this.nextLeg) {
      this.nextLeg = legInfo(this.leg.to, this.pickNext(this.leg.from, this.leg.to));
    }
    const s = this.leg.axis === 'z' ? this.car.position.z : this.car.position.x;
    const end = this.leg.axis === 'z' ? roadCentre(this.leg.to.iz) : roadCentre(this.leg.to.ix);
    const passed = this.leg.dir > 0 ? s >= end - 2 : s <= end + 2;
    if (passed && this.nextLeg) {
      this.leg = this.nextLeg;
      this.nextLeg = null;
    }
  }

  aimPoint() {
    const distTo = this.distToTarget();
    if (this.nextLeg && distTo < LOOKAHEAD) {
      
      const overshoot = LOOKAHEAD - distTo;
      return lanePointAt(this.nextLeg, overshoot);
    }
    const s = this.leg.axis === 'z' ? this.car.position.z : this.car.position.x;
    const distAlong = (s - this.leg.start) * this.leg.dir;
    return lanePointAt(this.leg, Math.max(0, distAlong) + LOOKAHEAD);
  }

  controls(speed, brake = 0) {
    this.maybeAdvance();
    const car = this.car;
    const aim = this.aimPoint();
    const desired = Math.atan2(aim.x - car.position.x, aim.z - car.position.z);
    const diff = wrapAngle(desired - car.heading);
    const moving = Math.abs(car.forwardSpeed);
    let throttle = moving < speed ? 1 : 0;
    let braking = brake;
    if (Math.abs(diff) > 0.9) throttle = 0.5; 
    if (Math.abs(diff) > 1.4) { throttle = 0; braking = Math.max(braking, 0.6); }
    return { throttle, brake: braking, steer: clamp(diff * 2, -1, 1), handbrake: false };
  }
}

export function nearestIntersection(x, z) {
  const idx = (v) => Math.max(0, Math.min(GRID.blocks, Math.round((v - roadCentre(0)) / (GRID.block + GRID.road))));
  return { ix: idx(x), iz: idx(z) };
}