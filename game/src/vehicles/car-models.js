// The car catalogue of Port Solano and the low-poly bodies that go with it. Each type is a set
// of proportions plus handling numbers; its body is built once (paint, glass, lamps) and shared
// by every car of that type, with paint colour and lamp brightness set per car.
import * as THREE from 'three';
import { MeshBuilder } from '../core/mesh-builder.js';

/**
 * length, width; `sill` and `belt` are the bottom and top of the lower body; the cabin spans
 * z in [c0, c1] at the beltline and [r0, r1] at the roof height `roof`. Handling: top speed
 * (m/s), engine force (m/s^2), grip (lateral damping), steering lock (radians).
 */
export const CAR_TYPES = {
  coupe: { label: 'Vela GT', length: 4.5, width: 1.95, sill: 0.28, belt: 0.82, roof: 1.25, c0: -1.5, c1: 0.75, r0: -1.05, r1: 0.05, wheel: 0.36, axle: 1.42, top: 58, power: 15, grip: 9, lock: 0.5, mass: 1.1, colours: ['#e3342f', '#f5c518', '#111111', '#f2f2f2', '#ff7a1a', '#1e88e5'] },
  sedan: { label: 'Mariner', length: 4.7, width: 1.9, sill: 0.32, belt: 0.95, roof: 1.5, c0: -1.6, c1: 1.0, r0: -1.25, r1: 0.45, wheel: 0.36, axle: 1.45, top: 46, power: 10, grip: 8, lock: 0.55, mass: 1.2, colours: ['#7a8b99', '#2f4b7c', '#d9d9d6', '#6b2737', '#1b1b1d', '#4e6e58', '#c9b38a'] },
  cab: { label: 'Sol Cab', length: 4.8, width: 1.92, sill: 0.32, belt: 0.95, roof: 1.52, c0: -1.6, c1: 1.0, r0: -1.25, r1: 0.45, wheel: 0.36, axle: 1.5, top: 44, power: 10, grip: 8, lock: 0.55, mass: 1.25, colours: ['#f7c51e'], sign: true, checker: true },
  suv: { label: 'Cayo Ridge', length: 4.9, width: 2.05, sill: 0.48, belt: 1.18, roof: 1.85, c0: -2.1, c1: 1.15, r0: -2.15, r1: 0.65, wheel: 0.44, axle: 1.55, top: 42, power: 9.5, grip: 7.5, lock: 0.5, mass: 1.6, colours: ['#f4f1ea', '#203040', '#8a2b2b', '#566b3d', '#3d3d40', '#b4a48a'] },
  pickup: { label: 'Tarpon 1500', length: 5.3, width: 2.05, sill: 0.5, belt: 1.15, roof: 1.85, c0: -0.4, c1: 1.2, r0: -0.35, r1: 0.75, wheel: 0.45, axle: 1.75, top: 40, power: 9, grip: 7, lock: 0.48, mass: 1.7, colours: ['#2b5d8a', '#b93a2a', '#e8e4da', '#3b3b3b', '#6f7d3f'], bed: true },
  /** Solano PD's interceptor: quick, heavy, and impossible to miss once the bar flashes. */
  police: { label: 'Solano PD Interceptor', length: 4.8, width: 1.95, sill: 0.32, belt: 0.95, roof: 1.5, c0: -1.6, c1: 1.0, r0: -1.25, r1: 0.45, wheel: 0.36, axle: 1.5, top: 52, power: 14, grip: 8.5, lock: 0.55, mass: 1.3, colours: ['#eef0f2'], lightbar: true },
};

const TRIM = new THREE.Color('#202224');
const CHROME = new THREE.Color('#c9ccd0');
const WHITE = new THREE.Color('#ffffff');

