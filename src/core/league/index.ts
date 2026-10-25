/**
 * core/league — league structure, calendar, schedule, standings, the
 * Reckoning and promotion/relegation (03-league-economy sys-league,
 * sys-calendar, sys-tournament). Owner: WP3. CONTRACT: signatures fixed; bodies are stubs.
 *
 * M1 structure (orchestrator decision 2026-10-25, pending owner): 3 tiers ×
 * 16 clubs in two 8-club wings; 16 matches (double round-robin in the wing +
 * 2 cross-wing); points 3/2/1/0; the Reckoning: top 4 per wing, QF/SF
 * best-of-3, final best-of-5; promotion = the lower tier's Reckoning
 * champion + Shield winner; relegation = 8th in each wing. All numbers and
 * formats come from leagues.json; code must not assume them.
 */
import type { CalendarWeekDef, ContentDB } from '../content';
import type {
  Calendar,
  ClubId,
  CompetitionId,
  Fixture,
  FixtureId,
  GameState,
  LeagueRecordsView,
  MatchResult,
  SeasonRecord,
  StandingRow,
  TierId,
  WingId,
} from '../model';
import { notImplemented } from '../util';

// ---- calendar -------------------------------------------------------------------------------

/** The calendar week of a season week index. */
export function weekDef(content: ContentDB, weekIndex: number): CalendarWeekDef {
  return notImplemented('league.weekDef', content, weekIndex);
}

/** Calendar after processing the current week (next week, or 'season-end' after the last). */
export function nextCalendar(calendar: Calendar, content: ContentDB): Calendar {
  return notImplemented('league.nextCalendar', calendar, content);
}

/** Calendar at week 1 of a season. */
export function seasonStartCalendar(season: number, content: ContentDB): Calendar {
  return notImplemented('league.seasonStartCalendar', season, content);
}

// ---- season setup and schedule ------------------------------------------------------------------

/**
 * Next-season setup (season-end step 13, and new game): wing draw by
 * serpentine on the seed order, league competitions and all 16 matchweeks of
 * fixtures for every tier. Uses STREAM.schedule. Club tiers must already be set.
 */
export function setupSeason(draft: GameState, season: number, content: ContentDB): void {
  return notImplemented('league.setupSeason', draft, season, content);
}

/** Fixtures of a week in simulation order (tier level, then fixture id). */
export function fixturesForWeek(state: GameState, weekIndex: number): Fixture[] {
  return notImplemented('league.fixturesForWeek', state, weekIndex);
}

/** A club's fixture in a week, if any. */
export function clubFixture(state: GameState, clubId: ClubId, weekIndex: number): Fixture | null {
  return notImplemented('league.clubFixture', state, clubId, weekIndex);
}

/** All fixtures of a club this season, in week order. */
export function clubSchedule(state: GameState, clubId: ClubId): Fixture[] {
  return notImplemented('league.clubSchedule', state, clubId);
}

// ---- results and standings ---------------------------------------------------------------------------

/** Week step 2: mark the fixture played and advance a Reckoning bracket. The result itself is stored by core/game. */
export function recordResult(draft: GameState, result: MatchResult, content: ContentDB): void {
  return notImplemented('league.recordResult', draft, result, content);
}

/** Derived wing or tier table with the leagues.json tie-breakers (lot on STREAM.schedule). */
export function standings(state: GameState, competitionId: CompetitionId, scope: WingId | 'tier', content: ContentDB): StandingRow[] {
  return notImplemented('league.standings', state, competitionId, scope, content);
}

/** The league competition of a tier in a season. */
export function leagueCompetitionOf(state: GameState, season: number, tierId: TierId): CompetitionId | null {
  return notImplemented('league.leagueCompetitionOf', state, season, tierId);
}

// ---- the Reckoning ------------------------------------------------------------------------------------------

/** When the regular season ends: create each tier's Reckoning (top 4 per wing, seeding, QF fixtures). */
export function seedReckonings(draft: GameState, content: ContentDB): void {
  return notImplemented('league.seedReckonings', draft, content);
}

/** Furthest Reckoning stage of a club this season. */
export function reckoningStage(state: GameState, clubId: ClubId): 'quarterfinal' | 'semifinal' | 'final' | 'champion' | null {
  return notImplemented('league.reckoningStage', state, clubId);
}

// ---- season end ---------------------------------------------------------------------------------------------------

export interface TierMove {
  clubId: ClubId;
  from: TierId;
  to: TierId;
  reason: 'reckoning' | 'shield' | 'relegated';
}

/** Season-end step 3: decide promotions and relegations (Reckoning champion + Shield up, 8th per wing down). */
export function promotionRelegation(state: GameState, content: ContentDB): TierMove[] {
  return notImplemented('league.promotionRelegation', state, content);
}

/** Apply tier moves to clubs. */
export function applyTierMoves(draft: GameState, moves: readonly TierMove[]): void {
  return notImplemented('league.applyTierMoves', draft, moves);
}

/** Season-end step 1: archive final tables, champions and movements. */
export function archiveSeason(state: GameState, moves: readonly TierMove[], content: ContentDB): SeasonRecord {
  return notImplemented('league.archiveSeason', state, moves, content);
}

/** Compact results older than the retention window (keeps scores). */
export function compactHistory(draft: GameState, content: ContentDB): void {
  return notImplemented('league.compactHistory', draft, content);
}

/** All-time records derived from history. */
export function leagueRecords(state: GameState): LeagueRecordsView {
  return notImplemented('league.leagueRecords', state);
}

/** Every fixture id of a competition in schedule order (helper for reports). */
export function competitionFixtures(state: GameState, competitionId: CompetitionId): FixtureId[] {
  return notImplemented('league.competitionFixtures', state, competitionId);
}
