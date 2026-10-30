# src/core — pure simulation and game engine

Everything that decides what happens in the game lives here. Plain TypeScript with **no DOM, Node, PixiJS or Preact**, no clocks (`Date`, `performance`), no `Math.random`, no engine-dependent math (`Math.sin/exp/pow/...`, `**`) and no locale APIs. It runs unchanged in the browser, a Web Worker, Node (tests, `npm run balance`, `npm run soak`) and the desktop build.

Enforced by `tsconfig.core.json` (ES lib only), `tests/architecture` (imports, globals, Math, module graph, testkit) and ESLint.

## Modules and owners (M1 work packages, docs/design/_drafts/05-technical.md §9)

Each folder is one module with a public `index.ts` (a fixed contract). Other modules import **only** the index. Allowed dependencies: `tests/architecture/rules.ts` (`CORE_MODULE_DEPS`).

| Module | Owner | Responsibility |
| --- | --- | --- |
| `util/`, `rng/`, `model/`, `content/`, `testkit/` | architect | foundation, content schemas and validation, engine/state types, test fixtures |
| `tactics/` | WP1 combat | rule lists, presets, compile, evaluate with trace |
| `sim/` | WP1 combat | fixed-tick fight engine, match, event stream, combat profile |
| `harness/balance.ts` | WP1 combat | balance harness (`npm run balance`) |
| `fighters/` | WP2 fighters | generation, effective stats, rating, development, aging, injuries, traits, captaincy, chemistry, retirement, rookies |
| `league/` | WP3 league | calendar, wings, schedule, standings, the Reckoning, promotion/relegation, archive |
| `economy/` | WP4 economy | ledger, budgets, wages, asks, contracts, offers, free-agent market, hired blades, prizes |
| `ai/` | WP5 game loop | AI club managers (commands only) |
| `game/` | WP5 game loop | new game, commands, week processing, season end, views |
| `save/` | WP5 game loop | save envelope, validation, migrations |
| `harness/soak.ts` | WP5 game loop | soak harness (`npm run soak`) |
