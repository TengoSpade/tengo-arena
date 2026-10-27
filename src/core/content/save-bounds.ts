/**
 * Structural bounds of the save format that content values feed into.
 *
 * Several tunable content values end up as array lengths or counters in the
 * persisted GameState, and the strict zod schema (core/save/schema.ts) rejects
 * a state that exceeds them. The schema reads these constants and the content
 * validator (validate.ts, `validateSaveBounds`) checks the content values
 * against the same constants, so a tuned content file can never produce a save
 * that does not load again: content that would is refused when it is loaded,
 * with an error that names the constant.
 *
 * Raising a bound is a save-format change: widen it here (the schema follows),
 * and a save written with the larger value still loads in a build with the
 * larger bound. Lowering one invalidates saves that already hold more.
 */
export const SAVE_BOUNDS = {
  /** Fighters a side fields in a round: exactly this many (combat.json match.squad.starters). */
  squadStarters: 5,
  /** Match-squad reserves per side, at most (combat.json match.squad.reservesMax). */
  squadReserves: 2,
  /** Swaps per side and match, at most (combat.json match.swaps.maxPerMatch). */
  swapsPerMatch: 2,
  /** Unresolved level-ups queued on a fighter, at most (levels.json offers.pending.maxQueued). */
  pendingLevelUps: 3,
  /** Options of one level-up offer, at most (levels.json offers.optionsPerLevelUp). */
  levelUpOptions: 3,
  /** Perks a fighter holds, at most (perks.json rules.perkCap). */
  perksPerFighter: 4,
} as const;

export type SaveBounds = typeof SAVE_BOUNDS;
