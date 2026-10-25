/**
 * "If the season ended today" seeding for the bracket projection (04
 * ui-league, 03 sys-tournament: wing winners are seeds 1-2 ordered by the
 * tier table, the other qualifiers seeds 3-8 by the tier table). Display
 * only: the committed seeding is core/league seedReckonings. CHANGE REQUEST
 * (WP3): export a projectedSeeds view so this ordering lives in one place.
 */
import type { ContentDB } from '../../../../core/content';
import type { ClubId, StandingRow, WingId } from '../../../../core/model';

export function projectSeeds(
  content: ContentDB,
  wingTables: readonly { wingId: WingId; rows: readonly StandingRow[] }[],
  tierTable: readonly StandingRow[],
): ClubId[] {
  const perWing = content.leagues.tournament.qualifiersPerWing;
  const rank = new Map(tierTable.map((r) => [r.clubId, r.position]));
  const byRank = (a: ClubId, b: ClubId) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999);
  const winners: ClubId[] = [];
  const others: ClubId[] = [];
  for (const w of wingTables) {
    const sorted = [...w.rows].sort((a, b) => a.position - b.position);
    sorted.slice(0, perWing).forEach((r, i) => (i === 0 ? winners : others).push(r.clubId));
  }
  return [...winners.sort(byRank), ...others.sort(byRank)];
}

/** The first matchweek from which the projection is shown (03 sys-tournament: "from MW13"). PROVISIONAL constant; content has no field for it. */
export const PROVISIONAL_PROJECTION_FROM_MATCHWEEK = 13;
