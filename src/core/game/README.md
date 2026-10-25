# core/game

**Owner:** WP5 (game loop, integrator). **Status:** contract stubs in `index.ts` (phase B). The public API in `index.ts` is a fixed contract (typed stubs); implement the bodies, add exports only additively, and request signature changes from the architect.

## Responsibility
The season state machine and the only entry points that change `GameState`:
- `createWorld` (new game: clubs from clubs.json, initial fighters, schedule) and `club.choose`.
- `applyCommand`: validates and applies player and AI `Command`s.
- `advanceWeek`: the fixed weekly pipeline (AI planning -> simulate all fixtures -> results -> XP/injuries -> finances -> recovery -> market -> calendar/phase -> news).
- `runSeasonEnd`: archive -> promotion/relegation -> aging -> development -> retirements -> contract expiries -> rookies -> AI off-season -> new schedule -> preseason.
- Match preparation: lineup snapshot + `effectiveStats` -> sim input; match seed `deriveSeed(root, STREAM.match, season, fixtureId)`.

## Rules
- Transitions are pure: `(state, content) -> new state` via `produce()` (clone, mutate draft, return). On error, return `err(...)` and leave the input untouched.
- Pipeline order is fixed (docs/design 05 §6) and fixtures are simulated in fixture-id order.
- Delegates rules to the owning modules; contains orchestration, not game rules.

Depends on: everything in core except `save` and `harness`. Tests: a full season runs headless from a fixed seed with identical results twice; blockers prevent advancing with an invalid lineup; command validation errors; phase transitions.
