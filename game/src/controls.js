// Maps the keyboard to the game's control record, one per frame. The same record drives the
// player on foot and the car they are in, and the ?shot= autopilot fills it in by script.
// E is both "get in / out" and "turn camera right": near a car (or in one) it means get in or
// out, otherwise holding it turns the camera. F is the punch on foot — near a car it still
// means get in, so a fist never fights a door handle.

export const NO_CONTROLS = Object.freeze({
  moveX: 0, moveY: 0, run: false, jump: false,
  throttle: 0, brake: 0, steer: 0, handbrake: false,
  interact: false, turn: 0, attack: false,
});

export function readControls(input, { nearCar, inCar }) {
  const moveY = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
  const moveX = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
  const useKey = nearCar || inCar;
  const f = input.take('KeyF');
  const interact = f || (useKey && input.take('KeyE'));
  const turnRight = !useKey && input.isDown('KeyE');
  return {
    moveX,
    moveY,
    run: input.isDown('ShiftLeft', 'ShiftRight'),
    jump: input.take('Space'),
    throttle: moveY > 0 ? 1 : 0,
    brake: moveY < 0 ? 1 : 0,
    steer: -moveX,
    handbrake: input.isDown('Space'),
    interact,
    turn: (turnRight ? 1 : 0) - (input.isDown('KeyQ') ? 1 : 0),
    // a punch only lands on foot and away from a car — otherwise F is "get in"
    attack: f && !useKey,
  };
}
