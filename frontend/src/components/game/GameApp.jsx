import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '../../game/Game.js';
import {
  MainMenu, PauseMenu, SettingsScreen, ControlsScreen, CreditsScreen,
  MapScreen, ConfirmOverwrite, AutosaveTick, DegradeNotice,
} from './Menus.jsx';

// ---------- HUD icons ----------
function HealthTierIcon({ tier }) {
  return (
    <svg className="wnl-hud-tree-svg" width="42" height="52" viewBox="0 0 42 52" aria-label="Forest Health">
      <ellipse cx="21" cy="49" rx="14" ry="2" fill="rgba(20,32,20,0.55)" />
      <rect x="19.5" y={tier === 0 ? 40 : tier === 1 ? 32 : 22}
        width="3" height={tier === 0 ? 9 : tier === 1 ? 17 : 27} rx="1.5" fill="#6b4a2f" />
      {tier === 0 && (<>
        <path d="M14,40 Q12,36 18,36 Q20,40 14,40Z" fill="#8fc48f" />
        <path d="M28,40 Q30,36 24,36 Q22,40 28,40Z" fill="#8fc48f" />
        <path d="M18,36 Q21,32 24,36" fill="none" stroke="#8fc48f" strokeWidth="1.4" />
      </>)}
      {tier === 1 && (<>
        <ellipse cx="21" cy="30" rx="7" ry="6" fill="#7bb37b" />
        <ellipse cx="15" cy="34" rx="4" ry="3.5" fill="#6ea86e" />
        <ellipse cx="27" cy="34" rx="4" ry="3.5" fill="#6ea86e" />
        <ellipse cx="21" cy="24" rx="4" ry="3.5" fill="#8fc48f" />
      </>)}
      {tier === 2 && (<>
        <ellipse cx="21" cy="18" rx="14" ry="12" fill="#5a9a5a" />
        <ellipse cx="13" cy="24" rx="7" ry="6" fill="#6ea86e" />
        <ellipse cx="30" cy="22" rx="7" ry="6" fill="#4a8a4a" />
        <ellipse cx="21" cy="10" rx="7" ry="6" fill="#8fc48f" />
        <ellipse cx="21" cy="18" rx="16" ry="14" fill="none" stroke="rgba(180,230,180,0.35)" strokeWidth="1.6" />
      </>)}
    </svg>
  );
}
function SeedIcon() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden>
      <ellipse cx="8" cy="12" rx="5" ry="7" fill="#f5d888" stroke="#8a6a2c" strokeWidth="1" />
      <path d="M8,5 Q10,2 12,4" fill="none" stroke="#5a8a4a" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const CHOICE_OPTIONS = [
  { key: 'take',  label: 'Take',   hint: 'Its light could serve you.',      testid: 'choice-take-btn'  },
  { key: 'leave', label: 'Leave',  hint: 'Let the forest keep its heart.',   testid: 'choice-leave-btn' },
  { key: 'share', label: 'Share',  hint: 'Plant half. Carry half.',          testid: 'choice-share-btn' },
];

