// Third-person orbit camera with pointer lock, smooth follow, and terrain de-clip.
// - Mouse dx/dy update yaw/pitch
// - Target camera pos = character head + spherical offset (yaw, pitch, distance)
// - Raycast from head toward camera; if hit, pull camera in
// - Lerp actual camera toward target for smoothness

import * as THREE from 'three';
import { sampleHeight } from './Terrain.js';

const _headPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _hitPos = new THREE.Vector3();

export class CameraController {
  constructor(camera, character, input) {
    this.camera = camera;
    this.character = character;
    this.input = input;

    this.yaw = Math.PI;         // camera behind player, looking -Z into the forest
    this.pitch = -0.18;         // slight look-down
    this.minPitch = -1.3;
    this.maxPitch = 0.55;

    this.distance = 5.5;
    this.minDistance = 1.6;
    this.currentDistance = this.distance;

    this.sensitivity = 0.0025;
    this.followSpeed = 12;      // damp per second

    // Working state
    this._smoothedPos = new THREE.Vector3();
    this._smoothedTarget = new THREE.Vector3();

    // Initialize immediately at character position (avoid first-frame snap).
    this._smoothedTarget.copy(character.root.position).y += 1.55;
    this._recomputeTarget();
    this._smoothedPos.copy(_targetPos);
    this.camera.position.copy(_targetPos);
    this.camera.lookAt(this._smoothedTarget);
  }

  update(dt) {
    // Mouse input
    const [dx, dy] = this.input.consumeMouseDelta();
    if (this.input.pointerLocked) {
      this.yaw -= dx * this.sensitivity;
      this.pitch -= dy * this.sensitivity;
      if (this.pitch < this.minPitch) this.pitch = this.minPitch;
      if (this.pitch > this.maxPitch) this.pitch = this.maxPitch;
    }

    // Head target follows the character's head-ish position (lerped for softness)
    _headPos.copy(this.character.root.position);
    _headPos.y += 1.55;
    this._smoothedTarget.x = THREE.MathUtils.damp(this._smoothedTarget.x, _headPos.x, this.followSpeed, dt);
    this._smoothedTarget.y = THREE.MathUtils.damp(this._smoothedTarget.y, _headPos.y, this.followSpeed, dt);
    this._smoothedTarget.z = THREE.MathUtils.damp(this._smoothedTarget.z, _headPos.z, this.followSpeed, dt);

    // Desired camera pos in spherical coords around target
    this._recomputeTarget();

    // De-clip: cast ray from head toward camera; if terrain intersects earlier, pull in.
    _rayDir.copy(_targetPos).sub(this._smoothedTarget);
    const distToCam = _rayDir.length();
    _rayDir.normalize();

    // Sample terrain along the ray; also enforce a minimum ground clearance.
    let allowedDist = distToCam;
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * distToCam;
      _hitPos.copy(this._smoothedTarget).addScaledVector(_rayDir, t);
      const gy = sampleHeight(_hitPos.x, _hitPos.z);
      // If the ray point dips below terrain, back off.
      if (_hitPos.y < gy + 0.4) {
        allowedDist = Math.max(this.minDistance, t - 0.4);
        break;
      }
    }
    // Also test against character-radius obstacles (skip: cheap enough, terrain covers common cases)

    this.currentDistance = THREE.MathUtils.damp(this.currentDistance, allowedDist, 10, dt);

    // Recompute using clamped distance
    const useDist = this.currentDistance;
    _targetPos.set(0, 0, 0);
    _targetPos.x = this._smoothedTarget.x - Math.sin(this.yaw) * Math.cos(this.pitch) * useDist;
    _targetPos.z = this._smoothedTarget.z - Math.cos(this.yaw) * Math.cos(this.pitch) * useDist;
    _targetPos.y = this._smoothedTarget.y - Math.sin(this.pitch) * useDist;

    // Smooth camera actual pos
    this._smoothedPos.x = THREE.MathUtils.damp(this._smoothedPos.x, _targetPos.x, this.followSpeed, dt);
    this._smoothedPos.y = THREE.MathUtils.damp(this._smoothedPos.y, _targetPos.y, this.followSpeed, dt);
    this._smoothedPos.z = THREE.MathUtils.damp(this._smoothedPos.z, _targetPos.z, this.followSpeed, dt);

    this.camera.position.copy(this._smoothedPos);
    this.camera.lookAt(this._smoothedTarget);
  }

  _recomputeTarget() {
    const d = this.distance;
    _targetPos.x = this._smoothedTarget.x - Math.sin(this.yaw) * Math.cos(this.pitch) * d;
    _targetPos.z = this._smoothedTarget.z - Math.cos(this.yaw) * Math.cos(this.pitch) * d;
    _targetPos.y = this._smoothedTarget.y - Math.sin(this.pitch) * d;
  }
}
