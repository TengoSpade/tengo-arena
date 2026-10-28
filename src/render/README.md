# src/render — PixiJS arena viewer (M2)

**Owner:** architect (contract files); WP-M2C (pure half: `timeline/`, `cues/`, `colors/`, `camera/`); WP-M2D (PixiJS half: `viewer/` except `skin.ts`, `skins/`). **Status (2026-10-28):** the contract is on main (d1d666e), with the arena palette additions of §A18. The pure half (`timeline/`, `cues/`, `colors/`, `camera/`) is implemented by WP-M2C on `m2/wp-c-render-model`; its guarantees are in `timeline/README.md` there, and it replaces the stubs on main when it merges. The PixiJS half (`viewer/`, `skins/`) is WP-M2D's and is still a stub on main. Design: [`docs/design/_drafts/05-technical-m2.md`](../../docs/design/_drafts/05-technical-m2.md) (draft revision 3: the owner approved Q53–Q60 on 2026-10-27). `pixi.js` v8 is a pinned dependency (8.22).

## Responsibility
- Show one round of a fight from its full-level `FightLog` (`core/model` events): the live round the player is watching, or a replay. The log always comes from `core/game` (`liveRoundPlayback`, `roundPlayback`), which runs the same `simulateRound` call headless play uses, so what is shown is the headless result (vis-009, tech-015).
- Playback at 1x/2x/4x with pause (T1), seeking (replays; live only back to the live head), auto-pause stops (P-01), the live rule badge (P-22), team colours, role glyphs (D-J), HP, shield and focus bars, status and Freshness cues, data-driven ability cues and telegraphs (vis-003), a configurable camera.
- It never simulates, never draws randomness, never writes game state and never decides anything a result depends on (T4, tech-009); it may import core/sim as types only (rule `render-sim-value`). Calls (P-01, staged after M2, Q53) are re-simulated by core; the viewer only swaps in the new log at the call tick (`replaceLog`, prefix-checked).
- No future leaks (review B1): for a live round nothing leaves src/render beyond the live head. A live index and a live viewer have no end tick (null) until it is reached, key moments and auto-pause stops are bounded by `untilTick`, and the UI reads live round data only through the viewer (`onFrame`, `keyMoments()`, `decisionAt()`).

## Two halves (tech-017; enforced by tests/architecture)
| Half | Paths | May import | Tested |
| --- | --- | --- | --- |
| Pure | `index.ts`, `types.ts`, `timeline/`, `cues/`, `colors/`, `camera/` | `core/{util, rng, model, content}`, core/sim types; no `pixi.js`, nothing from `viewer/` or `skins/`, no DOM, clock, timer, `matchMedia`, `getComputedStyle`, `devicePixelRatio`, `ResizeObserver`, `crypto` or `Math.random` (rule `render-pure`) | typechecked by `tsconfig.core.json` (no DOM types); tests in the vitest "core" project (Node), no GPU |
| PixiJS | `viewer/`, `skins/` | the pure half, `pixi.js`, the DOM, core/sim types | logic in happy-dom (vitest "ui") with an injected fake `Timeline`; drawing in the headless-browser smoke on the `smoke` build mode (`scripts/smoke`, WP-M2F) |

- `src/ui` imports `src/render` (the pure index) statically, and only from lazy screen chunks; it loads `src/render/viewer` with `import()` or `import type` only (rule `ui-render-viewer-static`); deep imports are refused (`render-deep-import`).
- `src/render` never imports `core/game`, `src/ui` or `src/platform`; `src/platform` never imports `src/render`.
- `tests/build/bundle.test.ts` keeps PixiJS and the viewer out of the startup JS and holds the viewer chunks to 250 KB gzip (tech-025).

## Planned API (fixed signatures; additions are additive)
**Pure (`src/render`):**
- `indexFightLog(log, content, cues, 'live' | 'replay') → PlaybackIndex` (live: `endTick` null); `sampleAt(index, tick, ctx, { reducedMotion }) → ArenaFrameState` (a pure function of the log and the tick: the same state whether reached at 1x, 4x or by seeking; `endTick` set only once reached); `eventsBetween`, `decisionAt` (the recorded `unit.decide` trace), `autoPauseStops(…, untilTick)`, `keyMoments(…, untilTick)`, `samePrefix`; `Timeline` / `timeline` (the model as one injectable object).
- `buildCueTable(content) → CueTable` (derived from definitions with an exhaustive switch over the 17 effect types; a visible release cue for each of the 84 active abilities; a pip for each of the 34 statuses; no ids in code); `TELEGRAPH_MIN_TICKS` (0.3 s).
- `colorsForMatch(home, away, playerSide, palette)`, `contrastRatio`, `parseHexColor`.
- `DEFAULT_CAMERA` (top-down, whole arena, no follow: approved, Q55), `viewTransform(camera, viewport, arenaCm, focus?)`.
- `DEFAULT_AUTO_PAUSE` (approved, Q58). Types: `ArenaRoundContext`, `ArenaFrameState`, `UnitRenderState`, `TeamColors`, `ArenaPalette`, `CameraConfig`, `AutoPauseRules`, `PlaybackStop`, `KeyMoment`, `DecisionSnapshot`, `AbilityCue`, `StatusCue`, `ViewerStats`.

