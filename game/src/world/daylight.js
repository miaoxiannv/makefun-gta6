import * as THREE from 'three';
import { clamp, smoothstep } from '../core/rng.js';

const KEYS = [
  { h: 0, zenith: '#060a1c', horizon: '#1a2340', sun: '#6a7cc8', sunI: 0.4, hemiSky: '#3b4c86', hemiGround: '#1a1824', hemiI: 0.6, fog: '#141b33' },
  { h: 5, zenith: '#0b1330', horizon: '#3b3555', sun: '#7a86c8', sunI: 0.4, hemiSky: '#3e4878', hemiGround: '#1a1822', hemiI: 0.8, fog: '#252a45' },
  { h: 6.3, zenith: '#3a5d9a', horizon: '#ffb48a', sun: '#ffb27a', sunI: 1.2, hemiSky: '#8fa6d4', hemiGround: '#5a4636', hemiI: 0.7, fog: '#e7b8a0' },
  { h: 8, zenith: '#3f86d8', horizon: '#cfe3f2', sun: '#fff0d6', sunI: 2.6, hemiSky: '#b9d6f2', hemiGround: '#6b5a44', hemiI: 0.9, fog: '#cfe0ea' },
  { h: 13, zenith: '#2b7fe0', horizon: '#c4e2f5', sun: '#fffaf0', sunI: 3.1, hemiSky: '#c3dcf5', hemiGround: '#74624a', hemiI: 1.0, fog: '#cfe4f0' },
  { h: 16.5, zenith: '#3a7ccc', horizon: '#f2dcb8', sun: '#ffe2b0', sunI: 2.8, hemiSky: '#c2d4ea', hemiGround: '#7a5e44', hemiI: 0.9, fog: '#ead8bd' },
  { h: 18.2, zenith: '#4a5fa8', horizon: '#ff9a5c', sun: '#ff9550', sunI: 2.0, hemiSky: '#b39ac4', hemiGround: '#6a4434', hemiI: 0.75, fog: '#f0a77c' },
  { h: 19.3, zenith: '#2a2f6e', horizon: '#e0608a', sun: '#ff6a5a', sunI: 0.6, hemiSky: '#6b5a92', hemiGround: '#2a1e26', hemiI: 0.55, fog: '#8a4f6e' },
  { h: 20.5, zenith: '#0b1030', horizon: '#3a2f5e', sun: '#7a86c8', sunI: 0.4, hemiSky: '#45508a', hemiGround: '#1c1824', hemiI: 0.6, fog: '#22223f' },
  { h: 24, zenith: '#060a1c', horizon: '#1a2340', sun: '#6a7cc8', sunI: 0.4, hemiSky: '#3b4c86', hemiGround: '#1a1824', hemiI: 0.6, fog: '#141b33' },
];
const COLOURS = ['zenith', 'horizon', 'sun', 'hemiSky', 'hemiGround', 'fog'];
for (const k of KEYS) for (const c of COLOURS) k[c] = new THREE.Color(k[c]);

export function sampleDaylight(hour, out = makeDaylight()) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (KEYS[i + 1].h < h) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smoothstep(0, 1, (h - a.h) / (b.h - a.h));
  for (const c of COLOURS) out[c].copy(a[c]).lerp(b[c], t);
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;

  const dayT = (h - 6) / 13;
  const sunUp = dayT > 0 && dayT < 1;
  const arc = Math.PI * clamp(dayT, 0, 1);
  out.sunDir.set(Math.cos(arc), Math.sin(arc) * 0.9 + 0.04, 0.35).normalize();
  
  const nightT = ((h + 24 - 19) % 24) / 11;
  const moonArc = Math.PI * clamp(nightT, 0, 1);
  out.moonDir.set(Math.cos(moonArc), Math.sin(moonArc) * 0.8 + 0.1, -0.3).normalize();
  out.lightDir.copy(sunUp ? out.sunDir : out.moonDir);
  if (out.lightDir.y < 0.12) out.lightDir.y = 0.12;
  out.lightDir.normalize();

  out.night = 1 - smoothstep(5.4, 7.0, h) + smoothstep(18.6, 20.2, h);
  out.night = clamp(out.night, 0, 1);
  out.sunVisible = sunUp ? smoothstep(-0.02, 0.08, out.sunDir.y) : 0;
  out.hour = h;
  return out;
}

export function makeDaylight() {
  const d = { sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), lightDir: new THREE.Vector3() };
  for (const c of COLOURS) d[c] = new THREE.Color();
  return d;
}

export function clockText(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}