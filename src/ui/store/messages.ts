/**
 * Player-facing text for EngineError / SaveError codes and Blocker codes.
 * Core returns stable codes; the UI maps them here (05 §2). Unknown codes
 * fall back to a generic line plus the developer message.
 */
import type { Blocker, GameState, SaveError } from '../../core/model';
import type { EngineError } from '../../core/util';
import { hasText, t, tKey } from '../text';

export function errorText(error: EngineError | SaveError): string {
  const details = (error.details ?? {}) as Record<string, unknown>;
  if (error.code === 'save.storage') {
    if (details['empty']) return t('error.save.empty');
    if (details['full']) return t('error.save.full');
  }
  const what = typeof details['what'] === 'string' ? details['what'] : '';
  return tKey(`error.${error.code}`, 'error.generic', { message: error.message, what });
}

/** A blocker as one line. With the state, a blocker about one fighter names him ("….named" copy). */
export function blockerText(blocker: Blocker, state?: GameState | null): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(blocker.details ?? {})) params[k] = v;
  if (params['n'] === undefined && typeof params['excess'] === 'number') params['n'] = params['excess'];
  if (params['n'] === undefined) params['n'] = 1;
  const name = blocker.fighterId ? state?.fighters[blocker.fighterId]?.name.full : undefined;
  const named = `blocker.${blocker.code}.named`;
  if (name && hasText(named)) return t(named, { ...params, name });
  return tKey(`blocker.${blocker.code}`, 'blocker.unknown', params);
}

/**
 * The blockers worth listing: "Lineup needs 5 fit fighters" is only the consequence of an unfit or
 * departed starter, so it is dropped while one of those is listed.
 */
export function distinctBlockers<B extends Blocker>(blockers: readonly B[]): B[] {
  const hasCause = blockers.some((b) => b.code === 'lineup.unavailable' || b.code === 'lineup.not-on-roster');
  return blockers.filter((b) => !(hasCause && b.code === 'lineup.incomplete'));
}