**PixiJS (`src/render/viewer`):**
- `createArenaViewer({ host, content, palette, skin?, camera?, reducedMotion, flashLimitPerSecond?, maxResolution?, onFrame?, hudHz?, onStop?, onSelect?, timeline? }) → Promise<ArenaViewer>`.
- `ArenaViewer`: `load(log, ctx): Promise<void>` (awaits `skin.prepare`), `replaceLog(log, atTick)`, `play()`, `pause()`, `setSpeed(1 | 2 | 4)`, `seek(tick)`, `tick`, `headTick`, `endTick` (live: null until reached), `keyMoments()` and `decisionAt(unit)` (bounded by the head), `setAutoPause`, `setCamera`, `setPalette`, `setReducedMotion`, `select`, `setLabels`, `snapshot()`, `stats()`, `destroy()`.
- Contract amendment (§A19, `types.ts`): `ArenaViewerOptionExtras` (`cues?`, `viewTransform?`, `tabStop?`) and `ArenaViewerDecisionHistory` (`decisionsUpTo?(unit, tick?)`, bounded by the head), which the viewer's own types extend; `KeyMoment`'s unit convention (acting fighter, then the one it happened to: for a down, the credited fighter and the fallen).
- `ArenaSkin` (`viewer/skin.ts`): `load` (once per viewer), `prepare(units)` (only the classes of the match shown, within the texture budget), `createBody(info, colors) → BodyVisual`, `createFloor`, `setPalette`, `destroy`. The viewer translates and depth-sorts bodies and never rotates them; a body picks its direction or frame from `UnitRenderState.facing`. `placeholderSkin()` in `skins/placeholder`.

## Rules for implementers
- **The viewer owns meaning** (tech-020): side ring, role glyph(s), facing wedge, HP/shield/focus bars, status pips, captain crown, rule badge, telegraphs and cues are drawn by the viewer above any skin. A skin draws bodies and the floor only, so a sprite skin (open-032; base + two tinted team-mask layers, art research §6) can never hide a vis-003 cue.
- **One colour source:** role hues, side colours and glyph shapes come from `tokens.css` through `ArenaPalette` (read by the host from computed style), never from literals in code. Role hues mean roles only (04 §3).
- **Palette and metrics** (05-technical-m2 §A18): every arena colour (plate, ink, edge, line, HP, track, shield, focus, select, telegraph, hit flash, the five fx tones, the pip colours and glyphs) and every size, alpha and duration (`palette.metrics`) comes from the designer's tokens (`tokens.css` arena group, `mockups/arena-notes.md`); the token layout is notes §1. Rings, the glyph plate, bars and pips reach 3:1 on the floor; body colours stay the clubs' exact colours.
- **The HUD is DOM** (tech-018): score, clock, fighter strip, controls, feed and inspector live in `src/ui`, fed by `onFrame` at ≤ 10 Hz. The canvas draws the arena only.
- **No future leaks:** a live round never seeks past `headTick`, and nothing derived from events after the head is exposed (`untilTick`-bounded queries, a null live end tick; the UI's truncated-log equivalence test checks it). Live callers of `sampleAt` **must** pass `knownUntilTick` = the live head, or positions and effect anchors may look one frame ahead (§A19).
- **Reduced motion and effect ages:** under reduced motion an effect at `age` 1 is drawn static at its end state, never faded by 1 − age (numbers alone fade in place).
- **Accessibility** (04 §9): shape before colour, ring style as the colour-free side cue, ≤ 3 flashes a second, reduced motion removes pulses, trails and floating motion but keeps telegraph progress; every control has a key.
- **Performance** (05-technical-m2 §A10): 60 fps target, p95 frame interval ≤ 20 ms at 1x and 4x, our CPU per frame ≤ 4 ms, resolution ≤ 2, objects reused by unit index and event seq, everything released on `load` and `destroy`.
- **PixiJS init** (tech-024): `preference: 'webgl'`, antialias, autoDensity, `resolution: min(devicePixelRatio, 2)`, `preserveDrawingBuffer` (F8 screenshots), ticker dt clamped to 100 ms, stopped while paused.

## Files
| File | Contents |
| --- | --- |
| `index.ts` | the pure public API (architect) |
| `types.ts` | contract types (architect) |
| `timeline/` | render-state model (WP-M2C): `index.ts` (the contract and the injectable `timeline`), `build.ts` (indexing), `frames.ts` (frame table), `sample.ts` (`sampleAt`), `queries.ts` (bounded queries), `effects.ts` (effect lifetimes and ids), `data.ts`, `model.ts`, `util.ts`; `fixtures/` (seven real full-level rounds and `make-fixtures.mjs`), `support.mts` (test support); `README.md` (what the model guarantees) |
| `cues/index.ts` | cue table from content, the exhaustive effect switches, `TELEGRAPH_MIN_TICKS` (WP-M2C) |
| `colors/index.ts` | team colours (`colorsForMatch`, rings at 3:1, body colours exact, §A18), contrast and CIEDE2000, `DEFAULT_ARENA_PALETTES`, `defaultArenaPalette`, `PRIMARY_CLASH_DELTA_E` (WP-M2C; all re-exported by `index.ts`) |
| `camera/index.ts` | `DEFAULT_CAMERA` (padding 16 px for the wall, §A18) and the world-to-screen transform (WP-M2C) |
| `viewer/index.ts` | `createArenaViewer` (WP-M2D) |
| `viewer/skin.ts` | the skin interface (architect) |
| `skins/placeholder/index.ts` | the M2 placeholder skin (WP-M2D) |

## Known gaps (on main until the packages merge)
- Log format 1 frames have no shield or focus; format 2 (WP-M2A) adds them. Until then `UnitRenderState.shield` and `.focus` are null and the bars hide them.
- Calls are staged after M2 (approved, Q53, P-01): `replaceLog` and `samePrefix` exist for them.
- No sprites, class icons or arena sound in M2 (approved, Q59; open-032).
