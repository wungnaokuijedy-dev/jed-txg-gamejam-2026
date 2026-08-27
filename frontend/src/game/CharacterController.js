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

    // Initial ground snap
    const p = this.character.root.position;
    p.y = sampleHeight(p.x, p.z);
  }

  update(dt) {
    const c = this.character;
    const cam = this.camera;

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

    _wishDir.set(0, 0, 0);
    if (ix !== 0 || iz !== 0) {
      _wishDir.copy(_fwd).multiplyScalar(iz).add(_tmp.copy(_right).multiplyScalar(ix));
      _wishDir.y = 0;
      if (_wishDir.lengthSq() > 1e-6) _wishDir.normalize();
    }

    const sprinting = this.input.isSprint() && _wishDir.lengthSq() > 0;
    const targetSpeed = sprinting ? this.runSpeed : this.walkSpeed;

    // Horizontal velocity target
    const targetVel = _tmp.copy(_wishDir).multiplyScalar(targetSpeed);

    _horiz.set(c.velocity.x, 0, c.velocity.z);
    const isMovingInput = _wishDir.lengthSq() > 0;
    const rate = this.grounded
      ? (isMovingInput ? this.accel : this.decel)
      : this.accel * this.airControl;

    // Move horizontal velocity toward target
    const delta = _tmp.copy(targetVel).sub(_horiz);
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
