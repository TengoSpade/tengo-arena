# src/core — pure simulation and game engine

Everything that decides what happens in the game lives here. It is plain TypeScript with **no DOM, Node, PixiJS or Preact**, no clocks (`Date`, `performance`), no `Math.random`, no engine-dependent math (`Math.sin/exp/pow/...`, `**`) and no locale APIs. It runs unchanged in the browser, in a Web Worker, in Node (tests, `npm run balance`, `npm run soak`) and in the desktop build.

Enforced by:
- `tsconfig.core.json` (ES lib only, no DOM/Node types) via `npm run typecheck`;
- `tests/architecture` (imports, globals, Math, module graph) via `npm test`;
- ESLint (editor feedback) via `npm run lint`.

## Modules and owners

Each folder is one module with a public `index.ts`. Other modules import **only** the index (`../sim`, never `../sim/engine/step`). Allowed dependencies are listed in `tests/architecture/rules.ts` (`CORE_MODULE_DEPS`) and in docs/design 05 §3.

| Module | Owner (M1 work split, finalized in phase B) | Responsibility |
| --- | --- | --- |
| `util/` | architect | hashing, stable JSON, Result, comparators, deterministic math, clone |
| `rng/` | architect | seeded PRNG (sfc32) with named substreams |
| `model/` | architect | engine/state types: GameState, Club, Fighter, Fixture, MatchResult, events, ledger, save envelope |
| `content/` | content agent | load + validate content JSON (zod), content types, ContentDB, content hash |
| `tactics/` | tactics agent | IF/THEN rule model, presets, compile, evaluate with trace |
| `sim/` | sim agent | fixed-tick fight engine, event stream, match (best-of-N) |
| `fighters/` | fighters agent | generation, effective stats, XP/levels, development, aging, injuries, traits, retirement, rookies |
| `league/` | league agent | schedule, standings, tournament bracket, promotion/relegation, season archive |
| `economy/` | economy agent | ledger writes, wages, budgets, revenue, prizes, contracts, free-agent market |
| `ai/` | AI agent | AI club manager (emits the same Commands as the player) |
| `game/` | game/integration agent | new game, applyCommand, advanceWeek, season-end pipeline |
| `save/` | save agent | serialize, checksum, validate, migrate saves |
| `harness/` | sim agent (balance), game agent (soak) | headless balance and soak runners used by `scripts/` |
