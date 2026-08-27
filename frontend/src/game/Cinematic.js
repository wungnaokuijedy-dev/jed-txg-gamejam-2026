// Cinematic sequencer. One at a time, letterbox + input lock, subtitles,
// smooth camera path, E-to-skip after a guaranteed minimum runtime.
// The Game main loop calls `update(dt)` unconditionally; while active it
// takes over the camera and prevents `CameraController.update` from running.

import * as THREE from 'three';

const _lookVec = new THREE.Vector3();

// Cubic easing helpers
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut   = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn    = (t) => t * t * t;

export class Cinematic {
  constructor(game) {
    this.game = game;
    this.active = false;
    this._t = 0;
    this._current = null;
    this._skipRequested = false;
  }

  isActive() { return this.active; }

  // config = {
  //   id: string
  //   duration: seconds
  //   updateCamera(t, norm, camera): void   — write into camera each frame
  //   onStart: () => void
  //   onEnd:   () => void
  //   subtitles: [{ t, dur, text }]         — subtitle timings
  //   skippable: bool  (default true; earliest skip after 3s)
  //   minSkipT: seconds (default 3)
  //   keepLetterbox: bool (default false)
  //   hideHUD: bool (default true)
  // }
  play(config) {
    if (this.active) return false;
    this.active = true;
    this._t = 0;
    this._current = { skippable: true, minSkipT: 3.0, hideHUD: true, ...config };
    this._skipRequested = false;

    // Freeze character
    if (this.game.character) this.game.character._cinematicLock = true;
    if (this.game.gameState) this.game.gameState.emit('letterbox', { on: true });
    if (this._current.hideHUD && this.game.gameState) this.game.gameState.emit('hud_hide', { on: true });

    // Snapshot subtitle-seen markers
    if (this._current.subtitles) {
      for (const s of this._current.subtitles) s._shown = false;
    }
    // Snapshot trigger-fired markers
    if (this._current.triggers) {
      for (const t of this._current.triggers) t._fired = false;
    }

    if (this._current.onStart) {
      try { this._current.onStart(); } catch (e) { /* eslint-disable-next-line no-console */ console.warn(e); }
    }
    return true;
  }

  requestSkip() {
    if (!this.active) return;
    if (this._current.skippable === false) return;
    if (this._t < this._current.minSkipT) return;
    this._skipRequested = true;
  }

  // Force-end the current cinematic immediately, bypassing minSkipT and duration.
  // Used when the game needs to chain into another cinematic (e.g. arc → ending).
  stop() {
    if (!this.active) return;
    this._end();
  }

  update(dt) {
    if (!this.active) return;
    this._t += dt;

    // Subtitle triggers
    if (this._current.subtitles) {
      for (const s of this._current.subtitles) {
        if (!s._shown && this._t >= s.t) {
          s._shown = true;
          if (this.game.gameState) this.game.gameState.emit('subtitle', { text: s.text, duration: s.dur });
        }
      }
    }
    // Time-based callback triggers
    if (this._current.triggers) {
      for (const trg of this._current.triggers) {
        if (!trg._fired && this._t >= trg.t) {
          trg._fired = true;
          try { trg.fn && trg.fn(); } catch (e) { /* eslint-disable-next-line no-console */ console.warn(e); }
        }
      }
    }

    // Camera path
    if (this._current.updateCamera && this.game.camera) {
      const norm = this._current.duration ? Math.min(1, this._t / this._current.duration) : 0;
      try { this._current.updateCamera(this._t, norm, this.game.camera); }
      catch (e) { /* eslint-disable-next-line no-console */ console.warn(e); }
    }

    if (this._skipRequested || (this._current.duration && this._t >= this._current.duration)) {
      this._end();
    }
  }

  _end() {
    const cfg = this._current;
    this.active = false;

    if (this.game.character) this.game.character._cinematicLock = false;
    if (this.game.gameState) {
      this.game.gameState.emit('subtitle', { text: '', duration: 0 });
      if (!cfg.keepLetterbox) this.game.gameState.emit('letterbox', { on: false });
      if (cfg.hideHUD) this.game.gameState.emit('hud_hide', { on: false });
    }

    // Snap the follow-camera to current pose so the return is not jerky
    if (this.game.camCtrl && this.game.character) {
      const c = this.game.camera;
      const p = this.game.character.root.position;
      this.game.camCtrl._smoothedPos.copy(c.position);
      this.game.camCtrl._smoothedTarget.set(p.x, p.y + 1.55, p.z);
      this.game.camCtrl.currentDistance = c.position.distanceTo(this.game.camCtrl._smoothedTarget);
    }

    if (cfg.onEnd) {
      try { cfg.onEnd(); } catch (e) { /* eslint-disable-next-line no-console */ console.warn(e); }
    }
    this._current = null;
  }

  // ==================================================================
  // Prebuilt cinematics (return config objects).
  // ==================================================================

