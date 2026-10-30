import { cloneJson, deepFreeze } from '../util';
import type { GameState } from './game-state';
import { enableIndexes } from './indexes';

/**
 * Parts of GameState that are written once and never changed afterwards:
 * played match results, archived season records and alumni. A transition
 * shares them with the committed state instead of deep-copying them every
 * week (the copy grew with every season, 05 §8). They are deep-frozen when
 * shared, so an accidental later write throws instead of corrupting the
 * committed state. Code that needs to change one (results compaction)
 * replaces the entry (copy-on-write), never edits it in place.
 */
export const SHARED_STATE_KEYS = ['results', 'history', 'alumni'] as const;

const SHARED = new Set<string>(SHARED_STATE_KEYS);

/**
 * The draft for one transition: everything mutable is deep-copied, the
 * write-once parts are shared (new map / array holding the same frozen
 * entries), key order is preserved, and the draft is put in indexed mode.
 */
export function beginTransition(state: GameState): GameState {
  const draft: Record<string, unknown> = {};
  for (const key of Object.keys(state) as (keyof GameState)[]) {
    const value = state[key];
    if (!SHARED.has(key)) {
      draft[key] = cloneJson(value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) deepFreeze(item);
      draft[key] = [...value];
    } else {
      const map = value as Record<string, unknown>;
      for (const k of Object.keys(map)) deepFreeze(map[k]);
      draft[key] = { ...map };
    }
  }
  const out = draft as unknown as GameState;
  enableIndexes(out);
  return out;
}
