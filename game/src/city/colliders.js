// Collision against the static city: building footprints bucketed by block, the ground height
// (kerbs and sidewalks are raised) and the map edges. Shared by people, cars and the camera.
import { BOUNDS, CELL, CITY, HALF } from '../config.js';
import { blockStart } from './layout.js';

export class CityColliders {
  constructor(layout) {
    this.buckets = Array.from({ length: CITY.blocks * CITY.blocks }, () => []);
    for (const b of layout.buildings) {
      const box = { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h: b.h };
      const jx = this.blockIndex(b.x);
      const jz = this.blockIndex(b.z);
      this.buckets[jz * CITY.blocks + jx].push(box);
    }
  }

  blockIndex(v) {
    return Math.max(0, Math.min(CITY.blocks - 1, Math.floor((v - blockStart(0) + CITY.road / 2) / CELL)));
  }

  /** Calls `visit(box)` for every building near (x, z). */
  forNearby(x, z, visit) {
    const jx = this.blockIndex(x);
    const jz = this.blockIndex(z);
    for (let bz = Math.max(0, jz - 1); bz <= Math.min(CITY.blocks - 1, jz + 1); bz += 1) {
      for (let bx = Math.max(0, jx - 1); bx <= Math.min(CITY.blocks - 1, jx + 1); bx += 1) {
        const list = this.buckets[bz * CITY.blocks + bx];
        for (let k = 0; k < list.length; k += 1) visit(list[k]);
      }
    }
  }

  /**
   * Push a circle at `point` ({x, z}, changed in place) out of buildings and back inside the map.
   * Returns the push applied, {x, z}, which is zero when nothing was hit.
   */
  resolveCircle(point, radius) {
    const startX = point.x;
    const startZ = point.z;
    this.forNearby(point.x, point.z, (box) => {
      const cx = Math.max(box.minX, Math.min(point.x, box.maxX));
      const cz = Math.max(box.minZ, Math.min(point.z, box.maxZ));
      const dx = point.x - cx;
      const dz = point.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) return;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        point.x += (dx / d) * (radius - d);
        point.z += (dz / d) * (radius - d);
      } else {
        // Centre inside the box: leave by the nearest face.
        const exits = [point.x - box.minX, box.maxX - point.x, point.z - box.minZ, box.maxZ - point.z];
        const k = exits.indexOf(Math.min(...exits));
        if (k === 0) point.x = box.minX - radius;
        else if (k === 1) point.x = box.maxX + radius;
        else if (k === 2) point.z = box.minZ - radius;
        else point.z = box.maxZ + radius;
      }
    });
    point.x = Math.max(BOUNDS.minX + radius, Math.min(BOUNDS.maxX - radius, point.x));
    point.z = Math.max(BOUNDS.minZ + radius, Math.min(BOUNDS.maxZ - radius, point.z));
    return { x: point.x - startX, z: point.z - startZ };
  }

  /** True when the point is inside a building (grown by `margin`), used to keep the camera out of walls. */
  insideBuilding(x, y, z, margin = 0) {
    let hit = false;
    this.forNearby(x, z, (box) => {
      if (hit) return;
      if (y < box.h + margin && x > box.minX - margin && x < box.maxX + margin && z > box.minZ - margin && z < box.maxZ + margin) hit = true;
    });
    return hit;
  }

  /** Height of the walkable ground: raised blocks and sidewalks, roads at zero. */
  groundHeight(x, z) {
    if (x > HALF) return 0.05;
    const lx = x - blockStart(0);
    const lz = z - blockStart(0);
    if (lx < 0 || lz < 0) return 0;
    const jx = Math.floor(lx / CELL);
    const jz = Math.floor(lz / CELL);
    if (jx >= CITY.blocks || jz >= CITY.blocks) return 0;
    return lx - jx * CELL < CITY.block && lz - jz * CELL < CITY.block ? CITY.curb : 0;
  }
}
