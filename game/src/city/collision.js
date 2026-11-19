import { CELL, CITY_HALF, GRID, LIMITS, SHORE } from '../config.js';
import { blockIndex } from './plan.js';

const cellOf = (v) => Math.max(0, Math.min(GRID.blocks, Math.floor((v + CITY_HALF) / CELL)));

export class CityCollision {
  constructor(plan) {
    this.cells = new Map();
    for (const b of plan.buildings) this.addBox(b.x0, b.z0, b.x1, b.z1, b.height);
  }

  addBox(x0, z0, x1, z1, height = 3) {
    const box = { x0, z0, x1, z1, height };
    for (let cx = cellOf(x0); cx <= cellOf(x1); cx += 1) {
      for (let cz = cellOf(z0); cz <= cellOf(z1); cz += 1) {
        const key = cx * 64 + cz;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(box);
      }
    }
  }

  *near(x, z) {
    const cx = cellOf(x);
    const cz = cellOf(z);
    const seen = new Set();
    for (let i = cx - 1; i <= cx + 1; i += 1) {
      for (let k = cz - 1; k <= cz + 1; k += 1) {
        for (const box of this.cells.get(i * 64 + k) ?? []) {
          if (seen.has(box)) continue;
          seen.add(box);
          yield box;
        }
      }
    }
  }

  resolveCircle(p, radius) {
    let hit = null;
    for (const b of this.near(p.x, p.z)) {
      const cx = Math.max(b.x0, Math.min(p.x, b.x1));
      const cz = Math.max(b.z0, Math.min(p.z, b.z1));
      let dx = p.x - cx;
      let dz = p.z - cz;
      let d = Math.hypot(dx, dz);
      if (d >= radius) continue;
      let depth;
      if (d < 1e-6) {
        
        const exits = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]];
        exits.sort((a, c) => a[0] - c[0]);
        const [gap, ex, ez] = exits[0];
        dx = ex; dz = ez; depth = gap + radius;
      } else {
        dx /= d; dz /= d; depth = radius - d;
      }
      p.x += dx * depth;
      p.z += dz * depth;
      if (!hit || depth > hit.depth) hit = { nx: dx, nz: dz, depth };
    }
    const walls = [
      [LIMITS.minX + radius - p.x, 1, 0], [p.x - (LIMITS.maxX - radius), -1, 0],
      [LIMITS.minZ + radius - p.z, 0, 1], [p.z - (LIMITS.maxZ - radius), 0, -1],
    ];
    for (const [depth, nx, nz] of walls) {
      if (depth <= 0) continue;
      p.x += nx * depth;
      p.z += nz * depth;
      if (!hit || depth > hit.depth) hit = { nx, nz, depth };
    }
    return hit;
  }

  groundHeight(x, z) {
    if (blockIndex(x) >= 0 && blockIndex(z) >= 0) return GRID.curb;
    const beach = x - CITY_HALF;
    if (beach >= 0 && beach <= 6) return GRID.curb; 
    if (beach > SHORE.sand - 20) return Math.max(SHORE.water - 0.3, -((beach - (SHORE.sand - 20)) / 20) * 0.9);
    return 0;
  }

  castRay(a, b) {
    const dir = [b.x - a.x, b.y - a.y, b.z - a.z];
    let best = 1;
    const seen = new Set();
    for (const p of [a, b]) {
      for (const box of this.near(p.x, p.z)) {
        if (seen.has(box)) continue;
        seen.add(box);
        let t0 = 0;
        let t1 = best;
        const lo = [box.x0, 0, box.z0];
        const hi = [box.x1, box.height, box.z1];
        const from = [a.x, a.y, a.z];
        let ok = true;
        for (let k = 0; k < 3 && ok; k += 1) {
          if (Math.abs(dir[k]) < 1e-9) {
            if (from[k] < lo[k] || from[k] > hi[k]) ok = false;
            continue;
          }
          let ta = (lo[k] - from[k]) / dir[k];
          let tb = (hi[k] - from[k]) / dir[k];
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
        if (ok && t0 < best) best = t0;
      }
    }
    return best;
  }
}