/**
 * GameState migrations (05 §5): pure, stepwise vN -> vN+1 functions on the
 * parsed JSON of an older save. parseSave runs them after the checksum check
 * and validates the result against the current schema. A step receives the
 * loaded content (v2 -> v3 derives Stamina, levels and club defaults from it).
 */
import { clubMatchDefaults, type ContentDB } from '../content';
import { migrateFightersToV3 } from '../fighters';
import {
  CAREER_ENDING_WEEKS,
  alumnusOf,
  trimHistoryStats,
  type Alumnus,
  type AlumnusCause,
  type ClubId,
  type Fighter,
  type GameState,
  type ReckoningStage,
} from '../model';

/** One migration step of the GameState shape. */
export interface Migration {
  from: number;
  to: number;
  migrate(state: unknown, content: ContentDB): unknown;
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

/**
 * v2 -> v3 (M1.1 "Playtest round 1"; progression.md §6, combat-skills.md sys-match):
 * - every fighter: Stamina rolled from Rng(root, 'migration', 'm1.1', fighterId,
 *   purpose) (cap, bloom; wear = his str wear), train100 = the M1 developed value
 *   (every shown stat unchanged), peakRating shifted by the reweight, the level
 *   from the formula, this season's round XP carried into the bar (below one
 *   level), no pending level-ups, Freshness 100, rank 1, no perks, zeroed
 *   M1.1 season counters, null new history columns (core/fighters migrateFightersToV3);
 * - every club: lineup reserves [], level-up policy (player 'manual', AI 'auto'),
 *   pacing, auto-swap rules and the between-round pause from content;
 * - alumni careers gain levelsGained 0;
 * - liveMatch null (v2 saves never hold a match in progress).
 * Deterministic: migrating a save twice gives byte-identical states (mig-002).
 */
export function migrateV2ToV3(raw: unknown, content: ContentDB): unknown {
  const s = raw as Loose;
  for (const club of Object.values(s.clubs as Record<string, Loose>)) {
    const l = club.lineup as Loose;
    club.lineup = { fighters: l.fighters, reserves: [], matchCaptainId: l.matchCaptainId, tactics: l.tactics };
    const who = club.id === s.playerClubId ? ({ player: true } as const) : ({ player: false, personalityId: club.aiPersonalityId as string } as const);
    Object.assign(club, clubMatchDefaults(content, who));
  }
  migrateFightersToV3(s as unknown as GameState, content);
  // Alumni keep their career totals; the M1.1 counter reads 0.
  for (const a of Object.values((s.alumni ?? {}) as Record<string, Loose>)) if (a.career.levelsGained === undefined) a.career.levelsGained = 0;
  s.liveMatch = null;
  s.schemaVersion = 3;
  return s;
}

/**
 * v3 -> v4 (KI-2): the only change is the additive optional `MatchResult.fielded` that in-season compaction writes, so
 * nothing in a v3 state needs rewriting: the step is the identity and the runner stamps the new version. The bump
 * exists for older builds: their strict schema refuses the new field with "the save is damaged", whereas a version
 * newer than the build's is reported as exactly that (`save.too-new`). Every v3 save, the owner's careers and ticket
 * reproductions included, still loads; its full results are compacted by the week rule from its next week on.
 */
export function migrateV3ToV4(raw: unknown): unknown {
  return raw;
}

/** Ordered migrations up to STATE_SCHEMA_VERSION. */
export const MIGRATIONS: readonly Migration[] = [
  { from: 1, to: 2, migrate: migrateV1ToV2 },
  { from: 2, to: 3, migrate: migrateV2ToV3 },
  { from: 3, to: 4, migrate: migrateV3ToV4 },
];
