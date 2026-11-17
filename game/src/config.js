// Every tuning number in Port Solano lives here: the street grid, how people walk, how cars
// handle, how the camera hangs back and how fast the clock runs. Systems read from this file
// instead of hiding magic numbers, so the feel of the game can be tuned in one place.

/** The simulation advances in fixed steps; rendering runs at whatever rate the browser gives. */
export const STEP = 1 / 60;

/**
 * The street grid. World axes: +x is east, +z is south, +y is up. The grid is `blocks` x
 * `blocks` city blocks with a road between every pair and a ring road around the outside.
 */
export const GRID = {
  blocks: 8,
  block: 64,
  road: 16,
  sidewalk: 4.5,
  curb: 0.16,
  seed: 1118,
};
export const CELL = GRID.block + GRID.road;
export const CITY_SIZE = GRID.blocks * CELL + GRID.road;
export const CITY_HALF = CITY_SIZE / 2;

/** Marisol Beach runs down the east edge; the Gulf starts where the sand ends. */
export const SHORE = { sand: 64, water: -0.4 };

/** The walls of the play area (the city ring road to the west, north and south, the surf to the east). */
export const LIMITS = {
  minX: -CITY_HALF + 1.5,
  maxX: CITY_HALF + SHORE.sand - 8,
  minZ: -CITY_HALF + 1.5,
  maxZ: CITY_HALF - 1.5,
};

export const WALKER = {
  walk: 4.0,
  sprint: 8.4,
  accel: 30,
  jump: 6.2,
  gravity: 21,
  radius: 0.4,
  turn: 11,
  reach: 4.0,
};

export const DRIVING = {
  /** Above this speed (m/s) you cannot bail out of a car. */
  exitSpeed: 5,
  /** Impacts harder than this (m/s of lost speed) hurt the driver. */
  hurtImpact: 10,
  gravity: 24,
};

export const CHASE_CAM = {
  footDistance: 5.6,
  footLift: 1.6,
  carDistance: 8.6,
  carLift: 2.1,
  minPitch: -0.12,
  maxPitch: 1.05,
  dragRate: 0.0048,
  keyRate: 2.3,
  settleDelay: 1.2,
  fov: 60,
  speedFov: 14,
};

export const CLOCK = {
  /** In-game minutes per real second (a full day takes 24 real minutes). */
  rate: 1,
  start: 16.25,
};

export const PLAYER_START = { cash: 350, health: 100, x: 12.5, z: -36, heading: Math.PI, yaw: 0.55 };

/** Where you wake up after being knocked down. */
export const HOSPITAL = { name: 'Solano Mercy Hospital', x: -168, z: -10, fee: 150 };

export const CASH_DROPS = { count: 24, min: 50, max: 260, respawn: 75, radius: 1.5 };
