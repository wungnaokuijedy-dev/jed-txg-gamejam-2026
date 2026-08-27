// Main Game class. Owns the renderer, scene, camera, and the frame loop.
// React only mounts this into a container div and receives status callbacks.

import * as THREE from 'three';
import { Input } from './Input.js';
import { Character } from './Character.js';
import { CharacterController } from './CharacterController.js';
import { CameraController } from './CameraController.js';
import { buildTerrainMesh, sampleHeight, AREAS, currentAreaName } from './Terrain.js';
import { buildVegetation } from './Vegetation.js';
import { buildSky, buildDistantMountains, buildMist, buildLeaves } from './Atmosphere.js';
import { MOODS } from './Mood.js';

export class Game {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks; // { onLoadingProgress, onLoaded, onPointerLockChange, onError, onStats }
    this._disposed = false;
    this._started = false;
    this._contextLost = false;

    this.mood = MOODS.DAWN_COOL;

    // Renderer
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-testid', 'game-canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.tabIndex = -1;
    container.appendChild(canvas);
    this.canvas = canvas;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        stencil: false,
      });
    } catch (e) {
      if (this.callbacks.onError) this.callbacks.onError(e);
      throw e;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    // Context loss handling
    canvas.addEventListener('webglcontextlost', (ev) => {
      ev.preventDefault();
      this._contextLost = true;
      if (this.callbacks.onError) this.callbacks.onError(new Error('WebGL context lost'));
    });

    // Scene + camera
    this.scene = new THREE.Scene();
    this.scene.background = this.mood.skyHorizon.clone();
    this.scene.fog = new THREE.FogExp2(this.mood.fogColor, this.mood.fogDensity);

    this.camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 500);
    this.camera.position.set(0, 3, 30);

    // Resize
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);

    // Input
    this.input = new Input(this.canvas);
    this.input.onLockChange = (locked) => {
      if (this.callbacks.onPointerLockChange) this.callbacks.onPointerLockChange(locked);
    };

    // Build world asynchronously so we can show progress
    this._progress = 0;
    this._reportProgress(0.02, 'Preparing scene');
  }

  async load() {
    // We yield to the main thread between steps so the loading UI can render.
    const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

    this._reportProgress(0.08, 'Shaping the land');
    await yieldToUI();
    this.terrain = buildTerrainMesh(this.mood);
    this.scene.add(this.terrain);

    this._reportProgress(0.22, 'Raising the sky');
    await yieldToUI();
    this.sky = buildSky(this.mood);
    this.scene.add(this.sky);
    this.mountains = buildDistantMountains(this.mood);
    this.scene.add(this.mountains);

    this._reportProgress(0.35, 'Kindling the sun');
    await yieldToUI();
    this._setupLights();

    this._reportProgress(0.5, 'Planting the forest');
    await yieldToUI();
    const veg = buildVegetation(this.mood);
    this.vegetation = veg.group;
    this.obstacles = veg.obstacles;
    this.swayMaterials = veg.swayMaterials;
    this.scene.add(this.vegetation);

    this._reportProgress(0.78, 'Weaving the mist');
    await yieldToUI();
    this.mist = buildMist(this.mood);
    this.scene.add(this.mist);
    this.leaves = buildLeaves(this.mood);
    this.scene.add(this.leaves);

    this._reportProgress(0.9, 'Waking the explorer');
    await yieldToUI();
    this.character = new Character();
    // Position at spawn (Area 1)
    const spawnX = 0, spawnZ = 22;
    this.character.root.position.set(spawnX, sampleHeight(spawnX, spawnZ), spawnZ);
    this.character.facingY = Math.PI; // face -Z into the forest
    this.character.model.rotation.y = Math.PI;
    this.scene.add(this.character.root);

    this.charCtrl = new CharacterController(this.character, this.input, this.camera, this.obstacles);
    this.camCtrl = new CameraController(this.camera, this.character, this.input);

    this._reportProgress(1.0, 'Ready');
    if (this.callbacks.onLoaded) this.callbacks.onLoaded();
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(this.mood.hemiSky, this.mood.hemiGround, this.mood.hemiIntensity);
    hemi.position.set(0, 50, 0);
    this.scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(this.mood.sunColor, this.mood.sunIntensity);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    // Tight shadow frustum following player will be updated per frame.
    const cam = sun.shadow.camera;
    cam.left = -25; cam.right = 25; cam.top = 25; cam.bottom = -25;
    cam.near = 0.5; cam.far = 80;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // A single small warm point at the Heart clearing hints at destination
    const heart = new THREE.PointLight(0xffd8a0, 0.9, 22, 2);
    const a5 = AREAS[4];
    heart.position.set(a5.center[0], sampleHeight(a5.center[0], a5.center[1]) + 8, a5.center[1]);
    this.scene.add(heart);
    this.heartLight = heart;
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._lastT = performance.now();
    this._acc = 0;
    this._frames = 0;
    this._fpsSampleT = this._lastT;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  requestPointerLock() { return this.input.requestPointerLock(); }
  isPointerLocked() { return this.input.pointerLocked; }

  _resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _loop(nowMs) {
    if (this._disposed) return;
    requestAnimationFrame(this._loop);
    if (this._contextLost) return;

    const now = nowMs / 1000;
    const last = this._lastT / 1000;
    let dt = now - last;
    // Clamp dt to avoid huge steps after tab background
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    this._lastT = nowMs;

    // Update character + camera regardless of pointer lock so gravity keeps working;
    // Input is naturally zero without lock (movement possible without lock too — that's fine).
    if (this.charCtrl) this.charCtrl.update(dt);
    if (this.camCtrl) this.camCtrl.update(dt);

    // Sway uniforms
    if (this.swayMaterials) {
      for (const m of this.swayMaterials) {
        if (m.userData && m.userData.shader) m.userData.shader.uniforms.uTime.value = now;
      }
    }
    if (this.mist && this.mist.userData.material) {
      this.mist.userData.material.uniforms.uTime.value = now;
    }
    if (this.leaves && this.leaves.userData.material) {
      const mat = this.leaves.userData.material;
      mat.uniforms.uTime.value = now;
      mat.uniforms.uPlayer.value.copy(this.character.root.position);
    }

    // Sun shadow frustum follows player
    if (this.sun) {
      const p = this.character.root.position;
      const dir = this.mood.sunDirection;
      this.sun.position.set(p.x + dir.x * 30, p.y + dir.y * 30, p.z + dir.z * 30);
      this.sun.target.position.set(p.x, p.y, p.z);
      this.sun.target.updateMatrixWorld();
    }
    // Keep sky centered on camera
    if (this.sky) this.sky.position.copy(this.camera.position);

    this.renderer.render(this.scene, this.camera);

    // Stats sampling
    this._frames++;
    if (nowMs - this._fpsSampleT > 500 && this.callbacks.onStats) {
      const fps = (this._frames * 1000) / (nowMs - this._fpsSampleT);
      const p = this.character ? this.character.root.position : null;
      this.callbacks.onStats({
        fps,
        x: p ? p.x : 0,
        y: p ? p.y : 0,
        z: p ? p.z : 0,
        area: p ? currentAreaName(p.x, p.z) : '',
      });
      this._fpsSampleT = nowMs;
      this._frames = 0;
    }
  }

  _reportProgress(p, label) {
    this._progress = p;
    if (this.callbacks.onLoadingProgress) this.callbacks.onLoadingProgress(p, label);
  }

  dispose() {
    this._disposed = true;
    window.removeEventListener('resize', this._onResize);
    if (this.input) this.input.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      const gl = this.renderer.getContext();
      const lose = gl && gl.getExtension && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
    // Best-effort scene cleanup
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose && m.dispose();
        }
      });
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
