// Small numeric helpers shared by movement, camera and HUD code.

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent smoothing factor for a rate in 1/seconds. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(angle) {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Move angle `from` toward `to` by fraction `t` along the shortest way round. */
export const lerpAngle = (from, to, t) => from + wrapAngle(to - from) * t;

export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
