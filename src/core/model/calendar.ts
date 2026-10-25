/**
 * Season calendar. The season engine (core/game) is the only writer.
 *
 * `week` is a 1-based index over ALL weeks of the season in order:
 * preseason weeks, then regular-season matchweeks, then tournament weeks
 * (EXAMPLE with the open-005 working assumption: weeks 1-4 = preseason
 * P1-P4, 5-21 = matchweeks 1-17 incl. one bye, 22-24 = tournament rounds).
 * The week layout comes from content (leagues.json) via core/league, which
 * also maps a season week to its display label ("P2", "Matchweek 3", "Final").
 *
 * Phase order per season (REQUIRED, 02 §3 and docs/design 05 §6):
 *   preseason -> regular -> tournament -> season-end -> next season's preseason
 */
export type SeasonPhase = 'preseason' | 'regular' | 'tournament' | 'season-end';

export const SEASON_PHASES: readonly SeasonPhase[] = ['preseason', 'regular', 'tournament', 'season-end'];

export interface Calendar {
  /** 1-based season number. A season is one in-game year (O3). */
  season: number;
  /** 1-based season week (see file comment): the week the player is currently managing. */
  week: number;
  phase: SeasonPhase;
}

/** Point in game time used to stamp records (news, ledger, history). */
export interface GameTime {
  readonly season: number;
  readonly week: number;
}
