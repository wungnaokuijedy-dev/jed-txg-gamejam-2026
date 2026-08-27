// Heightmap terrain + area definitions.
// One authoritative sampleHeight(x, z) function used by:
//   - terrain vertex displacement
//   - character ground raycast (fast path)
//   - vegetation placement
//
// Layout in world space (XZ plane):
//   Area 1 "The Entrance"       (0, 15)   flat, tall trees
//   Area 2 "Whispering Woods"   (-30, -5) denser trees + fallen log placeholder
//   Area 3 "The Silent Stream"  stream bed crosses at z ≈ -18 (dry, dark)
//   Area 4 "The Ancient Grove"  (28, -32) standing stones + giant tree
//   Area 5 "The Heart of..."    (0, -60)  elevated clearing, massive ancient tree
//
// Player starts near (0, 0, 22) facing -Z.
//
// All areas are reachable on foot in Phase 1. Placeholders (log/stream/stone-gate)
// are cosmetic — future phases can attach mechanics to them without terrain rework.

import * as THREE from 'three';

export const MAP_SIZE = 180;           // world extent (square, centered on origin)
export const MAP_HALF = MAP_SIZE / 2;
export const TERRAIN_SEGMENTS = 200;   // vertex resolution (200*200 = 40k tris)

export const AREAS = [
  { id: 1, name: 'The Entrance',        center: [0,   22],  radius: 16, color: 0x6b8a70 },
  { id: 2, name: 'Whispering Woods',    center: [-30, -4],  radius: 18, color: 0x556c58 },
  { id: 3, name: 'The Silent Stream',   center: [4,  -22],  radius: 14, color: 0x4a5f5c },
  { id: 4, name: 'The Ancient Grove',   center: [30, -36],  radius: 16, color: 0x5c6a76 },
  { id: 5, name: 'The Heart of the Forest', center: [-4, -62], radius: 14, color: 0x7a8a72 },
];

// Layered noise-y terrain. Cheap deterministic sines — no library needed.
export function sampleHeight(x, z) {
  // Base rolling hills (small amplitude near center, taller at edges to fence player)
  let h = 0;
  h += 0.9 * Math.sin(x * 0.055) * Math.cos(z * 0.055);
  h += 0.55 * Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.09 + 2.3);
  h += 0.22 * Math.sin(x * 0.32 + 4.1) * Math.cos(z * 0.28 + 1.1);

  // Elevate Area 5 (the Heart) so it feels secluded / end-of-path.
  const dx5 = x - AREAS[4].center[0];
  const dz5 = z - AREAS[4].center[1];
  const d5 = Math.sqrt(dx5 * dx5 + dz5 * dz5);
  const heartLift = Math.max(0, 1 - d5 / 24);
  h += heartLift * heartLift * 3.0;

  // Depress the Silent Stream (Area 3) as a shallow dry stream bed
  // running roughly east-west across z ≈ -18, with a gentle S-curve.
  const streamZ = -18 + Math.sin(x * 0.08) * 3.5;
  const streamDist = Math.abs(z - streamZ);
  if (streamDist < 4.5 && Math.abs(x) < 60) {
    const k = 1 - streamDist / 4.5;
    h -= k * k * 1.2;
  }

  // Flatten Area 1 (tutorial ground) slightly for smoother start.
  const dx1 = x - AREAS[0].center[0];
  const dz1 = z - AREAS[0].center[1];
  const d1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);
  if (d1 < 14) {
    const k = 1 - d1 / 14;
    h *= 1 - k * 0.7;
  }

  // Perimeter hills: gently push heights up toward map edges so the player
  // hits a natural rise instead of an invisible wall.
  const rimStart = MAP_HALF - 35;
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > rimStart) {
    const k = (edge - rimStart) / (MAP_HALF - rimStart);
    h += Math.pow(k, 1.8) * 14;
  }

  return h;
}

// Which area contains a given world-space (x, z)?
export function currentAreaName(x, z) {
  let best = null;
  let bestScore = Infinity;
  for (const a of AREAS) {
    const dx = x - a.center[0];
    const dz = z - a.center[1];
    const d = Math.sqrt(dx * dx + dz * dz);
    const score = d - a.radius; // negative if inside
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return best ? best.name : '';
}

export function buildTerrainMesh(mood) {
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const cMoss = new THREE.Color('#5a7a55');
  const cMoss2 = new THREE.Color('#6a8a5a');
  const cEarth = new THREE.Color('#7a6249');
  const cDark = new THREE.Color('#3a4d3a');
  const cStone = new THREE.Color('#8f9a97');
  const cWet = new THREE.Color('#3d4a4a');

  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = sampleHeight(x, z);
    pos.setY(i, y);

    // Base color mix from height + tiny hash noise for variation
    const n = (Math.sin(x * 1.7) * Math.cos(z * 1.9) + Math.sin(x * 0.6 + z * 0.5)) * 0.5 + 0.5;
    tmp.copy(cMoss).lerp(cMoss2, n);

    // Darker under high fog canopy at map edges
    if (y > 2) tmp.lerp(cDark, Math.min(0.6, (y - 2) / 6));
    // Stony peaks
    if (y > 6) tmp.lerp(cStone, Math.min(0.5, (y - 6) / 6));

    // Earth-colored path connecting areas (rough polyline)
    const pathDist = _pathDistance(x, z);
    if (pathDist < 2.2) {
      const k = 1 - pathDist / 2.2;
      tmp.lerp(cEarth, k * 0.85);
    }

    // Stream bed color
    const streamZ = -18 + Math.sin(x * 0.08) * 3.5;
    const sd = Math.abs(z - streamZ);
    if (sd < 3 && Math.abs(x) < 60) {
      tmp.lerp(cWet, (1 - sd / 3) * 0.7);
    }

    // Multiply by mood ground tint
    tmp.multiply(mood.groundTint);

    colors[i * 3 + 0] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// Rough polyline connecting the 5 areas — used to paint the earthy path.
function _pathDistance(x, z) {
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
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = _distPointSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
}

function _distPointSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const c1 = vx * wx + vz * wz;
  if (c1 <= 0) return Math.hypot(px - ax, pz - az);
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) return Math.hypot(px - bx, pz - bz);
  const t = c1 / c2;
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}
