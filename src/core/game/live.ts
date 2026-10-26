/**
 * M1.1 engine entry points for paused matches and level-ups (WP-C; docs/design/05 M1.1 addendum).
 *
 * advance(state) is Continue: with no live match it is advanceWeek (the M1
 * path, unchanged until WP-C switches week processing to the orchestrator);
 * with a live match it plays on from the pending between-round step (the
 * player's match.swap decisions, else the auto-swap suggestions) until the
 * next pause or the end of the week. CONTRACTS PHASE: the live-match branch
 * is a stub.
 */
import type { ContentDB } from '../content';
import { withDerivedMemo, type LevelUpChoice } from '../fighters';
import type { FighterId, GameState, LevelOption, LevelUpMode, TraitId, WeekReport } from '../model';
import { notImplemented, ok, type EngineError, type Result } from '../util';
import { betweenRounds, type BetweenRoundView } from './orchestrator';
import { realGamePorts } from './ports';
import { processWeek } from './week';

export interface AdvanceOutcome {
  state: GameState;
  /** The week's report once the whole week has been processed; null while the player's match waits. */
  week: WeekReport | null;
  /** The between-round screen when the player's match pauses (state.liveMatch is set); null otherwise. */
  pause: BetweenRoundView | null;
}

export function advance(state: GameState, content: ContentDB): Result<AdvanceOutcome, EngineError> {
  if (state.liveMatch === null) {
    const r = withDerivedMemo(() => processWeek(realGamePorts, state, content));
    return r.ok ? ok({ state: r.value.state, week: r.value.report, pause: null }) : r;
  }
  return notImplemented('game.advance with a live match (M1.1 WP-C)', state, content);
}

/** The between-round screen of the player's live match, or null when no match is waiting. */
export function betweenRoundView(state: GameState, content: ContentDB): BetweenRoundView | null {
  if (state.liveMatch === null || state.liveMatch.phase !== 'between_rounds') return null;
  return betweenRounds(realGamePorts, state, state.liveMatch, content);
}

export interface LevelUpOptionView {
  option: LevelOption;
  /** False when it became illegal since the offer (shown greyed out). */
  legal: boolean;
  /** Stat options: the stat value and the rating after the pick. */
  statAfter: number | null;
  ratingAfter: number | null;
}

export interface LevelUpView {
  fighterId: FighterId;
  mode: LevelUpMode;
  level: number;
  xpIntoLevel: number;
  xpNeeded: number;
  /** "Next level in ≈ N matches". */
  etaMatches: number | null;
  pending: { level: number; options: LevelUpOptionView[]; traitOffer: TraitId[] | null; autoPick: LevelUpChoice }[];
}

/** The level-up dialog of one fighter (null when he has no pending level-up). CONTRACTS PHASE: a stub past that check. */
export function levelUpView(state: GameState, fighterId: FighterId, content: ContentDB): LevelUpView | null {
  const f = state.fighters[fighterId];
  if (!f || f.pendingLevelUps.length === 0) return null;
  return notImplemented('game.levelUpView (M1.1 WP-C)', state, fighterId, content);
}
