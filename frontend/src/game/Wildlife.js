// Small state-based wildlife: deer, butterflies, firefly trail.
// No pathfinding — spline / waypoint drift + reactive states.

import * as THREE from 'three';
import { sampleHeight } from './Terrain.js';

// ==============================================================
// DEER — low-poly quadruped, wander/alert/flee/guide states
// ==============================================================
const DEER_BODY  = 0xa07a52;
const DEER_UNDER = 0xd6b48c;
const DEER_LEG   = 0x6b4c2f;
const DEER_HORN  = 0x3a2a1c;

function buildDeer(scale = 1) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: DEER_BODY, roughness: 0.85, flatShading: false });
  const underMat = new THREE.MeshStandardMaterial({ color: DEER_UNDER, roughness: 0.9, flatShading: false });
  const legMat = new THREE.MeshStandardMaterial({ color: DEER_LEG, roughness: 0.9, flatShading: true });
  const hornMat = new THREE.MeshStandardMaterial({ color: DEER_HORN, roughness: 0.95, flatShading: true });

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), bodyMat);
  body.scale.set(1.4, 0.85, 0.75);
  body.position.set(0, 0.7, 0);
  body.castShadow = true;
  g.add(body);
  // Underbelly (lighter)
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), underMat);
  under.scale.set(1.3, 0.55, 0.7);
  under.position.set(0, 0.6, 0);
  g.add(under);

  // Neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.32, 8), bodyMat);
  neck.rotation.z = -0.5;
  neck.position.set(0.4, 0.85, 0);
  neck.castShadow = true;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), bodyMat);
  head.scale.set(1.6, 0.85, 0.85);
  head.position.set(0.6, 1.0, 0);
  head.castShadow = true;
  g.add(head);

  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.09), bodyMat);
  snout.position.set(0.76, 0.95, 0);
  g.add(snout);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.11, 6), bodyMat);
    ear.rotation.x = 0.3 * side;
    ear.position.set(0.55, 1.13, 0.09 * side);
    g.add(ear);
  }

  // Small antlers (only "adult" deer)
  for (const side of [-1, 1]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.24, 6), hornMat);
    ant.rotation.x = -0.35 * side;
    ant.rotation.z = -0.35;
    ant.position.set(0.5, 1.18, 0.06 * side);
    g.add(ant);
  }

  // Legs
  const legs = [];
  for (const [dx, dz] of [[0.28, 0.18], [0.28, -0.18], [-0.28, 0.18], [-0.28, -0.18]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.6, 6), legMat);
    leg.position.set(dx, 0.3, dz);
    leg.castShadow = true;
    g.add(leg);
    legs.push(leg);
  }

  // Tail
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), underMat);
  tail.position.set(-0.48, 0.78, 0);
  g.add(tail);

  g.userData.legs = legs;
  g.scale.setScalar(scale);
  return g;
}

// Small fawn: smaller deer, no antlers.
function buildFawn() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb08a5e, roughness: 0.85, flatShading: false });
  const underMat = new THREE.MeshStandardMaterial({ color: 0xe0c090, roughness: 0.9 });
  const spotMat = new THREE.MeshStandardMaterial({ color: 0xf0e0c0, roughness: 0.9 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6b4c2f, roughness: 0.9, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyMat);
  body.scale.set(1.3, 0.85, 0.7);
  body.position.set(0, 0.45, 0);
  body.castShadow = true;
  g.add(body);
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), underMat);
  under.scale.set(1.2, 0.55, 0.65);
  under.position.set(0, 0.4, 0);
  g.add(under);
  // Spots
  for (let i = 0; i < 6; i++) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), spotMat);
    spot.position.set(-0.15 + i * 0.06, 0.55 + (i % 2) * 0.02, 0.14 * (i % 2 ? 1 : -1));
    g.add(spot);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), bodyMat);
  neck.rotation.z = -0.5;
  neck.position.set(0.25, 0.55, 0);
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), bodyMat);
  head.scale.set(1.6, 0.9, 0.9);
  head.position.set(0.37, 0.65, 0);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.06), bodyMat);
  snout.position.set(0.48, 0.61, 0);
  g.add(snout);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), bodyMat);
    ear.rotation.x = 0.3 * side;
    ear.position.set(0.34, 0.74, 0.06 * side);
    g.add(ear);
  }
  for (const [dx, dz] of [[0.18, 0.13], [0.18, -0.13], [-0.18, 0.13], [-0.18, -0.13]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.4, 6), legMat);
    leg.position.set(dx, 0.2, dz);
    g.add(leg);
  }
  return g;
}

