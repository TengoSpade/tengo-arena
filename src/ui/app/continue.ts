/**
 * The Continue state machine (04 §6.1): one primary action, always top
 * right, whose label follows the week:
 *   Continue · Lineup at <club>  (opens the lineup, unless the pacing preset skips it)
 *   Play match · at <club> · locks lineup  (advances the week)
 *   (report) Continue · To matchweek N  (back to the hub)
 * Preseason: Continue · Week P2; end of P4: Kick off season (commit dialog);
 * out of the Reckoning: Advance to season end (commit dialog); after TW3:
 * Season review. A blocker turns it neutral: Decide first · <item>, and
 * pressing it jumps to the item. A preset never changes a result (P-05).
 * Pure: computed from the committed state, route and settings.
 */
import type { ContentDB } from '../../core/content';
import type { Blocker, ClubId, GameState, MatchViewMode } from '../../core/model';
import { weekDefAt, weekLabel } from '../format/calendar';
import { safeView, type GameEngine } from '../store/engine';
import { blockerTarget } from '../store/digest-targets';
import { blockerText } from '../store/messages';
import type { WatchPreference } from '../store/arena';
import type { PacingPreset, PacingStops } from '../store/settings';
import { t } from '../text';
import type { RouteId } from './routes';

export { blockerTarget };

/**
 * How Play match starts the player's match (open-020, owner answer to Q54): `mode` is what Continue and Space do,
 * `offer` shows the other choice as a button beside it (both are one input). Watch is primary; the Streamlined
 * pacing preset (D-L) simulates by default; an explicit Watch preference in Settings › Match day wins over it.
 */
export interface PlayMode {
  mode: MatchViewMode;
  offer: boolean;
}

export function playModeFor(pacing: PacingPreset, preference: WatchPreference): PlayMode {
  if (preference === 'watch') return { mode: 'watch', offer: false };
  if (preference === 'simulate') return { mode: 'simulate', offer: false };
  return { mode: pacing === 'streamlined' ? 'simulate' : 'watch', offer: true };
}

export type ContinueAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'advance'; playsMatch: false }
  | { kind: 'advance'; playsMatch: true; mode: MatchViewMode; offer: boolean }
  | { kind: 'confirm-advance'; variant: 'kick-off' | 'season-end' }
  | { kind: 'season-end' }
  | { kind: 'none' };

export interface ContinueModel {
  main: string;
  sub?: string;
  state: 'ready' | 'blocked' | 'busy';
  tip: string;
  action: ContinueAction;
}

export interface ContinueInput {
  state: GameState | null;
  content: ContentDB | null;
  engine: GameEngine;
  blockers: readonly Blocker[];
  routeId: RouteId | null;
  busy: boolean;
  stops: PacingStops;
  /** Watch or Simulate for Play match (default: Watch primary with the offer; the Frame passes the settings). */
  play?: PlayMode;
}

