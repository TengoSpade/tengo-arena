import type { ClubId, CompetitionId, FixtureId, TierId, TournamentTemplateId } from './ids';

/**
 * A league season of one tier, or one tournament edition. Created by
 * core/league at season start (leagues) or when qualification is known
 * (tournament). Participants are fixed at creation.
 */
export interface Competition {
  id: CompetitionId;
  kind: CompetitionKind;
  season: number;
  /** leagues: the tier; tournaments: null. */
  tierId: TierId | null;
  /** tournaments: the leagues.json tournament definition; leagues: null. */
  tournamentTemplateId: TournamentTemplateId | null;
  clubIds: ClubId[];
  /** All fixtures of this competition in schedule order. */
  fixtureIds: FixtureId[];
  /** Knockout structure (tournaments only). */
  bracket: Bracket | null;
  status: 'scheduled' | 'in-progress' | 'completed';
}

export type CompetitionKind = 'league' | 'tournament';

/** A scheduled match between two clubs. The schedule (core/league) creates fixtures; the season engine records results. */
export interface Fixture {
  id: FixtureId;
  competitionId: CompetitionId;
  season: number;
  /** Calendar week the fixture is played in (see Calendar.week). */
  week: number;
  /** League: matchday number 1..N. Tournament: round number 1..R. */
  stage: number;
  homeClubId: ClubId;
  awayClubId: ClubId;
  status: FixtureStatus;
}

export type FixtureStatus = 'scheduled' | 'played';

/**
 * Knockout bracket. Round r+1 ties are filled from round r winners; their
 * fixtures are created when both participants are known.
 * EXAMPLE: 8 clubs -> 3 rounds of 4, 2 and 1 ties.
 */
export interface Bracket {
  rounds: BracketRound[];
}

export interface BracketRound {
  /** 1-based round number. */
  round: number;
  week: number;
  ties: BracketTie[];
}

export interface BracketTie {
  home: BracketSlot;
  away: BracketSlot;
  /** Set once both clubs are known and the fixture exists. */
  fixtureId: FixtureId | null;
  winnerClubId: ClubId | null;
}

export type BracketSlot =
  | { kind: 'club'; clubId: ClubId }
  /** Winner of tie `tie` (0-based) in round `round` (1-based). */
  | { kind: 'winner-of'; round: number; tie: number };

/**
 * One row of a league table. Standings are DERIVED from results by
 * core/league (never stored as authoritative state); archived final tables
 * are stored in SeasonRecord. [phase B] points and tie-break rules from
 * 03-league-economy.
 */
export interface StandingRow {
  clubId: ClubId;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  roundsFor: number;
  roundsAgainst: number;
  points: number;
}
