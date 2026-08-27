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
- **Procedural low-poly FEMALE anime-inspired adventurer** (dark ponytail with 4-segment angular-spring chain, cream hooded jacket + hood-down-on-back, dark shorts, boots, brown backpack, gloves, subtle anime eye + brow + mouth marks) built from primitives. Signature ponytail responds to horizontal velocity (inertial lag), yaw rate (whip on turns), and gentle wind noise while idle. Rig structure (all named Groups: shoulderL/R, elbowL/R, hipL/R, kneeL/R, headPivot, body, model) is stable so future kneel/inspect/interact poses can override joint rotations without mesh rework.
- **Hand-rolled procedural animation** blended via lerped parameters (idle bob, walk/run swing scaling with speed, jump anticipation + air pose + landing squash-and-stretch).
- **Camera-relative WASD/Shift/Space movement** with smooth accel/decel, gravity, coyote time + jump buffering, analytic terrain grounding (no per-frame raycast), radial obstacle collision against trunks/rocks/stones/log.
- **Third-person orbit camera** (kept — did not need the first-person fallback) with pointer lock (best-effort — game plays even if lock is refused), lerped follow, terrain de-clip via multi-sample terrain-height rays, click-to-resume when lock is lost. Hardened against pointer-lock acquisition delta spikes (first mousemove after lock is swallowed; per-event delta clamped to ±120 px).
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
- P0 next: audio (ambient forest bed, footsteps, wind), vine-cutting puzzle for Area 2, water-restoration puzzle for Area 3, standing-stones activation puzzle for Area 4, "Heart of the Forest" gate + finale for Area 5.
- P1: wildlife AI (birds, deer), Forest Health mechanic driving mood-lerp (MOODS.DAWN_COOL → MOODS.WARM_HEALED as puzzles solve), inventory / interaction indicator, menu / pause / options, localStorage save.
- P2: subtle god-ray shafts near Entrance, footprint decals, dynamic time-of-day, first-person toggle fallback (implemented ability retained as a stability escape hatch), photo-mode.

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

## Third-person status
Kept — did not need the first-person fallback. Camera de-clip and analytic ground follow produce a stable, non-jittery character.
