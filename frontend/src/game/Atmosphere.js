// Atmosphere: sky dome, fog, mist planes, drifting leaves, distant mountains.
// Everything is procedural. Sky uses a gradient shader on an inverted sphere.

import * as THREE from 'three';
import { MAP_HALF } from './Terrain.js';

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
