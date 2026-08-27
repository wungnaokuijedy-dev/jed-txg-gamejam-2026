import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '../../game/Game.js';

// Organic Forest Health icon that morphs sprout → sapling → young tree.
function HealthTierIcon({ tier }) {
  // 0 = sprout, 1 = sapling, 2 = young tree
  return (
    <svg className="wnl-hud-tree-svg" width="42" height="52" viewBox="0 0 42 52" aria-label="Forest Health">
      <ellipse cx="21" cy="49" rx="14" ry="2" fill="rgba(20,32,20,0.55)" />
      <rect
        x="19.5" y={tier === 0 ? 40 : tier === 1 ? 32 : 22}
        width="3" height={tier === 0 ? 9 : tier === 1 ? 17 : 27}
        rx="1.5"
        fill="#6b4a2f"
      />
      {tier === 0 && (
        <>
          <path d="M14,40 Q12,36 18,36 Q20,40 14,40Z" fill="#8fc48f" />
          <path d="M28,40 Q30,36 24,36 Q22,40 28,40Z" fill="#8fc48f" />
          <path d="M18,36 Q21,32 24,36" fill="none" stroke="#8fc48f" strokeWidth="1.4" />
        </>
      )}
      {tier === 1 && (
        <>
          <ellipse cx="21" cy="30" rx="7" ry="6" fill="#7bb37b" />
          <ellipse cx="15" cy="34" rx="4" ry="3.5" fill="#6ea86e" />
          <ellipse cx="27" cy="34" rx="4" ry="3.5" fill="#6ea86e" />
          <ellipse cx="21" cy="24" rx="4" ry="3.5" fill="#8fc48f" />
        </>
      )}
      {tier === 2 && (
        <>
          <ellipse cx="21" cy="18" rx="14" ry="12" fill="#5a9a5a" />
          <ellipse cx="13" cy="24" rx="7" ry="6" fill="#6ea86e" />
          <ellipse cx="30" cy="22" rx="7" ry="6" fill="#4a8a4a" />
          <ellipse cx="21" cy="10" rx="7" ry="6" fill="#8fc48f" />
          <ellipse cx="21" cy="18" rx="16" ry="14" fill="none" stroke="rgba(180,230,180,0.35)" strokeWidth="1.6" />
        </>
      )}
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

// Choice option definitions (buttons + poetic consequence hint on hover/focus).
const CHOICE_OPTIONS = [
  { key: 'take',  label: 'Take',   hint: 'Its light could serve you.',           testid: 'choice-take-btn'  },
  { key: 'leave', label: 'Leave',  hint: 'Let the forest keep its heart.',        testid: 'choice-leave-btn' },
  { key: 'share', label: 'Share',  hint: 'Plant half. Carry half.',               testid: 'choice-share-btn' },
];

// Full-screen game shell. Handles:
//   - loading screen with progress
//   - click-to-play gate (also satisfies future audio autoplay policy)
//   - paused overlay (when pointer lock is lost)
//   - debug HUD (F3)
//   - area-name toast when the player enters a new area
//   - Phase 3: subtitles, final choice UI, end card, save/continue

export default function GameApp() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [everLocked, setEverLocked] = useState(false);
  const [debugOn, setDebugOn] = useState(false);
  const [stats, setStats] = useState({ fps: 0, x: 0, y: 0, z: 0, area: '' });
  const [areaBanner, setAreaBanner] = useState('');
  const areaBannerTimerRef = useRef(null);
  const lastAreaRef = useRef('');

  // Phase 2 HUD state
  const [gameStateSnap, setGameStateSnap] = useState({
    health: 50, healthTier: 1, seeds: 0, objective: '', prompt: '',
  });
  const [letterboxOn, setLetterboxOn] = useState(false);
  const [seedFlashKey, setSeedFlashKey] = useState(0);
  const [tierFlashKey, setTierFlashKey] = useState(0);
  const prevSeedsRef = useRef(0);
  const prevTierRef = useRef(1);

  // Phase 3 state
  const [hasSave, setHasSave] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const subtitleTimerRef = useRef(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [hoveredChoice, setHoveredChoice] = useState(null);
  const [ending, setEnding] = useState(null);   // { kind, message, choice }

  // Boot game on mount
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const game = new Game(containerRef.current, {
      onLoadingProgress: (p, label) => {
        if (cancelled) return;
        setProgress(p);
        if (label) setProgressLabel(label);
      },
      onLoaded: () => {
        if (cancelled) return;
        setLoaded(true);
      },
      onPointerLockChange: (locked) => {
        if (cancelled) return;
        setPointerLocked(locked);
        if (locked) setEverLocked(true);
      },
      onError: (e) => {
        if (cancelled) return;
        setErrorMsg(e && e.message ? e.message : 'WebGL error');
      },
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
      // Phase 3 callbacks
      onSaveState: ({ hasSave: hs }) => { if (!cancelled) setHasSave(!!hs); },
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
      onEnding: ({ kind, message, choice }) => { if (!cancelled) setEnding({ kind, message, choice }); },
    });
    gameRef.current = game;

    game.load().then(() => {
      if (cancelled) return;
      game.start();
      // Expose the game to window for dev tooling / integration tests.
      try { window.__wnl = game; } catch (_) {}
    }).catch((e) => {
      if (!cancelled) setErrorMsg(e && e.message ? e.message : 'Failed to load');
    });

    return () => {
      cancelled = true;
      if (areaBannerTimerRef.current) clearTimeout(areaBannerTimerRef.current);
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
      try { game.dispose(); } catch (_) {}
      gameRef.current = null;
    };
  }, []);

  // F3 toggles debug HUD
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        setDebugOn((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keyboard shortcuts for choice UI (1/2/3)
  useEffect(() => {
    if (!choiceOpen) return;
    const onKey = (e) => {
      if (e.repeat) return;
      let choice = null;
      if (e.code === 'Digit1' || e.code === 'Numpad1') choice = 'take';
      else if (e.code === 'Digit2' || e.code === 'Numpad2') choice = 'leave';
      else if (e.code === 'Digit3' || e.code === 'Numpad3') choice = 'share';
      if (choice) {
        e.preventDefault();
        commitChoice(choice);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choiceOpen]);

  const startGame = useCallback(async (mode) => {
    if (!gameRef.current) return;
    // 'resume' — just re-lock pointer, don't touch state.
    if (mode === 'resume') {
      try { await gameRef.current.requestPointerLock(); } catch (_) {}
      return;
    }
    if (mode === 'continue') {
      gameRef.current.applyLoadedSave();
    } else {
      gameRef.current.newGame();
    }
    setPlaying(true);
    try { await gameRef.current.requestPointerLock(); } catch (_) {}
    // Fresh runs get the opening cinematic. Continuing players skip it.
    if (mode !== 'continue') {
      gameRef.current.playOpening();
    }
  }, []);

  const commitChoice = useCallback((choice) => {
    if (!gameRef.current) return;
    gameRef.current.resolveFinalChoice(choice);
  }, []);

  const handleReturnToWoods = useCallback(() => {
    // Simplest & cleanest reset: reload. Save is already cleared.
    window.location.reload();
  }, []);

  const showTitleGate = loaded && !playing;
  const showLoadingScreen = !loaded && !errorMsg;
  const showPauseOverlay = loaded && playing && everLocked && !pointerLocked && !errorMsg && !choiceOpen && !ending;

  const endingLabel = ending
    ? (ending.kind === 'guardian' ? 'The Guardian' : ending.kind === 'balance' ? 'The Balance' : 'The Silence')
    : '';

  return (
    <div className="wnl-root">
      <div ref={containerRef} className="wnl-canvas-container" data-testid="game-container" />

      {/* Vignette overlay for atmosphere */}
      <div className="wnl-vignette" aria-hidden />

      {/* Area name banner */}
      {areaBanner && !hudHidden && !choiceOpen && !ending ? (
        <div className="wnl-area-banner" data-testid="area-banner">
          <div className="wnl-area-banner-inner">
            <span className="wnl-area-banner-caret">—</span>
            <span className="wnl-area-banner-text">{areaBanner}</span>
            <span className="wnl-area-banner-caret">—</span>
          </div>
        </div>
      ) : null}

      {/* ==== Phase 2 HUD ==== */}
      {playing && loaded && !errorMsg && !hudHidden && !ending && (
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
              {gameStateSnap.prompt}
            </div>
          )}
        </>
      )}

      {/* Letterbox bars during scripted moments */}
      {letterboxOn && (
        <>
          <div className="wnl-letterbox wnl-letterbox-top" data-testid="letterbox-top" />
          <div className="wnl-letterbox wnl-letterbox-bottom" data-testid="letterbox-bottom" />
        </>
      )}

      {/* Subtitle overlay */}
      {subtitle && (
        <div className="wnl-subtitle" data-testid="subtitle-overlay" key={subtitle}>
          {subtitle}
        </div>
      )}

      {/* Skip cinematic hint */}
      {hudHidden && !choiceOpen && !ending && playing && (
        <div className="wnl-skip-hint" data-testid="skip-hint" aria-hidden>
          <kbd>E</kbd> skip
        </div>
      )}

      {/* Final choice overlay */}
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
              <button
                key={opt.key}
                className="wnl-choice-btn"
                data-testid={opt.testid}
                onMouseEnter={() => setHoveredChoice(opt.key)}
                onMouseLeave={() => setHoveredChoice((k) => (k === opt.key ? null : k))}
                onFocus={() => setHoveredChoice(opt.key)}
                onBlur={() => setHoveredChoice((k) => (k === opt.key ? null : k))}
                onClick={() => commitChoice(opt.key)}
              >
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
          <div className="wnl-end-kind" data-testid={`ending-kind-${ending.kind}`}>
            {endingLabel}
          </div>
          <div className="wnl-end-message">{ending.message}</div>
          <button
            className="wnl-play-btn"
            data-testid="ending-return-btn"
            onClick={handleReturnToWoods}
          >
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
            <div
              className="wnl-loading-bar-fill"
              style={{ width: `${Math.round(progress * 100)}%` }}
              data-testid="loading-bar-fill"
            />
          </div>
          <div className="wnl-loading-label" data-testid="loading-label">
            {progressLabel || 'Loading'}<span className="wnl-loading-dots"><i/><i/><i/></span>
          </div>
        </div>
      )}

      {/* Title / Click-to-play gate */}
      {showTitleGate && (
        <div className="wnl-overlay wnl-title-gate" data-testid="title-gate">
          <div className="wnl-loading-title">
            <span className="wnl-title-line1">WHERE</span>
            <span className="wnl-title-line2">NATURE</span>
            <span className="wnl-title-line3">LEADS</span>
          </div>
          <p className="wnl-title-sub">A quiet walk in the woods.</p>
          <div className="wnl-title-actions">
            {hasSave && (
              <button
                className="wnl-play-btn"
                onClick={() => startGame('continue')}
                data-testid="title-continue-btn"
              >
                Continue
              </button>
            )}
            <button
              className="wnl-play-btn"
              onClick={() => startGame('new')}
              data-testid={hasSave ? 'title-new-game-btn' : 'click-to-play-btn'}
            >
              {hasSave ? 'New Walk' : 'Click to Play'}
            </button>
          </div>
          <div className="wnl-title-controls">
            <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</div>
            <div><kbd>Shift</kbd> sprint</div>
            <div><kbd>Space</kbd> jump</div>
            <div><kbd>E</kbd> interact</div>
            <div><kbd>Mouse</kbd> look</div>
            <div><kbd>Esc</kbd> release</div>
          </div>
        </div>
      )}

      {/* Pause / resume overlay */}
      {showPauseOverlay && (
        <div className="wnl-overlay wnl-pause" data-testid="pause-overlay">
          <div className="wnl-pause-card">
            <div className="wnl-pause-title">Paused</div>
            <p className="wnl-pause-hint">Pointer released. Click to resume your walk.</p>
            <button
              className="wnl-play-btn"
              onClick={() => startGame('resume')}
              data-testid="click-to-resume-btn"
            >
              Click to Resume
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="wnl-overlay wnl-error" data-testid="error-overlay">
          <div className="wnl-pause-card">
            <div className="wnl-pause-title">Something went wrong</div>
            <p className="wnl-pause-hint">{errorMsg}</p>
            <button
              className="wnl-play-btn"
              onClick={() => window.location.reload()}
              data-testid="reload-btn"
            >
              Reload
            </button>
          </div>
        </div>
      )}

      {/* Debug HUD (default OFF, F3 toggles) */}
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
