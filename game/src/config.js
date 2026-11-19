export const STEP = 1 / 60;

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

export const SHORE = { sand: 64, water: -0.4 };

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
  
  exitSpeed: 5,
  
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
  
  rate: 1,
  start: 16.25,
};

export const PLAYER_START = { cash: 350, health: 100, x: 12.5, z: -36, heading: Math.PI, yaw: 0.55 };

export const HOSPITAL = { name: 'Solano Mercy Hospital', x: -168, z: -10, fee: 150 };

export const CASH_DROPS = { count: 24, min: 50, max: 260, respawn: 75, radius: 1.5 };

export const TRAFFIC = {
  count: 14,
  cruiseMin: 9,
  cruiseMax: 14,
  
  respawnDist: 350,
  respawnNearMin: 60,
  respawnNearMax: 120,
};

export const PEDESTRIANS = {
  count: 22,
  walkMin: 1.0,
  walkMax: 1.5,
  run: 3.6,
  
  respawnDist: 220,
  respawnNearMin: 40,
  respawnNearMax: 90,
};

export const WANTED = {
  max: 5,
  
  crimeCooldown: 10,
  
  unseenSeconds: 5,
  
  seenRadius: 25,
};

export const COMBAT = {
  
  damage: 15,
  
  range: 1.8,
  arc: 1.1,
  
  cooldown: 0.45,
  
  knockback: 2.5,
  
  pedHeat: 1,
};

export const ENEMIES = {
  health: 30,
  bossHealth: 80,
  damage: 8,
  bossDamage: 14,
  speed: 3.2,
  
  attackRange: 1.25,
  attackCooldown: 0.9,
  
  aggro: 60,
  
  stagger: 0.35,
  
  koCash: 25,
  bossCash: 100,
};

export const POLICE = {
  maxActive: 3,
  spawnDistMin: 70,
  spawnDistMax: 110,
  
  spawnWarmSeconds: 30,
  
  spawnSeenSeconds: 15,
  
  giveUpSeconds: 15,
  giveUpRadius: 12,
  
  roadReach: 10,
  
  bustSeconds: 2.5,
  bustFine: 200,
  
  speedLimit: 25,
  ramCooldown: 5,
  speedCooldown: 10,
};