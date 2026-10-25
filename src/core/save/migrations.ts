/**
 * GameState migrations (05 §5): pure, stepwise vN -> vN+1 functions on the
 * parsed JSON of an older save. parseSave runs them after the checksum check
 * and validates the result against the current schema.
 */
import {
  CAREER_ENDING_WEEKS,
  alumnusOf,
  trimHistoryStats,
  type Alumnus,
  type AlumnusCause,
  type ClubId,
  type Fighter,
  type ReckoningStage,
} from '../model';

/** One migration step of the GameState shape. */
export interface Migration {
  from: number;
  to: number;
  migrate(state: unknown): unknown;
}

type Json = Record<string, unknown>;
type Loose = Json & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * v1 -> v2 (M1 performance pass):
 * - departed fighters (retired, career-ending, left unsigned; past hired blades)
 *   leave `fighters` for the slim `alumni` map, and every roster-side reference
 *   to them (shortlists, lineups, negotiations) is dropped;
 * - agreed renewals move from market.negotiations (kind 'renewal', counterWage
 *   set, validUntilWeek null) to Contract.next; every contract gets `next`;
 * - FreeAgency.enteredAt (release season, else this season; week 1);
 * - Injury.careerEnding (weeksOut at the career-ending sentinel);
 * - TierSeasonRecord.reckoningStages from the clubs' season rows;
 * - fighter history rows keep display stats on the last two rows only.
 */
export function migrateV1ToV2(raw: unknown): unknown {
  const s = raw as Loose;
  const season = s.calendar.season as number;
  const fighters = s.fighters as Record<string, Loose>;

  const retirements = new Map<string, { season: number; cause: AlumnusCause; lastClubId: ClubId | null }>();
  for (const h of (s.history ?? []) as Loose[]) {
    for (const r of (h.retirements ?? []) as Loose[]) retirements.set(r.fighterId, { season: h.season, cause: r.cause, lastClubId: r.lastClubId });
  }

  const agreed = new Map<string, Loose>();
  s.market.negotiations = (s.market.negotiations as Loose[]).filter((n) => {
    const done = n.kind === 'renewal' && n.counterWage !== null && n.validUntilWeek === null;
    if (done) agreed.set(n.fighterId, n);
    return !done;
  });

  const alumni: Record<string, Alumnus> = {};
  const gone = new Set<string>();
  for (const id of Object.keys(fighters)) {
    const f = fighters[id]!;
    if (f.contract) {
      const n = agreed.get(id);
      f.contract.next = n && n.clubId === f.contract.clubId ? { wagePerWeek: n.counterWage, endSeason: f.contract.endSeason } : null;
    }
    if (f.freeAgency && f.freeAgency.enteredAt === undefined) f.freeAgency.enteredAt = { season: f.freeAgency.releasedSeason ?? season, weekIndex: 1 };
    if (f.injury && f.injury.careerEnding === undefined) f.injury.careerEnding = f.injury.weeksOut >= CAREER_ENDING_WEEKS;
    trimHistoryStats(f.history);
    const pastBlade = f.status === 'hired-blade' && f.clubId === null;
    if (f.status !== 'retired' && !pastBlade) continue;
    const r = retirements.get(id);
    const lastRow = (f.history as Loose[])[f.history.length - 1];
    const leftSeason = r?.season ?? lastRow?.season ?? season - 1;
    const cause: AlumnusCause = pastBlade ? 'hired-blade' : (r?.cause ?? 'age');
    const lastClubId = pastBlade ? null : (r?.lastClubId ?? f.freeAgency?.formerClubId ?? lastRow?.clubId ?? null);
    alumni[id] = alumnusOf(f as unknown as Fighter, leftSeason, cause, lastClubId);
    gone.add(id);
    delete fighters[id];
  }

  if (gone.size > 0) {
    for (const club of Object.values(s.clubs as Record<string, Loose>)) {
      club.shortlist = (club.shortlist as string[]).filter((x) => !gone.has(x));
      const lineup = club.lineup as Loose;
      lineup.fighters = (lineup.fighters as Loose[]).filter((e) => !gone.has(e.fighterId));
      if (lineup.matchCaptainId !== null && gone.has(lineup.matchCaptainId)) lineup.matchCaptainId = null;
      for (const x of Object.keys(lineup.tactics)) if (gone.has(x)) delete lineup.tactics[x];
    }
    s.market.negotiations = (s.market.negotiations as Loose[]).filter((n) => !gone.has(n.fighterId));
    s.market.offers = (s.market.offers as Loose[]).filter((o) => !gone.has(o.fighterId));
  }

  // Furthest Reckoning stage per club, from the clubs' season rows (ClubSeasonRow.reckoning).
  const stages = new Map<string, Record<string, ReckoningStage>>();
  for (const club of Object.values(s.clubs as Record<string, Loose>)) {
    for (const row of club.history as Loose[]) {
      if (row.reckoning === null) continue;
      const key = `${row.season}|${row.tierId}`;
      const map = stages.get(key) ?? {};
      map[club.id] = row.reckoning;
      stages.set(key, map);
    }
  }
  for (const h of (s.history ?? []) as Loose[]) {
    for (const t of h.tiers as Loose[]) if (t.reckoningStages === undefined) t.reckoningStages = stages.get(`${h.season}|${t.tierId}`) ?? {};
  }

  // Last key, as in a fresh v2 state (emptyGameState).
  s.alumni = alumni;
  s.schemaVersion = 2;
  return s;
}

/** Ordered migrations up to STATE_SCHEMA_VERSION. */
export const MIGRATIONS: readonly Migration[] = [{ from: 1, to: 2, migrate: migrateV1ToV2 }];
