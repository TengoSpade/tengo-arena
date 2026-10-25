# core/league

**Owner:** WP3 (league + calendar). **Status:** contract stubs in `index.ts` (phase B). The public API in `index.ts` is a fixed contract (typed stubs); implement the bodies, add exports only additively, and request signature changes from the architect.

## Responsibility
- Season schedule: one league `Competition` per tier with its `Fixture`s (16 matches per club in M1), week assignment, home/away balance.
- Standings: derived from `GameState.results` with the tie-break rules from 03-league-economy. Never stored as authoritative state.
- Tournament: qualification of 8 clubs, 3-round bracket (`Bracket`), creating next-round fixtures as winners are known.
- Promotion/relegation between 2-3 tiers; `SeasonRecord` archive.

## Rules
- Deterministic: schedule shuffles use `STREAM.schedule`; table sorting uses total-order comparators with id tie-breaks (`core/util/compare`).
- Writes competitions, fixtures, bracket state and club tier moves only.

Depends on: `util`, `rng`, `model`, `content`. Tests: every club plays the configured number of matches, no club plays twice in a week, home/away balance, table tie-breaks, bracket progression, promotion/relegation counts per tier.
