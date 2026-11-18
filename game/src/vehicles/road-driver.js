// Lane-following driver for AI cars: picks a leg (one road segment between two adjacent
// intersections), steers the car along the right-hand lane, and chooses the next leg at
// each intersection. The caller supplies `pickNext(from, to)` — the next intersection to
// head for — so traffic wanders and police can steer toward the player. Turns are cut
// smoothly: once the car is close to the corner, the aim point moves past it onto the
// next leg's lane.
import { GRID } from '../config.js';
import { roadCentre } from '../city/plan.js';
import { clamp, wrapAngle } from '../core/rng.js';

/** Lane centre offset from the road centre line (lane dashes sit at ±3.6 m). */
const LANE = 3.6;
/** How far ahead of the car the aim point sits, along the driven path. */
const LOOKAHEAD = 14;

/** Geometry of the leg from intersection `from` to adjacent intersection `to`. */
export function legInfo(from, to) {
  const axis = to.ix !== from.ix ? 'x' : 'z';
  const dir = Math.sign(axis === 'x' ? to.ix - from.ix : to.iz - from.iz) || 1;
  const fixed = axis === 'x' ? roadCentre(from.iz) : roadCentre(from.ix);
  // right-hand traffic: heading south (+z) keeps right on the west side, east (+x) on the south
  const lane = fixed + (axis === 'z' ? (dir > 0 ? -LANE : LANE) : (dir > 0 ? LANE : -LANE));
  const start = axis === 'x' ? roadCentre(from.ix) : roadCentre(from.iz);
  return { axis, dir, lane, start, from, to };
}

/** The lane point `dist` metres past `from` along the leg. */
export function lanePointAt(info, dist) {
  const s = info.start + info.dir * dist;
  return info.axis === 'z' ? { x: info.lane, z: s } : { x: s, z: info.lane };
}

/** Heading (radians) of a car driving the leg's direction. */
export function legHeading(info) {
  if (info.axis === 'z') return info.dir > 0 ? 0 : Math.PI;
  return info.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}

export class RoadDriver {
  /**
   * `car` is the Car to drive; `pickNext(from, to)` returns the next intersection
   * `{ix, iz}` when the car reaches `to`.
   */
  constructor(car, pickNext) {
    this.car = car;
    this.pickNext = pickNext;
    this.leg = null;
    this.nextLeg = null;
  }

  /** Put the car on the leg from intersection `from` to adjacent intersection `to`. */
  setLeg(from, to) {
    this.leg = legInfo(from, to);
    this.nextLeg = null;
  }

  /** The intersection the car is heading for. */
  get target() {
    return this.leg?.to ?? null;
  }

  /** Metres along the current leg to the target intersection. */
  distToTarget() {
    if (!this.leg) return Infinity;
    const s = this.leg.axis === 'z' ? this.car.position.z : this.car.position.x;
    const end = this.leg.axis === 'z' ? roadCentre(this.leg.to.iz) : roadCentre(this.leg.to.ix);
    return Math.abs(end - s);
  }

  /** Pick the next leg once close to the corner, and turn onto it at the intersection. */
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

  /** The aim point: `LOOKAHEAD` metres ahead along the driven path, around the corner. */
  aimPoint() {
    const distTo = this.distToTarget();
    if (this.nextLeg && distTo < LOOKAHEAD) {
      // part of the lookahead falls past the corner, on the next leg's lane
      const overshoot = LOOKAHEAD - distTo;
      return lanePointAt(this.nextLeg, overshoot);
    }
    const s = this.leg.axis === 'z' ? this.car.position.z : this.car.position.x;
    const distAlong = (s - this.leg.start) * this.leg.dir;
    return lanePointAt(this.leg, Math.max(0, distAlong) + LOOKAHEAD);
  }

  /**
   * Controls to follow the lane. `speed` is the cruise speed; `brake` (0..1) is how hard
   * to brake for something ahead. Returns a controls record for Car.update.
   */
  controls(speed, brake = 0) {
    this.maybeAdvance();
    const car = this.car;
    const aim = this.aimPoint();
    const desired = Math.atan2(aim.x - car.position.x, aim.z - car.position.z);
    const diff = wrapAngle(desired - car.heading);
    const moving = Math.abs(car.forwardSpeed);
    let throttle = moving < speed ? 1 : 0;
    let braking = brake;
    if (Math.abs(diff) > 0.9) throttle = 0.5; // ease off for the turn
    if (Math.abs(diff) > 1.4) { throttle = 0; braking = Math.max(braking, 0.6); }
    return { throttle, brake: braking, steer: clamp(diff * 2, -1, 1), handbrake: false };
  }
}

/** The intersection indices nearest a world position. */
export function nearestIntersection(x, z) {
  const idx = (v) => Math.max(0, Math.min(GRID.blocks, Math.round((v - roadCentre(0)) / (GRID.block + GRID.road))));
  return { ix: idx(x), iz: idx(z) };
}
