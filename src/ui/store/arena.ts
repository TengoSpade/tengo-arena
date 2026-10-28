/**
 * M2 store facade for the arena viewer (05-technical-m2 §A7; WP-M2E implements). Additive over the fixed
 * GameStore contract, like match-day.ts: screens read playback views and send commands through it, never
 * mutating GameState. Type-only imports from src/render keep this file (and the store chunk) free of render
 * code; the arena screens load the viewer with import('../../render/viewer').
 *
 * Contract stubs: reads return null (safeView) while core/game's playback functions are stubs; writes return
 * 'arena.unavailable' until WP-M2E wires them (store.advance options, autosave kinds).
 */
import type { ContentDB } from '../../core/content';
import type { CommandOutcome, MatchPlayback, ReplayAvailability, RoundPlayback } from '../../core/game';
import type { FightCall, FixtureId, GameState, MatchViewMode, WeekReport } from '../../core/model';
import type { RoundProbe } from '../../core/sim';
import type { EngineError, Result } from '../../core/util';
import type { AutoPauseRules, Speed } from '../../render';
import type { GameStore } from './contract';
import { safeView, type GameEngine } from './engine';

/** store.advance() result while the player's next round waits to be watched: the frame opens #/arena (like MATCH_PAUSED). */
export const MATCH_WATCHING = 'match.watching';

/** Play match default (owner answer to Q54, 2026-10-27: both offered, Watch primary; Streamlined pacing simulates). */
export type WatchPreference = 'ask' | 'watch' | 'simulate';

/** Per-device viewer settings (stored with the UI settings, outside saves, like pacing D-L). */
export interface ArenaSettings {
  watchPreference: WatchPreference;
  /** Remembered speed (T1: 1x/2x/4x); a new round starts at it. */
  speed: Speed;
  /** P-01 auto-pause triggers (defaults: render DEFAULT_AUTO_PAUSE, approved in Q58). */
  autoPause: AutoPauseRules;
  labels: 'off' | 'selected' | 'all';
  /** Pause a live round when the window is hidden (on by default). */
  pauseWhenHidden: boolean;
}

export interface ArenaFacade {
  // ---- reads (null while core is a stub or there is nothing to show) ----
  replayAvailability(state: GameState, fixtureId: FixtureId): ReplayAvailability | null;
  liveRound(state: GameState): Result<RoundPlayback, EngineError> | null;
  replayRound(state: GameState, fixtureId: FixtureId, round: number): Result<RoundPlayback, EngineError> | null;
  matchPlayback(state: GameState, fixtureId: FixtureId): Result<MatchPlayback, EngineError> | null;
  /** The pause inspector's "now" view (P-22). */
  inspect(state: GameState, fixtureId: FixtureId, round: number, tick: number): Result<RoundProbe, EngineError> | null;
  // ---- writes ----
  /**
   * Play match: store.advance({ playerMatch: mode }). MATCH_WATCHING (open #/arena) only after the lock's auto-round
   * write has succeeded; a failed write returns 'save.round-failed' and the viewer stays closed (review B3; the store
   * must not ignore that failure as it does for other autosaves).
   */
  playMatch(mode: MatchViewMode): Promise<Result<WeekReport, EngineError>>;
  /**
   * The watched round reached its end (or Skip to the end of the round): store.advance({ watched: { round, logHash } })
   * with the hash of the log the viewer showed; 'watch.mismatch' is a defect, reported, never retried silently.
   */
  finishRound(watched: { round: number; logHash: string }): Promise<Result<WeekReport, EngineError>>;
  /** 'match.watch' with the cursor, then the round autosave: only when playback stops (pause, auto-pause, round end, window hidden; tech-019). */
  saveCursor(state: GameState, tick: number): Promise<Result<CommandOutcome, EngineError>>;
  /** RESERVED for the calls package ('match.call'); refused until then. */
  call(state: GameState, call: FightCall): Result<CommandOutcome, EngineError>;
}

function unavailable<T>(): Result<T, EngineError> {
  return { ok: false, error: { code: 'arena.unavailable', message: 'The arena viewer arrives with M2' } };
}

export function arenaFacade(_store: GameStore, engine: GameEngine, content: () => ContentDB | null): ArenaFacade {
  const read = <T>(fn: ((c: ContentDB) => T) | null): T | null => {
    const c = content();
    return c && fn ? safeView(() => fn(c), null) : null;
  };
  return {
    replayAvailability: (state, fixtureId) => read(engine.replayAvailability ? (c) => engine.replayAvailability!(state, fixtureId, c) : null),
    liveRound: (state) => (state.liveMatch === null ? null : read(engine.liveRoundPlayback ? (c) => engine.liveRoundPlayback!(state, c) : null)),
    replayRound: (state, fixtureId, round) => read(engine.roundPlayback ? (c) => engine.roundPlayback!(state, fixtureId, round, c) : null),
    matchPlayback: (state, fixtureId) => read(engine.matchPlayback ? (c) => engine.matchPlayback!(state, fixtureId, c) : null),
    inspect: (state, fixtureId, round, tick) => read(engine.inspectPlayback ? (c) => engine.inspectPlayback!(state, fixtureId, round, tick, c) : null),
    playMatch: async (_mode) => unavailable(),
    finishRound: async (_watched) => unavailable(),
    saveCursor: async (_state, _tick) => unavailable(),
    call: (_state, _call) => unavailable(),
  };
}
