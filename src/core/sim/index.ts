/**
 * core/sim — public API (phase A placeholder; implemented in phase B).
 *
 * Planned API (see README.md and docs/design 05 §3, "Operation contract: simulate a fight / match"):
 *   simulateFight(input: FightInput, options?: { record?: RecordLevel }): FightOutput
 *   simulateMatch(input: MatchInput, options?: { record?: RecordLevel }): MatchOutput
 */

/**
 * Version of the fight rules implementation. Bump on ANY change that can
 * alter a fight's outcome or event stream for the same inputs. Stored in
 * MatchResult, FightHeader and saves; replays require an exact match.
 */
export const ENGINE_VERSION = 1;
