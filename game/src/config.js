// Tuning numbers for Port Solano: city grid, movement, vehicles, camera and the clock.
// Everything that a designer would want to tweak lives here so the systems stay data-driven.

/** Fixed simulation step in seconds (the renderer may run faster or slower). */
export const STEP = 1 / 60;

/** The street grid: `blocks` x `blocks` city blocks separated by roads. */
export const CITY = {
  blocks: 8,
  block: 64,
  road: 16,
  sidewalk: 4,
  curb: 0.18,
  seed: 20261118,
};
export const CELL = CITY.block + CITY.road;
export const CITY_SIZE = CITY.blocks * CELL + CITY.road;
export const HALF = CITY_SIZE / 2;

/** The beach and ocean on the east edge of town. */
export const COAST = { sandWidth: 70, waterLevel: -0.35 };

/** Where the player may go: the land edges of the grid and the water line. */
export const BOUNDS = {
  minX: -HALF + 1,
  maxX: HALF + COAST.sandWidth - 6,
  minZ: -HALF + 1,
  maxZ: HALF - 1,
};

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 8.6,
  jumpSpeed: 6.4,
  gravity: 20,
  radius: 0.42,
  turnRate: 12,
  enterRange: 3.6,
};

export const CAMERA = {
  footDistance: 6.2,
  footHeight: 1.55,
  carDistance: 8.2,
  carHeight: 1.6,
  minPitch: -0.15,
  maxPitch: 1.1,
  dragSensitivity: 0.005,
  keyTurnSpeed: 2.2,
  recenterDelay: 1.4,
  fov: 62,
};

export const CLOCK = {
  /** Game minutes that pass per real second. */
  minutesPerSecond: 1,
  startHour: 16.5,
};

export const START = { money: 250, health: 100 };

/** Cash drops scattered around town: how much each pays and how long until it comes back. */
export const CASH = { count: 22, minValue: 40, maxValue: 220, respawnSeconds: 90, radius: 1.4 };