  // Opening: camera glides down through mist to find the heroine.
  static opening(game) {
    const startPos = new THREE.Vector3(0, 24, 45);
    const midPos   = new THREE.Vector3(3, 10, 32);
    const endPos   = new THREE.Vector3(0, 2.5, 28);
    return {
      id: 'opening',
      duration: 10,
      minSkipT: 0,      // opening is skippable immediately (returning players)
      hideHUD: true,
      updateCamera: (t, norm, camera) => {
        const e = easeInOut(norm);
        // Two-segment blend: first half start→mid, second half mid→end
        if (norm < 0.6) {
          const k = norm / 0.6;
          const ek = easeOut(k);
          camera.position.copy(startPos).lerp(midPos, ek);
        } else {
          const k = (norm - 0.6) / 0.4;
          const ek = easeInOut(k);
          camera.position.copy(midPos).lerp(endPos, ek);
        }
        const p = game.character.root.position;
        _lookVec.set(p.x, p.y + 1.4, p.z);
        camera.lookAt(_lookVec);
      },
    };
  }

  // First-nature-reaction: framing shot of the vine growth over the fallen log.
  static vineGrowth(game, plantPos, logPos) {
    const target = new THREE.Vector3(logPos.x, 0.5, logPos.z);
    const camA = new THREE.Vector3(logPos.x + 3, 3.5, logPos.z + 6);
    const camB = new THREE.Vector3(logPos.x - 1, 4.5, logPos.z + 4.5);
    return {
      id: 'vine',
      duration: 6.5,
      minSkipT: 3,
      updateCamera: (t, norm, camera) => {
        const e = easeInOut(norm);
        camera.position.copy(camA).lerp(camB, e);
        camera.lookAt(target);
      },
    };
  }

  // Guardian revelation: slow push toward the giant grove tree with 4 subtitles.
  static guardianRevelation(game, targetPos) {
    const dir = new THREE.Vector3(-1, 0.35, 1).normalize();
    const startPos = targetPos.clone().addScaledVector(dir, 16).setY(6);
    const endPos   = targetPos.clone().addScaledVector(dir, 6.5).setY(4.8);
    const lookAt   = new THREE.Vector3(targetPos.x, 4.5, targetPos.z);
    return {
      id: 'guardian_revelation',
      duration: 22,
      minSkipT: 4,
      subtitles: [
        { t: 2,  dur: 4, text: 'Once, a guardian tended this wood.' },
        { t: 7,  dur: 4, text: 'People stopped listening — and it faded.' },
        { t: 12, dur: 4, text: 'So the forest itself took up the watch.' },
        { t: 17, dur: 4, text: 'It has been listening to you.' },
      ],
      updateCamera: (t, norm, camera) => {
        const e = easeInOut(norm);
        camera.position.copy(startPos).lerp(endPos, e);
        camera.lookAt(lookAt);
      },
    };
  }

  // Choice arc: slow camera arc around heroine + Heartseed (~360°).
  static heartChoiceArc(game, heartseedPos) {
    const centerPos = new THREE.Vector3(
      (game.character.root.position.x + heartseedPos.x) / 2,
      Math.max(game.character.root.position.y, heartseedPos.y) + 0.6,
      (game.character.root.position.z + heartseedPos.z) / 2,
    );
    const radius = 7.5;
    return {
      id: 'heart_choice_arc',
      duration: 6,
      minSkipT: 3,
      keepLetterbox: true,   // choice UI needs the letterbox to persist
      hideHUD: true,
      updateCamera: (t, norm, camera) => {
        // Arc starts slightly behind-left of the pair and orbits forward-right.
        const angle = -Math.PI / 2.4 + norm * Math.PI * 0.85;
        const y = centerPos.y + 2.6 + Math.sin(norm * Math.PI) * 0.5;
        camera.position.set(
          centerPos.x + Math.cos(angle) * radius,
          y,
          centerPos.z + Math.sin(angle) * radius,
        );
        camera.lookAt(centerPos.x, centerPos.y + 0.4, centerPos.z);
      },
    };
  }

  // Ending cinematic — camera slowly rises + rotates over the Heart clearing.
  static ending(game, heartseedPos, kind) {
    const centerPos = new THREE.Vector3(heartseedPos.x, 1, heartseedPos.z);
    const startPos = new THREE.Vector3(heartseedPos.x + 5, 2.5, heartseedPos.z + 6);
    const endPos   = new THREE.Vector3(heartseedPos.x - 4, 10, heartseedPos.z + 10);
    return {
      id: `ending_${kind}`,
      duration: 26,
      minSkipT: 3,
      keepLetterbox: true,
      hideHUD: true,
      updateCamera: (t, norm, camera) => {
        const e = easeInOut(norm);
        camera.position.copy(startPos).lerp(endPos, e);
        camera.lookAt(centerPos);
      },
    };
  }
}
