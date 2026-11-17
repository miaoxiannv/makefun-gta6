// The plan of Port Solano as plain data: where the roads, blocks, buildings, parks, parking
// spots, street lamps, palms and cash drops are. Meshes, colliders and the minimap all read it.
import { CASH, CELL, CITY, COAST, HALF } from '../config.js';
import { makeRandom } from '../core/random.js';
import { smoothstep } from '../core/math.js';

/** Centre line of road `i` (0..blocks), on either axis. */
export const roadCenter = (i) => -HALF + CITY.road / 2 + i * CELL;
/** Near edge of block `j` (0..blocks-1), on either axis. */
export const blockStart = (j) => -HALF + CITY.road + j * CELL;

/** Street names: index i names the road at roadCenter(i). */
const NORTH_SOUTH = ['Harbor Way', 'Cypress Ave', 'Mango St', 'Flamingo Ave', 'Solano Blvd', 'Bayshore Dr', 'Palmetto Ave', 'Sunset Ave', 'Coral Blvd'];
const EAST_WEST = ['Northgate Rd', 'Hibiscus St', 'Lantern St', 'Marina Ave', 'Central Ave', 'Ocean Ave', 'Seabreeze St', 'Pier St', 'Dockside Rd'];

const PARKS = new Map([
  ['5,2', 'Bayfront Park'],
  ['2,5', 'Mercado Gardens'],
  ['6,6', 'Lighthouse Green'],
]);

/** District of a world position; drives building style, height and the HUD label. */
export function districtAt(x, z) {
  if (x > HALF) return 'Marisol Beach';
  if (x > roadCenter(6)) return 'Marisol Beach';
  if (Math.hypot(x + 20, z + 20) < 170) return 'Solano Center';
  if (z < roadCenter(2)) return 'Palm Heights';
  if (z > roadCenter(6) && x < roadCenter(4)) return 'Dockside';
  return 'Old Mercado';
}

/** The street nearest to a world position (its name), for the HUD. */
export function streetAt(x, z) {
  let bestName = NORTH_SOUTH[0];
  let best = Infinity;
  for (let i = 0; i <= CITY.blocks; i += 1) {
    const dx = Math.abs(x - roadCenter(i));
    if (dx < best) { best = dx; bestName = NORTH_SOUTH[i]; }
    const dz = Math.abs(z - roadCenter(i));
    if (dz < best) { best = dz; bestName = EAST_WEST[i]; }
  }
  if (x > HALF + 4) return 'Marisol Beach';
  return bestName;
}

/** Facade styles each district picks from. */
const DISTRICT_STYLES = {
  'Solano Center': ['glassBlue', 'glassTeal', 'office', 'glassBlue', 'glassGold'],
  'Marisol Beach': ['decoPink', 'decoMint', 'decoCream', 'decoPink', 'decoSky'],
  'Palm Heights': ['stuccoPeach', 'stuccoWhite', 'stuccoPeach', 'decoMint'],
  'Old Mercado': ['brick', 'stuccoWhite', 'office', 'stuccoPeach'],
  Dockside: ['warehouse', 'brick', 'warehouse', 'office'],
};

/** Floor heights by style family, so the facade texture lines up with whole floors. */
export const FLOOR_HEIGHT = 3.6;

function heightFor(district, x, z, random) {
  const fromCore = Math.hypot(x + 20, z + 20);
  const core = 1 - smoothstep(30, 230, fromCore);
  let floors;
  if (district === 'Solano Center') floors = 5 + core * 22 * (0.45 + random() * 0.75);
  else if (district === 'Marisol Beach') floors = 2 + random() * 4;
  else if (district === 'Dockside') floors = 2 + random() * 2.5;
  else floors = 2 + random() * 5 + core * 6;
  return Math.max(2, Math.round(floors)) * FLOOR_HEIGHT;
}

/** Split a block's inner square into building lots. */
function lotsFor(x0, z0, size, district, random) {
  const pattern = district === 'Solano Center'
    ? random.pick(['single', 'halves', 'halves', 'quads'])
    : district === 'Dockside'
      ? random.pick(['halves', 'single', 'quads'])
      : random.pick(['quads', 'rows', 'halves', 'quads']);
  const lots = [];
  const gap = 1.5;
  const half = size / 2;
  if (pattern === 'single') lots.push([x0, z0, size, size]);
  else if (pattern === 'halves') {
    if (random() < 0.5) lots.push([x0, z0, half, size], [x0 + half, z0, half, size]);
    else lots.push([x0, z0, size, half], [x0, z0 + half, size, half]);
  } else if (pattern === 'rows') {
    const third = size / 3;
    for (let k = 0; k < 3; k += 1) lots.push([x0 + k * third, z0, third, size]);
  } else {
    for (let k = 0; k < 4; k += 1) lots.push([x0 + (k % 2) * half, z0 + Math.floor(k / 2) * half, half, half]);
  }
  return lots.map(([lx, lz, w, d]) => ({ x: lx + gap / 2, z: lz + gap / 2, w: w - gap, d: d - gap }));
}

