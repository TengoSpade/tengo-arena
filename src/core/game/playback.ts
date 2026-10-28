/**
 * M2 contract (docs/design/_drafts/05-technical-m2.md §A3, tech-015; WP-M2B implements): fight logs for the
 * arena viewer. Pure reads. Every log is produced by the same sim call headless play uses
 * (`simulateRound`, at record 'full'), from stored inputs (a replay) or from the live match (the round the
 * player is watching), so what the player sees is the headless result (vis-009). Nothing here changes
 * GameState; the watch cursor and calls change it only through commands ('match.watch', 'match.call').
 *
 * Implemented by WP-M2B. `inspectPlayback` throws NotImplementedError while core/sim's probe is a stub (WP-M2A);
 * the UI reads every view through safeView.
 */
import type { ContentDB } from '../content';
import type { RoundProbe } from '../sim';
import type { BetweenRoundRecord, ClubId, FightLog, FixtureId, GameState, MatchState, MatchViewMode, RoundCalls, RoundInput, RoundLineups, RoundResult } from '../model';
import type { Seed } from '../rng';
import { InvariantError, NotImplementedError, engineError, err, getOwn, notImplemented, ok, type EngineError, type Result } from '../util';
import { prepareRound, roundInputOf } from './orchestrator';
import type { GamePorts } from './ports';
import { liveRoundInputOf, replayBlocker } from './rounds';

export { replayBlocker } from './rounds';

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
   *
   * As built (WP-M2B): 'watch.mismatch' carries details.reason 'log' (the hash is not the round's log) or 'round'
   * (`watched` names another round, or no watched round is waiting: a repeated or stale commit never plays on or
   * starts a week). `advanceWeek` on a watched match is refused with 'watch.not-shown' (it cannot stop at a round).
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
 * 'round_pending' with watch.round set). The UI opens the arena viewer on `liveRoundPlayback`. Before any playback
 * the UI must autosave this state (the `auto-round` slot), which holds the locked round: the viewer opens only after
 * that write succeeded (owner answer to Q60, option A; review B3).
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

/** The season a fixture id names (core/model leagueFixtureId / reckoningFixtureId: "lg:<season>:…", "rk:<season>:…"), or null. */
function seasonOfFixtureId(fixtureId: FixtureId): number | null {
  const m = /^(?:lg|rk):(\d+):/.exec(fixtureId);
  return m ? Number(m[1]) : null;
}

/** No result: not played yet, or dropped with its season (results are kept for the current and previous season, 05 §5). */
function missingReason(state: GameState, fixtureId: FixtureId): ReplayUnavailableReason {
  if (getOwn(state.fixtures, fixtureId)) return 'not-played';
  const season = seasonOfFixtureId(fixtureId);
  return season !== null && season < state.calendar.season - 1 ? 'compacted' : 'not-played';
}

function unavailable(reason: ReplayUnavailableReason, fixtureId: FixtureId): EngineError {
  const text: Record<ReplayUnavailableReason, string> = {
    'not-played': 'That match has not been played',
    compacted: 'That match is not kept in full any more',
    'other-build': 'That match was played by another build of the fight',
    live: 'That match is in progress: watch it live',
  };
  return engineError('replay.unavailable', text[reason], { fixtureId, reason });
}

/** Rounds won by each side before `round` (1-based). */
function scoreBefore(rounds: readonly RoundResult[], round: number): { home: number; away: number } {
  const score = { home: 0, away: 0 };
  for (const r of rounds) if (r.round < round) score[r.winner]++;
  return score;
}

/** Contain a module failure as 'engine.failure' (a stub's NotImplementedError still propagates to safeView). */
function guardedRead<T>(what: string, run: () => Result<T, EngineError>): Result<T, EngineError> {
  try {
    return run();
  } catch (e) {
    if (e instanceof NotImplementedError) throw e;
    return err(engineError('engine.failure', `${what} failed: ${e instanceof Error ? e.message : String(e)}`));
  }
}

/** The player's live match watched round, or why there is none. */
function watchedRound(state: GameState): Result<{ ms: MatchState; round: number }, EngineError> {
  const ms = state.liveMatch;
  if (ms === null) return err(engineError('match.not-live', 'No match is in progress'));
  const w = ms.watch;
  if (!w || w.mode !== 'watch' || w.round === null || ms.phase !== 'round_pending') {
    return err(engineError('match.not-watching', 'No round of the match in progress is waiting to be watched', { fixtureId: ms.fixtureId }));
  }
  return ok({ ms, round: w.round });
}

