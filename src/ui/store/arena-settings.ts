/**
 * Per-device viewer settings (05-technical-m2 §A7): defaults and the validating merge of a stored record. Kept apart
 * from store/arena.ts (the facade) so settings.ts, which loads at startup, imports only types and this small file.
 * The auto-pause defaults equal src/render DEFAULT_AUTO_PAUSE (approved in Q58); a test pins the equality, so the
 * startup bundle does not need the render index.
 */
import type { AutoPauseRules, Speed } from '../../render';
import type { ArenaSettings, WatchPreference } from './arena';

export const DEFAULT_ARENA_SETTINGS: Readonly<ArenaSettings> = {
  watchPreference: 'ask',
  speed: 1,
  autoPause: { ownDowned: true, enemyDowned: false, ownCaptainDown: true, overtime: true, ownHpBelowPct: null },
  labels: 'selected',
  pauseWhenHidden: true,
};

const WATCH_PREFERENCES: readonly WatchPreference[] = ['ask', 'watch', 'simulate'];
const SPEEDS: readonly Speed[] = [1, 2, 4];
const LABELS: readonly ArenaSettings['labels'][] = ['off', 'selected', 'all'];

export function cloneArenaSettings(a: Readonly<ArenaSettings> = DEFAULT_ARENA_SETTINGS): ArenaSettings {
  return { ...a, autoPause: { ...a.autoPause } };
}

/** A stored record (any shape) as valid ArenaSettings: each field falls back to its default on its own. */
export function mergeArenaSettings(raw: unknown): ArenaSettings {
  const out = cloneArenaSettings();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (WATCH_PREFERENCES.includes(r['watchPreference'] as WatchPreference)) out.watchPreference = r['watchPreference'] as WatchPreference;
  if (SPEEDS.includes(r['speed'] as Speed)) out.speed = r['speed'] as Speed;
  if (LABELS.includes(r['labels'] as ArenaSettings['labels'])) out.labels = r['labels'] as ArenaSettings['labels'];
  if (typeof r['pauseWhenHidden'] === 'boolean') out.pauseWhenHidden = r['pauseWhenHidden'];
  const ap = r['autoPause'];
  if (ap && typeof ap === 'object') {
    const a = ap as Record<string, unknown>;
    for (const k of ['ownDowned', 'enemyDowned', 'ownCaptainDown', 'overtime'] as const) if (typeof a[k] === 'boolean') out.autoPause[k] = a[k];
    const pct = a['ownHpBelowPct'];
    if (pct === null) out.autoPause.ownHpBelowPct = null;
    else if (typeof pct === 'number' && pct > 0 && pct < 100) out.autoPause.ownHpBelowPct = Math.round(pct);
  }
  return out;
}

export type { AutoPauseRules };
