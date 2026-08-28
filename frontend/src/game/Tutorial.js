// Tutorial — a ~20 s, action-driven hint sequence at the start of a NEW game.
// The player keeps full control the whole time; hints are elegant, one-at-a-
// time, and defer automatically during cinematics, choice UI, menus, endings.
// Persists a `tutorial_done` flag in the save so refresh + Continue does not
// replay finished steps.

import { AREAS } from './Terrain.js';

// Step definitions. `mode` describes how a step dismisses:
//   'action'   — dismiss when `check(state)` returns true for `holdMs` ms cumulatively,
//                or after `fallbackMs` ms of showing (whichever first).
//   'timed'    — dismiss purely on `showMs`.
//   'proximity'— dismiss when the player picks up a seed after having entered
//                a `proximityM` radius of one (or after `fallbackMs`).
const STEPS = [
  {
    id: 'move',
    text: 'WASD — walk the forest',
    mode: 'action',
    holdMs: 1500,
    fallbackMs: 6000,
    check: (s) => s.movingInput,
  },
  {
    id: 'sprint',
    text: 'SHIFT — run',
    mode: 'action',
    holdMs: 1000,
    fallbackMs: 5000,
    check: (s) => s.sprinting && s.movingInput,
  },
  {
    id: 'theme',
    text: 'The forest will show you the way — follow what glows and moves',
    mode: 'timed',
    showMs: 4000,
  },
  {
    id: 'map',
    text: 'M — your journal map',
    mode: 'action',
    // Any of these ends this step
    check: (s) => s.mapOpened,
    holdMs: 0,
    fallbackMs: 5000,
    pulseMinimap: true,
  },
  {
    id: 'seed',
    text: 'Glowing seeds can restore what has withered — E to gather',
    mode: 'proximity',
    proximityM: 4.0,
    fallbackMs: 6000,
    // Only surfaces once the player is within proximity of a seed pickup.
  },
  {
    id: 'remember',
    text: 'The forest remembers your choices… and so will the ending',
    mode: 'timed',
    showMs: 4000,
    // Also gated on: first seed picked up OR 60s elapsed in the run
    gate: (state, tSinceRunStart) => state.seedsPickedUp > 0 || tSinceRunStart > 60,
  },
];

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.active = false;
    this._stepIdx = -1;
    this._stepT = 0;         // time this step has been visible (ms)
    this._stepHold = 0;      // cumulative time the current step's action condition has been true (ms)
    this._runT = 0;          // total time since tutorial start (ms), for step-6 gate
    this._proximitySeen = false;   // for step 5
    this._done = false;
    this._deferred = false;
    this._seedsAtStart = 0;
  }

  start() {
    if (this.active || this._done) return;
    const gs = this.game.gameState;
    if (gs && gs.puzzleFlags && gs.puzzleFlags.tutorial_done) {
      this._done = true;
      return;
    }
    this.active = true;
    this._stepIdx = -1;
    this._stepT = 0;
    this._stepHold = 0;
    this._runT = 0;
    this._proximitySeen = false;
    this._seedsAtStart = gs ? gs.seeds : 0;
    this._advance();
  }

  // Called after a save is loaded (Continue) so internal state matches the
  // persisted flag. start() would also do this, but Continue skips start().
  syncFromSave() {
    const gs = this.game.gameState;
    if (gs && gs.puzzleFlags && gs.puzzleFlags.tutorial_done) {
      this._done = true;
      this.active = false;
      this._emitHint(null);
    }
  }

  // Driven from Game.pause()/resume() because the main loop's paused branch
  // returns before Tutorial.update() runs.
  setDeferred(v) {
    const next = !!v;
    if (next === this._deferred) return;
    this._deferred = next;
    if (next) {
      // Hide any active hint while deferred.
      this._emitHint(null);
    } else if (this.active && this._stepIdx >= 0 && this._stepIdx < STEPS.length) {
      // Re-show the current step's hint on resume.
      this._emitHint(STEPS[this._stepIdx]);
    }
  }

  _emitHint(step) {
    if (!this.game.gameState) return;
    this.game.gameState.emit('tutorial_hint', {
      id: step ? step.id : null,
      text: step ? step.text : null,
    });
    if (step && step.pulseMinimap) {
      this.game.gameState.emit('minimap_pulse', {});
    }
  }

  _advance() {
    this._stepIdx++;
    this._stepT = 0;
    this._stepHold = 0;
    if (this._stepIdx >= STEPS.length) {
      // Complete
      this._done = true;
      this.active = false;
      this._emitHint(null);
      if (this.game.gameState) {
        this.game.gameState.setFlag('tutorial_done', true);
      }
      return;
    }
    const step = STEPS[this._stepIdx];
    // For the 'remember' step, wait until its gate is satisfied before showing.
    if (step.gate) {
      const stateSnap = this._makeStateSnap();
      if (!step.gate(stateSnap, this._runT / 1000)) {
        // Show only when the gate opens — but keep tutorial "active" and rely
        // on update() to open it when either condition triggers.
        this._emitHint(null);
        return;
      }
    }
    this._emitHint(step);
  }

  _makeStateSnap() {
    const g = this.game;
    const gs = g.gameState;
    const seeds = gs ? gs.seeds : 0;
    // Movement state — approximate via character velocity magnitude
    const vx = g.character ? g.character.velocity.x : 0;
    const vz = g.character ? g.character.velocity.z : 0;
    const speed = Math.hypot(vx, vz);
    const movingInput = speed > 0.5;
    const sprinting = g.input ? g.input.isSprint() : false;
    return {
      seeds,
      seedsPickedUp: seeds - this._seedsAtStart,
      movingInput,
      sprinting,
      mapOpened: !!g._mapOpenedSinceTutorial,
    };
  }

  update(dt) {
    if (!this.active) return;
    // Defer during any UI/cinematic/choice/ending/menu
    const shouldDefer = this._shouldDefer();
    if (shouldDefer) {
      if (!this._deferred) {
        this._deferred = true;
        this._emitHint(null);
      }
      return;
    }
    if (this._deferred) {
      // Re-emit the current step's hint
      this._deferred = false;
      const s = STEPS[this._stepIdx];
      if (s) this._emitHint(s);
    }

    this._runT += dt * 1000;
    const step = STEPS[this._stepIdx];
    if (!step) return;

    // Handle gate for the last step: if hint isn't showing yet, poll gate.
    if (step.gate) {
      const snap = this._makeStateSnap();
      if (!step.gate(snap, this._runT / 1000)) {
        // Wait patiently
        return;
      }
      // Gate opened — emit hint (if not already) and start its timer
      if (this._stepT === 0) this._emitHint(step);
    }

    this._stepT += dt * 1000;

    if (step.mode === 'timed') {
      if (this._stepT >= step.showMs) this._advance();
      return;
    }

    if (step.mode === 'action') {
      const snap = this._makeStateSnap();
      if (step.check && step.check(snap)) {
        this._stepHold += dt * 1000;
      }
      if (this._stepHold >= step.holdMs && step.holdMs > 0) { this._advance(); return; }
      if (step.holdMs === 0 && step.check && step.check(snap)) { this._advance(); return; }
      if (this._stepT >= step.fallbackMs) this._advance();
      return;
    }

    if (step.mode === 'proximity') {
      // Only show the hint when the player enters proximity of a seed for the
      // first time. Before that, keep the hint hidden but keep the fallback
      // running (uses run-elapsed rather than step-visible time).
      const seeds = this.game.interactables ? this.game.interactables.items.filter(
        (it) => it.id && it.id.startsWith('seed_') && !it.isConsumed && it.isAvailable && it.isAvailable()
      ) : [];
      let inProx = false;
      if (this.game.character) {
        const cp = this.game.character.root.position;
        for (const it of seeds) {
          const dx = it.position.x - cp.x;
          const dz = it.position.z - cp.z;
          if (dx * dx + dz * dz < step.proximityM * step.proximityM) { inProx = true; break; }
        }
      }
      if (inProx && !this._proximitySeen) {
        this._proximitySeen = true;
        this._emitHint(step);
        this._stepT = 0;
      }
      if (this._proximitySeen) {
        // Dismiss when a seed has been picked up (seeds counter increases)
        const snap = this._makeStateSnap();
        if (snap.seedsPickedUp > 0) { this._advance(); return; }
        if (this._stepT >= step.fallbackMs) { this._advance(); return; }
      } else {
        // Long-running run-time fallback: if the player wanders 90 s without
        // getting near a seed, skip this step and move on.
        if (this._runT > 90000) this._advance();
      }
      return;
    }
  }

  _shouldDefer() {
    const g = this.game;
    if (g.cinematic && g.cinematic.isActive()) return true;
    if (g.gameState && g.gameState.hudHidden) return true;
    if (g.gameState && g.gameState.endingResolved) return true;
    if (g.gameState && g.gameState.choiceMade) return true;
    // Menu / paused / overlays are signalled indirectly — Game exposes `_paused`
    if (g._paused) return true;
    if (g._menuMode) return true;
    return false;
  }

  // Called by GameApp when the map (or mini-map action) is opened.
  markMapOpened() {
    this.game._mapOpenedSinceTutorial = true;
  }
}
