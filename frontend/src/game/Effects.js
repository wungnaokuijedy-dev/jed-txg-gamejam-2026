// Bespoke effects for Phase 2 puzzles.
// - VineGrowth: instanced curved cylinders scaling in over time to bridge a blockage.
// - WitherEffect: darken + shrink a placed plant when the player takes / neglects it.
// - Water: single mesh with animated flow shader that appears when the spring is cleared.
// - StoneCircleGlow: emissive lerp on standing stones sequentially.
// - RootGate: two great roots parting open.
// - GlowingFlowerCluster / MushroomRing: temptation set (pluck to gain 'reward' but wilt).
// - WitheredPlant: small placeholder that becomes a flower burst when planted-with-seed.

import * as THREE from 'three';
import { sampleHeight } from './Terrain.js';

// ==============================================================
// Withered plant → bloomed flower burst
// ==============================================================
export class WitheredPlant {
  constructor(pos, opts = {}) {
    this.group = new THREE.Group();
    this.pos = pos;
    // Withered stems + drooping leaves
    const witherMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1.0, flatShading: true });
    const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 6), witherMat);
    w1.position.set(0, 0.3, 0); w1.rotation.z = 0.2;
    this.group.add(w1);
    const w2 = w1.clone(); w2.material = witherMat; w2.position.set(0.1, 0.3, -0.05); w2.rotation.z = -0.15;
    this.group.add(w2);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0).scale(1.5, 0.3, 1.2), witherMat);
    leaf.position.set(-0.05, 0.15, 0.08);
    this.group.add(leaf);
    this.group.position.set(pos.x, sampleHeight(pos.x, pos.z), pos.z);
    this.bloomed = false;
  }
  bloom() {
    if (this.bloomed) return;
    this.bloomed = true;
    // Add colorful icospheres in a small burst
    const colors = [0xf4a4c8, 0xffcf80, 0xa8dcff, 0xdfe0a8];
    for (let i = 0; i < 8; i++) {
      const c = colors[i % colors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: c, roughness: 0.7, emissive: c, emissiveIntensity: 0.2, flatShading: true,
      });
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat);
      const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      const rr = 0.15 + Math.random() * 0.25;
      f.position.set(Math.cos(ang) * rr, 0.18 + Math.random() * 0.35, Math.sin(ang) * rr);
      this.group.add(f);
    }
    // A slim green stem in the middle
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a7a4a, roughness: 0.85, flatShading: true });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 6), stemMat);
    stem.position.set(0, 0.28, 0);
    this.group.add(stem);
  }
}

