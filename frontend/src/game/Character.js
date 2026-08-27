// Procedural low-poly-yet-smooth female adventurer.
// - NO downloaded models. Body is a hierarchy of smooth capsule/lathe/sphere
//   primitives shaded with MeshStandardMaterial (flatShading OFF).
// - The face is painted at runtime onto a CanvasTexture — this is what sells
//   "anime". Getting expressive eyes with geometry alone reads uncanny.
// - Rig public API is stable so CharacterController.js needs no changes:
//     root / model / body / headPivot / shoulderL / shoulderR / elbowL / elbowR /
//     hipL / hipR / kneeL / kneeR / updateAnimation(dt, speedNormalized, grounded, movingDirYaw) /
//     triggerSquash(amount) / facingY / position / velocity / grounded
//
//  Animation improvements over the previous pass:
//    - Stride frequency is proportional to actual horizontal speed
//      (walk stride ~1.35 m, run stride ~1.75 m). Kills foot sliding.
//    - Leg/arm swing AMPLITUDE scales with moveBlend, so legs blend smoothly
//      to a neutral standing pose at rest (no frozen mid-stride).
//    - Body leans slightly into turns (yawRate) and into acceleration.
//    - Small anticipation crouch is triggered by CharacterController on jump takeoff;
//      landing squash on ground impact. Both decay smoothly.
//    - Ponytail 4-segment angular-spring chain with lag + whip + wind.

import * as THREE from 'three';

// ==== Palette ====
const SKIN         = 0xf5cfae;
const SKIN_DARK    = 0xd8a684;
const HAIR         = 0x1e1512;
const HAIR_HL      = 0x3a2a22;
const HAIR_TIE     = 0x8a3a2a;
const JACKET       = 0xf0e3c7;   // light cream
const JACKET_DARK  = 0xc9b98c;   // sleeve trim
const JACKET_TRIM  = 0x8a7a58;
const SHIRT        = 0x6b8c9a;   // teal shirt under jacket
const SHORTS       = 0x2f2620;
const BELT         = 0x4a3a2c;
const BOOT         = 0x22160f;
const BOOT_SOLE    = 0x1a0d08;
const BACKPACK     = 0x6b4a2d;
const STRAP        = 0x3a2a1c;
const GLOVE        = 0x2a2018;

// -------- helpers --------
function stdMat(color, roughness = 0.75, flat = false) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.0, flatShading: flat });
}
function meshFrom(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  return m;
}
function capsule(radius, length, color, radialSegs = 12, capSegs = 6, cast = true) {
  const geo = new THREE.CapsuleGeometry(radius, length, capSegs, radialSegs);
  return meshFrom(geo, stdMat(color), cast);
}
function sphereMesh(radius, color, segs = 16, cast = true) {
  const geo = new THREE.SphereGeometry(radius, segs, Math.max(8, Math.floor(segs * 0.75)));
  return meshFrom(geo, stdMat(color), cast);
}

