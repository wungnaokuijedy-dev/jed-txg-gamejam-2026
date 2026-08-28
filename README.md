# Where Nature Leads

> *The forest doesn't tell you where to go. It shows you.*

An atmospheric 10–12 minute exploration game about listening to a forest — nurturing what is fading, restoring what has been broken, and choosing what to do when you find the thing at the heart of it. Built as a single-page WebGL game that runs entirely in the browser: no server, no accounts, no downloads.

Submitted to **TXG Nagaland Game Jam 2026**.

---

## 1. Pitch

You are a young explorer who has stepped off the trail. The forest is quiet, but not empty. A butterfly settles on a withered plant. A stream lies dry. Standing stones sleep in the moss. You are not told what to do — you are shown. Follow what glows. Nurture what fades. And when the forest reveals its Heartseed, decide what to do with it.

Three endings. **The Guardian. The Balance. The Silence.** Each is the shape of how you walked.

---

## 2. Theme integration — *Where Nature Leads*

Every mechanic in the game is nature guiding the player rather than the player commanding nature:

- **Forest Health** is a hidden variable that rises when you nurture (plant seeds, restore the spring, free a tangled bird, awaken stones) and falls when you take from the world (harvest glowing flowers, pluck a mushroom ring, and — as the final act — take the Heartseed). It quietly drives lighting, fog density, ambience mix, and the ending.
- **Navigation is never a HUD arrow.** Butterflies drift toward the next seed. Fireflies gather to lead you into the Grove. A deer looks back and follows you if the forest still trusts you — or wanders off if it doesn't.
- **Restore mechanics** chain into a small journey: a vine bridge grown from a planted seed, a spring un-buried so the stream flows again, ancient standing stones that only glow after the spring returns.
- **The Heartseed** at the centre of the forest offers one final choice — **Take**, **Leave**, or **Share**. The ending is a function of how you played the whole run *plus* that final choice; it is a scale, not a switch.

---

## 3. Controls

| Key | Action |
| --- | --- |
| **W A S D** / Arrow keys | Move |
| **Mouse** | Look (click canvas to lock pointer) |
| **Shift** | Sprint |
| **Space** | Jump |
| **E** | Interact / Skip cinematic |
| **M** | Open the explorer's journal map |
| **Esc** | Pause / release pointer lock |
| **1 / 2 / 3** | Pick a choice (Take / Leave / Share) at the Heartseed |
| **F3** | Toggle debug HUD (FPS / position / area) — **off by default** |

HUD: **top-left** health tier + seeds badge, **top-center** objective whisper, **top-right** journal mini-map (parchment-styled, shows discovered areas + a compass wedge for facing; toggle in **Settings → HUD**), **bottom-center** interaction prompt and, for the first ~20 seconds of a new game, an interactive tutorial hint that responds to your input and defers automatically during cinematics and menus.

---

## 4. Features

- **Third-person character controller** with critically-damped yaw spring (no A/D twitch), smoothed input vector, smoothed sprint ramp, procedural walk / run / jump animation, foot-plant bias, banked-lean into turns, head counter-bob, 4-segment angular-spring ponytail, contact blob shadow.
- **Five interconnected areas** — The Entrance, Whispering Woods, The Silent Stream, The Ancient Grove, The Heart of the Forest — on one compact heightmap with natural terrain boundaries.
- **Procedural forest**: ~540 instanced trees (5 variants), 260 bushes, 90 mushrooms, 150 rocks, 1600 grass tufts with a wind-sway + player-interaction vertex shader (grass parts around your feet), 360 flowers, 60 ferns near the stream, 8 fallen logs, distant mountain silhouettes.
- **Living atmosphere**: exponential fog, hemisphere + directional sun with soft shadows, god-ray light shafts near the entrance, 100 fireflies, 160 pollen motes, 3 flock-spline birds, 220 falling leaves, 14 vertical mist banks, gradient sky dome.
- **Three chained restore puzzles** (grow / restore / follow) with visible world response — vine bridge grows, stream reappears with an animated flow shader, standing stones glow in sequence.
- **Wildlife AI**: 3 ambient deer with wander/alert/flee, a tangled bird you free, a guide entity (deer at high health, firefly trail otherwise), and butterfly hint clusters near seeds.
- **Story delivery**: five prebuilt cinematics (opening, vine growth, guardian revelation, heart-choice arc, ending) with subtitles, letterbox, E-to-skip, and pause-safe camera control.
- **Final choice + three endings** driven by accumulated Forest Health + choice modifier (Take −15, Leave +15, Share +5). Bands: ≥ 75 Guardian, 40–74 Balance, < 40 Silence.
- **Dynamic weather** (mist → light rain → clearing → break/mist) tied to story beats, not areas.
- **100% procedural WebAudio** — wind, insects, water, rain, footsteps (per-area timbre), birds, autosave chime, seed pickup, vine growth, water release, stone hum, gate open, choice appear, UI hover / click; music beds and ending stings synthesised from oscillators + in-memory noise buffers. **Zero audio files ship or are fetched.**
- **Menus**: Main Menu (live 3D forest behind), Continue / New Game (with overwrite confirm), Settings (Audio × 4 buses, Camera Sensitivity, Invert Y, Interaction Hints, Subtitles, Graphics Quality Low/Medium/High with auto-degrade watcher, Text Size S/M/L, Screen Shake, High Contrast UI, Mini-map toggle), Controls, Credits, Pause Menu (Resume / Map / Settings / Restart Area / Main Menu), Explorer's Journal map (full-page + mini-map), Ending card.
- **Save**: single-slot `localStorage` autosave every 30 s (plus event-driven on flag/seed changes, suppressed during cinematics/choice/ending). Continue re-applies the world visually (vine grown, stream flowing, stones lit, gate open) without replaying cinematics you already saw.
- **Interactive tutorial** — a ~20-second action-driven hint sequence at the start of a New Game only. Six steps (move, sprint, theme line, map, seed proximity, closing beat). Each step advances on the matching action *or* a per-step fallback timeout. Defers automatically during cinematics, menus, choice UI, and endings. Persists a `tutorial_done` flag so refresh + Continue never replays it.
- **Accessibility**: text size S/M/L, high-contrast UI, subtitles toggle, screen-shake toggle, interaction-hint verbosity toggle.
- **Stability**: WebGL context-loss handler with a friendly reload prompt, corrupt-localStorage guards on all three keys, out-of-bounds respawn safety, pointer-lock loss → auto-pause.

