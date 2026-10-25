/**
 * core/league — league structure, calendar, schedule, standings, the
 * Reckoning and promotion/relegation (03-league-economy sys-league,
 * sys-calendar, sys-tournament). Owner: WP3. CONTRACT: signatures fixed.
 *
 * M1 structure (orchestrator decision 2026-10-25, pending owner): 3 tiers ×
 * 16 clubs in two 8-club wings; 16 matches (double round-robin in the wing +
 * 2 cross-wing); points 3/2/1/0; the Reckoning: top 4 per wing, QF/SF
 * best-of-3, final best-of-5; promotion = the lower tier's Reckoning
 * champion + Shield winner; relegation = 8th in each wing. All numbers and
 * formats come from leagues.json; code must not assume them.
 *
 * "This season" always means state.calendar.season. Writers (setupSeason,
 * recordResult, seedReckonings, applyTierMoves, compactHistory) mutate a
 * draft inside a core/game transition; everything else is a pure read.
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
import { leagueCompetitionId } from '../model';
import { invariant } from '../util';
import * as cal from './calendar';
import { compareFixtures, requireCompetition, seasonFixtures } from './common';
import { advanceBracket, reckoningStageForSeason, seedReckoningsImpl } from './reckoning';
import { setupSeasonImpl } from './schedule';
import {
  applyTierMovesImpl,
  archiveSeasonImpl,
  compactHistoryImpl,
  leagueRecordsImpl,
  leagueSeasonColumnsImpl,
  promotionRelegationImpl,
  type LeagueSeasonColumns,
  type TierMove,
} from './season-end';
import { standingsImpl } from './standings';

// ---- calendar -------------------------------------------------------------------------------

/** The calendar week of a season week index. */
export function weekDef(content: ContentDB, weekIndex: number): CalendarWeekDef {
  return cal.weekDef(content, weekIndex);
}

/** Calendar after processing the current week (next week, or 'season-end' after the last). */
export function nextCalendar(calendar: Calendar, content: ContentDB): Calendar {
  return cal.nextCalendar(calendar, content);
}

/** Calendar at week 1 of a season. */
export function seasonStartCalendar(season: number, content: ContentDB): Calendar {
  return cal.seasonStartCalendar(season, content);
}

export { seasonLength, calendarAt, matchweekWeek, lastRegularWeekIndex } from './calendar';

// ---- season setup and schedule ------------------------------------------------------------------

/**
 * Next-season setup (season-end step 13, and new game): wing draw by
 * serpentine on the seed order, league competitions and all 16 matchweeks of
 * fixtures for every tier. Uses STREAM.schedule. Club tiers must already be set.
 */
export function setupSeason(draft: GameState, season: number, content: ContentDB): void {
  setupSeasonImpl(draft, season, content);
}

/**
 * Fixtures of a week in simulation order (tier level, then fixture id).
 * Pass `content` for the tier-level order; without it the order is fixture
 * id only (deterministic, but tiers interleave alphabetically). CHANGE
 * REQUEST (WP3): make `content` required.
 */
export function fixturesForWeek(state: GameState, weekIndex: number, content?: ContentDB): Fixture[] {
  const level = (f: Fixture): number => (content ? content.tiers.require(f.tierId).level : 0);
  return seasonFixtures(state, state.calendar.season)
    .filter((f) => f.weekIndex === weekIndex)
    .sort((a, b) => level(a) - level(b) || compareFixtures(a, b));
}

/** A club's fixture in a week, if any. */
export function clubFixture(state: GameState, clubId: ClubId, weekIndex: number): Fixture | null {
  const found = seasonFixtures(state, state.calendar.season).filter(
    (f) => f.weekIndex === weekIndex && (f.homeClubId === clubId || f.awayClubId === clubId),
  );
  invariant(found.length <= 1, `club ${clubId} has ${found.length} fixtures in week ${weekIndex}`);
  return found[0] ?? null;
}

/** All fixtures of a club this season, in week order. */
export function clubSchedule(state: GameState, clubId: ClubId): Fixture[] {
  return seasonFixtures(state, state.calendar.season)
    .filter((f) => f.homeClubId === clubId || f.awayClubId === clubId)
    .sort(compareFixtures);
}

export { seasonSeedOrder, serpentineDraw, buildLeagueSchedule, validateLeagueSchedule } from './schedule';
export type { LeagueSchedule, LeagueScheduleParams } from './schedule';

// ---- results and standings ---------------------------------------------------------------------------

/**
 * Week step 2: mark the fixture played and advance a Reckoning bracket. The
 * result itself is stored by core/game. Throws for an unknown or already
 * played fixture, clubs that differ from the fixture, or a score that is not
 * a decided best-of-N.
 */
