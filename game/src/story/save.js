// Save games for Port Solano: one localStorage slot holding the player's cash, the
// missions they finished, the unlocks they earned and their running stats. The shape is
// validated on load, so a save from a half-finished write or an old build is ignored.

const KEY = 'port-solano-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || typeof data.cash !== 'number' || !Array.isArray(data.missions)) return null;
    return {
      cash: Math.max(0, Math.floor(data.cash)),
      maxHealth: data.maxHealth === 150 ? 150 : 100,
      missions: data.missions.filter((m) => typeof m === 'string'),
      unlocks: {
        knuckles: !!data.unlocks?.knuckles,
        jacket: !!data.unlocks?.jacket,
        coupe: !!data.unlocks?.coupe,
        safehouse: !!data.unlocks?.safehouse,
      },
      stats: {
        earned: Math.max(0, data.stats?.earned ?? 0),
        knockouts: Math.max(0, data.stats?.knockouts ?? 0),
        missionsDone: Math.max(0, data.stats?.missionsDone ?? 0),
      },
      savedAt: data.savedAt ?? 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, v: 1, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}
