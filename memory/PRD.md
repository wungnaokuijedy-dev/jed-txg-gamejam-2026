# Where Nature Leads — PRD

## Original problem statement
Build "Where Nature Leads" — an HTML5/WebGL browser game for the TXG Nagaland Game Jam 2026.

This is a **game**, not a website/dashboard. Client-side only, no backend features. Vanilla Three.js in a full-screen canvas inside a React shell. All geometry is procedural low-poly. Target 60 FPS on a mid-range laptop.

## Phase 1 scope — "Playable Core" (this session)
Character, camera, world blockout, atmosphere, performance. Puzzles/wildlife AI/endings/menus/audio/story are explicitly out-of-scope for phase 1 and deferred.

## User persona
Jam judge / player on a desktop Chrome browser. No authentication. No accounts.

## Core requirements (static)
- Third-person character controller with procedural animation (idle/walk/run/jump).
- Smooth-follow orbit camera with pointer lock, terrain de-clip.
- One compact map with 5 visually distinct areas along a rough path:
  1. The Entrance (spawn, tall trees, mist)
  2. Whispering Woods (dense trees, fallen log placeholder)
  3. The Silent Stream (dry stream bed placeholder)
  4. The Ancient Grove (standing stones + giant tree + glowing plants)
  5. The Heart of the Forest (elevated clearing, massive ancient tree)
- Stylized-low-poly art direction, cool misty dawn palette (blue-green fog, teal shadows, pale gold sun).
- Living atmosphere: fog, wind-swayed trees/grass, drifting mist, falling leaves, distant mountains.
- Loading screen with title, then click-to-play gate. WebGL context loss handled.
- Zero console errors, 60 FPS target, InstancedMesh for all vegetation, capped pixel ratio.
- Debug HUD toggled by F3 (default OFF), reports FPS / position / current area.

## What has been implemented (Feb 2026)
- **Female anime-inspired heroine — quality-pass upgrade**: smooth ellipsoid head with runtime **CanvasTexture face** (large anime eyes with iris + highlights + lash line, eyebrows, small mouth, soft blush cheeks); **LatheGeometry torso** with subtle female form (cinched waist, chest volume) in cream jacket; **CapsuleGeometry** for smooth arms/legs; **mitten-style hands** with thumb bump; multi-mesh **boots** (shaft + toe + cuff + sole); layered hair (skull volume + highlight, forehead fringe cluster, side face-framing strands, 4-segment angular-spring **ponytail** with lag/whip/wind); hood volume on the back; **rim/fill directional light** so the heroine separates from the forest background; **ACESFilmic tone mapping** with exposure 1.15.
- **Face-the-movement animation rig**: character body **smoothly rotates toward velocity direction** at ≤12 rad/s (S = 180° turn toward camera, no moonwalking; A/D = turn sideways). **Stride frequency is proportional to actual horizontal speed** (walk stride ≈1.35 m, run ≈1.75 m), so legs never slide. **Swing amplitude scales with `moveBlend`**, so legs blend smoothly to neutral at rest (no frozen mid-stride). **Body leans** subtly into turns (yawRate) and into acceleration.
- **Camera feel**: sprint-based **distance widening** (5.5 → 6.6 m), **subtle handheld sway** while moving (very small amplitudes), lerped follow with terrain de-clip. Hardened against pointer-lock acquisition delta spikes.
- **Forest density**: 5 tree variants (pine, deciduous, twisted, **birch tall slender with pale trunk**, **big canopy**) totaling ~700 instanced trees; **260 bushes** (2-ico clusters) with wind sway; **90 mushrooms** in 30 clusters (3 cap colors); **8 extra fallen logs** with moss-tufted tops; 150 rocks; 1600 grass tufts; 360 flowers; 60 ferns near stream.
- **Ambient life & atmosphere**: **god-ray light shafts** near the Entrance (5 additive-blend cones along sun direction); **100 fireflies** clustered in dark forest pockets with additive-blend blink; **160 pollen motes** wrapped in a 22 m radius around the player; **3 birds** flying spline loops between canopies with flapping wings; 220 falling-leaf point-sprites; 14 vertical mist banks; distant low-poly mountain silhouettes.
- **Mood palette** (`MOODS.DAWN_COOL`) shifted warmer/brighter: exposure lifted, fog density 0.028 → 0.020 for readability, sun intensity 1.35 → 1.55, warmer golden sun tint, warmer hemisphere-ground bounce. `MOODS.WARM_HEALED` + `lerpMood()` still available for later phases to progress the palette as Forest Health rises.
- All previously-shipped systems retained: analytic terrain grounding, radial obstacle collision, InstancedMesh vegetation, single shadow-casting directional light with tight frustum following player, pixelRatio cap 1.5, F3 debug HUD (default OFF), loading screen, click-to-play gate, WebGL context-loss handler.
- **Heightmap terrain** (~40k tris) with vertex colors (moss/earth-path/stone/wet stream bed), tinted by mood config; single authoritative `sampleHeight(x, z)` shared by terrain, character grounding and vegetation placement. Perimeter hills fence player naturally.
- **5 distinct areas** laid out for future puzzle gating without terrain rework: spawn-flatten (Area 1), fallen-log placeholder (Area 2), dry stream bed with ferns (Area 3), standing-stone circle + giant tree + faint glowing plants (Area 4), elevated clearing with massive ancient tree + roots + warm point light (Area 5).
- **Instanced vegetation**: 3 tree variants (pine / broad / twisted) — ~540 trees total in 6 draw calls; 150 rocks (2 variants); 1600 grass tufts with vertex-shader wind sway (`onBeforeCompile` on MeshStandardMaterial so lighting/shadows/fog still work); 360 flowers; 60 ferns.
- **Atmosphere**: shader-based gradient sky dome; `FogExp2` cool blue-green fog; hemisphere + directional sun with tight shadow frustum following the player; 14 vertical mist bank planes with procedural noise-fade; 220 falling-leaf point-sprites wrapped in a 60m cube around player with drift/rotation; distant low-poly mountain silhouettes ring.
- **Mood config** with `MOODS.DAWN_COOL` and `MOODS.WARM_HEALED` presets + `lerpMood()` — later phases (Forest Health rising, ending) can lerp lighting/fog/foliage tints via a single call without touching individual meshes.
- **Loading pipeline**: yielding progress reports (Preparing scene → Shaping the land → … → Waking the explorer), title screen with Cormorant Garamond italic; click-to-play gate satisfies future audio autoplay policy.
- **Debug HUD**: F3-toggled, default OFF; shows FPS, position, current area name.
- **Area name banner** fades in when the player crosses into a new area.
- **WebGL context-loss handling**, resize handling, disposal on unmount.