export function continueModel(input: ContinueInput): ContinueModel {
  const { state, content, engine, routeId } = input;
  if (input.busy) return { main: t('continue.busy'), state: 'busy', tip: t('continue.tipWeek'), action: { kind: 'none' } };
  if (!state || !content) return { main: t('continue.newCareer'), state: 'ready', tip: '', action: { kind: 'navigate', to: '#/new-game' } };
  const clubId = state.playerClubId;
  if (!clubId) {
    return { main: t('continue.decideFirst'), sub: t('blocker.club.not-chosen'), state: 'blocked', tip: t('continue.tipBlocked'), action: { kind: 'navigate', to: '#/club-select' } };
  }
  const club = state.clubs[clubId];
  const tier = club ? content.tiers.get(club.tierId) : undefined;

  if (state.calendar.phase === 'season-end') {
    return { main: t('continue.seasonReview'), sub: t('continue.seasonReviewSub'), state: 'ready', tip: t('continue.tipWeek'), action: { kind: 'season-end' } };
  }

  const blocking = input.blockers.filter((b) => b.code !== 'phase.season-end');
  if (blocking.length > 0) {
    const first = blocking[0]!;
    return {
      main: t('continue.decideFirst'),
      sub: blockerText(first, state),
      state: 'blocked',
      tip: t('continue.tipBlocked'),
      action: { kind: 'navigate', to: blockerTarget(first.code) },
    };
  }

  // M2: a round of the player's match waits in the arena (its lineups are locked and saved; nothing of its result
  // exists yet). Continue goes back to it; in the arena itself Space belongs to the viewer.
  const watch = state.liveMatch?.watch;
  if (state.liveMatch && watch && watch.mode === 'watch' && watch.round !== null) {
    if (routeId === 'arena') return { main: t('continue.inArena'), sub: t('continue.inArenaSub', { n: watch.round }), state: 'ready', tip: t('continue.tipInArena'), action: { kind: 'none' } };
    return { main: t('continue.resumeWatching'), sub: t('continue.resumeWatchingSub', { n: watch.round }), state: 'ready', tip: t('continue.tipResumeWatching'), action: { kind: 'navigate', to: '#/arena' } };
  }

  // The player's match waits between rounds (M1.1): Continue goes back to it.
  if (state.liveMatch) {
    const next = state.liveMatch.rounds.length + 1;
    if (routeId === 'between-rounds') return { main: t('continue.playRound', { n: next }), sub: t('continue.betweenSub'), state: 'ready', tip: t('continue.tipRound'), action: { kind: 'none' } };
    return { main: t('continue.toMatch'), sub: t('continue.playRound', { n: next }), state: 'ready', tip: t('continue.tipRound'), action: { kind: 'navigate', to: '#/between-rounds' } };
  }

  // On the report of the match just played: back to the hub of the new week.
  if (routeId === 'match-report' || routeId === 'season-review' || routeId === 'replay') {
    return {
      main: t('continue.main'),
      sub: t('continue.toWeek', { week: weekLabel(content, state.calendar.weekIndex, tier) }),
      state: 'ready',
      tip: t('continue.tipWeek'),
      action: { kind: 'navigate', to: '#/home' },
    };
  }

  const fixture = safeView(() => engine.clubFixture(state, clubId, state.calendar.weekIndex), null);
  if (fixture) {
    const home = fixture.homeClubId === clubId;
    const other = state.clubs[(home ? fixture.awayClubId : fixture.homeClubId) as ClubId];
    const where = home ? t('continue.vs') : t('continue.at');
    const name = other?.name ?? '';
    if (input.stops.lineup && routeId !== 'squad') {
      return {
        main: t('continue.main'),
        sub: t('continue.toLineup', { where, club: name }),
        state: 'ready',
        tip: t('continue.tipLineup'),
        action: { kind: 'navigate', to: '#/squad' },
      };
    }
    const play = input.play ?? { mode: 'watch' as const, offer: true };
    return {
      main: t('continue.playMatch'),
      sub: t(play.mode === 'watch' ? 'continue.watchSub' : 'continue.simulateSub', { where, club: name }),
      state: 'ready',
      tip: t(play.mode === 'watch' ? 'continue.tipWatch' : 'continue.tipSimulateDefault'),
      action: { kind: 'advance', playsMatch: true, mode: play.mode, offer: play.offer },
    };
  }

  const week = weekDefAt(content, state.calendar.weekIndex);
  if (week?.commit === 'kick_off') {
    return { main: t('continue.kickOff'), sub: t('continue.kickOffSub'), state: 'ready', tip: t('continue.kickOffText'), action: { kind: 'confirm-advance', variant: 'kick-off' } };
  }
  if (week?.phase === 'tournament') {
    return {
      main: t('continue.seasonEnd'),
      state: 'ready',
      tip: t('continue.seasonEndText'),
      action: { kind: 'confirm-advance', variant: 'season-end' },
    };
  }
  const next = weekDefAt(content, state.calendar.weekIndex + 1);
  return {
    main: t('continue.main'),
    sub: next ? t('continue.toWeek', { week: weekLabel(content, next.index, tier) }) : undefined,
    state: 'ready',
    tip: t('continue.tipWeek'),
    action: { kind: 'advance', playsMatch: false },
  };
}
