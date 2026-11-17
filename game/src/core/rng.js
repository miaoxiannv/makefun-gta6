// Seeded randomness and the small maths helpers the rest of the game shares. Everything
// random in the city comes from a seeded generator, so the same seed always builds the same
// Port Solano and the ?shot= screenshot scenes are reproducible frame for frame.

/** Mulberry32: a tiny, fast 32-bit PRNG. Returns a function giving floats in [0, 1). */
export function makeRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  return next;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (lo, hi, v) => {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/** Move angle `from` toward `to` by at most `step`, the short way round. */
export function approachAngle(from, to, step) {
  const d = wrapAngle(to - from);
  return Math.abs(d) <= step ? to : from + Math.sign(d) * step;
}

/** Frame-rate independent exponential smoothing factor for a rate in 1/s. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
