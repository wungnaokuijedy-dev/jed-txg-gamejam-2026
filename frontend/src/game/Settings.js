// Settings — a tiny persistent store + reactive applier.
// Persisted in localStorage under `wnl_settings_v1`.
// Every write immediately calls `_apply()` so live change works from any UI.

const KEY = 'wnl_settings_v1';

export const DEFAULT_SETTINGS = {
  // Audio (0..1)
  masterVol: 0.9,
  musicVol: 0.4,
  sfxVol: 0.9,
  ambientVol: 0.8,
  // Gameplay
  mouseSensitivity: 1.0,   // multiplier around 0.25..2.5
  invertY: false,
  showHints: true,          // interaction prompt text visible?
  subtitles: true,
  // Graphics
  quality: 'high',          // 'low' | 'medium' | 'high'
  // Accessibility
  textSize: 'medium',       // 's' | 'medium' | 'l'
  screenShake: true,        // kills sway if false
  highContrast: false,
  // HUD
  minimap: true,            // mini-map top-right, default on
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (_) { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
}

// A tiny store with subscribe + set semantics. Instances hold a game
// reference so writes can immediately apply values to the game engine.
export class SettingsStore {
  constructor(game) {
    this.game = game;
    this.values = loadSettings();
    this._listeners = new Set();
  }
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  get(key) { return this.values[key]; }
  getAll() { return { ...this.values }; }
  set(patch) {
    this.values = { ...this.values, ...patch };
    saveSettings(this.values);
    this._apply(patch);
    for (const fn of this._listeners) { try { fn(this.values); } catch (e) {} }
  }
  applyAll() { this._apply(this.values); }

  // Push a patch of values into the game / audio / camera etc.
  _apply(patch) {
    const g = this.game;
    if (!g) return;
    // -------- Audio --------
    if (g.audio) {
      if ('masterVol'  in patch) g.audio.setMasterGain(patch.masterVol);
      if ('musicVol'   in patch) g.audio.setMusicGain(patch.musicVol);
      if ('sfxVol'     in patch) g.audio.setSfxGain(patch.sfxVol);
      if ('ambientVol' in patch) g.audio.setAmbientGain(patch.ambientVol);
    }
    // -------- Camera --------
    if (g.camCtrl) {
      if ('mouseSensitivity' in patch) {
        const base = 0.0025;
        g.camCtrl.sensitivity = base * patch.mouseSensitivity;
      }
      if ('invertY' in patch) g.camCtrl.invertY = !!patch.invertY;
      if ('screenShake' in patch) g.camCtrl.screenShake = !!patch.screenShake;
    }
    // -------- Graphics quality --------
    if ('quality' in patch && g.applyQuality) g.applyQuality(patch.quality);
    // -------- Text size / contrast are handled by React via CSS classes --------
    // Handled in GameApp effect
  }
}
