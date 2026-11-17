// Street furniture, drawn with instancing so hundreds cost a handful of draw calls: street
// lamps whose heads glow after dusk, royal palms along the beach, the boulevard and the parks,
// round-crowned shade trees in Palm Heights, benches and fountains in the parks. Each pole and
// trunk is also registered as a small solid box so you can drive into it.
import * as THREE from 'three';
import { CITY_HALF, CITY_SIZE, GRID } from '../config.js';
import { MeshBuilder } from '../core/mesh-builder.js';
import { makeRng } from '../core/rng.js';

const dummy = new THREE.Object3D();

function instanced(geometry, material, transforms, { shadows = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, transforms.length));
  transforms.forEach((t, i) => {
    dummy.position.set(t.x, t.y ?? 0, t.z);
    dummy.rotation.set(t.tilt ?? 0, t.yaw ?? 0, 0, 'YXZ');
    dummy.scale.setScalar(t.s ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.count = transforms.length;
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  return mesh;
}

/** A palm crown: drooping fronds radiating from the top of the trunk (origin). */
function palmCrown() {
  const b = new MeshBuilder();
  const green = new THREE.Color('#3f7d32');
  const dark = new THREE.Color('#2e5e25');
  for (let k = 0; k < 9; k += 1) {
    const a = (k / 9) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // each frond is two slanted segments: up-and-out, then out-and-down
    const seg = (r0, y0, r1, y1, w0, w1, col) => {
      const px = -s;
      const pz = c;
      b.quad(
        [c * r0 - px * w0, y0, s * r0 - pz * w0], [c * r0 + px * w0, y0, s * r0 + pz * w0],
        [c * r1 + px * w1, y1, s * r1 + pz * w1], [c * r1 - px * w1, y1, s * r1 - pz * w1], { color: col },
      );
      b.quad(
        [c * r1 - px * w1, y1, s * r1 - pz * w1], [c * r1 + px * w1, y1, s * r1 + pz * w1],
        [c * r0 + px * w0, y0, s * r0 + pz * w0], [c * r0 - px * w0, y0, s * r0 - pz * w0], { color: col },
      );
    };
    seg(0, 0, 2.2, 0.5, 0.15, 0.7, k % 2 ? green : dark);
    seg(2.2, 0.5, 4.2, -1.1, 0.7, 0.1, k % 2 ? green : dark);
  }
  b.box(0, -0.2, 0, 0.8, 0.8, 0.8, { color: new THREE.Color('#6e5a3a') });
  return b.build();
}

function lampGeometry() {
  const b = new MeshBuilder();
  const steel = new THREE.Color('#5a6168');
  b.box(0, 0.25, 0, 0.45, 0.5, 0.45, { color: steel });
  b.box(0, 3.6, 0, 0.16, 7, 0.16, { color: steel });
  b.box(0, 7.05, 0.9, 0.12, 0.12, 1.9, { color: steel });
  b.box(0, 6.95, 1.85, 0.5, 0.18, 0.9, { color: steel });
  return b.build();
}

export class StreetProps {
  constructor(plan, collision) {
    this.group = new THREE.Group();
    this.group.name = 'props';
    const rng = makeRng(GRID.seed + 3);
    const lamps = [];
    const palms = [];
    const trees = [];
    const benches = [];
    const fountains = [];

    for (const b of plan.blocks) {
      const inset = 0.9;
      // lamps along each side of the block, facing the road
      for (let t = 6; t < GRID.block - 4; t += 20) {
        lamps.push({ x: b.x0 + t, z: b.z0 + inset, yaw: Math.PI });
        lamps.push({ x: b.x1 - t, z: b.z1 - inset, yaw: 0 });
        lamps.push({ x: b.x0 + inset, z: b.z1 - t, yaw: -Math.PI / 2 });
        lamps.push({ x: b.x1 - inset, z: b.z0 + t, yaw: Math.PI / 2 });
      }
      const palmy = b.kind === 'beach' || b.kind === 'center' || b.kind === 'brisa';
      if (palmy) {
        for (let t = 16; t < GRID.block - 8; t += 20) {
          for (const [x, z] of [[b.x0 + t, b.z0 + 2.6], [b.x1 - t, b.z1 - 2.6], [b.x0 + 2.6, b.z1 - t], [b.x1 - 2.6, b.z0 + t]]) {
            if (rng.chance(0.75)) palms.push({ x, z, s: rng.range(0.85, 1.2), yaw: rng() * 6.3, tilt: rng.range(-0.08, 0.08) });
          }
        }
      }
      if (b.park) {
        const cx = (b.x0 + b.x1) / 2;
        const cz = (b.z0 + b.z1) / 2;
        fountains.push({ x: cx, z: cz });
        collision.addBox(cx - 4, cz - 4, cx + 4, cz + 4, 1);
        for (let k = 0; k < 14; k += 1) {
          const a = rng() * Math.PI * 2;
          const r = rng.range(11, 24);
          const spot = { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, s: rng.range(0.8, 1.3), yaw: rng() * 6.3, tilt: rng.range(-0.06, 0.06) };
          (rng.chance(0.5) ? palms : trees).push(spot);
        }
        for (let k = 0; k < 4; k += 1) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          benches.push({ x: cx + Math.cos(a) * 7.5, z: cz + Math.sin(a) * 7.5, yaw: -a + Math.PI / 2 });
        }
      } else if (b.kind === 'heights') {
        for (let k = 0; k < 6; k += 1) trees.push({ x: rng.range(b.x0 + 6, b.x1 - 6), z: rng.pick([b.z0 + 5.2, b.z1 - 5.2]), s: rng.range(0.7, 1.1), yaw: rng() * 6.3 });
      }
    }
    // the beach: palms along the promenade, a few on the sand
    for (let z = -CITY_SIZE / 2 + 10; z < CITY_SIZE / 2; z += 14) {
      palms.push({ x: CITY_HALF + 7.5, z: z + rng.range(-2, 2), s: rng.range(0.95, 1.3), yaw: rng() * 6.3, tilt: rng.range(-0.15, 0.05) });
      if (rng.chance(0.35)) palms.push({ x: CITY_HALF + rng.range(18, 36), z: z + rng.range(-5, 5), s: rng.range(0.9, 1.4), yaw: rng() * 6.3, tilt: rng.range(-0.2, 0.2) });
    }

    const curb = GRID.curb;
    for (const list of [lamps, palms, trees, benches, fountains]) for (const t of list) t.y = curb;
    for (const t of lamps) collision.addBox(t.x - 0.25, t.z - 0.25, t.x + 0.25, t.z + 0.25, 7);
    for (const t of palms) collision.addBox(t.x - 0.3, t.z - 0.3, t.x + 0.3, t.z + 0.3, 8);
    for (const t of trees) collision.addBox(t.x - 0.35, t.z - 0.35, t.x + 0.35, t.z + 0.35, 5);

    // lamps and their glowing heads
    const vc = { vertexColors: true, roughness: 0.6 };
    this.group.add(instanced(lampGeometry(), new THREE.MeshStandardMaterial({ ...vc, metalness: 0.4 }), lamps));
    this.lampHeads = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffd38a', emissiveIntensity: 0 });
    const head = new THREE.BoxGeometry(0.42, 0.06, 0.8).translate(0, 6.84, 1.85);
    this.group.add(instanced(head, this.lampHeads, lamps, { shadows: false }));

    // palms: a gently tapering trunk plus the crown
    const trunkGeo = new THREE.CylinderGeometry(0.17, 0.28, 8, 7, 4).translate(0, 4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#9b8466', roughness: 1 });
    this.group.add(instanced(trunkGeo, trunkMat, palms));
    const crowns = palms.map((p) => ({ ...p, x: p.x + Math.sin(p.tilt ?? 0) * 8 * Math.sin(p.yaw) * (p.s ?? 1), y: p.y + 8 * (p.s ?? 1), z: p.z + Math.sin(p.tilt ?? 0) * 8 * Math.cos(p.yaw) * (p.s ?? 1) }));
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    this.group.add(instanced(palmCrown(), leafMat, crowns.map((c) => ({ ...c, tilt: 0 }))));

    // shade trees: trunk and a lumpy round canopy
    this.group.add(instanced(new THREE.CylinderGeometry(0.2, 0.3, 3, 6).translate(0, 1.5, 0), trunkMat, trees));
    const canopy = new THREE.IcosahedronGeometry(2.6, 1).translate(0, 4.4, 0);
    this.group.add(instanced(canopy, new THREE.MeshStandardMaterial({ color: '#4f8a3a', roughness: 0.95, flatShading: true }), trees));

    const benchB = new MeshBuilder();
    const wood = new THREE.Color('#9a6a3e');
    benchB.box(0, 0.45, 0, 1.9, 0.08, 0.5, { color: wood });
    benchB.box(0, 0.75, -0.24, 1.9, 0.4, 0.06, { color: wood });
    benchB.box(-0.8, 0.22, 0, 0.08, 0.45, 0.45, { color: new THREE.Color('#333') });
    benchB.box(0.8, 0.22, 0, 0.08, 0.45, 0.45, { color: new THREE.Color('#333') });
    this.group.add(instanced(benchB.build(), new THREE.MeshStandardMaterial(vc), benches));

    const fountainB = new MeshBuilder();
    const stone = new THREE.Color('#d9d2c3');
    fountainB.box(0, 0.4, 0, 8, 0.8, 8, { color: stone });
    fountainB.box(0, 1.4, 0, 1, 2, 1, { color: stone });
    fountainB.box(0, 2.5, 0, 2.6, 0.3, 2.6, { color: stone });
    this.group.add(instanced(fountainB.build(), new THREE.MeshStandardMaterial(vc), fountains));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3fa6c4', roughness: 0.1, metalness: 0.3 }));
    this.group.add(instanced(water.geometry.translate(0, 0.82, 0), water.material, fountains, { shadows: false }));

    this.lamps = lamps;
  }

  update(night) {
    this.lampHeads.emissiveIntensity = night * 4;
  }
}
