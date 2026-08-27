// Instanced vegetation + hero props for each area.
// All geometry is procedural. Wind sway is applied via onBeforeCompile so
// MeshStandardMaterial lighting (shadows, fog) still works.

import * as THREE from 'three';
import { sampleHeight, AREAS, MAP_HALF } from './Terrain.js';
import { mulberry32 } from './Rng.js';

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _rot = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();

// Attach a shared sway uniform to a MeshStandardMaterial and inject vertex code.
// swayAmount is a per-material amplitude scale.
function makeSwayMaterial(baseColor, { swayAmount = 0.06, swayFreq = 1.4, roughness = 0.9, flatShading = true } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness: 0.0,
    flatShading,
  });
  mat.userData.swayAmount = swayAmount;
  mat.userData.swayFreq = swayFreq;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uSwayAmount = { value: mat.userData.swayAmount };
    shader.uniforms.uSwayFreq = { value: mat.userData.swayFreq };
    mat.userData.shader = shader;
    shader.vertexShader = `
      uniform float uTime;
      uniform float uSwayAmount;
      uniform float uSwayFreq;
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ix = instanceMatrix[3][0];
         float iz = instanceMatrix[3][2];
       #else
         float ix = 0.0;
         float iz = 0.0;
       #endif
       float phase = uTime * uSwayFreq + ix * 0.13 + iz * 0.17;
       float bendFactor = max(0.0, position.y) * uSwayAmount;
       transformed.x += sin(phase) * bendFactor;
       transformed.z += cos(phase * 0.87 + 1.3) * bendFactor * 0.75;
      `
    );
  };
  return mat;
}

// Build a simple stylized tree of a given variant. Returns {trunkGeo, foliageGeo}.
function makeTreeGeometries(variant) {
  const trunkGeos = [];
  const foliageGeos = [];

  if (variant === 0) {
    // Tall pine — thin trunk + 3 stacked cones
    trunkGeos.push(new THREE.CylinderGeometry(0.18, 0.28, 5.5, 6).translate(0, 2.75, 0));
    for (let i = 0; i < 3; i++) {
      const r = 1.6 - i * 0.35;
      const h = 1.9 - i * 0.15;
      foliageGeos.push(new THREE.ConeGeometry(r, h, 7).translate(0, 4.0 + i * 1.1, 0));
    }
  } else if (variant === 1) {
    // Broad deciduous — wider trunk + rounded foliage
    trunkGeos.push(new THREE.CylinderGeometry(0.32, 0.48, 3.4, 7).translate(0, 1.7, 0));
    foliageGeos.push(new THREE.IcosahedronGeometry(1.7, 0).translate(0, 3.6, 0));
    foliageGeos.push(new THREE.IcosahedronGeometry(1.2, 0).translate(0.7, 4.1, 0.3));
    foliageGeos.push(new THREE.IcosahedronGeometry(1.1, 0).translate(-0.6, 4.0, -0.3));
  } else {
    // Twisted old tree — slight lean, flatter canopy
    trunkGeos.push(new THREE.CylinderGeometry(0.28, 0.42, 4.2, 7)
      .rotateZ(0.08).translate(0.1, 2.1, 0));
    foliageGeos.push(new THREE.IcosahedronGeometry(1.9, 0).scale(1.2, 0.7, 1.2).translate(0.1, 4.4, 0));
  }
  const trunkGeo = mergeGeometries(trunkGeos);
  const foliageGeo = mergeGeometries(foliageGeos);
  return { trunkGeo, foliageGeo };
}

// Minimal geometry merge (positions + normals only; enough for what we need).
function mergeGeometries(geos) {
  if (geos.length === 1) return geos[0];
  const merged = new THREE.BufferGeometry();
  let vertexCount = 0;
  for (const g of geos) {
    if (g.index) g.deleteAttribute('index');
    vertexCount += g.attributes.position.count;
  }
  const pos = new Float32Array(vertexCount * 3);
  const nrm = new Float32Array(vertexCount * 3);
  let offset = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal ? g.attributes.normal.array : null;
    pos.set(p, offset * 3);
    if (n) nrm.set(n, offset * 3);
    offset += g.attributes.position.count;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nrm.some(v => v !== 0)) merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  else merged.computeVertexNormals();
  return merged;
}

