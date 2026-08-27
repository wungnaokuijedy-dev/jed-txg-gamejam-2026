// Ending sequences. Each installs distinct visual effects that persist through
// the ending cinematic. Called by the game after the Heart choice is resolved.

import * as THREE from 'three';
import { sampleHeight, AREAS } from './Terrain.js';

// Big luminous stag "guardian" made of glowing shapes + drifting mote sprites.
function buildGuardianStag(pos) {
  const g = new THREE.Group();
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xffe0a0, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  // Body core
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), glowMat);
  body.scale.set(1.6, 0.9, 0.7);
  body.position.y = 1.7;
  g.add(body);
  // Aura around body
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), auraMat);
  aura.scale.set(1.7, 1.0, 0.85);
  aura.position.y = 1.7;
  g.add(aura);
  // Neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.6, 8), glowMat);
  neck.rotation.z = -0.5;
  neck.position.set(1.0, 2.15, 0);
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), glowMat);
  head.scale.set(1.6, 0.9, 0.9);
  head.position.set(1.35, 2.5, 0);
  g.add(head);
  // Antlers — branching lines (thin curved cylinders)
  const antMat = glowMat;
  for (const side of [-1, 1]) {
    const antler = new THREE.Group();
    antler.position.set(1.25, 2.75, 0.14 * side);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.85, 6), antMat);
    trunk.rotation.z = -0.5 * side; trunk.rotation.x = 0.3 * side;
    trunk.position.y = 0.35;
    antler.add(trunk);
    for (let i = 0; i < 3; i++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), antMat);
      branch.rotation.z = -0.35 * side + i * 0.15;
      branch.rotation.x = 0.2 * side;
      branch.position.set(0.06 * side * (i + 1), 0.35 + i * 0.15, 0);
      antler.add(branch);
    }
    g.add(antler);
  }
  // Legs (thin, glowing)
  for (const [dx, dz] of [[0.55, 0.28], [0.55, -0.28], [-0.55, 0.28], [-0.55, -0.28]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 1.5, 6), glowMat);
    leg.position.set(dx, 0.75, dz);
    g.add(leg);
  }
  g.position.set(pos.x, sampleHeight(pos.x, pos.z), pos.z);
  g.userData.opacity = 0;
  g.userData.setOpacity = (o) => {
    glowMat.opacity = 0.85 * o;
    auraMat.opacity = 0.28 * o;
    g.userData.opacity = o;
  };
  g.userData.setOpacity(0);
  return g;
}

// Simple burst of glowing motes drifting upward.
function buildMotesUpward(pos, count = 220) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = Math.random() * 5;
    positions[i * 3 + 0] = pos.x + Math.cos(ang) * rr;
    positions[i * 3 + 1] = pos.y + Math.random() * 2;
    positions[i * 3 + 2] = pos.z + Math.sin(ang) * rr;
    seeds[i * 3 + 0] = Math.random() * 10;
    seeds[i * 3 + 1] = 0.4 + Math.random() * 0.9;
    seeds[i * 3 + 2] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uColor: { value: new THREE.Color(0xfff2c8) },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      uniform float uTime; uniform float uPixelRatio;
      attribute vec3 aSeed;
      varying float vShade;
      void main() {
        vec3 pos = position;
        pos.y += mod(uTime * aSeed.y, 14.0);
        pos.x += sin(uTime * 0.6 + aSeed.z) * 0.6;
        pos.z += cos(uTime * 0.7 + aSeed.z * 1.3) * 0.6;
        vShade = 0.4 + 0.6 * sin(uTime * 2.0 + aSeed.x);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        if (mv.z > -0.5) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; return; }
        gl_PointSize = clamp(uPixelRatio * (24.0 / -mv.z), 1.0, 16.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vShade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * vShade * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.material = mat;
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  return pts;
}

export class Endings {
  constructor(game) {
    this.game = game;
    this._effects = [];
    this.active = null;   // 'guardian' | 'balance' | 'silence'
  }

