# core/sim

**Owner:** WP1 (combat). **Status:** contract stubs in `index.ts` (phase B). The public API in `index.ts` is a fixed contract (typed stubs); implement the bodies, add exports only additively, and request signature changes from the architect.

## Responsibility
- Fixed-tick 2D fight engine (tick length and time cap from combat.json): movement, targeting via core/tactics, abilities executed from data (abilities.json effects), statuses, deaths, time-limit and tie-break.
- Event stream using the envelope in `core/model/events.ts` (`SimEvent`, `FightHeader`, `FightLog`, `hashEventStream`), at `RecordLevel` none / summary / full. The outcome is identical at every level.
- Match = best-of-N rounds (format from content); per-round seeds `deriveSeed(matchSeed, 'round', n)`.
- `ENGINE_VERSION` (index.ts): bump on any outcome-changing change.
- Balance harness runner in `core/harness` (`npm run balance`).

## Rules
- Pure function of its inputs: `(FightInput, seed, content)` -> output. No reads of GameState; the season engine passes immutable fighter snapshots.
- Update order inside a tick is fixed and documented (e.g. by unit index); no iteration over unordered collections without a sort.
- No transcendental math (`Math.sin/atan2/...`); use vectors and `core/util/math`.
- Performance budget: see docs/design 05 §8 (one 5v5 fight at record "none" <= 3 ms p50 on the reference PC).

Depends on: `util`, `rng`, `model`, `content`, `tactics`. Tests: determinism (same seed -> same event hash, 3 runs), record-level invariance, different seeds -> different results, each ability effect type, time-limit, every class can fight.
