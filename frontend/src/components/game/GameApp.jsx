import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '../../game/Game.js';

// Organic Forest Health icon that morphs sprout → sapling → young tree.
function HealthTierIcon({ tier }) {
  // 0 = sprout (two small leaves + short stem)
  // 1 = sapling (thin trunk + a few small leaf tufts)
  // 2 = young tree (trunk + rounded canopy)
  return (
    <svg className="wnl-hud-tree-svg" width="42" height="52" viewBox="0 0 42 52" aria-label="Forest Health">
      {/* Ground line */}
      <ellipse cx="21" cy="49" rx="14" ry="2" fill="rgba(20,32,20,0.55)" />
      {/* Stem/trunk grows with tier */}
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
          {/* Gentle glow */}
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

// Full-screen game shell. Handles:
//   - loading screen with progress
//   - click-to-play gate (also satisfies future audio autoplay policy)
//   - paused overlay (when pointer lock is lost)
//   - debug HUD (F3)
//   - area-name toast when the player enters a new area

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
    });
    gameRef.current = game;

    game.load().then(() => {
      if (cancelled) return;
      game.start();
      // Expose the game to window for dev tooling / integration tests. Harmless
      // in production; useful in headless testing.
      try { window.__wnl = game; } catch (_) {}
    }).catch((e) => {
      if (!cancelled) setErrorMsg(e && e.message ? e.message : 'Failed to load');
    });

    return () => {
      cancelled = true;
      if (areaBannerTimerRef.current) clearTimeout(areaBannerTimerRef.current);
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

  const handlePlayClick = useCallback(async () => {
    if (!gameRef.current) return;
    // Pointer lock is best-effort. Enter play mode either way so keyboard controls work.
    setPlaying(true);
    try { await gameRef.current.requestPointerLock(); } catch (_) {}
  }, []);

  const showTitleGate = loaded && !playing;
  const showLoadingScreen = !loaded && !errorMsg;
  // Resume overlay only makes sense if we actually had pointer lock once and lost it.
  const showPauseOverlay = loaded && playing && everLocked && !pointerLocked && !errorMsg;

  return (
    <div className="wnl-root">
      <div ref={containerRef} className="wnl-canvas-container" data-testid="game-container" />

      {/* Vignette overlay for atmosphere */}
      <div className="wnl-vignette" aria-hidden />

      {/* Area name banner */}
      {areaBanner ? (
        <div className="wnl-area-banner" data-testid="area-banner">
          <div className="wnl-area-banner-inner">
            <span className="wnl-area-banner-caret">—</span>
            <span className="wnl-area-banner-text">{areaBanner}</span>
            <span className="wnl-area-banner-caret">—</span>
          </div>
        </div>
      ) : null}

      {/* ==== Phase 2 HUD ==== */}
      {playing && loaded && !errorMsg && (
        <>
          {/* Forest Health tier icon (top-left) */}
          <div className="wnl-hud-health" data-testid="health-hud">
            <HealthTierIcon key={tierFlashKey} tier={gameStateSnap.healthTier} />
          </div>

          {/* Seeds counter (appears after first pickup) */}
          {gameStateSnap.seeds > 0 && (
            <div className="wnl-hud-seeds" data-testid="seeds-hud" key={seedFlashKey}>
              <SeedIcon />
              <span className="wnl-hud-seeds-num">{gameStateSnap.seeds}</span>
            </div>
          )}

          {/* Objective whisper (top-center, italic) */}
          {gameStateSnap.objective && (
            <div className="wnl-hud-objective" data-testid="objective-hud" key={gameStateSnap.objective}>
              {gameStateSnap.objective}
            </div>
          )}

          {/* Interaction prompt (bottom-center) */}
          {gameStateSnap.prompt && (
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
          <button
            className="wnl-play-btn"
            onClick={handlePlayClick}
            data-testid="click-to-play-btn"
          >
            Click to Play
          </button>
          <div className="wnl-title-controls">
            <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</div>
            <div><kbd>Shift</kbd> sprint</div>
            <div><kbd>Space</kbd> jump</div>
            <div><kbd>Mouse</kbd> look · <kbd>Esc</kbd> release</div>
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
              onClick={handlePlayClick}
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
