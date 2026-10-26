/**
 * core/game — the season engine and the only entry points that change
 * GameState (03-league-economy sys-calendar order; 02 §3). Owner: WP5.
 *
 * Transitions are pure: (state, content) -> new state on a draft from
 * core/model beginTransition (mutable parts copied, write-once results,
 * history and alumni shared); on error they return err(...) and leave the
 * input untouched. Weekly order: leagues.json calendar.weekProcessingOrder;
 * season end: calendar.seasonEndOrder. Match seed = deriveSeed(root, STREAM.match,
 * season, fixtureId); simulation in fixturesForWeek order.
 *
 * The functions below run on the real modules. createGameEngine(ports) gives
 * the same API over other implementations (stand-ins, spies).
 */
import type { ContentDB } from '../content';
import type {
  Blocker,
  ClubId,
  Command,
  Fighter,
  FighterId,
  FixtureId,
  GameState,
  MatchInput,
  MatchReport,
  SeasonEndReport,
  WeekReport,
} from '../model';
import type { EngineError, Result } from '../util';
import { createGameEngine, type CommandOutcome } from './engine';
import { realGamePorts } from './ports';
import type { CaptaincyPreview, FighterView, ReleasePreview } from './views';
import type { AdvanceOutcome, LevelUpView } from './live';
import type { BetweenRoundView } from './orchestrator';
import type { NewGameParams } from './world';

export { createGameEngine } from './engine';
export type { CommandOutcome, GameEngine } from './engine';
export type { CaptaincyPick, CaptaincyPreview, FighterView, ReleasePreview } from './views';
export type { DetailedMatchReport, FighterRuleDetail } from './match';
export type { NewGameParams } from './world';
export type { AiRejection, PhaseLog } from './week';
export { realGamePorts, aiPortsOf } from './ports';
export type { GamePorts } from './ports';
export { createStandInPorts } from './stand-ins';
export { GAME_NEWS_KEYS } from './shared';

const engine = createGameEngine(realGamePorts);

// ---- transitions -----------------------------------------------------------------------------------

/** New game: 48 clubs from clubs.json, generated rosters and free agents, finances, season-1 schedule. playerClubId = null. */
export function createWorld(content: ContentDB, params: NewGameParams): Result<GameState, EngineError> {
  return engine.createWorld(content, params);
}

/** Validate and apply one command (player or AI, same rules). */
export function applyCommand(state: GameState, command: Command, content: ContentDB): Result<CommandOutcome, EngineError> {
  return engine.applyCommand(state, command, content);
}

/** Why the player cannot press Continue yet (empty = can advance). */
export function getBlockers(state: GameState, content: ContentDB): Blocker[] {
  return engine.getBlockers(state, content);
}

/**
 * Process the current week for every club (one atomic commit), then autosave
 * in the UI layer. With playerClubId null (headless soak) every club is AI-managed.
 */
export function advanceWeek(state: GameState, content: ContentDB): Result<{ state: GameState; report: WeekReport }, EngineError> {
  return engine.advanceWeek(state, content);
}

/** Season-end pipeline from phase 'season-end' to next season week 1. */
export function runSeasonEnd(state: GameState, content: ContentDB): Result<{ state: GameState; report: SeasonEndReport }, EngineError> {
  return engine.runSeasonEnd(state, content);
}

// ---- match preparation (exported for tests, replay and debugging) ------------------------------------

/** Build the sim input of a fixture from the locked lineups (effective stats, captaincy, chemistry, tactics). */
export function prepareMatchInput(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchInput, EngineError> {
  return engine.prepareMatchInput(state, fixtureId, content);
}

// ---- read-only views for the UI --------------------------------------------------------------------------

/** Match report; the timeline is re-simulated at 'summary' level from the stored input when versions match. */
export function buildMatchReport(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchReport, EngineError> {
  return engine.buildMatchReport(state, fixtureId, content);
}

/**
 * A club's roster, sorted by lineup slot, then rating descending, then id.
 * `content` (additive, optional) enables the rating order; without it ties sort by id.
 */
export function roster(state: GameState, clubId: ClubId, content?: ContentDB): Fighter[] {
  return engine.roster(state, clubId, content);
}

export function fighterView(state: GameState, fighterId: FighterId, content: ContentDB): FighterView {
  return engine.fighterView(state, fighterId, content);
}

/** Free agents visible on the market screen, best market wage first (`content`, additive and optional, enables that order). */
export function freeAgents(state: GameState, content?: ContentDB): Fighter[] {
  return engine.freeAgents(state, content);
}

/** The lineup the AI would pick for a club (player "auto-pick" button) as a ready command. */
export function suggestLineup(state: GameState, clubId: ClubId, content: ContentDB): Command {
  return engine.suggestLineup(state, clubId, content);
}

/** Release preview for the confirmation dialog: payout, balance after, cap relief (WP6 request b). */
export function releasePreview(state: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): ReleasePreview | null {
  return engine.releasePreview(state, clubId, fighterId, content);
}

/** Captaincy-change preview: proposed captain and vice CQ, Snubbed / Passed Over at the next lock, chemistry before and after. */
export function captaincyPreview(
  state: GameState,
  clubId: ClubId,
  captainId: FighterId | null,
  viceCaptainId: FighterId | null,
  content: ContentDB,
): CaptaincyPreview | null {
  return engine.captaincyPreview(state, clubId, captainId, viceCaptainId, content);
}

export { developmentSummary } from './views';

// ---- M1.1 contract (WP-C; docs/design/05 M1.1 addendum) -------------------------------------------

export { applyBetweenRound, autoSwapDecisions, betweenRounds, checkSwaps, finishMatch, playMatchAuto, playRound, roundInputOf, startMatch } from './orchestrator';
export type { BetweenRoundSideView, BetweenRoundView, LockedSquads, MatchSide, SwapCheck } from './orchestrator';
export type { AdvanceOutcome, LevelUpOptionView, LevelUpView } from './live';
export type { LiveWeekOutcome } from './week';

/**
 * Continue (M1.1): with no live match, process the week; the player's match is played round by round and
 * pauses at a between-round step per Club.pauseBetweenRounds (state.liveMatch set, `pause` the screen).
 * With a live match, play on from the pending step (the player's match.swap decisions, else the
 * auto-swap suggestions). `week` is the report once the whole week has run. advanceWeek never pauses.
 */
export function advance(state: GameState, content: ContentDB): Result<AdvanceOutcome, EngineError> {
  return engine.advance(state, content);
}

/** The between-round screen of the player's live match, or null when no match is waiting. */
export function betweenRoundView(state: GameState, content: ContentDB): BetweenRoundView | null {
  return engine.betweenRoundView(state, content);
}

/** The level-up dialog of one fighter: his pending offers (oldest first), stat and rating after each stat pick, the auto-pick. Null when none is pending. */
export function levelUpView(state: GameState, fighterId: FighterId, content: ContentDB): LevelUpView | null {
  return engine.levelUpView(state, fighterId, content);
}