## Prioritized backlog (deferred to later phases)
### Phase 3 (next)
- Ending band selection (drives ending picked at Heart choice: cool / balanced / warm-healed based on `_moodT` at the final choice).
- Player choice at the Heart (place seed vs. take the flower vs. sit) → three endings.
- Save / restore via localStorage keyed off `GameState` (all state already lives in one object).
- Cinematic sequences: full camera moves + slower letterbox + dialog whispers over the three endings.
- Optional plants gate two hidden micro-scenes (extra bloom vistas).

### Phase 4
- Audio (ambient forest bed, footsteps, wind, per-puzzle stingers).
- Menu / pause / options (sensitivity, brightness).
- Photo mode (F2) + shareable snapshot with area names visited.
- Localization pass, credits, license notice.

## Files touched in phase 1
- `/app/frontend/src/App.js`, `App.css`, `index.css` — game shell + overlays styling.
- `/app/frontend/src/components/game/GameApp.jsx` — React mount + loading / title / pause overlays + debug HUD.
- `/app/frontend/src/game/Game.js` — orchestrator: renderer, scene, camera, lights, frame loop.
- `/app/frontend/src/game/Terrain.js` — heightmap + area definitions.
- `/app/frontend/src/game/Vegetation.js` — instanced trees/rocks/grass/flowers/ferns + hero props.
- `/app/frontend/src/game/Atmosphere.js` — sky, mountains, mist, leaves.
- `/app/frontend/src/game/Character.js` — procedural humanoid + animation.
- `/app/frontend/src/game/CharacterController.js` — movement physics + collision.
- `/app/frontend/src/game/CameraController.js` — orbit camera + de-clip.
- `/app/frontend/src/game/Input.js`, `Mood.js`, `Rng.js` — supporting modules.

## Phase 2 additions (Feb 2026)
- **`GameState.js`** central object: `health` (0..100, start 50), `seeds`, `puzzleFlags {grow_done, restore_done, bird_freed, stones_awoken, heart_reached}`, `doneInteractions` set, `objective` text, event bus (`health`, `seeds`, `objective`, `prompt`, `mood`, `letterbox`, `flag`). Health drives a smoothed mood-lerp `t = clamp((health-40)/50, 0, 1)` that updates fog / hemisphere / sun / sky uniforms in real time via `Game.applyMood`.
- **`Interactables.js`**: proximity + facing prompt system (closest item in front of the character wins). Triggers a kneel/reach pose on the character for ~1s while running `onInteract` and gently pulls the camera in.
- **Kneel/reach pose** added to `Character.updateAnimation` with a smooth blend, driven by `beginPose('kneel')` / `endPose()`. `CharacterController` freezes horizontal velocity while `isInPose()` is true.
- **`Puzzles.js`** orchestrator wires:
  - **3 seeds** (glinting orbs with hovering butterfly clusters as FOLLOW hints).
  - **3 withered plants** — the required one at the fallen log grows an animated **vine bridge** (~4s of scaling-in curved cylinders + leaves + fading root-glow burst) that shrinks the log's collision so the player can pass. Two optional plants give +5 each.
  - **Spring debris pile** at the upstream end of the stream (Area 3); `E — Clear the spring` crumbles it and starts the **animated stream water** shader (flow noise + foam near edges); root bridge downstream lifts smoothly on activation.
  - **Tangled bird** — `E — Free the bird`; wings and vines detach, bird flies toward the Ancient Grove.
  - **Standing stones** (Area 4): after Restore, `E — Touch the stones` starts a sequenced emissive-glow ripple across the 6 stones and appoints a guide — **deer** at health ≥ 60, otherwise a **firefly trail** placed segment-by-segment along the guide route.
  - **Heart gate**: two great roots that auto-part on player arrival with `stones_awoken` set, with a **letterbox** effect (~3.5s).
  - **Fawn** placed near the ancient tree in the Heart clearing.
  - **Temptation set**: glowing-flower cluster + mushroom ring, both wither on interact (-10 each). Critical path is **never** gated by health.
- **`Wildlife.js`**: 3 ambient deer with a wander/alert/flee state machine + speed-driven leg swings. `Sprinting into deer` triggers flee + `-2` health (capped by cooldown). Guide-deer mode moves along a spline route only when the player is nearby, animating legs. **Butterfly clusters** (point sprites in a lobe shape) hover near each seed as the "look here" hint. **Firefly trail** appears segment-by-segment.
- **HUD** (React overlays): organic health tier icon (`sprout` / `sapling` / `young tree` SVG that morphs with a pop-and-glow keyframe on tier change); seeds counter (appears only after first pickup with a pop-in animation); italic objective whisper top-center (fades on change); "E — <verb>" interaction prompt bottom-center; letterbox bars on scripted moments. All non-intrusive.
- **F4 debug hotkey** (dev only) dumps GameState to console.
- **`window.__wnl` exposed** so integration tests can inspect/teleport without affecting production. Not surfaced in UI.



## Phase 3 additions (Feb 2026 — this session)
- **`Cinematic.js`**: sequencer that owns camera per-frame while active; freezes character, letterboxes, hides HUD, emits subtitles and time-based triggers, E-to-skip after a per-cinematic `minSkipT`. Four prebuilt cinematics — **opening** (10s sky glide down to the heroine, skippable immediately), **vineGrowth** (6.5s framing shot after Puzzle 1), **guardianRevelation** (22s slow push toward the giant grove tree with 4 timed subtitles), **heartChoiceArc** (6s orbit around heroine+Heartseed, keeps letterbox for the choice UI), **ending** (26s rising rotate over the Heart, chained per outcome).
- **`Weather.js`**: additive-blend rain point-sprite system in a 24m box around the player, dampened intensity toward a `_targetIntensity`. Stages: `clear | mist | rain_light | clearing | break`. **Weather is tied to STORY BEATS, not areas** — `mist` at start → `rain_light` when Puzzle 1 (vine bridge) is solved → `clearing` when the Heart gate opens → ending override (Silence: `mist`, Balance: `clearing`, Guardian: `break`). `rain_heavy` intentionally skipped for perf/readability.
- **`Endings.js`**: three distinct scene effects.
  - **Guardian** — luminous stag manifests in front of the heart tree, aura + upward glowing motes, mood forced toward `WARM_HEALED`.
  - **Balance** — faint stag silhouette barely visible in mist, quiet mood.
  - **Silence** — fireflies gutter out (uniform color fades toward black), mood forced fully cool grey, fawn walks away over 20s.
