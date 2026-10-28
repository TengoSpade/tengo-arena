/**
 * The game state the smoke compares against: read from the page's own saves (IndexedDB), parsed by core/save in Node.
 * The round autosave is written when Play match locks the squad, before the viewer opens (Q60 option A), and at every stop,
 * so it is exactly what a reload would load, and it exists in every build. `window.__arena.state()` (dev) is the fallback.
 */
import type { ContentDB } from '../../../src/core/content';
import type { GameState } from '../../../src/core/model';
import { parseSave } from '../../../src/core/save';
import type { PageDriver } from './page';

/** AUTOSAVE_ROUND_SLOT of src/platform/save-store.ts (not imported: the smoke stays out of the platform layer). */
export const ROUND_SLOT = 'auto-round';

export type StateRead = { state: GameState; source: string } | { state: null; problem: string };

export async function readSavedState(page: PageDriver, content: ContentDB, slot = ROUND_SLOT): Promise<StateRead> {
  const rec = await page.probe<{ slotId: string; savedAt: string | null; json: string } | null>('readSave', slot).catch((e: unknown) => {
    throw new Error(`could not read the page's saves: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (!rec) return { state: null, problem: `the page has no "${slot}" save in IndexedDB (only that slot is read: no other save stands in for it)` };
  const parsed = parseSave(rec.json, content);
  if (!parsed.ok) return { state: null, problem: `the ${rec.slotId} save does not load in Node: ${parsed.error.code}: ${parsed.error.message}` };
  return { state: parsed.value.envelope.state, source: `IndexedDB ${rec.slotId}${rec.savedAt ? ` saved ${rec.savedAt}` : ''}` };
}

/** The saved round state, else the hook's state() when the build has one. */
export async function readGameState(page: PageDriver, content: ContentDB, hasHookState: boolean, slot = ROUND_SLOT): Promise<StateRead> {
  const saved = await readSavedState(page, content, slot);
  if (saved.state) return saved;
  if (hasHookState) {
    const state = await page.eval<GameState | null>('window.__arena.state()', 60_000);
    if (state) return { state, source: 'window.__arena.state()' };
  }
  return saved;
}
