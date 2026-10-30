/**
 * Calendar labels (04 §6.3 "Calendar labels everywhere"): P1 "Trials Day",
 * P2, P3, P4 "Kick-off week", MW1-MW16, TW1 "<tier> Reckoning
 * quarterfinal", TW2 semifinal, TW3 final. Thin wrappers over WP6's
 * src/ui/format/calendar (week codes and names) taking a tier id, plus the
 * WP7 helpers built on them. Nothing here assumes 23 weeks (open-005).
 */
import type { ContentDB, TierDef } from '../../../../core/content';
import type { Calendar, TierId } from '../../../../core/model';
import { weekCode, weekDefAt, weekName } from '../../../format/calendar';
import { tc } from './text';

export { weekDefAt };

/** Short id ("P1", "MW7", "TW2"). */
/** "MW3", "P1"; week 0 is next-season setup (season start), past the last week the season-end step. */
export function weekShort(content: ContentDB, weekIndex: number): string {
  if (weekIndex <= 0) return tc('week.seasonStart');
  return weekDefAt(content, weekIndex) ? weekCode(content, weekIndex) : tc('week.seasonEnd');
}

function tierOf(content: ContentDB, tierId: TierId | null): TierDef | null {
  return (tierId && content.tiers.get(tierId)) || content.tiers.list[0] || null;
}

export type RoundId = 'quarterfinal' | 'semifinal' | 'final';

export function isRoundId(round: string): round is RoundId {
  return round === 'quarterfinal' || round === 'semifinal' || round === 'final';
}

/** "Quarterfinal", "Semifinal", "Final". */
export function roundName(round: RoundId): string {
  return tc(`round.${round}`);
}

/** Long label: "Trials Day", "Matchweek 7", "Banner Reckoning quarterfinal". */
export function weekLong(content: ContentDB, weekIndex: number, tierId: TierId | null = null): string {
  return weekName(content, weekIndex, tierOf(content, tierId));
}

/** "P1 · Trials Day", "MW7", "TW1 · Banner Reckoning quarterfinal". */
export function weekTitle(content: ContentDB, weekIndex: number, tierId: TierId | null = null): string {
  const def = weekDefAt(content, weekIndex);
  if (!def) return tc('week.seasonEnd');
  if (def.matchweek != null) return def.id;
  const long = weekLong(content, weekIndex, tierId);
  return long === def.id ? def.id : `${def.id} · ${long}`;
}

/** Matchweeks of the regular season already processed (0 in preseason, all of them from the Reckoning on). */
export function matchweeksPlayed(content: ContentDB, calendar: Calendar): number {
  const total = content.leagues.regularSeason.matchesPerClub;
  if (calendar.phase === 'preseason') return 0;
  if (calendar.phase === 'tournament' || calendar.phase === 'season-end') return total;
  const def = weekDefAt(content, calendar.weekIndex);
  return Math.max(0, (def?.matchweek ?? 1) - 1);
}

/** The calendar week index of a matchweek number, if any. */
export function weekIndexOfMatchweek(content: ContentDB, matchweek: number): number | null {
  return content.weeks.list.find((w) => w.matchweek === matchweek)?.index ?? null;
}

/** The week index of a tournament round ("quarterfinal" -> 21). */
export function weekIndexOfRound(content: ContentDB, round: string): number | null {
  return content.weeks.list.find((w) => w.round === round)?.index ?? null;
}
