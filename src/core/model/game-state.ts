import type { Seed } from '../rng';
import type { Calendar, SeasonPhase } from './calendar';
import type { Club } from './club';
import type { Competition, Fixture, StandingRow } from './competition';
import type { Fighter } from './fighter';
import type {
  ClubId,
  CompetitionId,
  FighterId,
  FixtureId,
  IdCounters,
  IdMap,
  NewsId,
  TierId,
} from './ids';
import type { Ledger } from './ledger';
import type { MatchResult } from './match';
import type { NewsItem } from './news';

/**
 * Version of the GameState shape. Any change to a persisted type in
 * core/model bumps this and adds a migration in core/save (architect-owned).
 */
export const STATE_SCHEMA_VERSION = 1;

/**
 * The complete, authoritative, JSON-safe state of one career. Everything the
 * game needs to continue lives here; nothing authoritative lives in the UI.
 *
 * Ownership (who may write which part) is listed in docs/design 05 §3. All
 * writes happen inside core transitions (applyCommand, advanceWeek, season
 * end) on a cloned draft; committed states are treated as immutable.
 */
export interface GameState {
  schemaVersion: number;
  /** Theme and exact content the career was created with. */
  content: ContentRef;
  rng: RngRoot;
  ids: IdCounters;
  calendar: Calendar;
  options: GameOptions;
  /** null until the player picks a club after world generation. */
  playerClubId: ClubId | null;
  clubs: IdMap<ClubId, Club>;
  fighters: IdMap<FighterId, Fighter>;
  competitions: IdMap<CompetitionId, Competition>;
  fixtures: IdMap<FixtureId, Fixture>;
  /** Keyed by fixture id; present iff the fixture was played. */
  results: IdMap<FixtureId, MatchResult>;
  ledger: Ledger;
  /** Newest last. Older items may be pruned at season end (TUNABLE retention). */
  news: NewsItem[];
  /** One record per completed season, oldest first. */
  history: SeasonRecord[];
}

/** Content identity: theme folder name + hash of the validated content files. */
export interface ContentRef {
  /** Theme folder under content/, e.g. "default". */
  id: string;
  /** hashString(stableStringify(raw content files)). */
  hash: string;
}

/**
 * Root of all randomness. Everything random is derived from `root` plus a
 * path (see core/rng STREAM). `counters` number the streams used by
 * repeatable actions (e.g. counters.action for command-triggered rolls) so
 * each use gets a fresh, reproducible stream.
 */
export interface RngRoot {
  root: Seed;
  counters: Record<string, number>;
}

/**
 * New-game options. [phase B] the option set (difficulty, aging/injury
 * toggles, hardcore) comes from 02/03 design docs; values are plain JSON.
 */
export type GameOptions = Record<string, boolean | number | string>;

/** Archive of a finished season (written once by the season-end step). */
export interface SeasonRecord {
  season: number;
  leagues: { tierId: TierId; competitionId: CompetitionId; table: StandingRow[] }[];
  tournament: { competitionId: CompetitionId; winnerClubId: ClubId | null } | null;
  promoted: ClubId[];
  relegated: ClubId[];
  retiredFighterIds: FighterId[];
}

/** Returned by advanceWeek for the hub / digest screen. */
export interface WeekReport {
  season: number;
  week: number;
  phase: SeasonPhase;
  /** Fixtures played this week (all clubs), in simulation order. */
  fixtureIds: FixtureId[];
  /** The player's fixture this week, if any. */
  playerFixtureId: FixtureId | null;
  newsIds: NewsId[];
  /** Ledger entries written this week: seq in [ledgerSeqFrom, ledgerSeqTo). */
  ledgerSeqFrom: number;
  ledgerSeqTo: number;
}