// ==============================================================
// Butterflies — point sprites clustered around a target
// ==============================================================
function buildButterflyCluster(target, count = 12) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = target.x + (Math.random() - 0.5) * 1.2;
    positions[i * 3 + 1] = target.y + Math.random() * 1.0 + 0.4;
    positions[i * 3 + 2] = target.z + (Math.random() - 0.5) * 1.2;
    seeds[i * 3 + 0] = Math.random() * 10;
    seeds[i * 3 + 1] = 0.6 + Math.random() * 0.5;
    seeds[i * 3 + 2] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uColorA: { value: new THREE.Color(0xffe0a0) },
      uColorB: { value: new THREE.Color(0xffb4d0) },
      uCenter: { value: new THREE.Vector3().copy(target) },
    },
    vertexShader: `
      uniform float uTime; uniform float uPixelRatio; uniform vec3 uCenter;
      attribute vec3 aSeed;
      varying float vShade;
      void main() {
        vec3 rel = position - uCenter;
        vec3 pos = uCenter + rel;
        pos.x += sin(uTime * (1.4 + aSeed.y) + aSeed.z) * 0.5;
        pos.y += sin(uTime * (2.1 + aSeed.y) + aSeed.x) * 0.35;
        pos.z += cos(uTime * (1.7 + aSeed.y) + aSeed.z * 1.3) * 0.5;
        vShade = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 12.0 + aSeed.x * 6.28));
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        if (mv.z > -0.5) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; return; }
        gl_PointSize = clamp(uPixelRatio * (26.0 / -mv.z), 2.0, 22.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA; uniform vec3 uColorB;
      varying float vShade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        // simple butterfly-ish shape: two lobes
        float lobe = smoothstep(0.5, 0.15, abs(c.x)) * smoothstep(0.5, 0.15, abs(c.y * 1.6));
        if (lobe < 0.05) discard;
        vec3 col = mix(uColorA, uColorB, vShade);
        gl_FragColor = vec4(col, lobe * 0.95);
      }
    `,
  });

  const pts = new THREE.Points(geo, mat);
  pts.userData.material = mat;
  pts.userData.target = new THREE.Vector3().copy(target);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  return pts;
}

// ==============================================================
// Public API
// ==============================================================
export class Wildlife {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'wildlife';

    // Deer
    this.deer = [];
    // Butterfly clusters (attached to interactables)
    this.butterflies = [];
    // Firefly trail (Puzzle 3 guide) — segments placed at runtime
    this._trailGroup = new THREE.Group();
    this.group.add(this._trailGroup);
    this.trailActive = false;

    // Fawn (in Heart; hidden until player reaches Heart entrance)
    this.fawn = null;

