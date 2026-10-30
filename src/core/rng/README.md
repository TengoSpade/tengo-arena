# core/rng

**Owner:** architect. **Status:** implemented and tested (phase A).

Seeded PRNG: **sfc32** seeded by **cyrb128** of a derivation key. 32-bit integer math only, so the same seed gives the same numbers in every JS engine.

```ts
import { Rng, deriveSeed, STREAM } from '../rng';

const rng = Rng.create(state.rng.root, STREAM.injury, season, week); // a substream
rng.int(1, 6); rng.float(); rng.chanceBp(2500); rng.chance(0.25); rng.pick(list); rng.weighted(list, w); rng.shuffle(list);
const matchSeed = deriveSeed(state.rng.root, STREAM.match, season, fixtureId); // short, loggable
const round2 = Rng.create(matchSeed, 'round', 2);
```

Rules (REQUIRED):
- Never use `Math.random`. All randomness comes from a stream derived from `GameState.rng.root` (or from a logged seed such as a match seed).
- Use your module's top-level stream name from `STREAM` (`streams.ts`); add new names via the architect.
- Derivation is order-independent: `derive()` never depends on how many numbers the parent drew. Prefer deriving a fresh stream per (system, season, week, entity) over passing one stream through many systems.
- `chance(p)` always consumes exactly one draw; `int()` at least one. Tuning a probability never shifts later draws.
- `normalish(mean, sd)` is a bounded bell curve (Irwin-Hall, ±3.46 sd); there is no Box-Muller (needs `Math.log/cos`).
- The algorithm, key encoding and warm-up are frozen by golden tests. Changing them needs an `ENGINE_VERSION` bump and an architect decision.

Depends on: `util`.
