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

/** The cars that drive themselves: how many, how fast, how far they stay from the player. */
export const TRAFFIC = {
  count: 14,
  cruiseMin: 9,
  cruiseMax: 14,
  /** A car farther than this from the player is moved to a road near the player. */
  respawnDist: 350,
  respawnNearMin: 60,
  respawnNearMax: 120,
};

/** The people on the sidewalks: how many, how fast, how they behave. */
export const PEDESTRIANS = {
  count: 22,
  walkMin: 1.0,
  walkMax: 1.5,
  run: 3.6,
  /** A pedestrian farther than this from the player is moved to a sidewalk near the player. */
  respawnDist: 220,
  respawnNearMin: 40,
  respawnNearMax: 90,
};

/** The wanted level: 0..5 stars, earned by crime, lost by staying out of sight. */
export const WANTED = {
  max: 5,
  /** Seconds after the last crime before a star can drop. */
  crimeCooldown: 10,
  /** Seconds out of a cruiser's close sight before a star can drop. */
  unseenSeconds: 5,
  /** How close a cruiser must be to count as seeing the player. */
  seenRadius: 25,
};

/** On-foot combat: the player's punch, and what a punch does to a bystander. */
export const COMBAT = {
  /** Punch damage (25 with knuckle dusters). */
  damage: 15,
  /** How far a punch reaches, and the half-angle of its arc. */
  range: 1.8,
  arc: 1.1,
  /** Seconds between punches. */
  cooldown: 0.45,
  /** Shove applied to whatever a punch lands on (m/s). */
  knockback: 2.5,
  /** Punching a bystander earns this many stars (once per punch). */
  pedHeat: 1,
};

/** The rival crew that fights back: how many, how tough, how hard they hit. */
export const ENEMIES = {
  health: 30,
  bossHealth: 80,
  damage: 8,
  bossDamage: 14,
  speed: 3.2,
  /** Inside this range an enemy starts swinging. */
  attackRange: 1.25,
  attackCooldown: 0.9,
  /** How close the player must be before an enemy notices them. */
  aggro: 60,
  /** Seconds an enemy stays stunned after taking a punch. */
  stagger: 0.35,
  /** Cash pocketed for knocking one out ($100 for the boss). */
  koCash: 25,
  bossCash: 100,
};

/** Solano PD: how many cars chase, how fast, how a bust works. */
export const POLICE = {
  maxActive: 3,
  spawnDistMin: 70,
  spawnDistMax: 110,
  /** Trail stays warm this long after the last crime (cruisers keep coming). */
  spawnWarmSeconds: 30,
  /** ...or this long after a cruiser last saw the player up close. */
  spawnSeenSeconds: 15,
  /** A cruiser that cannot get this close to the player gives up after the time below. */
  giveUpSeconds: 15,
  giveUpRadius: 12,
  /** The player is reachable by car this far from a road centre line (kerbside on foot). */
  roadReach: 10,
  /** Seconds pinned by a police car (slow, or on foot) before the bust lands. */
  bustSeconds: 2.5,
  bustFine: 200,
  /** Speed (m/s) over which driving past the police earns heat. */
  speedLimit: 25,
  ramCooldown: 5,
  speedCooldown: 10,
};
