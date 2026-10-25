# core/fighters

**Owner:** fighters agent (M1 wave 1). **Status:** not started (needs 03-fighter-lifecycle and races/traits/development/names JSON, phase B).

## Responsibility
- Fighter generation (world gen, rookie intake, free-agent pool): race, class, name from names.json, attributes, potential, traits.
- `effectiveStats()`: the single function that turns a Fighter (+ level, traits, injury, age, captaincy effects) into the stat block the sim uses.
- Progression: XP from matches, level-ups, development toward potential.
- Aging by race (curves from races.json), retirement decisions, rookies.
- Injuries (roll after matches, weekly recovery) and traits (effects, acquisition).

## Rules
- Writes only the Fighter records it is asked to update, on a draft state passed in by core/game.
- All randomness through `Rng` streams `STREAM.development / aging / injury / retirement / rookies / traits / names`.
- Same rules for player and AI fighters.

Depends on: `util`, `rng`, `model`, `content`. Tests: generation is deterministic per seed and within content ranges; aging curve per race; XP/level thresholds; injury odds over many seeds; retirement ages plausible.
