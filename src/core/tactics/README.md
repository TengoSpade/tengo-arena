# core/tactics

**Owner:** tactics agent (M1 wave 1). **Status:** not started (needs the rule format from 03-combat, phase B).

## Responsibility
- Rule-list model: ordered `WHEN <conditions> -> <action> ON <selector> [ONLY|PREFER] [cooldown]` rules plus a fallback stance (exact vocabulary from 03-combat / tactics-presets.json).
- Resolve a `TacticsAssignment` (preset id or custom list) into a rule list; compile it once per fight into a fast form.
- `evaluate()`: given a read-only `BattleView` and a unit, check rules top-down and return the first valid decision **with a trace** (which rules were skipped and why). The trace feeds rule-fire counts, match reports and the M2 inspector.
- Deterministic targeting with documented tie-breaks (distance, then HP, then unit index).

## Rules
- Pure and side-effect free: never mutates the view; never draws randomness unless the rule format explicitly calls for it (then via an Rng passed in).
- Declares the `BattleView` interface it needs; core/sim implements it. Tactics never imports sim.
- AI clubs and the player use the same rule format and evaluator.

Depends on: `util`, `rng`, `model`, `content`. Tests: each condition/selector/action, ordering ("first valid wins"), ONLY vs PREFER, cooldowns, fallback, trace content, every shipped preset compiles.
