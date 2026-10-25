# src/render — PixiJS arena viewer (M2)

**Owner:** render agent (M2). **Status:** not started. `pixi.js` v8 is already a pinned dependency.

The viewer replays a recorded `FightLog` (core/model/events.ts) at 1x/2x/4x with pause, interpolating positions between `frame` events and drawing discrete events (casts, hits, deaths, rule badges). It never re-simulates, never draws randomness and never writes game state.

Rules (enforced by tests/architecture):
- Only `src/render` may import `pixi.js`.
- May read `core/{util, rng, model, content, sim}` through their index files; must not import `core/game`, `src/ui` or `src/platform`.
- Loaded lazily (`import()`) by the match screen so PixiJS stays out of the main bundle.
- Mounted by a UI component into a `<canvas>` host; communicates through a small `ArenaViewer` interface (`load(log)`, `play()`, `pause()`, `setSpeed(n)`, `seek(tick)`, `destroy()`, `onTick`).
