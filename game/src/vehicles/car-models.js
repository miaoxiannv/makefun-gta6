// Vehicle types and their procedural meshes: body, tapered glass cabin, roof, bumpers,
// head and tail lights, and four wheels with steering pivots and visible spokes.
import * as THREE from 'three';
import { mergeByMaterial } from '../core/merge-geometry.js';

/** Each type: dimensions in metres and its handling (top speed m/s, acceleration, grip). */
export const CAR_TYPES = {
  sports: { label: 'Kestrel GT', length: 4.3, width: 1.95, bodyH: 0.48, clearance: 0.26, cabinH: 0.44, cabinLen: 1.9, cabinZ: -0.3, taper: [0.8, 0.62], wheelR: 0.36, maxSpeed: 54, accel: 17, grip: 7.5, mass: 1.1, stripe: true },
  sedan: { label: 'Mariner', length: 4.6, width: 1.88, bodyH: 0.58, clearance: 0.3, cabinH: 0.54, cabinLen: 2.4, cabinZ: -0.15, taper: [0.86, 0.74], wheelR: 0.36, maxSpeed: 41, accel: 12, grip: 6.5, mass: 1.3 },
  taxi: { label: 'Bayline Cab', length: 4.6, width: 1.88, bodyH: 0.58, clearance: 0.3, cabinH: 0.54, cabinLen: 2.4, cabinZ: -0.15, taper: [0.86, 0.74], wheelR: 0.36, maxSpeed: 40, accel: 12, grip: 6.5, mass: 1.3, sign: true, color: '#f4c21b' },
  suv: { label: 'Ridgeback', length: 4.8, width: 2.04, bodyH: 0.78, clearance: 0.42, cabinH: 0.64, cabinLen: 2.9, cabinZ: -0.35, taper: [0.92, 0.86], wheelR: 0.44, maxSpeed: 37, accel: 11, grip: 6, mass: 1.8 },
};

export const CAR_COLORS = ['#e8443a', '#f7f4ee', '#1d2530', '#2f74c9', '#f29a2e', '#7fd1c3', '#c23b7a', '#9aa3ab', '#3c8a4c', '#efd36a'];

const materialCache = new Map();
function cachedMaterial(key, make) {
  if (!materialCache.has(key)) materialCache.set(key, make());
  return materialCache.get(key);
}

const shared = {
  glass: () => cachedMaterial('glass', () => new THREE.MeshStandardMaterial({ color: '#16202b', roughness: 0.08, metalness: 0.9 })),
  trim: () => cachedMaterial('trim', () => new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.6 })),
  tire: () => cachedMaterial('tire', () => new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.9 })),
  rim: () => cachedMaterial('rim', () => new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.3, metalness: 0.8 })),
  head: () => cachedMaterial('head', () => new THREE.MeshStandardMaterial({ color: '#fffbea', emissive: new THREE.Color('#fff3c4'), emissiveIntensity: 0.6 })),
  tail: () => cachedMaterial('tail', () => new THREE.MeshStandardMaterial({ color: '#c0141c', emissive: new THREE.Color('#ff2020'), emissiveIntensity: 0.5 })),
  stripe: () => cachedMaterial('stripe', () => new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4 })),
};