/**
 * The round the player is watching: orchestrator prepareRound (the one builder playRound also uses; it carries
 * liveMatch.watch.calls) simulated at 'full' with the round seed, the exact call the commit replays (playRound with
 * the shown log's hash). `result` is null and the outcome is nowhere else in the playback: the viewer meets the log's
 * `fight.end` only when playback reaches it. Errors: 'match.not-live' (no live match), 'match.not-watching' (the
 * match is simulated, or it waits between rounds).
 */
export function liveRoundPlaybackWith(ports: GamePorts, state: GameState, content: ContentDB): Result<RoundPlayback, EngineError> {
  return guardedRead<RoundPlayback>('liveRoundPlayback', () => {
    const w = watchedRound(state);
    if (!w.ok) return w;
    const { ms, round } = w.value;
    const p = prepareRound(ports, state, ms, content);
    if (p.round !== round) throw new InvariantError(`liveRoundPlayback: watching round ${round}, pending round ${p.round}`);
    const out = ports.sim.simulateRound(p.input, p.seed, content, { record: 'full' });
    if (!out.log) throw new InvariantError('liveRoundPlayback: the sim returned no log at record full');
    return ok({
      fixtureId: ms.fixtureId,
      round,
      kind: 'live',
      log: out.log,
      startTick: ms.watch!.cursorTick,
      scoreBefore: { ...ms.score },
      lineups: p.lineups,
      calls: p.input.calls ?? null,
      result: null,
    });
  });
}

/** A committed round's exact input and record: from the live match (its earlier rounds) or from a stored result. */
interface CommittedRound {
  input: RoundInput;
  seed: Seed;
  result: RoundResult;
  lineups: RoundLineups | null;
  scoreBefore: { home: number; away: number };
}

function committedRound(ports: GamePorts, state: GameState, fixtureId: FixtureId, round: number, content: ContentDB): Result<CommittedRound, EngineError> {
  const ms = state.liveMatch;
  if (ms !== null && ms.fixtureId === fixtureId) {
    const result = ms.rounds.find((r) => r.round === round);
    if (!result) return err(engineError('replay.no-round', `Round ${round} of the match in progress has not been played`, { fixtureId, round, played: ms.rounds.length }));
    const lineups = ms.roundLineups.find((r) => r.round === round) ?? null;
    return ok({ input: liveRoundInputOf(ms, round), seed: result.seed, result, lineups, scoreBefore: scoreBefore(ms.rounds, round) });
  }
  const result = getOwn(state.results, fixtureId);
  if (!result) return err(unavailable(missingReason(state, fixtureId), fixtureId));
  const blocked = replayBlocker(ports, result, content);
  if (blocked) return err(unavailable(blocked, fixtureId));
  const r = result.rounds.find((x) => x.round === round);
  if (!r) return err(engineError('replay.no-round', `The match has no round ${round}`, { fixtureId, round, played: result.rounds.length }));
  const lineups = result.roundLineups?.find((x) => x.round === round) ?? null;
  return ok({ input: roundInputOf(result, round), seed: r.seed, result: r, lineups, scoreBefore: scoreBefore(result.rounds, round) });
}

/**
 * A committed round re-simulated at 'full' (roundInputOf: no policy runs), from state.results or from the
 * live match's earlier rounds. Errors: 'replay.unavailable' (details.reason: ReplayUnavailableReason),
 * 'replay.no-round', 'replay.mismatch' (the checksum did not reproduce: a defect, reported, never shown as a
 * replay).
 */
export function roundPlaybackWith(ports: GamePorts, state: GameState, fixtureId: FixtureId, round: number, content: ContentDB): Result<RoundPlayback, EngineError> {
  return guardedRead<RoundPlayback>('roundPlayback', () => {
    const c = committedRound(ports, state, fixtureId, round, content);
    if (!c.ok) return c;
    const { input, seed, result, lineups } = c.value;
    const out = ports.sim.simulateRound(input, seed, content, { record: 'full' });
    if (!out.log) throw new InvariantError('roundPlayback: the sim returned no log at record full');
    if (out.result.checksum !== result.checksum) {
      return err(engineError('replay.mismatch', `Round ${round} of ${fixtureId} did not reproduce (a defect)`, { fixtureId, round, stored: result.checksum, replayed: out.result.checksum }));
    }
    return ok({ fixtureId, round, kind: 'replay', log: out.log, startTick: 0, scoreBefore: c.value.scoreBefore, lineups, calls: input.calls ?? null, result });
  });
}

/**
 * The match's playable rounds, without simulating anything: the live match's committed rounds and the round being
 * watched (winner and duration null), or a stored result's rounds. Errors as roundPlayback ('replay.unavailable').
 */
