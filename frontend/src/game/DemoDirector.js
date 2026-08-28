// -----------------------------------------------------------------------------
// DemoDirector — hidden ~2-minute scripted showcase mode.
//
// Additive-only: does NOT read or write the player's persisted save, endings-
// seen record, or settings. Reuses the game's existing puzzles, cinematics,
// tutorial hints, wildlife, and choice UI — nothing new appears in-world.
//
// Activated via URL `?demo=1` (or F9 on the main menu). Never visible from the
// regular menu path. Exit at any time via Esc → "Exit Demo".
//
// Structure: 7 beats matching the client's 2-min pacing brief. Each beat has
//   - an entry setup that teleports the player and pre-arranges world state,
//   - an optional caption (small elegant text at top),
//   - an optional sub-sequence of tutorial hints (Beat 2),
//   - an isDone() condition (natural completion),
//   - a soft timeout so the beat cannot stall the video.
//
// The player plays each beat FOR REAL. N key = force-advance (0.5s fade →
// teleport + state set → 0.5s fade in). Esc = quit demo (returns to menu with
// the player's real save intact).
// -----------------------------------------------------------------------------
import * as THREE from 'three';
import { sampleHeight, AREAS } from './Terrain.js';

// Beat table. Positions align with Puzzles.js:
//   - seed_1        (6, 15)   in Area 1
//   - plant_bridge  (-42, -4) in Area 2
//   - spring        (48, -14) in Area 3
//   - grove center  AREAS[3]  in Area 4
//   - heart center  AREAS[4]  in Area 5
const BEATS = [
  {
    id: 'opening', label: 'The forest',
    targetSecs: 15,
    // No setup — game's real newGame flow already teleports to spawn and
    // plays the opening cinematic. We only need to observe when it ends.
    setup: (_g) => {},
    isDone: (g) => !g.cinematic || !g.cinematic.isActive(),
    timeoutMs: 18000,
    hideCaption: true,        // opening has its own subtitles
  },
  {
    id: 'controls', label: 'Movement',
    targetSecs: 20,
    setup: (g) => {
      // Ensure tutorial hints can drive the beat even if the player already
      // completed the tutorial in a different session (we're on isolated state
      // anyway — puzzleFlags is reset per demo run).
      if (g.tutorial) {
        try {
          g.tutorial._done = false;
          g.tutorial.active = false;
          if (g.gameState) g.gameState.puzzleFlags.tutorial_done = false;
        } catch (_) {}
      }
    },
    // Sub-sequence of quick hints (each ~2.5-3.5s). Fires ONE hint at a time
    // via the same event as the real tutorial, so nothing new appears.
    hints: [
      { text: 'WASD — walk the forest',            durMs: 3200 },
      { text: 'SHIFT — run',                        durMs: 2800 },
      { text: 'SPACE — jump',                       durMs: 2600 },
      { text: 'E — interact with the world',        durMs: 3000 },
      { text: 'M — your journal map',               durMs: 3200, pulseMinimap: true },
    ],
    isDone: (_g, self) => self._hintsDone === true,
    timeoutMs: 22000,
  },
  {
    id: 'seeds', label: 'Follow what glows',
    targetSecs: 20,
    setup: (g) => {
      // Teleport near the first seed in Area 1 (from Puzzles.js seedSpecs[0]).
      _placePlayer(g, 4, 12);
      if (g.gameState) g.gameState.setObjective('Follow what glows.');
    },
    isDone: (g) => g.gameState && g.gameState.seeds >= 1,
    timeoutMs: 22000,
  },
  {
    id: 'bridge', label: 'Plant your seed',
    targetSecs: 20,
    setup: (g) => {
      // Teleport in front of the withered plant at (-42, -4), Area 2.
      _placePlayer(g, -40, -2);
      // Guarantee the player has a seed in hand.
      if (g.gameState) {
        while (g.gameState.seeds < 1) g.gameState.addSeed(1);
        g.gameState.setObjective('Something is wrong with the old plant.');
      }
    },
    isDone: (g) => g.gameState && !!g.gameState.puzzleFlags.grow_done,
    timeoutMs: 22000,
  },
  {
    id: 'stream', label: 'The stream is silent',
    targetSecs: 20,
    setup: (g) => {
      // Teleport near the spring at (48, -14), Area 3.
      _placePlayer(g, 42, -12);
      const gs = g.gameState;
      if (gs) {
        gs.puzzleFlags.grow_done = true;   // upstream prerequisite for a coherent scene
        gs.setObjective('The stream is silent — the water must return.');
      }
    },
    isDone: (g) => g.gameState && !!g.gameState.puzzleFlags.restore_done,
    timeoutMs: 22000,
  },
  {
    id: 'grove', label: 'The forest is listening',
    targetSecs: 15,
    setup: (g) => {
      // Teleport into Area 4 (Ancient Grove).
      const a = AREAS[3];
      _placePlayer(g, a.center[0] - 4, a.center[1] + 2);
      const gs = g.gameState;
      if (gs) {
        gs.puzzleFlags.grow_done = true;
        gs.puzzleFlags.restore_done = true;
        gs.puzzleFlags.bird_freed = true;
        // Awaken stones so the Heart gate opens without another puzzle beat.
        if (!gs.puzzleFlags.stones_awoken) {
          gs.setFlag('stones_awoken', true);
        }
        gs.setObjective('The Heart of the Forest calls.');
      }
    },
    isDone: (g) => {
      const p = g.character.root.position;
      const a5 = AREAS[4];
      const dx = p.x - a5.center[0];
      const dz = p.z - a5.center[1];
      return (dx * dx + dz * dz) < (a5.radius * a5.radius);
    },
    timeoutMs: 18000,
  },
  {
    id: 'choice', label: 'The Heartseed',
    targetSecs: 10,
    setup: (g) => {
      // Drop the player at the Heartseed and open the choice.
      const hs = g.puzzles && g.puzzles._heartseedPos;
      if (hs) _placePlayer(g, hs.x - 1.5, hs.z + 1.5);
      const gs = g.gameState;
      if (gs) {
        // Set health high so a natural Guardian ending showcases best.
        const cur = gs.health || 0;
        if (cur < 85) gs.addHealth(85 - cur, 'demo');
        gs.puzzleFlags.heart_reached = true;
        gs.setObjective('The Heartseed — take, leave, or share?');
      }
      // Fire the choice cinematic → choice UI.
      if (g.startFinalChoiceSequence) g.startFinalChoiceSequence();
    },
    isDone: (g) => g.gameState && !!g.gameState.endingResolved,
    timeoutMs: 60000,     // ending cinematic + card fits well under this
    hideCaption: true,    // the letterbox + subtitles carry the beat
  },
];

