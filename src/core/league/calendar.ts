/**
 * Season calendar (03-league-economy sys-calendar; 02 §3). The weeks, their
 * phases, matchweeks and tournament rounds are data (leagues.json
 * calendar.weeks): nothing here assumes 23 weeks or 16 matchweeks (open-005).
 */
import type { CalendarWeekDef, ContentDB } from '../content';
import { asId, type Calendar, type WeekId } from '../model';
import { invariant } from '../util';

/** The calendar week of a season week index (throws for an unknown index). */
export function weekDef(content: ContentDB, weekIndex: number): CalendarWeekDef {
  return content.weekByIndex(weekIndex);
}

/** Number of played weeks in a season (the season-end step is not a week). */
export function seasonLength(content: ContentDB): number {
  return content.leagues.calendar.weeks.length;
}

/** Calendar positioned at a played week. */
export function calendarAt(season: number, weekIndex: number, content: ContentDB): Calendar {
  invariant(Number.isSafeInteger(season) && season >= 1, `calendar: invalid season ${season}`);
  const week = content.weekByIndex(weekIndex);
  return { season, weekIndex, weekId: asId<WeekId>(week.id), phase: week.phase };
}

/** Calendar at week 1 of a season. */
export function seasonStartCalendar(season: number, content: ContentDB): Calendar {
  return calendarAt(season, 1, content);
}

/**
 * Calendar after processing the current week: the next week, or the
 * season-end step (weekIndex W + 1, weekId null) after the last week. The
 * season-end step is not a week, so calling this during it is a programming
 * error: the next season starts with seasonStartCalendar(season + 1).
 */
export function nextCalendar(calendar: Calendar, content: ContentDB): Calendar {
  invariant(calendar.phase !== 'season-end', 'nextCalendar: the season-end step is not a week; use seasonStartCalendar(season + 1)');
  const length = seasonLength(content);
  invariant(
    Number.isSafeInteger(calendar.weekIndex) && calendar.weekIndex >= 1 && calendar.weekIndex <= length,
    `nextCalendar: week index ${calendar.weekIndex} is outside 1..${length}`,
  );
  if (calendar.weekIndex === length) {
    return { season: calendar.season, weekIndex: length + 1, weekId: null, phase: 'season-end' };
  }
  return calendarAt(calendar.season, calendar.weekIndex + 1, content);
}

/** The calendar week that hosts a regular-season matchweek (1-based). */
export function matchweekWeek(content: ContentDB, matchweek: number): CalendarWeekDef {
  const week = content.leagues.calendar.weeks.find((w) => w.phase === 'regular' && w.matchweek === matchweek);
  invariant(week, `calendar: no regular week carries matchweek ${matchweek}`);
  return week;
}

/** Index of the last regular-season week; seedReckonings runs after it is processed. */
export function lastRegularWeekIndex(content: ContentDB): number {
  let last = 0;
  for (const w of content.leagues.calendar.weeks) if (w.phase === 'regular') last = w.index;
  invariant(last > 0, 'calendar: no regular-season week');
  return last;
}