function buildBody(t) {
  const paint = new MeshBuilder();
  const glass = new MeshBuilder();
  const head = new MeshBuilder();
  const tail = new MeshBuilder();
  const L = t.length;
  const W = t.width;
  const front = L / 2;
  const back = -L / 2;

  // lower body with a slightly sloped hood and a dark bumper/sill band
  paint.wedge(0, t.sill + 0.12, t.belt, back, front, back + 0.05, front - 0.25, W, { inset: 0.04 });
  paint.box(0, t.sill + 0.06, 0, W - 0.06, 0.16, L - 0.1, { color: TRIM });
  paint.box(0, t.sill + 0.22, front - 0.05, W - 0.1, 0.22, 0.14, { color: TRIM });
  paint.box(0, t.sill + 0.22, back + 0.05, W - 0.1, 0.22, 0.14, { color: TRIM });

  if (t.bed) {
    // pickup: cab glass up front, open load bed behind
    glass.wedge(0, t.belt, t.roof - 0.06, t.c0, t.c1, t.r0, t.r1, W - 0.12, { inset: 0.06 });
    paint.box(0, t.roof - 0.03, (t.r0 + t.r1) / 2, W - 0.2, 0.08, t.r1 - t.r0 + 0.04);
    paint.box(0, t.belt + 0.2, back + 0.1, W, 0.4, 0.12);
    paint.box(W / 2 - 0.06, t.belt + 0.2, (back + t.c0) / 2, 0.12, 0.4, t.c0 - back);
    paint.box(-W / 2 + 0.06, t.belt + 0.2, (back + t.c0) / 2, 0.12, 0.4, t.c0 - back);
    paint.box(0, t.belt + 0.02, (back + t.c0) / 2, W - 0.2, 0.04, t.c0 - back, { color: TRIM });
  } else {
    glass.wedge(0, t.belt, t.roof - 0.05, t.c0, t.c1, t.r0, t.r1, W - 0.14, { inset: 0.12 });
    paint.wedge(0, t.roof - 0.06, t.roof, t.r0 - 0.02, t.r1 + 0.02, t.r0 + 0.05, t.r1 - 0.05, W - 0.36);
  }
  if (t.sign) {
    paint.box(0, t.roof + 0.16, (t.r0 + t.r1) / 2, 0.9, 0.26, 0.32, { color: WHITE });
    paint.box(0, t.roof + 0.16, (t.r0 + t.r1) / 2, 0.92, 0.1, 0.34, { color: TRIM });
  }
  if (t.checker) {
    for (let k = -4; k <= 4; k += 1) {
      const col = k % 2 ? TRIM : WHITE;
      paint.box(W / 2 + 0.005, t.belt - 0.12, k * 0.3, 0.02, 0.1, 0.3, { color: col });
      paint.box(-W / 2 - 0.005, t.belt - 0.12, k * 0.3, 0.02, 0.1, 0.3, { color: col });
    }
  }
  // mirrors, grille, rear plate
  paint.box(W / 2 + 0.1, t.belt + 0.08, t.c1 - 0.25, 0.18, 0.12, 0.2);
  paint.box(-W / 2 - 0.1, t.belt + 0.08, t.c1 - 0.25, 0.18, 0.12, 0.2);
  paint.box(0, t.sill + 0.42, front - 0.02, W * 0.45, 0.14, 0.06, { color: TRIM });
  paint.box(0, t.sill + 0.3, back - 0.06, 0.52, 0.13, 0.03, { color: CHROME });

  for (const s of [-1, 1]) {
    head.box(s * (W / 2 - 0.3), t.sill + 0.48, front - 0.08, 0.42, 0.13, 0.1);
    tail.box(s * (W / 2 - 0.25), t.sill + 0.5, back + 0.05, 0.36, 0.14, 0.1);
  }
  return { paint: paint.build(), glass: glass.build(), head: head.build(), tail: tail.build() };
}

const bodies = new Map();
let wheelParts = null;

function wheelGeometry() {
  if (!wheelParts) {
    wheelParts = {
      tyre: new THREE.CylinderGeometry(1, 1, 0.26, 16).rotateZ(Math.PI / 2),
      rim: new THREE.CylinderGeometry(0.62, 0.62, 0.28, 8).rotateZ(Math.PI / 2),
      tyreMat: new THREE.MeshStandardMaterial({ color: '#18191b', roughness: 0.9 }),
      rimMat: new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.3, metalness: 0.8 }),
    };
  }
  return wheelParts;
}

const glassMat = new THREE.MeshStandardMaterial({ color: '#4a6478', roughness: 0.08, metalness: 0.7, vertexColors: true });

/**
 * A new car body of `typeName` painted `colour`. Returns the root group (positioned by the
 * physics), the chassis that leans, the four wheels and the per-car materials.
 */
export function makeCarModel(typeName, colour) {
  const t = CAR_TYPES[typeName];
  if (!bodies.has(typeName)) bodies.set(typeName, buildBody(t));
  const geo = bodies.get(typeName);
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);

  const paintMat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.32, metalness: 0.45, vertexColors: true });
  const headMat = new THREE.MeshStandardMaterial({ color: '#fdf8e8', emissive: '#fff2c8', emissiveIntensity: 0, vertexColors: true });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#7a0d0d', emissive: '#ff1a10', emissiveIntensity: 0, vertexColors: true });
  for (const [g, mat, shadow] of [[geo.paint, paintMat, true], [geo.glass, glassMat, false], [geo.head, headMat, false], [geo.tail, tailMat, false]]) {
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    chassis.add(mesh);
  }

  const w = wheelGeometry();
  const wheels = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const steer = new THREE.Group();
    steer.position.set(x * (t.width / 2 - 0.11), t.wheel, z * t.axle);
    const spin = new THREE.Group();
    spin.scale.set(1, t.wheel, t.wheel);
    const tyre = new THREE.Mesh(w.tyre, w.tyreMat);
    tyre.castShadow = true;
    spin.add(tyre, new THREE.Mesh(w.rim, w.rimMat));
    steer.add(spin);
    root.add(steer);
    wheels.push({ steer, spin, front: z > 0 });
  }
  return { root, chassis, wheels, paintMat, headMat, tailMat, type: t };
}
