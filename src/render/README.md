# src/render — PixiJS arena viewer (M2)

**Owner:** architect (contract files); WP-M2C (pure half: `timeline/`, `cues/`, `colors/`, `camera/`); WP-M2D (PixiJS half: `viewer/` except `skin.ts`, `skins/`). **Status:** contracts only (M2 contracts phase, branch `m2/contracts`): every function is a typed stub that throws `NotImplementedError`. Design: [`docs/design/_drafts/05-technical-m2.md`](../../docs/design/_drafts/05-technical-m2.md) (a draft awaiting the owner's review). `pixi.js` v8 is a pinned dependency (8.22).

## Responsibility
- Show one round of a fight from its full-level `FightLog` (`core/model` events): the live round the player is watching, or a replay. The log always comes from `core/game` (`liveRoundPlayback`, `roundPlayback`), which runs the same `simulateRound` call headless play uses, so what is shown is the headless result (vis-009, tech-015).
- Playback at 1x/2x/4x with pause (T1), seeking (replays; live only back to the live head), auto-pause stops (P-01), the live rule badge (P-22), team colours, role glyphs (D-J), HP, shield and focus bars, status and Freshness cues, data-driven ability cues and telegraphs (vis-003), a configurable camera.
- It never simulates, never draws randomness, never writes game state and never decides anything a result depends on (T4, tech-009). Calls (P-01, reserved) are re-simulated by core; the viewer only swaps in the new log at the call tick (`replaceLog`, prefix-checked).

## Two halves (tech-017; enforced by tests/architecture)
| Half | Paths | May import | Tested |
| --- | --- | --- | --- |
| Pure | `index.ts`, `types.ts`, `timeline/`, `cues/`, `colors/`, `camera/` | `core/{util, rng, model, content, sim}`; no `pixi.js`, nothing from `viewer/` or `skins/`, no DOM, clock, timer, `crypto` or `Math.random` (rule `render-pure`) | Node / happy-dom, no GPU |
| PixiJS | `viewer/`, `skins/` | the pure half, `pixi.js`, the DOM | logic in happy-dom; drawing in the headless-browser smoke (`scripts/smoke`, WP-M2F) |

- `src/ui` imports `src/render` (the pure index) statically, and only from lazy screen chunks; it loads `src/render/viewer` with `import()` or `import type` only (rule `ui-render-viewer-static`); deep imports are refused (`render-deep-import`).
- `src/render` never imports `core/game`, `src/ui` or `src/platform`; `src/platform` never imports `src/render`.
- `tests/build/bundle.test.ts` keeps PixiJS and the viewer out of the startup JS and holds the viewer chunks to 250 KB gzip (tech-025).

## Planned API (fixed signatures; additions are additive)
**Pure (`src/render`):**
- `indexFightLog(log, content, cues) → PlaybackIndex`; `sampleAt(index, tick, ctx, { reducedMotion }) → ArenaFrameState` (a pure function of the log and the tick: the same state whether reached at 1x, 4x or by seeking); `eventsBetween`, `decisionAt` (the recorded `unit.decide` trace), `autoPauseStops`, `keyMoments`, `samePrefix`.
- `buildCueTable(content) → CueTable` (a cue for every ability and status, derived from their definitions; no ids in code); `TELEGRAPH_MIN_TICKS` (0.3 s).
- `colorsForMatch(home, away, playerSide, palette)`, `contrastRatio`, `parseHexColor`.
- `DEFAULT_CAMERA` (top-down, whole arena: OPEN, owner question Q55), `viewTransform(camera, viewport, arenaCm, focus?)`.
- `DEFAULT_AUTO_PAUSE` (OPEN, Q58). Types: `ArenaRoundContext`, `ArenaFrameState`, `UnitRenderState`, `TeamColors`, `ArenaPalette`, `CameraConfig`, `AutoPauseRules`, `PlaybackStop`, `KeyMoment`, `DecisionSnapshot`, `AbilityCue`, `StatusCue`, `ViewerStats`.

**PixiJS (`src/render/viewer`):**
- `createArenaViewer({ host, content, palette, skin?, camera?, reducedMotion, flashLimitPerSecond?, maxResolution?, onFrame?, hudHz?, onStop?, onSelect? }) → Promise<ArenaViewer>`.
- `ArenaViewer`: `load(log, ctx)`, `replaceLog(log, atTick)`, `play()`, `pause()`, `setSpeed(1 | 2 | 4)`, `seek(tick)`, `tick`, `headTick`, `endTick`, `setAutoPause`, `setCamera`, `setPalette`, `setReducedMotion`, `select`, `setLabels`, `snapshot()`, `stats()`, `destroy()`.
- `ArenaSkin` (`viewer/skin.ts`): `load`, `createBody(info, colors) → BodyVisual`, `createFloor`, `setPalette`, `destroy`. `placeholderSkin()` in `skins/placeholder`.

## Rules for implementers
- **The viewer owns meaning** (tech-020): side ring, role glyph(s), facing wedge, HP/shield/focus bars, status pips, captain crown, rule badge, telegraphs and cues are drawn by the viewer above any skin. A skin draws bodies and the floor only, so a sprite skin (open-032; base + two tinted team-mask layers, art research §6) can never hide a vis-003 cue.
- **One colour source:** role hues, side colours and glyph shapes come from `tokens.css` through `ArenaPalette` (read by the host from computed style), never from literals in code. Role hues mean roles only (04 §3).
- **The HUD is DOM** (tech-018): score, clock, fighter strip, controls, feed and inspector live in `src/ui`, fed by `onFrame` at ≤ 10 Hz. The canvas draws the arena only.
- **No future leaks:** a live round never seeks past `headTick`, and nothing derived from events after the head is exposed.
- **Accessibility** (04 §9): shape before colour, ring style as the colour-free side cue, ≤ 3 flashes a second, reduced motion removes pulses, trails and floating motion but keeps telegraph progress; every control has a key.
- **Performance** (05-technical-m2 §A10): 60 fps target, p95 frame interval ≤ 20 ms at 1x and 4x, our CPU per frame ≤ 4 ms, resolution ≤ 2, objects reused by unit index and event seq, everything released on `load` and `destroy`.
- **PixiJS init** (tech-024): `preference: 'webgl'`, antialias, autoDensity, `resolution: min(devicePixelRatio, 2)`, `preserveDrawingBuffer` (F8 screenshots), ticker dt clamped to 100 ms, stopped while paused.

## Files
| File | Contents |
| --- | --- |
| `index.ts` | the pure public API (architect) |
| `types.ts` | contract types (architect) |
| `timeline/index.ts` | render-state model (WP-M2C) |
| `cues/index.ts` | cue table from content (WP-M2C) |
| `colors/index.ts` | team colours, contrast (WP-M2C) |
| `camera/index.ts` | camera defaults and the world-to-screen transform (WP-M2C) |
| `viewer/index.ts` | `createArenaViewer` (WP-M2D) |
| `viewer/skin.ts` | the skin interface (architect) |
| `skins/placeholder/index.ts` | the M2 placeholder skin (WP-M2D) |

## Known gaps (contracts phase)
- Log format 1 frames have no shield or focus; format 2 (WP-M2A) adds them. Until then `UnitRenderState.shield` and `.focus` are null and the bars hide them.
- Calls are reserved, not built (owner question Q53, P-01): `replaceLog` and `samePrefix` exist for them.
- No sprites, class icons or arena sound in M2 (working assumption, owner question Q59; open-032).
