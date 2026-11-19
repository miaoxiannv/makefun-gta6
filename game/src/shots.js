export const SHOTS = {
  
  drive(game) {
    game.state.hour = 17.1;
    const car = game.starterCar;
    car.placeAt(3.5, 90, Math.PI);
    game.enterCar(car);
    game.chase.snap(game.focus(), Math.PI - 0.32, 0.17, game.collision);
    game.traffic.spawnAt('cab', null, 3.6, 30, Math.PI, 10);
    game.traffic.spawnAt('sedan', null, -3.6, -40, 0, 11);
    game.traffic.spawnAt('police', null, -3.6, 62, Math.PI, 8);
    game.simulate(3.2, (t) => ({ throttle: 1, steer: t > 2.4 ? 0.12 : 0 }));

    game.state.wanted = 3;
    game.hud.flash = 0;
  },
  
  mission(game) {
    game.state.hour = 16.6;
    
    game.missions.completed = ['m1', 'm2'];
    game.missions.start('m3');
    
    const pick = { x: -240, z: 240 };
    game.player.placeAt(pick.x - 6, pick.z - 6, Math.PI / 4, game.collision.groundHeight(pick.x - 6, pick.z - 6));
    game.simulate(1.2, { moveY: 1 });
    
    game.simulate(2.5, {});
    game.hud.flash = 0;
    game.state.wanted = 1;
    
    const foe = game.enemies.alive[0];
    if (foe) {
      const dx = foe.position.x - game.player.position.x;
      const dz = foe.position.z - game.player.position.z;
      game.chase.snap(game.focus(), Math.atan2(dx, dz), 0.16, game.collision);
    }
  },
  
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
  
  title(game) {
    game.state.hour = 18.5;
    game.time = 0;
  },
};

export function stageShot(name, game) {
  const scene = SHOTS[name] ?? SHOTS.title;
  scene(game);
  return scene === SHOTS.title;
}