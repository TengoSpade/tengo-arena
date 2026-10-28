# core/tactics

**Owner:** WP1 (combat). **Status:** implemented (M1); unchanged in M2 (WP-M2A reads it, see below). The public API in `index.ts` is a fixed contract; additions are marked *additive*.

## Responsibility
- Rule lists: `IF <condition> [AND <condition>] THEN <action> ON <selector> [ONLY | PREFER <predicate>] [COOLDOWN n s]`, first valid rule wins, NOT on every condition, an unremovable stance at the end (03 sys-tactics, 01 §7).
- `resolveTactics` (preset or M3 custom list, structurally checked against the closed vocabulary and `limits`), `presetsForClass` (default first), `defaultTactics`, `compileTactics` (once per fighter per fight; parameters resolved to integer units, vocabulary ids to numeric codes), `evaluateTactics` (decision + trace), `describeRule` (sentence from content labels).
- Deterministic targeting (sys-targeting): primary key, then stickiness (current target kept within 1.0 m on gap keys, 5 pp on HP keys, exact ties on count keys), then smaller gap, lower HP fraction, lower lineup slot. Never random.

## Additive exports
- `decideTactics(compiled, view, unit)`: the decision without building the trace (the sim's per-interval fast path; identical decision).
- `presetForStyle(classId, tacticsStyle, content)`: AI preset choice (03 sys-tactics "Preset selection in M1"; cmb-013).
- `describeStance(stance, content)`.
- `TraceEntry` (a `RuleTraceEntry` with `reason`, `cond`, `observed`, `readyInTicks`), `TraceReason`, `Evaluation.forced`.
- Optional `BattleView` members implemented by core/sim: `tauntedBy`, `abilityReadyInTicks`, `abilityBlocked`.

## Decisions (for the architect's tech- list)
- Skip reasons: the model's `RuleSkipReason` is kept in `skip`; the design's names are in `reason`: `cond_false` -> `condition_false`, `cooldown` -> `on_cooldown`, `silenced` / `blocked` -> `blocked`, `only_filtered` -> `only_filtered_all`; `rule_cooldown`, `no_focus`, `no_target`, `out_of_range` as is. A taunt is a forced decision: `rule: -1`, empty trace, `forced: 'taunted'`.
- Optional `[...]` parameters (e.g. `enemy_hp_below [within {band}]`) apply only when the rule sets them; required parameters fall back to the vocabulary default.
- Ally pools exclude the deciding unit unless `includeSelf` allows it and the ability may target self (`ally_or_self`); `protect`, `regroup` and `densest_ally` never pick it.
- `ability` rules are also skipped as `blocked` when a visible status prevents them (rooted or anchored for dash and leap abilities), per "visible statuses override rules".
- The evaluator keeps module-level scratch buffers (typed arrays) for speed; it is still a pure function of its inputs.

## M2 consumers (WP-M2A; no change to this package's code)
- The pause inspector's probe (`core/sim` `inspectRoundAt`, tech-022) calls `evaluateTactics` (the traced evaluation, never the fast path) against the sim's view at a tick; its result equals the traced evaluation the sim itself makes there (`sim/probe.test.ts`). The trace details (`reason`, `cond`, `observed`, `readyInTicks`) are typed in `core/model` `RuleTraceEntry`.
- The replay hash (`core/sim` `simContentHash`, tech-026) compiles every preset with `resolveTactics` and `compileTactics` for every rank combination of the class's two actives and hashes the compiled rules (rule ids left out), plus the vocabulary ids and params and the limits that the custom-list check reads. Whatever `compileRules` reads from content is therefore covered; a new read must be reachable from compiling a preset, or the read-set guard in `sim/simhash.test.ts` fails.

## Tests
`tactics.test.ts`: every condition (true, false, NOT), AND, every selector incl. pools and includeSelf, every ONLY/PREFER predicate, every action, first-valid-wins, rule cooldown, stance fallback, each skip reason in order, taunt override, stickiness and tie-breaks (cmb-010), describeRule, every fixture preset compiles. All 105 shipped presets compile and fight in `core/sim/acceptance.test.ts`.

Depends on: `util`, `rng`, `model`, `content`.
