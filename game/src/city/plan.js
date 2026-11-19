import { CELL, CITY_HALF, GRID, CASH_DROPS } from '../config.js';
import { makeRng } from '../core/rng.js';

export const roadCentre = (i) => -CITY_HALF + GRID.road / 2 + i * CELL;

export const blockStart = (i) => -CITY_HALF + GRID.road + i * CELL;

const AVENUES = ['Harbor Way', 'Cypress Ave', 'Palmetto St', 'Mangrove Ave', 'Solano Blvd', 'Flamingo Ave', 'Coquina St', 'Seagrape Ave', 'Marisol Drive'];

const STREETS = ['Northgate Rd', 'Orchid St', 'Hibiscus St', 'Bayview Ave', 'Sol Avenue', 'Pelican Way', 'Tarpon St', 'Anchor St', 'Dockside Rd'];

export const DISTRICTS = {
  center: { name: 'Solano Center', styles: ['tower', 'tower', 'office'], tints: ['#cfe6f3', '#9fc4d8', '#bfd9d2', '#d7c9b3', '#a7b8cc'], floors: [10, 34] },
  beach: { name: 'Marisol Beach', styles: ['deco', 'deco', 'stucco'], tints: ['#ffd1dc', '#b8f0e6', '#fff1b8', '#ffc9a8', '#cde6ff', '#ffffff'], floors: [2, 7] },
  heights: { name: 'Palm Heights', styles: ['stucco'], tints: ['#f7e3c4', '#f2d1c9', '#e5efe0', '#fff4dc', '#f6d9b2'], floors: [1, 3] },
  docks: { name: 'Dockside', styles: ['warehouse', 'warehouse', 'office'], tints: ['#c9c2b8', '#b9c4c9', '#d1b8a0', '#a9b3a4', '#d8d2c6'], floors: [2, 5] },
  brisa: { name: 'Little Brisa', styles: ['stucco', 'office', 'deco'], tints: ['#f6c8a0', '#f2e2b0', '#cfe3c8', '#f0c4c4', '#d8d4f2'], floors: [3, 9] },
  coral: { name: 'Coral Row', styles: ['office', 'office', 'tower'], tints: ['#e7ddd0', '#cfd8de', '#d9e4ec', '#f0e4d6'], floors: [5, 16] },
};

const PARKS = { '2,4': 'Bayfront Park', '5,1': 'Jacaranda Square', '6,5': 'Marina Green', '1,1': 'Heights Commons' };

export function districtOf(bx, bz) {
  if (bx === GRID.blocks - 1) return 'beach';
  if (bz >= GRID.blocks - 2) return 'docks';
  if (bx <= 1) return 'heights';
  if (bx >= 3 && bx <= 5 && bz >= 2 && bz <= 5) return 'center';
  if (bz <= 1) return 'coral';
  return 'brisa';
}

export function blockIndex(v) {
  const local = v + CITY_HALF - GRID.road;
  if (local < 0) return -1;
  const i = Math.floor(local / CELL);
  if (i >= GRID.blocks || local - i * CELL > GRID.block) return -1;
  return i;
}

const nearestRoad = (v) => Math.max(0, Math.min(GRID.blocks, Math.round((v + CITY_HALF - GRID.road / 2) / CELL)));

export function streetAt(x, z) {
  if (x > CITY_HALF + 4) return 'Marisol Beach';
  const ix = nearestRoad(x);
  const iz = nearestRoad(z);
  const dx = Math.abs(x - roadCentre(ix));
  const dz = Math.abs(z - roadCentre(iz));
  return dx < dz ? AVENUES[ix] : STREETS[iz];
}

export function districtAt(x, z) {
  if (x > CITY_HALF) return DISTRICTS.beach.name;
  const clampBlock = (v) => Math.max(0, Math.min(GRID.blocks - 1, Math.floor((v + CITY_HALF - GRID.road / 2) / CELL)));
  const bx = clampBlock(x);
  const bz = clampBlock(z);
  return PARKS[`${bx},${bz}`] ?? DISTRICTS[districtOf(bx, bz)].name;
}