- **`Save.js`**: versioned localStorage under key `wnl_save_v1`. Saves `{health, seeds, flags, doneInteractions, objective, moodT, weatherStage, pos, facingY}`. `Puzzles.applySavedState()` re-runs the visual side (vine bridge grown, stream flowing, stones glowing, heart gate opened) on Continue so the world matches the flags. Endings-seen counted separately in `wnl_endings_seen`. **Autosave** every 30s in game loop plus event-driven on flag/seed changes; suppressed during cinematic/choice/ending so a save never captures a half-cinematic state. Save is cleared after each ending.
- **GameState extensions**: `choiceMade`, `endingKind`, `endingResolved`, `hudHidden`, `resolveEnding(choice)`. Ending band uses **accumulated forest health + choice modifier** (TAKE -15, LEAVE +15, SHARE +5) → bands `>=75 Guardian`, `40-74 Balance`, `<40 Silence`. This means all three choices can lead to different endings depending on how the player played the whole run.
- **Heartseed** interactable at the center of Area 5 (glowing gold icosahedron on a mossy stump with additive halo). Available only after `heart_reached`. On interact, delegates to `Game.startFinalChoiceSequence()` which plays the arc cinematic and, at t=1.5s into the arc, fades the choice UI in and **releases pointer lock** so the player can click Take / Leave / Share (or press 1 / 2 / 3). Hover / keyboard focus reveals a one-line poetic consequence hint ("Its light could serve you." / "Let the forest keep its heart." / "Plant half. Carry half.") with a smooth crossfade.
- **UI overlays (`GameApp.jsx`)**: subtitle overlay above the bottom letterbox with per-line duration; `E skip` hint bottom-right while HUD is hidden; final-choice modal with three pill buttons (numbered ①②③) + poetic hint + 1/2/3 keyboard shortcuts; ending card fades in with `THE GUARDIAN | THE BALANCE | THE SILENCE` label and its poetic closing line, plus a `Return to the Woods` button that reloads to the title. Title gate now shows both a **Continue** button (only if a save exists) and a **New Walk** button (which wipes the save).
- **Ending → title flow**: after the ending card, the player clicks Return to the Woods → page reloads → title screen shows a fresh state (save was cleared) but the `wnl_endings_seen` record persists across runs for future collection UI in Phase 4.

## Phase 3 acceptance — verified via in-browser scripted tests
1. LEAVE at health 30 → 45 → Balance ending ✓
2. TAKE at health 20 → 5 → Silence ending, `endings_seen = {"silence":1}` ✓
3. SHARE at health 85 → 90 → Guardian ending, `endings_seen = {"guardian":1}` ✓
4. Weather transitions: initial `mist` → `rain_light` after grow_done ✓
5. Save / Continue: save present after flag set; reload shows Continue button; clicking Continue restores flags and player position ✓
6. Pointer lock released when choice UI opens (fixes mouse-click) ✓
7. Save cleared after ending ✓
8. Cinematic E-to-skip works during opening (immediate) and after 3s for others ✓
9. Choice UI hover shows correct poetic hint for each option ✓
10. Ending card shows correct kind label and poetic message ✓

## Known limitations / Phase 4 backlog
- No audio yet (ambient bed / footsteps / stingers / ending sting).
- No main menu / options screen (settings, mouse sensitivity slider, brightness).
- Ending-seen record in localStorage isn't yet surfaced in a collection UI.
- Continue restores flags + player pos but doesn't currently replay the vine cinematic — visual state (bridge grown, stream flowing, stones glowing, gate opened) is fast-forwarded via `Puzzles.applySavedState()`.
- Heart choice arc camera framing is decent but the giant heart-tree trunk still occasionally clips the composition on very tall trunks — acceptable for jam quality.


## Phase 4 additions (Feb 2026 — this session)

### Main Menu (replaces the bare Click-to-Play)
- Live 3D forest scene runs behind the menu (game runs in a dedicated **menu-mode** where the camera drifts slowly around spawn, character stands idle, no player input is accepted, mist and swaying vegetation continue). Title "WHERE NATURE LEADS" + tagline *"The forest doesn't tell you where to go. It shows you."* — both fade in.
- Buttons: **Continue** (only when a save exists), **New Game** (opens overwrite-confirm modal if a save exists), **Settings**, **Controls**, **Credits**. All pill-shaped, italic serif, hover lifts + colour brightens.
- **Endings row** at the bottom: 3 leaf glyphs, filled if the corresponding ending has been seen (persisted in `wnl_endings_seen`), hollow otherwise. No labels — quiet collectible hint.
- Overwrite confirm modal: *"Overwrite your walk? A saved walk exists. Starting anew will clear it."* with Cancel / Begin Anew buttons.

### Pause Menu (Esc during gameplay)
- Buttons: Resume, Map, Settings, Restart Area, Main Menu (autosaves first).
- `Game.pause()` freezes the loop (skips all `update()` calls but keeps rendering) and calls `AudioContext.suspend()`. `Game.resume()` reverses both and re-locks pointer on Resume click. On resume, `_lastT` is snapped to `now` so `dt` never spikes.
- **Cinematic behavior**: Esc during a cinematic opens the pause menu. Pausing while a cinematic is playing freezes the cinematic in place (no advance in `_t`), and resuming continues from that frame. No softlocks encountered in test.
- Restart Area re-spawns the player at the Area 1 entrance, keeps all state (health, seeds, flags), snaps camera behind the character, and re-locks pointer.
- Main Menu → autosaves (if no ending resolved yet), enters menu-mode, returns to main menu screen. `hasSave` re-queried so the Continue button re-appears immediately.

