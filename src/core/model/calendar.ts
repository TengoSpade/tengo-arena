import type { WeekId } from './ids';

/**
 * Season calendar. core/game is the only writer.
 *
 * A season is one in-game year (O3) of W played weeks from leagues.json
 * (default 23: P1-P4 preseason, MW1-MW16 regular, TW1-TW3 tournament) plus
 * the season-end step, which is not a week (03-league-economy sys-calendar).
 *
 * `weekIndex` is the 1-based index of the week the player is managing now
 * (the next one to be processed). After the last week is processed the phase
 * becomes 'season-end' and weekIndex is W + 1 (weekId null) until
 * runSeasonEnd starts the next season at week 1.
 *
 * Phase order (REQUIRED, 02 §3): preseason -> regular -> tournament -> season-end.
 */
export type SeasonPhase = 'preseason' | 'regular' | 'tournament' | 'season-end';

export const SEASON_PHASES: readonly SeasonPhase[] = ['preseason', 'regular', 'tournament', 'season-end'];

export interface Calendar {
  /** 1-based season number. */
  season: number;
  /** 1-based week index (see above). */
  weekIndex: number;
  /** leagues.json week id of weekIndex, null during 'season-end'. */
  weekId: WeekId | null;
  phase: SeasonPhase;
}

/** Point in game time used to stamp records (news, ledger, history, statuses). */
export interface GameTime {
  readonly season: number;
  readonly weekIndex: number;
}
