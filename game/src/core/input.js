// Keyboard and mouse state. Keys are tracked by `KeyboardEvent.code`, so the layout of the
// player's keyboard does not matter. Presses are latched until consumed, which means a tap
// shorter than a frame is never lost. Mouse drags and the wheel accumulate between frames.

export class Input {
  constructor(surface) {
    this.held = new Set();
    this.pressed = new Set();
    this.look = { x: 0, y: 0, wheel: 0 };
    this.dragging = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());

    surface.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      surface.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointerup', () => (this.dragging = false));
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging && document.pointerLockElement !== surface) return;
      this.look.x += e.movementX;
      this.look.y += e.movementY;
    });
    surface.addEventListener('wheel', (e) => {
      this.look.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(...codes) {
    return codes.some((c) => this.held.has(c));
  }

  /** True once per press of any of the codes. */
  take(...codes) {
    let hit = false;
    for (const c of codes) if (this.pressed.delete(c)) hit = true;
    return hit;
  }

  /** -1, 0 or 1 from a pair of key groups. */
  axis(negative, positive) {
    return (this.isDown(...positive) ? 1 : 0) - (this.isDown(...negative) ? 1 : 0);
  }

  /** Hand over the mouse movement gathered since the last call. */
  takeLook() {
    const look = { ...this.look };
    this.look.x = this.look.y = this.look.wheel = 0;
    return look;
  }

  /** Forget presses nobody asked about this frame. */
  endFrame() {
    this.pressed.clear();
  }
}
