// All Phase 4 menu / screen components in one module so GameApp
// imports stay short. Each component is a small presentational unit.
// They rely on the game instance exposed through props for volume/save
// operations. Keyboard shortcuts are handled in GameApp.

import { useEffect, useRef, useState, useCallback } from 'react';
import { renderMap, renderMiniMap } from '../../game/Map.js';

// Single point-of-truth for the creator name shown on the Credits screen.
// The client provides the entrant name — swap this constant to update.
export const CREATOR_NAME = 'Wungnaokui Awungshi';

// -------------------------------------------------------
// Endings row on the main menu (fill / hollow leaf glyphs)
// -------------------------------------------------------
function LeafGlyph({ filled }) {
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden>
      <path
        d="M11,2 C4,7 3,14 6,20 C10,22 15,22 18,18 C22,12 18,4 11,2 Z"
        fill={filled ? '#98c48a' : 'none'}
        stroke={filled ? '#4a7a44' : 'rgba(220,235,220,0.42)'}
        strokeWidth="1.4"
      />
      {filled && <path d="M11,4 L11,20" stroke="#3a6a34" strokeWidth="1" fill="none" />}
    </svg>
  );
}

export function EndingsRow({ endingsSeen }) {
  const kinds = ['guardian', 'balance', 'silence'];
  const seenCount = kinds.reduce((n, k) => n + (endingsSeen && endingsSeen[k] ? 1 : 0), 0);
  return (
    <div className="wnl-endings-block" data-testid="endings-block">
      <div className="wnl-endings-row" data-testid="endings-row" aria-hidden>
        {kinds.map((k) => (
          <LeafGlyph key={k} filled={!!(endingsSeen && endingsSeen[k])} />
        ))}
      </div>
      <div className="wnl-endings-count" data-testid="endings-count" aria-live="polite">
        Endings discovered: {seenCount} / 3
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main Menu
// -------------------------------------------------------
export function MainMenu({ hasSave, endingsSeen, onContinue, onNewGame, onSettings, onControls, onCredits }) {
  return (
    <div className="wnl-overlay wnl-main-menu" data-testid="main-menu">
      <div className="wnl-menu-title-block">
        <div className="wnl-loading-title">
          <span className="wnl-title-line1">WHERE</span>
          <span className="wnl-title-line2">NATURE</span>
          <span className="wnl-title-line3">LEADS</span>
        </div>
        <p className="wnl-menu-tagline">
          The forest doesn't tell you where to go. It shows you.
        </p>
      </div>
      <div className="wnl-menu-buttons">
        {hasSave && (
          <button className="wnl-menu-btn" data-testid="menu-continue-btn" onClick={onContinue}>
            <span className="wnl-menu-btn-label">Continue</span>
          </button>
        )}
        <button className="wnl-menu-btn" data-testid="menu-new-game-btn" onClick={onNewGame}>
          <span className="wnl-menu-btn-label">New Game</span>
        </button>
        <button className="wnl-menu-btn" data-testid="menu-settings-btn" onClick={onSettings}>
          <span className="wnl-menu-btn-label">Settings</span>
        </button>
        <button className="wnl-menu-btn" data-testid="menu-controls-btn" onClick={onControls}>
          <span className="wnl-menu-btn-label">Controls</span>
        </button>
        <button className="wnl-menu-btn" data-testid="menu-credits-btn" onClick={onCredits}>
          <span className="wnl-menu-btn-label">Credits</span>
        </button>
      </div>
      <EndingsRow endingsSeen={endingsSeen} />
    </div>
  );
}

// -------------------------------------------------------
// Pause Menu
// -------------------------------------------------------
export function PauseMenu({ onResume, onMap, onSettings, onRestartArea, onMainMenu }) {
  return (
    <div className="wnl-overlay wnl-pause-menu" data-testid="pause-menu">
      <div className="wnl-pause-panel">
        <div className="wnl-pause-heading">Paused</div>
        <div className="wnl-menu-buttons wnl-pause-buttons">
          <button className="wnl-menu-btn" data-testid="pause-resume-btn" onClick={onResume}>
            <span className="wnl-menu-btn-label">Resume</span>
          </button>
          <button className="wnl-menu-btn" data-testid="pause-map-btn" onClick={onMap}>
            <span className="wnl-menu-btn-label">Map</span>
          </button>
          <button className="wnl-menu-btn" data-testid="pause-settings-btn" onClick={onSettings}>
            <span className="wnl-menu-btn-label">Settings</span>
          </button>
          <button className="wnl-menu-btn" data-testid="pause-restart-btn" onClick={onRestartArea}>
            <span className="wnl-menu-btn-label">Restart Area</span>
          </button>
          <button className="wnl-menu-btn" data-testid="pause-main-menu-btn" onClick={onMainMenu}>
            <span className="wnl-menu-btn-label">Main Menu</span>
          </button>
        </div>
        <p className="wnl-pause-hint">Esc — Resume</p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Settings Screen
// -------------------------------------------------------
function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, testid, suffix }) {
  return (
    <div className="wnl-setting-row">
      <label className="wnl-setting-label">{label}</label>
      <div className="wnl-setting-control">
        <input
          type="range" min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          data-testid={testid}
        />
        <span className="wnl-setting-value">
          {suffix === '×'
            ? `${value.toFixed(2)}×`
            : suffix === '%' ? `${Math.round(value * 100)}%`
            : value.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, testid }) {
  return (
    <div className="wnl-setting-row">
      <label className="wnl-setting-label">{label}</label>
      <div className="wnl-setting-control">
        <button
          type="button"
          className={`wnl-toggle ${value ? 'is-on' : ''}`}
          onClick={() => onChange(!value)}
          data-testid={testid}
          aria-pressed={value}
        >
          <span className="wnl-toggle-dot" />
          <span className="wnl-toggle-text">{value ? 'On' : 'Off'}</span>
        </button>
      </div>
    </div>
  );
}

function Segmented({ label, value, options, onChange, testid }) {
  return (
    <div className="wnl-setting-row">
      <label className="wnl-setting-label">{label}</label>
      <div className="wnl-setting-control wnl-seg">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`wnl-seg-btn ${value === o.value ? 'is-active' : ''}`}
            onClick={() => onChange(o.value)}
            data-testid={`${testid}-${o.value}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsScreen({ values, onChange, onBack }) {
  return (
    <div className="wnl-overlay wnl-screen" data-testid="settings-screen">
      <div className="wnl-screen-inner">
        <div className="wnl-screen-title">Settings</div>

        <div className="wnl-section-title">Audio</div>
        <Slider label="Master"  value={values.masterVol}  onChange={(v) => onChange({ masterVol: v })}  testid="setting-master"  suffix="%" />
        <Slider label="Music"   value={values.musicVol}   onChange={(v) => onChange({ musicVol: v })}   testid="setting-music"   suffix="%" />
        <Slider label="SFX"     value={values.sfxVol}     onChange={(v) => onChange({ sfxVol: v })}     testid="setting-sfx"     suffix="%" />
        <Slider label="Ambient" value={values.ambientVol} onChange={(v) => onChange({ ambientVol: v })} testid="setting-ambient" suffix="%" />

        <div className="wnl-section-title">Gameplay</div>
        <Slider label="Camera Sensitivity" value={values.mouseSensitivity} onChange={(v) => onChange({ mouseSensitivity: v })} min={0.25} max={2.5} step={0.05} testid="setting-sensitivity" suffix="×" />
        <Toggle label="Invert Y"           value={values.invertY}          onChange={(v) => onChange({ invertY: v })}          testid="setting-invert-y" />
        <Toggle label="Interaction Hints"  value={values.showHints}        onChange={(v) => onChange({ showHints: v })}        testid="setting-hints" />
        <Toggle label="Subtitles"          value={values.subtitles}        onChange={(v) => onChange({ subtitles: v })}        testid="setting-subtitles" />

        <div className="wnl-section-title">Graphics</div>
        <Segmented label="Quality" value={values.quality} onChange={(v) => onChange({ quality: v })} testid="setting-quality"
          options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />

        <div className="wnl-section-title">Accessibility</div>
        <Segmented label="Text Size" value={values.textSize} onChange={(v) => onChange({ textSize: v })} testid="setting-textsize"
          options={[{ value: 's', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'l', label: 'L' }]} />
        <Toggle label="Screen Shake"      value={values.screenShake}   onChange={(v) => onChange({ screenShake: v })}   testid="setting-shake" />
        <Toggle label="High Contrast UI"  value={values.highContrast} onChange={(v) => onChange({ highContrast: v })} testid="setting-contrast" />

        <div className="wnl-section-title">HUD</div>
        <Toggle label="Mini-map" value={values.minimap} onChange={(v) => onChange({ minimap: v })} testid="setting-minimap" />

        <div className="wnl-screen-footer">
          <button className="wnl-menu-btn" onClick={onBack} data-testid="screen-back-btn">
            <span className="wnl-menu-btn-label">Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Controls Screen
// -------------------------------------------------------
export function ControlsScreen({ onBack }) {
  const rows = [
    ['WASD / Arrows', 'Move'],
    ['Mouse',         'Look'],
    ['Shift',         'Sprint'],
    ['Space',         'Jump'],
    ['E',             'Interact'],
    ['M',             'Map'],
    ['Esc',           'Pause / release pointer'],
    ['1 / 2 / 3',     'Choice (Take / Leave / Share)'],
    ['F3',            'Toggle debug HUD'],
  ];
  return (
    <div className="wnl-overlay wnl-screen" data-testid="controls-screen">
      <div className="wnl-screen-inner">
        <div className="wnl-screen-title">Controls</div>
        <div className="wnl-controls-list">
          {rows.map(([key, action]) => (
            <div className="wnl-controls-row" key={key}>
              <div className="wnl-controls-key">
                {key.split(' / ').map((k, i) => (
                  <span key={i}><kbd>{k}</kbd>{i < key.split(' / ').length - 1 ? ' / ' : ''}</span>
                ))}
              </div>
              <div className="wnl-controls-action">{action}</div>
            </div>
          ))}
        </div>
        <div className="wnl-screen-footer">
          <button className="wnl-menu-btn" onClick={onBack} data-testid="screen-back-btn">
            <span className="wnl-menu-btn-label">Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Credits Screen
// -------------------------------------------------------
export function CreditsScreen({ onBack }) {
  return (
    <div className="wnl-overlay wnl-screen" data-testid="credits-screen">
      <div className="wnl-screen-inner">
        <div className="wnl-screen-title">Credits</div>
        <div className="wnl-credits">
          <div className="wnl-credits-block">
            <div className="wnl-credits-role">Game by</div>
            <div className="wnl-credits-name" data-testid="credits-creator">{CREATOR_NAME}</div>
          </div>
          <div className="wnl-credits-block">
            <div className="wnl-credits-role">Engine</div>
            <div className="wnl-credits-name">Three.js (MIT)  ·  React (MIT)</div>
          </div>
          <div className="wnl-credits-block">
            <div className="wnl-credits-role">Art &amp; Audio</div>
            <div className="wnl-credits-name">100% procedural — no third-party assets</div>
          </div>
          <div className="wnl-credits-block">
            <div className="wnl-credits-role">Typography</div>
            <div className="wnl-credits-name">Cormorant Garamond &amp; system serif fallbacks</div>
          </div>
          <div className="wnl-credits-block wnl-credits-jam">
            <div className="wnl-credits-role">Made for</div>
            <div className="wnl-credits-name">TXG Nagaland Game Jam 2026</div>
          </div>
        </div>
        <div className="wnl-screen-footer">
          <button className="wnl-menu-btn" onClick={onBack} data-testid="screen-back-btn">
            <span className="wnl-menu-btn-label">Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Map Screen (canvas-drawn journal)
// -------------------------------------------------------
export function MapScreen({ game, onClose }) {
  const canvasRef = useRef(null);

  // Draw on mount + at a slow cadence so the player marker follows without
  // burning cycles. Redraws every 500ms — plenty for a map screen.
  useEffect(() => {
    let alive = true;
    let interval = null;
    const draw = () => {
      if (!alive || !canvasRef.current || !game) return;
      const gs = game.gameState;
      const flags = gs ? gs.puzzleFlags : {};
      const visited = gs ? gs.visitedAreas : new Set();
      const p = game.character ? game.character.root.position : { x: 0, y: 0, z: 0 };
      const facingY = game.character ? game.character.facingY : 0;
      renderMap(canvasRef.current, {
        flags,
        visited: visited || new Set(),
        player: { x: p.x, z: p.z, facingY },
      });
    };
    draw();
    interval = setInterval(draw, 500);
    return () => { alive = false; if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wnl-overlay wnl-map" data-testid="map-screen">
      <div className="wnl-map-book">
        <canvas ref={canvasRef} className="wnl-map-canvas" data-testid="map-canvas" />
      </div>
      <div className="wnl-map-footer">
        <button className="wnl-menu-btn" onClick={onClose} data-testid="map-close-btn">
          <span className="wnl-menu-btn-label">Close</span>
        </button>
        <div className="wnl-map-hint">M — close</div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Confirm Overwrite Modal (New Game while a save exists)
// -------------------------------------------------------
export function ConfirmOverwrite({ onCancel, onConfirm }) {
  return (
    <div className="wnl-overlay wnl-confirm" data-testid="confirm-overwrite">
      <div className="wnl-pause-panel">
        <div className="wnl-pause-heading">Overwrite your walk?</div>
        <p className="wnl-pause-hint">A saved walk exists. Starting anew will clear it.</p>
        <div className="wnl-menu-buttons wnl-pause-buttons">
          <button className="wnl-menu-btn" onClick={onCancel} data-testid="confirm-cancel-btn">
            <span className="wnl-menu-btn-label">Cancel</span>
          </button>
          <button className="wnl-menu-btn" onClick={onConfirm} data-testid="confirm-overwrite-btn">
            <span className="wnl-menu-btn-label">Begin Anew</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Mini-map (top-right HUD)
// -------------------------------------------------------
export function MiniMap({ game, show, pulse = 0 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const lastBlitRef = useRef(0);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    // Re-mount the pulse animation whenever the parent bumps `pulse`.
    if (pulse > 0) setPulseKey(pulse);
  }, [pulse]);
  useEffect(() => {
    if (!show || !game) return;
    let alive = true;
    const loop = (nowMs) => {
      if (!alive) return;
      if (canvasRef.current) {
        const gs = game.gameState;
        const flags = gs ? gs.puzzleFlags : {};
        const visited = gs ? gs.visitedAreas : new Set();
        const p = game.character ? game.character.root.position : { x: 0, z: 22 };
        const facingY = game.character ? game.character.facingY : 0;
        // Only re-render at ~15 Hz — cheap enough for a HUD tile.
        if (nowMs - lastBlitRef.current > 66) {
          renderMiniMap(canvasRef.current, {
            flags,
            visited: visited || new Set(),
            player: { x: p.x, z: p.z, facingY },
          });
          lastBlitRef.current = nowMs;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [show, game]);
  return (
    <div
      className={`wnl-minimap ${show ? 'is-visible' : ''} ${pulseKey ? 'is-pulsing' : ''}`}
      data-testid="minimap"
      aria-hidden
      key={`mm-${pulseKey}`}
    >
      <canvas ref={canvasRef} className="wnl-minimap-canvas" data-testid="minimap-canvas" />
    </div>
  );
}

// -------------------------------------------------------
// Tutorial hint — small floating card bottom-center, above the prompt slot.
// -------------------------------------------------------
export function TutorialHint({ text }) {
  if (!text) return null;
  return (
    <div className="wnl-tutorial-hint" data-testid="tutorial-hint" key={text}>
      {text}
    </div>
  );
}

// -------------------------------------------------------
// Autosave leaf tick
// -------------------------------------------------------

export function AutosaveTick({ show }) {
  if (!show) return null;
  return (
    <div className="wnl-autosave-tick" data-testid="autosave-tick">
      <svg width="18" height="20" viewBox="0 0 22 24" aria-hidden>
        <path
          d="M11,2 C4,7 3,14 6,20 C10,22 15,22 18,18 C22,12 18,4 11,2 Z"
          fill="#98c48a" stroke="#4a7a44" strokeWidth="1.3"
        />
      </svg>
      <span>saved</span>
    </div>
  );
}

// -------------------------------------------------------
// FPS degrade notice
// -------------------------------------------------------
export function DegradeNotice({ preset }) {
  return (
    <div className="wnl-degrade-notice" data-testid="degrade-notice">
      Quality lowered to <b>{preset}</b> to keep the forest smooth.
    </div>
  );
}


// -------------------------------------------------------
// Demo Mode HUD — beat caption + progress dots + subtle fade overlay.
// Only rendered when the hidden demo is active. Never in the normal menu.
// -------------------------------------------------------
export function DemoHUD({ beatIdx, beatCount, label, fadeAlpha }) {
  const dots = [];
  for (let i = 0; i < (beatCount || 7); i++) {
    dots.push(
      <span
        key={i}
        className={
          'wnl-demo-dot' +
          (i < beatIdx ? ' is-done' : i === beatIdx ? ' is-current' : '')
        }
        data-testid={`demo-dot-${i}`}
      />
    );
  }
  const alpha = Math.max(0, Math.min(1, fadeAlpha || 0));
  return (
    <>
      <div className="wnl-demo-hud" data-testid="demo-hud">
        {label ? (
          <div className="wnl-demo-caption" data-testid="demo-caption">{label}</div>
        ) : null}
        <div className="wnl-demo-dots" data-testid="demo-dots">{dots}</div>
        <div className="wnl-demo-key-hint" data-testid="demo-key-hint">
          N — next beat &nbsp;·&nbsp; Esc — exit demo
        </div>
      </div>
      {alpha > 0 && (
        <div
          className="wnl-demo-fade"
          data-testid="demo-fade"
          style={{ opacity: alpha, pointerEvents: alpha > 0.5 ? 'auto' : 'none' }}
        />
      )}
    </>
  );
}

// -------------------------------------------------------
// Exit-demo confirmation (Esc while in demo)
// -------------------------------------------------------
export function ExitDemoConfirm({ onKeep, onExit }) {
  return (
    <div className="wnl-overlay wnl-confirm" data-testid="exit-demo-confirm">
      <div className="wnl-confirm-card">
        <div className="wnl-confirm-title">Exit the demo?</div>
        <div className="wnl-confirm-body">
          You'll return to the main menu. Your normal save is untouched.
        </div>
        <div className="wnl-confirm-actions">
          <button className="wnl-menu-btn" onClick={onKeep} data-testid="exit-demo-keep-btn">
            <span className="wnl-menu-btn-label">Keep playing</span>
          </button>
          <button className="wnl-menu-btn" onClick={onExit} data-testid="exit-demo-confirm-btn">
            <span className="wnl-menu-btn-label">Exit demo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
