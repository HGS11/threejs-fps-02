const down = new Set();
const pressed = new Set();

export const INPUT = {
  dx: 0,
  dy: 0,
  locked: false,

  // Installs keyboard, mouse, and pointer lock state listeners.
  init() {
    onkeydown = event => {
      if (!down.has(event.code)) pressed.add(event.code);
      down.add(event.code);
      if (['Space', 'Tab'].includes(event.code)) event.preventDefault();
    };
    onkeyup = event => down.delete(event.code);
    onmousemove = event => {
      if (document.pointerLockElement) {
        this.dx += event.movementX;
        this.dy += event.movementY;
      }
    };
    onmousedown = event => {
      const key = 'Mouse' + event.button;
      if (!down.has(key)) pressed.add(key);
      down.add(key);
    };
    onmouseup = event => down.delete('Mouse' + event.button);
    document.addEventListener('pointerlockchange', () => {
      this.locked = !!document.pointerLockElement;
      if (window.pointerLockChanged) window.pointerLockChanged(this.locked);
    });
  },

  // Requests pointer lock for active gameplay.
  lock() { document.body.requestPointerLock?.(); },

  // Leaves pointer lock so the player can use interface controls.
  unlock() { document.exitPointerLock?.(); },

  // Reports whether a key or mouse button is currently held.
  held(key) { return down.has(key); },

  // Consumes a key press that occurred since the prior simulation step.
  take(key) {
    if (!pressed.has(key)) return false;
    pressed.delete(key);
    return true;
  },

  // Clears one-step input and accumulated mouse movement after rendering.
  end() {
    pressed.clear();
    this.dx = 0;
    this.dy = 0;
  },

  // Clears all current input when restarting or changing modes.
  clear() {
    down.clear();
    pressed.clear();
  }
};
