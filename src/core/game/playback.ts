/**
 * M2 contract (docs/design/_drafts/05-technical-m2.md §A3, tech-015; WP-M2B implements): fight logs for the
 * arena viewer. Pure reads. Every log is produced by the same sim call headless play uses
 * (`simulateRound`, at record 'full'), from stored inputs (a replay) or from the live match (the round the
 * player is watching), so what the player sees is the headless result (vis-009). Nothing here changes
 * GameState; the watch cursor and calls change it only through commands ('match.watch', 'match.call').
 *
 * Stubs throw NotImplementedError until WP-M2B lands; the UI reads them through safeView.
 */
import type { ContentDB } from '../content';
import type { RoundProbe } from '../sim';
import type { BetweenRoundRecord, ClubId, FightLog, FixtureId, GameState, MatchViewMode, RoundCalls, RoundLineups, RoundResult } from '../model';
import { notImplemented, type EngineError, type Result } from '../util';
import type { GamePorts } from './ports';

/** Options of `advance` (Continue / Play match). */
export interface AdvanceOptions {
  /**
   * How the player's match is played when this advance starts it (fixed with the squad lock, kept in
   * liveMatch.watch.mode). Default 'simulate': the M1.1 flow. Ignored when no player match starts.
   */
  playerMatch?: MatchViewMode;
  /**
   * Committing a watched round (review B2): the hash of the log the viewer showed (RoundPlayback.log.hash). In every
   * build, `advance` plays the round from prepareRound at 'full' and refuses with 'watch.mismatch' (no state)
   * unless its log hash equals this; the hash is compared, never stored.
   *
   * Required exactly while liveMatch.watch.mode is 'watch' and watch.round is set. Who supplies it (05-technical-m2
   * §A3): the viewer at the round's end and on "Skip to end of round" (the loaded log, also after a resume, which
   * re-simulates and loads it first; skipping is disabled until it has loaded). Every other path has no shown log
   * and is refused with 'watch.not-shown' (details: fixtureId, round), which the UI routes to #/arena: Continue
   * from Home or any other screen, a test harness, a stale tab. "Simulate the rest" first sends
   * `match.watch { mode: 'simulate' }`; from then on `watched` is not required and the current round is
   * committed from prepareRound like a simulated one (its outcome was fixed at the lock).
   */
  watched?: { round: number; logHash: string };
}

/*
 * Commit point of a watched round (owner answer to Q60, 2026-10-27, option A): its lineups, presets and seed are
 * locked and autosaved before it is shown, so its outcome is fixed and cannot be rerolled; the round is committed
 * when its playback ends (advance with AdvanceOptions.watched), and nothing of its result is in GameState before.
 */

/**
 * `AdvanceOutcome.watch`: the player's next round waits to be watched (state.liveMatch in phase
 * 'round_pending' with watch.round set). The UI opens the arena viewer on `liveRoundPlayback`.
 */
export interface WatchPause {
  fixtureId: FixtureId;
  round: number;
  /** Resume point (0 for a round not started yet). */
  cursorTick: number;
}

/**
 * Why a match cannot be played back (05-technical-m2 §A4): no result yet; the result was compacted (a match
 * between other clubs older than `leagues.json matchRecords.compactAiMatchesAfterWeeks`, O24) or dropped with
 * its season; another build played it (engine version differs, or the sim content: MatchResult.simHash against
 * core/sim simContentHash, falling back to contentHash for results without it; owner answer to Q56); it is the
 * player's match in progress (watch it live instead).
 */
export type ReplayUnavailableReason = 'not-played' | 'compacted' | 'other-build' | 'live';

export type ReplayAvailability = { available: true; rounds: number } | { available: false; reason: ReplayUnavailableReason };