### Map Screen (M key + Pause menu → Map)
- **Hand-drawn journal style** rendered programmatically onto a 1080×720 canvas via `Map.js` (`renderMap()`). Parchment gradient + speckle grain + double-frame border, "The Explorer's Journal" title in italic serif.
- 5 areas as illustrated ink regions with area-specific glyphs (trees for the Entrance, dense trees + bridge for Whispering Woods, ferns for the Silent Stream, one giant tree + stones for the Ancient Grove, massive tree for the Heart). Vine bridge visibly grown when `grow_done`. Stream drawn as a dashed dry line by default, becomes a solid blue flowing curve with lateral shimmer strokes after `restore_done`. Stones turn green when `stones_awoken`. A small green flourish appears next to restored locations.
- **Progressive reveal**: unvisited areas render as faint dashed ellipses with a "?" glyph. Areas are marked visited via `GameState.recordAreaVisit(name)` fired from the main loop on area change. Visited set is persisted in the save.
- Player marker: small compass-rose dot with a directional wedge that follows `character.facingY`. Updated every 500 ms while the map is open.
- Compass rose "N" in the bottom-right.
- M toggles map from gameplay (Esc closes back to game). From pause, click Map / click Close.

### AudioEngine (`AudioEngine.js`) — 100% procedural, zero external files
- Master → Music / SFX / Ambient buses feeding `AudioContext.destination`.
- **Ambience layers (looping):**
  - Wind — brown-noise buffer through lowpass with an LFO on the filter cutoff.
  - Insects — bandpass at ~5.8 kHz on white noise, density scales with `healthNorm` and area (denser at the Grove).
  - Water — brown-noise bandpass, gain rises from 0 → 0.22 when `restore_done` fires.
  - Rain — white-noise lowpass, gain follows the weather stage (`rain_light` = 0.28, `rain_heavy` = 0.42, dry stages = 0).
  - Area-based crossfade (~1 s target time) between wind/insect gains when the player crosses an area boundary.
- **Bird chirps** — spawned procedurally as short pitch-modulated sine bursts (2-4 note warble each) with per-chirp random pitch. Timer between chirps scales with health and pauses during rain.
- **Music (subtle, generative):**
  - Detuned-saw pad + sine fifth through a slow-LFO'd lowpass — the base exploration bed.
  - Second low-triangle "grove pad" fades in when the player enters the Ancient Grove.
  - Pentatonic melody sequencer schedules 2-4 sine notes with envelopes every 20-32 s (paused during choice + endings).
  - Modes: `exploration`, `grove` (auto on Ancient Grove enter and on `stones_awoken`), `choice` (near-silence + one sustained 220 Hz sine), `ending_guardian` (major-triad triangle swell), `ending_balance` (suspended-chord triangle swell), `ending_silence` (three sparse fading sines).
- **Footsteps** — driven by `character.phase` heel-strike zero-crossings; short filtered noise bursts with per-step random bandpass frequency and amplitude, louder + shorter for sprint. Landing thump on `charCtrl.grounded` transition (lowpass brown noise + short sine kick).
- **SFX bank**: `seed_pickup`, `vine_growth`, `water_release`, `bird_free`, `stone_hum`, `gate_open`, `choice_appear`, `ui_hover`, `ui_click`, `autosave`, `temptation` — all built from oscillators + noise buffers.
- **Autoplay policy**: `AudioContext` is created and resumed inside `Game.initAudio()`, called from the first menu button click. Visibility-change handler suspends/resumes the context on tab background/foreground.

### Settings (`Settings.js`) — persist to `wnl_settings_v1`, live-apply
- Audio: Master / Music / SFX / Ambient sliders → immediately push into the corresponding `AudioEngine` bus (`setTargetAtTime` for smooth transitions).
- Gameplay: Camera Sensitivity (0.25×..2.5× multiplier around the base 0.0025 rad/pixel), Invert Y, Interaction Hints (when off, the "E — verb" prompt is replaced with a small glowing dot), Subtitles (when off, no subtitles render even during cinematics).
- Graphics: Quality preset Low / Medium / High. `Game.applyQuality(preset)` adjusts `renderer.setPixelRatio`, `renderer.shadowMap.enabled`, `sun.shadow.mapSize`, particle draw ranges (leaves / fireflies / pollen / rain), and grass / bush / flower / fern instanced-mesh visible counts. Trees + rocks stay stable so the world doesn't visibly pop.
- **Auto-degrade watcher**: if fps < 30 for ~5 s of accumulated samples, one one-time step-down (high → medium, medium → low) with a friendly on-screen notice.
- Accessibility: Text Size (S / M / L, applied via `wnl-text-*` root classes that scale HUD + subtitle text), Screen Shake toggle (kills the sub-2% handheld camera sway when off), High Contrast UI (adds solid backplates + heavier text shadows to subtitles / objective / prompt).

### Controls Screen
- Clean list of every key that actually works in-game (WASD/Arrows, Mouse, Shift, Space, E, M, Esc, 1/2/3, F3). No invented bindings.

### Credits Screen
- Placeholder "your name here" for the creator, Emergent AI (Claude) assistance credit, Three.js (MIT), React (MIT), procedural art + audio note, typography note, TXG Nagaland Game Jam 2026 line. No invented credits.

### Approved carry-over
- **Autosave leaf tick**: small green leaf glyph + "saved" text fades in top-right on every autosave (event-driven + 30 s interval), fades out after ~1.4 s. Backed by `onAutosave` callback fired from `Game._doAutosave()`. Also plays the quiet `autosave` audio chime.

## Phase 4 acceptance — verified via scripted browser tests
1. Menu → New Game → gameplay → ending → back to menu; endings row updates (Guardian glyph filled), Continue button hidden (save cleared). ✓
2. Continue with a real save restores health 60, seeds 1, position (-30, -8), grow_done flag, `rain_light` weather. ✓
3. Overwrite confirm modal shows only when a save exists; Cancel returns to menu, Begin Anew wipes and starts a new run. ✓
4. Every setting has an observable effect + persists to localStorage: Master vol → `audio.masterGain.gain.value`, Quality Low → `pixelRatio 1.0` + shadows off + rain drawRange halved (489 → 244) + leaves drawRange halved (154 → 77), Invert Y → `camCtrl.invertY = true`. ✓
5. Pause: `Game.isPaused() → true`, `audio.ctx.state → 'suspended'`; Resume flips both back. ✓
6. Map: M key opens; area glyphs, "The Entrance" region visible with tree glyphs, "?" for unvisited; compass rose bottom-right; Esc / M / Close button all dismiss cleanly. ✓
7. Audio initializes on first menu click (`audio.debug().initialized: true, state: "running"`); music mode transitions verified: `exploration → choice → ending_guardian`. ✓
8. Autosave path: setting `grow_done` flag fires `onAutosave` → the leaf tick UI. (autosave chime confirmed via `audio.play('autosave')` call in `_doAutosave`.) ✓
9. Zero console errors across every scripted test. ✓