---

## 5. Technology

Everything ships as static files. Runtime is 100% client-side.

| Runtime dependency | Version | License |
| --- | --- | --- |
| React | 19.0.0 | MIT |
| ReactDOM | 19.0.0 | MIT |
| Three.js | 0.161.0 | MIT |
| WebAudio API | (browser) | Web standard |
| HTML5 Canvas 2D | (browser) | Web standard |
| WebGL 2 | (browser) | Web standard |

**Only React, ReactDOM, and Three.js actually appear in the runtime bundle.** All other packages listed in `frontend/package.json` (Radix UI, Tailwind CSS, Craco, react-hook-form, etc.) come from the Create-React-App template and are dev-only or tree-shaken out — none of the shadcn/Radix components are imported by the game.

| Dev-only tooling | License |
| --- | --- |
| react-scripts + Craco 5 | MIT |
| Tailwind CSS + PostCSS | MIT |
| Node / Yarn | MIT / BSD-2 |

**Client-side only.** No backend calls. The FastAPI template in `/app/backend` is untouched, un-imported, and unused by the game. Saves go to `localStorage` under three keys: `wnl_save_v1`, `wnl_settings_v1`, `wnl_endings_seen`.

---

## 6. AI disclosure (jam-required)

- Built with the **Emergent AI agent platform** using **Anthropic Claude** for development assistance and code generation across all phases (character rig, procedural animation, camera, terrain, vegetation, puzzles, cinematics, weather, endings, procedural WebAudio, menus, save system, mini-map, tutorial).
- **All 3D geometry, textures, animations, and audio in the game are procedurally generated at runtime by code written for this project.** Specifically:
  - Meshes are built from Three.js primitives (BoxGeometry, CylinderGeometry, SphereGeometry, CapsuleGeometry, LatheGeometry, custom BufferGeometry, InstancedMesh for vegetation).
  - The heroine's facial features (eyes, brows, mouth, blush) are painted onto a CanvasTexture at runtime — **no image files ship**.
  - All animations (walk, run, jump squash, ponytail physics, procedural facing spring, kneel/reach pose) are hand-driven transforms on the rig — **no `.gltf`, `.fbx`, `.glb`, or animation files**.
  - The full audio bed (wind, insects, water, rain, birds, footsteps per area, music beds and ending stings, all SFX) is synthesised by `AudioEngine.js` using `OscillatorNode`, `AudioBufferSourceNode` fed with in-memory white/brown-noise buffers, `BiquadFilterNode`, and `GainNode`. **No `.mp3`, `.wav`, `.ogg`, or any audio file is shipped or fetched.**
  - The explorer's journal map (full page and mini-map) is drawn programmatically onto a `CanvasRenderingContext2D` at runtime (parchment grain via seeded random rectangles + inky organic blob paths + area glyphs).
- No third-party art, sound, model, or animation assets of any kind ship with the build.

---

## 7. Third-party assets & fonts

**No image / model / audio / animation asset files ship with the game.** The full third-party asset surface is:

- **Cormorant Garamond** — loaded from Google Fonts at runtime via a `@import url('...fonts.googleapis.com...')` rule in `frontend/src/index.css`. Cormorant Garamond is licensed under the **SIL Open Font License 1.1** (freely redistributable, embeddable, and modifiable). If the font fails to load (offline / blocked network), the CSS falls straight through the stack: `'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', 'Georgia', serif`. All of those are system-provided on the standard desktop OSes we tested, so the game is fully readable without a network fetch.
- No other webfonts are loaded by the game. (An unused `Inter` `<link rel="stylesheet">` exists in `frontend/public/index.html` as CRA scaffolding boilerplate; the CSS file is fetched but no glyphs are ever rasterised because no CSS rule references the family. It can be removed for offline distribution.)