// ==============================================================
// Vine growth over a blockage — animates in over durationSec
// ==============================================================
export class VineGrowth {
  constructor(startPos, endPos, opts = {}) {
    this.group = new THREE.Group();
    this.duration = opts.duration ?? 4.0;
    this.t = 0;
    this.pieces = [];

    const vineMat = new THREE.MeshStandardMaterial({
      color: 0x3a5a3a, emissive: 0x2a4a2a, emissiveIntensity: 0.15, roughness: 0.85, flatShading: true,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x5c8c48, roughness: 0.85, flatShading: true,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xf5d888, emissive: 0xf5d888, emissiveIntensity: 1.2, roughness: 0.4,
    });

    // Root glow at base
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 + Math.random() * 0.05, 0), glowMat);
      r.position.set(startPos.x + (Math.random() - 0.5) * 0.8, sampleHeight(startPos.x, startPos.z) + 0.1, startPos.z + (Math.random() - 0.5) * 0.8);
      r.scale.setScalar(0.001);
      this.group.add(r);
      this.pieces.push({ mesh: r, appearAt: 0, growTo: 1, type: 'root' });
    }

    // Vines climbing from start to end in segments
    const N = 14;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      // Arch: parabolic upward then descending to endPos
      const x = startPos.x + (endPos.x - startPos.x) * t;
      const z = startPos.z + (endPos.z - startPos.z) * t;
      const gy = sampleHeight(x, z);
      const arch = 1.2 * (1 - Math.pow(2 * t - 1, 2));  // parabola peak at t=0.5
      const y = gy + 0.5 + arch;
      const rad = 0.06 + (1 - Math.abs(2 * t - 1)) * 0.03;
      const segLen = 0.8;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.85, segLen, 6), vineMat);
      seg.position.set(x, y, z);
      // Orient along the path direction
      const nextT = Math.min(1, t + 1 / (N - 1));
      const nx = startPos.x + (endPos.x - startPos.x) * nextT - x;
      const nz = startPos.z + (endPos.z - startPos.z) * nextT - z;
      seg.rotation.z = Math.PI / 2;
      seg.rotation.y = Math.atan2(nx, nz) - Math.PI / 2;
      seg.scale.setScalar(0.001);
      seg.castShadow = true;
      this.group.add(seg);
      this.pieces.push({ mesh: seg, appearAt: 0.15 + t * 2.5, growTo: 1, type: 'vine' });

      // Occasional leaf
      if (i % 2 === 0) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0).scale(1.4, 0.4, 1.2), leafMat);
        leaf.position.set(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
        leaf.rotation.y = Math.random() * Math.PI;
        leaf.scale.setScalar(0.001);
        this.group.add(leaf);
        this.pieces.push({ mesh: leaf, appearAt: 0.6 + t * 2.4, growTo: 1, type: 'leaf' });
      }
    }

    this._done = false;
  }
  update(dt) {
    if (this._done) return;
    this.t += dt;
    let allDone = true;
    for (const p of this.pieces) {
      const local = Math.max(0, Math.min(1.5, (this.t - p.appearAt) * 1.3));
      const s = local < 1 ? local : 1;
      const eased = 1 - Math.pow(1 - s, 3); // ease-out cubic
      p.mesh.scale.setScalar(eased * p.growTo);
      if (p.type === 'root') {
        // Fade out root glow after peak
        if (this.t > 3.5) {
          const fade = Math.max(0, 1 - (this.t - 3.5) * 1.2);
          p.mesh.material.emissiveIntensity = 1.2 * fade;
        }
      }
      if (s < 1) allDone = false;
    }
    if (this.t > this.duration + 0.5) this._done = allDone;
  }
  isDone() { return this._done; }
}

// ==============================================================
// Stream water — animated flow shader plane
// ==============================================================
export class StreamWater {
  constructor(mood) {
    // Long thin curved strip following the streamZ = -18 + sin(x*0.08)*3.5 profile.
    // We'll build a custom BufferGeometry along that curve.
    const w = 3.2;    // width
    const N = 90;    // segments along X
    const xMin = -55, xMax = 55;
    const positions = new Float32Array((N + 1) * 2 * 3);
    const uvs = new Float32Array((N + 1) * 2 * 2);
    const indices = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = xMin + (xMax - xMin) * t;
      const zCenter = -18 + Math.sin(x * 0.08) * 3.5;
      const gy = sampleHeight(x, zCenter) + 0.06;
      const base = i * 2 * 3;
      // Left bank
      positions[base + 0] = x;
      positions[base + 1] = gy;
      positions[base + 2] = zCenter - w / 2;
      // Right bank
      positions[base + 3] = x;
      positions[base + 4] = gy;
      positions[base + 5] = zCenter + w / 2;
      const uvBase = i * 2 * 2;
      uvs[uvBase + 0] = t * 20; uvs[uvBase + 1] = 0;
      uvs[uvBase + 2] = t * 20; uvs[uvBase + 3] = 1;
      if (i < N) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x6ca6b4) },
        uColorDeep: { value: new THREE.Color(0x2a4a5a) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uColorDeep;
        varying vec2 vUv;
        float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          float a = hash(i);
          float b = hash(i+vec2(1.0,0.0));
          float c = hash(i+vec2(0.0,1.0));
          float d = hash(i+vec2(1.0,1.0));
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
        }
        void main() {
          // Flow: shift U over time
          vec2 uv1 = vec2(vUv.x - uTime * 0.5, vUv.y * 2.0);
          vec2 uv2 = vec2(vUv.x - uTime * 0.35, vUv.y * 3.0 + 1.7);
          float n = noise(uv1 * 3.0) * 0.5 + noise(uv2 * 5.0) * 0.5;
          // Foam near edges (v near 0 or 1)
          float edge = smoothstep(0.4, 0.5, abs(vUv.y - 0.5) * 2.0);
          vec3 col = mix(uColorDeep, uColor, 0.4 + n * 0.6);
          col = mix(col, vec3(0.9, 0.98, 1.0), edge * (0.4 + 0.4 * n));
          gl_FragColor = vec4(col, 0.9);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.mesh.userData.material = mat;
  }
  start() { this.mesh.visible = true; }
  update(dt, tNow) { this.mesh.userData.material.uniforms.uTime.value = tNow; }
}

