# core/sim

**Owner:** WP1 (combat); M1.1 WP-A; M2 WP-M2A. **Status:** implemented (M1, M1.1: `ENGINE_VERSION` 2; M2: log format 2, `inspectRoundAt`, `simContentHash`). The public API in `index.ts` is a fixed contract; additions are marked *additive*.

## Responsibility
- `simulateFight` (one round), `simulateMatch` (best-of-N, round seeds `deriveSeed(matchSeed, 'round', n)`, never drawn), `combatProfile` (static derived values for the fighter page), `ENGINE_VERSION`.
- Additive: `fighterInput`, `sideInput` (builders for the harness, tests and dev tools).
- M1.1: `simulateRound` (one round with Freshness, ability ranks and perks; `aftermath` per fighter for lifecycle). Additive: `eligiblePerks`, `perkEligible`, `perkPool`, `eligibleRankSteps` (combat-skills.md sys-perks eligibility; lifecycle's offer generator applies the same rules).
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
| `record.ts` | recorder (incremental hash incl. six-element frames); `match.ts` round results, per-fighter stats, MVP, match assembly, M1.1 round recaps (Freshness label, Tired/Spent tag, perk procs) |
| `skills.ts` | M1.1 perk and rank-step eligibility |
| `probe.ts` | M2 `inspectRoundAt`: the pause inspector's probe |
| `simhash.ts` | M2 `simContentHash`: the replay hash |
| `corpus.ts` | seeded random rounds for tests (not used by the engine) |

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

## M1.1 decisions (WP-A)
- Ability ranks: `ability-ranks.json` JSON-pointer changes are applied to a copy of the AbilityDef (rank 3 = rank 2 changes then rank 3 changes; each change checks its `from`), compiled once per (class, ranks) and cached on the SimTables (`kitFor`).
- Freshness penalty: stepped by tier (O36): the tier is the first combat.json `freshness.tiers` row, from the top, whose `minFreshness` the round-start F reaches (the last tier below every minimum); each of its penalties = trunc(tier penalty bp x (10000 - fatigueResist) / 10000), fatigueResist summed from perk stat mods and clamped 0-1, added once as static stat mods at round build and fixed for the round. The reported severity (display and tags only) is the tier's rank among the penalty tiers (0 to 10000 bp) x (1 - fatigueResist). No in-fight Stamina term.
- Perks: up to `perkCap` passive blocks per unit after the class passive (stat mods, aura, triggers, trait effects); more than the cap or an unknown id is an InvariantError. Auras are strongest-only per key (class passive id, or `perk:<id>`). `self_freshness_below` and `self_fresh_entry` are folded at round build; `self_is_captain` is evaluated live (captain changes rebuild the modifier blocks).
- Triggers: `self_hp_below` fires at most once per round per trigger, at the commit where HP first drops below pct, after Deathward and downs; `ability_release` fires after an active ability's release (focus and cooldown paid), optionally for one slot; trigger `if` is checked when the event happens, with target_* predicates reading the trigger target. Once-per-target memories are per trigger (Warding Lantern and Lamplight are independent).
- `aftermath.largestHit` = the largest single hit taken in the round, HP plus shield.
- Engine 2 precision fixes (found by the fatigue harness; defaults and flat-10 fighters unchanged, the M1 golden checksums are unchanged): (1) the swing accumulator keeps its sub-tick overshoot (cap = threshold + one tick's gain - 1) instead of capping at the threshold, so the swing rate is attackSpeed / interval; engine 1 rounded every swing up to whole ticks, so any attack-speed malus cost a full tick per swing (-3.8% for a 0.2% malus) and gains under ~4% did nothing. (2) Power and Support apply modifiers to the untruncated base (one truncation, as fr-001 writes it); engine 1 truncated twice, so any small malus cost a whole point.
- Fight-start unit data carries `freshness`, `fatigueBp`, `abilityRanks`, `perkIds`, `enteredThisRound`; the round summary recap carries `freshness`, `freshnessLabel`, `fatigueTag` ('tired' | 'spent' | null; levels.json labels), `fatigueBp`, `perkProcs`, `enteredThisRound`. The model types do not have these fields yet (change request to the architect), so sim/match.ts declares `RoundRecapM11` and fight.ts `UnitSpawnM11`.

## Known gaps
- vis-002 (tailored presets beat defaults by >= 60%) moves to M3 with the tactics editor; in M1 non-default presets losing to defaults is accepted (orchestrator, 2026-10-25). `runBalance` mode `preset-vs-default` reports it.
- Captain effect cap (10%) is not enforced in code; content values stay inside it.
- Dash deliveries end 0.1 m from the target ("adjacent", approachInset) or 0.2 m behind it; the endpoint is fixed at release.
- Cones approximate "expanded by radius" by testing the centre angle (plus units overlapping the caster).

## Tests
`sim.test.ts` (fixture content): determinism over 3 runs, record-level invariance, seed sensitivity, the golden match hash, bestOf majorities and round seeds, stats and MVP, event stream ordering and summary set, cmb-012, combatProfile clamps, a coarse speed check.
`acceptance.test.ts` (content/default via import.meta.glob): cs-001..003, cmb-001..011, mv-001..003, the Behead worked example, tiebreak chain and overtime, simultaneous downs, the 17 effect types, the 34 statuses, captain aura / rally / Shaken / handover, combat traits, every class and all 105 presets fight.
`m11.test.ts` (content/default): rk-001..005, fr-001..004, pk-001..005, st-001, every rank row's changes land on their paths and every class fights at ranks 3/3/3, every perk compiles and fights, triggered perks proc, the new predicates and triggers, trigger `if`, aura `requires`, fatigueResist clamp, default parity with simulateFight and determinism of the round API. `sim.test.ts` pins the M1.1 round golden; `round.test.ts` (architect) checks default parity on the fixture.

Depends on: `util`, `rng`, `model`, `content`, `tactics`.

## Orchestrator decisions (M1 core fix round, pending owner confirmation)
- **D-Q.** `fighterInput` (balance harness and tests) gives a fighter the OVR of his stats by core/content `combatRating` unless a test pins `rating`; game fight inputs already carry fighters' ratings, the same function. The golden event hashes were re-pinned when the fixture content changed (the header carries the content hash); round checksums are unchanged.

## R2 box score (T001): healing received
`Tally.healingReceived` counts the **effective** healing a unit received (overheal excluded), added where heals land in the commit phase (and for Deathward's heal above the 1 HP floor), the mirror of `healingDone` (which stays as it was: Deathward credits the warder the uncapped heal). It is copied into `FighterMatchStats.healingReceived` (optional in the model; `mergeStats` sums it) and is in no event, no recap and not in the round checksum, so event hashes and the pinned goldens did not move and `ENGINE_VERSION` stays 2.

## M2 (docs/design/_drafts/05-technical-m2.md §A2, §A4, §A5, WP-M2A; implemented)

### Log format 2 (tech-016)
- `FIGHT_LOG_FORMAT_VERSION` is 2 and `FightHeader.logFormat` carries it at `summary` and `full`. A `frame` unit is now `[x cm, y cm, hp, stateBits, shield, focus]`: `shield` = total shield points the unit holds going into the next tick (a shield with `end <= tick` no longer counts, so the frame whose tick equals a shield's `expiresTick` already shows it gone even though it absorbed hits during that tick; a downed unit has none), `focus` = whole points (`trunc(milli / 1000)`, as in `fight.start`). A frame is the state at the END of its tick: shield is already updated by that tick's `shield.gain` and by the hits that took shield (`shield.break` follows from them), focus by that tick's `cast.release` and regeneration.
- Frames still come every `frameEveryTicks` (2) from tick 0, plus a **closing frame** at the end tick: emitted after `fight.end` and before `round.summary`, with the final state (the downs, the last HP), whether the end tick is even or odd. So the last frame is always at the `fight.end` tick.
- **No outcome, no round checksum and no summary event moved.** Verified against main (5eb87cd): 200 seeded random rounds (ranks, perks, Freshness) give identical checksums, winners, durations and final HP; `npm run balance -- --fights 2000 --seed balance-1` prints identical outcome lines (only the timing line differs); `npm run soak -- --seasons 3 --seed soak-1` ends in the same state checksum with every check passing. At `summary` the stream equals the format-1 stream except for the header's new field, and at `full` it equals it except for the frames (both pinned in `format2.test.ts` from values captured on main). Full-level event hashes moved, so the two goldens in `sim.test.ts` were re-pinned (`ENGINE_VERSION` stays 2). The incremental fast-path hash equals `hashEventStream` with six-element frames (tested over the corpus).
- Shield dispels (`dispel` effects) take shield away without an event of their own, which is one reason the frames carry it.

### `inspectRoundAt(input, roundSeed, content, tick): RoundProbe` (tech-022; `probe.ts`)
- Re-simulates the round on a fresh `Fight` at record `none` through the END of `tick` (floored, clamped to at least 0; NaN or infinity throws `InvariantError`). Read-only: the fight owns its seeded streams and nothing of the caller's is touched, so it cannot change a later result (tested: same checksum and log after many probes, on the same content).
- **State** (the end of the probed tick, what a frame at that tick shows): `hp`, `shield`, `focus` and `standing` equal that frame (tested at every 5th frame of several rounds, the closing frame included). `cooldownTicks`: ticks until each active is ready (`ceil(cooldown / rate)`, the trace's `readyInTicks` formula, at the end of the tick). `statuses`: those still active in the next tick (`ticksLeft` of at least 1). `committed` and `pending`: the unit's committed decision and a decision waiting out its reaction delay (`commitTick`); both null for a downed unit.
- **Evaluation** (the "what he would decide now" column; `RoundProbe.evaluatedTick` = tick + 1): the probe plays the sim's next decision phase (tick + 1: its timers, then each unit's due pending commit, then a **traced** `evaluateTactics`), ignoring the decision cadence and the reaction delay. So an evaluation equals the one the sim makes at a tick where it evaluates, with the same `trace` (tested: every sampled evaluation the sim made in 12 corpus rounds is reproduced at `tick - 1`, and every traced decision in the log is reproduced inside its reaction window). A probe at tick T therefore reads the state the sim sees at T + 1; the opening evaluation at tick 0 cannot be probed. **State fields are as of `tick`, the trace values are as of `evaluatedTick`** (after tick + 1's timers): `cooldownTicks` is one more than the trace's `readyInTicks` for the same ability (unless a cooldown-rate modifier changes in that tick's timers), and `observed` focus or gaps in a trace can differ from `focus` and the frame by one tick of regeneration or movement.
- `blockedBy` (the evaluation is null exactly then): `downed`, `stunned`, `asleep`, `displaced`, `winding_up`, `casting`, `channelling`, `taunted` (the checks `decisions()` makes), and, once the round has ended, `round_over` for the survivors. A `tick` at or beyond the end returns the final state at the end tick (`RoundProbe.tick` is the tick actually probed).
- Cost: a partial round at record none; median 1.7 ms, max 3.5 ms (ticks 40 to 540 of 200 random rounds), against the 15 ms target.

### `simContentHash(content): string` (tech-026; `simhash.ts`)
- The hash of a canonical serialization of what the sim **compiles**, not of a list of content keys: the whole `simTables` (constants, statuses, every ability, class (with its combat `base`), trait and perk compiled to integers; Freshness and its labels; captain grades and the acting-captain penalty; the header's tick length; opening focus; the perk cap), every ranked ability (ranks 2 and 3), every preset compiled by core/tactics against every rank combination of its two actives (rule ids left out: events number rules), and the custom-list checks of M3 (vocabulary ids and params, rule and condition limits). Source definitions (`def`), names, descriptions, icons, economy, leagues, calendar, development outside the captaincy grades and `actingCaptainCqPenalty`, and `ContentDB.ref` (the career hash) never reach it. Cached per ContentDB; about 55 to 130 ms the first time (all abilities, 105 presets times their rank combinations), nothing after.
- The direct content reads of a fight were moved into the tables so one compile covers them: `combat.tick.tickMs` (header), `combat.derived.focus.startFull`, `perks.rules.perkCap`, and the class `base` (`CClass.base`). Races are not a sim read: `races.json` reaches a fight only through the effective `stats` of each `FightFighterInput` (core/game's `fightInputOf` never sets `combatMods`), which a stored result keeps, so changing `races.json` does not change a replay.
- **Guards** (`simhash.test.ts`): (1) read-set: a corpus of 24 seeded rounds (plus probes) runs on a ContentDB over a recording proxy, and every property path it touches must also be read by `simContentHash` on its own recording copy (which hashes like the plain content); the corpus must touch every sim-relevant section and none of economy, leagues, names, clubs, races. (2) Moves: captaincy grades, `actingCaptainCqPenalty`, Freshness labels, an ability coefficient, cooldown and range, a preset rule and stance, a combat constant, a class base value, a rank change, the perk cap, a perk, a trait, a vocabulary default, the limits, and more each change the hash. (3) Excluded keys (24 named presentation and development keys, plus whole sections) change neither the hash, nor any result of the corpus, nor any event hash. (4) Sweep: for every distinct kind of leaf the corpus reads (458 on the shipped content), changing it (to another valid enumerated value where it is one) moves the hash, except the listed inert kinds (rule ids, which only label); the default run checks every 6th kind, `SIM_HASH_SWEEP=all` checks every kind (about 50 s).
- Adding a content read to the fight: compile it in `simTables` (or in core/tactics' compile, which the hash compiles for every preset); the guards fail otherwise.

### Calls are refused (05-technical-m2 §A6)
- `simulateRound` and `inspectRoundAt` throw `InvariantError` for a `RoundInput.calls` plan other than absent or `{ none, none }` (an `explicit` plan is refused even with no calls; a malformed plan such as `{}` or `{ home: { mode: 'none' } }` is refused with the same `InvariantError`, and `null` counts as absent). Absent and `{ none, none }` give identical results. The calls package replaces this check.

### Tests added
`format2.test.ts` (log format 2), `probe.test.ts` (probe and the calls refusal), `simhash.test.ts` (replay hash guards), `corpus.ts` (the seeded round corpus they share). The two goldens in `sim.test.ts` were re-pinned.
