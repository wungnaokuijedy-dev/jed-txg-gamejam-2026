// Atmosphere: sky dome, fog, mist planes, drifting leaves, distant mountains.
// Everything is procedural. Sky uses a gradient shader on an inverted sphere.

import * as THREE from 'three';
import { MAP_HALF, AREAS, sampleHeight } from './Terrain.js';

export function buildSky(mood) {
  const geo = new THREE.SphereGeometry(400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: mood.skyTop.clone() },
      uHorizon: { value: mood.skyHorizon.clone() },
      uGround: { value: mood.skyGround.clone() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      varying vec3 vDir;
      void main() {
        float y = clamp(vDir.y, -1.0, 1.0);
        vec3 col;
        if (y > 0.0) {
          float t = pow(y, 0.55);
          col = mix(uHorizon, uTop, t);
        } else {
          float t = pow(-y, 0.7);
          col = mix(uHorizon, uGround, t);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  sky.frustumCulled = false;
  return sky;
}

// Distant mountain silhouettes — a large low-poly ring behind the play area.
export function buildDistantMountains(mood) {
  const g = new THREE.Group();
  g.name = 'mountains';
  const radius = MAP_HALF + 90;
  const count = 56;
  const mat = new THREE.MeshBasicMaterial({
    color: mood.fogColor.clone().lerp(mood.skyGround, 0.35).multiplyScalar(0.75),
    fog: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
  });
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const h = 14 + Math.sin(i * 1.7) * 6 + Math.cos(i * 0.9) * 5;
    const w = 32 + Math.sin(i * 2.3) * 6;
    // Round the cones (8 sides + 2 height segments) so they read as mountains,
    // not flat polygons floating in the sky.
    const cone = new THREE.Mesh(new THREE.ConeGeometry(w, h, 8, 2), mat);
    cone.position.set(Math.cos(ang) * radius, h / 2 - 5, Math.sin(ang) * radius);
    cone.rotation.y = ang + (Math.sin(i * 0.7) - 0.5) * 0.4;
    g.add(cone);
  }
  return g;
}

// Mist planes: several large translucent planes drifting slowly through the map.
// Uses a radial soft-edge material via ShaderMaterial for cheap "mist".
export function buildMist(mood) {
  const g = new THREE.Group();
  g.name = 'mist';
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: mood.fogColor.clone() },
      uOpacity: { value: 0.28 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      // Simple 2D value noise
      float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i+vec2(1.0,0.0));
        float c = hash(i+vec2(0.0,1.0));
        float d = hash(i+vec2(1.0,1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main(){
        vec2 c = vUv - 0.5;
        float d = length(c) * 2.0;
        float ring = smoothstep(1.0, 0.15, d);
        float n = noise(vUv * 3.0 + vec2(uTime * 0.05, uTime * 0.03));
        float alpha = ring * (0.55 + 0.6 * n) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  g.userData.material = mat;

  for (let i = 0; i < 14; i++) {
    const w = 22 + Math.random() * 22;
    const h = 4 + Math.random() * 4;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    // Nearly-vertical banks of fog, tilted slightly forward and rotated around Y
    // so they read as drifting mist through the trees (never as flat discs).
    plane.rotation.x = (Math.random() - 0.5) * 0.25;
    plane.rotation.y = Math.random() * Math.PI * 2;
    plane.position.set(
      (Math.random() * 2 - 1) * (MAP_HALF - 30),
      0.8 + Math.random() * 1.4,
      (Math.random() * 2 - 1) * (MAP_HALF - 30)
    );
    plane.renderOrder = 2;
    g.add(plane);
  }
  return g;
}

// Falling leaves — Points sprite with drift + rotation, wrapped around the player.
export function buildLeaves(mood, count = 220) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() * 2 - 1) * 40;
    positions[i * 3 + 1] = Math.random() * 12 + 2;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * 40;
    seeds[i * 3 + 0] = Math.random() * 10;
    seeds[i * 3 + 1] = 0.5 + Math.random() * 0.5;
    seeds[i * 3 + 2] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPlayer: { value: new THREE.Vector3() },
      uColorA: { value: new THREE.Color(0xd0a878) },
      uColorB: { value: new THREE.Color(0x8ab08a).multiply(mood.foliageTint) },
      uSize: { value: 6.0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSize;
      uniform float uPixelRatio;
      uniform vec3 uPlayer;
      attribute vec3 aSeed;
      varying float vShade;
      void main() {
        vec3 pos = position;
        // Wrap position around player in a 60m cube
        vec3 rel = pos - uPlayer;
        rel = mod(rel + 30.0, 60.0) - 30.0;
        pos = uPlayer + rel;
        // Drift + fall
        pos.y -= mod(uTime * aSeed.y * 0.9, 20.0);
        pos.x += sin(uTime * 0.6 + aSeed.z) * 0.8;
        pos.z += cos(uTime * 0.5 + aSeed.z * 1.3) * 0.7;
        // Wrap Y between 1 and 15
        pos.y = mod(pos.y - uPlayer.y - 1.0, 14.0) + uPlayer.y + 1.0;
        vShade = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed.x);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        // Cull points behind (or right at) the near plane; otherwise gl_PointSize
        // explodes and renders as a huge disc filling the screen.
        if (mv.z > -0.5) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // outside clip space -> discarded
          gl_PointSize = 0.0;
          return;
        }
        float sz = uSize * uPixelRatio * (12.0 / -mv.z);
        gl_PointSize = clamp(sz, 1.0, 40.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying float vShade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.15, d);
        vec3 col = mix(uColorA, uColorB, vShade);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.material = mat;
  return pts;
}


// ============================================================
// AMBIENT LIFE — fireflies, pollen motes, god-ray light shafts, birds
// All visual-only for Phase 1; no wildlife AI yet.
// ============================================================

// Fireflies (soft blinking golden points that hover in dark forest pockets).
export function buildFireflies(mood, count = 100) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  // Cluster them near dark spots: Whispering Woods (Area 2), Silent Stream (Area 3),
  // and the darker underbrush around Area 4.
  const clusters = [
    { c: [AREAS[1].center[0], AREAS[1].center[1]], r: 12 },
    { c: [AREAS[2].center[0], AREAS[2].center[1]], r: 10 },
    { c: [AREAS[3].center[0] - 8, AREAS[3].center[1] + 6], r: 8 },
    { c: [10, -10], r: 10 },
    { c: [-6, -40], r: 12 },
  ];
  for (let i = 0; i < count; i++) {
    const cl = clusters[i % clusters.length];
    const ang = Math.random() * Math.PI * 2;
    const rr = Math.random() * cl.r;
    const x = cl.c[0] + Math.cos(ang) * rr;
    const z = cl.c[1] + Math.sin(ang) * rr;
    const y = sampleHeight(x, z) + 0.6 + Math.random() * 1.8;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds[i * 3 + 0] = Math.random() * 10;
    seeds[i * 3 + 1] = 0.6 + Math.random() * 0.8;
    seeds[i * 3 + 2] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uColor: { value: new THREE.Color(0xffd48a) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute vec3 aSeed;
      varying float vAlpha;
      void main() {
        vec3 pos = position;
        // Slow floating motion
        pos.x += sin(uTime * aSeed.y + aSeed.z) * 0.6;
        pos.y += sin(uTime * 0.6 + aSeed.x) * 0.35;
        pos.z += cos(uTime * (aSeed.y * 0.85) + aSeed.z * 1.3) * 0.6;
        // Blink
        vAlpha = 0.35 + 0.65 * smoothstep(0.0, 1.0, 0.5 + 0.5 * sin(uTime * 3.0 + aSeed.x * 6.28));
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        if (mv.z > -0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        gl_PointSize = clamp(uPixelRatio * (36.0 / -mv.z), 2.0, 22.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.material = mat;
  pts.renderOrder = 3;
  return pts;
}

// Pollen motes drifting near the player (small white/gold specks)
export function buildPollen(mood, count = 160) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() * 2 - 1) * 20;
    positions[i * 3 + 1] = 0.5 + Math.random() * 4;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * 20;
    seeds[i * 3 + 0] = Math.random() * 10;
    seeds[i * 3 + 1] = 0.4 + Math.random() * 0.8;
    seeds[i * 3 + 2] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPlayer: { value: new THREE.Vector3() },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uColor: { value: new THREE.Color(0xfff2d0) },
    },
    vertexShader: `
      uniform float uTime;
      uniform vec3 uPlayer;
      uniform float uPixelRatio;
      attribute vec3 aSeed;
      varying float vShade;
      void main() {
        vec3 pos = position;
        // Wrap in a 22m radius cube around player so motes always surround her
        vec3 rel = pos - uPlayer;
        rel = mod(rel + 11.0, 22.0) - 11.0;
        pos = uPlayer + rel;
        // Very slow drift
        pos.x += sin(uTime * 0.3 + aSeed.z) * 0.3;
        pos.y += sin(uTime * 0.55 + aSeed.x) * 0.15;
        pos.z += cos(uTime * 0.25 + aSeed.z * 1.7) * 0.3;
        vShade = 0.5 + 0.5 * sin(uTime * 2.0 + aSeed.x);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        if (mv.z > -0.5) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; return; }
        gl_PointSize = clamp(uPixelRatio * (10.0 / -mv.z), 1.0, 8.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vShade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * (0.35 + 0.45 * vShade);
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.material = mat;
  pts.renderOrder = 3;
  return pts;
}

// God-ray light shafts near the Entrance — a few transparent cones oriented
// along the sun direction. Cheap billboard-ish approximation.
export function buildGodRays(mood, count = 5) {
  const g = new THREE.Group();
  g.name = 'godrays';
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: mood.sunColor.clone().multiplyScalar(0.7) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        // Cone UV: v=0 near the tip, v=1 at base
        float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float len    = pow(vUv.y, 0.5);
        float shimmer = 0.85 + 0.15 * sin(uTime * 1.5 + vUv.y * 10.0);
        float alpha = radial * radial * (1.0 - len) * 0.15 * shimmer;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  g.userData.material = mat;

  // Direction from sun (position → tip pointing downward-ish, tilted along sun)
  const dir = mood.sunDirection.clone().negate().normalize(); // shafts go from sky to ground
  for (let i = 0; i < count; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 14, 10, 1, true), mat);
    // Point cone tip downward: default cone tip is +Y, base is -Y in Three.js.
    // We want shafts angled with sun; align cone -Y direction with `dir`.
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    // Scatter around the Entrance
    const a1 = AREAS[0];
    const ang = (i / count) * Math.PI * 2;
    const rr = 6 + Math.random() * 8;
    const x = a1.center[0] + Math.cos(ang) * rr;
    const z = a1.center[1] + Math.sin(ang) * rr;
    cone.position.set(x, sampleHeight(x, z) + 4.5, z);
    cone.renderOrder = 4;
    g.add(cone);
  }
  return g;
}

// Two-three birds flying spline loops between canopies.
export function buildBirds(mood) {
  const g = new THREE.Group();
  g.name = 'birds';

  const birdMat = new THREE.MeshStandardMaterial({
    color: 0x2a1c14, roughness: 0.85, flatShading: true,
  });

  // Simple bird body: two triangular wings + tiny body
  function makeBird() {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), birdMat);
    body.scale.set(1.5, 0.9, 1);
    b.add(body);
    // Wings as flat triangles (planes)
    for (const side of [-1, 1]) {
      const wingGeo = new THREE.BufferGeometry();
      const verts = new Float32Array([
        0, 0, 0,
        side * 0.45, 0, -0.1,
        side * 0.35, 0, 0.15,
      ]);
      wingGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      wingGeo.computeVertexNormals();
      const wing = new THREE.Mesh(wingGeo, birdMat);
      wing.name = side < 0 ? 'wingL' : 'wingR';
      wing.userData.side = side;
      b.add(wing);
    }
    return b;
  }

  // Three birds with individual spline paths at different heights
  const paths = [
    { center: [0, -20],  radius: 45, height: 22, dur: 32, phase: 0 },
    { center: [-10, -40], radius: 35, height: 18, dur: 28, phase: 1.7 },
    { center: [30, -30], radius: 40, height: 25, dur: 36, phase: 3.1 },
  ];
  const birds = [];
  for (const p of paths) {
    const bird = makeBird();
    g.add(bird);
    birds.push({ mesh: bird, path: p });
  }
  g.userData.birds = birds;
  return g;
}

// Update birds each frame — moves them along their loops and flaps wings.
export function updateBirds(birdsGroup, tNow) {
  if (!birdsGroup || !birdsGroup.userData.birds) return;
  for (const b of birdsGroup.userData.birds) {
    const p = b.path;
    const t = (tNow + p.phase * 5) % p.dur;
    const angle = (t / p.dur) * Math.PI * 2;
    const x = p.center[0] + Math.cos(angle) * p.radius;
    const z = p.center[1] + Math.sin(angle) * p.radius;
    // Vary height with a sine
    const y = p.height + Math.sin(angle * 2) * 1.5;
    b.mesh.position.set(x, y, z);
    // Face along motion direction (tangent = derivative)
    const tx = -Math.sin(angle) * p.radius;
    const tz =  Math.cos(angle) * p.radius;
    b.mesh.rotation.y = Math.atan2(tx, tz);
    // Flap wings
    const flap = Math.sin(tNow * 12 + p.phase) * 0.6;
    b.mesh.children.forEach((c) => {
      if (c.name === 'wingL') c.rotation.z = flap;
      if (c.name === 'wingR') c.rotation.z = -flap;
    });
  }
}
