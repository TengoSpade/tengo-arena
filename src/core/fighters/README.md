# core/fighters

**Owner:** WP2 (fighters). **Status:** contract stubs in `index.ts` (phase B). The public API in `index.ts` is a fixed contract (typed stubs); implement the bodies, add exports only additively, and request signature changes from the architect.

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
