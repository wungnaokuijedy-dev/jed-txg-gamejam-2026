// Character physics + input-driven controller.
// - Camera-relative WASD movement
// - Smooth accel/decel (weighty but responsive)
// - Space single jump with anticipation + landing squash
// - Ground follow via terrain sampleHeight (analytic, no raycast per frame)
// - Simple radial obstacle collision (checked against a shared obstacle list)

import * as THREE from 'three';
import { sampleHeight, MAP_HALF } from './Terrain.js';

const _wishDir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _horiz = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export class CharacterController {
  constructor(character, input, camera, obstacles) {
    this.character = character;
    this.input = input;
    this.camera = camera;
    this.obstacles = obstacles; // array of { x, z, r } world-space cylinders

    this.walkSpeed = 3.5;
    this.runSpeed = 6.5;
    this.accel = 22;    // ground accel
    this.decel = 18;    // ground decel
    this.airControl = 0.35;
    this.jumpSpeed = 6.5;
    this.gravity = -20;

    this.grounded = true;
    this.wasGrounded = true;
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;
    this.playerRadius = 0.35;

    // ---- Feel smoothing state (Phase 6 fix) ----
    // Smoothed wish direction so A↔D taps or diagonal flips don't cause
    // single-frame twitches. Lerped toward raw input over ~100 ms.
    this._smoothedWish = new THREE.Vector3();
    // Smoothed target speed so Shift on/off eases walk↔run instead of stepping.
    // Everything derived from speed (stride, lean, moveBlend) reads the actual
    // horizontal velocity — which is already smoothed — this just softens
    // the target so the ramp is exponential rather than a linear-time snap.
    this._targetSpeedSm = this.walkSpeed;

    // Initial ground snap
    const p = this.character.root.position;
    p.y = sampleHeight(p.x, p.z);
  }

  _groundY(x, z) { return sampleHeight(x, z); }

  update(dt) {
    const c = this.character;
    const cam = this.camera;

    // While the character is in a locked pose (kneel/interact), freeze inputs.
    if (c.isInPose && c.isInPose()) {
      c.velocity.x = 0;
      c.velocity.z = 0;
      // Still apply gravity & terrain grounding
      const p = c.root.position;
      const groundY = require && false ? 0 : this._groundY(p.x, p.z);
      c.velocity.y = 0;
      p.y = groundY;
      // Facing override if requested by interactables
      if (c._pendingFaceOverride !== null && c._pendingFaceOverride !== undefined) {
        c.updateAnimation(dt, 0, true, c._pendingFaceOverride);
      } else {
        c.updateAnimation(dt, 0, true, null);
      }
      return;
    }

    // Camera forward/right on horizontal plane
    cam.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.copy(_fwd).cross(new THREE.Vector3(0, 1, 0)).normalize();
    // right = forward × up (right-handed, Y-up). Yields world +X when forward is -Z,
    // world -X when forward is +Z — matches player expectations either way.

    // Read WASD
    let ix = 0, iz = 0;
    if (this.input.isMoveForward()) iz += 1;
    if (this.input.isMoveBackward()) iz -= 1;
    if (this.input.isMoveRight()) ix += 1;
    if (this.input.isMoveLeft()) ix -= 1;

    // Raw wish direction from this frame's input
    const _rawWish = _tmp.set(0, 0, 0);
    if (ix !== 0 || iz !== 0) {
      _rawWish.copy(_fwd).multiplyScalar(iz)
              .add(new THREE.Vector3().copy(_right).multiplyScalar(ix));
      _rawWish.y = 0;
      if (_rawWish.lengthSq() > 1e-6) _rawWish.normalize();
    }
    // Smooth the wish direction toward the raw input over ~100 ms so rapid
    // A↔D wiggles or diagonal single-frame flips don't twitch the body.
    // damp() is a first-order low-pass: current + (target - current) * (1 - exp(-lambda*dt))
    const wishLambda = 12;   // ~0.083 s time constant → 95% in ~250 ms
    this._smoothedWish.x = THREE.MathUtils.damp(this._smoothedWish.x, _rawWish.x, wishLambda, dt);
    this._smoothedWish.z = THREE.MathUtils.damp(this._smoothedWish.z, _rawWish.z, wishLambda, dt);
    _wishDir.copy(this._smoothedWish);
    // Renormalise so magnitude is 0..1 and diagonal doesn't sneak past 1.
    const sq = _wishDir.x * _wishDir.x + _wishDir.z * _wishDir.z;
    if (sq > 1) _wishDir.multiplyScalar(1 / Math.sqrt(sq));

    // "Moving input" — true while there is any pushed direction, using the
    // raw signal so releasing all keys transitions to decel immediately.
    const isMovingInput = (ix !== 0 || iz !== 0);
    const sprinting = this.input.isSprint() && isMovingInput;

    // Smooth the target speed. Accel time constant is a touch faster than
    // decel so pressing Shift feels responsive but releasing it eases down.
    const rawTargetSpeed = sprinting ? this.runSpeed : this.walkSpeed;
    const speedLambda = (rawTargetSpeed > this._targetSpeedSm) ? 4 : 3;   // ~0.25 s up, ~0.33 s down
    this._targetSpeedSm = THREE.MathUtils.damp(this._targetSpeedSm, rawTargetSpeed, speedLambda, dt);
    const targetSpeed = isMovingInput ? this._targetSpeedSm : 0;

    // Horizontal velocity target
    const targetVel = new THREE.Vector3().copy(_wishDir).multiplyScalar(targetSpeed);

    _horiz.set(c.velocity.x, 0, c.velocity.z);
    const rate = this.grounded
      ? (isMovingInput ? this.accel : this.decel)
      : this.accel * this.airControl;

    // Move horizontal velocity toward target
    const delta = new THREE.Vector3().copy(targetVel).sub(_horiz);
    const step = rate * dt;
    if (delta.length() <= step) _horiz.copy(targetVel);
    else _horiz.add(delta.setLength(step));

    // Jump buffering + coyote time
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    if (this.input.isJump()) this.jumpBuffer = 0.12;

    if (this.jumpBuffer > 0 && (this.grounded || this.coyoteTimer > 0)) {
      c.velocity.y = this.jumpSpeed;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBuffer = 0;
      c.triggerSquash(0.45);
    }

    // Gravity
    c.velocity.y += this.gravity * dt;

    // Apply horizontal
    c.velocity.x = _horiz.x;
    c.velocity.z = _horiz.z;

    // Integrate
    const p = c.root.position;
    let nx = p.x + c.velocity.x * dt;
    let nz = p.z + c.velocity.z * dt;
    let ny = p.y + c.velocity.y * dt;

    // Radial obstacle collision (push out along XZ)
    if (this.obstacles && this.obstacles.length) {
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        const dx = nx - o.x;
        const dz = nz - o.z;
        const rr = (o.r + this.playerRadius);
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (rr - d);
          nx += (dx / d) * push;
          nz += (dz / d) * push;
        }
      }
    }

    // Soft world bounds
    const bound = MAP_HALF - 2;
    if (nx > bound) nx = bound;
    if (nx < -bound) nx = -bound;
    if (nz > bound) nz = bound;
    if (nz < -bound) nz = -bound;

    // Ground sampling
    const groundY = sampleHeight(nx, nz);
    let groundedNow = false;
    if (ny <= groundY) {
      ny = groundY;
      if (c.velocity.y < -1.5 && !this.grounded) {
        // landing squash proportional to fall speed
        const amt = THREE.MathUtils.clamp(-c.velocity.y / 12, 0.15, 0.7);
        c.triggerSquash(amt);
      }
      c.velocity.y = 0;
      groundedNow = true;
    }

    p.set(nx, ny, nz);

    this.wasGrounded = this.grounded;
    this.grounded = groundedNow;
    if (this.wasGrounded && !this.grounded) this.coyoteTimer = 0.12;

    // Facing direction from actual horizontal velocity (not input) — feels weighty.
    const horizSpeed = Math.hypot(c.velocity.x, c.velocity.z);
    let facing = null;
    if (horizSpeed > 0.4) {
      facing = Math.atan2(c.velocity.x, c.velocity.z);
    }

    const speedN = horizSpeed / this.runSpeed;
    c.updateAnimation(dt, speedN, this.grounded, facing);
    c.grounded = this.grounded;
  }
}
