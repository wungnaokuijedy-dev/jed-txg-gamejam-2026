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
import { Cinematic } from './Cinematic.js';
import { Weather } from './Weather.js';
import { Endings } from './Endings.js';
import { save as saveGame, load as loadGame, apply as applySave, clearSave, hasSave, recordEndingSeen, endingsSeen } from './Save.js';
import { AudioEngine } from './AudioEngine.js';
import { SettingsStore } from './Settings.js';
import { Tutorial } from './Tutorial.js';
import { DemoDirector } from './DemoDirector.js';

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
      // WebGL unavailable (headless env, blocked GPU, ancient browser…). Notify
      // the shell so its friendly "Something went wrong — Reload" overlay
      // renders. Do NOT re-throw — that stalls the loading bar with an uncaught
      // exception and the overlay never shows. Constructor exits cleanly here;
      // `load()` and `start()` are guarded to no-op below.
      this._initFailed = true;
      if (this.callbacks.onError) {
        try { this.callbacks.onError(e); } catch (_) { /* shell must not break init */ }
      }
      return;
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
    // If init failed (WebGL unavailable), no world to build — the shell has
    // already been shown the error via onError; leave loading pending here so
    // it resolves without touching the missing renderer.
    if (this._initFailed) return;
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

    // ==== Phase 3 systems (created BEFORE Puzzles.setup so puzzles can hook them) ====
    this.cinematic = new Cinematic(this);
    this.weather = new Weather(this);
    this.scene.add(this.weather.points);
    this.endings = new Endings(this);

    // ==== Phase 4 systems ====
    this.audio = new AudioEngine();
    // NOTE: AudioContext is only created on the first user gesture; init() is
    // deferred until GameApp calls game.initAudio() from a click handler.
    this.settings = new SettingsStore(this);

    // Tutorial (Phase 6b): action-driven hints for new runs only.
    this.tutorial = new Tutorial(this);
    this._mapOpenedSinceTutorial = false;

    // Demo mode (hidden showcase for the 2-min video). Additive: never
    // touches the player's real save, endings-seen record, or settings.
    this._demoMode = false;
    this.demo = new DemoDirector(this);

    this.puzzles = new Puzzles(this);
    this.puzzles.setup(this._standingStones);

    // Apply persisted settings once camCtrl exists (some values need the camera)
    this.settings.applyAll();

    // Autosave book-keeping
    this._autosaveTimer = 0;
    this._hasSaveOnBoot = hasSave();

    // Menu mode: game runs but is not player-driven; used behind the main menu.
    this._menuMode = true;
    this._menuT = 0;
    this._menuAnchor = new THREE.Vector3(0, 3, 30);

    // Pause state
    this._paused = false;

    // FPS auto-degrade watcher
    this._lowFpsAccum = 0;
    this._degraded = false;

    // Ambience: react to area / weather / stream / health
    this._prevAreaName = null;
    if (this.gameState) {
      this.gameState.on('flag', ({ key, value }) => {
        if (key === 'restore_done' && value) {
          this.audio && this.audio.setStreamFlowing(true);
        }
        if (key === 'stones_awoken' && value) {
          this.audio && this.audio.setMusicMode('grove');
        }
      });
      this.gameState.on('health', ({ health }) => {
        this.audio && this.audio.setHealthNorm(health / 100);
      });
      this.gameState.on('choice_resolved', ({ kind }) => {
        this.audio && this.audio.setMusicMode('ending_' + kind);
      });
    }

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
      // Phase 3 event forwards
      this.gameState.on('subtitle', ({ text, duration }) => {
        if (this.callbacks.onSubtitle) this.callbacks.onSubtitle({ text, duration });
      });
      this.gameState.on('hud_hide', ({ on }) => {
        this.gameState.hudHidden = !!on;
        if (this.callbacks.onHudHide) this.callbacks.onHudHide(!!on);
      });
      this.gameState.on('choice_open', () => {
        if (this.callbacks.onChoiceOpen) this.callbacks.onChoiceOpen();
      });
      this.gameState.on('choice_close', () => {
        if (this.callbacks.onChoiceClose) this.callbacks.onChoiceClose();
      });
      this.gameState.on('ending', (payload) => {
        if (this.callbacks.onEnding) this.callbacks.onEnding(payload);
      });
      this.gameState.on('silence_mood', ({ on }) => {
        if (this.callbacks.onSilenceMood) this.callbacks.onSilenceMood(!!on);
      });
      this.gameState.on('tutorial_hint', (payload) => {
        if (this.callbacks.onTutorialHint) this.callbacks.onTutorialHint(payload);
      });
      this.gameState.on('minimap_pulse', () => {
        if (this.callbacks.onMinimapPulse) this.callbacks.onMinimapPulse();
      });
      this.gameState.on('demo_state', (payload) => {
        if (this.callbacks.onDemoState) this.callbacks.onDemoState(payload);
      });
      // Autosave on major story beats
      this.gameState.on('flag', () => this.saveNow());
      this.gameState.on('seeds', () => this.saveNow());
      // Push initial state
      emit();
    }

    // Notify shell about save presence so it can offer Continue.
    if (this.callbacks.onSaveState) this.callbacks.onSaveState({ hasSave: this._hasSaveOnBoot, endingsSeen: endingsSeen() });

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
    // Tighter bias reduces acne / peter-panning on the heroine's feet, and a
    // small shadow.radius softens the PCF edge for a filmic look.
    sun.shadow.bias = -0.00028;
    sun.shadow.normalBias = 0.028;
    sun.shadow.radius = 4;
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
    if (this._initFailed) return;
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

  // ================================================================
  // Phase 3/4 public API
  // ================================================================

  // Called from the first user gesture in the UI. Also enables audio.
  initAudio() {
    if (this.audio && !this.audio.isInitialized()) {
      this.audio.init();
      // Push current settings and area
      if (this.settings) this.settings.applyAll();
      if (this._prevAreaName) this.audio.setArea(this._prevAreaName);
      else this.audio.setArea('The Entrance');
      this.audio.setMusicMode('exploration');
      if (this.gameState) this.audio.setHealthNorm(this.gameState.health / 100);
      if (this.weather) this.audio.setWeather(this.weather.getStage());
    }
  }

  // Menu-mode helpers
  enterMenuMode() {
    this._menuMode = true;
    this._menuT = 0;
    // Face the character toward camera-ish
    if (this.character) this.character.facingY = Math.PI * 0.15;
  }
  exitMenuMode() {
    this._menuMode = false;
    if (this.camCtrl && this.character) {
      // Snap smoothed camera state to current so the transition is not jerky
      this.camCtrl._smoothedTarget.copy(this.character.root.position).y += 1.55;
      this.camCtrl._smoothedPos.copy(this.camera.position);
      this.camCtrl.currentDistance = this.camera.position.distanceTo(this.camCtrl._smoothedTarget);
    }
    this._prevAreaName = null;
  }

  // Pause / resume
  pause() {
    if (this._paused) return;
    this._paused = true;
    if (this.audio) this.audio.suspend();
    // Tutorial defers itself while paused. The main loop's paused-branch
    // early-returns before Tutorial.update runs, so drive the deferral here.
    if (this.tutorial) this.tutorial.setDeferred(true);
    if (this.callbacks.onPauseChange) this.callbacks.onPauseChange(true);
  }
  resume() {
    if (!this._paused) return;
    this._paused = false;
    this._lastT = performance.now();   // avoid dt spike
    if (this.audio) this.audio.resume();
    if (this.tutorial) this.tutorial.setDeferred(false);
    if (this.callbacks.onPauseChange) this.callbacks.onPauseChange(false);
  }
  isPaused() { return this._paused; }

  // ============================================================
  // Demo Mode (hidden, additive, isolated)
  // ============================================================
  // Enter demo mode. Isolates all persistence: no autosave, no clearSave on
  // newGame(), no recordEndingSeen() at ending. Resets in-memory GameState so
  // the demo run starts clean regardless of what the player has done.
  startDemo() {
    this._demoMode = true;
    // In-memory reset — never touches localStorage. Mirrors the fields set
    // by GameState's constructor so any leftover state from menu-mode or a
    // prior partial run doesn't leak into the demo.
    const gs = this.gameState;
    if (gs) {
      gs.health = 50;
      gs.seeds = 0;
      gs.puzzleFlags = {
        grow_done: false,
        restore_done: false,
        bird_freed: false,
        stones_awoken: false,
        heart_reached: false,
      };
      if (gs.doneInteractions && gs.doneInteractions.clear) gs.doneInteractions.clear();
      if (gs.visitedAreas && gs.visitedAreas.clear) gs.visitedAreas.clear();
      gs.objective = 'The forest is waiting…';
      gs.choiceMade = null;
      gs.endingKind = null;
      gs.endingResolved = false;
      gs.hudHidden = false;
      // Broadcast so HUD reflects the reset immediately.
      gs.emit('objective', { text: gs.objective });
      gs.emit('health', { health: gs.health, delta: 0 });
      gs.emit('seeds', { seeds: gs.seeds });
    }
    // Reset puzzle visuals to their un-solved state.
    if (this.puzzles && typeof this.puzzles.applySavedState === 'function') {
      this.puzzles.applySavedState();
    }
    // Ensure tutorial hasn't been marked done by a prior session in memory.
    if (this.tutorial) {
      this.tutorial._done = false;
      this.tutorial.active = false;
    }
    // Weather baseline.
    if (this.weather) this.weather.setStage('clear');
    // Kick off — GameApp is responsible for playing the opening cinematic;
    // the director's first beat waits for the cinematic to end.
    this.demo.start();
  }

  // Exit demo mode. Called from Esc → "Exit Demo".
  stopDemo() {
    if (this.demo) this.demo.stop();
    this._demoMode = false;
    // Force-end any active cinematic / restore weather baseline so the menu
    // background reads normally.
    if (this.cinematic && this.cinematic.isActive()) this.cinematic.stop();
    if (this.weather) this.weather.setStage('clear');
    if (this.gameState) this.gameState.hudHidden = false;
  }

  isDemoMode() { return !!this._demoMode; }

  // Respawn player at Area 1 spawn keeping state intact.
  restartArea() {
    if (!this.character) return;
    const spawnX = 0, spawnZ = 22;
    this.character.root.position.set(spawnX, sampleHeight(spawnX, spawnZ), spawnZ);
    this.character.facingY = Math.PI;
    this.character.model.rotation.y = Math.PI;
    this.character.velocity.set(0, 0, 0);
    if (this.camCtrl) {
      this.camCtrl._smoothedTarget.copy(this.character.root.position).y += 1.55;
      this.camCtrl._smoothedPos.copy(this.character.root.position).y += 1.55;
      this.camCtrl._smoothedPos.z += 6;
      this.camCtrl.currentDistance = 5.5;
      this.camCtrl.yaw = Math.PI;
      this.camCtrl.pitch = -0.18;
    }
  }

  // Quality preset: apply pixel ratio + shadow map + particle scale.
  applyQuality(preset) {
    if (!this.renderer) return;
    let pixelRatio = 1.5, shadow = 1024, particleScale = 1.0, shadows = true;
    if (preset === 'low')    { pixelRatio = 1.0; shadow = 0;    particleScale = 0.35; shadows = false; }
    if (preset === 'medium') { pixelRatio = 1.25; shadow = 512;  particleScale = 0.7;  shadows = true; }
    if (preset === 'high')   { pixelRatio = 1.5; shadow = 1024; particleScale = 1.0;  shadows = true; }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
    this.renderer.shadowMap.enabled = shadows;
    if (this.sun) {
      this.sun.castShadow = shadows;
      if (shadows) {
        this.sun.shadow.mapSize.width = shadow;
        this.sun.shadow.mapSize.height = shadow;
      }
    }
    // Particle draw counts — scale visible portion. We adjust point cloud draw range
    // by messing with geometry drawRange (cheap, non-destructive).
    const scaleDrawRange = (pts) => {
      if (!pts || !pts.geometry) return;
      const total = pts.geometry.attributes && pts.geometry.attributes.position
        ? pts.geometry.attributes.position.count
        : 0;
      if (!pts.geometry.userData._origCount) pts.geometry.userData._origCount = total;
      const orig = pts.geometry.userData._origCount;
      pts.geometry.setDrawRange(0, Math.max(0, Math.floor(orig * particleScale)));
    };
    scaleDrawRange(this.leaves);
    scaleDrawRange(this.fireflies);
    scaleDrawRange(this.pollen);
    if (this.weather && this.weather.points) scaleDrawRange(this.weather.points);
    // Grass / bush instance density — visible count via InstancedMesh.count.
    if (this.vegetation && this.vegetation.children) {
      for (const c of this.vegetation.children) {
        if (c.isInstancedMesh) {
          if (!c.userData._origCount) c.userData._origCount = c.count;
          const orig = c.userData._origCount;
          // Grass and bush get scaled; trees/rocks stay stable so the world doesn't visibly pop.
          const nm = (c.name || '').toLowerCase();
          if (nm.includes('grass') || nm.includes('bush') || nm.includes('flower') || nm.includes('fern')) {
            c.count = Math.max(1, Math.floor(orig * particleScale));
          }
        }
      }
    }
  }

  hasSave() { return hasSave(); }
  endingsSeen() { return endingsSeen(); }

  // Plays the opening cinematic. Skippable immediately.
  playOpening() {
    if (!this.cinematic) return;
    if (this._openingPlayed) return;
    this._openingPlayed = true;
    const cfg = Cinematic.opening(this);
    const origEnd = cfg.onEnd;
    cfg.onEnd = () => {
      if (origEnd) try { origEnd(); } catch (_) {}
      // Kick off the interactive tutorial (only for New Game runs — Continue
      // skips it because the save already carries `tutorial_done: true` for
      // any prior playthrough).
      if (this.tutorial) this.tutorial.start();
    };
    this.cinematic.play(cfg);
  }

  hasSave() { return hasSave(); }

  // Load persisted state (called before start() if user picks Continue).
  applyLoadedSave() {
    const data = loadGame();
    if (!data) return false;
    const ok = applySave(data, this.gameState, this.character, this.weather);
    if (ok && this.puzzles) this.puzzles.applySavedState();
    // Continue skips the opening cinematic (and therefore Tutorial.start()),
    // so sync the tutorial's internal _done from the loaded puzzleFlags.
    if (ok && this.tutorial) this.tutorial.syncFromSave();
    return ok;
  }

  // Wipe any existing save. Called on New Game — but NOT in demo mode
  // (demo runs on isolated in-memory state and must never touch the
  // player's real save).
  newGame() {
    if (this._demoMode) {
      this._hasSaveOnBoot = false;
      return;
    }
    clearSave();
    this._hasSaveOnBoot = false;
  }

  _doAutosave() {
    if (this._demoMode) return;             // demo never writes to disk
    if (!this.gameState || !this.character) return;
    try {
      const ok = saveGame(this.gameState, this.character, this.weather ? this.weather.getStage() : 'clear');
      if (ok) {
        if (this.audio) this.audio.play('autosave');
        if (this.callbacks.onAutosave) this.callbacks.onAutosave();
      }
    } catch (_) { /* ignore */ }
  }

  // Force an immediate save at a story beat (called from event listeners).
  saveNow() {
    if (this._demoMode) return;             // demo never writes to disk
    const cineActive = !!(this.cinematic && this.cinematic.isActive());
    if (cineActive) return;
    if (this.gameState && this.gameState.endingResolved) return;
    this._doAutosave();
  }

  // Kicks off the final-choice sequence. Called from the Heartseed interact.
  startFinalChoiceSequence() {
    if (!this.cinematic || !this._heartseedPosVec()) return;
    if (this.gameState.choiceMade) return;
    const cfg = Cinematic.heartChoiceArc(this, this._heartseedPosVec());
    // At ~1.5s during the arc, fade in the choice UI (letterbox already active).
    // Also release pointer lock so the player can click the choice buttons.
    cfg.triggers = [
      {
        t: 1.5, fn: () => {
          this.gameState.emit('choice_open', {});
          if (this.audio) {
            this.audio.play('choice_appear');
            this.audio.setMusicMode('choice');
          }
          try { document.exitPointerLock(); } catch (_) {}
        },
      },
    ];
    this.cinematic.play(cfg);
  }

  _heartseedPosVec() {
    if (!this.puzzles || !this.puzzles._heartseedPos) return null;
    return this.puzzles._heartseedPos;
  }

  // Called by the choice UI when the player picks an option.
  resolveFinalChoice(choice) {
    if (!this.gameState || this.gameState.choiceMade) return;
    // If the arc cinematic is still running, force-end it so we can chain.
    if (this.cinematic && this.cinematic.isActive()) {
      this.cinematic.stop();
    }
    const kind = this.gameState.resolveEnding(choice);
    // Close the choice UI (keeps letterbox because the ending cinematic uses it too)
    this.gameState.emit('choice_close', {});

    // Visual response: if they Took the seed, remove the seed geometry.
    if (this.puzzles && this.puzzles.heartseed) {
      if (choice === 'take') {
        try { this.puzzles.heartseed.userData.remove && this.puzzles.heartseed.userData.remove(); } catch (_) {}
      }
    }

    // Trigger ending-specific scene effects
    if (this.endings) {
      if (kind === 'guardian') this.endings.playGuardian();
      else if (kind === 'balance') this.endings.playBalance();
      else this.endings.playSilence();
    }

    // Play ending cinematic; on end, reveal end card + persist ending record.
    const heartseedPos = this._heartseedPosVec() || new THREE.Vector3(AREAS[4].center[0], 0, AREAS[4].center[1]);
    const cfg = Cinematic.ending(this, heartseedPos, kind);
    cfg.onEnd = () => {
      const message = this.endings ? this.endings.endingMessage(kind) : '';
      this.gameState.emit('ending', { kind, message, choice });
      // Persist ending record + clear save so a fresh New Game starts clean —
      // but NEVER in demo mode (isolated from the player's real record).
      if (!this._demoMode) {
        try { recordEndingSeen(kind); } catch (_) {}
        try { clearSave(); } catch (_) {}
        this._hasSaveOnBoot = false;
      }
    };
    this.cinematic.play(cfg);
  }

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

    // Paused: keep rendering the last frame; do not advance time.
    if (this._paused) {
      this._lastT = nowMs;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const now = nowMs / 1000;
    const last = this._lastT / 1000;
    let dt = now - last;
    // Clamp dt to avoid huge steps after tab background
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    this._lastT = nowMs;

    // Cinematic + weather + endings run every frame
    const cineActive = !!(this.cinematic && this.cinematic.isActive());
    if (this.cinematic) this.cinematic.update(dt);
    if (this.weather && this.character) {
      this.weather.update(dt, now, this.character.root.position);
    }
    if (this.endings) this.endings.update(dt, now);
    if (this.audio) this.audio.update(dt);

    // MENU MODE — game runs, but player is not driving. Camera drifts slowly
    // around the spawn area to make the main menu feel alive.
    if (this._menuMode && !cineActive) {
      this._menuT += dt;
      const r = 18;
      const yaw = this._menuT * 0.06;
      this.camera.position.set(
        this._menuAnchor.x + Math.cos(yaw) * r,
        this._menuAnchor.y + 2 + Math.sin(this._menuT * 0.4) * 0.3,
        this._menuAnchor.z + Math.sin(yaw) * r,
      );
      this.camera.lookAt(this.character.root.position.x, this.character.root.position.y + 1.4, this.character.root.position.z);
      // Keep character idle-animating
      if (this.character) {
        this.character.velocity.set(0, 0, 0);
        const p = this.character.root.position;
        p.y = sampleHeight(p.x, p.z);
        this.character.updateAnimation(dt, 0, true, this.character.facingY);
      }
    } else if (cineActive) {
      if (this.character) {
        this.character.velocity.set(0, 0, 0);
        // Keep the character grounded and idle-animated so they don't freeze mid-stride.
        const p = this.character.root.position;
        p.y = sampleHeight(p.x, p.z);
        this.character.updateAnimation(dt, 0, true, this.character.facingY);
      }
      if (this.input && this.input.consumeInteractPress()) {
        this.cinematic.requestSkip();
      }
      // Clear any lingering interaction prompt from HUD
      if (this.gameState) this.gameState.setActivePrompt('', null);
    } else {
      // Update character + camera regardless of pointer lock so gravity keeps working;
      // Input is naturally zero without lock (movement possible without lock too — that's fine).
      if (this.charCtrl) this.charCtrl.update(dt);
      if (this.camCtrl) this.camCtrl.update(dt);

      // Stuck-player safety: if the character somehow leaves the terrain footprint
      // (falls under, or wanders past the invisible bounds) respawn softly at Area 1.
      if (this.character) {
        const p = this.character.root.position;
        const outOfBounds = (p.x < -80 || p.x > 80 || p.z < -95 || p.z > 55);
        const belowTerrain = p.y < sampleHeight(p.x, p.z) - 6;
        if (outOfBounds || belowTerrain) {
          this.restartArea();
        }
      }

      // Footstep audio (only when in normal gameplay)
      if (this.audio && this.charCtrl) {
        this.audio.updateFootsteps(this.character, this.input.isSprint(), this.charCtrl.grounded, dt);
        // Landing thump on ground-touch transition
        if (this.charCtrl.grounded && !this.charCtrl.wasGrounded) {
          this.audio.playLanding();
        }
      }
    }

    // Phase 2 updates (skip interactables while a cinematic is playing or in menu mode)
    if (this.gameState) this.gameState.update(dt);
    if (this.interactables && !cineActive && !this._menuMode) this.interactables.update(dt);
    if (this.wildlife) this.wildlife.update(dt, this.character.root.position, this.character.velocity);
    if (this.puzzles) this.puzzles.update(dt, now);
    if (this.tutorial) this.tutorial.update(dt);
    if (this.demo && this.demo.active) this.demo.update(dt);

    // Area change → visit + ambience crossfade
    if (!this._menuMode && this.character) {
      const p = this.character.root.position;
      const areaName = currentAreaName(p.x, p.z);
      if (areaName && areaName !== this._prevAreaName) {
        this._prevAreaName = areaName;
        if (this.audio) this.audio.setArea(areaName);
        if (this.gameState) this.gameState.recordAreaVisit(areaName);
        // Grove mystery music shift
        if (this.audio) {
          if (/Ancient Grove/.test(areaName)) this.audio.setMusicMode('grove');
          else if (!/Ancient Grove|Heart/.test(areaName) && this.audio._musicMode === 'grove') this.audio.setMusicMode('exploration');
        }
      }
    }

    // Autosave — every 30 seconds. Skip during cinematic/choice/ending/menu.
    this._autosaveTimer += dt;
    if (this._autosaveTimer >= 30) {
      this._autosaveTimer = 0;
      const canSave = !cineActive
        && !this._menuMode
        && !(this.endings && this.endings.active)
        && this.gameState
        && !this.gameState.endingResolved;
      if (canSave) this._doAutosave();
    }

    // Debug hotkey F4
    if (this.input && this.input.consumeDumpPress() && this.gameState) this.gameState.dumpDebug();

    // Sway uniforms
    if (this.swayMaterials) {
      const px = this.character ? this.character.root.position.x : 0;
      const py = this.character ? this.character.root.position.y : 0;
      const pz = this.character ? this.character.root.position.z : 0;
      for (const m of this.swayMaterials) {
        if (m.userData && m.userData.shader) {
          m.userData.shader.uniforms.uTime.value = now;
          // Push player position only into materials that use it (interactive grass)
          if (m.userData.interactive && m.userData.shader.uniforms.uPlayerPos) {
            m.userData.shader.uniforms.uPlayerPos.value.set(px, py, pz);
          }
        }
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
      // FPS auto-degrade (only when not paused, not in menu). Uses this window's fps.
      if (!this._menuMode && !this._paused) {
        if (fps < 30) this._lowFpsAccum += 0.5;
        else this._lowFpsAccum = Math.max(0, this._lowFpsAccum - 0.25);
        if (!this._degraded && this._lowFpsAccum >= 5 && this.settings && this.settings.get('quality') !== 'low') {
          this._degraded = true;
          const cur = this.settings.get('quality');
          const next = cur === 'high' ? 'medium' : 'low';
          this.settings.set({ quality: next });
          if (this.callbacks.onDegrade) this.callbacks.onDegrade({ preset: next });
        }
      }
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
