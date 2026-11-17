// The screenshot scenes behind ?shot=drive|foot|night|title. Each one starts a fresh session,
// sets the clock and plays the real simulation forward for a fixed number of steps with
// scripted controls, so the same seed always gives the same frame.
import { STEP } from './config.js';
import { IDLE_CONTROLS } from './game.js';

const STILL_MOUSE = { dragX: 0, dragY: 0, wheel: 0 };

/** Step the game `seconds` forward with `controls` (a function of elapsed time or an object). */
function play(game, seconds, controls) {
  const steps = Math.round(seconds / STEP);
  for (let k = 0; k < steps; k += 1) {
    const now = typeof controls === 'function' ? controls(k * STEP) : controls;
    game.step(STEP, { ...IDLE_CONTROLS, ...now });
    game.followCamera.update(STEP, game.focus(), STILL_MOUSE, now.turn ?? 0, game.colliders);
  }
}

const SCENES = {
  /** Cover: racing the Kestrel GT down Solano Blvd through downtown at golden hour. */
  drive(game) {
    game.state.hour = 17.35;
    const car = game.starterCar;
    car.placeAt(-2, -60, 0);
    game.enterCar(car);
    game.followCamera.snap(game.focus(), Math.PI - 0.35, 0.16);
    play(game, 2.6, { throttle: 1 });
  },
  /** On foot, walking up to the parked sports car with the steal prompt showing. */
  foot(game) {
    game.state.hour = 10.6;
    game.player.placeAt(10.5, -44, 0, 0.18);
    game.followCamera.snap(game.focus(), Math.PI + 0.55, 0.16);
    // Camera-relative input that walks straight along the sidewalk (+z) with the camera off to the side.
    play(game, 2.3, { moveY: 0.85, moveX: 0.52 });
  },
  /** Night run in a cab: lit windows, street lamps and headlights. */
  night(game) {
    game.state.hour = 21.4;
    const cab = game.fleet.cars[2];
    game.player.placeAt(cab.position.x - 2, cab.position.z, 0, 0);
    game.enterCar(cab);
    game.followCamera.snap(game.focus(), 0.25, 0.22);
    play(game, 3.2, (t) => ({ throttle: 1, steer: t > 1.6 && t < 2.4 ? -0.35 : 0 }));
  },
  /** The title screen over the sunset skyline. */
  title(game) {
    game.state.hour = 18.4;
    game.time = 0;
  },
};

/** Stage the named scene; returns true when the title screen should be shown over it. */
export function stageShot(name, game) {
  const scene = SCENES[name] ?? SCENES.title;
  scene(game);
  return scene === SCENES.title;
}
