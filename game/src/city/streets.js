// The ground plane of the city: asphalt, raised sidewalk blocks, parks with fountains, lane
// markings, crosswalks and the concrete barriers on the land edges.
import * as THREE from 'three';
import { CITY, COAST, HALF } from '../config.js';
import { makeRandom } from '../core/random.js';
import { roadCenter } from './layout.js';

function noiseTexture(base, spots, size, repeat, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const random = makeRandom(seed);
  for (const [color, count, dot] of spots) {
    ctx.fillStyle = color;
    for (let k = 0; k < count; k += 1) ctx.fillRect(random() * size, random() * size, dot, dot);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function sidewalkTexture() {
  const texture = noiseTexture('#c9c2b5', [['rgba(0,0,0,0.06)', 1400, 2], ['rgba(255,255,255,0.08)', 900, 2]], 256, 16, 7);
  const ctx = texture.image.getContext('2d');
  ctx.strokeStyle = 'rgba(70,60,50,0.28)';
  ctx.lineWidth = 2;
  for (let k = 0; k <= 256; k += 64) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(256, k); ctx.stroke();
  }
  return texture;
}

/** A flat instanced decal (lane line, crosswalk stripe) list from [x, z, length along x, length along z]. */
function decals(list, color, y) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(geometry, material, list.length);
  const matrix = new THREE.Matrix4();
  list.forEach(([x, z, sx, sz], index) => {
    matrix.makeScale(sx, 1, sz);
    matrix.setPosition(x, y, z);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.receiveShadow = true;
  return mesh;
}

function laneMarkings() {
  const yellow = [];
  const white = [];
  const stripes = [];
  const halfRoad = CITY.road / 2;
  for (let i = 0; i <= CITY.blocks; i += 1) {
    const c = roadCenter(i);
    for (let j = 0; j < CITY.blocks; j += 1) {
      const from = roadCenter(j) + halfRoad + 3;
      const to = roadCenter(j + 1) - halfRoad - 3;
      const mid = (from + to) / 2;
      const length = to - from;
      // Double yellow centre line on both axes.
      for (const side of [-0.18, 0.18]) {
        yellow.push([c + side, mid, 0.14, length]);
        yellow.push([mid, c + side, length, 0.14]);
      }
      // Dashed white lane dividers.
      for (let s = from + 1.5; s < to - 1.5; s += 6) {
        for (const lane of [-4, 4]) {
          white.push([c + lane, s, 0.14, 3]);
          white.push([s, c + lane, 3, 0.14]);
        }
      }
    }
    // Crosswalks on every approach of every intersection.
    for (let k = 0; k <= CITY.blocks; k += 1) {
      const cx = roadCenter(i);
      const cz = roadCenter(k);
      for (let s = -halfRoad + 1; s <= halfRoad - 1; s += 1.25) {
        if (k > 0) stripes.push([cx + s, cz - halfRoad - 1.6, 0.6, 2.8]);
        if (k < CITY.blocks) stripes.push([cx + s, cz + halfRoad + 1.6, 0.6, 2.8]);
        if (i > 0) stripes.push([cx - halfRoad - 1.6, cz + s, 2.8, 0.6]);
        if (i < CITY.blocks) stripes.push([cx + halfRoad + 1.6, cz + s, 2.8, 0.6]);
      }
    }
  }
  return [decals(yellow, '#e8b923', 0.015), decals(white, '#e9e9e4', 0.015), decals(stripes, '#efefe9', 0.016)];
}

function park(block, materials, group) {
  const inner = CITY.block - CITY.sidewalk * 2;
  const cx = (block.x0 + block.x1) / 2;
  const cz = (block.z0 + block.z1) / 2;
  const grass = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.1, inner), materials.grass);
  grass.position.set(cx, CITY.curb + 0.05, cz);
  grass.receiveShadow = true;
  group.add(grass);
  for (const [w, d] of [[inner, 3.2], [3.2, inner]]) {
    const path = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), materials.path);
    path.position.set(cx, CITY.curb + 0.06, cz);
    path.receiveShadow = true;
    group.add(path);
  }
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.8, 0.7, 28), materials.stone);
  basin.position.set(cx, CITY.curb + 0.35, cz);
  basin.castShadow = true;
  basin.receiveShadow = true;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.1, 28), materials.fountain);
  water.position.set(cx, CITY.curb + 0.62, cz);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.4, 12), materials.stone);
  column.position.set(cx, CITY.curb + 1.2, cz);
  column.castShadow = true;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 0.6, 0.5, 18), materials.stone);
  bowl.position.set(cx, CITY.curb + 2.5, cz);
  bowl.castShadow = true;
  group.add(basin, water, column, bowl);
}

/** Asphalt, sidewalks, parks, markings and edge barriers as one group. */
export function buildStreets(layout) {
  const group = new THREE.Group();
  group.name = 'streets';
  const materials = {
    asphalt: new THREE.MeshStandardMaterial({ map: noiseTexture('#45474c', [['rgba(255,255,255,0.05)', 2600, 2], ['rgba(0,0,0,0.12)', 1800, 3]], 256, 70, 3), roughness: 0.93 }),
    sidewalk: new THREE.MeshStandardMaterial({ map: sidewalkTexture(), roughness: 0.9 }),
    grass: new THREE.MeshStandardMaterial({ map: noiseTexture('#5f9a46', [['rgba(30,70,20,0.25)', 3000, 3], ['rgba(190,220,120,0.18)', 2000, 2]], 256, 10, 11), roughness: 1 }),
    path: new THREE.MeshStandardMaterial({ color: '#d8cdb5', roughness: 0.95 }),
    stone: new THREE.MeshStandardMaterial({ color: '#e7e0d2', roughness: 0.8 }),
    fountain: new THREE.MeshStandardMaterial({ color: '#4fb6d8', roughness: 0.1, metalness: 0.3 }),
    barrier: new THREE.MeshStandardMaterial({ color: '#bdb8ae', roughness: 0.9 }),
    land: new THREE.MeshStandardMaterial({ color: '#8a9563', roughness: 1 }),
  };

  const land = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), materials.land);
  land.rotation.x = -Math.PI / 2;
  land.position.y = -0.06;
  land.receiveShadow = true;
  group.add(land);

  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), materials.asphalt);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const slab = new THREE.BoxGeometry(CITY.block, CITY.curb, CITY.block);
  for (const block of layout.blocks) {
    const mesh = new THREE.Mesh(slab, materials.sidewalk);
    mesh.position.set((block.x0 + block.x1) / 2, CITY.curb / 2, (block.z0 + block.z1) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
    if (block.kind === 'park') park(block, materials, group);
  }

  group.add(...laneMarkings());

  const length = HALF * 2 + COAST.sandWidth;
  for (const [x, z, w, d] of [
    [-HALF - 0.6, 0, 1.2, HALF * 2],
    [COAST.sandWidth / 2, -HALF - 0.6, length, 1.2],
    [COAST.sandWidth / 2, HALF + 0.6, length, 1.2],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), materials.barrier);
    wall.position.set(x, 0.55, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }
  return group;
}