## Known limitations / Phase 5 backlog
- No **share-card / photo mode** (kept out of scope per spec).
- No **Silence ending vignette** (deferred to polish).
- **AudioContext** starts on the first menu button click — that means a player who never clicks anything but the Continue button on their first-ever visit still triggers audio init (Continue is also a click). Fine.
- Auto-degrade uses `_degraded` as a one-time latch — deliberately does not step down further. If the player manually raises quality after a degrade, the latch prevents another auto-drop.
- Map re-renders every 500 ms while open; the parchment texture is redrawn from scratch each time. Cheap enough on desktop but a future pass could cache the static layer to an offscreen canvas.

## Phase 5 additions (Feb 2026 — this session, submission polish)
- **Per-area footstep filter** — `AudioEngine._playFoot` switches on `_areaName`. Entrance = crisp leaf crunch (bandpass 900-1300 Hz, Q=5), Whispering Woods = default soft grass, Silent Stream = damp lowpass ~220 Hz, Grove/Heart = resonant wood (bandpass 360-460 Hz, longer decay).
- **Silence-ending mood** — `Endings.playSilence()` emits `silence_mood: { on: true }`; GameApp toggles a `wnl-silence-mood` document-root class. CSS applies `filter: saturate(0.55) contrast(0.96) brightness(0.92)` to the canvas + a stronger radial vignette, both with a 3.2 s ease transition. Reset on Return-to-Woods.
- **Map offscreen cache** — `renderMap()` now hashes `(flags, visited)` and re-uses an offscreen canvas for the static layer; per-frame updates only clear + blit the cache and stamp the player marker. `resetMapCache()` clears the cache on ending → menu.
- **Main menu "Endings discovered: N / 3"** — screen-reader friendly line beneath the leaf glyphs (`data-testid="endings-count"`, `aria-live="polite"`). Reads corrupt-storage-safely (Save.js now guards `endingsSeen()` against non-object / array parses).
- **Credits creator constant** — `export const CREATOR_NAME` at the top of `components/game/Menus.jsx`. Change one line to swap the entrant name.
- **Error-handling audit fixes**:
  - Auto-pause on pointer-lock loss: `onPointerLockChange(locked=false)` while playing (and not in cinematic/choice/ending/modal) pauses the game and shows the pause menu, so Esc-or-Alt-Tab → clean pause with no black-screen dead-zone.
  - Stuck-player safety: after each `charCtrl.update` while in gameplay, if the character is out of bounds (`|x| > 80` or `z < -95` or `z > 55`) OR falls > 6 m below terrain, `Game.restartArea()` respawns them at Area 1 with camera reset.
  - Corrupt `wnl_endings_seen` / `wnl_settings_v1` / `wnl_save_v1` — all three loaders wrap `JSON.parse` in try/catch AND check the parsed shape; game boots cleanly with the corrupt key wiped.
  - Rapid-input abuse: M key is now guarded against opening during choice UI or ending; `resolveFinalChoice` guards double-commits via `if (this.gameState.choiceMade) return;`; `interactables._trigger` already had `if (this.busy) return;`.

## Phase 5 — Bundle size + build report
- `yarn build` output (production, minified + gzipped):
  - JS: **231 kB gzipped** (883.6 kB raw, single chunk)
  - CSS: **12.4 kB gzipped** (66.1 kB raw)
  - Total build folder: **4.3 MB** (includes source maps)
- Well under the jam limit; a fresh `serve -s build` boots to the main menu and plays end-to-end (verified with `python3 -m http.server` locally).

## Phase 5 — README (submission)
- `/app/README.md` created with: game description + tagline, theme integration paragraph, technology table with versions and licenses (React 19, ReactDOM 19, Three.js 0.161.0, all MIT — the only libs that ship in the bundle), AI disclosure (Emergent AI + Claude, procedural art/audio), fonts declaration (system serif only — no @font-face, no Google Fonts request), controls table (only keys that work), how-to-run (production `yarn build` + static serve, or dev `yarn start`), system requirements, known limitations (desktop only, single-slot save, save fast-forwards rather than replaying cinematics, auto-degrade one-shot).


## Phase 5 — Creator identity (submission)
- `CREATOR_NAME` constant (top of `/app/frontend/src/components/game/Menus.jsx`) → **"Wungnaokui Awungshi"** (Solo Developer, jam handle `@princejedd`).
- **Credits screen** (surgical): shows GAME BY / ENGINE / ART & AUDIO / TYPOGRAPHY / MADE FOR. The old "BUILT WITH — Emergent AI (Claude) assistance" section was **removed at client's request**; layout, typography, animations, and spacing are unchanged.
- **README.md** keeps the full AI-usage disclosure (jam rules require it in the disclosure document). The README's Credits section now lists the full byline: *Game by Wungnaokui Awungshi — Solo Developer — @princejedd*, with a note pointing readers to the AI disclosure section above.

## Phase 5 acceptance — testing_agent iteration_2 verdict
- **29 / 29 acceptance items PASS**, 0 runtime bugs, 0 console errors across 30+ interactions.
- Two headless-only overlay-stacking flakes on `map-close-btn` and `pause-resume-btn` (Chromium-headless z-index timing artifact, resolved with `force=True`). Testing agent explicitly notes these are not expected in real desktop Chrome and recommends a human visual pass.
- Production bundle: **231.09 kB gzipped JS + 12.44 kB gzipped CSS** — well under the jam limit.
- Full report: `/app/test_reports/iteration_2.json`.


## Phase 6 additions (Feb 2026 — feel + visuals + mini-map)
Hard constraint honoured: **zero changes to gameplay logic, story, objectives, puzzles, Forest Health, endings, or saves.** All Phase 3-5 acceptance tests still pass, all `data-testid`s preserved.

### Movement & animation polish (Character.js `updateAnimation`)
- **Foot-plant curve**: `swingBias = sign(swing) * pow(|swing|, 0.85)` softens the pass through ground contact so feet don't visibly "swim". Applied to hip rotations.
- **Knee flexion during forward swing**: two-term bend (`swingCos` back-swing plant + `-swingRaw` forward-swing lift) so the leg lifts through the walk cycle instead of pegging.
- **Hip sway + shoulder counter-rotation**: `body.position.x` and `body.rotation.y` picked up small opposed sine motion, scaled by `moveBlend`. Amplitude tiny (max ~2 cm / ~0.04 rad) so it reads as gait, not a wobble.
- **Head stabilization**: `headPivot.position.y = 0.5 − walkBob * 0.6` counter-bobs the head against the walk bob so the third-person "view" stays calm. Also strengthened head-vs-lean opposition (`headPivot.rotation.z = leanZ * -0.55`).
- Existing banked-lean into turns (`leanZ` clamped ±0.22) preserved unchanged; combined with the new head opposition it gives the "cinematic head-stable during a hard turn" effect.

