// The look of every hour: sky colours, sun colour and strength, ambient light and how much
// of the night glow (windows, lamps, headlights) is on. Keyframes blended by the clock.
import * as THREE from 'three';
import { smoothstep } from '../core/math.js';

const KEYS = [
  { hour: 0, top: '#0a1330', horizon: '#1d2547', sun: '#8ea4ff', sunPower: 0.35, ambient: 0.45 },
  { hour: 5, top: '#121f42', horizon: '#3e3b62', sun: '#ff9d72', sunPower: 0.35, ambient: 0.45 },
  { hour: 6.5, top: '#4e7fc0', horizon: '#ffb684', sun: '#ffb27c', sunPower: 1.7, ambient: 0.8 },
  { hour: 9, top: '#2f86e6', horizon: '#bfe3f7', sun: '#fff3dc', sunPower: 3.0, ambient: 1.0 },
  { hour: 15, top: '#2c82e2', horizon: '#c5e4f6', sun: '#fff0d2', sunPower: 3.0, ambient: 1.0 },
  { hour: 17.5, top: '#3d74c6', horizon: '#ffcf96', sun: '#ffc184', sunPower: 2.6, ambient: 0.9 },
  { hour: 19, top: '#2e3f7e', horizon: '#ff8c5e', sun: '#ff8150', sunPower: 1.3, ambient: 0.7 },
  { hour: 20.5, top: '#0f1a3c', horizon: '#2f2d55', sun: '#8ea4ff', sunPower: 0.35, ambient: 0.45 },
  { hour: 24, top: '#0a1330', horizon: '#1d2547', sun: '#8ea4ff', sunPower: 0.35, ambient: 0.45 },
];

const colorA = new THREE.Color();
const colorB = new THREE.Color();

function mixColor(target, a, b, t) {
  colorA.set(a);
  colorB.set(b);
  return target.copy(colorA).lerp(colorB, t);
}

/** Fill `out` with the lighting for `hour` (0..24) and return it. */
export function lightingAt(hour, out) {
  const h = ((hour % 24) + 24) % 24;
  let k = 0;
  while (k < KEYS.length - 2 && KEYS[k + 1].hour <= h) k += 1;
  const a = KEYS[k];
  const b = KEYS[k + 1];
  const t = (h - a.hour) / (b.hour - a.hour);
  mixColor(out.top, a.top, b.top, t);
  mixColor(out.horizon, a.horizon, b.horizon, t);
  mixColor(out.sun, a.sun, b.sun, t);
  out.sunPower = a.sunPower + (b.sunPower - a.sunPower) * t;
  out.ambient = a.ambient + (b.ambient - a.ambient) * t;
  out.night = Math.max(smoothstep(18.6, 20.4, h), 1 - smoothstep(5.2, 6.8, h));
  // The sun rises over the ocean (east, +x) and sets behind downtown; at night the moon takes over.
  const angle = ((h - 6) / 12) * Math.PI;
  const up = Math.sin(angle);
  if (up > -0.05) out.sunDirection.set(Math.cos(angle), Math.max(up, 0.06), -0.45).normalize();
  else out.sunDirection.set(-Math.cos(angle) * 0.6, 0.7, 0.35).normalize();
  out.isMoon = up <= -0.05;
  return out;
}

export function makeLighting() {
  return { top: new THREE.Color(), horizon: new THREE.Color(), sun: new THREE.Color(), sunPower: 1, ambient: 1, night: 0, sunDirection: new THREE.Vector3(0, 1, 0), isMoon: false };
}

/** "16:30" for a clock in hours. */
export function formatClock(hour) {
  const h = ((hour % 24) + 24) % 24;
  const hours = Math.floor(h);
  const minutes = Math.floor((h - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
