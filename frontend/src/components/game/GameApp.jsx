import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '../../game/Game.js';

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
    });
    gameRef.current = game;

    game.load().then(() => {
      if (cancelled) return;
      game.start();
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
