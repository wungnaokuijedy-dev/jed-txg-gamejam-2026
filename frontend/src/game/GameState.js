// Central GameState. Small event bus. Continuous mood-lerp driven by health.
// Save/restore hooks and the ending band will land in Phase 3.

import { MOODS, lerpMood } from './Mood.js';
import * as THREE from 'three';

export class GameState {
  constructor(game) {
    this.game = game;

    // Persistent-ish state
    this.health = 50;         // 0..100
    this.seeds = 0;
    this.puzzleFlags = {
      grow_done: false,       // Area 2 vine bridge grown
      restore_done: false,    // Area 3 spring cleared → water flowing
      bird_freed: false,      // Bonus but part of Area 3 flow
      stones_awoken: false,   // Area 4 stones activated
      heart_reached: false,   // Heart of the Forest entered
    };
    // Track which optional plants / temptation actions have been done
    this.doneInteractions = new Set();

    // Phase 4: which areas the player has visited (used for map reveal).
    this.visitedAreas = new Set();

    // Objective text (short, poetic)
    this.objective = 'The forest is waiting…';

    // Currently-showing prompt for interactables
    this.activePromptText = '';
    this.activePromptTargetId = null;

    // Phase 3 — final choice + ending
    this.choiceMade = null;         // 'take' | 'leave' | 'share' | null
    this.endingKind = null;         // 'guardian' | 'balance' | 'silence' | null
    this.endingResolved = false;
    this.hudHidden = false;         // cinematic hides HUD

    // Smoothed mood lerp t = healthToMoodT (0 = cool/dawn, 1 = warm/healed)
    this._moodT = this._healthToMoodT(this.health);
    this._moodTTarget = this._moodT;

    // Listeners for events emitted by the system
    this._listeners = new Map();
  }

  // -------- Event bus --------
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event).delete(fn);
  }
  emit(event, payload) {
    const s = this._listeners.get(event);
    if (s) for (const fn of s) { try { fn(payload); } catch (e) { console.warn(e); } }
  }

  // -------- Actions --------
  addHealth(delta, reason = '') {
    const before = this.health;
    this.health = Math.max(0, Math.min(100, this.health + delta));
    if (this.health !== before) {
      this._moodTTarget = this._healthToMoodT(this.health);
      this.emit('health', { health: this.health, delta, reason });
    }
  }

  // Mood ramp: health 0..40 stays cool dawn (t=0); 40..90 lerps to 1; 90..100 stays warm.
  _healthToMoodT(h) {
    return Math.max(0, Math.min(1, (h - 40) / 50));
  }

  addSeed() {
    this.seeds++;
    this.emit('seeds', { seeds: this.seeds });
  }
  useSeed() {
    if (this.seeds <= 0) return false;
    this.seeds--;
    this.emit('seeds', { seeds: this.seeds });
    return true;
  }

  setObjective(text) {
    if (text === this.objective) return;
    this.objective = text;
    this.emit('objective', { objective: this.objective });
  }

  markDone(id) {
    if (this.doneInteractions.has(id)) return false;
    this.doneInteractions.add(id);
    return true;
  }
  isDone(id) { return this.doneInteractions.has(id); }

  // Phase 4 — record area visit for the journal map.
  recordAreaVisit(name) {
    // Map name → id
    const idByName = {
      'The Entrance': 1,
      'Whispering Woods': 2,
      'The Silent Stream': 3,
      'The Ancient Grove': 4,
      'The Heart of the Forest': 5,
    };
    const id = idByName[name];
    if (!id) return;
    if (!this.visitedAreas.has(id)) {
      this.visitedAreas.add(id);
      this.emit('area_visited', { id, name });
    }
  }

  setFlag(k, v = true) {
    if (this.puzzleFlags[k] === v) return;
    this.puzzleFlags[k] = v;
    this.emit('flag', { key: k, value: v });
  }

  setActivePrompt(text, targetId) {
    if (this.activePromptText === text && this.activePromptTargetId === targetId) return;
    this.activePromptText = text;
    this.activePromptTargetId = targetId;
    this.emit('prompt', { text, targetId });
  }

  healthTier() {
    if (this.health >= 70) return 2;   // young tree
    if (this.health >= 40) return 1;   // sapling
    return 0;                          // sprout
  }

  // Final ending resolution. The choice is applied as a health modifier
  // and the resulting band determines the ending — so gameplay history
  // dominates the outcome, not the button pressed alone.
  //   TAKE  -15   LEAVE +15   SHARE +5
  //   >=75  guardian   40-74  balance   <40  silence
  resolveEnding(choice) {
    if (this.endingResolved) return this.endingKind;
    const mod = choice === 'take' ? -15 : choice === 'leave' ? 15 : 5;
    const finalHealth = Math.max(0, Math.min(100, this.health + mod));
    const before = this.health;
    this.health = finalHealth;
    this._moodTTarget = this._healthToMoodT(this.health);
    this.emit('health', { health: this.health, delta: finalHealth - before, reason: 'choice_' + choice });

    let kind;
    if (finalHealth >= 75) kind = 'guardian';
    else if (finalHealth >= 40) kind = 'balance';
    else kind = 'silence';

    this.choiceMade = choice;
    this.endingKind = kind;
    this.endingResolved = true;
    this.emit('choice_resolved', { choice, kind, finalHealth });
    return kind;
  }

  update(dt) {
    // Smooth mood-lerp toward target (t is 0..1)
    this._moodT = THREE.MathUtils.damp(this._moodT, this._moodTTarget, 1 / 3, dt); // ~3s smoothing
    // Update scene mood values
    const t = this._moodT;
    const cur = lerpMood(MOODS.DAWN_COOL, MOODS.WARM_HEALED, t);
    if (this.game && this.game.applyMood) this.game.applyMood(cur);
    // Density scaling for optional flower tiers + firefly count etc. is done via emit('mood') below
    this.emit('mood', { t, current: cur });

    // Dump debug on request
    if (this._pendingDump) {
      this._pendingDump = false;
      try {
        // eslint-disable-next-line no-console
        console.log('[GameState]', {
          health: this.health,
          seeds: this.seeds,
          flags: this.puzzleFlags,
          done: Array.from(this.doneInteractions),
          objective: this.objective,
          moodT: this._moodT.toFixed(2),
        });
      } catch (_) {}
    }
  }

  dumpDebug() { this._pendingDump = true; }
}
