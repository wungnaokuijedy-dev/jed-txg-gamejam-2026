// Mood config — single source of truth for atmospheric colors + lighting params.
// Structured for later phases to lerp between MOODS[0] (dawn) and MOODS[1] (warm/healed)
// as Forest Health rises, without hunting through the codebase.
import * as THREE from 'three';

export const MOODS = {
  DAWN_COOL: {
    id: 'dawn_cool',
    // Sky gradient (top -> horizon)
    skyTop: new THREE.Color('#3a5d6b'),
    skyHorizon: new THREE.Color('#8fb4a8'),
    skyGround: new THREE.Color('#2a3a3a'),
    // Fog
    fogColor: new THREE.Color('#7ba098'),
    fogDensity: 0.028,
    // Directional sun
    sunColor: new THREE.Color('#f4e6c8'),
    sunIntensity: 1.35,
    sunDirection: new THREE.Vector3(-0.55, 0.75, 0.45).normalize(),
    // Hemisphere
    hemiSky: new THREE.Color('#7fa4a4'),
    hemiGround: new THREE.Color('#2f3a2a'),
    hemiIntensity: 0.55,
    // Ambient tint applied to terrain
    groundTint: new THREE.Color('#dcece0'),
    // Grass/tree base tints (multiplied with per-instance color)
    foliageTint: new THREE.Color('#c8dcc8'),
    trunkTint: new THREE.Color('#c8b39a'),
  },
  WARM_HEALED: {
    id: 'warm_healed',
    skyTop: new THREE.Color('#f2b878'),
    skyHorizon: new THREE.Color('#ffd9a8'),
    skyGround: new THREE.Color('#5a4030'),
    fogColor: new THREE.Color('#e8c090'),
    fogDensity: 0.014,
    sunColor: new THREE.Color('#fff2c4'),
    sunIntensity: 1.6,
    sunDirection: new THREE.Vector3(-0.3, 0.85, 0.5).normalize(),
    hemiSky: new THREE.Color('#ffd8a8'),
    hemiGround: new THREE.Color('#4a3820'),
    hemiIntensity: 0.7,
    groundTint: new THREE.Color('#fff2d8'),
    foliageTint: new THREE.Color('#e8e0b0'),
    trunkTint: new THREE.Color('#e0c0a0'),
  },
};

// Return an interpolated mood (t in [0, 1]) between two named moods.
// Later phases can call lerpMood(applyFn, 'dawn_cool', 'warm_healed', forestHealth)
export function lerpMood(a, b, t) {
  const out = { id: `${a.id}->${b.id}@${t.toFixed(2)}` };
  const tt = THREE.MathUtils.clamp(t, 0, 1);
  const lc = (ka) => a[ka].clone().lerp(b[ka], tt);
  out.skyTop = lc('skyTop');
  out.skyHorizon = lc('skyHorizon');
  out.skyGround = lc('skyGround');
  out.fogColor = lc('fogColor');
  out.fogDensity = THREE.MathUtils.lerp(a.fogDensity, b.fogDensity, tt);
  out.sunColor = lc('sunColor');
  out.sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, tt);
  out.sunDirection = a.sunDirection.clone().lerp(b.sunDirection, tt).normalize();
  out.hemiSky = lc('hemiSky');
  out.hemiGround = lc('hemiGround');
  out.hemiIntensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, tt);
  out.groundTint = lc('groundTint');
  out.foliageTint = lc('foliageTint');
  out.trunkTint = lc('trunkTint');
  return out;
}
