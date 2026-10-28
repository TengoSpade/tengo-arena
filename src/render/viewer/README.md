# src/render/viewer and src/render/skins: the PixiJS half (WP-M2D)

**Owner:** WP-M2D (`viewer/**` except `skin.ts`, and `skins/**`). The contract files (`viewer/skin.ts`, `../types.ts`, `../index.ts`, `../README.md`) are the architect's. Design: [`05-technical-m2.md`](../../../docs/design/_drafts/05-technical-m2.md) §A5, §A9, §A10, §A18; art direction 04 §3, §4, §7, §9, §10 (asset-006); the UI designer's specification: [`docs/design/mockups/arena-notes.md`](../../../docs/design/mockups/arena-notes.md) §1 and `src/ui/styles/components.css` §25 (the `.atoken`, `.abar`, `.apip`, `.atele`, `.aimpact`, `.anum`, `.acallout` rules are the geometry the viewer draws).

`createArenaViewer(options)` plays one round's full-level `FightLog` against a playback clock. It never simulates, draws randomness or writes game state. Each frame it samples `Timeline.sampleAt` at the clock's tick and draws the `ArenaFrameState`; the HUD is DOM (`src/ui`), fed by `onFrame` at `hudHz`.

## Files
| File | What it is | Tested in |
| --- | --- | --- |
| `index.ts` | `createArenaViewer` and the contract types: PixiJS `Application.init` (webgl, antialias, autoDensity, resolution min(DPR, 2), `preserveDrawingBuffer`, own ticker that stops while paused), ResizeObserver and DPR watching, `snapshot()`, `stats()`, `destroy()` | the browser (`dev/`) |
| `core.ts` | `ViewerCore`: clock, round index, auto-pause stops, live head, bounded `keyMoments()`/`decisionAt()`, `replaceLog`, HUD feed, click selection. No PixiJS | happy-dom, fake timeline (`core.test.ts`) |
| `clock.ts` | `PlaybackClock`: tick += dt × speed ÷ 50, dt clamp 100 ms, seek limits, live head, end unknown until reached | `clock.test.ts` |
| `scene/arena-scene.ts` | The scene: layers, camera ease, floor, row markers, overtime edge, hit-testing | `scene/arena-scene.test.ts`, `scene/design.test.ts` |
| `scene/token.ts` | One fighter to the designer's token: ring with keylines, wedge, glyph plate, hit wash, brackets, down diamond; the stack of focus bar, HP bar with hatched shield, badge and pips, cast bar, tag, name; crown chip | same |
| `scene/chip.ts`, `scene/glyphs.ts` | Plate chips with text; glyphs from the palette's SVG | same |
| `scene/world.ts` | Zones, telegraphs (caster's ring colour and style), projectiles (arrows) | same |
| `scene/effects.ts` | The 26 effect kinds (exhaustive `Record`s), tone shapes, signed numbers, number merging, flash admission | same |
| `scene/text.ts` | `TextFactory`: PixiJS BitmapText over pre-installed fonts (a tinted white label font; a font per tone with the plate stroke baked in for numbers), plus a stub for tests | n/a |
| `flash-limiter.ts`, `pool.ts`, `stats.ts`, `palette.ts`, `host.ts`, `input.ts`, `destroy.ts` | small helpers | unit tests |
| `testing/` | Test support (not in the viewer chunk): a scripted fake `Timeline`, fake content/cues/transform/context, a headless assembly with a manual clock | |
| `dev/harness.html` | A dev page driving the real viewer with the fake timeline in a real browser (canvas capture, fps, heap checks). Not in the production build | |
| `../skins/placeholder/` | The M2 skin: a disc with the club primary and a secondary rim per fighter (flattened to 60% at the palette's down opacity when downed), flat floor, centre line and wall band. No assets | `placeholder.test.ts` |

## Layer order (bottom to top)
floor and wall band (skin) · row markers (faint dashed lines; labels only at kickoff) · zones · telegraphs · low cues · **bodies with their token marks, depth-sorted by screen y** · projectiles · high cues (impacts, numbers, callouts) · overlay (bars, pips, badges: never hidden by a body) · overtime edge.

The viewer translates body containers and **never rotates, scales or mirrors them**; a body picks its direction or frame from `UnitRenderState.facing`. Only the viewer's own wedge turns. Everything with game meaning is drawn by the viewer above the skin: the side ring (ours solid, theirs double) with plate keylines, the wedge, the **role-glyph plate** and glyph(s) (drawn above the body, so a club colour never hides a glyph), the hit wash, the selection brackets, bars, pips, badge, crown, labels, telegraphs and cues.

## The palette is the only source (A18)
Every colour, alpha, size and duration comes from `ArenaPalette` and `palette.metrics` (ring width/line/gap, down opacity, zone and telegraph alphas, hit-flash alpha and ms, flash limit, number merge window and rise, label, pip and bar sizes). The metrics are CSS px at any zoom (the host measured the rem sizes, so `--ui-scale` reaches the canvas); only the designer's proportions of the disc (plate 0.66 m across, glyph 0.44 m, bar width 1.7 m, ...) are in code. `design.test.ts` scans the source for colour literals (only the white of tinted masks is allowed) and checks that a different palette gives a different token. A host re-reads the tokens and calls `setPalette` on a theme, motion or interface-scale change: the viewer re-bakes the number fonts, redraws every token and the floor. `palette.ts` holds `defaultArenaPalette(theme)` (the shipped tokens, for tests, the harness and the first frame; WP-M2C's `DEFAULT_ARENA_PALETTES` supersedes it).
- **Body colours are exact club colours** (exempt from 3:1, A18 decision 4). Rings, the plate, bars and pip outlines keep 3:1.
- **Text** sits on plate chips in `ink` (labels, tag, name, rule badge, cast bar, "+n", callouts); floating numbers have no chip and a plate-coloured stroke. Numbers always carry a sign (U+2212 for damage, + for heal and shield).
- **Damage kinds differ by shape:** physical = angular spark, arcane = round burst, true = diamond.
- **Status pips** come from `StatusCue.pip` (null for the shield category: its bar segment shows it): a chip outlined in the family colour with the family silhouette from `palette.pipGlyphSvg`; hard control first, "+n" chip for the rest. Hard control greys the ring and keeps its style.
- **Overtime:** a static thin `warn` line on the inner edge of the wall band (the field edge), fading in over 360 ms (instant under reduced motion, never pulsing); no horn.
- **Downed bodies** stay (flattened to 60%, down opacity, a diamond in the side colour, bars and wedge gone) until the next `load` (the next kickoff).

## Rules the code keeps
- **No future leaks (review B1).** A live round never seeks past `headTick`. `endTick` is null until playback reaches the end. `keyMoments()` is asked up to the head; auto-pause stops are looked up only to the end of the frame being drawn. A stop fires when playback crosses it going forward (never when seeking, never again for the tick it resumes from). After a rewind, a live round stops at its head (`{ kind: 'head' }`).
- **State is a function of (log, tick).** Seeking and playing show the same picture. Presentation-only effects (flash admission, number merging) use wall time and never feed back.
- **Flashes.** Per fighter, flash starts are at least 1000/limit ms apart in wall time (`metrics.flashLimitPerSecond`, 3 by default), so 4x cannot raise the rate. The token's hit wash lasts `metrics.hitFlashMs` and a refused hit shows none; burst effects draw dimmed. None under reduced motion or while paused/seeking. No full-screen flash exists.
- **Numbers.** At most one per fighter per `metrics.numberMergeMs` of wall time; later ones add into the first.
- **Reduced motion.** `sampleAt` drops the motion-only effects and zeroes the badge pulse; the scene also never draws those kinds, pins pulses and growth to their settled look, shows no trails, no camera ease, no body easing. Telegraph progress stays.
- **Objects.** Pooled by unit index and effect id (`KeyedPool`); static geometry is redrawn only when zoom or palette change.
- **Teardown.** Everything is destroyed with `DESTROY_ALL` (`{ children: true, context: true }`). PixiJS v8 destroys a Graphics' own context only when called with no options or `context: true`; plain `{ children: true }` leaked about 0.65 MB per round (found by the 20-round check). `destroy()` also loses the WebGL context.
- **Keyboard (A18 decision 3).** The canvas is one tab stop (`tabindex 0`, `role="img"`, a label rewritten at each pause) that never cycles internally; Tab selection moves through the fighter strip's cards, and a click on a token reports `onSelect` so the UI can focus its card. The viewer sets no focus outline: style `:focus-visible` on the canvas (or `:has(canvas:focus-visible)`) outside the wall.

## Additive options (all optional)
`cues` (a cue table; default `buildCueTable(content)`), `viewTransform` (default the real camera), `tabStop` (default true; false when the host element is the tab stop). `flashLimitPerSecond` defaults to `palette.metrics.flashLimitPerSecond`. `defaultArenaPalette(theme)` is exported for hosts without tokens.

## Checks and measurements
- **Logic (happy-dom, no GPU):** `npm test` runs the clock, core, scene, design and skin tests; they use `testing/fake-timeline.ts` and a real `ArenaScene` over scene-graph objects.
- **Real browser:** serve the repo with `npx vite --port 5299 --strictPort` and open `/src/render/viewer/dev/harness.html` (`?theme=light&reduced=1&speed=4&play=1&tick=320&labels=all&select=2`). `window.__harness` exposes `capture()`, `liveCanvasDataUrl()` (what the F8 screenshot reads), `measure(ms, speed)`, `rounds(n, playMs)` and `cycle(n)`.
- **Measured here** (headless Edge 156 over CDP, SwiftShader; the Claude browser pane on an RTX 5060): WebGL capture works (snapshot PNG and `canvas.toDataURL()` both non-blank, also at DPR 2); 60 fps median at 1920 × 1080 at 1x and 4x on the GPU with p95 frame interval 17.1 ms; our CPU per frame p50 0.2 ms, p95 0.4 ms (1 ms under SwiftShader); heap after GC flat over round loads and plateauing over 50 create/destroy cycles (no canvas left behind, no WebGL context warning). Not the reference machine (Q35): the 60 fps criterion is measured by WP-M2F on the smoke build.

## Known gaps
- Number fonts are baked per tone at the renderer's resolution at creation (and re-baked on a palette change); moving to a higher-DPR monitor keeps the old glyph resolution until the next viewer.
- `drawCalls` in `stats()` is null (PixiJS v8 exposes no counter).
- Oblique projection draws circles as ellipses for ground marks; effects stay screen-space.
- An effect's lifetime is the model's (`EFFECT_LIFETIME_TICKS`); `metrics.fxFadeMs` is not applied by the viewer (the model owns lifetimes; numbers fade by their age).
