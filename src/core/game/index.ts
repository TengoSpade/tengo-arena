/**
 * core/game — the season engine and the only entry points that change
 * GameState (03-league-economy sys-calendar order; 02 §3). Owner: WP5.
 * CONTRACT: signatures fixed; bodies are stubs.
 *
 * Transitions are pure: (state, content) -> new state via produce(); on
 * error they return err(...) and leave the input untouched. Weekly order:
 * leagues.json calendar.weekProcessingOrder; season end:
 * calendar.seasonEndOrder. Match seed = deriveSeed(root, STREAM.match,
 * season, fixtureId); simulation in fixturesForWeek order.
 */
import type { ContentDB } from '../content';
import type {
  Blocker,
  ClubId,
  Command,
  Fighter,
  FighterId,
  FixtureId,
  GameOptions,
  GameState,
  Gold,
  MatchInput,
  MatchReport,
  NewsId,
  OfferResponse,
  SeasonEndReport,
  StatId,
  WeekReport,
} from '../model';
import type { Seed } from '../rng';
import { notImplemented, type EngineError, type Result } from '../util';

// ---- transitions -----------------------------------------------------------------------------------

export interface NewGameParams {
  /** From the platform's entropy (seedFromEntropy) or a typed custom seed. */
  rootSeed: Seed;
  options?: Partial<GameOptions>;
}

/** New game: 48 clubs from clubs.json, generated rosters and free agents, finances, season-1 schedule. playerClubId = null. */
export function createWorld(content: ContentDB, params: NewGameParams): Result<GameState, EngineError> {
  return notImplemented('game.createWorld', content, params);
}

export interface CommandOutcome {
  state: GameState;
  newsIds: NewsId[];
  /** Instant answers (renewals, trials signings) or 'pending' for free-agent offers. */
  response: OfferResponse | null;
}

/** Validate and apply one command (player or AI, same rules). */
export function applyCommand(state: GameState, command: Command, content: ContentDB): Result<CommandOutcome, EngineError> {
  return notImplemented('game.applyCommand', state, command, content);
}

/** Why the player cannot press Continue yet (empty = can advance). */
export function getBlockers(state: GameState, content: ContentDB): Blocker[] {
  return notImplemented('game.getBlockers', state, content);
}

/** Process the current week for every club (one atomic commit), then autosave in the UI layer. */
export function advanceWeek(state: GameState, content: ContentDB): Result<{ state: GameState; report: WeekReport }, EngineError> {
  return notImplemented('game.advanceWeek', state, content);
}

/** Season-end pipeline from phase 'season-end' to next season week 1. */
export function runSeasonEnd(state: GameState, content: ContentDB): Result<{ state: GameState; report: SeasonEndReport }, EngineError> {
  return notImplemented('game.runSeasonEnd', state, content);
}

// ---- match preparation (exported for tests, replay and debugging) ------------------------------------

/** Build the sim input of a fixture from the locked lineups (effective stats, captaincy, chemistry, tactics). */
export function prepareMatchInput(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchInput, EngineError> {
  return notImplemented('game.prepareMatchInput', state, fixtureId, content);
}

// ---- read-only views for the UI --------------------------------------------------------------------------

/** Match report; the timeline is re-simulated at 'summary' level from the stored input when versions match. */
export function buildMatchReport(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchReport, EngineError> {
  return notImplemented('game.buildMatchReport', state, fixtureId, content);
}

/** A club's roster, sorted by lineup slot, then rating descending, then id. */
export function roster(state: GameState, clubId: ClubId): Fighter[] {
  return notImplemented('game.roster', state, clubId);
}

/** Everything the fighter profile and roster tables show. */
export interface FighterView {
  fighter: Fighter;
  stats: Record<StatId, number>;
  rating: number;
  potential: number;
  humanAge: number;
  captaincy: { cq: number; gradeId: string; letter: string };
  trend: string;
  injuryChanceBp: number;
  retirementChanceBp: number;
  marketWage: Gold;
  /** Ask from the viewing club for its preferred length (free agents and renewals). */
  askFromPlayer: Gold | null;
  available: boolean;
}

export function fighterView(state: GameState, fighterId: FighterId, content: ContentDB): FighterView {
  return notImplemented('game.fighterView', state, fighterId, content);
}

/** Free agents visible on the market screen, best market wage first. */
export function freeAgents(state: GameState): Fighter[] {
  return notImplemented('game.freeAgents', state);
}

/** The lineup the AI would pick for a club (player "auto-pick" button) as a ready command. */
export function suggestLineup(state: GameState, clubId: ClubId, content: ContentDB): Command {
  return notImplemented('game.suggestLineup', state, clubId, content);
}
