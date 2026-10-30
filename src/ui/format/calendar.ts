/**
 * Calendar labels (04 §6.3 "Calendar labels everywhere"): P1 "Trials Day",
 * P2, P3, P4 "Kick-off week", MW1-MW16, TW1-TW3 named after the tier's
 * tournament round. Week names come from leagues.json; the tournament name
 * from the tier (theme content); only generic words come from the UI text.
 */
import type { CalendarWeekDef, ContentDB, TierDef } from '../../core/content';
import type { Calendar } from '../../core/model';
import { t } from '../text';

const ROUND_KEY = { quarterfinal: 'calendar.quarterfinal', semifinal: 'calendar.semifinal', final: 'calendar.final' } as const;

export function weekDefAt(content: ContentDB, weekIndex: number): CalendarWeekDef | null {
  return content.weeks.list.find((w) => w.index === weekIndex) ?? null;
}

/** "MW7", "P1", "TW2", "End" (season end). */
export function weekCode(content: ContentDB, weekIndex: number): string {
  return weekDefAt(content, weekIndex)?.id ?? 'End';
}

/** Long name: "Matchweek 7", "Trials Day", "Preseason week 2", "Banner Reckoning semifinal", "Season end". */
export function weekName(content: ContentDB, weekIndex: number, tier?: TierDef | null): string {
  const w = weekDefAt(content, weekIndex);
  if (!w) return t('calendar.seasonEnd');
  if (w.phase === 'regular') return t('calendar.matchweek', { n: w.matchweek ?? w.index });
  if (w.phase === 'preseason') return w.label ?? t('calendar.preseasonWeek', { n: w.index });
  const round = w.round ? t(ROUND_KEY[w.round]) : w.id;
  return tier ? `${tier.tournamentName} ${round}` : `${w.label ?? w.id} ${round}`;
}

/** "MW7 · Matchweek 7" style used in eyebrows; preseason and tournament keep their names. */
export function weekLabel(content: ContentDB, weekIndex: number, tier?: TierDef | null): string {
  const w = weekDefAt(content, weekIndex);
  if (!w) return t('calendar.seasonEnd');
  if (w.phase === 'regular') return weekName(content, weekIndex, tier);
  if (w.phase === 'preseason') return w.label ? `${w.id} ${w.label}` : w.id;
  return `${w.id} · ${weekName(content, weekIndex, tier)}`;
}

/** Matchweeks left in the regular season after this week. */
export function matchweeksLeft(content: ContentDB, calendar: Calendar): number {
  return content.weeks.list.filter((w) => w.phase === 'regular' && w.index >= calendar.weekIndex).length;
}

export function phaseName(phase: Calendar['phase']): string {
  switch (phase) {
    case 'preseason':
      return t('calendar.phase.preseason');
    case 'regular':
      return t('calendar.phase.regular');
    case 'tournament':
      return t('calendar.phase.tournament');
    case 'season-end':
      return t('calendar.seasonEnd');
  }
}