### Character visual fidelity
- **Contact blob shadow**: soft 55 cm dark disc parented to `character.root`, drawn just above terrain (world y = groundY + 0.015). Kept grounded during jumps by writing `contactBlob.position.y = (groundY − root.y) + 0.015` each frame; opacity + scale fade with `airBlend` so it doesn't stick to her feet mid-jump. Guarantees the heroine reads as grounded even on **Low** quality where the sun shadow map is disabled.
- **Softer shadow edges**: `sun.shadow.radius = 4` for PCF blur; **tighter bias** (`-0.00028`) and `normalBias = 0.028` — no more peter-panning at her feet.

### Grass upgrade (biggest visual win)
- `makeSwayMaterial` gained an `interactive` mode. The grass tuft material now injects an extra vertex block that:
  - Adds a **layered wind gust** term: cheap smoothed noise `wnlSmoothNoise(vec2(ix*0.06 − uTime*0.25, iz*0.06 + uTime*0.12))` scaled through `smoothstep(0.35, 0.9)`; multiplied into `bendFactor` so the field ripples with traveling gust waves rather than a uniform sine.
  - Reads a **player-position uniform** `uPlayerPos` and **bends blade tips radially away** within `uInteractRadius = 1.35 m`, with a `k = (1 − d/R)^2` falloff. Blades also compress ~25% under the falloff so the field visibly parts under the heroine's feet.
- All new code guarded by `#ifdef USE_INSTANCING` so the grass depth prepass and non-instanced compile paths still succeed.
- Per-frame update: `Game._loop` now writes `character.root.position` into every sway material's `uPlayerPos` uniform (only the interactive grass reads it).

### Mini-map (new HUD, top-right)
- Reuses the offscreen static-layer cache from `Map.js`. New `renderMiniMap(canvas, opts)` blits a `340×340` crop centered on the player into a `180×180` circular-clipped canvas, then stamps the compass-rose player marker at the center; a `2 px` ink border + tiny italic "N" tick complete the parchment tile.
- Redraws at ~15 Hz from an `rAF` loop inside the `<MiniMap>` React component; cheap enough to sit alongside the game render.
- Auto-hides during cinematics (`hudHidden`), pause menu, all overlays (settings/controls/credits/map/confirm-new), choice UI, and endings. Softly fades and scales in/out (`opacity + transform` transitions, 380 ms).
- New Setting: `HUD → Mini-map` toggle (default **On**), persisted in `wnl_settings_v1`, `data-testid="setting-minimap"`.
- **Autosave leaf tick relocated to top-left** (`left: 84 px, top: 22 px`) so it doesn't collide with the mini-map. This is the one HUD element allowed to move per spec.
- README's HUD line updated with a one-liner describing the mini-map.

### Verified — nothing regressed
- Full ending flow (Guardian ending resolved correctly after Phase 6 build).
- Zero console errors after the initial shader fix (`#ifdef USE_INSTANCING` guard on the new interaction block).
- Bundle: **232.9 kB gzipped JS (+1.8 kB from Phase 5) + 12.6 kB gzipped CSS**. Well under jam limits.
- Instance counts unchanged: same ~540 trees / ~150 rocks / 1600 grass tufts / 360 flowers / 60 ferns; no extra draw calls added by Phase 6 (mini-map draws to a 2D canvas, not to the WebGL context).



## Phase 6b additions (Feb 2026 — this session, submission gate)

### Movement feel (root-cause fix, verified)
- Client-reported bugs: **A/D turn jitter** and **Shift sprint speed / animation snapping**.
- Root cause was a **constant-rate yaw clamp** in `Character.updateAnimation` (`facingY += ±maxYawStep`) — this gave instantaneous direction reversals on alternating A/D input and abrupt velocity drops at the end of a 90° turn, and a bang-bang change of `targetSpeed` (walk↔run) that snapped stride/lean/moveBlend derivations.
- Fix — `Character.js`:
  - Replaced the yaw clamp with a **Unity-style critically-damped angle spring** `_smoothDampAngle(current, target, currentVelocity, smoothTime=0.15, dt)` (`_yawVel` state, wrap-safe, anti-overshoot). Result: ~0.30 s ease-in/ease-out settle on a 90° turn, no overshoot, no reversal snap.
  - When no movement input, `_yawVel` is bled off with a `damp(8, dt)` so idle never drifts.
  - `stride`, `lean`, and `moveBlend` continue to read from **actual horizontal velocity** (which is already accel/decel smoothed by the controller) — no dependence on raw input.
- Fix — `CharacterController.js`:
  - `_smoothedWish` (Vector3): raw input wish direction is low-pass smoothed via `THREE.MathUtils.damp` at `lambda = 12` (~0.083 s time constant) before being fed as `targetVel`, then renormalised so diagonals stay ≤ 1. Kills A/D tap twitch and diagonal single-frame flips.
  - `_targetSpeedSm` (scalar): the raw target speed (`walkSpeed | runSpeed`) is low-pass smoothed with asymmetric lambdas (up = 4 ≈ 0.25 s, down = 3 ≈ 0.33 s) before being fed into the accel/decel step. Pressing Shift ramps stride/lean smoothly instead of snapping.
- Verification: character `speed` observed climbing smoothly from 0 → 3.5 (walk) → ramping to ~6.5 on Shift; hint/animation state derived from velocity blends continuously. No axis jitter, no console errors.

### Interactive Tutorial (new, gated to New Game only)
- File: `/app/frontend/src/game/Tutorial.js`.
- 6-step action-driven hint sequence, each with a per-step fallback timeout:
  1. `move` — action: velocity > 0.5 for 1500 ms cumulative; fallback 6000 ms. Text: "WASD — walk the forest".
  2. `sprint` — action: sprinting AND moving for 1000 ms; fallback 5000 ms. Text: "SHIFT — run".
  3. `theme` — timed 4000 ms. Text: "The forest will show you the way — follow what glows and moves".
  4. `map` — action: any map open (M key OR pause-menu Map); fallback 5000 ms. Text: "M — your journal map". Also emits `minimap_pulse` event → CSS keyframe on the mini-map tile.
  5. `seed` — proximity: only shown after entering 4 m of an available seed pickup; dismissed on seed pickup (`seedsPickedUp > 0`) or 6000 ms fallback; skipped entirely after 90 s of wandering without proximity.
  6. `remember` — gated on (seedsPickedUp > 0 OR runT > 60 s); then timed 4000 ms. Text: "The forest remembers your choices… and so will the ending".
