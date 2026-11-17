// A procedural low-poly person built from boxes and spheres, with jointed arms and legs,
// and the pose function that swings them for idle, walking, running and jumping.
import * as THREE from 'three';

const geometryCache = new Map();
function box(w, h, d) {
  const key = `${w}|${h}|${d}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geometryCache.get(key);
}

function part(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function joint(parent, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  return pivot;
}

/**
 * Build a person facing +z with feet at y = 0. `look` holds colours: skin, shirt, pants,
 * shoes, hair. Returns { root, rig } where rig holds the joints to animate.
 */
export function buildCharacter(look) {
  const m = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const skin = m(look.skin, 0.7);
  const shirt = m(look.shirt);
  const pants = m(look.pants);
  const shoes = m(look.shoes, 0.6);
  const hair = m(look.hair, 0.9);
  const dark = m('#111418', 0.3);

  const root = new THREE.Group();
  const body = joint(root, 0, 0.98, 0);
  body.add(part(box(0.34, 0.18, 0.21), pants, 0, 0, 0));

  const chest = joint(body, 0, 0.08, 0);
  chest.add(part(box(0.44, 0.5, 0.25), shirt, 0, 0.27, 0));
  chest.add(part(box(0.1, 0.08, 0.1), skin, 0, 0.56, 0));
  const head = joint(chest, 0, 0.64, 0);
  head.add(part(new THREE.SphereGeometry(0.13, 14, 10), skin, 0, 0.07, 0));
  const cap = part(new THREE.SphereGeometry(0.136, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.09, -0.012);
  head.add(cap);
  head.add(part(box(0.2, 0.045, 0.03), dark, 0, 0.09, 0.12)); // sunglasses

  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = joint(chest, side * 0.27, 0.48, 0);
    shoulder.add(part(box(0.12, 0.3, 0.13), shirt, 0, -0.13, 0));
    const elbow = joint(shoulder, 0, -0.3, 0);
    elbow.add(part(box(0.1, 0.27, 0.1), skin, 0, -0.13, 0));
    elbow.add(part(box(0.1, 0.09, 0.11), skin, 0, -0.3, 0.01));
    arms.push({ shoulder, elbow, side });
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const hip = joint(body, side * 0.1, -0.06, 0);
    hip.add(part(box(0.15, 0.44, 0.17), pants, 0, -0.22, 0));
    const knee = joint(hip, 0, -0.44, 0);
    knee.add(part(box(0.13, 0.42, 0.14), pants, 0, -0.2, 0));
    knee.add(part(box(0.14, 0.09, 0.27), shoes, 0, -0.44, 0.05));
    legs.push({ hip, knee, side });
  }

  return { root, rig: { body, chest, head, arms, legs } };
}

/**
 * Pose the rig. `phase` is the walk cycle in radians, `stride` 0 (still) .. 1 (full run),
 * `airborne` true while jumping, `time` for the idle breathing.
 */
export function poseCharacter(rig, { phase, stride, airborne, time }) {
  const swing = 0.25 + stride * 0.65;
  rig.body.position.y = 0.98 + (airborne ? 0 : Math.abs(Math.sin(phase)) * 0.06 * stride);
  rig.chest.rotation.x = stride * 0.22 + (airborne ? -0.1 : 0);
  rig.chest.rotation.y = Math.sin(phase) * 0.12 * stride;
  rig.chest.scale.y = 1 + Math.sin(time * 2.2) * 0.008 * (1 - stride);
  rig.head.rotation.x = -rig.chest.rotation.x * 0.6;

  for (const leg of rig.legs) {
    const s = Math.sin(phase + (leg.side > 0 ? Math.PI : 0));
    if (airborne) {
      leg.hip.rotation.x = leg.side > 0 ? -0.7 : -0.2;
      leg.knee.rotation.x = leg.side > 0 ? 1.1 : 0.4;
    } else {
      leg.hip.rotation.x = s * swing * stride;
      leg.knee.rotation.x = Math.max(0, -Math.cos(phase + (leg.side > 0 ? Math.PI : 0))) * stride * 1.2;
    }
  }
  for (const arm of rig.arms) {
    const s = Math.sin(phase + (arm.side > 0 ? 0 : Math.PI));
    if (airborne) {
      arm.shoulder.rotation.x = -2.2;
      arm.shoulder.rotation.z = arm.side * 0.4;
      arm.elbow.rotation.x = -0.3;
    } else {
      arm.shoulder.rotation.x = s * swing * stride * 0.9;
      arm.shoulder.rotation.z = arm.side * (0.08 + stride * 0.06);
      arm.elbow.rotation.x = -0.2 - stride * 0.9;
    }
  }
}