// ==============================================================
// Debris pile at the spring source (Area 3 uphill)
// ==============================================================
export function buildDebrisPile(pos) {
  const g = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 1.0, flatShading: true });
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1.0, flatShading: true });
  // Debris rocks
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.15, 0), rockMat);
    r.position.set(pos.x + (Math.random() - 0.5) * 1.4, sampleHeight(pos.x, pos.z) + 0.3, pos.z + (Math.random() - 0.5) * 1.4);
    r.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    r.scale.set(0.8 + Math.random() * 0.4, 0.6 + Math.random() * 0.3, 0.9 + Math.random() * 0.4);
    r.castShadow = true;
    g.add(r);
  }
  // Withered roots wrapping the pile
  for (let i = 0; i < 4; i++) {
    const rr = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.4, 6), rootMat);
    rr.position.set(pos.x + (Math.random() - 0.5) * 1.0, sampleHeight(pos.x, pos.z) + 0.3, pos.z + (Math.random() - 0.5) * 1.0);
    rr.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * Math.PI, Math.PI / 2 + (Math.random() - 0.5) * 0.4);
    rr.castShadow = true;
    g.add(rr);
  }
  return g;
}

// ==============================================================
// Root bridge — two arching roots that rise into an arch when activated.
// ==============================================================
export class RootBridge {
  constructor(pos, mood) {
    this.group = new THREE.Group();
    const rootMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.95, flatShading: true });
    this.arches = [];
    for (let side = -1; side <= 1; side += 2) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.15, 8, 20, Math.PI), rootMat);
      arch.position.set(pos.x, sampleHeight(pos.x, pos.z), pos.z + side * 0.4);
      arch.rotation.y = 0;
      arch.rotation.z = 0;
      arch.rotation.x = Math.PI;      // start upside-down (hidden below ground)
      arch.scale.set(1, 0.001, 1);    // start flat
      arch.castShadow = true;
      this.group.add(arch);
      this.arches.push(arch);
    }
    this._t = 0;
    this._active = false;
  }
  activate() { this._active = true; }
  update(dt) {
    if (!this._active) return;
    this._t = Math.min(1, this._t + dt * 0.4);
    const s = 0.001 + (1 - Math.pow(1 - this._t, 3)) * 0.999;
    for (const a of this.arches) {
      a.scale.y = s;
      a.rotation.x = Math.PI * (1 - this._t); // rotate from PI (hidden) to 0 (upright)
    }
  }
}

// ==============================================================
// Stone Circle Glow controller — sequentially lights up existing stones
// ==============================================================
export class StoneGlow {
  constructor(stones) {
    this.stones = stones;  // Array of Mesh objects (the standing stones)
    this._t = 0;
    this._active = false;
    // Attach emissive per stone
    for (const s of this.stones) {
      s.material = s.material.clone();
      s.material.emissive = new THREE.Color(0x8fd8b0);
      s.material.emissiveIntensity = 0;
    }
  }
  activate() { this._active = true; }
  update(dt) {
    if (!this._active) return;
    this._t += dt;
    const N = this.stones.length;
    for (let i = 0; i < N; i++) {
      const start = i * 0.35;
      const localT = Math.max(0, Math.min(1, (this._t - start) / 1.2));
      const glow = localT * (0.6 + 0.4 * Math.sin(this._t * 3.0 + i));
      this.stones[i].material.emissiveIntensity = glow;
    }
  }
}

