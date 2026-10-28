import type { StartingRow } from './club';
import type { FighterId } from './ids';
import type { CompactFielded, MatchResult } from './match';

/** One fighter of a side's round-1 five, as read from a result (full or compacted). */
export interface FieldedFighter {
  fighterId: FighterId;
  row: StartingRow;
  /** Rating at kickoff. */
  rating: number;
}

const ROWS: readonly StartingRow[] = ['front', 'back'];

/** The compact form of a round-1 five (what compaction keeps). */
export function compactFielded(five: readonly FieldedFighter[]): CompactFielded[] {
  return five.map((f) => [f.fighterId, f.row === 'back' ? 1 : 0, f.rating] as const);
}

/**
 * The round-1 five a side fielded, in slot order: from the sim input while the result is full, else from the
 * `fielded` record a compaction keeps. Empty when neither exists (a result compacted by a build that predates
 * `fielded`: only last season's matches between other clubs, which no reader of this asks about).
 */
export function fieldedFive(result: MatchResult, side: 'home' | 'away'): FieldedFighter[] {
  const input = result.input[side].fighters;
  if (input.length > 0) return input.map((f) => ({ fighterId: f.fighterId, row: f.row, rating: f.rating }));
  return (result.fielded?.[side] ?? []).map(([fighterId, row, rating]) => ({ fighterId, row: ROWS[row]!, rating }));
}
