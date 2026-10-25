/**
 * Player-facing text for EngineError / SaveError codes and Blocker codes.
 * Core returns stable codes; the UI maps them here (05 §2). Unknown codes
 * fall back to a generic line plus the developer message.
 */
import type { Blocker, SaveError } from '../../core/model';
import type { EngineError } from '../../core/util';
import { t, tKey } from '../text';

export function errorText(error: EngineError | SaveError): string {
  const details = (error.details ?? {}) as Record<string, unknown>;
  if (error.code === 'save.storage') {
    if (details['empty']) return t('error.save.empty');
    if (details['full']) return t('error.save.full');
  }
  const what = typeof details['what'] === 'string' ? details['what'] : '';
  return tKey(`error.${error.code}`, 'error.generic', { message: error.message, what });
}

export function blockerText(blocker: Blocker): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(blocker.details ?? {})) params[k] = v;
  if (params['n'] === undefined && typeof params['excess'] === 'number') params['n'] = params['excess'];
  if (params['n'] === undefined) params['n'] = 1;
  return tKey(`blocker.${blocker.code}`, 'blocker.unknown', params);
}
