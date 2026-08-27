// Main Game class. Owns the renderer, scene, camera, and the frame loop.
// React only mounts this into a container div and receives status callbacks.

import * as THREE from 'three';
import { Input } from './Input.js';
import { Character } from './Character.js';
import { CharacterController } from './CharacterController.js';
import { CameraController } from './CameraController.js';
import { buildTerrainMesh, sampleHeight, AREAS, currentAreaName } from './Terrain.js';
import { buildVegetation } from './Vegetation.js';
import { buildSky, buildDistantMountains, buildMist, buildLeaves, buildFireflies, buildPollen, buildGodRays, buildBirds, updateBirds } from './Atmosphere.js';
import { MOODS } from './Mood.js';
import { GameState } from './GameState.js';
import { Interactables } from './Interactables.js';
import { Wildlife } from './Wildlife.js';
import { Puzzles } from './Puzzles.js';

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
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
    this._standingStones = veg.standingStones || [];
    this.scene.add(this.vegetation);

    this._reportProgress(0.78, 'Weaving the mist');
    await yieldToUI();
    this.mist = buildMist(this.mood);
    this.scene.add(this.mist);
    this.leaves = buildLeaves(this.mood);
    this.scene.add(this.leaves);
    this.fireflies = buildFireflies(this.mood);
    this.scene.add(this.fireflies);
    this.pollen = buildPollen(this.mood);
    this.scene.add(this.pollen);
    this.godRays = buildGodRays(this.mood);
    this.scene.add(this.godRays);
    this.birds = buildBirds(this.mood);
    this.scene.add(this.birds);

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

    // ==== Phase 2 systems ====
    this.gameState = new GameState(this);
    this.interactables = new Interactables(this);
    this.wildlife = new Wildlife(this);
    this.scene.add(this.wildlife.group);
    this.wildlife.addAmbientDeer();
    this.puzzles = new Puzzles(this);
    this.puzzles.setup(this._standingStones);

    // Notify GameApp when things change
    if (this.callbacks.onGameStateChange) {
      const emit = () => this.callbacks.onGameStateChange({
        health: this.gameState.health,
        healthTier: this.gameState.healthTier(),
        seeds: this.gameState.seeds,
        objective: this.gameState.objective,
        prompt: this.gameState.activePromptText,
      });
      this.gameState.on('health', emit);
      this.gameState.on('seeds', emit);
      this.gameState.on('objective', emit);
      this.gameState.on('prompt', emit);
      this.gameState.on('letterbox', ({ on }) => {
        if (this.callbacks.onLetterbox) this.callbacks.onLetterbox(on);
      });
      // Push initial state
      emit();
    }

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
    const cam = sun.shadow.camera;
    cam.left = -25; cam.right = 25; cam.top = 25; cam.bottom = -25;
    cam.near = 0.5; cam.far = 80;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // Rim / fill light: dim directional from the opposite side of the sun,
    // shadowless, so the heroine's silhouette catches a rim highlight and
    // never goes muddy-dark against the forest.
    if (this.mood.fillDirection) {
      const fill = new THREE.DirectionalLight(this.mood.fillColor || 0xffffff, this.mood.fillIntensity || 0.3);
      fill.castShadow = false;
      this.scene.add(fill);
      this.scene.add(fill.target);
      this.fill = fill;
    }

    // Warm point light hinting at the Heart clearing
    const heart = new THREE.PointLight(0xffd8a0, 1.0, 24, 2);
    const a5 = AREAS[4];
    heart.position.set(a5.center[0], sampleHeight(a5.center[0], a5.center[1]) + 8, a5.center[1]);
    this.scene.add(heart);
    this.heartLight = heart;
  }

  // Called each frame by GameState with the lerped mood values.
  applyMood(cur) {
    if (!cur) return;
    // Fog
    if (this.scene.fog) {
      this.scene.fog.color.copy(cur.fogColor);
      this.scene.fog.density = cur.fogDensity;
    }
    // Lights
    if (this.hemi) {
      this.hemi.color.copy(cur.hemiSky);
      this.hemi.groundColor.copy(cur.hemiGround);
      this.hemi.intensity = cur.hemiIntensity;
    }
    if (this.sun) {
      this.sun.color.copy(cur.sunColor);
      this.sun.intensity = cur.sunIntensity;
    }
    // Sky uniforms
    if (this.sky && this.sky.material && this.sky.material.uniforms) {
      const u = this.sky.material.uniforms;
      if (u.uTop) u.uTop.value.copy(cur.skyTop);
      if (u.uHorizon) u.uHorizon.value.copy(cur.skyHorizon);
      if (u.uGround) u.uGround.value.copy(cur.skyGround);
    }
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

    // Phase 2 updates
    if (this.gameState) this.gameState.update(dt);
    if (this.interactables) this.interactables.update(dt);
    if (this.wildlife) this.wildlife.update(dt, this.character.root.position, this.character.velocity);
    if (this.puzzles) this.puzzles.update(dt, now);

    // Debug hotkey F4
    if (this.input && this.input.consumeDumpPress() && this.gameState) this.gameState.dumpDebug();

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
    if (this.fireflies && this.fireflies.userData.material) {
      this.fireflies.userData.material.uniforms.uTime.value = now;
    }
    if (this.pollen && this.pollen.userData.material) {
      const mat = this.pollen.userData.material;
      mat.uniforms.uTime.value = now;
      mat.uniforms.uPlayer.value.copy(this.character.root.position);
    }
    if (this.godRays && this.godRays.userData.material) {
      this.godRays.userData.material.uniforms.uTime.value = now;
    }
    if (this.birds) updateBirds(this.birds, now);

    // Sun shadow frustum follows player
    if (this.sun) {
      const p = this.character.root.position;
      const dir = this.mood.sunDirection;
      this.sun.position.set(p.x + dir.x * 30, p.y + dir.y * 30, p.z + dir.z * 30);
      this.sun.target.position.set(p.x, p.y, p.z);
      this.sun.target.updateMatrixWorld();
    }
    if (this.fill && this.mood.fillDirection) {
      const p = this.character.root.position;
      const d = this.mood.fillDirection;
      this.fill.position.set(p.x + d.x * 20, p.y + d.y * 20, p.z + d.z * 20);
      this.fill.target.position.set(p.x, p.y, p.z);
      this.fill.target.updateMatrixWorld();
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