/** Build the whole plan from a seed. */
export function buildCityLayout(seed = CITY.seed) {
  const random = makeRandom(seed);
  const blocks = [];
  const buildings = [];
  const parking = [];
  const lamps = [];
  const palms = [];
  const cashSpots = [];
  const inner = CITY.block - CITY.sidewalk * 2;

  for (let jz = 0; jz < CITY.blocks; jz += 1) {
    for (let jx = 0; jx < CITY.blocks; jx += 1) {
      const x0 = blockStart(jx);
      const z0 = blockStart(jz);
      const cx = x0 + CITY.block / 2;
      const cz = z0 + CITY.block / 2;
      const district = districtAt(cx, cz);
      const parkName = PARKS.get(`${jx},${jz}`);
      const block = { jx, jz, x0, z0, x1: x0 + CITY.block, z1: z0 + CITY.block, district, kind: parkName ? 'park' : 'buildings', name: parkName ?? null };
      blocks.push(block);

      if (parkName) {
        for (let k = 0; k < 14; k += 1) {
          const angle = random() * Math.PI * 2;
          const radius = 12 + random() * 14;
          palms.push({ x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius, height: random.range(7, 11), lean: random.range(-0.15, 0.15), y: CITY.curb + 0.2 });
        }
      } else {
        const styles = DISTRICT_STYLES[district];
        for (const lot of lotsFor(x0 + CITY.sidewalk, z0 + CITY.sidewalk, inner, district, random)) {
          const lx = lot.x + lot.w / 2;
          const lz = lot.z + lot.d / 2;
          buildings.push({
            x: lx, z: lz, w: lot.w, d: lot.d,
            h: heightFor(district, lx, lz, random),
            style: random.pick(styles),
            variant: random.int(0, 1),
            district,
          });
        }
      }

      // Street lamps at the middle of each side, arm reaching over the road.
      const sides = [
        { x: cx, z: z0 + 1, dirX: 0, dirZ: -1 },
        { x: cx, z: z0 + CITY.block - 1, dirX: 0, dirZ: 1 },
        { x: x0 + 1, z: cz, dirX: -1, dirZ: 0 },
        { x: x0 + CITY.block - 1, z: cz, dirX: 1, dirZ: 0 },
      ];
      for (const side of sides) {
        lamps.push({ x: side.x + side.dirZ * 14, z: side.z - side.dirX * 14, dirX: side.dirX, dirZ: side.dirZ });
        lamps.push({ x: side.x - side.dirZ * 14, z: side.z + side.dirX * 14, dirX: side.dirX, dirZ: side.dirZ });
      }

      // Kerbside parking on some sides of each block, parallel to the road.
      for (const side of sides) {
        if (!random.chance(0.2)) continue;
        const along = random.range(-20, 20);
        const off = 1 + 1.4; // 1 m back to the kerb, then half a car width into the road
        parking.push({
          x: side.x + side.dirX * off + side.dirZ * along,
          z: side.z + side.dirZ * off - side.dirX * along,
          heading: side.dirX !== 0 ? 0 : Math.PI / 2,
          flip: random.chance(0.5),
        });
      }

      // Beach-side palms along the sidewalk.
      if (district === 'Marisol Beach' || parkName) {
        for (const side of sides) {
          if (!random.chance(0.6)) continue;
          palms.push({ x: side.x + side.dirZ * 6, z: side.z - side.dirX * 6, height: random.range(7, 10), lean: random.range(-0.1, 0.1), y: CITY.curb });
        }
      }
    }
  }

  // Palms all along the beach.
  for (let z = -HALF + 6; z < HALF; z += random.range(9, 16)) {
    palms.push({ x: HALF + random.range(6, 18), z, height: random.range(8, 12), lean: random.range(-0.25, 0.25), y: 0.05 });
  }

  // Cash drops: on sidewalks, in parks and on the sand.
  const cashRandom = makeRandom(seed ^ 0x5eed);
  while (cashSpots.length < CASH.count) {
    const block = cashRandom.pick(blocks);
    const corner = cashRandom.int(0, 3);
    const x = corner % 2 === 0 ? block.x0 + 2 : block.x1 - 2;
    const z = corner < 2 ? block.z0 + cashRandom.range(6, CITY.block - 6) : block.z0 + 2;
    cashSpots.push({ x, z, value: Math.round(cashRandom.range(CASH.minValue, CASH.maxValue) / 10) * 10 });
  }
  cashSpots.push({ x: HALF + 30, z: -40, value: 300 });
  cashSpots.push({ x: HALF + 26, z: 120, value: 250 });

  return { blocks, buildings, parking, lamps, palms, cashSpots, beachX: HALF, waterX: HALF + COAST.sandWidth };
}
