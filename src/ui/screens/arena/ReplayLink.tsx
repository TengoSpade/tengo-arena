/**
 * Replay entries (05-technical-m2 §A4, §A7): the report's Replay button and key moments, the fixtures list and
 * Home's last result. Enabled when core/game's `replayAvailability` says the match can be rebuilt, otherwise
 * disabled with the reason as a tooltip (the wording is the UI designer's, EXAMPLE). While core's check is still a
 * stub the button stays disabled with the M1 note, so nothing links to a screen that cannot open.
 */
import type { FixtureId } from '../../../core/model';
import { Icon, tipAttrs } from '../../components';
import { useStore } from '../../store';
import { useArena } from '../../store/arena';
import { t } from './text';

/** A key moment's replay starts this long before it (2 s = 40 ticks; 05-technical-m2 §A3). */
export const REPLAY_LEAD_TICKS = 40;

/** "#/replay/<fixtureId>?round=2&tick=340". */
export function replayHref(fixtureId: string, round?: number, tick?: number): string {
  const q = new URLSearchParams();
  if (round !== undefined) q.set('round', String(round));
  if (tick !== undefined && tick > 0) q.set('tick', String(Math.floor(tick)));
  const qs = q.toString();
  return `#/replay/${encodeURIComponent(fixtureId)}${qs ? `?${qs}` : ''}`;
}

/** The disabled reason as the tooltip text. */
export function replayReasonText(reason: 'not-played' | 'compacted' | 'other-build' | 'live' | null): string {
  switch (reason) {
    case 'compacted':
      return t('replayCompacted');
    case 'other-build':
      return t('replayOtherBuild');
    case 'live':
      return t('replayLive');
    case 'not-played':
      return t('replayNotPlayed');
    default:
      return t('replayUnavailable');
  }
}

/** Whether a fixture can be replayed now, and why not. `null` available = core's check is not implemented yet. */
export function useReplayState(fixtureId: FixtureId): { available: boolean | null; reason: 'not-played' | 'compacted' | 'other-build' | 'live' | null } {
  const store = useStore();
  const arena = useArena(store);
  const state = store.game.value;
  const a = state ? arena.replayAvailability(state, fixtureId) : null;
  if (a === null) return { available: null, reason: null };
  return a.available ? { available: true, reason: null } : { available: false, reason: a.reason };
}

export function ReplayButton({
  fixtureId,
  label,
  icon = false,
  round,
  tick,
  class: cls,
  testId = 'replay-button',
  fallbackTip,
}: {
  fixtureId: FixtureId;
  label?: string;
  /** An icon-only button (fixtures list, Home). */
  icon?: boolean;
  round?: number;
  tick?: number;
  class?: string;
  testId?: string;
  /** Tooltip while core's check is a stub. */
  fallbackTip?: string;
}) {
  const r = useReplayState(fixtureId);
  const text = label ?? t('eyebrowReplay');
  const cls2 = `${icon ? 'icon-btn' : 'btn btn--sm btn--ghost'}${cls ? ` ${cls}` : ''}`;
  if (r.available === true) {
    return (
      <a class={cls2} href={replayHref(fixtureId, round, tick)} data-testid={testId} aria-label={icon ? text : undefined} {...tipAttrs(icon ? text : null)}>
        <Icon name="play" />
        {!icon && text}
      </a>
    );
  }
  const tip = r.available === false ? replayReasonText(r.reason) : (fallbackTip ?? t('stubText'));
  return (
    <button class={`${cls2} is-disabled`} type="button" aria-disabled="true" data-testid={testId} data-reason={r.reason ?? undefined} aria-label={icon ? `${text}: ${tip}` : undefined} {...tipAttrs(tip)}>
      <Icon name="play" />
      {!icon && text}
    </button>
  );
}
