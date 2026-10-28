# src/render/viewer and src/render/skins: the PixiJS half (WP-M2D)

**Owner:** WP-M2D (`viewer/**` except `skin.ts`, and `skins/**`). The contract files (`viewer/skin.ts`, `../types.ts`, `../index.ts`, `../README.md`) are the architect's. Design: [`05-technical-m2.md`](../../../docs/design/_drafts/05-technical-m2.md) §A5, §A9, §A10; art direction 04 §3, §4, §7, §9, §10 (asset-006).

`createArenaViewer(options)` plays one round's full-level `FightLog` against a playback clock. It never simulates, draws randomness or writes game state. Each frame it samples `Timeline.sampleAt` at the clock's tick and draws the `ArenaFrameState`; the HUD is DOM (`src/ui`), fed by `onFrame` at `hudHz`.

## Files
| File | What it is | Tested in |
| --- | --- | --- |
| `index.ts` | `createArenaViewer` and the contract types: PixiJS `Application.init` (webgl, antialias, autoDensity, resolution min(DPR, 2), `preserveDrawingBuffer`, own ticker that stops while paused), ResizeObserver and DPR watching, `snapshot()`, `stats()`, `destroy()` | the browser (`dev/`) |
| `core.ts` | `ViewerCore`: clock, round index, auto-pause stops, live head, bounded `keyMoments()`/`decisionAt()`, `replaceLog`, HUD feed, selection. No PixiJS | happy-dom, fake timeline (`core.test.ts`) |
| `clock.ts` | `PlaybackClock`: tick += dt × speed ÷ 50, dt clamp 100 ms, seek limits, live head, end unknown until reached | `clock.test.ts` |
| `scene/arena-scene.ts` | The scene: layers, camera ease, floor, row markers, overtime edge, hit-testing | `scene/arena-scene.test.ts` |
| `scene/token.ts` | One fighter: ring, wedge, role plate and glyphs, bars, cast bar, pips, rule badge, crown, labels, hit flash | same |
| `scene/world.ts` | Zones, telegraphs, projectiles | same |
| `scene/effects.ts` | The 26 effect kinds (exhaustive `Record`s), number merging, flash admission | same |
| `scene/text.ts` | `TextFactory`: PixiJS BitmapText over pre-installed fonts (white fill, black outline, tinted), plus a stub for tests | n/a |
| `flash-limiter.ts`, `pool.ts`, `stats.ts`, `palette.ts`, `host.ts`, `input.ts`, `destroy.ts` | small helpers | unit tests |
| `testing/` | Test support (not in the viewer chunk): a scripted fake `Timeline`, fake content/cues/transform/context, a headless assembly with a manual clock | |
| `dev/harness.html` | A dev page driving the real viewer with the fake timeline in a real browser (canvas capture, fps, heap checks). Not in the production build | |
| `../skins/placeholder/` | The M2 skin: a disc with a rim per fighter (flattened, 40% opacity when downed), flat floor with a centre line and walls. No assets | `placeholder.test.ts` |

## Layer order (bottom to top)
floor (skin) · row markers (kickoff only) · zones · telegraphs · low cues (ground rings, links) · **bodies with their token marks, depth-sorted by screen y** · projectiles · high cues (swings, beams, numbers, callouts) · overlay (bars, pips, badges: never hidden by a body) · overtime edge.

The viewer translates body containers and **never rotates, scales or mirrors them**; a body picks its direction or frame from `UnitRenderState.facing`. Only the viewer's own wedge turns. Everything with game meaning (side ring solid/double, role glyphs, wedge, HP/shield/focus, cast bar, pips, rule badge, crown, telegraphs, cues) is drawn by the viewer above the skin.

## Rules the code keeps
- **No future leaks (review B1).** A live round never seeks past `headTick`. `endTick` is null until playback reaches the end. `keyMoments()` is asked up to the head; auto-pause stops are looked up only to the end of the frame being drawn. A stop fires when playback crosses it going forward (never when seeking, never again for the tick it resumes from). After a rewind, a live round stops at its head (`{ kind: 'head' }`).
- **State is a function of (log, tick).** Seeking and playing show the same picture. Presentation-only effects (flash admission, number merging) use wall time and never feed back.
- **Flashes.** Per fighter, flash starts are at least 1000/limit ms apart in wall time (3 a second by default), so 4x cannot raise the rate; a refused flash draws dimmed, never dropped. No flash under reduced motion or while paused/seeking. No full-screen flash exists; overtime is a steady thin edge.
- **Numbers.** At most one per fighter per 100 ms of wall time; later ones add into the first.
- **Reduced motion.** `sampleAt` drops the motion-only effects and zeroes the badge pulse; the scene also pins pulses and growth to their settled look, shows no trails, no camera ease, no body easing. Telegraph progress stays.
- **Objects.** Pooled by unit index and effect id (`KeyedPool`); static geometry is redrawn only when zoom, palette or interface scale change.
- **Teardown.** Everything is destroyed with `DESTROY_ALL` (`{ children: true, context: true }`). PixiJS v8 destroys a Graphics' own context only when called with no options or `context: true`; plain `{ children: true }` leaked about 0.65 MB per round (found by the 20-round check). `destroy()` also loses the WebGL context.
- **Colour.** From the `ArenaPalette` only (plus colours derived from it: bar tracks, glyph plates). Canvas text is always light fill on a black outline (tinted from the palette, lifted on the light theme).

## Additive options (all optional)
`cues` (a cue table; default `buildCueTable(content)`), `viewTransform` (default the real camera), `canvasKeys` (default true: Tab / Shift+Tab walk the tokens while the canvas has focus, Escape clears the selection; pass false if the UI binds them). `defaultArenaPalette(theme)` is exported for hosts without tokens.

## Checks and measurements
- **Logic (happy-dom, no GPU):** `npm test` runs the clock, core, scene and skin tests above; they use `testing/fake-timeline.ts` and a real `ArenaScene` over scene-graph objects.
- **Real browser:** serve the repo with `npx vite --port 5299 --strictPort` and open `/src/render/viewer/dev/harness.html` (`?theme=light&reduced=1&speed=4&play=1&tick=320&labels=all&select=2`). `window.__harness` exposes `capture()`, `liveCanvasDataUrl()` (what the F8 screenshot reads), `measure(ms, speed)`, `rounds(n, playMs)` and `cycle(n)`.
- **Chunk:** PixiJS plus the viewer with the contract stubs for the model builds to about 184 KB gzip (budget 250 KB); the real model and cues add to it.
- **Measured here** (headless Edge 156 over CDP; the Claude browser pane, an RTX 5060): WebGL capture works (snapshot PNG and `canvas.toDataURL()` both non-blank, also at DPR 2); 60 fps median at 1920 × 1080 at 1x and 4x with p95 frame interval 16.9 ms; our CPU per frame p50 0.2 ms, p95 0.5 ms; heap after GC flat over round loads (+0.45 MB over 50 loads, the fake timeline call log) and plateauing over 50 create/destroy cycles (no canvas left behind, no WebGL context warning). Not the reference machine (Q35): the 60 fps criterion is measured by WP-M2F on the smoke build.

## Known gaps
- Text is BitmapText from a few pre-installed fonts at the renderer's resolution at creation; moving to a higher-DPR monitor keeps the old glyph resolution until the next viewer.
- The interface scale (`--ui-scale`) is read at creation, on resize and on `setPalette`, not by observing the style.
- `drawCalls` in `stats()` is null (PixiJS v8 exposes no counter).
- Oblique projection draws circles as ellipses for ground marks; effects stay screen-space.