// ----------------- placement helper -----------------
function _placePlayer(g, x, z) {
  if (!g.character) return;
  const y = sampleHeight(x, z);
  g.character.root.position.set(x, y, z);
  g.character.velocity.set(0, 0, 0);
  // Face toward the map center so the camera pans across the forest.
  g.character.facingY = Math.atan2(-x, -z);
  if (g.charCtrl) {
    try {
      g.charCtrl._smoothedWish.set(0, 0, 0);
      g.charCtrl._targetSpeedSm = g.charCtrl.walkSpeed;
    } catch (_) {}
  }
  if (g.camCtrl) {
    try {
      // Snap the follow camera behind the player so no long lerp is visible.
      // CameraController.yaw is public — we set it to match character facing.
      g.camCtrl.yaw = g.character.facingY + Math.PI;
    } catch (_) {}
  }
}

// ----------------- Director -----------------
export class DemoDirector {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.beatIdx = -1;
    this._beatT = 0;             // wall time since beat entered (ms)
    this._runT = 0;              // wall time since demo started (ms)
    this._hintIdx = -1;
    this._hintT = 0;
    this._hintsDone = false;
    this._fadeAlpha = 0;
    this._fadeDir = 0;           // -1 = fading out, +1 = fading in
    this._pendingAdvance = false;
    this._observedTimings = [];  // for post-run reporting
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.beatIdx = -1;
    this._runT = 0;
    this._observedTimings = [];
    this._emitState();
    // Delay the first beat entry by one frame so listeners are attached.
    this._enter(0);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this._emitState();
  }

  // N key or on-screen "Next" — quick fade + advance.
  forceAdvance() {
    if (!this.active) return;
    if (this._fadeDir !== 0) return;   // already in a transition
    this._pendingAdvance = true;
    // Ramp UP to opaque black, teleport, then ramp DOWN to clear.
    this._fadeDir = +1;
    this._fadeAlpha = 0;
  }

  // Called from Game._loop each frame.
  update(dt) {
    if (!this.active) return;
    const dtMs = dt * 1000;
    this._runT += dtMs;
    this._beatT += dtMs;

    // Fade transition (0.5s each direction). Alpha: 0=clear, 1=opaque black.
    if (this._fadeDir !== 0) {
      this._fadeAlpha += this._fadeDir * (dt / 0.5);
      if (this._fadeAlpha >= 1) {
        this._fadeAlpha = 1;
        // At peak black: do the teleport + state-set, then reverse direction.
        if (this._pendingAdvance) {
          this._pendingAdvance = false;
          this._enter(this.beatIdx + 1);
        }
        this._fadeDir = -1;
      } else if (this._fadeAlpha <= 0) {
        this._fadeAlpha = 0;
        this._fadeDir = 0;
      }
      this._emitState();
      return;
    }

    const beat = BEATS[this.beatIdx];
    if (!beat) return;

    // Beat 2's tutorial-hint sub-sequence
    if (beat.hints && this._hintIdx < beat.hints.length) {
      this._hintT += dtMs;
      const h = beat.hints[this._hintIdx];
      if (this._hintT >= h.durMs) {
        this._hintIdx++;
        this._hintT = 0;
        if (this._hintIdx < beat.hints.length) {
          this._emitHint(beat.hints[this._hintIdx]);
        } else {
          this._emitHint(null);
          this._hintsDone = true;
        }
      }
    }

    // Beat completion check
    let done = false;
    try { done = !!beat.isDone(this.game, this); } catch (_) {}
    if (done || this._beatT >= beat.timeoutMs) {
      // Log the observed real duration for the client's per-beat pacing report.
      this._observedTimings.push({ id: beat.id, ms: Math.round(this._beatT) });
      // For the last beat, hold on the ending card until user acts.
      if (this.beatIdx >= BEATS.length - 1) {
        // Do not auto-advance past the ending — the ending card is the outro.
        return;
      }
      // Auto-advance uses the same fade path.
      this.forceAdvance();
    }
  }

  _enter(idx) {
    this.beatIdx = Math.max(-1, Math.min(BEATS.length - 1, idx));
    if (this.beatIdx < 0) return;
    this._beatT = 0;
    this._hintIdx = -1;
    this._hintT = 0;
    this._hintsDone = false;
    const beat = BEATS[this.beatIdx];
    if (!beat) return;
    try { beat.setup(this.game); } catch (_) {}
    // Sub-sequence init
    if (beat.hints && beat.hints.length > 0) {
      this._hintIdx = 0;
      this._emitHint(beat.hints[0]);
    } else {
      this._emitHint(null);
    }
  }

  _emitHint(h) {
    if (!this.game.gameState) return;
    // Reuse the same event the real tutorial uses so no new UI is invented.
    this.game.gameState.emit('tutorial_hint', {
      id: h ? 'demo' : null,
      text: h ? h.text : null,
    });
    if (h && h.pulseMinimap) {
      this.game.gameState.emit('minimap_pulse', {});
    }
  }

  _emitState() {
    if (!this.game.gameState) return;
    this.game.gameState.emit('demo_state', {
      active: this.active,
      beatIdx: this.beatIdx,
      beatCount: BEATS.length,
      label: (this.beatIdx >= 0 && BEATS[this.beatIdx] && !BEATS[this.beatIdx].hideCaption) ? BEATS[this.beatIdx].label : null,
      fadeAlpha: this._fadeAlpha,
      runMs: Math.round(this._runT),
      timings: this._observedTimings.slice(),
    });
  }

  getBeatCount() { return BEATS.length; }
  getObservedTimings() { return this._observedTimings.slice(); }
}
