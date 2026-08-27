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