function paint(color) {
  return cachedMaterial(`paint:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.45 }));
}

/** A box whose top face is narrowed by `taper` = [x, z], for cabins. */
function taperedBox(w, h, d, [tx, tz]) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const position = geometry.attributes.position;
  for (let k = 0; k < position.count; k += 1) {
    if (position.getY(k) > 0) {
      position.setX(k, position.getX(k) * tx);
      position.setZ(k, position.getZ(k) * tz - d * 0.06);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function add(parent, geometry, material, x, y, z, shadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
}

/**
 * Build a car of `typeName` facing +z with its wheels on y = 0.
 * Returns { root, body, wheels: [{ pivot, spin, front }], wheelbase }.
 */
export function buildCarModel(typeName, color) {
  const t = CAR_TYPES[typeName];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bodyPaint = paint(t.color ?? color);
  const baseY = t.clearance + t.bodyH / 2;

  add(body, new THREE.BoxGeometry(t.width, t.bodyH, t.length), bodyPaint, 0, baseY, 0);
  const cabinY = t.clearance + t.bodyH + t.cabinH / 2;
  add(body, taperedBox(t.width * 0.9, t.cabinH, t.cabinLen, t.taper), shared.glass(), 0, cabinY, t.cabinZ);
  add(body, new THREE.BoxGeometry(t.width * 0.9 * t.taper[0] - 0.04, 0.07, t.cabinLen * t.taper[1] * 0.82), bodyPaint, 0, cabinY + t.cabinH / 2 + 0.02, t.cabinZ - t.cabinLen * 0.06);
  for (const end of [-1, 1]) {
    add(body, new THREE.BoxGeometry(t.width + 0.04, 0.22, 0.22), shared.trim(), 0, t.clearance + 0.12, end * (t.length / 2 + 0.02));
  }
  add(body, new THREE.BoxGeometry(t.width * 0.5, 0.16, 0.04), shared.trim(), 0, baseY + 0.02, t.length / 2 + 0.01, false);

  for (const side of [-1, 1]) {
    add(body, new THREE.BoxGeometry(0.42, 0.13, 0.06), shared.head(), side * t.width * 0.33, baseY + t.bodyH * 0.18, t.length / 2 + 0.01, false);
    add(body, new THREE.BoxGeometry(0.4, 0.12, 0.06), shared.tail(), side * t.width * 0.33, baseY + t.bodyH * 0.2, -t.length / 2 - 0.01, false);
    // Side mirrors.
    add(body, new THREE.BoxGeometry(0.16, 0.1, 0.12), bodyPaint, side * (t.width / 2 + 0.06), cabinY - t.cabinH * 0.25, t.cabinZ + t.cabinLen * 0.38, false);
  }
  if (t.stripe) {
    add(body, new THREE.BoxGeometry(0.34, 0.02, t.length * 0.98), shared.stripe(), 0, t.clearance + t.bodyH + 0.005, 0, false);
  }
  if (t.sign) {
    const sign = add(body, new THREE.BoxGeometry(0.7, 0.2, 0.25), cachedMaterial('taxiSign', () => new THREE.MeshStandardMaterial({ color: '#fffbe0', emissive: new THREE.Color('#ffd84a'), emissiveIntensity: 0.4 })), 0, cabinY + t.cabinH / 2 + 0.16, t.cabinZ);
    sign.castShadow = false;
  }
  mergeByMaterial(body);

  const wheels = [];
  const tireGeometry = new THREE.CylinderGeometry(t.wheelR, t.wheelR, 0.27, 18);
  tireGeometry.rotateZ(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(t.wheelR * 0.62, t.wheelR * 0.62, 0.29, 12);
  rimGeometry.rotateZ(Math.PI / 2);
  const spokeGeometry = new THREE.BoxGeometry(0.3, t.wheelR * 1.15, 0.09);
  const wheelbase = t.length * 0.62;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (t.width / 2 - 0.14), t.wheelR, sz * wheelbase / 2);
    const spin = new THREE.Group();
    pivot.add(spin);
    add(spin, tireGeometry, shared.tire(), 0, 0, 0);
    add(spin, rimGeometry, shared.rim(), 0, 0, 0, false);
    add(spin, spokeGeometry, shared.tire(), 0, 0, 0, false);
    const crossSpoke = add(spin, spokeGeometry, shared.tire(), 0, 0, 0, false);
    crossSpoke.rotation.x = Math.PI / 2;
    mergeByMaterial(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front: sz > 0 });
  }
  return { root, body, wheels, wheelbase };
}
