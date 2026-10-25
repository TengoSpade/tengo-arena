import type { Seed } from '../rng';
import type { Calendar } from './calendar';
import type { Club } from './club';
import type { Competition, Fixture } from './competition';
import type { Fighter } from './fighter';
import type { SeasonRecord } from './history';
import type { ClubId, CompetitionId, FighterId, FixtureId, IdCounters, IdMap } from './ids';
import type { Ledger } from './ledger';
import type { AiClubMemory, KnowledgeEntry, MarketState } from './market';
import type { MatchResult } from './match';
import type { NewsItem } from './news';

/**
 * Version of the GameState shape. Any change to a persisted type in
 * core/model bumps this and adds a migration in core/save (architect-owned).
 */
export const STATE_SCHEMA_VERSION = 1;

/**
 * The complete, authoritative, JSON-safe state of one career. Everything
 * needed to continue lives here; nothing authoritative lives in the UI.
 * Ownership per part: docs/design/_drafts/05-technical.md §3.2. All writes
 * happen inside core transitions on a cloned draft (produce()); committed
 * states are immutable.
 */
export interface GameState {
  schemaVersion: number;
  /** Theme and exact content the career runs on. */
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
  /** Present iff the fixture was played. Full results for the current and previous season; older ones compacted (TUNABLE). */
  results: IdMap<FixtureId, MatchResult>;

  market: MarketState;
  ai: IdMap<ClubId, AiClubMemory>;
  ledger: Ledger;
  /** Newest last; pruned to the current and previous season at season end. */
  news: NewsItem[];
  /** One record per completed season, oldest first. */
  history: SeasonRecord[];

  /** Reserved for M4 knowledge (per viewing club, per fighter). Always null in M1 (open-026: true values visible). */
  knowledge: IdMap<ClubId, IdMap<FighterId, KnowledgeEntry>> | null;
}

/** Content identity: theme folder name + hash of the raw content files. */
export interface ContentRef {
  id: string;
  hash: string;
}

/**
 * Root of all randomness. Everything random derives from `root` + a path
 * (core/rng STREAM). `counters` number repeatable uses, e.g. counters.action
 * for command-triggered rolls.
 */
export interface RngRoot {
  root: Seed;
  counters: Record<string, number>;
}

/**
 * Career options chosen at new game. Orchestrator decisions of 2026-10-25
 * (pending owner confirmation) set the M1 defaults.
 */
export interface GameOptions {
  /** Standing training emphasis per fighter (lifecycle L-2); routes earned growth only. Default true. */
  trainingEmphasis: boolean;
  /** M1-light patron goal (03-league-economy owner question 8). Default false: no patron goal in M1. */
  patronGoals: boolean;
  /** Retirement on (P-10). Default true. */
  retirement: boolean;
}

export const DEFAULT_GAME_OPTIONS: Readonly<GameOptions> = {
  trainingEmphasis: true,
  patronGoals: false,
  retirement: true,
};
