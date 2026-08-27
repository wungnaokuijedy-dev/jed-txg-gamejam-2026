// Procedural low-poly female adventurer + hand-rolled animation.
// - No skeletal rigs, no external models. Body parts are Groups so we can rotate
//   them around their pivots (shoulder / hip / knee / elbow).
// - Public API kept stable for CharacterController: root / model / body / headPivot /
//   shoulderL / shoulderR / elbowL / elbowR / hipL / hipR / kneeL / kneeR /
//   updateAnimation(dt, speedNormalized, grounded, movingDirYaw) / triggerSquash(amount) /
//   facingY / position / velocity / grounded.
//
// Design cues:
//   Young adult female explorer, practical (not chibi, not sexualized). Signature
//   feature: long dark ponytail with 4 chained segments simulated as angular springs,
//   so it lags on movement and drifts on wind. Face is deliberately kept as two
//   elongated eye slits + a soft fringe — trying to sculpt anime facial geometry
//   at low-poly is uncanny; suggestion beats detail.
//
//   Rig is structured so future kneel/inspect poses can override joint rotations
//   without changing the mesh layout.
//
// Feet at y = 0; hips pivot at y = 0.95; stature ≈ 1.75m.

import * as THREE from 'three';

// ==== Palette ====
const SKIN         = 0xf2c9a8;
const HAIR         = 0x1f1613;
const HAIR_TIE     = 0x8a3a2a;
const JACKET       = 0xe8dcc0;   // light cream/beige
const JACKET_DARK  = 0xc9b98c;   // sleeves & trim
const JACKET_TRIM  = 0x8a7a58;   // seams & waistband
const SHORTS       = 0x2a2118;   // dark shorts
const BOOT         = 0x1a1108;
const BACKPACK     = 0x6b4a2d;
const STRAP        = 0x3a2a1c;
const GLOVE        = 0x2a2018;
const EYE          = 0x140a06;

function box(w, h, d, color, cast = true) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = cast;
  return m;
}
function sphere(r, color, segs = 12, flat = true, cast = true) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: flat });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, segs, Math.max(6, Math.floor(segs * 0.8))), mat);
  m.castShadow = cast;
  return m;
}
function cyl(rTop, rBot, h, color, radialSegs = 8, cast = true) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, radialSegs, 1), mat);
  m.castShadow = cast;
  return m;
}