function split(start, length, target, rng) {
  const n = Math.max(1, Math.round(length / target));
  const cuts = [start];
  for (let k = 1; k < n; k += 1) cuts.push(start + (length * k) / n + rng.range(-0.12, 0.12) * (length / n));
  cuts.push(start + length);
  return cuts.slice(0, -1).map((a, k) => [a, cuts[k + 1]]);
}

function planBuildings(bx, bz, kind, rng, out) {
  const d = DISTRICTS[kind];
  const sw = GRID.sidewalk;
  const x0 = blockStart(bx) + sw;
  const z0 = blockStart(bz) + sw;
  const span = GRID.block - sw * 2;
  const lotSize = { center: 27, beach: 18, heights: 13, docks: 26, brisa: 18, coral: 22 }[kind];
  
  const core = kind === 'center' ? 1 - Math.min(1, Math.hypot(blockStart(bx) + 32, blockStart(bz) + 32) / 200) : 0.5;

  for (const [ax, bxEnd] of split(x0, span, lotSize, rng)) {
    for (const [az, bzEnd] of split(z0, span, lotSize, rng)) {
      const setback = kind === 'heights' ? rng.range(1.5, 3) : rng.range(0.4, 1.4);
      const lot = { x0: ax + setback, z0: az + setback, x1: bxEnd - setback, z1: bzEnd - setback };
      if (lot.x1 - lot.x0 < 5 || lot.z1 - lot.z0 < 5) continue;
      const [lo, hi] = d.floors;
      const t = kind === 'center' ? Math.pow(rng(), 1.6 - core) : rng();
      const floors = Math.round(lo + (hi - lo) * t);
      const style = rng.pick(d.styles);
      out.push({
        ...lot,
        floors,
        height: floors * 3.4 + (style === 'warehouse' ? 1 : 0.6),
        style,
        tint: rng.pick(d.tints),
        district: kind,
        roof: kind === 'heights' ? 'tiles' : rng.chance(0.5) ? 'plant' : 'flat',
        crown: kind === 'center' && floors > 22 && rng.chance(0.6),
      });
    }
  }
}

function planParking(rng) {
  const spots = [];
  const offset = GRID.road / 2 - 1.6;
  for (let i = 0; i <= GRID.blocks; i += 1) {
    for (let b = 0; b < GRID.blocks; b += 1) {
      const a = blockStart(b) + 7;
      const e = blockStart(b) + GRID.block - 7;
      for (let t = a; t <= e; t += 7.5) {
        
        if (rng.chance(0.18)) spots.push({ x: roadCentre(i) + offset, z: t, heading: Math.PI });
        if (rng.chance(0.18)) spots.push({ x: roadCentre(i) - offset, z: t, heading: 0 });
        
        if (rng.chance(0.18)) spots.push({ x: t, z: roadCentre(i) + offset, heading: Math.PI / 2 });
        if (rng.chance(0.18)) spots.push({ x: t, z: roadCentre(i) - offset, heading: -Math.PI / 2 });
      }
    }
  }
  return spots;
}

function planCash(rng) {
  const spots = [];
  while (spots.length < CASH_DROPS.count) {
    const bx = rng.int(0, GRID.blocks - 1);
    const bz = rng.int(0, GRID.blocks - 1);
    
    const x = blockStart(bx) + (rng.chance(0.5) ? 2.2 : GRID.block - 2.2);
    const z = blockStart(bz) + rng.range(6, GRID.block - 6);
    spots.push({ x, z });
  }
  return spots;
}

export function buildPlan(seed = GRID.seed) {
  const rng = makeRng(seed);
  const blocks = [];
  const buildings = [];
  for (let bx = 0; bx < GRID.blocks; bx += 1) {
    for (let bz = 0; bz < GRID.blocks; bz += 1) {
      const park = PARKS[`${bx},${bz}`] ?? null;
      const kind = districtOf(bx, bz);
      const block = { bx, bz, x0: blockStart(bx), z0: blockStart(bz), x1: blockStart(bx) + GRID.block, z1: blockStart(bz) + GRID.block, kind, park };
      blocks.push(block);
      if (!park) planBuildings(bx, bz, kind, rng, buildings);
    }
  }
  return { blocks, buildings, parking: planParking(rng), cash: planCash(rng), parks: PARKS };
}