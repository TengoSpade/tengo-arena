/**
 * M1.1 store facade for the new flows (WP-D; docs/design/05 M1.1 addendum
 * §WP-D): level-up offers, auto-pick policy, the 5 + 2 match squad, the
 * between-round screen, auto-swap rules and pacing. Additive: it composes
 * commands and reads views over the fixed GameStore contract, so screens
 * never mutate GameState and the fake stores keep working.
 *
 * Continue on the between-round screen is store.advance(): WP-D switches the
 * store from engine.advanceWeek to engine.advance (core/game AdvanceOutcome)
 * when WP-C lands the live-match path.
 */
import { useMemo } from 'preact/hooks';
import type { ContentDB } from '../../core/content';
import type { CommandOutcome } from '../../core/game';
import type { BetweenRoundView, LevelUpView } from '../../core/game';
import type {
  AutoSwapRules,
  ClubId,
  FighterId,
  FreshnessLabel,
  GameState,
  LevelUpModeSetting,
  LevelUpPacing,
  LineupEntry,
  PauseBetweenRounds,
  SwapDecision,
} from '../../core/model';
import type { EngineError, Result } from '../../core/util';
import type { GameStore } from './contract';
import { safeView, useEngine, type GameEngine } from './engine';

export interface PendingLevelUps {
  fighterId: FighterId;
  /** Levels waiting for a choice, oldest first. */
  levels: number[];
}

export interface MatchDayFacade {
  // ---- reads ----
  /** Player-club fighters with pending level-ups (fighter id order). */
  pendingLevelUps(state: GameState): PendingLevelUps[];
  /** The level-up dialog data (null without a pending level-up, or while core's view is a stub). */
  levelUpView(state: GameState, fighterId: FighterId): LevelUpView | null;
  /** The player's match waiting between rounds (null when none, or while core's view is a stub). */
  betweenRoundView(state: GameState): BetweenRoundView | null;
  /** Freshness 0-100 and its label (null for an unknown fighter). */
  freshness(state: GameState, fighterId: FighterId): { value: number; label: FreshnessLabel } | null;
  // ---- writes (each one command; core validates) ----
  chooseLevelUp(fighterId: FighterId, level: number, optionIndex: number | null, traitIndex: number | null): Result<CommandOutcome, EngineError>;
  /** Resolve one pending level-up with the policy's pick ("Auto-pick" in the dialog). */
  autoPickLevelUp(state: GameState, fighterId: FighterId, level: number): Result<CommandOutcome, EngineError>;
  setLevelUpPolicy(fighterId: FighterId | null, mode: LevelUpModeSetting): Result<CommandOutcome, EngineError>;
  setSquad(fighters: LineupEntry[], reserves: FighterId[], matchCaptainId: FighterId | null): Result<CommandOutcome, EngineError>;
  /** The player's swaps for the pending between-round step ([] = none; omit the call to accept the suggestions). */
  swapBetweenRounds(state: GameState, swaps: SwapDecision[]): Result<CommandOutcome, EngineError>;
  setAutoSwap(rules: AutoSwapRules): Result<CommandOutcome, EngineError>;
  setPacing(levelUpPacing: LevelUpPacing, pauseBetweenRounds: PauseBetweenRounds): Result<CommandOutcome, EngineError>;
}

function noPlayerClub(): Result<CommandOutcome, EngineError> {
  return { ok: false, error: { code: 'club.none', message: 'Choose a club first' } };
}

export function matchDayFacade(store: GameStore, engine: GameEngine, content: () => ContentDB | null): MatchDayFacade {
  const club = (): ClubId | null => store.playerClubId.value;
  const withClub = (run: (clubId: ClubId) => Result<CommandOutcome, EngineError>): Result<CommandOutcome, EngineError> => {
    const id = club();
    return id === null ? noPlayerClub() : run(id);
  };
  return {
    pendingLevelUps(state) {
      const id = state.playerClubId;
      if (id === null) return [];
      return Object.values(state.fighters)
        .filter((f) => f.clubId === id && f.status === 'active' && f.pendingLevelUps.length > 0)
        .map((f) => ({ fighterId: f.id, levels: f.pendingLevelUps.map((p) => p.level) }))
        .sort((a, b) => (a.fighterId < b.fighterId ? -1 : a.fighterId > b.fighterId ? 1 : 0));
    },
    levelUpView(state, fighterId) {
      const c = content();
      if (!c || !engine.levelUpView) return null;
      return safeView(() => engine.levelUpView!(state, fighterId, c), null);
    },
    betweenRoundView(state) {
      const c = content();
      if (!c || !engine.betweenRoundView || state.liveMatch === null) return null;
      return safeView(() => engine.betweenRoundView!(state, c), null);
    },
    freshness(state, fighterId) {
      const f = state.fighters[fighterId];
      const c = content();
      if (!f || !c || !engine.freshnessOf || !engine.freshnessLabel) return null;
      const value = engine.freshnessOf(f);
      return { value, label: engine.freshnessLabel(value, c) };
    },
    chooseLevelUp: (fighterId, level, optionIndex, traitIndex) =>
      withClub((clubId) => store.dispatch({ type: 'levelup.choose', clubId, fighterId, level, optionIndex, traitIndex })),
    autoPickLevelUp(state, fighterId, level) {
      const view = this.levelUpView(state, fighterId);
      const pick = view?.pending.find((p) => p.level === level)?.autoPick;
      if (!pick) return { ok: false, error: { code: 'levelup.auto-unavailable', message: 'The auto-pick is not available yet' } };
      return this.chooseLevelUp(fighterId, level, pick.optionIndex, pick.traitIndex);
    },
    setLevelUpPolicy: (fighterId, mode) => withClub((clubId) => store.dispatch({ type: 'levelup.policy', clubId, fighterId, mode })),
    setSquad: (fighters, reserves, matchCaptainId) => withClub((clubId) => store.dispatch({ type: 'squad.set', clubId, fighters, reserves, matchCaptainId })),
    swapBetweenRounds(state, swaps) {
      const ms = state.liveMatch;
      if (ms === null) return { ok: false, error: { code: 'match.not-live', message: 'No match is waiting between rounds' } };
      return withClub((clubId) => store.dispatch({ type: 'match.swap', clubId, fixtureId: ms.fixtureId, afterRound: ms.rounds.length, swaps }));
    },
    setAutoSwap: (rules) => withClub((clubId) => store.dispatch({ type: 'autoswap.set', clubId, rules })),
    setPacing: (levelUpPacing, pauseBetweenRounds) => withClub((clubId) => store.dispatch({ type: 'pacing.set', clubId, levelUpPacing, pauseBetweenRounds })),
  };
}

/** The facade over the app's store and engine (screens). */
export function useMatchDay(store: GameStore): MatchDayFacade {
  const engine = useEngine();
  return useMemo(() => matchDayFacade(store, engine, () => store.content.value), [store, engine]);
}
