import type { ClubId, CompetitionId, FixtureId, TierId, VenueId, WeekId, WingId } from './ids';

/**
 * A tier's league season (two 8-club wings, 16 matches per club) or that
 * tier's Reckoning (top-8 knockout). Created by core/league; participants
 * are fixed at creation (03-league-economy sys-league, sys-tournament).
 */
export interface Competition {
  id: CompetitionId;
  kind: CompetitionKind;
  season: number;
  tierId: TierId;
  clubIds: ClubId[];
  /** League only: the wing draw, clubs in slot order k = 0..7. */
  wings: WingDraw[];
  /** League only: the order used for the serpentine wing draw. */
  seedOrder: ClubId[];
  /** All fixtures in schedule order (Reckoning: created as ties are known). */
  fixtureIds: FixtureId[];
  /** Reckoning only. */
  bracket: Bracket | null;
  status: 'scheduled' | 'in-progress' | 'completed';
}

export type CompetitionKind = 'league' | 'reckoning';

export interface WingDraw {
  wingId: WingId;
  clubIds: ClubId[];
}

/** A scheduled match between two clubs. */
export interface Fixture {
  id: FixtureId;
  competitionId: CompetitionId;
  season: number;
  tierId: TierId;
  /** Season week index (Calendar.weekIndex) and its id. */
  weekIndex: number;
  weekId: WeekId;
  /** League: 'league'. Reckoning: the round id. */
  stage: FixtureStage;
  /** League: matchweek 1..16; Reckoning: null. */
  matchweek: number | null;
  /** League: the wing, or 'cross' for cross-wing matchweeks; Reckoning: null. */
  wing: WingId | 'cross' | null;
  /** Home sets the west end of the arena; no combat modifier (open-013). */
  homeClubId: ClubId;
  awayClubId: ClubId;
  /** 3, or 5 for the Reckoning final (P-02). */
  bestOf: number;
  /** Neutral venue (the final), else null = home club's arena. */
  venueId: VenueId | null;
  status: 'scheduled' | 'played';
}

export type FixtureStage = 'league' | 'quarterfinal' | 'semifinal' | 'final';

/** Knockout bracket: wing winners seeds 1-2; QF 1v8, 4v5, 2v7, 3v6 (leagues.json). */
export interface Bracket {
  /** Seeds 1..8 -> club. */
  seeds: ClubId[];
  rounds: BracketRound[];
  championId: ClubId | null;
  runnerUpId: ClubId | null;
}

export interface BracketRound {
  roundId: 'quarterfinal' | 'semifinal' | 'final';
  weekId: WeekId;
  bestOf: number;
  ties: BracketTie[];
}

export interface BracketTie {
  /** 1-based tie number within the round (part of the fixture identity). */
  slot: number;
  home: BracketSlot;
  away: BracketSlot;
  /** Set once both clubs are known and the fixture exists. */
  fixtureId: FixtureId | null;
  winnerClubId: ClubId | null;
}

export type BracketSlot =
  | { kind: 'seed'; seed: number }
  /** Winner of tie `slot` in round `roundId`. */
  | { kind: 'winner-of'; roundId: 'quarterfinal' | 'semifinal'; slot: number };

/**
 * One row of a wing or tier table. DERIVED from results by core/league with
 * the leagues.json tie-breakers; archived copies live in SeasonRecord.
 */
export interface StandingRow {
  clubId: ClubId;
  position: number;
  played: number;
  matchWins: number;
  matchLosses: number;
  /** 3 / 2 / 1 / 0 for 2-0 / 2-1 / 1-2 / 0-2 (leagues.json standings). */
  points: number;
  roundsWon: number;
  roundsLost: number;
  downsInflicted: number;
  downsSuffered: number;
  /** Count of each result. */
  results: { '2-0': number; '2-1': number; '1-2': number; '0-2': number };
  /** Last five results, newest last. */
  form: ('W' | 'L')[];
}

export interface StandingsTable {
  competitionId: CompetitionId;
  /** Wing id, or 'tier' for the full 16-club table. */
  scope: WingId | 'tier';
  rows: StandingRow[];
}
