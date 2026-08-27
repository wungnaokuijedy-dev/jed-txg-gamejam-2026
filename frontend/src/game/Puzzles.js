// Puzzle setup + orchestration for Phase 2.
// Wires seeds, withered plants (grow puzzle), spring debris (restore puzzle),
// tangled bird, stone circle, guide, Heart gate, fawn, and the temptation set.

import * as THREE from 'three';
import {
  WitheredPlant, VineGrowth, StreamWater, buildDebrisPile,
  RootBridge, StoneGlow, HeartGate,
  buildGlowingFlowerCluster, buildMushroomRing,
  buildSeedPickup, buildTangledBird,
} from './Effects.js';
import { AREAS, sampleHeight } from './Terrain.js';

export class Puzzles {
  constructor(game) {
    this.game = game;
    this.effects = [];       // things needing per-frame update()
    this._pickups = [];      // seed pickup meshes with .animate(dt, t)
    this.streamWater = null;
    this.stoneGlow = null;
    this.rootBridge = null;
    this.heartGate = null;
    this.vineGrowth = null;
  }

  setup(standingStones) {
    const g = this.game;
    const scene = g.scene;
    const inter = g.interactables;
    const gs = g.gameState;
    const wildlife = g.wildlife;

    // ==============================================================
    // SEEDS  (3 total) + butterflies on the first two as FOLLOW hints
    // ==============================================================
    const seedSpecs = [
      { id: 'seed_1', pos: new THREE.Vector3(6, 0, 15) },
      { id: 'seed_2', pos: new THREE.Vector3(-16, 0, 6) },
      { id: 'seed_3', pos: new THREE.Vector3(-26, 0, -12) },
    ];
    for (const spec of seedSpecs) {
      const pickup = buildSeedPickup(spec.pos);
      scene.add(pickup);
      this._pickups.push(pickup);
      // Butterflies hovering near
      wildlife.addButterfliesNear(pickup.position.clone().add(new THREE.Vector3(0, 0.7, 0)));
      inter.register({
        id: spec.id,
        position: pickup.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
        radius: 2.2,
        verb: 'Take the seed',
        oneShot: true,
        isAvailable: () => !gs.isDone(spec.id),
        onInteract: async () => {
          gs.markDone(spec.id);
          gs.addSeed();
          scene.remove(pickup);
          // Remove nearby butterflies (any within 3m)
          const bfs = [...wildlife.butterflies];
          for (const b of bfs) {
            if (b.userData && b.userData.target && b.userData.target.distanceTo(pickup.position) < 3) {
              wildlife.removeButterflies(b);
            }
          }
          if (gs.seeds === 1) {
            gs.setObjective('Something is wrong with the old plant.');
          }
        },
      });
    }

    // ==============================================================
    // WITHERED PLANTS  (Grow puzzle — 1 required + 2 optional)
    // ==============================================================
    // Required plant is at the base of the fallen log at (-44, -6) which blocks
    // westward passage in Area 2. Planting a seed here grows a vine bridge.
    const plantSpecs = [
      { id: 'plant_bridge', pos: new THREE.Vector3(-42, 0, -4), isBridge: true },
      { id: 'plant_a',      pos: new THREE.Vector3(-8,  0,  4), isBridge: false },
      { id: 'plant_b',      pos: new THREE.Vector3(18,  0, -10), isBridge: false },
    ];
    for (const p of plantSpecs) {
      const plant = new WitheredPlant(p.pos);
      scene.add(plant.group);

      inter.register({
        id: p.id,
        position: p.pos.clone().add(new THREE.Vector3(0, 0.3, 0)),
        radius: 2.4,
        verb: 'Plant the seed',
        oneShot: true,
        isAvailable: () => gs.seeds > 0 && !gs.isDone(p.id),
        onInteract: async () => {
          if (!gs.useSeed()) return;
          gs.markDone(p.id);
          plant.bloom();
          gs.addHealth(p.isBridge ? 5 : 5, 'restore_plant');

          if (p.isBridge) {
            // Grow the vine bridge over the log (at approx -44, -6)
            const logStart = new THREE.Vector3(-44 - 1.5, 0, -6);
            const logEnd   = new THREE.Vector3(-44 + 1.5, 0, -6);
            this.vineGrowth = new VineGrowth(logStart, logEnd, { duration: 4.0 });
            scene.add(this.vineGrowth.group);
            this.effects.push(this.vineGrowth);
            // Remove log collision so player can pass (approximate: shrink obstacle radii)
            const obs = g.obstacles;
            for (let i = obs.length - 1; i >= 0; i--) {
              const o = obs[i];
              if (Math.abs(o.x - (-44)) < 2 && Math.abs(o.z - (-6)) < 2 && o.r > 0.4 && o.r < 0.7) {
                // matches fallen log stub — shrink so climbing is possible
                obs[i].r = 0.1;
              }
            }
            gs.setFlag('grow_done', true);
            gs.setObjective('The stream is silent — the water must return.');
          }
        },
      });
    }

    // ==============================================================
    // RESTORE puzzle — spring debris (Area 3, uphill end of stream)
    // ==============================================================
    const springPos = new THREE.Vector3(48, 0, -14);
    const debris = buildDebrisPile(springPos);
    scene.add(debris);
    inter.register({
      id: 'clear_spring',
      position: springPos.clone().add(new THREE.Vector3(0, 0.5, 0)),
      radius: 3.0,
      verb: 'Clear the spring',
      oneShot: true,
      isAvailable: () => !gs.isDone('clear_spring'),
      onInteract: async () => {
        gs.markDone('clear_spring');
        // Animate debris pile crumbling — scale down over 1s
        const start = performance.now();
        const dur = 1000;
        const step = () => {
          const t = Math.min(1, (performance.now() - start) / dur);
          debris.scale.setScalar(Math.max(0.001, 1 - t));
          if (t < 1) requestAnimationFrame(step);
          else { scene.remove(debris); }
        };
        step();
        // Start water flow
        if (this.streamWater) this.streamWater.start();
        // Root bridge lifts
        if (this.rootBridge) this.rootBridge.activate();
        gs.addHealth(10, 'restore_stream');
        gs.setFlag('restore_done', true);
        gs.setObjective('Something calls from the standing stones.');
      },
    });

    // Stream water (initially hidden)
    this.streamWater = new StreamWater(g.mood);
    scene.add(this.streamWater.mesh);

    // Root bridge downstream of the debris — a mechanism activated by water flow
    // Positioned east side to make the path Area 3 → Area 4 more obvious.
    this.rootBridge = new RootBridge(new THREE.Vector3(22, 0, -22), g.mood);
    scene.add(this.rootBridge.group);
    this.effects.push(this.rootBridge);

    // ==============================================================
    // Tangled bird (Area 3 — small wildlife rescue)
    // ==============================================================
    const bird = buildTangledBird(new THREE.Vector3(10, 0, -22));
    scene.add(bird);
    inter.register({
      id: 'free_bird',
      position: bird.position.clone(),
      radius: 2.2,
      verb: 'Free the bird',
      oneShot: true,
      isAvailable: () => !gs.isDone('free_bird'),
      onInteract: async () => {
        gs.markDone('free_bird');
        bird.freeBird();
        gs.setFlag('bird_freed', true);
        gs.addHealth(10, 'free_bird');
        // Set fly-away target toward Ancient Grove
        bird.userData.flyTarget = new THREE.Vector3(AREAS[3].center[0], 12, AREAS[3].center[1]);
        // Register the bird in effects for animation
        this.effects.push({
          update: (dt) => {
            if (!bird.userData.vinesRemoved) return;
            bird.userData.flyT = (bird.userData.flyT ?? 0) + dt;
            const t = Math.min(1, bird.userData.flyT / 6);
            const target = bird.userData.flyTarget;
            bird.position.lerp(target, dt * 0.4);
            bird.rotation.y = Math.atan2(target.x - bird.position.x, target.z - bird.position.z);
            if (t >= 1) { scene.remove(bird); }
          },
        });
      },
    });

    // ==============================================================
    // FOLLOW puzzle — Ancient Grove stones (Area 4)
    // ==============================================================
    if (standingStones && standingStones.length) {
      this.stoneGlow = new StoneGlow(standingStones);
      this.effects.push(this.stoneGlow);
    }
    inter.register({
      id: 'awaken_stones',
      position: new THREE.Vector3(AREAS[3].center[0], 1, AREAS[3].center[1]),
      radius: 4.0,
      verb: 'Touch the stones',
      oneShot: true,
      isAvailable: () => !gs.isDone('awaken_stones') && gs.puzzleFlags.restore_done,
      onInteract: async () => {
        gs.markDone('awaken_stones');
        if (this.stoneGlow) this.stoneGlow.activate();
        gs.setFlag('stones_awoken', true);
        // Guide appears — deer if healthy enough, else firefly trail
        const route = [
          [AREAS[3].center[0], AREAS[3].center[1]],
          [10, -50],
          [0, -58],
          [AREAS[4].center[0] + 0.5, AREAS[4].center[1] + 6],
        ];
        if (gs.health >= 60) {
          wildlife.startDeerGuide(route);
          gs.setObjective('The deer looks back. Follow.');
        } else {
          const from = new THREE.Vector3(AREAS[3].center[0], 1, AREAS[3].center[1]);
          const to   = new THREE.Vector3(AREAS[4].center[0], 1, AREAS[4].center[1] + 4);
          wildlife.startFireflyTrail(from, to, 14);
          gs.setObjective('The fireflies are gathering… follow them.');
        }
      },
    });

    // ==============================================================
    // Heart of the Forest gate (Area 5)
    // ==============================================================
    const gatePos = new THREE.Vector3(AREAS[4].center[0], 0, AREAS[4].center[1] + 8);
    this.heartGate = new HeartGate(gatePos, g.mood);
    scene.add(this.heartGate.group);
    this.effects.push(this.heartGate);
    // Zone trigger — auto-open when player arrives with stones awoken.
    // Registered as an interactable but with a fake verb + auto-trigger on proximity.
    this._gateTriggerPos = gatePos;
    this._gateOpened = false;

    // Fawn placed at heart tree center
    wildlife.addFawnAtHeart(new THREE.Vector3(AREAS[4].center[0] + 3, 0, AREAS[4].center[1] - 2));

    // ==============================================================
    // TEMPTATION SET
    // ==============================================================
    const glowingFlowers = buildGlowingFlowerCluster(new THREE.Vector3(-28, 0, -18));
    scene.add(glowingFlowers);
    inter.register({
      id: 'take_glowing',
      position: glowingFlowers.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
      radius: 2.4,
      verb: 'Pick the glowing flowers',
      oneShot: true,
      isAvailable: () => !gs.isDone('take_glowing'),
      onInteract: async () => {
        gs.markDone('take_glowing');
        glowingFlowers.wither();
        gs.addHealth(-10, 'take_glowing');
      },
    });

    const mushroomRing = buildMushroomRing(new THREE.Vector3(12, 0, -30));
    scene.add(mushroomRing);
    inter.register({
      id: 'take_mushrooms',
      position: mushroomRing.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
      radius: 2.4,
      verb: 'Harvest',
      oneShot: true,
      isAvailable: () => !gs.isDone('take_mushrooms'),
      onInteract: async () => {
        gs.markDone('take_mushrooms');
        mushroomRing.wither();
        gs.addHealth(-10, 'take_mushrooms');
      },
    });

    // Initial objective
    gs.setObjective('The fireflies are gathering…');
  }

  update(dt, tNow) {
    for (let i = 0; i < this._pickups.length; i++) {
      const p = this._pickups[i];
      if (p.parent) p.userData.animate(dt, tNow);
    }
    for (const e of this.effects) e.update(dt, tNow);
    if (this.streamWater && this.streamWater.mesh.visible) {
      this.streamWater.update(dt, tNow);
    }

    // Auto-open Heart gate when player is within 6m + stones awoken.
    if (!this._gateOpened && this.heartGate && this.game.character) {
      const gs = this.game.gameState;
      const cp = this.game.character.root.position;
      const dx = cp.x - this._gateTriggerPos.x;
      const dz = cp.z - this._gateTriggerPos.z;
      if (gs.puzzleFlags.stones_awoken && (dx * dx + dz * dz) < 36) {
        this.heartGate.open();
        this._gateOpened = true;
        gs.setObjective('…');
        // Slight letterbox effect via GameState event
        gs.emit('letterbox', { on: true });
        setTimeout(() => gs.emit('letterbox', { on: false }), 3500);
        // Reaching Heart flag when past gate (approximate)
        setTimeout(() => gs.setFlag('heart_reached', true), 1500);
      }
    }
  }
}
