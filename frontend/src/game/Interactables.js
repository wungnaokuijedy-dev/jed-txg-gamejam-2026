// Interactables system.
// - Registrar of point-based interactables (position, radius, verb, onInteract).
// - Each frame it picks the best candidate (nearest inside radius and roughly in
//   front of the character) and emits a prompt through GameState.
// - Triggering an interaction plays a kneel/reach pose on the character for ~1s
//   while the onInteract effect runs, and eases the camera slightly toward the
//   interaction point.

import * as THREE from 'three';

const _forward = new THREE.Vector3();

export class Interactables {
  constructor(game) {
    this.game = game;
    this.items = [];    // { id, position: Vector3, radius, verb, onInteract, isAvailable, oneShot }
    this.busy = false;  // true while a kneel-and-interact sequence is running

    // Cache scene forward vector by frame
    this._headingVec = new THREE.Vector3();
  }

  register(cfg) {
    // cfg = { id, position: [x, y, z] or Vector3, radius, verb, onInteract,
    //         isAvailable?: () => bool, oneShot?: bool, camPullIn?: number }
    const pos = cfg.position instanceof THREE.Vector3
      ? cfg.position.clone()
      : new THREE.Vector3(cfg.position[0], cfg.position[1], cfg.position[2]);
    this.items.push({
      id: cfg.id,
      position: pos,
      radius: cfg.radius ?? 2.6,
      verb: cfg.verb,
      onInteract: cfg.onInteract || (() => {}),
      isAvailable: cfg.isAvailable || (() => true),
      oneShot: cfg.oneShot !== false, // default true
      camPullIn: cfg.camPullIn ?? 0.4,
      _consumed: false,
    });
  }

  unregister(id) {
    this.items = this.items.filter((i) => i.id !== id);
    if (this.game.gameState.activePromptTargetId === id) {
      this.game.gameState.setActivePrompt('', null);
    }
  }

  // Called each frame after character/camera update.
  update(dt) {
    if (this.busy) {
      // Ignore other prompts while an interaction is running.
      return;
    }

    const char = this.game.character;
    if (!char) return;
    const cp = char.root.position;

    // Character's world forward vector (from facingY)
    const fy = char.facingY;
    _forward.set(Math.sin(fy), 0, Math.cos(fy));

    // Find best candidate (closest, in front of the character).
    let best = null;
    let bestScore = Infinity;
    for (const it of this.items) {
      if (it._consumed && it.oneShot) continue;
      if (!it.isAvailable()) continue;
      const dx = it.position.x - cp.x;
      const dz = it.position.z - cp.z;
      const d2 = dx * dx + dz * dz;
      const rr = it.radius * it.radius;
      if (d2 > rr) continue;
      // Facing bonus — smaller score if in front, so it wins over behind-back items.
      const d = Math.sqrt(Math.max(d2, 1e-6));
      const nx = dx / d, nz = dz / d;
      const facingDot = _forward.x * nx + _forward.z * nz; // -1..1
      const facingBias = facingDot > 0 ? 0 : 1.5; // penalize items behind
      const score = d + facingBias;
      if (score < bestScore) { bestScore = score; best = it; }
    }

    if (best) {
      this.game.gameState.setActivePrompt(`E — ${best.verb}`, best.id);
      this._current = best;
    } else {
      this.game.gameState.setActivePrompt('', null);
      this._current = null;
    }

    // Trigger with E key (consumed via edge-detect on Input)
    if (this._current && this.game.input.consumeInteractPress()) {
      this._trigger(this._current);
    }
  }

  async _trigger(item) {
    if (this.busy) return;
    this.busy = true;
    this.game.gameState.setActivePrompt('', null);

    const character = this.game.character;
    const camCtrl = this.game.camCtrl;

    // Face the interactable
    const cp = character.root.position;
    const heading = Math.atan2(item.position.x - cp.x, item.position.z - cp.z);
    character._pendingFaceOverride = heading;

    // Enter kneel pose. Character.updateAnimation will pick this up.
    character.beginPose('kneel');

    // Camera pull-in
    if (camCtrl && item.camPullIn > 0) {
      camCtrl._interactionPullIn = item.camPullIn;
    }

    // Wait ~1s while pose plays; then run effect
    await new Promise((r) => setTimeout(r, 550));
    try {
      await item.onInteract({ game: this.game, gameState: this.game.gameState });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[interact]', item.id, e);
    }
    await new Promise((r) => setTimeout(r, 550));

    character.endPose();
    if (camCtrl) camCtrl._interactionPullIn = 0;
    character._pendingFaceOverride = null;

    if (item.oneShot) item._consumed = true;
    this.busy = false;
  }
}
