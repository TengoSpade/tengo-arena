/**
 * Registry of top-level RNG stream names. Each system derives its randomness
 * from the game's root seed under its own top-level label, so systems never
 * share or shift each other's numbers. Further path segments are chosen by
 * the owning module (season, week, fixture id, fighter id, ...).
 *
 * Adding a name here is an architect-owned change (see docs/design 05 §11):
 * request it in your report instead of reusing someone else's stream.
 *
 * EXAMPLE paths:
 *   Rng.create(root, STREAM.world)                          world generation at new game
 *   deriveSeed(root, STREAM.match, season, fixtureId)       match seed drawn at kickoff, logged in MatchResult
 *   Rng.create(matchSeed, 'round', 2)                       inside the sim: round 2 of that match
 *   Rng.create(root, STREAM.injury, season, week)           weekly injury rolls
 *   Rng.create(root, STREAM.market, season, week)           free-agent pool refresh
 *   Rng.create(root, STREAM.action, counter)                randomness caused by a player/AI command
 */
export const STREAM = {
  /** New-game world generation (clubs, initial fighters). */
  world: 'world',
  /** Fixture lists and tournament draws. */
  schedule: 'schedule',
  /** Match seeds (one per fixture). The sim derives its own sub-streams from the match seed. */
  match: 'match',
  /** Post-match and weekly injury rolls. */
  injury: 'injury',
  /** XP, level-ups, stat development. */
  development: 'development',
  /** Season-end aging. */
  aging: 'aging',
  /** Retirement decisions. */
  retirement: 'retirement',
  /** Rookie / new fighter generation. */
  rookies: 'rookies',
  /** Trait acquisition and reveals. */
  traits: 'traits',
  /** Free-agent market and contract negotiation outcomes. */
  market: 'market',
  /** AI club management decisions. */
  ai: 'ai',
  /** Name generation. */
  names: 'names',
  /** Randomness caused by a command; path continues with GameState.rng.counters.action. */
  action: 'action',
  /** Headless balance harness. */
  balance: 'balance',
  /** Headless season soak harness. */
  soak: 'soak',
  /** Save migrations that must invent a value (M1.1 v2 -> v3: Stamina; path 'm1.1', fighter id, purpose). */
  migration: 'migration',
} as const;

export type StreamName = (typeof STREAM)[keyof typeof STREAM];
