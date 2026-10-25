# core/sim

**Owner:** sim agent (M1 wave 1). **Status:** not started (needs 03-combat stats, abilities schema and match format, phase B).

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