export function recordResult(draft: GameState, result: MatchResult, content: ContentDB): void {
  const fixture = draft.fixtures[result.fixtureId];
  invariant(fixture, `recordResult: unknown fixture ${result.fixtureId}`);
  invariant(fixture.status === 'scheduled', `recordResult: ${fixture.id} is already played`);
  invariant(result.competitionId === fixture.competitionId, `recordResult: ${fixture.id} belongs to ${fixture.competitionId}`);
  invariant(
    result.homeClubId === fixture.homeClubId && result.awayClubId === fixture.awayClubId,
    `recordResult: clubs of ${fixture.id} do not match the fixture`,
  );
  const need = (fixture.bestOf + 1) / 2;
  const { home, away } = result.score;
  const winner = home > away ? fixture.homeClubId : fixture.awayClubId;
  invariant(
    Number.isInteger(home) && Number.isInteger(away) && Math.max(home, away) === need && Math.min(home, away) >= 0 && Math.min(home, away) < need,
    `recordResult: ${home}-${away} is not a decided best-of-${fixture.bestOf}`,
  );
  invariant(result.winnerClubId === winner, `recordResult: winner of ${fixture.id} does not match its score`);
  fixture.status = 'played';
  const comp = requireCompetition(draft, fixture.competitionId);
  if (comp.kind === 'league') {
    comp.status = comp.fixtureIds.every((id) => draft.fixtures[id]?.status === 'played') ? 'completed' : 'in-progress';
  } else {
    advanceBracket(draft, comp, fixture.id, winner, content);
  }
}

/** Derived wing or tier table with the leagues.json tie-breakers (lot on STREAM.schedule). */
export function standings(state: GameState, competitionId: CompetitionId, scope: WingId | 'tier', content: ContentDB): StandingRow[] {
  return standingsImpl(state, competitionId, scope, content);
}

/** The league competition of a tier in a season. */
export function leagueCompetitionOf(state: GameState, season: number, tierId: TierId): CompetitionId | null {
  const id = leagueCompetitionId(season, tierId);
  return state.competitions[id] ? id : null;
}

export { matchPoints } from './standings';

// ---- the Reckoning ------------------------------------------------------------------------------------------

/** When the regular season ends: create each tier's Reckoning (top 4 per wing, seeding, QF fixtures). */
export function seedReckonings(draft: GameState, content: ContentDB): void {
  seedReckoningsImpl(draft, content);
}

/** Furthest Reckoning stage of a club this season. */
export function reckoningStage(state: GameState, clubId: ClubId): 'quarterfinal' | 'semifinal' | 'final' | 'champion' | null {
  return reckoningStageForSeason(state, state.calendar.season, clubId);
}

export { reckoningSeeds, buildBracket, createReckoning, reckoningStageIn, reckoningStageForSeason } from './reckoning';
export type { ReckoningStage } from './reckoning';

// ---- season end ---------------------------------------------------------------------------------------------------

export type { TierMove, LeagueSeasonColumns } from './season-end';

/** Season-end step 3: decide promotions and relegations (Reckoning champion + Shield up, 8th per wing down). */
export function promotionRelegation(state: GameState, content: ContentDB): TierMove[] {
  return promotionRelegationImpl(state, content);
}

/** Apply tier moves to clubs. */
export function applyTierMoves(draft: GameState, moves: readonly TierMove[]): void {
  applyTierMovesImpl(draft, moves);
}

/** Season-end step 1: archive final tables, champions and movements. */
export function archiveSeason(state: GameState, moves: readonly TierMove[], content: ContentDB): SeasonRecord {
  return archiveSeasonImpl(state, moves, content);
}

/** League columns of a club's ClubSeasonRow for an archived season (core/game adds the economy columns). */
export function leagueSeasonColumns(state: GameState, record: SeasonRecord, clubId: ClubId): LeagueSeasonColumns | null {
  return leagueSeasonColumnsImpl(state, record, clubId);
}

/** Compact results older than the retention window (keeps scores). */
export function compactHistory(draft: GameState, _content: ContentDB): void {
  compactHistoryImpl(draft);
}

export { RESULT_RETENTION_SEASONS, isCompactedResult } from './season-end';

/** All-time records derived from history. */
export function leagueRecords(state: GameState): LeagueRecordsView {
  return leagueRecordsImpl(state);
}

/** Every fixture id of a competition in schedule order (helper for reports). */
export function competitionFixtures(state: GameState, competitionId: CompetitionId): FixtureId[] {
  return [...requireCompetition(state, competitionId).fixtureIds];
}
