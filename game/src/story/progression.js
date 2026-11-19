// Progression: what finishing jobs earns beyond the cash. Each mission hands out one
// unlock — better fists, a tougher jacket, a getaway car of your own, then the safehouse
// — and the stats the pause screen shows. Unlocks are applied to the game as they are
// earned, and re-applied when a save is loaded.

export const UNLOCKS = {
  knuckles: { name: 'Knuckle dusters', text: 'Punches hit for 25 instead of 15' },
  jacket: { name: 'Armored jacket', text: 'Max health up to 150' },
  coupe: { name: 'Getaway coupe', text: 'A yellow Vela GT of your own by the bus stop' },
  safehouse: { name: 'Solano Sun Garage', text: 'A garage of your own in Palm Heights' },
};

/** Mission id -> unlock earned for finishing it. */
export const MISSION_UNLOCK = { m1: 'knuckles', m2: 'jacket', m3: 'coupe', m4: 'safehouse' };

export class Progression {
  constructor() {
    this.unlocks = { knuckles: false, jacket: false, coupe: false, safehouse: false };
    this.stats = { earned: 0, knockouts: 0, missionsDone: 0 };
    this.coupeCar = null; // the getaway coupe, once it exists in the world
  }

  /** Punch damage right now (knuckle dusters hit harder). */
  get punchDamage() {
    return this.unlocks.knuckles ? 25 : 15;
  }

  /** Max health right now (the armored jacket adds 50). */
  get maxHealth() {
    return this.unlocks.jacket ? 150 : 100;
  }

  has(id) {
    return !!this.unlocks[id];
  }

  earn(id) {
    this.unlocks[id] = true;
  }

  /** Apply a loaded save's unlocks and stats. */
  applySave(save) {
    this.unlocks = { ...this.unlocks, ...save.unlocks };
    this.stats = { ...this.stats, ...save.stats };
  }

  /** The save payload for this progression. */
  toSave() {
    return { unlocks: { ...this.unlocks }, stats: { ...this.stats } };
  }

  /** Forget everything (new game / reset). */
  reset() {
    this.unlocks = { knuckles: false, jacket: false, coupe: false, safehouse: false };
    this.stats = { earned: 0, knockouts: 0, missionsDone: 0 };
    this.coupeCar = null;
  }

  /** Names of the unlocks earned so far, for the stats screen. */
  earnedNames() {
    return Object.keys(UNLOCKS).filter((id) => this.unlocks[id]).map((id) => UNLOCKS[id].name);
  }
}
