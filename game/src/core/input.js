// Keyboard and mouse state: held keys, keys pressed since they were last consumed,
// mouse-drag deltas for the camera and the wheel for zoom.

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyQ', 'KeyH', 'Space',
  'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export class Input {
  constructor(surface) {
    this.held = new Set();
    this.pressed = new Set();
    this.dragX = 0;
    this.dragY = 0;
    this.wheel = 0;
    this.dragging = false;

    window.addEventListener('keydown', (event) => {
      if (!event.repeat) this.pressed.add(event.code);
      this.held.add(event.code);
      if (GAME_KEYS.has(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => this.held.delete(event.code));
    window.addEventListener('blur', () => this.held.clear());

    surface.addEventListener('pointerdown', (event) => {
      this.dragging = true;
      surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      this.dragX += event.movementX;
      this.dragY += event.movementY;
    });
    const release = () => { this.dragging = false; };
    surface.addEventListener('pointerup', release);
    surface.addEventListener('pointercancel', release);
    surface.addEventListener('wheel', (event) => {
      this.wheel += Math.sign(event.deltaY);
      event.preventDefault();
    }, { passive: false });
  }

  isHeld(...codes) {
    return codes.some((code) => this.held.has(code));
  }

  /** True once per key press: the press is used up by whoever asks first. */
  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** -1, 0 or 1 from a pair of key groups. */
  axis(negative, positive) {
    return (this.isHeld(...positive) ? 1 : 0) - (this.isHeld(...negative) ? 1 : 0);
  }

  /** Read and reset the mouse movement gathered since the last frame. */
  takeMouse() {
    const result = { dragX: this.dragX, dragY: this.dragY, wheel: this.wheel, dragging: this.dragging };
    this.dragX = 0;
    this.dragY = 0;
    this.wheel = 0;
    return result;
  }

  endFrame() {
    this.pressed.clear();
  }
}
