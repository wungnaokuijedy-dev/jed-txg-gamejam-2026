import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '../../game/Game.js';
import { resetMapCache } from '../../game/Map.js';
import {
  MainMenu, PauseMenu, SettingsScreen, ControlsScreen, CreditsScreen,
  MapScreen, ConfirmOverwrite, AutosaveTick, DegradeNotice, MiniMap, TutorialHint,
  DemoHUD, ExitDemoConfirm, DemoTagCard,
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
  const [silenceMood, setSilenceMood] = useState(false);
  const [tutorialText, setTutorialText] = useState(null);
  const [minimapPulse, setMinimapPulse] = useState(0);   // increments to retrigger the CSS animation

  // Demo mode (hidden 2-minute showcase). Never touches player's real save.
  const [demoState, setDemoState] = useState({ active: false, beatIdx: -1, beatCount: 7, label: null, fadeAlpha: 0 });
  const [demoExitConfirm, setDemoExitConfirm] = useState(false);
  const [demoTagCard, setDemoTagCard] = useState(false);   // demo-only closing card
  // Ref pointer to startDemoFlow so the keydown effect can call it without
  // participating in the TDZ (the callback is defined further down the file).
  const startDemoFlowRef = useRef(null);

  // Refs to expose current state to callbacks that only see closure of first mount.
  const screenRef = useRef('loading');
  const pauseMenuRef = useRef(false);
  const overlayRef = useRef(null);
  const choiceOpenRef = useRef(false);
  const endingRef = useRef(null);
  const demoActiveRef = useRef(false);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { pauseMenuRef.current = pauseMenu; }, [pauseMenu]);
  useEffect(() => { overlayRef.current = overlay; }, [overlay]);
  useEffect(() => { choiceOpenRef.current = choiceOpen; }, [choiceOpen]);
  useEffect(() => { demoActiveRef.current = !!demoState.active; }, [demoState.active]);
  useEffect(() => { endingRef.current = ending; }, [ending]);

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
      onPointerLockChange: (locked) => {
        if (cancelled) return;
        // Auto-pause when pointer lock is lost mid-gameplay (typical: user pressed
        // Esc or Alt-Tab'd). Skip if a modal / cinematic-driven UI is already open
        // — those flows drive their own state.
        if (locked) return;
        if (screenRef.current !== 'playing') return;
        if (pauseMenuRef.current) return;
        if (overlayRef.current) return;
        if (choiceOpenRef.current) return;
        if (endingRef.current) return;
        // Demo mode owns Esc → exit-demo confirm. Never auto-pause here.
        if (demoActiveRef.current) return;
        if (gameRef.current) gameRef.current.pause();
        setPauseMenu(true);
      },
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
      onSilenceMood: (on) => { if (!cancelled) setSilenceMood(!!on); },
      onTutorialHint: ({ text }) => { if (!cancelled) setTutorialText(text || null); },
      onMinimapPulse: () => { if (!cancelled) setMinimapPulse((k) => k + 1); },
      onDemoState: (payload) => { if (!cancelled) setDemoState(payload); },
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

      // F9 on the main menu quietly starts the hidden demo mode. Never
      // consumed anywhere else (never visible to normal players).
      if (e.code === 'F9') {
        if (screen === 'menu' && !overlay) {
          e.preventDefault();
          if (startDemoFlowRef.current) startDemoFlowRef.current();
        }
        return;
      }

      // Demo mode key handlers (only while demo is active).
      if (demoState.active) {
        // N — force-advance to the next beat (fade + teleport + state set).
        if (e.code === 'KeyN') {
          e.preventDefault();
          const g = gameRef.current;
          if (g && g.demo) g.demo.forceAdvance();
          return;
        }
        // Esc — open exit-demo confirm (never opens pause menu in demo).
        if (e.code === 'Escape') {
          e.preventDefault();
          if (demoExitConfirm) {
            setDemoExitConfirm(false);
          } else if (choiceOpen || ending) {
            // During choice/ending: let the demo run its outro; ignore Esc.
            return;
          } else {
            setDemoExitConfirm(true);
            try { document.exitPointerLock(); } catch (_) {}
          }
          return;
        }
      }

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

      if (e.code === 'KeyM') {
        e.preventDefault();
        // Map-toggle: allowed only from bare gameplay or when the map itself
        // is the topmost overlay. Never intrudes on pause / choice / ending
        // / other menu overlays.
        if (pauseMenu || choiceOpen || ending) return;
        if (overlay && overlay !== 'map') return;
        if (overlay === 'map') {
          // Close map → try to re-acquire pointer lock (M is a fresh user
          // gesture so Chrome should honour the request).
          setOverlay(null);
          const g = gameRef.current;
          if (g) { try { g.requestPointerLock(); } catch (_) {} }
        } else {
          // Open map: release pointer lock so the cursor is visible for the
          // Close button; also mark the tutorial map-hint done.
          setOverlay('map');
          try { document.exitPointerLock(); } catch (_) {}
          const g = gameRef.current;
          if (g && g.tutorial) g.tutorial.markMapOpened();
        }
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (overlay === 'map') {
          // Esc closes map. Note: Chrome enforces a ~1.25 s cool-down before
          // pointer-lock can be re-acquired after a user-initiated Esc, so we
          // do not try to re-lock here — the click-to-resume path handles it.
          setOverlay(null);
          return;
        }
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
  }, [screen, overlay, pauseMenu, choiceOpen, ending, demoState.active, demoExitConfirm]);

  // Apply CSS classes for text size / high contrast / silence-mood
  useEffect(() => {
    if (!settingsValues) return;
    const root = document.documentElement;
    root.classList.remove('wnl-text-s', 'wnl-text-m', 'wnl-text-l');
    root.classList.add(settingsValues.textSize === 's' ? 'wnl-text-s' :
      settingsValues.textSize === 'l' ? 'wnl-text-l' : 'wnl-text-m');
    root.classList.toggle('wnl-high-contrast', !!settingsValues.highContrast);
  }, [settingsValues]);

  useEffect(() => {
    document.documentElement.classList.toggle('wnl-silence-mood', !!silenceMood);
  }, [silenceMood]);

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

  // ---- Demo Mode (hidden showcase) ----------------------------------------
  const startDemoFlow = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;
    initAudioOnGesture();
    // Force quality preset to High for the recording session (safe: settings
    // store is unchanged by this call — we only touch runtime pixel-ratio /
    // shadows via applyQuality; the persisted setting is not overwritten).
    try { g.applyQuality && g.applyQuality('high'); } catch (_) {}
    g.startDemo();          // resets in-memory state, isolates persistence
    g.exitMenuMode();
    setScreen('playing');
    setPauseMenu(false);
    setOverlay(null);
    setDemoExitConfirm(false);
    // Play the opening cinematic — Beat 1 waits for it to end.
    try { await g.requestPointerLock(); } catch (_) {}
    g.playOpening();
    if (g.audio) g.audio.setMusicMode('exploration');
  }, [initAudioOnGesture]);

  const exitDemo = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.stopDemo();
    g.enterMenuMode();
    setScreen('menu');
    setPauseMenu(false);
    setOverlay(null);
    setChoiceOpen(false);
    setEnding(null);
    setDemoExitConfirm(false);
    setDemoTagCard(false);
    setTutorialText(null);
    // Refresh menu save state — should be untouched from before the demo.
    setHasSave(g.hasSave());
    if (g.audio) g.audio.setMusicMode('exploration');
  }, []);

  // Keep the ref pointer to startDemoFlow up to date so the keydown effect
  // (declared before startDemoFlow) can call it without a TDZ error.
  useEffect(() => { startDemoFlowRef.current = startDemoFlow; }, [startDemoFlow]);

  // Auto-start demo when the URL contains ?demo=1 and the game finishes loading.
  const demoAutoStartedRef = useRef(false);
  useEffect(() => {
    if (demoAutoStartedRef.current) return;
    if (!loaded) return;
    if (screen !== 'menu') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === '1') {
        demoAutoStartedRef.current = true;
        startDemoFlow();
      }
    } catch (_) {}
  }, [loaded, screen, startDemoFlow]);

  // Demo-only closing card: 3 s after the ending resolves, cross-fade to the
  // "Made for TXG Nagaland Game Jam 2026" tag card so the recording has a
  // clean, jam-branded closing frame. Never fires in normal mode.
  useEffect(() => {
    if (!ending) { setDemoTagCard(false); return; }
    if (!demoState.active) return;
    const id = window.setTimeout(() => setDemoTagCard(true), 3000);
    return () => window.clearTimeout(id);
  }, [ending, demoState.active]);

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

  // Map close via the on-screen Close button. The click is a fresh user
  // gesture, so Chrome will honour a pointer-lock re-acquire request.
  // (M-close and Esc-close are handled inline in the keydown effect above.)
  const closeMapButton = useCallback(async () => {
    setOverlay(null);
    const g = gameRef.current;
    if (g && screen === 'playing' && !pauseMenu) {
      try { await g.requestPointerLock(); } catch (_) {}
    }
  }, [screen, pauseMenu]);

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
    // Demo mode: stop the director cleanly and restore the player's REAL
    // save-state flag (which was never touched during the demo).
    const wasDemo = g.isDemoMode && g.isDemoMode();
    if (wasDemo) g.stopDemo();
    setEnding(null);
    setScreen('menu');
    setHasSave(wasDemo ? g.hasSave() : false);
    if (!wasDemo) setEndingsSeen(g.endingsSeen());
    setLetterboxOn(false);
    setHudHidden(false);
    setSilenceMood(false);
    setDemoTagCard(false);      // reset closing tag on return
    resetMapCache();
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

      {/* Mini-map (top-right) — hidden during cinematics, menus, choice, ending */}
      <MiniMap
        game={gameRef.current}
        show={
          screen === 'playing'
          && !pauseMenu
          && !overlay
          && !hudHidden
          && !choiceOpen
          && !ending
          && !!(settingsValues && settingsValues.minimap)
        }
        pulse={minimapPulse}
      />

      {/* Tutorial hint (bottom-center, above prompt slot). Only when playing. */}
      {screen === 'playing' && !pauseMenu && !overlay && !ending && !hudHidden && !choiceOpen && (
        <TutorialHint text={tutorialText} />
      )}

      {/* Demo Mode HUD — beat caption + 7 dots. Only when demo is active. */}
      {demoState.active && screen === 'playing' && (
        <DemoHUD
          beatIdx={demoState.beatIdx}
          beatCount={demoState.beatCount}
          label={demoState.label}
          fadeAlpha={demoState.fadeAlpha}
        />
      )}

      {/* Exit-demo confirmation */}
      {demoExitConfirm && (
        <ExitDemoConfirm onKeep={() => setDemoExitConfirm(false)} onExit={exitDemo} />
      )}

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

      {/* Demo-only closing tag card — appears 3 s after the ending card, as
          the recording's final frame. Never rendered in normal mode. */}
      {ending && demoState.active && demoTagCard && (
        <DemoTagCard onReturn={handleReturnToWoods} />
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
          onMap={() => {
            setOverlay('map');
            if (gameRef.current && gameRef.current.tutorial) gameRef.current.tutorial.markMapOpened();
          }}
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
      {overlay === 'map' && <MapScreen game={gameRef.current} onClose={closeMapButton} />}
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