- Auto-defers during any of: active cinematic, paused game, menu mode, HUD hidden, ending resolved, final choice open. Re-emits current hint on resume.
- Only starts for **New Game** runs (Continue skips it because the save already carries `tutorial_done: true`). Persisted via `GameState.setFlag('tutorial_done', true)` on completion (rides existing autosave).
- Wired into `Game.js`:
  - `this.tutorial = new Tutorial(this)` in constructor.
  - `this.tutorial.start()` chained into `Cinematic.opening` `onEnd` so the tutorial begins the moment the player has control.
  - `this.tutorial.update(dt)` called each loop tick.
  - Emits `tutorial_hint` events on `gameState`; `Game.js` forwards to `callbacks.onTutorialHint`.
  - Emits `minimap_pulse` events; `Game.js` forwards to `callbacks.onMinimapPulse` which retriggers a CSS pulse on `<MiniMap>`.
- UI (`components/game/Menus.jsx`):
  - New `<TutorialHint text={...}>` component — small floating card, bottom-center, above the interaction prompt. `data-testid="tutorial-hint"`.
  - `<MiniMap pulse={...}>` accepts a monotonically-increasing key; when it bumps, the tile pulses (`is-pulsing` CSS keyframe).
- UI (`components/game/GameApp.jsx`):
  - Boot subscribes `onTutorialHint` → `setTutorialText(text)` and `onMinimapPulse` → `setMinimapPulse(k+1)`.
  - Renders `<TutorialHint>` only while `screen === 'playing' && !pauseMenu && !overlay && !ending && !hudHidden && !choiceOpen`.
  - `M` key handler and the Pause Menu's Map button both call `game.tutorial.markMapOpened()` so the map step dismisses on the natural action.
- Verified: state machine advances through steps correctly under normal action (velocity > 0.5 for 1500 ms → step 1, hold Shift+W → step 2, timeout → step 3, `markMapOpened()` → step 4, seed pickup → step 5). All fallback timers fire when action isn't taken. Zero overlap with cinematics/menus/choice/ending (defer path exercised).

### README (submission rewrite)
- `/app/README.md` rewritten to the definitive 14-section jam submission form.
- Every claim verified against the codebase:
  - Runtime deps (React 19.0.0, ReactDOM 19.0.0, Three.js 0.161.0) — confirmed against `frontend/package.json`.
  - Bundle size (**234.61 kB gzipped JS + 12.70 kB gzipped CSS**) — from fresh `yarn build` output.
  - Build tool (Craco 5) — confirmed against `frontend/package.json` `scripts`.
  - Controls table — confirmed against `Input.js` + `GameApp.jsx` key handlers.
  - Font disclosure — **fixed**: previous README falsely claimed "no `@font-face`, no Google Fonts request". `frontend/src/index.css:5` imports Cormorant Garamond from Google Fonts. README now truthfully discloses this with the SIL OFL 1.1 license and the system serif fallback stack, plus notes on the unused Inter link from CRA scaffolding and the platform's `emergent-main.js` + PostHog snippets (also inherited from the template, not part of the game).
  - AI disclosure — kept as previously agreed (Emergent + Claude for development assistance and code generation; all geometry/textures/animations/audio procedurally generated at runtime; no third-party asset files).
- No changes to gameplay, story, endings, saves, HUD, or any `data-testid` attribute.


### Post-QA fixes (this session)
- **Tutorial deferral on pause (was: MEDIUM bug)**: `Game.pause()` and `Game.resume()` now call `tutorial.setDeferred(true|false)` directly. The main loop's paused branch returns before `tutorial.update()` runs, so the deferral state and hint hide/restore are driven from pause/resume rather than the update tick. New method `Tutorial.setDeferred(v)` hides the hint on enter and re-emits the current step's hint on exit.
- **Tutorial internal state on Continue (was: LOW bug)**: `Tutorial.syncFromSave()` is called at the end of `Game.applyLoadedSave()`. Continue skips the opening cinematic (and therefore `Tutorial.start()` was never called), leaving `_done=false` even when `puzzleFlags.tutorial_done === true`. `syncFromSave()` now sets `_done=true`, `active=false`, and emits `_emitHint(null)` when the flag is present.
- **README section 7 wording**: rephrased the Inter `<link rel="stylesheet">` note to be technically precise ("the CSS file is fetched but no glyphs are ever rasterised because no CSS rule references the family").
- **Rebuild after fixes**: `yarn build` → **234.78 kB gzipped JS** (+179 B) + 12.70 kB CSS. README section 9 updated to match.
- Verified both fixes in headless: pause hides hint + sets `_deferred=true`; resume restores hint text ("WASD — walk the forest") + sets `_deferred=false`. Continue with saved `tutorial_done` produces `{done: true, active: false, hint: null, flag: true}`. Zero console errors.


## Phase 6c — Exploration Polish + Hidden Demo Mode (Feb 2026, this session)

