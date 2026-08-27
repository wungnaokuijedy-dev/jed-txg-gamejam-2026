// Rain particle system + weather stages.
// Uses point sprites wrapped in a box around the player (like leaves).

import * as THREE from 'three';

export class Weather {
  constructor(game) {
    this.game = game;
    this.stage = 'clear';       // 'clear' | 'mist' | 'rain_light' | 'rain_heavy' | 'clearing' | 'break'
    this._targetIntensity = 0;
    this._currentIntensity = 0;

    // Build rain particles once. Actual visibility scales with intensity.
    const count = 700;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() * 2 - 1) * 12;
      positions[i * 3 + 1] = Math.random() * 12;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 12;
      seeds[i * 3 + 0] = Math.random() * 10;
      seeds[i * 3 + 1] = 0.9 + Math.random() * 0.5;
      seeds[i * 3 + 2] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uPlayer: { value: new THREE.Vector3() },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
        uColor: { value: new THREE.Color(0xcedbe4) },
        uIntensity: { value: 0 },
      },
      vertexShader: `
        uniform float uTime; uniform float uPixelRatio; uniform vec3 uPlayer;
        uniform float uIntensity;
        attribute vec3 aSeed;
        varying float vShade;
        void main() {
          vec3 pos = position;
          // Wrap in a 24x24 box around player
          vec3 rel = pos - uPlayer;
          rel = mod(rel + 12.0, 24.0) - 12.0;
          pos = uPlayer + rel;
          // Fall
          pos.y -= mod(uTime * (12.0 * aSeed.y), 22.0);
          // Wrap Y
          pos.y = mod(pos.y - uPlayer.y - 1.0, 20.0) + uPlayer.y + 1.0;
          vShade = uIntensity;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          if (mv.z > -0.5 || uIntensity < 0.05) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            return;
          }
          gl_PointSize = clamp(uPixelRatio * (8.0 / -mv.z), 1.0, 6.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vShade;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          // Elongated raindrop: narrow X, tall Y
          float d = length(vec2(c.x * 3.5, c.y));
          if (d > 0.5) discard;
          gl_FragColor = vec4(uColor, vShade * 0.55);
        }
      `,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.userData.material = mat;
    this.points.renderOrder = 3;

    this.count = count;
  }

  setStage(stage) {
    if (this.stage === stage) return;
    this.stage = stage;
    switch (stage) {
      case 'clear': this._targetIntensity = 0; break;
      case 'mist': this._targetIntensity = 0.15; break;
      case 'rain_light': this._targetIntensity = 0.55; break;
      case 'rain_heavy': this._targetIntensity = 0.9; break;
      case 'clearing': this._targetIntensity = 0; break;
      case 'break': this._targetIntensity = 0; break;
      default: this._targetIntensity = 0;
    }
  }

  getStage() { return this.stage; }

  update(dt, tNow, playerPos) {
    // Damp intensity toward target
    this._currentIntensity += (this._targetIntensity - this._currentIntensity) * Math.min(1, dt * 0.6);
    const mat = this.points.userData.material;
    mat.uniforms.uTime.value = tNow;
    mat.uniforms.uIntensity.value = this._currentIntensity;
    mat.uniforms.uPlayer.value.copy(playerPos);
  }
}