// ==============================================================
// Heart-gate roots — two big roots that part open when player arrives.
// ==============================================================
export class HeartGate {
  constructor(pos, mood) {
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1.0, flatShading: true });
    this.left = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 4.5, 8), mat);
    this.right = this.left.clone();
    this.right.material = mat;
    this.left.position.set(pos.x - 1.6, sampleHeight(pos.x - 1.6, pos.z) + 2.2, pos.z);
    this.right.position.set(pos.x + 1.6, sampleHeight(pos.x + 1.6, pos.z) + 2.2, pos.z);
    this.left.rotation.z = 0.3;
    this.right.rotation.z = -0.3;
    this.left.castShadow = true;
    this.right.castShadow = true;
    this.group.add(this.left, this.right);
    this._t = 0;
    this._opening = false;
  }
  open() { this._opening = true; }
  update(dt) {
    if (!this._opening) return;
    this._t = Math.min(1, this._t + dt * 0.3);
    const ease = 1 - Math.pow(1 - this._t, 3);
    this.left.rotation.z = 0.3 - ease * 0.9;
    this.right.rotation.z = -0.3 + ease * 0.9;
    this.left.position.x = -1.6 - ease * 0.4;
    this.right.position.x = 1.6 + ease * 0.4;
  }
}

// ==============================================================
// Glowing flower cluster (temptation) — pluckable, wilts on interact.
// ==============================================================
export function buildGlowingFlowerCluster(pos) {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a6a4a, roughness: 0.85, flatShading: true });
  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0xd8a8ff,
    emissive: 0xa070d8,
    emissiveIntensity: 1.0,
    roughness: 0.5,
    flatShading: true,
  });
  const flowers = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const rr = 0.2 + Math.random() * 0.15;
    const x = Math.cos(ang) * rr;
    const z = Math.sin(ang) * rr;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.32, 6), stemMat);
    stem.position.set(x, 0.16, z);
    g.add(stem);
    const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), flowerMat.clone());
    flower.position.set(x, 0.36, z);
    g.add(flower);
    flowers.push({ stem, flower });
  }
  g.position.set(pos.x, sampleHeight(pos.x, pos.z), pos.z);
  g.userData.flowers = flowers;
  g.wither = () => {
    for (const f of g.userData.flowers) {
      f.flower.material.emissiveIntensity = 0.05;
      f.flower.material.color.setHex(0x5a4a3a);
      f.flower.scale.setScalar(0.4);
      f.stem.rotation.z = 0.6 + (Math.random() - 0.5) * 0.4;
    }
  };
  return g;
}

// ==============================================================
// Mushroom ring (temptation)
// ==============================================================
export function buildMushroomRing(pos) {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d0, roughness: 0.85, flatShading: true });
  const capMat  = new THREE.MeshStandardMaterial({ color: 0xd85a44, roughness: 0.6, flatShading: true });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const rr = 0.85;
    const x = Math.cos(ang) * rr;
    const z = Math.sin(ang) * rr;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.16, 6), stemMat);
    stem.position.set(x, 0.08, z);
    g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), capMat);
    cap.position.set(x, 0.18, z);
    g.add(cap);
  }
  g.position.set(pos.x, sampleHeight(pos.x, pos.z), pos.z);
  g.wither = () => {
    for (const c of g.children) {
      c.scale.setScalar(0.4);
      if (c.material) c.material.color.multiplyScalar(0.5);
    }
  };
  return g;
}

// Seed pickup — small floating glinting orb.
export function buildSeedPickup(pos) {
  const g = new THREE.Group();
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0xf5d888, emissive: 0xf5d888, emissiveIntensity: 0.8, roughness: 0.4,
  });
  const seed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), outerMat);
  seed.position.y = 0.6;
  g.add(seed);
  // Glow halo
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  halo.position.y = 0.6;
  g.add(halo);
  g.position.set(pos.x, sampleHeight(pos.x, pos.z), pos.z);
  g.userData.floatT = Math.random() * Math.PI * 2;
  g.userData.animate = (dt, t) => {
    g.userData.floatT += dt;
    seed.rotation.y += dt * 1.2;
    seed.position.y = 0.6 + Math.sin(t * 1.8 + g.userData.floatT) * 0.08;
    halo.position.y = seed.position.y;
    halo.scale.setScalar(1 + Math.sin(t * 2.0 + g.userData.floatT) * 0.1);
  };
  return g;
}

