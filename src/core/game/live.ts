/**
 * M1.1 engine entry points for paused matches and level-ups (WP-C; docs/design/05 M1.1 addendum).
 *
 * advance(state) is Continue: with no live match it starts the week (lock,
 * the player's match round by round, pausing per Club.pauseBetweenRounds);
 * with a live match it plays on from the pending between-round step (the
 * player's match.swap decisions, else the auto-swap suggestions) until the
 * next pause or the end of the week. advanceWeek is the same processing
 * without pauses.
 */
import type { ContentDB } from '../content';
import type { LevelUpChoice } from '../fighters';
import type { FighterId, GameState, LevelOption, LevelUpMode, TraitId, WeekReport } from '../model';
import { ok, type EngineError, type Result } from '../util';
import { betweenRounds, type BetweenRoundView } from './orchestrator';
import type { GamePorts } from './ports';
import { processWeekLive, type LiveWeekOutcome } from './week';

export interface AdvanceOutcome {
  state: GameState;
  /** The week's report once the whole week has been processed; null while the player's match waits. */
  week: WeekReport | null;
  /** The between-round screen when the player's match pauses (state.liveMatch is set); null otherwise. */
  pause: BetweenRoundView | null;
}

export function advanceWith(ports: GamePorts, state: GameState, content: ContentDB): Result<AdvanceOutcome, EngineError> {
  const r = advanceLoggedWith(ports, state, content);
  return r.ok ? ok({ state: r.value.state, week: r.value.report, pause: r.value.pause }) : r;
}

export function advanceLoggedWith(ports: GamePorts, state: GameState, content: ContentDB): Result<LiveWeekOutcome, EngineError> {
  return processWeekLive(ports, state, content, true);
}

/** The between-round screen of the player's live match, or null when no match is waiting. */
export function betweenRoundViewWith(ports: GamePorts, state: GameState, content: ContentDB): BetweenRoundView | null {
  if (state.liveMatch === null || state.liveMatch.phase !== 'between_rounds') return null;
  return betweenRounds(ports, state, state.liveMatch, content);
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

/** The level-up dialog of one fighter (null when he has no pending level-up). Oldest offer first. */
export function levelUpViewWith(ports: GamePorts, state: GameState, fighterId: FighterId, content: ContentDB): LevelUpView | null {
  const f = state.fighters[fighterId];
  if (!f || f.pendingLevelUps.length === 0) return null;
  const mode = ports.fighters.effectiveLevelUpMode(state, f);
  const pickMode = mode === 'manual' ? 'auto' : mode;
  return {
    fighterId,
    mode,
    level: f.level,
    xpIntoLevel: f.xpIntoLevel,
    xpNeeded: f.xpNeeded,
    etaMatches: ports.fighters.levelEtaMatches(f, content),
    pending: f.pendingLevelUps.map((p) => ({
      level: p.level,
      traitOffer: p.traitOffer ? [...p.traitOffer] : null,
      autoPick: ports.fighters.autoPickChoice(f, p, pickMode, content),
      options: p.options.map((option): LevelUpOptionView => {
        const legal = ports.fighters.levelOptionLegal(f, option, content);
        if (option.kind !== 'stat') return { option, legal, statAfter: null, ratingAfter: null };
        // The pick raises the trained value (WP-B: effective stats read train100); a copy, so no memo is reused.
        const after = { ...f, train100: { ...f.train100, [option.stat]: (f.train100[option.stat] ?? 0) + option.gain100 } };
        return { option, legal, statAfter: ports.fighters.effectiveStats(after, content)[option.stat] ?? null, ratingAfter: ports.fighters.rating(after, content) };
      }),
    })),
  };
}
