# core/sim

**Owner:** WP1 (combat). **Status:** implemented (M1). The public API in `index.ts` is a fixed contract; additions are marked *additive*.

## Responsibility
- `simulateFight` (one round), `simulateMatch` (best-of-N, round seeds `deriveSeed(matchSeed, 'round', n)`, never drawn), `combatProfile` (static derived values for the fighter page), `ENGINE_VERSION`.
- Additive: `fighterInput`, `sideInput` (builders for the harness, tests and dev tools).
- Event stream (`core/model/events.ts` envelope) at `none` / `summary` / `full`; recording never draws randomness, so results and `checksum` are identical at every level.

## Files
| File | Contents |
| --- | --- |
| `tables.ts` | content -> integer tables (mm, ticks, bp, centipoints), cached per ContentDB |
| `profile.ts` | sys-combat-stats static values (d(x) formulas, race combatMods, passive mods, trait adapter) |
| `state.ts` | Unit, statuses, shields, zones, projectiles, displacement, jobs |
| `fight.ts` | setup, spawn, tick loop, timers, auras and modifier blocks, commit, downs, captain model, end check, tiebreak chain, checksum |
| `act.ts` | decisions with reaction delay (P-06), actions: windups, casts, channels, releases, deliveries |
| `motion.ts` | goals per action and stance, sidestep, anti-stuck, retreat with wall slide, displacement, separation, walls |
| `resolve.ts` | resolution phase, the 17 effect types, damage / healing / shield pipelines, statuses with DR, triggers, commit queues |
| `view.ts` | the BattleView core/tactics evaluates |
| `record.ts` | recorder; `match.ts` round results, per-fighter stats, MVP, match assembly |

## Tick (03 sys-fight-sim)
timers -> decisions (start-of-tick snapshot of targets) -> actions -> movement (simultaneous) -> resolution (jobs by source in order(t), then creation sequence; post-movement positions; start-of-tick modifiers and shields) -> commit (HP, Deathward, simultaneous downs, sleep breaks, statuses with DR, shields / cleanses / dispels / interrupts / displacements / cooldowns / focus / zones, ally-HP triggers) -> end check. Triggered effects, lifesteal, Illuminated heals, thorns and riposte resolve on t + 1.

## Decisions (for the architect's tech- list)
- Positions in integer mm (orchestrator decision); distances use floor(sqrt) of integer squares; centre distance floors keep gaps exact integers.
- A status applied at the commit of tick t is active on ticks t+1 .. t+duration (inclusive) and expires at the timers of the next tick; DoTs and HoTs tick one interval after application.
- Basic-attack swing accumulators keep running during windups and cap at one stored swing; windups refund on cancel.
- Stance fallback (orchestrator decision 2026-10-25, research C2.1): while the committed decision is spent or invalid (its ability just released or cannot be used, or its target is down) and the next decision waits out the reaction delay, the fighter follows its stance toward the stance target (nearest enemy, current aim kept within the stickiness gap) instead of holding still (`act.ts effectiveDecision`). Idle time fell from 8.7% to 1.5% (target <= 5%).
- `damageTaken` in FighterMatchStats is damage to HP; damage absorbed by shields is counted only on the dealer (`damageToShields`).
- Summary-level recording = `SUMMARY_EVENT_TYPES` plus `cast.release` for actives and `status.apply` for hard control (per the per-type notes in `core/model/events.ts`).
- `unit.decide` is emitted when a decision commits (tick = commit tick, `reactTicks` = commit - evaluation).
- Overtime damage and healing multipliers use k = floor((t - start) / step); healing floor from content.
- Tiebreak `first_down`: the side whose first down of an enemy came earlier wins; a side that never downed anyone ranks last.
- MVP: PROVISIONAL score (damage + healing + shielding + downs x 150 + assists x 50, winning side); OPEN, see the content request in the WP1 report.
- Performance: modifier blocks are rebuilt only when dirty (statuses, HP for HP-conditional mods, targeting, captain, aura ticks, time-dependent mods), status tests use per-code counts, compiled presets are cached per content.

## Known gaps
- vis-002 (tailored presets beat defaults by >= 60%) moves to M3 with the tactics editor; in M1 non-default presets losing to defaults is accepted (orchestrator, 2026-10-25). `runBalance` mode `preset-vs-default` reports it.
- Captain effect cap (10%) is not enforced in code; content values stay inside it.
- Dash deliveries end 0.1 m from the target ("adjacent", approachInset) or 0.2 m behind it; the endpoint is fixed at release.
- Cones approximate "expanded by radius" by testing the centre angle (plus units overlapping the caster).

## Tests
`sim.test.ts` (fixture content): determinism over 3 runs, record-level invariance, seed sensitivity, the golden match hash, bestOf majorities and round seeds, stats and MVP, event stream ordering and summary set, cmb-012, combatProfile clamps, a coarse speed check.
`acceptance.test.ts` (content/default via import.meta.glob): cs-001..003, cmb-001..011, mv-001..003, the Behead worked example, tiebreak chain and overtime, simultaneous downs, the 17 effect types, the 34 statuses, captain aura / rally / Shaken / handover, combat traits, every class and all 105 presets fight.

Depends on: `util`, `rng`, `model`, `content`, `tactics`.
