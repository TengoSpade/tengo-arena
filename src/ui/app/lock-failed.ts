/**
 * "Could not save the lineup lock" (the Watch flow's required write failed, so nothing started and nothing opened): one
 * toast with Retry, the same wherever Play match or Play round was pressed (Squad, Home, the between-round screen). It
 * is a toast, not screen state, so it survives the screen that asked: the lock is in memory while the write runs, which
 * remounts or empties the screens that read it.
 */
import { showToast } from '../components/Toast';
import { MATCH_PAUSED, MATCH_WATCHING, SAVE_ROUND_FAILED, type AppStore } from '../store';
import { t } from '../text';
import { afterMatch } from './after-match';
import { navigate } from './router';

export function showLockFailedToast(retry: () => void): void {
  showToast({ kind: 'bad', title: t('continue.saveFailedTitle'), sub: t('continue.saveFailedSub'), durationMs: 15000, action: { label: t('continue.retry'), onClick: retry } });
}

/** Retry from a toast whose screen may be gone: the next step of the match, routed like the screens do. */
export async function retryNextRound(store: AppStore): Promise<void> {
  const res = await store.advance();
  if (res.ok) afterMatch(store.game.value, res.value);
  else if (res.error.code === MATCH_WATCHING) navigate('#/arena');
  else if (res.error.code === MATCH_PAUSED) navigate('#/between-rounds');
  else if (res.error.code === SAVE_ROUND_FAILED) showLockFailedToast(() => void retryNextRound(store));
}
