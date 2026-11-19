// The deterministic screenshot scenes behind ?shot=<name>. Each starts from a fresh session,
// sets the clock and runs the real simulation forward with scripted controls, so a given seed
// always produces the same frame. tools/shoot.ts captures them for the screenshots/ folder.

export const SHOTS = {
  /** Cover: the red Vela GT tearing up Solano Blvd through downtown at golden hour, a cab
   * and a sedan up ahead, a Solano PD cruiser in the player's lane with its light bar
   * flashing, three wanted stars on the HUD. */
  drive(game) {
    game.state.hour = 17.1;
    const car = game.starterCar;
    car.placeAt(3.5, 90, Math.PI);
    game.enterCar(car);
    game.chase.snap(game.focus(), Math.PI - 0.32, 0.17, game.collision);
    game.traffic.spawnAt('cab', null, 3.6, 30, Math.PI, 10);
    game.traffic.spawnAt('sedan', null, -3.6, -40, 0, 11);
    game.traffic.spawnAt('police', null, 3.6, 62, Math.PI, 8);
    game.simulate(3.2, (t) => ({ throttle: 1, steer: t > 2.4 ? 0.12 : 0 }));
    // three stars on the HUD; set after the sim so no pursuers spawn mid-shot
    game.state.wanted = 3;
  },
  /** A job in progress: the player walks onto the Dockside corner for The Drop, the crew
   * jumps them, and the fight is on — objective card, gold marker, three wanted stars
   * waiting on the HUD. */
  mission(game) {
    game.state.hour = 16.6;
    // the first two jobs are done, so the third can start
    game.missions.completed = ['m1', 'm2'];
    game.missions.start('m3');
    // step onto the package corner to spring the ambush
    const pick = { x: -240, z: 240 };
    game.player.placeAt(pick.x - 6, pick.z - 6, Math.PI / 4, game.collision.groundHeight(pick.x - 6, pick.z - 6));
    game.simulate(1.2, { moveY: 1 });
    // the crew closes in; hold the frame before they land too many punches
    game.simulate(2.5, {});
    game.hud.flash = 0;
    game.state.wanted = 1;
    // frame the nearest crew member over the player's shoulder
    const foe = game.enemies.alive[0];
    if (foe) {
      const dx = foe.position.x - game.player.position.x;
      const dz = foe.position.z - game.player.position.z;
      game.chase.snap(game.focus(), Math.atan2(dx, dz), 0.16, game.collision);
    }
  },
  /** A cab ride after dark: lit windows, glowing lamps, headlights on the asphalt, a Solano
   * PD cruiser ahead with its light bar flashing and a sedan coming the other way. */
  night(game) {
    game.state.hour = 21.3;
    const cab = game.garage.cars[2];
    cab.placeAt(-3.5, -150, 0);
    game.enterCar(cab);
    game.chase.snap(game.focus(), 0.3, 0.2, game.collision);
    game.traffic.spawnAt('police', null, -3.6, -100, 0, 9);
    game.traffic.spawnAt('sedan', null, 3.6, -80, Math.PI, 11);
    game.simulate(3.0, { throttle: 1 });
    game.state.wanted = 2;
  },
  /** The title card over the skyline at sunset. */
  title(game) {
    game.state.hour = 18.5;
    game.time = 0;
  },
};

/** Stage scene `name` on `game`. Returns true when it is the title screen. */
export function stageShot(name, game) {
  const scene = SHOTS[name] ?? SHOTS.title;
  scene(game);
  return scene === SHOTS.title;
}