The `frontend/public/index.html` file also includes the Emergent platform's `emergent-main.js` script and a PostHog analytics snippet inherited from the deployment template. Neither is part of the game runtime, neither is required for gameplay, and both are inherited from the platform scaffolding — they can be removed for offline distribution without affecting a single frame of the experience.

---

## 8. How to run

### Play the hosted build

Open the URL provided with the jam submission in a recent desktop browser (Chrome / Edge / Firefox). Click **New Game** (or **Continue**). That's the entire install step.

### Build and serve locally

```bash
cd frontend
yarn install
yarn build                      # → frontend/build/
# Serve the static folder with anything — for example:
npx serve -s build              # then open http://localhost:3000
# or:
python3 -m http.server 3000 --directory build
```

Nothing else is required. There is no `.env` to configure, no backend to start.

### Development server (hot reload)

```bash
cd frontend
yarn install
yarn start                      # opens http://localhost:3000
```

---

## 9. Build size

Production bundle from `yarn build` (this submission):

| Asset | Raw | Gzipped |
| --- | --- | --- |
| `main.<hash>.js` | 895.15 kB | **234.78 kB** |
| `main.<hash>.css` | 67.57 kB | **12.70 kB** |

**Total shipped bundle: ~247 kB gzipped.** Well under any reasonable jam upload limit. No source-map dependency at runtime.

---

## 10. System requirements

- **Desktop browser only.** The game requires a keyboard, a mouse, and Pointer Lock. Not designed for phones or tablets.
- Recent **Chrome, Edge, or Firefox** — any browser with **WebGL 2** and the **WebAudio API** (approximately Chrome 90+, Firefox 90+, Edge 90+).
- **Hardware-accelerated WebGL 2**. If the framerate is unusable, check `chrome://gpu` (or your browser's equivalent).
- A mid-range integrated GPU or better is recommended for the **High** graphics preset. If the framerate stays below ~30 FPS for ~5 seconds, the game will step the preset down once (High → Medium → Low) and show a quiet notice; you can also pick a lower preset manually from **Settings → Graphics**.
- The game does not use `<audio>` or `<video>` elements. Audio is created via WebAudio only, so no MSE / codec support is required.

---

## 11. Testing hooks

For QA automation, the game exposes read-only handles on `window.__wnl`:

- `window.__wnl` — the `Game` instance.
- `window.__wnl.gameState` — health, seeds, `puzzleFlags`, `doneInteractions`, `visitedAreas`, `choiceMade`, `endingKind`.
- `window.__wnl.audio` — the AudioEngine. `.debug()` returns the current bus/layer/mode state.
- `window.__wnl.settings.get(key)` / `.set({ key: value })` — settings store; changes apply immediately and persist to `localStorage.wnl_settings_v1`.
- `window.__wnl.tutorial` — the Tutorial state machine (has `.markMapOpened()` for the map step).
- `window.__wnl.isPaused()` / `.pause()` / `.resume()`.
- `window.__wnl.startFinalChoiceSequence()`.
- `window.__wnl.cinematic.stop()` — force-end any active cinematic (bypasses `minSkipT`).

Every interactive UI element carries a `data-testid` attribute. See `/app/memory/test_credentials.md` for the full list.

---

## 12. Known limitations

- **Desktop only.** No touch controls, no mobile layout, no gamepad. Pointer Lock is required for the mouse-look camera.
- **Pointer-lock quirks.** Some browsers rate-limit the re-acquisition of pointer lock after Esc — the pause menu handles this cleanly, but rapid Esc mashing may briefly wait a beat before letting you re-lock.
- **Single-slot save.** One save per browser. Any resolved ending clears the save automatically.
- **Save fast-forwards, doesn't re-play.** Continuing a saved run re-applies flags visually (vine bridge grown, stream flowing, stones glowing, heart gate open) but does not re-play cinematics you already saw.
- **Auto-degrade is one-shot.** The performance watcher will lower Quality at most once per session; if you then set it back to High manually, the watcher won't step it down again automatically.
- **Autoplay policy.** `AudioContext` is created on your first menu button click. In normal play this is always Continue or New Game, so audio initialises before you enter the forest.
- **Heart-choice arc camera** occasionally clips a tall trunk in the composition on the way in — cosmetically acceptable for jam scope.

---

## 13. Credits

- Game by **Wungnaokui Awungshi** — Solo Developer — [@princejedd](https://www.indieconnect.in/@princejedd)
- Development assistance & code generation: **Emergent AI (Anthropic Claude)** *(fully disclosed in section 6 above, per jam rules)*
- Engine: **Three.js** (MIT) · **React** (MIT)
- Typography: **Cormorant Garamond** (SIL OFL 1.1) with system serif fallback stack
- Art, animation, audio: **100% procedural — no third-party asset files**
- Made for **TXG Nagaland Game Jam 2026**

---

## 14. License

The source code for this game is released under the **MIT License**. Third-party dependencies retain their original licenses (all MIT or SIL OFL; see section 5 and section 7).
