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
