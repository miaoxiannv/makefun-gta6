export const UNLOCKS = {
  knuckles: { name: 'Knuckle dusters', text: 'Punches hit for 25 instead of 15' },
  jacket: { name: 'Armored jacket', text: 'Max health up to 150' },
  coupe: { name: 'Getaway coupe', text: 'A yellow Vela GT of your own by the bus stop' },
  safehouse: { name: 'Solano Sun Garage', text: 'A garage of your own in Palm Heights' },
};

export const MISSION_UNLOCK = { m1: 'knuckles', m2: 'jacket', m3: 'coupe', m4: 'safehouse' };

export class Progression {
  constructor() {
    this.unlocks = { knuckles: false, jacket: false, coupe: false, safehouse: false };
    this.stats = { earned: 0, knockouts: 0, missionsDone: 0 };
    this.coupeCar = null; 
  }

  get punchDamage() {
    return this.unlocks.knuckles ? 25 : 15;
  }

  get maxHealth() {
    return this.unlocks.jacket ? 150 : 100;
  }

  has(id) {
    return !!this.unlocks[id];
  }

  earn(id) {
    this.unlocks[id] = true;
  }

  applySave(save) {
    this.unlocks = { ...this.unlocks, ...save.unlocks };
    this.stats = { ...this.stats, ...save.stats };
  }

  toSave() {
    return { unlocks: { ...this.unlocks }, stats: { ...this.stats } };
  }

  reset() {
    this.unlocks = { knuckles: false, jacket: false, coupe: false, safehouse: false };
    this.stats = { earned: 0, knockouts: 0, missionsDone: 0 };
    this.coupeCar = null;
  }

  earnedNames() {
    return Object.keys(UNLOCKS).filter((id) => this.unlocks[id]).map((id) => UNLOCKS[id].name);
  }
}