export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'explorer';

    this.model = new THREE.Group();
    this.root.add(this.model);

    // Body / hips group (position + squash live here).
    this.body = new THREE.Group();
    this.body.position.y = 0.95;
    this.model.add(this.body);

    // ============================================================
    // TORSO — cream jacket, subtle waist cinch (narrower box + belt)
    // ============================================================
    const torso = box(0.42, 0.58, 0.24, JACKET);
    torso.position.y = 0.04;
    this.body.add(torso);

    // Waist band (darker) — cinches silhouette a touch, reads as female without curves.
    const waist = box(0.44, 0.06, 0.26, JACKET_TRIM);
    waist.position.y = -0.24;
    this.body.add(waist);

    // Jacket seam down the front
    const seam = box(0.018, 0.5, 0.006, JACKET_TRIM);
    seam.position.set(0, 0.04, 0.122);
    this.body.add(seam);

    // Collar (V-shape hint) — two tiny angled boxes at the neck opening
    const collarL = box(0.1, 0.05, 0.02, JACKET_DARK);
    collarL.position.set(-0.06, 0.31, 0.11);
    collarL.rotation.z = 0.5;
    this.body.add(collarL);
    const collarR = collarL.clone();
    collarR.material = collarL.material;
    collarR.position.x = 0.06;
    collarR.rotation.z = -0.5;
    this.body.add(collarR);

    // Hood (down, resting on the back)
    const hood = box(0.38, 0.16, 0.24, JACKET);
    hood.position.set(0, 0.34, -0.14);
    hood.rotation.x = -0.28;
    this.body.add(hood);
    const hoodTrim = box(0.4, 0.03, 0.25, JACKET_TRIM);
    hoodTrim.position.set(0, 0.32, -0.03);
    hoodTrim.rotation.x = -0.28;
    this.body.add(hoodTrim);

    // ============================================================
    // BACKPACK
    // ============================================================
    const pack = box(0.36, 0.44, 0.2, BACKPACK);
    pack.position.set(0, 0.06, -0.22);
    this.body.add(pack);
    // Flap / straps
    const flap = box(0.34, 0.14, 0.03, STRAP);
    flap.position.set(0, 0.25, -0.31);
    this.body.add(flap);
    for (const dx of [-0.16, 0.16]) {
      const s = box(0.06, 0.5, 0.04, STRAP);
      s.position.set(dx, 0.06, -0.01);
      this.body.add(s);
    }

    // ============================================================
    // HEAD + FACE
    // ============================================================
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.5, 0);
    this.body.add(this.headPivot);

    // Head (slightly squashed sphere, skin, smooth so face reads soft)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 14),
      new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.55, flatShading: false })
    );
    head.scale.set(0.98, 1.04, 0.96);
    head.position.y = 0.13;
    head.castShadow = true;
    this.headPivot.add(head);

    // Hair back — larger dark sphere covering the crown + back of head.
    // Offset back slightly so face front stays visible.
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 14, 12),
      new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.9, flatShading: true })
    );
    hairBack.scale.set(1.05, 1.02, 1.15);
    hairBack.position.set(0, 0.145, -0.025);
    hairBack.castShadow = true;
    this.headPivot.add(hairBack);

    // Fringe (bangs) — a short forward-leaning box across the forehead, split
    // into two side chunks so the middle of the forehead peeks through.
    const bangCenter = box(0.16, 0.09, 0.05, HAIR);
    bangCenter.position.set(0, 0.205, 0.11);
    bangCenter.rotation.x = -0.28;
    this.headPivot.add(bangCenter);
    for (const dx of [-0.11, 0.11]) {
      const bangSide = box(0.08, 0.13, 0.06, HAIR);
      bangSide.position.set(dx, 0.18, 0.09);
      bangSide.rotation.x = -0.2;
      bangSide.rotation.z = dx < 0 ? 0.35 : -0.35;
      this.headPivot.add(bangSide);
    }

    // Side face-framing strands running down past the jaw
    for (const dx of [-0.135, 0.135]) {
      const strand = box(0.05, 0.28, 0.07, HAIR);
      strand.position.set(dx, 0.02, 0.03);
      strand.rotation.z = dx < 0 ? 0.12 : -0.12;
      this.headPivot.add(strand);
    }

    // Face features (anime-style suggestion, not detailed geometry).
    // Two dark elongated eye slits + soft brow marks.
    for (const dx of [-0.055, 0.055]) {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.02, 0.006),
        new THREE.MeshBasicMaterial({ color: EYE })
      );
      eye.position.set(dx, 0.135, 0.132);
      eye.rotation.z = dx < 0 ? -0.06 : 0.06;
      this.headPivot.add(eye);
      // Brow (thin dark line above)
      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.008, 0.006),
        new THREE.MeshBasicMaterial({ color: EYE })
      );
      brow.position.set(dx, 0.168, 0.128);
      brow.rotation.z = dx < 0 ? -0.05 : 0.05;
      this.headPivot.add(brow);
    }
    // Subtle blush cheek dots (very small skin-tone bumps darker) — skip for readability
    // Small mouth (a tiny darker line, kept subtle)
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.006, 0.005),
      new THREE.MeshBasicMaterial({ color: 0x8a4a3a })
    );
    mouth.position.set(0, 0.085, 0.135);
    this.headPivot.add(mouth);

    // ============================================================
    // PONYTAIL — chained angular springs
    // ============================================================
    // Base group is attached to the BACK of the head and rests drooping down + back.
    this.ponytailBase = new THREE.Group();
    this.ponytailBase.position.set(0, 0.18, -0.12);
    this.ponytailBase.rotation.x = 0.55; // natural droop backward
    this.headPivot.add(this.ponytailBase);

    // Hair tie ribbon (dark red) at the base
    const tie = box(0.11, 0.06, 0.11, HAIR_TIE);
    tie.position.set(0, -0.02, 0);
    this.ponytailBase.add(tie);

    // Four tapering segments as a nested chain.
    // Each segment rotates around X/Z at its top pivot; child pivots hang at its tip.
    this.ponytailSegments = [];
    const segLens   = [0.22, 0.22, 0.22, 0.22];
    const segRadii  = [[0.058, 0.05], [0.05, 0.042], [0.042, 0.032], [0.032, 0.018]];
    const stiffness = [80, 65, 50, 38];
    const damping   = [6.5, 6.0, 5.5, 5.0];
    const gravBias  = [0.35, 0.4, 0.42, 0.44];   // small extra static droop per segment
    const inertia   = [3.5, 4.5, 5.5, 6.5];      // response-to-velocity factor

    let parentPivot = this.ponytailBase;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      const mesh = cyl(segRadii[i][0], segRadii[i][1], segLens[i], HAIR, 8);
      mesh.position.y = -segLens[i] / 2;
      seg.add(mesh);
      parentPivot.add(seg);
      // Next pivot at the tip of this segment
      const nextPivot = new THREE.Group();
      nextPivot.position.y = -segLens[i];
      seg.add(nextPivot);
      this.ponytailSegments.push({
        group: seg,
        length: segLens[i],
        stiffness: stiffness[i],
        damping: damping[i],
        gravBias: gravBias[i],
        inertia: inertia[i],
        angleX: 0, angleZ: 0,
        velX: 0,   velZ: 0,
      });
      parentPivot = nextPivot;
    }

    // ============================================================
    // ARMS — shoulder groups
    // ============================================================
    this.shoulderL = new THREE.Group();
    this.shoulderR = new THREE.Group();
    this.shoulderL.position.set(-0.27, 0.26, 0);
    this.shoulderR.position.set( 0.27, 0.26, 0);
    this.body.add(this.shoulderL);
    this.body.add(this.shoulderR);

    // Small shoulder caps (cream) that stay attached to the body when arm swings
    for (const dx of [-0.24, 0.24]) {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 8),
        new THREE.MeshStandardMaterial({ color: JACKET, roughness: 0.85, flatShading: true })
      );
      cap.scale.set(1, 0.85, 1);
      cap.position.set(dx, 0.28, 0);
      cap.castShadow = true;
      this.body.add(cap);
    }

    const upperArmL = box(0.11, 0.34, 0.11, JACKET);
    upperArmL.position.y = -0.17;
    this.shoulderL.add(upperArmL);
    const upperArmR = box(0.11, 0.34, 0.11, JACKET);
    upperArmR.position.y = -0.17;
    this.shoulderR.add(upperArmR);

    // Elbows (bent slightly by default in updateAnimation)
    this.elbowL = new THREE.Group(); this.elbowL.position.y = -0.34; this.shoulderL.add(this.elbowL);
    this.elbowR = new THREE.Group(); this.elbowR.position.y = -0.34; this.shoulderR.add(this.elbowR);

    // Forearms in slightly darker jacket-sleeve color
    const forearmL = box(0.1, 0.3, 0.1, JACKET_DARK);
    forearmL.position.y = -0.15;
    this.elbowL.add(forearmL);
    const forearmR = box(0.1, 0.3, 0.1, JACKET_DARK);
    forearmR.position.y = -0.15;
    this.elbowR.add(forearmR);

    // Gloved hands
    const handL = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 8, 8),
      new THREE.MeshStandardMaterial({ color: GLOVE, roughness: 0.85, flatShading: true })
    );
    handL.scale.set(0.9, 1.0, 1.2);
    handL.position.y = -0.32;
    handL.castShadow = true;
    this.elbowL.add(handL);
    const handR = handL.clone(); handR.material = handL.material; this.elbowR.add(handR);

    // ============================================================
    // LEGS — hip groups pivot at (±0.11, 0, 0)
    // ============================================================
    this.hipL = new THREE.Group();
    this.hipR = new THREE.Group();
    this.hipL.position.set(-0.11, -0.3, 0);
    this.hipR.position.set( 0.11, -0.3, 0);
    this.body.add(this.hipL);
    this.body.add(this.hipR);

    // Upper leg (dark shorts)
    const upperLegL = box(0.15, 0.4, 0.16, SHORTS);
    upperLegL.position.y = -0.2;
    this.hipL.add(upperLegL);
    const upperLegR = box(0.15, 0.4, 0.16, SHORTS);
    upperLegR.position.y = -0.2;
    this.hipR.add(upperLegR);

    // Shorts hem (a slightly wider dark trim at bottom of shorts)
    for (const hip of [this.hipL, this.hipR]) {
      const hem = box(0.17, 0.05, 0.17, JACKET_TRIM);
      hem.position.y = -0.38;
      hip.add(hem);
    }

    // Knees
    this.kneeL = new THREE.Group(); this.kneeL.position.y = -0.4; this.hipL.add(this.kneeL);
    this.kneeR = new THREE.Group(); this.kneeR.position.y = -0.4; this.hipR.add(this.kneeR);

    // Lower legs (bare skin, calves)
    const lowerLegL = box(0.12, 0.28, 0.13, SKIN);
    lowerLegL.position.y = -0.14;
    this.kneeL.add(lowerLegL);
    const lowerLegR = box(0.12, 0.28, 0.13, SKIN);
    lowerLegR.position.y = -0.14;
    this.kneeR.add(lowerLegR);

    // Boots — taller than before to cover ankle
    for (const knee of [this.kneeL, this.kneeR]) {
      const boot = box(0.17, 0.16, 0.24, BOOT);
      boot.position.set(0, -0.33, 0.04);
      knee.add(boot);
      const cuff = box(0.19, 0.04, 0.19, JACKET_TRIM);
      cuff.position.set(0, -0.26, 0);
      knee.add(cuff);
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

    this.position = this.root.position;
    this.grounded = true;
    this.velocity = new THREE.Vector3();

    // Rest angles for hair sway restoring force (unused for now — 0 is the rest).
  }

  // dt = seconds since last frame
  // speedNormalized = horizontal speed / runSpeed (approx 0..1+)
  // grounded = bool
  // movingDirYaw = radians (or null) — desired body heading in world space
  updateAnimation(dt, speedNormalized, grounded, movingDirYaw) {
    // ---- Blends ----
    const targetMove = Math.min(1.2, speedNormalized);
    this.moveBlend = THREE.MathUtils.damp(this.moveBlend, targetMove, 8, dt);
    this.airBlend  = THREE.MathUtils.damp(this.airBlend, grounded ? 0 : 1, 10, dt);
    this.squash    = THREE.MathUtils.damp(this.squash, 0, 6, dt);

    // ---- Walk-cycle phase advance ----
    const freq = 6 + this.moveBlend * 4;
    this.phase += dt * freq * Math.max(0.001, this.moveBlend);
    if (!grounded) this.phase *= 0.985;

    // ---- Facing: smooth yaw toward desired heading ----
    this.prevFacingY = this.facingY;
    if (movingDirYaw !== null && movingDirYaw !== undefined) {
      let diff = movingDirYaw - this.facingY;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const step = THREE.MathUtils.clamp(diff, -dt * 12, dt * 12);
      this.facingY += step;
    }
    this.model.rotation.y = this.facingY;

    // ---- Poses ----
    const t = performance.now() * 0.001;
    const idleBob  = Math.sin(t * 1.6) * 0.015;
    const idleSway = Math.sin(t * 0.9) * 0.04;

    const armSwing = 0.35 + this.moveBlend * 0.7;
    const legSwing = 0.45 + this.moveBlend * 0.75;
    const swing    = Math.sin(this.phase);
    const swingCos = Math.cos(this.phase);

    // Body vertical bob / squash
    const walkBob  = Math.abs(Math.sin(this.phase)) * 0.06 * this.moveBlend;
    const scaleY   = 1 - this.squash * 0.25 - this.airBlend * 0.02;
    const scaleXZ  = 1 + this.squash * 0.18;
    this.body.scale.set(scaleXZ, scaleY, scaleXZ);
    this.body.position.y = 0.95 + idleBob * (1 - this.moveBlend) + walkBob;

    // Arms — opposite of legs
    this.shoulderL.rotation.x = swing * armSwing + this.airBlend * -0.6;
    this.shoulderR.rotation.x = -swing * armSwing + this.airBlend * -0.6;
    this.shoulderL.rotation.z = 0.05 + idleSway * (1 - this.moveBlend);
    this.shoulderR.rotation.z = -0.05 - idleSway * (1 - this.moveBlend);
    const elbowBend = 0.2 + this.moveBlend * 0.5;
    this.elbowL.rotation.x = elbowBend;
    this.elbowR.rotation.x = elbowBend;

    // Legs
    this.hipL.rotation.x = -swing * legSwing + this.airBlend * 0.25;
    this.hipR.rotation.x =  swing * legSwing + this.airBlend * 0.4;
    this.kneeL.rotation.x = Math.max(0,  swingCos) * 0.55 * this.moveBlend + this.airBlend * 0.3;
    this.kneeR.rotation.x = Math.max(0, -swingCos) * 0.55 * this.moveBlend + this.airBlend * 0.5;

    // Head — tuck forward in air, gentle idle sway otherwise
    this.headPivot.rotation.x = -0.05 + this.airBlend * 0.2 + Math.sin(t * 1.4) * 0.02 * (1 - this.moveBlend);
    this.headPivot.rotation.z = idleSway * 0.15 * (1 - this.moveBlend);

    // ---- PONYTAIL SIM ----
    this._updatePonytail(dt, t);
  }

  // Angular-spring chain driven by:
  //   - restoring force toward rest (0 rad, base already droops via ponytailBase rotation)
  //   - damping
  //   - character horizontal velocity converted to local space (inertial lag)
  //   - subtle wind noise
  //   - rotational impulse when the model yaws quickly (whip effect)
  _updatePonytail(dt, tNow) {
    if (dt <= 0) return;
    const step = Math.min(dt, 1 / 30);   // cap to avoid instability on hitchy frames

    // Character horizontal velocity in world space
    const wvx = this.velocity.x;
    const wvz = this.velocity.z;
    // Body local space (facingY rotates model, so world -> local: rotate by -facingY)
    const fy = this.facingY;
    const cosY = Math.cos(fy), sinY = Math.sin(fy);
    // World (x, z) into character-local (local +Z = character front).
    const localVX =  wvx * cosY - wvz * sinY;
    const localVZ =  wvx * sinY + wvz * cosY;

    // Rotational impulse from yaw rate
    let yawRate = (this.facingY - this.prevFacingY) / step;
    // wrap
    while (yawRate >  Math.PI / step) yawRate -= (Math.PI * 2) / step;
    while (yawRate < -Math.PI / step) yawRate += (Math.PI * 2) / step;

    // Wind (idle)
    const wnX = Math.sin(tNow * 0.7)  * 0.35 + Math.sin(tNow * 1.9 + 1.2) * 0.15;
    const wnZ = Math.cos(tNow * 0.55) * 0.30 + Math.sin(tNow * 1.5 + 0.4) * 0.18;

    for (let i = 0; i < this.ponytailSegments.length; i++) {
      const s = this.ponytailSegments[i];

      // Target external accelerations:
      //   forward movement (localVZ > 0)  → tail lags backward → +angleX  (rotation.x positive)
      //   rightward movement (localVX > 0) → tail lags leftward → -angleZ (rotation.z negative)
      //   yawRate > 0 (turning left in three.js Y-up right-handed) → tail lags right → +angleZ
      const extX = s.inertia * localVZ * 0.35 + wnX * (0.6 + i * 0.1);
      const extZ = -s.inertia * localVX * 0.35 + yawRate * (0.6 + i * 0.15) + wnZ * (0.5 + i * 0.1);

      // Spring physics: acc = -k*x - c*v + ext
      const accX = -s.stiffness * s.angleX - s.damping * s.velX + extX;
      const accZ = -s.stiffness * s.angleZ - s.damping * s.velZ + extZ;

      s.velX += accX * step;
      s.velZ += accZ * step;
      s.angleX += s.velX * step;
      s.angleZ += s.velZ * step;

      // Clamp to reasonable range so it never breaks the silhouette (~55°)
      const CLAMP = 0.95;
      if (s.angleX >  CLAMP) { s.angleX =  CLAMP; s.velX *= -0.2; }
      if (s.angleX < -CLAMP) { s.angleX = -CLAMP; s.velX *= -0.2; }
      if (s.angleZ >  CLAMP) { s.angleZ =  CLAMP; s.velZ *= -0.2; }
      if (s.angleZ < -CLAMP) { s.angleZ = -CLAMP; s.velZ *= -0.2; }

      // Apply. Note: rotation.x positive => segment tip tilts to -Z (backward on character);
      // rotation.z positive => tip tilts to +X (right of character).
      s.group.rotation.x = s.angleX;
      s.group.rotation.z = s.angleZ;
    }
  }

  triggerSquash(amount = 0.6) { this.squash = Math.max(this.squash, amount); }
}
