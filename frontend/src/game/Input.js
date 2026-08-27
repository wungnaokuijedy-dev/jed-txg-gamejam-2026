// Global keyboard input tracker. Also captures mouse delta while pointer is locked.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;
    // Drop the very first mousemove event after acquiring pointer lock — the browser
    // often delivers a large synthetic movement delta on lock acquisition which would
    // otherwise snap the camera unexpectedly.
    this._swallowFirstDelta = false;

    this._onKeyDown = (e) => {
      // Allow browser shortcuts with modifiers to pass through.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      this.keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onBlur = () => { this.keys.clear(); };

    this._onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      if (this._swallowFirstDelta) {
        this._swallowFirstDelta = false;
        return;
      }
      // Clamp per-event delta to a sane cap so a runaway movement (browser edge case,
      // or a very fast real-world mouse flick) can't teleport the camera.
      const mx = Math.max(-120, Math.min(120, e.movementX || 0));
      const my = Math.max(-120, Math.min(120, e.movementY || 0));
      this.mouseDX += mx;
      this.mouseDY += my;
    };

    this._onPointerLockChange = () => {
      const wasLocked = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.pointerLocked && !wasLocked) {
        // Fresh acquisition — swallow the next mousemove delta.
        this._swallowFirstDelta = true;
      }
      if (this.onLockChange) this.onLockChange(this.pointerLocked);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  isDown(code) { return this.keys.has(code); }
  isMoveForward() { return this.isDown('KeyW') || this.isDown('ArrowUp'); }
  isMoveBackward() { return this.isDown('KeyS') || this.isDown('ArrowDown'); }
  isMoveLeft() { return this.isDown('KeyA') || this.isDown('ArrowLeft'); }
  isMoveRight() { return this.isDown('KeyD') || this.isDown('ArrowRight'); }
  isSprint() { return this.isDown('ShiftLeft') || this.isDown('ShiftRight'); }
  isJump() { return this.isDown('Space'); }

  // Call once per frame; returns and clears mouse delta.
  consumeMouseDelta() {
    const dx = this.mouseDX; const dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return [dx, dy];
  }

  async requestPointerLock() {
    if (document.pointerLockElement === this.canvas) return true;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && typeof p.then === 'function') await p;
    } catch (_) {
      // Fallback: some browsers do not support the options object.
      try { this.canvas.requestPointerLock(); } catch (__) {}
    }
    return document.pointerLockElement === this.canvas;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }
}
