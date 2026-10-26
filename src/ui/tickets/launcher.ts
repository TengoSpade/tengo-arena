/**
 * Playtest tickets, startup part: the F8 key, the open/busy state and the reproduction banner.
 * Everything else (screenshot library, dialog, upload) is a lazy chunk loaded on first use
 * (./tool), so the main bundle carries only this file.
 */
import { signal } from '@preact/signals';
import type { AppStore } from '../store';
import { settings } from '../store/settings';

/** A ticket is being captured, written or submitted: F8 does nothing meanwhile. */
export const ticketBusy = signal(false);
/** Set while a ticket's save is loaded for reproduction (`?ticket=<id>` in dev): the frame shows a banner. */
export const reproducingTicket = signal<string | null>(null);

/** Dev builds always; other builds behind Settings › Playtest tools (default on). */
export function playtestToolsOn(): boolean {
  return import.meta.env.DEV || settings.value.playtestTools;
}

export async function openTicketTool(store: AppStore): Promise<void> {
  if (ticketBusy.value || !playtestToolsOn()) return;
  ticketBusy.value = true;
  try {
    const tool = await import('./tool');
    await tool.fileTicket(store);
  } catch (e) {
    console.error('ticket tool failed', e);
  } finally {
    ticketBusy.value = false;
  }
}

/** F8 from any screen, also while another dialog is open; returns the uninstaller. */
export function installTicketKey(store: AppStore): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'F8' || e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    void openTicketTool(store);
  };
  window.addEventListener('keydown', onKey, true);
  return () => window.removeEventListener('keydown', onKey, true);
}