// ============================================================
// GameApp — top-level state machine
// ============================================================
// screens:  'loading' | 'menu' | 'playing' | 'ending'
// overlays (over menu OR playing/paused): 'settings' | 'controls' | 'credits' | 'map' | 'confirm-new' | null
// pauseMenu: true|false — only meaningful while screen === 'playing'
export default function GameApp() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [screen, setScreen] = useState('loading');     // 'loading' | 'menu' | 'playing' | 'ending'
  const [overlay, setOverlay] = useState(null);        // 'settings'|'controls'|'credits'|'map'|'confirm-new'|null
  const [pauseMenu, setPauseMenu] = useState(false);   // true while gameplay is paused

  const [debugOn, setDebugOn] = useState(false);
  const [stats, setStats] = useState({ fps: 0, x: 0, y: 0, z: 0, area: '' });
  const [areaBanner, setAreaBanner] = useState('');
  const areaBannerTimerRef = useRef(null);
  const lastAreaRef = useRef('');

  const [gameStateSnap, setGameStateSnap] = useState({
    health: 50, healthTier: 1, seeds: 0, objective: '', prompt: '',
  });
  const [letterboxOn, setLetterboxOn] = useState(false);
  const [seedFlashKey, setSeedFlashKey] = useState(0);
  const [tierFlashKey, setTierFlashKey] = useState(0);
  const prevSeedsRef = useRef(0);
  const prevTierRef = useRef(1);

  const [hasSave, setHasSave] = useState(false);
  const [endingsSeen, setEndingsSeen] = useState({});
  const [hudHidden, setHudHidden] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const subtitleTimerRef = useRef(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [hoveredChoice, setHoveredChoice] = useState(null);
  const [ending, setEnding] = useState(null);
  const [autosaveOn, setAutosaveOn] = useState(false);
  const autosaveTimerRef = useRef(null);
  const [degradeMsg, setDegradeMsg] = useState(null);
  const degradeTimerRef = useRef(null);

  // Settings values snapshot for the UI
  const [settingsValues, setSettingsValues] = useState(null);

  // ============================================================
  // Boot game
  // ============================================================
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const game = new Game(containerRef.current, {
      onLoadingProgress: (p, label) => {
        if (cancelled) return;
        setProgress(p); if (label) setProgressLabel(label);
      },
      onLoaded: () => {
        if (cancelled) return;
        setLoaded(true);
        setScreen('menu');
        setSettingsValues(game.settings.getAll());
      },
      onPointerLockChange: () => { /* no-op — we handle Esc via keydown */ },
      onError: (e) => { if (!cancelled) setErrorMsg(e && e.message ? e.message : 'WebGL error'); },
      onStats: (s) => {
        if (cancelled) return;
        setStats(s);
        if (s.area && s.area !== lastAreaRef.current) {
          lastAreaRef.current = s.area;
          setAreaBanner(s.area);
          if (areaBannerTimerRef.current) clearTimeout(areaBannerTimerRef.current);
          areaBannerTimerRef.current = setTimeout(() => setAreaBanner(''), 3200);
        }
      },
      onGameStateChange: (snap) => {
        if (cancelled) return;
        setGameStateSnap(snap);
        if (snap.seeds > prevSeedsRef.current) setSeedFlashKey((k) => k + 1);
        prevSeedsRef.current = snap.seeds;
        if (snap.healthTier !== prevTierRef.current) setTierFlashKey((k) => k + 1);
        prevTierRef.current = snap.healthTier;
      },
      onLetterbox: (on) => { if (!cancelled) setLetterboxOn(!!on); },
      onSaveState: ({ hasSave: hs, endingsSeen: es }) => {
        if (cancelled) return;
        setHasSave(!!hs);
        setEndingsSeen(es || {});
      },
      onHudHide: (on) => { if (!cancelled) setHudHidden(!!on); },
      onSubtitle: ({ text, duration }) => {
        if (cancelled) return;
        if (subtitleTimerRef.current) { clearTimeout(subtitleTimerRef.current); subtitleTimerRef.current = null; }
        setSubtitle(text || '');
        if (text && duration && duration > 0) {
          subtitleTimerRef.current = setTimeout(() => setSubtitle(''), duration * 1000);
        }
      },
      onChoiceOpen: () => { if (!cancelled) { setChoiceOpen(true); setHoveredChoice(null); } },
      onChoiceClose: () => { if (!cancelled) setChoiceOpen(false); },
      onEnding: ({ kind, message, choice }) => {
        if (cancelled) return;
        setEnding({ kind, message, choice });
        setScreen('ending');
      },
      onAutosave: () => {
        if (cancelled) return;
        setAutosaveOn(true);
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => setAutosaveOn(false), 1400);
      },
      onDegrade: ({ preset }) => {
        if (cancelled) return;
        setDegradeMsg(preset);
        if (settingsValues) setSettingsValues((v) => ({ ...v, quality: preset }));
        if (degradeTimerRef.current) clearTimeout(degradeTimerRef.current);
        degradeTimerRef.current = setTimeout(() => setDegradeMsg(null), 3500);
      },
      onPauseChange: () => { /* React drives pause via state; no callback needed */ },
    });
    gameRef.current = game;

    game.load().then(() => {
      if (cancelled) return;
      game.start();
      try { window.__wnl = game; } catch (_) {}
    }).catch((e) => {
      if (!cancelled) setErrorMsg(e && e.message ? e.message : 'Failed to load');
    });

    return () => {
      cancelled = true;
      if (areaBannerTimerRef.current) clearTimeout(areaBannerTimerRef.current);
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (degradeTimerRef.current) clearTimeout(degradeTimerRef.current);
      try { game.dispose(); } catch (_) {}
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Global key handlers
  // ============================================================
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'F3') { e.preventDefault(); setDebugOn((v) => !v); return; }
      // Choice UI shortcuts
      if (choiceOpen) {
        let choice = null;
        if (e.code === 'Digit1' || e.code === 'Numpad1') choice = 'take';
        else if (e.code === 'Digit2' || e.code === 'Numpad2') choice = 'leave';
        else if (e.code === 'Digit3' || e.code === 'Numpad3') choice = 'share';
        if (choice) { e.preventDefault(); commitChoice(choice); }
        return;
      }
      if (screen !== 'playing') return;

      if (e.code === 'KeyM' && !overlay) {
        e.preventDefault();
        if (pauseMenu) return;
        setOverlay('map');
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (overlay === 'map') { setOverlay(null); return; }
        if (overlay === 'settings' || overlay === 'controls' || overlay === 'credits' || overlay === 'confirm-new') {
          setOverlay(null); return;
        }
        // Toggle pause menu
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, overlay, pauseMenu, choiceOpen]);

  // Apply CSS classes for text size / high contrast from settings
  useEffect(() => {
    if (!settingsValues) return;
    const root = document.documentElement;
    root.classList.remove('wnl-text-s', 'wnl-text-m', 'wnl-text-l');
    root.classList.add(settingsValues.textSize === 's' ? 'wnl-text-s' :
      settingsValues.textSize === 'l' ? 'wnl-text-l' : 'wnl-text-m');
    root.classList.toggle('wnl-high-contrast', !!settingsValues.highContrast);
  }, [settingsValues]);

  // ============================================================
  // Commands (buttons)
  // ============================================================
  const initAudioOnGesture = useCallback(() => {
    if (gameRef.current) gameRef.current.initAudio();
  }, []);

  const startPlaying = useCallback(async (mode) => {
    const g = gameRef.current;
    if (!g) return;
    initAudioOnGesture();
    if (mode === 'continue') {
      g.applyLoadedSave();
    } else {
      g.newGame();
    }
    g.exitMenuMode();
    setScreen('playing');
    setPauseMenu(false);
    setOverlay(null);
    try { await g.requestPointerLock(); } catch (_) {}
    if (mode !== 'continue') g.playOpening();
    if (g.audio) g.audio.setMusicMode('exploration');
  }, [initAudioOnGesture]);

  const onMenuContinue = useCallback(() => {
    initAudioOnGesture();
    startPlaying('continue');
  }, [startPlaying, initAudioOnGesture]);

  const onMenuNewGame = useCallback(() => {
    initAudioOnGesture();
    if (hasSave) {
      setOverlay('confirm-new');
    } else {
      startPlaying('new');
    }
  }, [hasSave, startPlaying, initAudioOnGesture]);

  const confirmNewGame = useCallback(() => {
    setOverlay(null);
    startPlaying('new');
  }, [startPlaying]);

  const cancelNewGame = useCallback(() => setOverlay(null), []);

  const goSettings = useCallback(() => {
    initAudioOnGesture();
    if (gameRef.current) setSettingsValues(gameRef.current.settings.getAll());
    setOverlay('settings');
  }, [initAudioOnGesture]);
  const goControls = useCallback(() => { initAudioOnGesture(); setOverlay('controls'); }, [initAudioOnGesture]);
  const goCredits  = useCallback(() => { initAudioOnGesture(); setOverlay('credits'); }, [initAudioOnGesture]);
  const backToRoot = useCallback(() => setOverlay(null), []);

  const togglePause = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;
    if (pauseMenu) {
      // Resume
      setPauseMenu(false);
      g.resume();
      try { await g.requestPointerLock(); } catch (_) {}
    } else {
      // Pause
      g.pause();
      setPauseMenu(true);
      try { document.exitPointerLock(); } catch (_) {}
    }
  }, [pauseMenu]);

  const pauseResume = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;
    setPauseMenu(false);
    g.resume();
    try { await g.requestPointerLock(); } catch (_) {}
  }, []);

  const pauseRestartArea = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;
    g.restartArea();
    setPauseMenu(false);
    g.resume();
    try { await g.requestPointerLock(); } catch (_) {}
  }, []);

  const pauseMainMenu = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    // Autosave first (only if no ending)
    if (g.gameState && !g.gameState.endingResolved) g.saveNow();
    // Return to menu mode
    g.enterMenuMode();
    g.resume();   // ensure loop is running
    setPauseMenu(false);
    setOverlay(null);
    setScreen('menu');
    setHasSave(g.hasSave());
    if (g.audio) g.audio.setMusicMode('exploration');
  }, []);

  const commitChoice = useCallback((choice) => {
    if (gameRef.current) gameRef.current.resolveFinalChoice(choice);
  }, []);

  const handleReturnToWoods = useCallback(() => {
    // Return to main menu (no reload — smoother). Clears ending state.
    const g = gameRef.current;
    if (!g) return;
    setEnding(null);
    setScreen('menu');
    setHasSave(false);
    setEndingsSeen(g.endingsSeen());
    setLetterboxOn(false);
    setHudHidden(false);
    g.enterMenuMode();
    if (g.audio) g.audio.setMusicMode('exploration');
  }, []);

  const changeSetting = useCallback((patch) => {
    const g = gameRef.current;
    if (!g) return;
    g.settings.set(patch);
    setSettingsValues(g.settings.getAll());
  }, []);

  // ============================================================
  // Render
  // ============================================================
  const showLoadingScreen = screen === 'loading' && !errorMsg;
  const inGameHudVisible = screen === 'playing' && !pauseMenu && !hudHidden && !ending && !overlay;
  const endingLabel = ending
    ? (ending.kind === 'guardian' ? 'The Guardian' : ending.kind === 'balance' ? 'The Balance' : 'The Silence')
    : '';

  return (
    <div className="wnl-root">
      <div ref={containerRef} className="wnl-canvas-container" data-testid="game-container" />
      <div className="wnl-vignette" aria-hidden />

      {areaBanner && screen === 'playing' && !pauseMenu && !hudHidden && !choiceOpen && !ending ? (
        <div className="wnl-area-banner" data-testid="area-banner">
          <div className="wnl-area-banner-inner">
            <span className="wnl-area-banner-caret">—</span>
            <span className="wnl-area-banner-text">{areaBanner}</span>
            <span className="wnl-area-banner-caret">—</span>
          </div>
        </div>
      ) : null}

      {/* HUD */}
      {inGameHudVisible && (
        <>
          <div className="wnl-hud-health" data-testid="health-hud">
            <HealthTierIcon key={tierFlashKey} tier={gameStateSnap.healthTier} />
          </div>
          {gameStateSnap.seeds > 0 && (
            <div className="wnl-hud-seeds" data-testid="seeds-hud" key={seedFlashKey}>
              <SeedIcon />
              <span className="wnl-hud-seeds-num">{gameStateSnap.seeds}</span>
            </div>
          )}
          {gameStateSnap.objective && (
            <div className="wnl-hud-objective" data-testid="objective-hud" key={gameStateSnap.objective}>
              {gameStateSnap.objective}
            </div>
          )}
          {gameStateSnap.prompt && !choiceOpen && (
            <div className="wnl-hud-prompt" data-testid="prompt-hud">
              {settingsValues && !settingsValues.showHints ? (
                <span className="wnl-hud-prompt-dot" aria-hidden />
              ) : gameStateSnap.prompt}
            </div>
          )}
        </>
      )}

      {letterboxOn && (
        <>
          <div className="wnl-letterbox wnl-letterbox-top" data-testid="letterbox-top" />
          <div className="wnl-letterbox wnl-letterbox-bottom" data-testid="letterbox-bottom" />
        </>
      )}

      {subtitle && settingsValues && settingsValues.subtitles && (
        <div className="wnl-subtitle" data-testid="subtitle-overlay" key={subtitle}>{subtitle}</div>
      )}

      {hudHidden && !choiceOpen && !ending && screen === 'playing' && !pauseMenu && (
        <div className="wnl-skip-hint" data-testid="skip-hint" aria-hidden><kbd>E</kbd> skip</div>
      )}

      {/* Autosave leaf tick */}
      <AutosaveTick show={autosaveOn && screen === 'playing' && !ending} />

      {/* Degrade notice */}
      {degradeMsg && <DegradeNotice preset={degradeMsg} />}

      {/* Choice */}
      {choiceOpen && (
        <div className="wnl-choice" data-testid="choice-overlay">
          <div className="wnl-choice-title">The Heartseed rests before you.</div>
          <div className="wnl-choice-hint" data-testid="choice-hint">
            {hoveredChoice
              ? (CHOICE_OPTIONS.find((c) => c.key === hoveredChoice) || {}).hint
              : 'Choose. The forest will remember.'}
          </div>
          <div className="wnl-choice-row">
            {CHOICE_OPTIONS.map((opt, idx) => (
              <button key={opt.key} className="wnl-choice-btn" data-testid={opt.testid}
                onMouseEnter={() => setHoveredChoice(opt.key)}
                onMouseLeave={() => setHoveredChoice((k) => (k === opt.key ? null : k))}
                onFocus={() => setHoveredChoice(opt.key)}
                onBlur={() => setHoveredChoice((k) => (k === opt.key ? null : k))}
                onClick={() => commitChoice(opt.key)}>
                <span className="wnl-choice-num">{idx + 1}</span>
                <span className="wnl-choice-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ending card */}
      {ending && (
        <div className="wnl-end-card" data-testid="ending-card">
          <div className="wnl-end-kind" data-testid={`ending-kind-${ending.kind}`}>{endingLabel}</div>
          <div className="wnl-end-message">{ending.message}</div>
          <button className="wnl-play-btn" data-testid="ending-return-btn" onClick={handleReturnToWoods}>
            Return to the Woods
          </button>
        </div>
      )}

      {/* Loading screen */}
      {showLoadingScreen && (
        <div className="wnl-overlay wnl-loading" data-testid="loading-screen">
          <div className="wnl-loading-title">
            <span className="wnl-title-line1">WHERE</span>
            <span className="wnl-title-line2">NATURE</span>
            <span className="wnl-title-line3">LEADS</span>
          </div>
          <div className="wnl-loading-bar" data-testid="loading-bar">
            <div className="wnl-loading-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} data-testid="loading-bar-fill" />
          </div>
          <div className="wnl-loading-label" data-testid="loading-label">
            {progressLabel || 'Loading'}<span className="wnl-loading-dots"><i/><i/><i/></span>
          </div>
        </div>
      )}

      {/* Main Menu */}
      {screen === 'menu' && !overlay && (
        <MainMenu
          hasSave={hasSave}
          endingsSeen={endingsSeen}
          onContinue={onMenuContinue}
          onNewGame={onMenuNewGame}
          onSettings={goSettings}
          onControls={goControls}
          onCredits={goCredits}
        />
      )}

      {/* Pause Menu (over playing) */}
      {screen === 'playing' && pauseMenu && !overlay && (
        <PauseMenu
          onResume={pauseResume}
          onMap={() => setOverlay('map')}
          onSettings={goSettings}
          onRestartArea={pauseRestartArea}
          onMainMenu={pauseMainMenu}
        />
      )}

      {/* Overlays (from menu OR pause) */}
      {overlay === 'settings' && settingsValues && (
        <SettingsScreen values={settingsValues} onChange={changeSetting} onBack={backToRoot} />
      )}
      {overlay === 'controls' && <ControlsScreen onBack={backToRoot} />}
      {overlay === 'credits' && <CreditsScreen onBack={backToRoot} />}
      {overlay === 'map' && <MapScreen game={gameRef.current} onClose={backToRoot} />}
      {overlay === 'confirm-new' && <ConfirmOverwrite onCancel={cancelNewGame} onConfirm={confirmNewGame} />}

      {/* Error */}
      {errorMsg && (
        <div className="wnl-overlay wnl-error" data-testid="error-overlay">
          <div className="wnl-pause-panel">
            <div className="wnl-pause-heading">Something went wrong</div>
            <p className="wnl-pause-hint">{errorMsg}</p>
            <button className="wnl-play-btn" onClick={() => window.location.reload()} data-testid="reload-btn">
              Reload
            </button>
          </div>
        </div>
      )}

      {/* Debug HUD */}
      {debugOn && (
        <div className="wnl-debug" data-testid="debug-hud">
          <div><b>FPS</b> {stats.fps.toFixed(1)}</div>
          <div><b>Area</b> {stats.area || '—'}</div>
          <div><b>Pos</b> {stats.x.toFixed(1)}, {stats.y.toFixed(1)}, {stats.z.toFixed(1)}</div>
          <div className="wnl-debug-hint">F3 to hide</div>
        </div>
      )}
    </div>
  );
}
