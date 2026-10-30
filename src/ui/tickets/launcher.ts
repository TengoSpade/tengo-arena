/**
 * Playtest tickets, startup part: the F8 key and the open/busy state. Everything else (screenshot
 * library, dialog, upload) is a lazy chunk (./tool), fetched when the browser is idle so F8 is
 * quick, and loaded on first use at the latest; the main bundle carries only this file.
 *
 * At F8 the game state, route and logs are taken synchronously (`snapshot`), before anything is
 * awaited, so the ticket describes exactly the moment of the key press.
 */
import { signal } from '@preact/signals';
import { toastHistory } from '../components/Toast';
import type { AppStore } from '../store';
import { settings } from '../store/settings';
import { arenaTicketInfo } from './arena-info';
import { consoleEntries } from './console-capture';

/** A ticket is being captured, written or submitted: F8 does nothing meanwhile. */
export const ticketBusy = signal(false);

/** Dev builds always; other builds behind Settings › Playtest tools (default on). */
export function playtestToolsOn(): boolean {
  return import.meta.env.DEV || settings.value.playtestTools;
}

/** Everything a ticket records, as it was when F8 was pressed (GameState values are immutable). */
export function snapshot(store: AppStore) {
  return {
    at: new Date(),
    game: store.game.value,
    content: store.content.value,
    careerId: store.careerId.value,
    hash: location.hash,
    commandLog: store.commandLog.value,
    recentCommands: store.recentCommands.value,
    console: consoleEntries(),
    toasts: toastHistory.slice(-10),
    settings: settings.value,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio || 1,
    // M2: what the arena was showing (fixture, round, tick, speed, kind), read at the key press; null elsewhere.
    arena: arenaTicketInfo(),
  };
}
export type TicketSnapshot = ReturnType<typeof snapshot>;

const loadTool = () => import('./tool');

export async function openTicketTool(store: AppStore): Promise<void> {
  if (ticketBusy.value || !playtestToolsOn()) return;
  const snap = snapshot(store);
  ticketBusy.value = true;
  try {
    await (await loadTool()).fileTicket(store, snap);
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
  // Fetch the tool when the browser is idle, so the screenshot starts right at the key press.
  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 3000));
  if (playtestToolsOn()) idle(() => void loadTool().catch(() => undefined));
  return () => window.removeEventListener('keydown', onKey, true);
}
