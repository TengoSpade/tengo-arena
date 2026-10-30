/**
 * Calendar arithmetic for money (03-league-economy sys-calendar,
 * sys-contracts). W = economy.json season.wageWeeksPerSeason (the validator
 * keeps it equal to the leagues.json calendar length). Nothing here assumes
 * 23 weeks (05 §12 open-005).
 */
import type { ContentDB } from '../content';
import type { GameState, GameTime } from '../model';

/** Ledger week index of next-season setup and new-career setup entries (before P1 opens). */
export const SETUP_WEEK_INDEX = 0;

/** Paid weeks per season (W). */
export function weeksPerSeason(content: ContentDB): number {
  return content.economy.season.wageWeeksPerSeason;
}

/** Week index the calendar uses during the season-end step (W + 1). */
export function seasonEndWeekIndex(content: ContentDB): number {
  return content.leagues.calendar.weeks.length + 1;
}

/**
 * The market's notion of "now": the week whose processing answers a pending
 * offer. During the season-end step (AI phase after next-season setup) the
 * market already belongs to the coming season, before its P1 processing.
 */
export function marketTime(state: GameState): GameTime {
  const c = state.calendar;
  if (c.phase === 'season-end') return { season: c.season + 1, weekIndex: 1 };
  return { season: c.season, weekIndex: c.weekIndex };
}

/** Ledger stamp for money moved by a command now (season-end AI phase: the coming season's setup). */
export function commandStamp(state: GameState): GameTime {
  const c = state.calendar;
  if (c.phase === 'season-end') return { season: c.season + 1, weekIndex: SETUP_WEEK_INDEX };
  return { season: c.season, weekIndex: c.weekIndex };
}

/** Ledger stamp for the current week processing. */
export function processingStamp(state: GameState): GameTime {
  return { season: state.calendar.season, weekIndex: state.calendar.weekIndex };
}

/**
 * The season whose setup nextSeasonFinanceSetup performs: the season after
 * the ending one while the calendar is in 'season-end', or the calendar's
 * season if core/game already moved it to the new season's preseason.
 */
export function setupSeason(state: GameState): number {
  return state.calendar.phase === 'season-end' ? state.calendar.season + 1 : state.calendar.season;
}

/** Weeks paid on a free-agent contract signed at processing `weekIndex` (first paid at weekIndex + 1). */
export function paidWeeksAfterSigning(weekIndex: number, seasons: number, content: ContentDB): number {
  const w = weeksPerSeason(content);
  return Math.max(0, w - weekIndex) + w * (seasons - 1);
}

/** Weeks paid on a trials-rookie contract signed during week `weekIndex` (paid from that week's processing). */
export function paidWeeksTrials(weekIndex: number, seasons: number, content: ContentDB): number {
  const w = weeksPerSeason(content);
  return Math.max(0, w - weekIndex + 1) + w * (seasons - 1);
}

/** Remaining paid weeks of the current season counted from week `weekIndex`'s processing, inclusive. */
export function remainingWeeksInclusive(weekIndex: number, content: ContentDB): number {
  return Math.max(0, weeksPerSeason(content) - weekIndex + 1);
}

/** Week index of the Kick off commit (leagues.json week with commit 'kick_off'); cap relief runs up to it. */
export function kickOffWeekIndex(content: ContentDB): number {
  const week = content.leagues.calendar.weeks.find((w) => w.commit === 'kick_off');
  return week?.index ?? 0;
}

/**
 * Central-grant installments: share and the processing that credits them.
 * An installment "at week X" is credited at the processing that ends the
 * week before X; one at the first week is credited at setup (economy.json
 * income.grantInstallments doc strings). processingWeek 0 = setup.
 */
export function grantSchedule(content: ContentDB): { processingWeek: number; shareBp: number }[] {
  return content.economy.income.grantInstallments.map((g) => {
    const index = content.weeks.require(g.atWeek).index;
    return { processingWeek: index <= 1 ? SETUP_WEEK_INDEX : index - 1, shareBp: g.shareBp };
  });
}