### Exploration polish pass (all 3 items — client-reported)
- **Footstep audio sync — REAL BUG FIXED.** `AudioEngine.updateFootsteps` used to gate on `character.moveBlend` alone (damped low-pass of speed with λ=8, ~130 ms time constant). After the player released movement keys, `moveBlend` + `phase` kept advancing for the ~200 ms velocity-decay window and produced 1–2 trailing footsteps. **Now gates on the ACTUAL horizontal speed** (√(vx²+vz²) ≥ 0.4 m/s AND moveBlend ≥ 0.15) and resets `_lastFootIndex = -1` the moment the gate closes so no phase-index carry-over fires a spurious step on gate re-open. Cadence still scales walk→run→sprint via `phase`. Verified iteration_6 T2 measured 14 crossings walking / 25 crossings sprinting in equal wall-time — cadence does scale correctly.
- **Movement feel — verified, no regression.** Sprint peaks 6.49 m/s (target 6.5). No jitter across A/D taps, sprint on/off, diagonals, or 180° reversals. Zero console errors on scripted movement. No tuning changes made — the last approved fix holds.
- **Map open/close — REAL BUG FIXED.** M was previously blocked by an `if (e.code === 'KeyM' && !overlay)` guard, so pressing M when the map was open did nothing (contradicting the "M — close" hint in the map header). **Now M toggles: closed→open→closed → …** M spam-tolerant (6× rapid presses land on the correct state). Opening the map now calls `document.exitPointerLock()` so the cursor is visible for the Close button; closing via the Close button (a fresh click gesture) re-acquires pointer lock. M is blocked during pause / choice / ending / other overlays (unchanged). Esc still closes map cleanly. Verified via iteration_6 T3-T7 all PASS.
- **Discovered-area map clarity — improved.** In `Map.js`, `inkyBlob` now accepts an optional `lineWidth` argument; visited-area strokes upgraded to `lineWidth: 2.0` and their palette bumped to `fill 0.72α` + `stroke 1.00α` (from 0.55 / 0.85). Unknown-area dashed outline faded from `0.4α` to `0.32α` to widen the contrast gap. New `drawDiscoveredSeal()` helper draws a small "ink seal" dot near each discovered area's label as a first-visit flourish. The mini-map picks these up automatically via the shared static-layer cache.
- **Ambient immersion spot-check** — grass wind + player-bend, tree sway, per-area ambience all confirmed active on iteration_6 screenshots. No regression.
- Verified iteration_6: 10/10 PASS, sprint 6.49 m/s, zero console errors, no issues found.

### Hidden Demo Mode (new — for the 2-minute jam video)
- **New file `/app/frontend/src/game/DemoDirector.js`** — 7-beat scripted director:
  1. `opening` (0–15 s target): real opening cinematic plays; auto-advances on cinematic end.
  2. `controls` (15–35 s): 5 quick tutorial hints (WASD → SHIFT → SPACE → E → M with mini-map pulse) reusing the real `tutorial_hint` event pipeline. No new UI invented.
  3. `seeds` (35–55 s): teleports to (4, y, 12) near Area 1's `seed_1`; objective "Follow what glows"; advances on `gameState.seeds >= 1`.
  4. `bridge` (55–75 s): teleports to (-40, y, -2) near the withered plant, guarantees `seeds ≥ 1`; advances on `puzzleFlags.grow_done`.
  5. `stream` (75–95 s): teleports to (42, y, -12) near the spring; pre-sets `grow_done`; advances on `puzzleFlags.restore_done`.
  6. `grove` (95–110 s): teleports to Area 4; pre-sets `grow_done`, `restore_done`, `bird_freed`, `stones_awoken`; advances when player enters Area 5's radius.
  7. `choice` (110–120 s): teleports to Heartseed; pre-sets `heart_reached`, bumps health to 85; calls `startFinalChoiceSequence()`; advances on `endingResolved`. Ending card = video outro.
- **Fade state machine** (0.5 s to black → teleport → 0.5 s back to clear). Guarded against re-entry mid-fade.
- **Isolation** — never touches localStorage. Verified iteration_7 T1: after a full demo run to Guardian ending, `wnl_save_v1` and `wnl_endings_seen` are **byte-identical** to their seeded values.
- **Activation** — `?demo=1` URL param auto-starts after main menu appears; F9 on main menu starts manually. Neither is discoverable from the UI. Menu text does NOT contain "demo" (case-insensitive).
- **N key** — force-advance (0.5 s fade → next beat's setup → 0.5 s fade in). Also mirrored on `window.__wnl.demo.forceAdvance()` for automation.
- **Esc → ExitDemoConfirm modal** — "Keep playing" / "Exit demo" buttons. Never opens the regular Pause Menu (auto-pause-on-pointer-lock-loss is now gated by `demoActiveRef.current`).
- **Recorder-friendly**:
  - Autosave writes suppressed while `_demoMode === true` (verified iteration_7 T1: no autosave firings, save byte-identical).
  - `applyQuality('high')` called at startDemoFlow to force High for the recording session (persisted `settings` unchanged).
  - HUD kept minimal but intact (health tier, seed count, objective whisper, mini-map, interaction prompts).
- **Game.js gates**:
  - `newGame()` — skips `clearSave()` when `_demoMode`.
  - `_doAutosave()` — early-return when `_demoMode`.
  - `saveNow()` — early-return when `_demoMode`.
  - Ending `onEnd` — skips `recordEndingSeen()` + `clearSave()` when `_demoMode`.
  - `startDemo()` resets in-memory GameState (health, seeds, flags, doneInteractions, visitedAreas, objective) but never localStorage.
  - `stopDemo()` clears `_demoMode`, stops any active cinematic, resets weather baseline, unhides HUD.
- **UI additions** (`Menus.jsx`): `<DemoHUD>` (caption + 7 progress dots + "N — next · Esc — exit" hint + fade overlay), `<ExitDemoConfirm>` (Keep / Exit buttons). Every element has a `data-testid`.
- **CSS additions** (`App.css`): `.wnl-demo-hud`, `.wnl-demo-caption`, `.wnl-demo-dots`, `.wnl-demo-dot` (base / is-done / is-current with 1.35× scale + glow), `.wnl-demo-key-hint`, `.wnl-demo-fade`.
- **README section 12** — "Recording the 2-minute demo" with usage instructions and the plainly-stated note that Emergent cannot export MP4; user records real gameplay with OBS/DevTools/OS recorder.

### Verified iteration_7 — 4/4 PASS
- T1 Demo isolation: **PASS**. Byte-identical save + endings, 6-beat traversal, Guardian ending card visual confirmed.
- T2 F9-from-menu / no-demo-without-activation: **PASS**. Menu innerText contains no "demo"; F9 activates cleanly.
- T3 Esc → Exit Demo → real save intact: **PASS**. `REAL_SAVE` sentinel byte-identical after exit.
- T4 Normal New Game regression: **PASS**. Zero console errors, tutorial hint visible, M-toggle both directions.

### Observed pacing note (headless)
Headless Chromium runs rAF at ~40% wall-clock speed, so I did NOT observe realistic per-beat times in automation. The `targetSecs` values encoded in each beat sum to exactly 120 s (15 + 20 + 20 + 20 + 20 + 15 + 10). Real per-beat pacing will be measured by the creator on their own recorder machine when they capture the video (that's the reason for the N force-advance + `timeoutMs` safety per beat).