export function matchPlaybackWith(ports: GamePorts, state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchPlayback, EngineError> {
  return guardedRead<MatchPlayback>('matchPlayback', () => {
    const ms = state.liveMatch;
    const sideOf = (home: ClubId, away: ClubId): 'home' | 'away' | null => (state.playerClubId === null ? null : state.playerClubId === home ? 'home' : state.playerClubId === away ? 'away' : null);
    if (ms !== null && ms.fixtureId === fixtureId) {
      const rounds: MatchPlayback['rounds'] = ms.rounds.map((r) => ({ round: r.round, winner: r.winner, durationTicks: r.durationTicks }));
      if (ms.watch?.mode === 'watch' && ms.watch.round !== null) rounds.push({ round: ms.watch.round, winner: null, durationTicks: null });
      return ok({
        fixtureId,
        bestOf: ms.bestOf,
        homeClubId: ms.home.clubId,
        awayClubId: ms.away.clubId,
        playerSide: sideOf(ms.home.clubId, ms.away.clubId),
        kind: 'live',
        rounds,
        betweenRounds: [...ms.betweenRounds],
      });
    }
    const result = getOwn(state.results, fixtureId);
    if (!result) return err(unavailable(missingReason(state, fixtureId), fixtureId));
    const blocked = replayBlocker(ports, result, content);
    if (blocked) return err(unavailable(blocked, fixtureId));
    return ok({
      fixtureId,
      bestOf: result.input.bestOf,
      homeClubId: result.homeClubId,
      awayClubId: result.awayClubId,
      playerSide: sideOf(result.homeClubId, result.awayClubId),
      kind: 'replay',
      rounds: result.rounds.map((r) => ({ round: r.round, winner: r.winner, durationTicks: r.durationTicks })),
      betweenRounds: [...(result.betweenRounds ?? [])],
    });
  });
}

/**
 * Cheap check for the Replay buttons (no simulation). One rule for replays and the report timeline (replayBlocker,
 * which buildMatchReport uses too): 'live' for the player's match in progress (its earlier rounds replay through
 * roundPlayback), 'not-played', 'compacted' (O24, or dropped with its season), 'other-build'.
 */
export function replayAvailabilityWith(ports: GamePorts, state: GameState, fixtureId: FixtureId, content: ContentDB): ReplayAvailability {
  if (state.liveMatch !== null && state.liveMatch.fixtureId === fixtureId) return { available: false, reason: 'live' };
  const result = getOwn(state.results, fixtureId);
  if (!result) return { available: false, reason: missingReason(state, fixtureId) };
  const blocked = replayBlocker(ports, result, content);
  return blocked ? { available: false, reason: blocked } : { available: true, rounds: result.rounds.length };
}

/**
 * The pause inspector's "now" view (P-22, tech-022): the round's input (live or replay, with its calls) handed
 * to sim inspectRoundAt at `tick`. Same errors as the playback functions; 'inspect.tick' when the tick is past
 * the round's end or, live, past liveMatch.watch.cursorTick (the inspector opens while paused, and the pause has
 * persisted the cursor first; no peeking ahead). Throws NotImplementedError while core/sim's probe is a stub (the UI
 * reads it through safeView).
 */
export function inspectPlaybackWith(ports: GamePorts, state: GameState, fixtureId: FixtureId, round: number, tick: number, content: ContentDB): Result<RoundProbe, EngineError> {
  return guardedRead<RoundProbe>('inspectPlayback', () => {
    if (!Number.isSafeInteger(tick) || tick < 0) return err(engineError('inspect.tick', `Not a fight tick: ${String(tick)}`, { tick }));
    let input: RoundInput;
    let seed: Seed;
    const ms = state.liveMatch;
    if (ms !== null && ms.fixtureId === fixtureId && ms.watch?.mode === 'watch' && ms.watch.round === round && ms.phase === 'round_pending') {
      if (tick > ms.watch.cursorTick) return err(engineError('inspect.tick', `Tick ${tick} is past what has been shown (${ms.watch.cursorTick})`, { tick, cursorTick: ms.watch.cursorTick }));
      const p = prepareRound(ports, state, ms, content);
      input = p.input;
      seed = p.seed;
    } else {
      const c = committedRound(ports, state, fixtureId, round, content);
      if (!c.ok) return c;
      if (tick > c.value.result.durationTicks) return err(engineError('inspect.tick', `Tick ${tick} is past the round's end (${c.value.result.durationTicks})`, { tick, endTick: c.value.result.durationTicks }));
      input = c.value.input;
      seed = c.value.seed;
    }
    const probe = ports.sim.inspectRoundAt;
    if (!probe) return notImplemented('sim.inspectRoundAt', input, seed, content, tick);
    return ok(probe(input, seed, content, tick));
  });
}