// -------- Face texture (canvas-painted) --------
function makeFaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base skin — solid so the head has no ugly seams anywhere
  ctx.fillStyle = '#f5cfae';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle skin gradient — slightly darker toward jaw / temples
  const grad = ctx.createRadialGradient(256, 220, 100, 256, 220, 260);
  grad.addColorStop(0, 'rgba(245,207,174,1)');
  grad.addColorStop(1, 'rgba(215,170,132,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Features live in the front-ish U range so seams (at U=0/1 = back of head) stay clean.
  const cx = 256;
  const cy = 250;
  const eyeY = cy + 22;    // eyes slightly below head equator so bangs above don't cover them
  const eyeSpacingX = 60;

  // --- Blush cheeks (soft, painted first so eyes overlay cleanly) ---
  ctx.save();
  ctx.filter = 'blur(6px)';
  for (const dir of [-1, 1]) {
    const cxi = cx + dir * 92;
    const g = ctx.createRadialGradient(cxi, cy + 34, 4, cxi, cy + 34, 32);
    g.addColorStop(0, 'rgba(240,155,150,0.55)');
    g.addColorStop(1, 'rgba(240,155,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cxi, cy + 34, 32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- Eyebrows (thin gentle arches, dark brown) ---
  ctx.strokeStyle = '#241a15';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const dir of [-1, 1]) {
    const ex = cx + dir * eyeSpacingX;
    ctx.beginPath();
    ctx.moveTo(ex - 22, eyeY - 48);
    ctx.quadraticCurveTo(ex, eyeY - 58 - Math.abs(dir) * 2, ex + 22 * dir * 0 + 22, eyeY - 44);
    ctx.stroke();
  }

  // --- Eyes (large anime-style) ---
  for (const dir of [-1, 1]) {
    const ex = cx + dir * eyeSpacingX;

    // Eye whites
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 24, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper lash line (thick black arc)
    ctx.strokeStyle = '#0a0605';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 24, 32, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();

    // Iris (warm brown radial)
    const irisGrad = ctx.createRadialGradient(ex, eyeY, 3, ex, eyeY, 20);
    irisGrad.addColorStop(0, '#4a2f18');
    irisGrad.addColorStop(0.8, '#2a1a0e');
    irisGrad.addColorStop(1, '#150a05');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 2, 18, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#0a0605';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 2, 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bright highlights (this is the anime magic — big + small)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex - 6, eyeY - 8, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ex + 7, eyeY + 12, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lower lash hint (thin)
    ctx.strokeStyle = 'rgba(20,10,8,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 24, 32, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
  }

  // --- Nose hint (very subtle dot shadow) ---
  ctx.fillStyle = 'rgba(180,120,100,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 30, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Mouth (small smile) ---
  ctx.strokeStyle = '#a3453a';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy + 68);
  ctx.quadraticCurveTo(cx, cy + 76, cx + 13, cy + 68);
  ctx.stroke();
  // Lower-lip subtle shade
  ctx.fillStyle = 'rgba(215,140,120,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 73, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// -------- Torso profile (LatheGeometry) --------
function makeTorsoLathe(color) {
  const p = (x, y) => new THREE.Vector2(x, y);
  const pts = [
    p(0.001, -0.32),
    p(0.16,  -0.31),
    p(0.19,  -0.22),   // hip flare
    p(0.185, -0.10),
    p(0.155,  0.02),   // waist cinch
    p(0.180,  0.16),
    p(0.200,  0.28),   // chest widest
    p(0.185,  0.36),
    p(0.140,  0.40),   // shoulder ring
    p(0.085,  0.43),   // neck base
    p(0.001,  0.44),
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.computeVertexNormals();
  const mat = stdMat(color, 0.85, false);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

// -------- Boot: shaft + toe --------
function makeBoot() {
  const g = new THREE.Group();
  // Shaft (cylinder-ish)
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.09, 0.24, 14),
    stdMat(BOOT, 0.8, false)
  );
  shaft.position.y = -0.16;
  shaft.castShadow = true;
  g.add(shaft);

  // Ankle cuff (JACKET_TRIM)
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.088, 0.045, 14),
    stdMat(JACKET_TRIM, 0.85, false)
  );
  cuff.position.y = -0.05;
  cuff.castShadow = true;
  g.add(cuff);

  // Toe (ellipsoid extruding forward)
  const toe = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 10),
    stdMat(BOOT, 0.85, false)
  );
  toe.scale.set(0.85, 0.55, 1.5);
  toe.position.set(0, -0.29, 0.075);
  toe.castShadow = true;
  g.add(toe);

  // Sole (darker thin box)
  const sole = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.03, 0.28),
    stdMat(BOOT_SOLE, 1.0, true)
  );
  sole.position.set(0, -0.325, 0.05);
  sole.castShadow = true;
  g.add(sole);

  return g;
}

// -------- Mitten hand --------
function makeHand() {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    stdMat(GLOVE, 0.85, false)
  );
  palm.scale.set(0.9, 1.1, 1.25);
  palm.castShadow = true;
  g.add(palm);
  // Thumb bump on the side
  const thumb = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 8, 6),
    stdMat(GLOVE, 0.85, false)
  );
  thumb.position.set(0.05, 0.005, 0.03);
  thumb.scale.set(0.7, 1.0, 1.1);
  thumb.castShadow = true;
  g.add(thumb);
  return g;
}

