/**
 * Ctrl S / the Save buttons: save to the career's current manual slot, or, when the career has none
 * (a new career, or an autosave was loaded), open Save as on the Saves screen instead of picking a
 * slot silently. A quick save can therefore never overwrite another career's slot.
 */
import { signal } from '@preact/signals';
import { showToast } from '../components/Toast';
import { slotName, type AppStore } from '../store';
import { errorText } from '../store/messages';
import { t } from '../text';
import { navigate } from './router';

/** Set when Save as should open as the Saves screen mounts. */
export const saveAsRequested = signal(false);

export async function quickSaveOrAsk(store: AppStore): Promise<void> {
  if (!store.game.value?.playerClubId) return;
  if (!store.currentSlot.value) {
    saveAsRequested.value = true;
    navigate('#/saves');
    return;
  }
  const res = await store.quickSave();
  if (res.ok) showToast({ title: t('save.saved', { slot: slotName(res.value.slotId) }), sub: res.value.label, kind: 'good' });
  else showToast({ title: t('error.title'), sub: errorText(res.error), kind: 'bad' });
}
