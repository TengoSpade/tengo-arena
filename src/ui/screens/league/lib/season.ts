/**
 * Read-only lookups over GameState for the WP7 screens: the player's club,
 * competitions, fixtures and results. These are plain data reads (filter and
 * order by week and id); every game rule (standings, seeding, money) stays
 * in core and is reached through ./views.ts.
 */
import {
  leagueCompetitionId,
  reckoningCompetitionId,
  type Club,
  type ClubId,
  type Competition,
  type Fighter,
  type FighterId,
  type Fixture,
  type FixtureId,
  type GameState,
  type MatchResult,
  type TierId,
} from '../../../../core/model';
import { compareStrings } from '../../../../core/util';

export function playerClub(state: GameState): Club | null {
  return state.playerClubId ? (state.clubs[state.playerClubId] ?? null) : null;
}

export function leagueCompetition(state: GameState, season: number, tierId: TierId): Competition | null {
  return state.competitions[leagueCompetitionId(season, tierId)] ?? null;
}

export function reckoningCompetition(state: GameState, season: number, tierId: TierId): Competition | null {
  return state.competitions[reckoningCompetitionId(season, tierId)] ?? null;
}

function byWeekThenId(a: Fixture, b: Fixture): number {
  return a.weekIndex - b.weekIndex || compareStrings(a.id, b.id);
}

/** A club's fixtures in a season (league and Reckoning), in week order. */
export function clubFixtures(state: GameState, clubId: ClubId, season: number): Fixture[] {
  return Object.values(state.fixtures)
    .filter((f) => f.season === season && (f.homeClubId === clubId || f.awayClubId === clubId))
    .sort(byWeekThenId);
}

/** Every fixture of a tier in one week, in fixture-id order. */
export function tierFixturesOfWeek(state: GameState, tierId: TierId, season: number, weekIndex: number): Fixture[] {
  return Object.values(state.fixtures)
    .filter((f) => f.season === season && f.tierId === tierId && f.weekIndex === weekIndex)
    .sort(byWeekThenId);
}

export function resultOf(state: GameState, fixtureId: FixtureId): MatchResult | null {
  return state.results[fixtureId] ?? null;
}

/** The fixture a club plays this week, if any. */
export function currentFixture(state: GameState, clubId: ClubId): Fixture | null {
  const { season, weekIndex } = state.calendar;
  return clubFixtures(state, clubId, season).find((f) => f.weekIndex === weekIndex) ?? null;
}

/** The club's next unplayed fixture (this week or later). */
export function nextFixture(state: GameState, clubId: ClubId): Fixture | null {
  const { season, weekIndex } = state.calendar;
  return clubFixtures(state, clubId, season).find((f) => f.weekIndex >= weekIndex && f.status !== 'played') ?? null;
}

/** Opponent of a club in a fixture. */
export function opponentOf(fixture: Fixture, clubId: ClubId): ClubId {
  return fixture.homeClubId === clubId ? fixture.awayClubId : fixture.homeClubId;
}

/** Roster (active fighters of a club), best rating first is the caller's job. */
export function rosterOf(state: GameState, clubId: ClubId): Fighter[] {
  return Object.values(state.fighters)
    .filter((f) => f.clubId === clubId && f.status === 'active')
    .sort((a, b) => compareStrings(a.id, b.id));
}

export function fighterOf(state: GameState, id: FighterId | null | undefined): Fighter | null {
  if (!id) return null;
  return state.fighters[id] ?? null;
}

/** The roster cap of a club's current tier (O2). */
export function rosterCap(state: GameState, clubId: ClubId, tiers: { get(id: string): { rosterCap: number } | undefined }): number {
  const club = state.clubs[clubId];
  return (club && tiers.get(club.tierId)?.rosterCap) || 0;
}

/** Played fixtures of a club this season that have a stored result, in week order. */
export function playedFixtures(state: GameState, clubId: ClubId, season: number): Fixture[] {
  return clubFixtures(state, clubId, season).filter((f) => state.results[f.id] !== undefined);
}

/** Round scores "W L W" from a club's point of view. */
export function roundLetters(result: MatchResult, clubId: ClubId): ('W' | 'L')[] {
  const side = result.homeClubId === clubId ? 'home' : 'away';
  return result.rounds.map((r) => (r.winner === side ? 'W' : 'L'));
}