    // Guide deer (Puzzle 3, if health high)
    this.guideDeer = null;
    this.guideRoute = [];
    this.guideStage = 0;
    this.guideActive = false;
  }

  addAmbientDeer() {
    // 3 wandering deer in different areas
    const spawns = [
      { pos: new THREE.Vector3(-14, 0, 6), waypoints: [[-14, 6], [-22, 0], [-10, -4], [-18, 8]] },
      { pos: new THREE.Vector3(24, 0, -32), waypoints: [[24, -32], [16, -38], [30, -42], [34, -28]] },
      { pos: new THREE.Vector3(12, 0, -14), waypoints: [[12, -14], [4, -12], [16, -20], [20, -8]] },
    ];
    for (const s of spawns) {
      const mesh = buildDeer(1);
      mesh.position.copy(s.pos);
      mesh.position.y = sampleHeight(s.pos.x, s.pos.z);
      this.group.add(mesh);
      this.deer.push({
        mesh,
        state: 'wander',
        wpIndex: 0,
        waypoints: s.waypoints,
        stateT: 0,
        speed: 1.2,
        alertT: 0,
      });
    }
  }

  addFawnAtHeart(pos) {
    const fawn = buildFawn();
    fawn.position.set(pos.x, sampleHeight(pos.x, pos.z), pos.z);
    fawn.rotation.y = Math.PI / 2;
    this.group.add(fawn);
    this.fawn = fawn;
  }

  addButterfliesNear(target) {
    const b = buildButterflyCluster(target, 12);
    this.group.add(b);
    this.butterflies.push(b);
    return b;
  }
  removeButterflies(b) {
    if (!b) return;
    this.group.remove(b);
    if (b.geometry) b.geometry.dispose();
    if (b.material) b.material.dispose();
    this.butterflies = this.butterflies.filter((x) => x !== b);
  }

  // Firefly trail from `from` to `to`, placed as N segments spaced along the path.
  // Segments appear sequentially as the player walks.
  startFireflyTrail(from, to, segments = 10) {
    while (this._trailGroup.children.length) {
      const c = this._trailGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    const ax = from.x, az = from.z, bx = to.x, bz = to.z;
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false,
    });
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = ax + (bx - ax) * t + (Math.random() - 0.5) * 1.6;
      const z = az + (bz - az) * t + (Math.random() - 0.5) * 1.6;
      const y = sampleHeight(x, z) + 1.2 + Math.sin(i * 1.3) * 0.4;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), trailMat);
      dot.position.set(x, y, z);
      dot.userData.baseY = y;
      dot.userData.phase = i * 0.5;
      dot.userData.appearT = i * 0.15;   // sequential appear delay in seconds
      dot.scale.setScalar(0.001);
      this._trailGroup.add(dot);
    }
    this.trailActive = true;
    this._trailStartT = performance.now() * 0.001;
  }

  stopFireflyTrail() {
    this.trailActive = false;
    while (this._trailGroup.children.length) {
      const c = this._trailGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  // Spawn a deer that walks a route (for Puzzle 3 guide)
  startDeerGuide(route) {
    const mesh = buildDeer(1);
    const p = route[0];
    mesh.position.set(p[0], sampleHeight(p[0], p[1]), p[1]);
    this.group.add(mesh);
    this.guideDeer = mesh;
    this.guideRoute = route;
    this.guideStage = 0;
    this.guideActive = true;
  }

  // ==============================================================
  // Update
  // ==============================================================
  update(dt, playerPos, playerVel) {
    const tNow = performance.now() * 0.001;

    // Update deer AI
    const playerSprinting = playerVel && (playerVel.x * playerVel.x + playerVel.z * playerVel.z) > 30;
    for (const d of this.deer) {
      this._updateDeer(d, dt, playerPos, playerSprinting);
    }

    // Update guide deer
    if (this.guideActive && this.guideDeer) {
      const target = this.guideRoute[Math.min(this.guideStage + 1, this.guideRoute.length - 1)];
      const cur = this.guideDeer.position;
      const dx = target[0] - cur.x, dz = target[1] - cur.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const distToPlayer = Math.hypot(playerPos.x - cur.x, playerPos.z - cur.z);
      if (d < 1.5) {
        this.guideStage++;
        if (this.guideStage >= this.guideRoute.length - 1) {
          // Reached end — stay there
          this.guideActive = false;
        }
      } else if (distToPlayer < 18) {
        // Only move if the player is following
        const speed = 2.2 * dt;
        cur.x += (dx / d) * speed;
        cur.z += (dz / d) * speed;
        cur.y = sampleHeight(cur.x, cur.z);
        this.guideDeer.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
        // Small leg animation
        const legs = this.guideDeer.userData.legs;
        if (legs) {
          const phase = tNow * 6;
          legs[0].rotation.x = Math.sin(phase) * 0.4;
          legs[3].rotation.x = Math.sin(phase) * 0.4;
          legs[1].rotation.x = Math.sin(phase + Math.PI) * 0.4;
          legs[2].rotation.x = Math.sin(phase + Math.PI) * 0.4;
        }
      }
    }

    // Firefly trail: sequential appear + slow bob
    if (this.trailActive) {
      const t = tNow - this._trailStartT;
      for (const c of this._trailGroup.children) {
        const app = Math.min(1, Math.max(0, (t - c.userData.appearT) * 4));
        c.scale.setScalar(0.5 + app * 0.5);
        c.position.y = c.userData.baseY + Math.sin(tNow * 2.0 + c.userData.phase) * 0.15;
        c.material.opacity = 0.7 * app;
      }
    }

    // Butterfly animations
    for (const b of this.butterflies) {
      if (b.userData && b.userData.material) b.userData.material.uniforms.uTime.value = tNow;
    }
  }

  _updateDeer(d, dt, playerPos, sprinting) {
    const cur = d.mesh.position;
    const distPlayer = Math.hypot(playerPos.x - cur.x, playerPos.z - cur.z);
    const gs = this.game.gameState;
    const tolerant = gs && gs.health >= 70;

    // State transitions
    if (d.state === 'wander') {
      if ((sprinting && distPlayer < 12) || distPlayer < (tolerant ? 3 : 5)) {
        d.state = 'flee';
        d.stateT = 0;
        if (sprinting && gs) { gs.addHealth(-2, 'scared_deer'); }
      } else if (distPlayer < (tolerant ? 12 : 10)) {
        d.state = 'alert';
        d.alertT = 0;
      }
    } else if (d.state === 'alert') {
      d.alertT += dt;
      if ((sprinting && distPlayer < 12) || distPlayer < (tolerant ? 3 : 5)) {
        d.state = 'flee';
        d.stateT = 0;
        if (sprinting && gs) { gs.addHealth(-2, 'scared_deer'); }
      } else if (distPlayer > 14) {
        d.state = 'wander';
      }
    } else if (d.state === 'flee') {
      d.stateT += dt;
      if (d.stateT > 3.0 && distPlayer > 12) {
        d.state = 'wander';
      }
    }

    // Movement
    if (d.state === 'wander') {
      const wp = d.waypoints[d.wpIndex];
      const tx = wp[0], tz = wp[1];
      const dx = tx - cur.x, dz = tz - cur.z;
      const dd = Math.sqrt(dx * dx + dz * dz);
      if (dd < 1.0) {
        d.wpIndex = (d.wpIndex + 1) % d.waypoints.length;
      } else {
        const speed = d.speed * dt;
        cur.x += (dx / dd) * speed;
        cur.z += (dz / dd) * speed;
        cur.y = sampleHeight(cur.x, cur.z);
        d.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      }
    } else if (d.state === 'alert') {
      // Face the player, mostly still
      const dx = playerPos.x - cur.x;
      const dz = playerPos.z - cur.z;
      d.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
    } else if (d.state === 'flee') {
      // Run directly away
      const dx = cur.x - playerPos.x;
      const dz = cur.z - playerPos.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 0.1) {
        const speed = 6.5 * dt;
        cur.x += (dx / dd) * speed;
        cur.z += (dz / dd) * speed;
        cur.y = sampleHeight(cur.x, cur.z);
        d.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      }
    }

    // Leg animation while moving
    const moving = d.state === 'wander' || d.state === 'flee';
    if (moving) {
      const legs = d.mesh.userData.legs;
      const phase = (performance.now() * 0.001) * (d.state === 'flee' ? 12 : 5);
      if (legs) {
        legs[0].rotation.x = Math.sin(phase) * 0.4;
        legs[3].rotation.x = Math.sin(phase) * 0.4;
        legs[1].rotation.x = Math.sin(phase + Math.PI) * 0.4;
        legs[2].rotation.x = Math.sin(phase + Math.PI) * 0.4;
      }
    }
  }
}
