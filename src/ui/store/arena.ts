/**
 * M2 store facade for the arena viewer (05-technical-m2 §A7; WP-M2E implements). Additive over the fixed
 * GameStore contract, like match-day.ts: screens read playback views and send commands through it, never
 * mutating GameState. Type-only imports from src/render keep this file (and the store chunk) free of render
 * code; the arena screens load the viewer with import('../../render/viewer').
 *
 * Reads return null (safeView) while core/game's playback functions are stubs, so every screen degrades to "not
 * available yet". Writes go through the GameStore: store.advance carries the Watch or Simulate choice and the shown
 * log's hash (create-store.ts keeps the ordering rule: the viewer opens only after the lock's auto-round write
 * succeeded); the cursor is one command plus the round autosave, at stops only.
 */
import { useMemo } from 'preact/hooks';
import type { ContentDB } from '../../core/content';
import type { CommandOutcome, MatchPlayback, ReplayAvailability, RoundPlayback } from '../../core/game';
import type { FightCall, FixtureId, GameState, MatchViewMode, WeekReport } from '../../core/model';
import type { RoundProbe } from '../../core/sim';
import type { EngineError, Result } from '../../core/util';
import type { AutoPauseRules, Speed } from '../../render';
import { AUTOSAVE_ROUND_SLOT } from '../../platform/save-store';
import type { GameStore } from './contract';
import { safeView, useEngine, type GameEngine } from './engine';

/** store.advance() result while the player's next round waits to be watched: the frame opens #/arena (like MATCH_PAUSED). */
export const MATCH_WATCHING = 'match.watching';
/** core/game refusal when a watched round is committed without a shown log (Continue from Home, a stale tab): route to #/arena. */
export const WATCH_NOT_SHOWN = 'watch.not-shown';
/** core/game refusal when the committed log's hash differs from the shown one: a defect, reported, never retried silently. */
export const WATCH_MISMATCH = 'watch.mismatch';
/** store.advance() refusal when the lock's auto-round write failed: the viewer stays closed, the lock is undone in memory (Retry = Play match again). */
export const SAVE_ROUND_FAILED = 'save.round-failed';

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
  /** The right dock (feed and inspector) is open (default); D toggles it, per device. The layout never changes on its own (A18). */
  dockOpen: boolean;
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
  /** "Simulate the rest": 'match.watch' with mode 'simulate' at the current tick, then store.advance() without a hash (the round finishes headless from its locked inputs). */
  simulateRest(state: GameState, tick: number): Promise<Result<WeekReport, EngineError>>;
  /** RESERVED for the calls package ('match.call'); refused until then. */
  call(state: GameState, call: FightCall): Result<CommandOutcome, EngineError>;
}

function unavailable<T>(code: string, message: string): Result<T, EngineError> {
  return { ok: false, error: { code, message } };
}

/** The live watch of the player's match: the round waiting or being watched, or null. */
function watching(state: GameState): { fixtureId: FixtureId; round: number } | null {
  const ms = state.liveMatch;
  const w = ms?.watch;
  return ms && w && w.mode === 'watch' && w.round !== null ? { fixtureId: ms.fixtureId, round: w.round } : null;
}

export function arenaFacade(store: GameStore, engine: GameEngine, content: () => ContentDB | null): ArenaFacade {
  const read = <T>(fn: ((c: ContentDB) => T) | null): T | null => {
    const c = content();
    return c && fn ? safeView(() => fn(c), null) : null;
  };
  /** The round autosave: the store's own (it skips ticket reproductions), else a plain save to the round slot (test stores). */
  const saveRound = async (): Promise<Result<unknown, EngineError>> => {
    const app = store as Partial<{ saveRound(): Promise<Result<unknown, { code: string; message: string }>> }>;
    const r = app.saveRound ? await app.saveRound() : await store.save(AUTOSAVE_ROUND_SLOT);
    return r.ok ? r : { ok: false, error: { code: r.error.code, message: r.error.message } };
  };
  const dispatchWatch = (state: GameState, tick: number, mode?: MatchViewMode): Result<CommandOutcome, EngineError> => {
    const clubId = store.playerClubId.value;
    const ms = state.liveMatch;
    const w = watching(state);
    if (!clubId || !ms) return unavailable('match.not-watching', 'No round is being watched');
    // A cursor is only accepted while a round waits; a mode switch ("Simulate the rest") also between rounds, naming
    // the next round (rounds played + 1; WP-M2B).
    const betweenRounds = !w && mode === 'simulate' && ms.watch?.mode === 'watch';
    if (!w && !betweenRounds) return unavailable('match.not-watching', 'No round is being watched');
    return store.dispatch({ type: 'match.watch', clubId, fixtureId: ms.fixtureId, round: w ? w.round : ms.rounds.length + 1, tick: Math.max(0, Math.ceil(tick)), ...(mode ? { mode } : {}) });
  };
  return {
    replayAvailability: (state, fixtureId) => read(engine.replayAvailability ? (c) => engine.replayAvailability!(state, fixtureId, c) : null),
    liveRound: (state) => (state.liveMatch === null ? null : read(engine.liveRoundPlayback ? (c) => engine.liveRoundPlayback!(state, c) : null)),
    replayRound: (state, fixtureId, round) => read(engine.roundPlayback ? (c) => engine.roundPlayback!(state, fixtureId, round, c) : null),
    matchPlayback: (state, fixtureId) => read(engine.matchPlayback ? (c) => engine.matchPlayback!(state, fixtureId, c) : null),
    inspect: (state, fixtureId, round, tick) => read(engine.inspectPlayback ? (c) => engine.inspectPlayback!(state, fixtureId, round, tick, c) : null),
    playMatch: (mode) => store.advance({ playerMatch: mode }),
    finishRound: (watched) => store.advance({ watched }),
    async saveCursor(state, tick) {
      const r = dispatchWatch(state, tick);
      if (!r.ok) return r;
      const saved = await saveRound();
      return saved.ok ? r : saved;
    },
    async simulateRest(state, tick) {
      // The mode is fixed first (the current round finishes headless from its locked inputs); then the M1.1 flow.
      const r = dispatchWatch(state, tick, 'simulate');
      if (!r.ok) return r;
      return store.advance();
    },
    call(state, call) {
      const w = watching(state);
      const clubId = store.playerClubId.value;
      if (!w || !clubId) return unavailable('match.not-watching', 'No round is being watched');
      return store.dispatch({ type: 'match.call', clubId, fixtureId: w.fixtureId, round: w.round, call });
    },
  };
}

/** The facade over the app's store and engine (the arena screens, Home, Fixtures, the report). */
export function useArena(store: GameStore): ArenaFacade {
  const engine = useEngine();
  return useMemo(() => arenaFacade(store, engine, () => store.content.value), [store, engine]);
}