// Public API: build vegetation + hero props for the whole map.
// Returns { group, obstacles, swayMaterials }.
// obstacles = [{x, z, r}] for character collision (trunks, rocks, stones, logs).
// swayMaterials = list of materials whose uniforms.uTime should be advanced per frame.
export function buildVegetation(mood) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  const obstacles = [];
  const swayMaterials = [];

  const rng = mulberry32(1337);

  // Materials
  const trunkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x6d4a2f).multiply(mood.trunkTint),
    roughness: 0.95, flatShading: true,
  });
  const foliageMatA = makeSwayMaterial(new THREE.Color(0x4f7d55).multiply(mood.foliageTint), { swayAmount: 0.035, swayFreq: 1.2 });
  const foliageMatB = makeSwayMaterial(new THREE.Color(0x628f5a).multiply(mood.foliageTint), { swayAmount: 0.04, swayFreq: 1.35 });
  const foliageMatC = makeSwayMaterial(new THREE.Color(0x4a6a4a).multiply(mood.foliageTint), { swayAmount: 0.03, swayFreq: 1.1 });
  swayMaterials.push(foliageMatA, foliageMatB, foliageMatC);

  // Prebuild variants
  const variants = [makeTreeGeometries(0), makeTreeGeometries(1), makeTreeGeometries(2)];
  const foliageMats = [foliageMatA, foliageMatB, foliageMatC];

  // Sample scatter points across the map, biased by area.
  const treeCounts = [220, 180, 140]; // per variant

  const placedTrees = []; // {x, z, variant, scale}

  function terrainNormalIsFlatEnough(x, z) {
    // Quick approximation via finite differences on sampleHeight
    const h = sampleHeight(x, z);
    const dx = sampleHeight(x + 0.7, z) - h;
    const dz = sampleHeight(x, z + 0.7) - h;
    const slope = Math.hypot(dx, dz) / 0.7;
    return slope < 1.2;
  }

  function insideArea(x, z, areaIndex) {
    const a = AREAS[areaIndex];
    const dx = x - a.center[0], dz = z - a.center[1];
    return Math.hypot(dx, dz) < a.radius;
  }

  function nearPath(x, z, tol = 1.5) {
    // Reuse a simplified path-distance so trees don't spawn on the earthy path.
    const pts = [
      [AREAS[0].center[0], AREAS[0].center[1]],
      [-14, 12],
      [AREAS[1].center[0], AREAS[1].center[1]],
      [-10, -14],
      [AREAS[2].center[0], AREAS[2].center[1]],
      [18, -28],
      [AREAS[3].center[0], AREAS[3].center[1]],
      [14, -50],
      [AREAS[4].center[0], AREAS[4].center[1]],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
      const vx = bx - ax, vz = bz - az;
      const wx = x - ax, wz = z - az;
      const c1 = vx * wx + vz * wz;
      const c2 = vx * vx + vz * vz;
      let d;
      if (c1 <= 0) d = Math.hypot(x - ax, z - az);
      else if (c2 <= c1) d = Math.hypot(x - bx, z - bz);
      else { const t = c1 / c2; d = Math.hypot(x - (ax + t * vx), z - (az + t * vz)); }
      if (d < tol) return true;
    }
    return false;
  }

  // Populate trees
  const maxAttempts = 5000;
  let attempts = 0;
  const variantTargets = [...treeCounts];
  while (variantTargets.some(v => v > 0) && attempts++ < maxAttempts) {
    const x = (rng() * 2 - 1) * (MAP_HALF - 6);
    const z = (rng() * 2 - 1) * (MAP_HALF - 6);
    if (!terrainNormalIsFlatEnough(x, z)) continue;
    if (nearPath(x, z, 2.2)) continue;
    // Keep spawn area clear near player start
    if (Math.hypot(x - 0, z - 22) < 8) continue;
    // Keep stream depression clear of large trees
    const streamZ = -18 + Math.sin(x * 0.08) * 3.5;
    if (Math.abs(z - streamZ) < 2 && Math.abs(x) < 60) continue;
    // Keep Area 5 clearing sparser (ancient tree will be hero)
    if (insideArea(x, z, 4) && Math.hypot(x - AREAS[4].center[0], z - AREAS[4].center[1]) < 8) continue;

    // Bias variant selection by area:
    // Area 1 (Entrance) — mostly tall pines (variant 0)
    // Area 2 (Whispering Woods) — dense mix, favor variant 2 twisted
    // Area 4 (Ancient Grove) — variant 2 heavy
    let vChoice;
    const r = rng();
    if (insideArea(x, z, 0)) vChoice = r < 0.75 ? 0 : (r < 0.9 ? 1 : 2);
    else if (insideArea(x, z, 1)) vChoice = r < 0.35 ? 0 : (r < 0.6 ? 1 : 2);
    else if (insideArea(x, z, 3)) vChoice = r < 0.15 ? 0 : (r < 0.4 ? 1 : 2);
    else vChoice = r < 0.4 ? 0 : (r < 0.75 ? 1 : 2);
    if (variantTargets[vChoice] <= 0) {
      // Retry with any variant that still has quota
      const remaining = variantTargets.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0);
      if (!remaining.length) break;
      vChoice = remaining[Math.floor(rng() * remaining.length)];
    }
    const scale = 0.85 + rng() * 0.5;
    placedTrees.push({ x, z, variant: vChoice, scale });
    variantTargets[vChoice]--;

    // Trunk collision radius (accounts for scale)
    obstacles.push({ x, z, r: 0.6 * scale });
  }

  // Build InstancedMeshes for each variant × (trunk / foliage)
  const perVariant = [[], [], []];
  for (const t of placedTrees) perVariant[t.variant].push(t);

  for (let v = 0; v < 3; v++) {
    const list = perVariant[v];
    if (!list.length) continue;
    const { trunkGeo, foliageGeo } = variants[v];
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
    const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMats[v], list.length);
    trunkMesh.castShadow = true;
    foliageMesh.castShadow = true;
    trunkMesh.receiveShadow = false;
    foliageMesh.receiveShadow = false;

    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const y = sampleHeight(t.x, t.z);
      _pos.set(t.x, y, t.z);
      _rot.set(0, rng() * Math.PI * 2, 0);
      _quat.setFromEuler(_rot);
      _scl.set(t.scale, t.scale, t.scale);
      _mat4.compose(_pos, _quat, _scl);
      trunkMesh.setMatrixAt(i, _mat4);
      foliageMesh.setMatrixAt(i, _mat4);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    foliageMesh.instanceMatrix.needsUpdate = true;
    group.add(trunkMesh);
    group.add(foliageMesh);
  }

  // ==== ROCKS ====
  const rockGeoA = new THREE.IcosahedronGeometry(0.55, 0).scale(1.2, 0.7, 1.1);
  const rockGeoB = new THREE.IcosahedronGeometry(0.9, 0).scale(1.1, 0.6, 1.3);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6c706b, roughness: 1.0, flatShading: true });

  const rockCount = 90;
  const rockA = new THREE.InstancedMesh(rockGeoA, rockMat, rockCount);
  const rockB = new THREE.InstancedMesh(rockGeoB, rockMat, Math.floor(rockCount * 0.5));
  rockA.castShadow = true; rockB.castShadow = true;
  rockA.receiveShadow = true; rockB.receiveShadow = true;
  let ri = 0, rj = 0;
  attempts = 0;
  while ((ri < rockCount || rj < rockB.count) && attempts++ < 4000) {
    const x = (rng() * 2 - 1) * (MAP_HALF - 6);
    const z = (rng() * 2 - 1) * (MAP_HALF - 6);
    if (Math.hypot(x - 0, z - 22) < 6) continue;
    if (nearPath(x, z, 1.2)) continue;
    const y = sampleHeight(x, z) - 0.1;
    _pos.set(x, y, z);
    _rot.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4);
    _quat.setFromEuler(_rot);
    const s = 0.6 + rng() * 1.2;
    _scl.set(s, s * (0.7 + rng() * 0.4), s);
    _mat4.compose(_pos, _quat, _scl);
    if (rng() < 0.65 && ri < rockCount) {
      rockA.setMatrixAt(ri++, _mat4);
      obstacles.push({ x, z, r: 0.4 * s });
    } else if (rj < rockB.count) {
      rockB.setMatrixAt(rj++, _mat4);
      obstacles.push({ x, z, r: 0.7 * s });
    }
  }
  rockA.count = ri; rockB.count = rj;
  rockA.instanceMatrix.needsUpdate = true;
  rockB.instanceMatrix.needsUpdate = true;
  group.add(rockA); group.add(rockB);

  // ==== GRASS TUFTS (cross-plane, instanced, sway) ====
  const grassGeoA = new THREE.PlaneGeometry(0.4, 0.55).translate(0, 0.275, 0);
  const grassGeoB = new THREE.PlaneGeometry(0.4, 0.55).rotateY(Math.PI / 2).translate(0, 0.275, 0);
  const grassGeo = mergeGeometries([grassGeoA, grassGeoB]);
  const grassMat = makeSwayMaterial(new THREE.Color(0x6c9660).multiply(mood.foliageTint), { swayAmount: 0.18, swayFreq: 2.4, roughness: 1.0 });
  grassMat.side = THREE.DoubleSide;
  swayMaterials.push(grassMat);

  const grassCount = 1600;
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grass.castShadow = false; grass.receiveShadow = false;
  let gi = 0;
  attempts = 0;
  while (gi < grassCount && attempts++ < 10000) {
    const x = (rng() * 2 - 1) * (MAP_HALF - 8);
    const z = (rng() * 2 - 1) * (MAP_HALF - 8);
    if (nearPath(x, z, 0.8)) continue;
    // No grass in stream bed
    const streamZ = -18 + Math.sin(x * 0.08) * 3.5;
    if (Math.abs(z - streamZ) < 1.8 && Math.abs(x) < 60) continue;
    // Slightly favor open areas — check no trunk within 1m
    let ok = true;
    for (let k = 0; k < obstacles.length && ok; k++) {
      if (obstacles[k].r > 0.55) { // only avoid trees, not tiny rocks
        const dx = x - obstacles[k].x, dz = z - obstacles[k].z;
        if (dx * dx + dz * dz < 1.0) ok = false;
      }
    }
    if (!ok) continue;
    const y = sampleHeight(x, z);
    _pos.set(x, y, z);
    _rot.set(0, rng() * Math.PI * 2, 0);
    _quat.setFromEuler(_rot);
    const s = 0.7 + rng() * 0.9;
    _scl.set(s, s * (0.7 + rng() * 0.7), s);
    _mat4.compose(_pos, _quat, _scl);
    grass.setMatrixAt(gi++, _mat4);
  }
  grass.count = gi;
  grass.instanceMatrix.needsUpdate = true;
  group.add(grass);

  // ==== FLOWERS (small colored icosahedrons scattered) ====
  const flowerGeo = new THREE.IcosahedronGeometry(0.09, 0);
  const flowerMats = [
    new THREE.MeshStandardMaterial({ color: 0xf0c8d8, roughness: 0.7, emissive: 0x1a0812, emissiveIntensity: 0.15 }),
    new THREE.MeshStandardMaterial({ color: 0xf4e8a8, roughness: 0.7, emissive: 0x18140a, emissiveIntensity: 0.15 }),
    new THREE.MeshStandardMaterial({ color: 0xc8e0ff, roughness: 0.7, emissive: 0x0a1418, emissiveIntensity: 0.15 }),
  ];
  for (let c = 0; c < flowerMats.length; c++) {
    const im = new THREE.InstancedMesh(flowerGeo, flowerMats[c], 120);
    let count = 0;
    attempts = 0;
    while (count < 120 && attempts++ < 2000) {
      const x = (rng() * 2 - 1) * (MAP_HALF - 10);
      const z = (rng() * 2 - 1) * (MAP_HALF - 10);
      if (nearPath(x, z, 1.5)) continue;
      const y = sampleHeight(x, z) + 0.1;
      _pos.set(x, y, z);
      _rot.set(0, rng() * Math.PI * 2, 0);
      _quat.setFromEuler(_rot);
      _scl.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scl);
      im.setMatrixAt(count++, _mat4);
    }
    im.count = count;
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }

  // ==== HERO PROPS ====

  // Fallen log in Area 2 (visibly blocks a path westward — placeholder for vine puzzle)
  {
    const logGeo = new THREE.CylinderGeometry(0.55, 0.55, 5.5, 8);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x53381f, roughness: 1.0, flatShading: true });
    const log = new THREE.Mesh(logGeo, logMat);
    log.castShadow = true;
    log.receiveShadow = true;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.15;
    const lx = -44, lz = -6;
    log.position.set(lx, sampleHeight(lx, lz) + 0.55, lz);
    group.add(log);
    // Multi-cylinder collision — 3 stubs along its length
    for (let i = -1; i <= 1; i++) {
      obstacles.push({ x: lx + i * 1.6, z: lz + Math.sin(0.15) * i * 1.6, r: 0.55 });
    }
    // A couple of moss-covered rocks alongside
    for (let i = 0; i < 3; i++) {
      const rockGeo = new THREE.IcosahedronGeometry(0.6 + rng() * 0.3, 0);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.castShadow = true; rock.receiveShadow = true;
      const rx = lx - 3 + i * 1.4 + (rng() - 0.5);
      const rz = lz - 1.5 + (rng() - 0.5) * 1.5;
      rock.position.set(rx, sampleHeight(rx, rz), rz);
      rock.scale.setScalar(0.9 + rng() * 0.5);
      group.add(rock);
      obstacles.push({ x: rx, z: rz, r: 0.7 });
    }
  }

  // Standing stones circle in Area 4
  {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b8a83, roughness: 1.0, flatShading: true });
    const cx = AREAS[3].center[0], cz = AREAS[3].center[1];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.3;
      const rr = 7.5 + rng() * 0.6;
      const sx = cx + Math.cos(ang) * rr;
      const sz = cz + Math.sin(ang) * rr;
      const w = 0.7 + rng() * 0.3;
      const d = 0.5 + rng() * 0.25;
      const h = 3.5 + rng() * 1.2;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
      stone.castShadow = true; stone.receiveShadow = true;
      stone.rotation.y = ang + Math.PI / 2 + (rng() - 0.5) * 0.15;
      stone.rotation.z = (rng() - 0.5) * 0.06;
      stone.position.set(sx, sampleHeight(sx, sz) + h / 2 - 0.1, sz);
      group.add(stone);
      obstacles.push({ x: sx, z: sz, r: 0.55 });
    }
    // Giant central tree in Ancient Grove
    const gtTrunkGeo = new THREE.CylinderGeometry(0.9, 1.4, 9, 10).translate(0, 4.5, 0);
    const gtFoliageGeo = new THREE.IcosahedronGeometry(4.2, 1).translate(0, 9.5, 0);
    const gtTrunk = new THREE.Mesh(gtTrunkGeo, trunkMat);
    const gtFoliage = new THREE.Mesh(gtFoliageGeo, foliageMatB);
    const gtGroup = new THREE.Group();
    gtGroup.add(gtTrunk); gtGroup.add(gtFoliage);
    gtGroup.position.set(cx, sampleHeight(cx, cz), cz);
    gtTrunk.castShadow = true; gtFoliage.castShadow = true;
    group.add(gtGroup);
    obstacles.push({ x: cx, z: cz, r: 1.4 });

    // Faint glowing plants scattered around
    const glowGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xa4e0d8, emissive: 0x4fe0c0, emissiveIntensity: 1.4,
      roughness: 0.4, flatShading: true,
    });
    for (let i = 0; i < 24; i++) {
      const ang = rng() * Math.PI * 2;
      const rr = 4 + rng() * 8;
      const gx = cx + Math.cos(ang) * rr;
      const gz = cz + Math.sin(ang) * rr;
      const g = new THREE.Mesh(glowGeo, glowMat);
      g.position.set(gx, sampleHeight(gx, gz) + 0.16, gz);
      g.scale.setScalar(0.7 + rng() * 0.9);
      group.add(g);
    }
  }

  // Massive ancient tree in Area 5 (elevated clearing)
  {
    const cx = AREAS[4].center[0], cz = AREAS[4].center[1];
    const y = sampleHeight(cx, cz);
    const trunkGeoBig = new THREE.CylinderGeometry(1.5, 2.2, 14, 12).translate(0, 7, 0);
    const foliageGeoBig = new THREE.IcosahedronGeometry(6.2, 1).translate(0, 15, 0);
    const trunk = new THREE.Mesh(trunkGeoBig, trunkMat);
    const foliage = new THREE.Mesh(foliageGeoBig, foliageMatA);
    trunk.castShadow = true; foliage.castShadow = true;
    const g = new THREE.Group();
    g.add(trunk); g.add(foliage);
    g.position.set(cx, y, cz);
    group.add(g);
    obstacles.push({ x: cx, z: cz, r: 2.4 });

    // Roots (a few tapered cylinders splaying outward)
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const rl = 3.2;
      const rootGeo = new THREE.CylinderGeometry(0.15, 0.5, rl, 6);
      const root = new THREE.Mesh(rootGeo, trunkMat);
      root.rotation.z = Math.PI / 2 - 0.5;
      root.rotation.y = ang;
      const rx = cx + Math.cos(ang) * 1.8;
      const rz = cz + Math.sin(ang) * 1.8;
      root.position.set(rx, sampleHeight(rx, rz) + 0.3, rz);
      root.castShadow = true;
      group.add(root);
    }
  }

  // Ferns near stream (Area 3) — small dark-green icospheres
  {
    const fernMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.9, flatShading: true });
    const fernGeo = new THREE.IcosahedronGeometry(0.35, 0).scale(1.2, 0.5, 1.2);
    const fernIM = new THREE.InstancedMesh(fernGeo, fernMat, 60);
    let fi = 0;
    for (let attempt = 0; attempt < 400 && fi < 60; attempt++) {
      const x = (rng() * 2 - 1) * 55;
      const streamZ = -18 + Math.sin(x * 0.08) * 3.5;
      const z = streamZ + (rng() * 2 - 1) * 5;
      _pos.set(x, sampleHeight(x, z) + 0.1, z);
      _rot.set(0, rng() * Math.PI * 2, 0);
      _quat.setFromEuler(_rot);
      _scl.set(1 + rng() * 0.4, 1, 1 + rng() * 0.4);
      _mat4.compose(_pos, _quat, _scl);
      fernIM.setMatrixAt(fi++, _mat4);
    }
    fernIM.count = fi;
    fernIM.instanceMatrix.needsUpdate = true;
    fernIM.castShadow = false;
    fernIM.receiveShadow = false;
    group.add(fernIM);
  }

  return { group, obstacles, swayMaterials };
}