  playGuardian() {
    const g = this.game;
    this.active = 'guardian';
    // Weather → break (sun through clouds)
    g.weather.setStage('break');
    // Force mood toward warm quickly
    g.gameState._moodTTarget = 1.0;

    // Guardian stag appears about 6m in front of the heart tree
    const heartPos = new THREE.Vector3(AREAS[4].center[0], 0, AREAS[4].center[1]);
    const stagPos = heartPos.clone().add(new THREE.Vector3(0, 0, 6));
    const stag = buildGuardianStag(stagPos);
    g.scene.add(stag);
    // Motes upward
    const motes = buildMotesUpward(stagPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 280);
    g.scene.add(motes);

    let t = 0;
    const eff = {
      update: (dt, tNow) => {
        t += dt;
        // Fade stag in over ~4s, hold, fade out final 4s
        let opacity = 0;
        if (t < 4) opacity = t / 4;
        else if (t < 18) opacity = 1;
        else opacity = Math.max(0, 1 - (t - 18) / 5);
        stag.userData.setOpacity(opacity);
        // Slow bow motion (rotation of head node — skip, too complex; rock body slightly)
        stag.rotation.y = Math.sin(t * 0.3) * 0.08;
        // Motes fade in / out
        const motesOp = Math.min(1, Math.max(0, t < 2 ? 0 : (t - 2) / 3)) * (t > 20 ? Math.max(0, 1 - (t - 20) / 4) : 1);
        motes.userData.material.uniforms.uOpacity.value = motesOp;
        motes.userData.material.uniforms.uTime.value = tNow;
      },
      dispose: () => {
        g.scene.remove(stag);
        g.scene.remove(motes);
        try { stag.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } catch (_) {}
        motes.geometry.dispose();
        motes.material.dispose();
      },
    };
    this._effects.push(eff);
  }

  playBalance() {
    const g = this.game;
    this.active = 'balance';
    g.weather.setStage('clearing');
    // Faint guardian silhouette in mist
    const heartPos = new THREE.Vector3(AREAS[4].center[0], 0, AREAS[4].center[1]);
    const stagPos = heartPos.clone().add(new THREE.Vector3(-4, 0, 10));
    const stag = buildGuardianStag(stagPos);
    g.scene.add(stag);
    let t = 0;
    const eff = {
      update: (dt, tNow) => {
        t += dt;
        // Faint & brief: 0..8s peak 0.25 opacity, then vanish
        let o = 0;
        if (t < 3) o = (t / 3) * 0.25;
        else if (t < 8) o = 0.25;
        else o = Math.max(0, 0.25 - (t - 8) / 3 * 0.25);
        stag.userData.setOpacity(o);
      },
      dispose: () => {
        g.scene.remove(stag);
        try { stag.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } catch (_) {}
      },
    };
    this._effects.push(eff);
  }

  playSilence() {
    const g = this.game;
    this.active = 'silence';
    g.weather.setStage('mist');
    g.gameState._moodTTarget = 0.0;   // full cool grey
    // Fireflies gutter out — do this on the existing firefly group by fading its material
    const ff = g.fireflies;
    let t = 0;
    const eff = {
      update: (dt) => {
        t += dt;
        if (ff && ff.userData.material && ff.userData.material.uniforms.uColor) {
          const c = ff.userData.material.uniforms.uColor.value;
          const fade = Math.max(0, 1 - t / 12);
          c.setScalar(fade);
        }
      },
      dispose: () => {},
    };
    this._effects.push(eff);
    // Fawn walks away
    if (g.wildlife && g.wildlife.fawn) {
      const fawn = g.wildlife.fawn;
      const startPos = fawn.position.clone();
      const endPos = fawn.position.clone().add(new THREE.Vector3(-6, 0, -12));
      let t2 = 0;
      this._effects.push({
        update: (dt) => {
          t2 += dt;
          const k = Math.min(1, t2 / 20);
          fawn.position.lerpVectors(startPos, endPos, k);
          fawn.position.y = sampleHeight(fawn.position.x, fawn.position.z);
          fawn.rotation.y = Math.atan2(endPos.x - startPos.x, endPos.z - startPos.z) + Math.PI / 2;
        },
        dispose: () => {},
      });
    }
  }

  update(dt, tNow) {
    for (const e of this._effects) e.update(dt, tNow);
  }

  dispose() {
    for (const e of this._effects) if (e.dispose) e.dispose();
    this._effects = [];
    this.active = null;
  }

  endingMessage(kind) {
    if (kind === 'guardian') return 'You listened.';
    if (kind === 'balance') return 'Nature does not need perfection. It needs respect.';
    return 'When nature stops leading, we are left alone.';
  }
}