// Tangled bird (Area 3): small dark bird trapped in withered vines.
export function buildTangledBird(pos) {
  const g = new THREE.Group();
  const birdMat = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.85, flatShading: true });
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1.0, flatShading: true });
  // Bird body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), birdMat);
  body.scale.set(1.4, 0.9, 1);
  body.castShadow = true;
  g.add(body);
  // Wings (folded)
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.14), birdMat);
    wing.position.set(0, 0, 0.1 * side);
    g.add(wing);
  }
  // Vines wrapping
  for (let i = 0; i < 5; i++) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), vineMat);
    v.rotation.x = Math.random() * Math.PI;
    v.rotation.z = Math.random() * Math.PI;
    v.position.set((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
    g.add(v);
  }
  g.position.set(pos.x, sampleHeight(pos.x, pos.z) + 0.9, pos.z);
  g.userData.vinesRemoved = false;
  g.freeBird = () => {
    // Remove vine children, prep body for flyaway
    for (let i = g.children.length - 1; i >= 0; i--) {
      if (g.children[i].material === vineMat || (g.children[i].material && g.children[i].material === vineMat)) {
        g.remove(g.children[i]);
      }
    }
    // Simpler: remove all cylinders (vines)
    for (let i = g.children.length - 1; i >= 0; i--) {
      const c = g.children[i];
      if (c.geometry && c.geometry.type === 'CylinderGeometry') g.remove(c);
    }
    g.userData.vinesRemoved = true;
    g.userData.flyT = 0;
  };
  return g;
}


// ==============================================================
// Heartseed — luminous orb sitting on a small mossy pedestal at the
// center of Area 5. This is the object the final choice is made on.
// ==============================================================
export function buildHeartseed(pos) {
  const g = new THREE.Group();
  // Pedestal — mossy carved stump (short low-poly cylinder + moss ring)
  const stumpMat = new THREE.MeshStandardMaterial({ color: 0x5a4535, roughness: 0.95, flatShading: true });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.32, 12), stumpMat);
  stump.position.y = 0.16;
  stump.castShadow = true;
  g.add(stump);
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9, flatShading: true });
  const moss = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 6, 16), mossMat);
  moss.rotation.x = Math.PI / 2;
  moss.position.y = 0.34;
  g.add(moss);
  // Seed — golden emissive icosahedron
  const seedMat = new THREE.MeshStandardMaterial({
    color: 0xffe0a0, emissive: 0xffb060, emissiveIntensity: 1.35,
    roughness: 0.35, metalness: 0.0,
  });
  const seed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), seedMat);
  seed.position.y = 0.62;
  seed.castShadow = true;
  g.add(seed);
  // Halo — additive-blended translucent sphere
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xfff1c8, transparent: true, opacity: 0.32,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), haloMat);
  halo.position.y = 0.62;
  g.add(halo);
  // Outer aura ring
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xffd88a, transparent: true, opacity: 0.15,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 12), auraMat);
  aura.position.y = 0.62;
  g.add(aura);

  g.position.set(pos.x, sampleHeight(pos.x, pos.z), pos.z);
  g.userData.floatT = Math.random() * Math.PI * 2;
  g.userData.animate = (dt, t) => {
    g.userData.floatT += dt;
    seed.rotation.y += dt * 0.8;
    seed.rotation.x += dt * 0.35;
    const bob = Math.sin(t * 1.5 + g.userData.floatT) * 0.06;
    seed.position.y = 0.62 + bob;
    halo.position.y = seed.position.y;
    halo.scale.setScalar(1 + Math.sin(t * 2.0 + g.userData.floatT) * 0.08);
    aura.position.y = seed.position.y;
    aura.scale.setScalar(1 + Math.sin(t * 1.2 + g.userData.floatT * 0.7) * 0.05);
  };
  g.userData.remove = () => {
    // Called if player picks Take — seed leaves with the player.
    g.remove(seed);
    g.remove(halo);
    g.remove(aura);
  };
  return g;
}
