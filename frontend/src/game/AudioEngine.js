// AudioEngine — 100% procedural WebAudio. No external files, no CDNs.
// Bus tree:
//   destination
//     └─ masterGain
//         ├─ musicGain     (evolving pads + occasional pentatonic motifs)
//         ├─ sfxGain       (one-shots: pickups, UI, stones, gate, etc.)
//         └─ ambientGain   (wind + birds + insects + water + rain + footsteps)
//
// AudioContext is created and resumed on the FIRST user gesture.
// External API is intentionally small and safe to call before init() —
// pre-init calls buffer intent as-if and reapply on resume.

const CLAMP01 = (x) => Math.max(0, Math.min(1, x));

// ------------------------------------------------------------------
// Noise buffer helpers
// ------------------------------------------------------------------
function makeWhiteNoiseBuffer(ctx, seconds = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = b.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return b;
}
function makeBrownNoiseBuffer(ctx, seconds = 3) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return b;
}

// ------------------------------------------------------------------
// AudioEngine
// ------------------------------------------------------------------
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this._pending = { master: 0.9, music: 0.4, sfx: 0.9, ambient: 0.8 };

    this._areaName = 'The Entrance';
    this._musicMode = 'exploration';
    this._weatherStage = 'clear';
    this._streamFlowing = false;
    this._healthNorm = 0.5;

    this._musicTimer = 0;      // seconds until next melody note
    this._birdTimer = 3;       // seconds until next bird chirp
    this._insectTimer = 4;

    this._stridePhase = 0;
    this._lastFootIndex = -1;

    this._suspendedByPage = false;

    // Bind page focus handling
    this._onVisibility = () => this._handleVisibility();
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  // Called on the first user gesture (menu button click).
  init() {
    if (this.initialized) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch (e) {
      return false;
    }
    const ctx = this.ctx;

    // Master + buses
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this._pending.master;
    this.masterGain.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this._pending.music;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this._pending.sfx;
    this.sfxGain.connect(this.masterGain);

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = this._pending.ambient;
    this.ambientGain.connect(this.masterGain);

    // Cached noise buffers
    this.whiteBuf = makeWhiteNoiseBuffer(ctx, 2);
    this.brownBuf = makeBrownNoiseBuffer(ctx, 3);

    this._buildAmbience();
    this._buildMusic();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.initialized = true;
    // Re-apply pending gains just in case
    this.setMasterGain(this._pending.master);
    this.setMusicGain(this._pending.music);
    this.setSfxGain(this._pending.sfx);
    this.setAmbientGain(this._pending.ambient);
    // Push current musical/weather/area state
    this.setArea(this._areaName);
    this.setWeather(this._weatherStage);
    this.setStreamFlowing(this._streamFlowing);
    this.setHealthNorm(this._healthNorm);
    this.setMusicMode(this._musicMode);
    return true;
  }

  isInitialized() { return this.initialized; }

  resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  suspend() {
    if (!this.ctx) return;
    if (this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
  _handleVisibility() {
    if (!this.ctx) return;
    if (document.hidden) {
      if (this.ctx.state === 'running') {
        this._suspendedByPage = true;
        this.ctx.suspend().catch(() => {});
      }
    } else if (this._suspendedByPage) {
      this._suspendedByPage = false;
      this.ctx.resume().catch(() => {});
    }
  }

  // ============================================================
  // Bus volumes (persist as pending even before init)
  // ============================================================
  setMasterGain(v) {
    v = CLAMP01(v);
    this._pending.master = v;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
  setMusicGain(v) {
    v = CLAMP01(v);
    this._pending.music = v;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
  setSfxGain(v) {
    v = CLAMP01(v);
    this._pending.sfx = v;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
  setAmbientGain(v) {
    v = CLAMP01(v);
    this._pending.ambient = v;
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
  getBusValue(bus) { return this._pending[bus]; }

  // ============================================================
  // Ambience  (looping noise beds with per-layer target gains)
  // ============================================================
  _buildAmbience() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Master ambient bed subgroup
    this.ambBed = ctx.createGain();
    this.ambBed.gain.value = 1.0;
    this.ambBed.connect(this.ambientGain);

    // --- Wind ---
    this.windSrc = ctx.createBufferSource();
    this.windSrc.buffer = this.brownBuf;
    this.windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 0.7;
    // LFO on windFilter freq for whooshy motion
    this.windLFO = ctx.createOscillator();
    this.windLFOGain = ctx.createGain();
    this.windLFO.frequency.value = 0.13;
    this.windLFOGain.gain.value = 200;
    this.windLFO.connect(this.windLFOGain);
    this.windLFOGain.connect(this.windFilter.frequency);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.22;
    this.windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ambBed);
    this.windSrc.start(now);
    this.windLFO.start(now);

    // --- Insects (high filtered noise, always faint) ---
    this.insectSrc = ctx.createBufferSource();
    this.insectSrc.buffer = this.whiteBuf;
    this.insectSrc.loop = true;
    this.insectFilter = ctx.createBiquadFilter();
    this.insectFilter.type = 'bandpass';
    this.insectFilter.frequency.value = 5800;
    this.insectFilter.Q.value = 6;
    this.insectGain = ctx.createGain();
    this.insectGain.gain.value = 0.04;
    this.insectSrc.connect(this.insectFilter);
    this.insectFilter.connect(this.insectGain);
    this.insectGain.connect(this.ambBed);
    this.insectSrc.start(now);

    // --- Water (post-restoration only) ---
    this.waterSrc = ctx.createBufferSource();
    this.waterSrc.buffer = this.brownBuf;
    this.waterSrc.loop = true;
    this.waterFilter = ctx.createBiquadFilter();
    this.waterFilter.type = 'bandpass';
    this.waterFilter.frequency.value = 900;
    this.waterFilter.Q.value = 1.4;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0.0;
    this.waterSrc.connect(this.waterFilter);
    this.waterFilter.connect(this.waterGain);
    this.waterGain.connect(this.ambBed);
    this.waterSrc.start(now);

    // --- Rain (weather-driven) ---
    this.rainSrc = ctx.createBufferSource();
    this.rainSrc.buffer = this.whiteBuf;
    this.rainSrc.loop = true;
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.value = 4500;
    this.rainFilter.Q.value = 0.4;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.0;
    this.rainSrc.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.ambBed);
    this.rainSrc.start(now);
  }

  setArea(name) {
    this._areaName = name;
    if (!this.initialized) return;
    // Wind slightly louder in Whispering Woods, quieter at Heart, insects denser at Grove.
    const t = this.ctx.currentTime;
    let wind = 0.22, insect = 0.04;
    if (/Whispering/.test(name)) { wind = 0.32; insect = 0.03; }
    else if (/Silent Stream/.test(name)) { wind = 0.16; insect = 0.05; }
    else if (/Ancient Grove/.test(name)) { wind = 0.14; insect = 0.09; }
    else if (/Heart/.test(name)) { wind = 0.12; insect = 0.05; }
    // Scale insect layer with health
    insect *= (0.4 + 0.9 * this._healthNorm);
    this.windGain.gain.setTargetAtTime(wind, t, 1.0);
    this.insectGain.gain.setTargetAtTime(insect, t, 1.0);
  }

  setWeather(stage) {
    this._weatherStage = stage;
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    let rain = 0.0;
    if (stage === 'rain_light') rain = 0.28;
    else if (stage === 'rain_heavy') rain = 0.42;
    else if (stage === 'mist') rain = 0.0;
    else if (stage === 'clearing' || stage === 'break') rain = 0.0;
    this.rainGain.gain.setTargetAtTime(rain, t, 1.2);
  }

  setStreamFlowing(on) {
    this._streamFlowing = !!on;
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    this.waterGain.gain.setTargetAtTime(on ? 0.22 : 0.0, t, 1.2);
  }

  setHealthNorm(h) {
    this._healthNorm = CLAMP01(h);
    if (this.initialized) this.setArea(this._areaName);   // refresh insect scaling
  }

  // ============================================================
  // Music  (evolving pad + occasional pentatonic motifs)
  // ============================================================
  _buildMusic() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Detuned saws → LP → slow LFO on filter → musicGain
    this.padA = ctx.createOscillator();
    this.padA.type = 'sawtooth';
    this.padA.frequency.value = 110;   // A2
    this.padB = ctx.createOscillator();
    this.padB.type = 'sawtooth';
    this.padB.frequency.value = 110 * 1.0025;
    this.padC = ctx.createOscillator();
    this.padC.type = 'sine';
    this.padC.frequency.value = 165;   // fifth
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 800;
    this.padFilter.Q.value = 0.7;
    this.padLFO = ctx.createOscillator();
    this.padLFOGain = ctx.createGain();
    this.padLFO.frequency.value = 0.05;
    this.padLFOGain.gain.value = 500;
    this.padLFO.connect(this.padLFOGain);
    this.padLFOGain.connect(this.padFilter.frequency);

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.10;
    this.padA.connect(this.padFilter);
    this.padB.connect(this.padFilter);
    this.padC.connect(this.padFilter);
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.musicGain);

    // A separate low pad for the Grove mystery layer
    this.padGrove = ctx.createOscillator();
    this.padGrove.type = 'triangle';
    this.padGrove.frequency.value = 82;   // low E
    this.padGroveGain = ctx.createGain();
    this.padGroveGain.gain.value = 0.0;
    this.padGrove.connect(this.padGroveGain);
    this.padGroveGain.connect(this.musicGain);

    this.padA.start(now);
    this.padB.start(now);
    this.padC.start(now);
    this.padGrove.start(now);
    this.padLFO.start(now);
  }

  // Music mode selects target pad blend + optional stinger.
  setMusicMode(mode) {
    this._musicMode = mode;
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    let padVol = 0.10, groveVol = 0.0;
    if (mode === 'exploration') { padVol = 0.10; groveVol = 0.0; }
    else if (mode === 'grove')  { padVol = 0.06; groveVol = 0.08; }
    else if (mode === 'choice') { padVol = 0.03; groveVol = 0.0; this._playSustainedTone(); }
    else if (mode === 'silent') { padVol = 0.0; groveVol = 0.0; }
    else if (mode === 'ending_guardian') { padVol = 0.18; groveVol = 0.0; this._playEndingSwell('major'); }
    else if (mode === 'ending_balance')  { padVol = 0.10; groveVol = 0.03; this._playEndingSwell('suspended'); }
    else if (mode === 'ending_silence')  { padVol = 0.02; groveVol = 0.0; this._playEndingSilence(); }
    this.padGain.gain.setTargetAtTime(padVol, t, 2.0);
    this.padGroveGain.gain.setTargetAtTime(groveVol, t, 2.5);
  }

  _playSustainedTone() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.14, t + 1.5);
    g.gain.setTargetAtTime(0.10, t + 3, 3);
    o.connect(g); g.connect(this.musicGain);
    o.start(t);
    o.stop(t + 30);
  }
  _playEndingSwell(kind) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = kind === 'major' ? [261.63, 329.63, 392.0] : [261.63, 311.13, 349.23];
    for (const f of notes) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.09, t + 2.5);
      g.gain.setTargetAtTime(0.0, t + 12, 5);
      o.connect(g); g.connect(this.musicGain);
      o.start(t);
      o.stop(t + 22);
    }
  }
  _playEndingSilence() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // A few sparse fading notes
    const notes = [220, 196, 174.6];
    for (let i = 0; i < notes.length; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = notes[i];
      const g = ctx.createGain();
      g.gain.value = 0;
      const at = t + i * 3.5;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.05, at + 0.6);
      g.gain.setTargetAtTime(0.0, at + 2.0, 1.8);
      o.connect(g); g.connect(this.musicGain);
      o.start(at);
      o.stop(at + 8);
    }
  }

  // ============================================================
  // Melody sequencer (called from update). Pentatonic on C major.
  // ============================================================
  _stepMelody(dt) {
    if (!this.initialized) return;
    if (this._musicMode === 'silent' || /^ending_/.test(this._musicMode) || this._musicMode === 'choice') return;
    this._musicTimer -= dt;
    if (this._musicTimer > 0) return;
    // Schedule next 3-note motif
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // C-Major pentatonic (C, D, E, G, A)
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00];
    // Choose 2-4 notes, gentle rhythm
    const n = 2 + Math.floor(Math.random() * 3);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.4 ? 1 : 2);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      const at = t + phase;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.06, at + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, at + 1.4);
      o.connect(g); g.connect(this.musicGain);
      o.start(at);
      o.stop(at + 1.6);
      phase += 0.35 + Math.random() * 0.35;
    }
    this._musicTimer = 20 + Math.random() * 12;   // next motif in 20-32s
  }

  _stepBirds(dt) {
    if (!this.initialized) return;
    if (this._weatherStage === 'rain_light' || this._weatherStage === 'rain_heavy') {
      this._birdTimer = 8;
      return;
    }
    this._birdTimer -= dt;
    if (this._birdTimer > 0) return;
    // Density scales with health
    const spacing = 3 + (1 - this._healthNorm) * 8 + Math.random() * 4;
    this._birdTimer = spacing;
    this._chirp();
  }

  _chirp() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const base = 1800 + Math.random() * 1400;
    // Small warble: 2-4 quick notes with random up/down
    const n = 2 + Math.floor(Math.random() * 3);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const g = ctx.createGain();
      const at = t + phase;
      const f = base * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * (0.75 + Math.random() * 0.5), at + 0.12);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.055, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
      o.connect(g); g.connect(this.ambientGain);
      o.start(at);
      o.stop(at + 0.2);
      phase += 0.09 + Math.random() * 0.07;
    }
  }

  // ============================================================
  // Footsteps  (driven by character stride phase)
  // ============================================================
  // Gate: only trigger foot-plants while the character is genuinely moving on
  // the ground. Prior version gated on `moveBlend` alone — which is a damped
  // low-pass of speed with lambda=8 (~0.13 s time constant) — so after the
  // player released movement keys, moveBlend + phase kept advancing for the
  // ~0.2 s velocity-decay window and produced 1-2 trailing footsteps.
  // Now: gate on the ACTUAL horizontal speed (ground truth from physics),
  // AND immediately clear _lastFootIndex when the gate closes so a subsequent
  // phase-index carry-over cannot fire a spurious step on re-enter.
  updateFootsteps(character, sprinting, grounded, dt) {
    if (!this.initialized) return;
    if (!character || !grounded) { this._lastFootIndex = -1; return; }
    const vx = character.velocity ? character.velocity.x : 0;
    const vz = character.velocity ? character.velocity.z : 0;
    const horizSpeed = Math.sqrt(vx * vx + vz * vz);
    const moveBlend = character.moveBlend || 0;
    // Below 0.4 m/s the gait animation is effectively a shuffle-to-stop —
    // audible footsteps would ring falsely. moveBlend > 0.15 additionally
    // rejects the first ~1 frame of any re-acquisition.
    if (horizSpeed < 0.4 || moveBlend < 0.15) {
      this._lastFootIndex = -1;
      return;
    }
    // Foot triggers at cos-phase zero crossings (heel strikes) → 2 per stride
    const phase = character.phase || 0;
    const idx = Math.floor(phase / Math.PI);
    if (idx !== this._lastFootIndex) {
      this._lastFootIndex = idx;
      this._playFoot(sprinting);
    }
  }
  _playFoot(sprinting) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Per-area footstep character. Values chosen for a clear qualitative shift.
    //   Entrance:     crisp leaf crunch — higher bandpass, higher Q
    //   Whispering:   default soft grass
    //   Silent Stream:damp/wet — lowpass, softer amplitude
    //   Grove/Heart:  resonant wood — mid bandpass, longer decay
    let fType = 'bandpass';
    let fFreq = 260 + Math.random() * 80;
    let fQ = 2.2;
    let peak = sprinting ? 0.28 : 0.16;
    let dur = sprinting ? 0.14 : 0.20;
    const name = this._areaName || '';
    if (/Entrance/.test(name)) {
      fType = 'bandpass'; fFreq = 900 + Math.random() * 400; fQ = 5;
      peak = sprinting ? 0.24 : 0.14; dur = sprinting ? 0.12 : 0.17;
    } else if (/Silent Stream/.test(name)) {
      fType = 'lowpass'; fFreq = 220 + Math.random() * 60; fQ = 1.0;
      peak = sprinting ? 0.22 : 0.13; dur = sprinting ? 0.18 : 0.24;
    } else if (/Ancient Grove|Heart/.test(name)) {
      fType = 'bandpass'; fFreq = 360 + Math.random() * 100; fQ = 3.5;
      peak = sprinting ? 0.30 : 0.18; dur = sprinting ? 0.20 : 0.28;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.whiteBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = fType;
    filter.frequency.value = fFreq;
    filter.Q.value = fQ;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.ambientGain);
    src.start(t);
    src.stop(t + 0.35);
  }
  playLanding() {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Low thud: filtered brown noise + sine kick
    const src = ctx.createBufferSource();
    src.buffer = this.brownBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.connect(filter); filter.connect(g); g.connect(this.ambientGain);
    src.start(t); src.stop(t + 0.4);
    // Sine kick
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(og); og.connect(this.ambientGain);
    o.start(t); o.stop(t + 0.22);
  }

  // ============================================================
  // One-shot SFX bank
  // ============================================================
  play(id) {
    if (!this.initialized) return;
    switch (id) {
      case 'seed_pickup':  return this._sfxPluck(880, 0.18, 'sine');
      case 'vine_growth':  return this._sfxSwell(140, 340, 2.2);
      case 'water_release':return this._sfxWhoosh(0.8);
      case 'bird_free':    return this._chirp();
      case 'stone_hum':    return this._sfxHum(140, 3);
      case 'gate_open':    return this._sfxGroan();
      case 'choice_appear':return this._sfxShimmer();
      case 'ui_hover':     return this._sfxTick(1600, 0.03);
      case 'ui_click':     return this._sfxTick(900, 0.06);
      case 'autosave':     return this._sfxTick(1400, 0.05, 0.6);
      case 'temptation':   return this._sfxWilt();
      default: return;
    }
  }
  _sfxPluck(freq, dur, type = 'sine') {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
    // Harmonic sparkle
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);
    o2.connect(g2); g2.connect(this.sfxGain);
    o2.start(t); o2.stop(t + dur);
  }
  _sfxSwell(startF, endF, dur) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(startF, t);
    o.frequency.linearRampToValueAtTime(endF, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.20, t + 0.4);
    g.gain.setTargetAtTime(0.0, t + dur, 0.6);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 2);
    // Airy noise layer
    const src = ctx.createBufferSource();
    src.buffer = this.whiteBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.06, t + 0.6);
    ng.gain.setTargetAtTime(0, t + dur, 0.6);
    src.connect(filter); filter.connect(ng); ng.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 2);
  }
  _sfxWhoosh(dur) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(1500, t + dur);
    filter.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.2);
  }
  _sfxHum(freq, dur) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.linearRampToValueAtTime(freq * 1.4, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.4);
    g.gain.setTargetAtTime(0.0, t + dur * 0.7, 0.8);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 1);
  }
  _sfxGroan() {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.brownBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, t);
    filter.frequency.linearRampToValueAtTime(320, t + 3.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.6);
    g.gain.setTargetAtTime(0.0, t + 3, 0.7);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + 4);
  }
  _sfxShimmer() {
    const ctx = this.ctx, t = ctx.currentTime;
    const freqs = [880, 1320, 1760];
    for (let i = 0; i < freqs.length; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freqs[i];
      const g = ctx.createGain();
      const at = t + i * 0.09;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.09, at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
      o.connect(g); g.connect(this.sfxGain);
      o.start(at); o.stop(at + 0.7);
    }
  }
  _sfxTick(freq, dur, gain = 0.12) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.03);
  }
  _sfxWilt() {
    const ctx = this.ctx, t = ctx.currentTime;
    // Two dissonant sines drooping
    const freqs = [340, 340 * 1.06];
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.10, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      o.connect(g); g.connect(this.sfxGain);
      o.start(t); o.stop(t + 1.6);
    }
  }

  // ============================================================
  // Per-frame update (music/bird sequencers)
  // ============================================================
  update(dt) {
    if (!this.initialized) return;
    this._stepMelody(dt);
    this._stepBirds(dt);
  }

  // For introspection in tests
  debug() {
    if (!this.initialized) return { initialized: false };
    return {
      initialized: true,
      state: this.ctx.state,
      master: this.masterGain.gain.value,
      music: this.musicGain.gain.value,
      sfx: this.sfxGain.gain.value,
      ambient: this.ambientGain.gain.value,
      wind: this.windGain.gain.value,
      insect: this.insectGain.gain.value,
      water: this.waterGain.gain.value,
      rain: this.rainGain.gain.value,
      pad: this.padGain.gain.value,
      grovePad: this.padGroveGain.gain.value,
      musicMode: this._musicMode,
      weather: this._weatherStage,
      area: this._areaName,
      streamFlowing: this._streamFlowing,
      healthNorm: this._healthNorm,
    };
  }

  dispose() {
    document.removeEventListener('visibilitychange', this._onVisibility);
    if (!this.ctx) return;
    try { this.ctx.close(); } catch (_) {}
  }
}