/** One round ready for the viewer. */
export interface RoundPlayback {
  fixtureId: FixtureId;
  round: number;
  /** 'live': the round the player is watching (seeking stops at the live head); 'replay': a committed round. */
  kind: 'live' | 'replay';
  /** The full-level log (FIGHT_LOG_FORMAT_VERSION of this build). */
  log: FightLog;
  /** Live: the persisted cursor (resume there, paused). Replay: 0. */
  startTick: number;
  /** Rounds won before this round. */
  scoreBefore: { home: number; away: number };
  /** Who fought this round (rows, Freshness, entered flags); null only for whole-match M1 records. */
  lineups: RoundLineups | null;
  /** The call plans the log was simulated with (null = none). */
  calls: RoundCalls | null;
  /**
   * Replay: the committed round. Live: always null, so no screen can show an outcome before it is watched
   * (the log's own `fight.end` is consumed by the viewer only when playback reaches it).
   */
  result: RoundResult | null;
}

/** A match's playable rounds (the replay screen's round tabs, the live match's earlier rounds). */
export interface MatchPlayback {
  fixtureId: FixtureId;
  bestOf: number;
  homeClubId: ClubId;
  awayClubId: ClubId;
  /** The player's side, or null for a match between other clubs. */
  playerSide: 'home' | 'away' | null;
  kind: 'live' | 'replay';
  /** Committed rounds (winner and duration), then, live, the round being watched (winner and duration null). */
  rounds: { round: number; winner: 'home' | 'away' | null; durationTicks: number | null }[];
  /** Swap lines between rounds (the viewer's round transitions). */
  betweenRounds: BetweenRoundRecord[];
}

/**
 * The round the player is watching: orchestrator prepareRound (the one builder playRound also uses) plus
 * liveMatch.watch.calls, simulated at 'full'. Errors: 'match.not-live' (no live match), 'match.not-watching' (the
 * match is simulated, or it waits between rounds).
 */
export function liveRoundPlaybackWith(ports: GamePorts, state: GameState, content: ContentDB): Result<RoundPlayback, EngineError> {
  return notImplemented('game.liveRoundPlayback', ports, state, content);
}

/**
 * A committed round re-simulated at 'full' (roundInputOf: no policy runs), from state.results or from the
 * live match's earlier rounds. Errors: 'replay.unavailable' (details.reason: ReplayUnavailableReason),
 * 'replay.no-round', 'replay.mismatch' (the checksum did not reproduce: a defect, reported, never shown as a
 * replay).
 */
export function roundPlaybackWith(ports: GamePorts, state: GameState, fixtureId: FixtureId, round: number, content: ContentDB): Result<RoundPlayback, EngineError> {
  return notImplemented('game.roundPlayback', ports, state, fixtureId, round, content);
}

/** The match's playable rounds, without simulating anything. Errors as roundPlayback. */
export function matchPlaybackWith(ports: GamePorts, state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchPlayback, EngineError> {
  return notImplemented('game.matchPlayback', ports, state, fixtureId, content);
}

/**
 * Cheap check for the Replay buttons (no simulation). One rule for replays and the report timeline: WP-M2B makes
 * buildMatchReport use it too (engine version, then simHash or, for older results, contentHash; not compacted).
 */
export function replayAvailabilityWith(ports: GamePorts, state: GameState, fixtureId: FixtureId, content: ContentDB): ReplayAvailability {
  return notImplemented('game.replayAvailability', ports, state, fixtureId, content);
}

/**
 * The pause inspector's "now" view (P-22, tech-022): the round's input (live or replay, with its calls) handed
 * to sim inspectRoundAt at `tick`. Same errors as the playback functions; 'inspect.tick' when the tick is past
 * the round's end or, live, past liveMatch.watch.cursorTick (the inspector opens while paused, and the pause has
 * persisted the cursor first; no peeking ahead).
 */
export function inspectPlaybackWith(ports: GamePorts, state: GameState, fixtureId: FixtureId, round: number, tick: number, content: ContentDB): Result<RoundProbe, EngineError> {
  return notImplemented('game.inspectPlayback', ports, state, fixtureId, round, tick, content);
}
