// The ground of Port Solano: asphalt for every road, raised kerbed sidewalks around each block,
// lawns in the parks and up in Palm Heights, concrete yards in Dockside, the painted road
// markings (double yellow centre lines, lane dashes, stop lines and zebra crossings), the beach
// promenade and the scrubland beyond the city limits.
import * as THREE from 'three';
import { CITY_HALF, CITY_SIZE, GRID, SHORE } from '../config.js';
import { MeshBuilder } from '../core/mesh-builder.js';
import { asphaltTexture, grassTexture, pavementTexture, sandTexture } from '../core/textures.js';
import { blockStart, roadCentre } from './plan.js';

const YELLOW = new THREE.Color('#f2c230');
const WHITE = new THREE.Color('#f4f4ee');
const CURB_SIDE = new THREE.Color('#a9a397');

function material(map, { roughness = 0.95, color = '#ffffff' } = {}) {
  return new THREE.MeshStandardMaterial({ map, roughness, color, vertexColors: true });
}

/** Painted lines for one road segment between two intersections. */
function markSegment(paint, along, across, from, to) {
  // `along`/`across` swap x and z so the same code paints both road directions.
  const strip = (a0, a1, c0, c1, color) => {
    const [x0, z0] = along === 'z' ? [c0, a0] : [a0, c0];
    const [x1, z1] = along === 'z' ? [c1, a1] : [a1, c1];
    paint.flat(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.012, { color });
  };
  const c = across;
  strip(from + 4, to - 4, c - 0.25, c - 0.1, YELLOW);
  strip(from + 4, to - 4, c + 0.1, c + 0.25, YELLOW);
  for (const lane of [-3.6, 3.6]) {
    for (let t = from + 6; t + 3 < to - 5; t += 7) strip(t, t + 3, c + lane - 0.07, c + lane + 0.07, WHITE);
  }
  // zebra crossings and stop lines at both ends
  for (const [edge, dir] of [[from, 1], [to, -1]]) {
    for (let s = -GRID.road / 2 + 0.8; s < GRID.road / 2 - 0.5; s += 1.3) strip(edge + dir * 0.6, edge + dir * 3.2, c + s, c + s + 0.65, WHITE);
    const stop = edge + dir * 3.9;
    const side = dir > 0 ? [c - GRID.road / 2 + 0.6, c - 0.4] : [c + 0.4, c + GRID.road / 2 - 0.6];
    strip(Math.min(stop, stop + dir * 0.45), Math.max(stop, stop + dir * 0.45), side[0], side[1], WHITE);
  }
}

export function buildStreets(plan) {
  const group = new THREE.Group();
  group.name = 'streets';

  // One asphalt sheet under the whole grid.
  const asphalt = asphaltTexture();
  asphalt.repeat.set(CITY_SIZE / 10, CITY_SIZE / 10);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  group.add(road);

  // Scrub and dunes beyond the city limits, slightly lower so the asphalt never fights it.
  const scrubTex = grassTexture();
  scrubTex.repeat.set(160, 160);
  const scrub = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshStandardMaterial({ map: scrubTex, color: '#c7b27d', roughness: 1 }));
  scrub.rotation.x = -Math.PI / 2;
  scrub.position.set(CITY_HALF - 1600, -0.05, 0);
  scrub.receiveShadow = true;
  group.add(scrub);

  // Sidewalk slabs, kerbs and block interiors.
  const walk = new MeshBuilder();
  const lawn = new MeshBuilder();
  const yard = new MeshBuilder();
  const h = GRID.curb;
  const sw = GRID.sidewalk;
  for (const b of plan.blocks) {
    walk.box((b.x0 + b.x1) / 2, h / 2, (b.z0 + b.z1) / 2, GRID.block, h, GRID.block, { skip: ['bottom'], tile: [3, 3], faceColors: { front: CURB_SIDE, back: CURB_SIDE, left: CURB_SIDE, right: CURB_SIDE } });
    const inner = [b.x0 + sw, b.z0 + sw, b.x1 - sw, b.z1 - sw];
    if (b.park || b.kind === 'heights') lawn.flat(...inner, h + 0.01, { tile: [6, 6] });
    else if (b.kind === 'docks') yard.flat(...inner, h + 0.005, { tile: [7, 7], color: new THREE.Color('#9a958c') });
  }
  // The promenade between Marisol Drive and the sand.
  walk.box(CITY_HALF + 3, h / 2, 0, 6, h, CITY_SIZE, { skip: ['bottom'], tile: [3, 3] });

  const pave = pavementTexture();
  group.add(walk.mesh(material(pave), { shadows: false }));
  group.add(lawn.mesh(material(grassTexture()), { shadows: false }));
  group.add(yard.mesh(material(pave, { color: '#bdb6aa' }), { shadows: false }));

  // Sand from the promenade to the surf, sloping under the water line.
  const sandTex = sandTexture();
  sandTex.repeat.set(SHORE.sand / 6, (CITY_SIZE + 400) / 6);
  const sandGeo = new THREE.PlaneGeometry(SHORE.sand + 40, CITY_SIZE + 400, 24, 1);
  const pos = sandGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const local = pos.getX(i) + (SHORE.sand + 40) / 2; // 0 at the promenade edge
    pos.setZ(i, local < SHORE.sand - 20 ? 0.02 : 0.02 - ((local - (SHORE.sand - 20)) / 20) * 0.9);
  }
  sandGeo.computeVertexNormals();
  const sand = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY_HALF + 6 + (SHORE.sand + 40) / 2 - 6, 0, 0);
  sand.receiveShadow = true;
  group.add(sand);

  // Road paint.
  const paint = new MeshBuilder();
  for (let i = 0; i <= GRID.blocks; i += 1) {
    for (let b = 0; b < GRID.blocks; b += 1) {
      const from = blockStart(b);
      const to = from + GRID.block;
      markSegment(paint, 'z', roadCentre(i), from, to);
      markSegment(paint, 'x', roadCentre(i), from, to);
    }
  }
  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  group.add(paint.mesh(paintMat, { shadows: false }));
  return group;
}