// ============================================================
// Character
// ============================================================
export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'explorer';

    this.model = new THREE.Group();
    this.root.add(this.model);

    // Body pivot at hip height so feet reach y=0
    this.body = new THREE.Group();
    this.body.position.y = 0.95;
    this.model.add(this.body);

    // ============================================================
    // TORSO — cream jacket, subtle female form via lathe
    // ============================================================
    const torso = makeTorsoLathe(JACKET);
    this.body.add(torso);

    // Under-shirt teal collar peeking at the neck (small ring)
    const collarRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.02, 8, 20),
      stdMat(SHIRT, 0.85, false)
    );
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.42;
    this.body.add(collarRing);

    // Front jacket seam (darker vertical line)
    const seam = meshFrom(new THREE.BoxGeometry(0.012, 0.65, 0.008), stdMat(JACKET_TRIM, 1.0, true));
    seam.position.set(0, 0.06, 0.19);
    this.body.add(seam);

    // Belt (darker band at waist)
    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.163, 0.163, 0.05, 20),
      stdMat(BELT, 0.85, false)
    );
    belt.position.y = -0.02;
    belt.castShadow = true;
    this.body.add(belt);
    // Belt buckle
    const buckle = meshFrom(new THREE.BoxGeometry(0.05, 0.04, 0.02), stdMat(JACKET_TRIM, 0.4, false));
    buckle.position.set(0, -0.02, 0.166);
    this.body.add(buckle);

    // Hood (down, on the back — smooth ellipsoid volume)
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 10),
      stdMat(JACKET, 0.85, false)
    );
    hood.scale.set(1.05, 0.75, 1.15);
    hood.position.set(0, 0.33, -0.15);
    hood.castShadow = true;
    this.body.add(hood);
    // Hood trim (darker rim ring)
    const hoodTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.022, 6, 18),
      stdMat(JACKET_TRIM, 0.9, false)
    );
    hoodTrim.rotation.x = Math.PI / 2 - 0.35;
    hoodTrim.position.set(0, 0.4, -0.05);
    this.body.add(hoodTrim);

    // ============================================================
    // BACKPACK — smoother rounded shape
    // ============================================================
    const packBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.44, 0.2),
      stdMat(BACKPACK, 0.85, false)
    );
    packBody.position.set(0, 0.05, -0.24);
    packBody.castShadow = true;
    this.body.add(packBody);

    // Rounded flap top
    const flapTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 10, 8),
      stdMat(BACKPACK, 0.85, false)
    );
    flapTop.scale.set(1.0, 0.4, 0.6);
    flapTop.position.set(0, 0.27, -0.28);
    flapTop.castShadow = true;
    this.body.add(flapTop);
    // Flap face (darker)
    const flap = meshFrom(new THREE.BoxGeometry(0.32, 0.14, 0.03), stdMat(STRAP, 0.85, true));
    flap.position.set(0, 0.24, -0.34);
    this.body.add(flap);
    // Buckle-like small square on flap
    const packBuckle = meshFrom(new THREE.BoxGeometry(0.06, 0.05, 0.02), stdMat(JACKET_TRIM, 0.4, false));
    packBuckle.position.set(0, 0.17, -0.36);
    this.body.add(packBuckle);

    // Straps
    for (const dx of [-0.16, 0.16]) {
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.5, 0.04),
        stdMat(STRAP, 0.9, true)
      );
      s.position.set(dx, 0.06, -0.01);
      s.castShadow = true;
      this.body.add(s);
    }

    // ============================================================
    // HEAD  (smooth sphere + canvas face texture)
    // ============================================================
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.5, 0);
    this.body.add(this.headPivot);

    const faceTex = makeFaceTexture();
    const headMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.0,
      flatShading: false,
    });
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 24, 20),
      headMat
    );
    head.scale.set(0.96, 1.05, 0.96);
    head.position.y = 0.14;
    // Rotate around Y so canvas texture "middle" faces forward (+Z local).
    head.rotation.y = -Math.PI / 2;
    head.castShadow = true;
    this.headPivot.add(head);

    // ---- Hair volume on the skull (dark ellipsoid over back/top) ----
    const skullHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 20, 16),
      stdMat(HAIR, 0.85, false)
    );
    skullHair.scale.set(1.05, 1.02, 1.15);
    skullHair.position.set(0, 0.16, -0.025);
    skullHair.castShadow = true;
    this.headPivot.add(skullHair);

    // Trim of skull hair (small darker cluster on top for highlight)
    const skullHL = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 10),
      stdMat(HAIR_HL, 0.9, false)
    );
    skullHL.scale.set(1.6, 0.6, 1.3);
    skullHL.position.set(0, 0.24, -0.03);
    skullHL.castShadow = true;
    this.headPivot.add(skullHL);

    // ---- Fringe (bangs) ----
    // Positioned high on the forehead + forward on Z so they never occlude the eyes.
    const bangMat = stdMat(HAIR, 0.85, false);
    const bangGeoCenter = new THREE.SphereGeometry(0.11, 12, 10);
    const bangCenter = new THREE.Mesh(bangGeoCenter, bangMat);
    bangCenter.scale.set(1.3, 0.45, 0.55);
    bangCenter.position.set(0, 0.26, 0.11);
    bangCenter.rotation.x = -0.35;
    bangCenter.castShadow = true;
    this.headPivot.add(bangCenter);

    for (const dx of [-0.09, 0.09]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), bangMat);
      b.scale.set(0.7, 1.1, 0.5);
      b.position.set(dx, 0.22, 0.11);
      b.rotation.x = -0.25;
      b.rotation.z = dx < 0 ? 0.4 : -0.4;
      b.castShadow = true;
      this.headPivot.add(b);
    }

    // ---- Side hair strands framing the face ----
    for (const dx of [-0.14, 0.14]) {
      const strand = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.028, 0.24, 4, 8),
        bangMat
      );
      strand.position.set(dx, 0.02, 0.03);
      strand.rotation.z = dx < 0 ? 0.14 : -0.14;
      strand.castShadow = true;
      this.headPivot.add(strand);
    }

    // ============================================================
    // PONYTAIL (4-segment angular-spring chain)
    // ============================================================
    this.ponytailBase = new THREE.Group();
    this.ponytailBase.position.set(0, 0.19, -0.13);
    this.ponytailBase.rotation.x = 0.55;
    this.headPivot.add(this.ponytailBase);

    // Hair tie (small torus, darker red)
    const tie = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.02, 6, 14),
      stdMat(HAIR_TIE, 0.7, false)
    );
    tie.rotation.x = Math.PI / 2;
    tie.position.y = -0.02;
    this.ponytailBase.add(tie);

    this.ponytailSegments = [];
    const segLens   = [0.22, 0.22, 0.22, 0.24];
    const segRadii  = [[0.06, 0.05], [0.05, 0.042], [0.042, 0.032], [0.032, 0.014]];
    const stiffness = [80, 65, 50, 38];
    const damping   = [6.5, 6.0, 5.5, 5.0];
    const inertia   = [3.5, 4.5, 5.5, 6.5];
    let parentPivot = this.ponytailBase;
    const ponyMat = stdMat(HAIR, 0.85, false);
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(segRadii[i][0], segRadii[i][1], segLens[i], 12, 1),
        ponyMat
      );
      mesh.position.y = -segLens[i] / 2;
      mesh.castShadow = true;
      seg.add(mesh);
      parentPivot.add(seg);
      const nextPivot = new THREE.Group();
      nextPivot.position.y = -segLens[i];
      seg.add(nextPivot);
      this.ponytailSegments.push({
        group: seg,
        length: segLens[i],
        stiffness: stiffness[i],
        damping: damping[i],
        inertia: inertia[i],
        angleX: 0, angleZ: 0,
        velX: 0,   velZ: 0,
      });
      parentPivot = nextPivot;
    }

    // ============================================================
    // ARMS
    // ============================================================
    this.shoulderL = new THREE.Group();
    this.shoulderR = new THREE.Group();
    this.shoulderL.position.set(-0.24, 0.32, 0);
    this.shoulderR.position.set( 0.24, 0.32, 0);
    this.body.add(this.shoulderL);
    this.body.add(this.shoulderR);

    // Upper arm (capsule)
    for (const shoulder of [this.shoulderL, this.shoulderR]) {
      const upper = capsule(0.052, 0.28, JACKET, 12, 6);
      upper.position.y = -0.16;
      shoulder.add(upper);
    }
    // Elbow group (bent slightly by default in animation)
    this.elbowL = new THREE.Group(); this.elbowL.position.y = -0.32; this.shoulderL.add(this.elbowL);
    this.elbowR = new THREE.Group(); this.elbowR.position.y = -0.32; this.shoulderR.add(this.elbowR);

    // Forearm (slightly darker jacket cuff)
    for (const elbow of [this.elbowL, this.elbowR]) {
      const forearm = capsule(0.046, 0.24, JACKET_DARK, 12, 6);
      forearm.position.y = -0.14;
      elbow.add(forearm);
    }

    // Hands (mitten-style)
    for (const elbow of [this.elbowL, this.elbowR]) {
      const hand = makeHand();
      hand.position.y = -0.31;
      elbow.add(hand);
    }

    // ============================================================
    // LEGS
    // ============================================================
    this.hipL = new THREE.Group();
    this.hipR = new THREE.Group();
    this.hipL.position.set(-0.10, -0.3, 0);
    this.hipR.position.set( 0.10, -0.3, 0);
    this.body.add(this.hipL);
    this.body.add(this.hipR);

    // Upper leg (shorts) — capsule
    for (const hip of [this.hipL, this.hipR]) {
      const upper = capsule(0.078, 0.32, SHORTS, 12, 6);
      upper.position.y = -0.19;
      hip.add(upper);
    }
    // Shorts hem trim (small darker band)
    for (const hip of [this.hipL, this.hipR]) {
      const hem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.088, 0.09, 0.04, 14),
        stdMat(JACKET_TRIM, 0.9, false)
      );
      hem.position.y = -0.36;
      hip.add(hem);
    }

    // Knees
    this.kneeL = new THREE.Group(); this.kneeL.position.y = -0.4; this.hipL.add(this.kneeL);
    this.kneeR = new THREE.Group(); this.kneeR.position.y = -0.4; this.hipR.add(this.kneeR);

    // Lower leg (bare skin capsule)
    for (const knee of [this.kneeL, this.kneeR]) {
      const lower = capsule(0.058, 0.2, SKIN, 12, 6);
      lower.position.y = -0.14;
      knee.add(lower);
    }
    // Boot
    for (const knee of [this.kneeL, this.kneeR]) {
      const boot = makeBoot();
      boot.position.y = -0.13;
      knee.add(boot);
    }

    // ============================================================
    // ANIM STATE
    // ============================================================
    this.phase = 0;
    this.moveBlend = 0;
    this.airBlend = 0;
    this.squash = 0;

    this.facingY = 0;
    this.prevFacingY = 0;

    // Body-lean state (smoothly damped)
    this.leanX = 0; // pitch — forward lean into acceleration
    this.leanZ = 0; // roll  — into turns

    // Speed history for stride-frequency + lean-into-accel
    this._lastSpeedForAccel = 0;

    // Public physics facing fields
    this.position = this.root.position;
    this.grounded = true;
    this.velocity = new THREE.Vector3();

    // Pose override — Interactables can request a kneel/reach pose.
    this._poseName = null;      // 'kneel' | null
    this._poseT = 0;

    // Precompute local right/forward for ponytail forces
    this._facingRunSpeed = 6.5;   // used for speed normalization heuristics
  }

  // Begin a static pose that overrides walk/idle animation. Currently 'kneel'.
  beginPose(name) {
    this._poseName = name;
    this._poseT = 0;
  }
  endPose() { this._poseName = null; }
  isInPose() { return !!this._poseName; }

  // dt = seconds
  // speedNormalized = horizSpeed / runSpeed
  // grounded = bool
  // movingDirYaw = radians (or null)
  updateAnimation(dt, speedNormalized, grounded, movingDirYaw) {
    // ---- Blends ----
    const targetMove = Math.min(1.2, speedNormalized);
    this.moveBlend = THREE.MathUtils.damp(this.moveBlend, targetMove, 8, dt);
    this.airBlend  = THREE.MathUtils.damp(this.airBlend, grounded ? 0 : 1, 10, dt);
    this.squash    = THREE.MathUtils.damp(this.squash, 0, 6, dt);

    // Actual horizontal speed (for stride)
    const horizSpeed = speedNormalized * this._facingRunSpeed;

    // ---- Stride: frequency proportional to speed. Kills sliding. ----
    // stride length blends between walk (1.35m for full cycle) and run (1.75m).
    const gaitBlend  = THREE.MathUtils.clamp(speedNormalized / 0.7, 0, 1);
    const strideCyc  = THREE.MathUtils.lerp(1.35, 1.75, gaitBlend); // meters per full cycle
    const cyclesPerS = grounded ? Math.max(0.0, horizSpeed / strideCyc) : 0.0;
    this.phase += dt * cyclesPerS * Math.PI * 2;

    // ---- Facing: smooth toward target (max ~12 rad/s) ----
    this.prevFacingY = this.facingY;
    if (movingDirYaw !== null && movingDirYaw !== undefined) {
      let diff = movingDirYaw - this.facingY;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const step = THREE.MathUtils.clamp(diff, -dt * 12, dt * 12);
      this.facingY += step;
    }
    this.model.rotation.y = this.facingY;

    const t = performance.now() * 0.001;
    const idleBob  = Math.sin(t * 1.6) * 0.012;
    const idleSway = Math.sin(t * 0.9) * 0.035;

    // ---- Amplitudes scale with moveBlend so legs blend to neutral at rest ----
    const legSwingAmp = 0.78 * this.moveBlend + 0.05 * this.moveBlend * this.moveBlend;
    const armSwingAmp = 0.68 * this.moveBlend;
    const swing    = Math.sin(this.phase);
    const swingCos = Math.cos(this.phase);

    // Body bob during walk/run
    const walkBob  = Math.abs(Math.sin(this.phase * 2)) * 0.04 * this.moveBlend;
    // Squash + air stretch
    const scaleY   = 1 - this.squash * 0.25 - this.airBlend * 0.03;
    const scaleXZ  = 1 + this.squash * 0.18;
    this.body.scale.set(scaleXZ, scaleY, scaleXZ);
    this.body.position.y = 0.95 + idleBob * (1 - this.moveBlend) + walkBob;

    // ---- Body lean into turns + acceleration ----
    let yawRate = (this.facingY - this.prevFacingY) / Math.max(dt, 1e-4);
    while (yawRate >  Math.PI / dt) yawRate -= (Math.PI * 2) / dt;
    while (yawRate < -Math.PI / dt) yawRate += (Math.PI * 2) / dt;
    const accelRaw = (horizSpeed - this._lastSpeedForAccel) / Math.max(dt, 1e-4);
    this._lastSpeedForAccel = horizSpeed;

    // Damp lean targets
    const leanZTarget = THREE.MathUtils.clamp(-yawRate * 0.06, -0.22, 0.22);
    const leanXTarget = THREE.MathUtils.clamp(accelRaw * 0.02, -0.14, 0.14) * this.moveBlend;
    this.leanZ = THREE.MathUtils.damp(this.leanZ, leanZTarget, 6, dt);
    this.leanX = THREE.MathUtils.damp(this.leanX, leanXTarget, 6, dt);
    this.body.rotation.z = this.leanZ;
    this.body.rotation.x = this.leanX;

    // ---- Arms — opposite of legs, blended to neutral at rest ----
    this.shoulderL.rotation.x =  swing * armSwingAmp + this.airBlend * -0.6;
    this.shoulderR.rotation.x = -swing * armSwingAmp + this.airBlend * -0.6;
    this.shoulderL.rotation.z = 0.05 + idleSway * (1 - this.moveBlend);
    this.shoulderR.rotation.z = -0.05 - idleSway * (1 - this.moveBlend);
    const elbowBend = 0.15 + this.moveBlend * 0.6;
    this.elbowL.rotation.x = elbowBend;
    this.elbowR.rotation.x = elbowBend;

    // ---- Legs — opposite of arms, kills mid-stride freeze at rest ----
    this.hipL.rotation.x = -swing * legSwingAmp + this.airBlend * 0.28;
    this.hipR.rotation.x =  swing * legSwingAmp + this.airBlend * 0.42;
    // Knee bend on back-swing
    this.kneeL.rotation.x = Math.max(0,  swingCos) * 0.55 * this.moveBlend + this.airBlend * 0.35;
    this.kneeR.rotation.x = Math.max(0, -swingCos) * 0.55 * this.moveBlend + this.airBlend * 0.5;

    // ---- Head — tuck slightly in air, gentle idle look ----
    this.headPivot.rotation.x = -0.05 + this.airBlend * 0.22 + Math.sin(t * 1.4) * 0.02 * (1 - this.moveBlend);
    this.headPivot.rotation.z = idleSway * 0.15 * (1 - this.moveBlend) + this.leanZ * -0.35;

    // ---- Pose override (kneel/reach for interactions) ----
    if (this._poseName === 'kneel') {
      this._poseT = Math.min(1, this._poseT + dt * 3.0);   // ~0.33s to fully kneel
      const k = this._poseT;
      // Right leg kneels: hip more forward, knee more bent
      this.hipR.rotation.x = -0.9 * k;
      this.kneeR.rotation.x = 1.6 * k;
      // Left leg supports (slight bend)
      this.hipL.rotation.x = 0.15 * k;
      this.kneeL.rotation.x = 0.75 * k;
      // Body squats down + leans forward
      this.body.position.y = 0.95 - 0.35 * k;
      this.body.rotation.x = 0.25 * k;
      // Arms reach forward
      this.shoulderR.rotation.x = -1.1 * k;
      this.shoulderL.rotation.x = -0.7 * k;
      this.elbowR.rotation.x = 0.9 * k;
      this.elbowL.rotation.x = 0.6 * k;
      // Head slightly down
      this.headPivot.rotation.x = -0.05 + 0.25 * k;
    } else if (this._poseT > 0) {
      // Ease out
      this._poseT = Math.max(0, this._poseT - dt * 3.0);
      // The next updateAnimation call will overwrite these — fine.
    }

    // ---- Ponytail secondary motion ----
    this._updatePonytail(dt, t, yawRate);
  }

  _updatePonytail(dt, tNow, yawRate) {
    if (dt <= 0) return;
    const step = Math.min(dt, 1 / 30);

    // World velocity → character-local (facingY rotates model, so world→local = rotate by -facingY)
    const wvx = this.velocity.x, wvz = this.velocity.z;
    const fy = this.facingY;
    const cosY = Math.cos(fy), sinY = Math.sin(fy);
    const localVX =  wvx * cosY - wvz * sinY;
    const localVZ =  wvx * sinY + wvz * cosY;

    // Idle wind noise
    const wnX = Math.sin(tNow * 0.7)  * 0.35 + Math.sin(tNow * 1.9 + 1.2) * 0.15;
    const wnZ = Math.cos(tNow * 0.55) * 0.30 + Math.sin(tNow * 1.5 + 0.4) * 0.18;

    for (let i = 0; i < this.ponytailSegments.length; i++) {
      const s = this.ponytailSegments[i];
      const extX =  s.inertia * localVZ * 0.35 + wnX * (0.6 + i * 0.1);
      const extZ = -s.inertia * localVX * 0.35 + yawRate * (0.6 + i * 0.15) + wnZ * (0.5 + i * 0.1);

      const accX = -s.stiffness * s.angleX - s.damping * s.velX + extX;
      const accZ = -s.stiffness * s.angleZ - s.damping * s.velZ + extZ;

      s.velX += accX * step;
      s.velZ += accZ * step;
      s.angleX += s.velX * step;
      s.angleZ += s.velZ * step;

      const CLAMP = 0.95;
      if (s.angleX >  CLAMP) { s.angleX =  CLAMP; s.velX *= -0.2; }
      if (s.angleX < -CLAMP) { s.angleX = -CLAMP; s.velX *= -0.2; }
      if (s.angleZ >  CLAMP) { s.angleZ =  CLAMP; s.velZ *= -0.2; }
      if (s.angleZ < -CLAMP) { s.angleZ = -CLAMP; s.velZ *= -0.2; }

      s.group.rotation.x = s.angleX;
      s.group.rotation.z = s.angleZ;
    }
  }

  triggerSquash(amount = 0.6) { this.squash = Math.max(this.squash, amount); }
}
