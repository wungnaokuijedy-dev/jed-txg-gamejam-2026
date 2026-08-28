// Save / Load helpers. Versioned. All reads try/catch so a corrupt save
// can never break boot.

const KEY = 'wnl_save_v1';
const KEY_ENDINGS = 'wnl_endings_seen';
const SCHEMA_VERSION = 1;

export function save(gameState, character, weatherStage) {
  try {
    const p = character.root.position;
    const data = {
      v: SCHEMA_VERSION,
      t: Date.now(),
      health: gameState.health,
      seeds: gameState.seeds,
      flags: gameState.puzzleFlags,
      done: Array.from(gameState.doneInteractions),
      visited: Array.from(gameState.visitedAreas || []),
      objective: gameState.objective,
      moodT: gameState._moodT,
      weatherStage,
      pos: { x: p.x, y: p.y, z: p.z },
      facingY: character.facingY || 0,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== SCHEMA_VERSION) return null;
    return data;
  } catch (e) {
    // Corrupt save — silently discard
    try { localStorage.removeItem(KEY); } catch (_) {}
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}

export function apply(data, gameState, character, weather) {
  if (!data) return false;
  try {
    gameState.health = Math.max(0, Math.min(100, data.health ?? 50));
    gameState.seeds = data.seeds ?? 0;
    gameState.puzzleFlags = { ...gameState.puzzleFlags, ...(data.flags || {}) };
    gameState.doneInteractions = new Set(data.done || []);
    gameState.visitedAreas = new Set(data.visited || []);
    if (data.objective) gameState.objective = data.objective;
    gameState._moodT = data.moodT ?? gameState._healthToMoodT(gameState.health);
    gameState._moodTTarget = gameState._moodT;
    if (data.pos && character) {
      character.root.position.set(data.pos.x, data.pos.y, data.pos.z);
    }
    if (typeof data.facingY === 'number' && character) {
      character.facingY = data.facingY;
      character.model.rotation.y = data.facingY;
    }
    if (weather && data.weatherStage) weather.setStage(data.weatherStage);
    // Fire events so listeners refresh
    gameState.emit('health', { health: gameState.health, delta: 0, reason: 'restore' });
    gameState.emit('seeds', { seeds: gameState.seeds });
    gameState.emit('objective', { objective: gameState.objective });
    return true;
  } catch (e) {
    return false;
  }
}

export function recordEndingSeen(kind) {
  try {
    const raw = localStorage.getItem(KEY_ENDINGS);
    const set = raw ? JSON.parse(raw) : {};
    set[kind] = (set[kind] || 0) + 1;
    localStorage.setItem(KEY_ENDINGS, JSON.stringify(set));
  } catch (_) { /* ignore */ }
}

export function endingsSeen() {
  try {
    const raw = localStorage.getItem(KEY_ENDINGS);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (_) { return false; }
}
