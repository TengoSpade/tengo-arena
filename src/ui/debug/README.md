# ui/debug

**Owner:** WP6. **Status:** implemented. Dev tooling; may import `core/testkit` (05 §3.1). Loaded only behind `import.meta.env.DEV` (dynamic import) or from tests, never in a production bundle — except `DebugOverlay.tsx`, which imports no fixtures and also opens in release builds with `?debug=1`.

- `DebugOverlay.tsx` (backtick or `?debug=1`): season / week / phase, root seed, content id and hash, engine / schema / game versions, last advance in ms, state size, last error, the last 20 commands; State dump; dev: load the dev world, open the gallery.
- `dev-engine.ts`: `createDevEngine()` wraps the real core and falls back to PROVISIONAL stand-ins only where a core function still throws `NotImplementedError` (world, commands for lineup / captaincy / tactics / training / shortlist / news, a week advance with synthetic results, views, saves). Real implementations take over automatically as WP1-WP5 merge. Nothing here is a game rule.
- `dev-world.ts`: `buildDevWorld(content, { playerClubId, weekIndex })` — a plausible career on any content (wings, double round robin, synthetic results before the given week, an injury, expiring contracts, digest news, names from `names.json`). Browser: `?dev-world=11&club=<clubId|none>`.
- `test-store.tsx`: `createTestStore({ world, weekIndex, playerClubId, engine })` (real store, memory saves, manual clock, captured downloads, fixture content, dev engine) and `<TestProviders store>` for screen tests (WP7 may use them).
- `Gallery.tsx`: the component sheet at `#/dev/components`.
