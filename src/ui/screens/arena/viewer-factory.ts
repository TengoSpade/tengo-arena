/**
 * The factory seam for the PixiJS viewer (05-technical-m2 §A11 "UI"): the arena screens ask for a viewer here, so
 * tests inject a fake and production loads src/render/viewer as a lazy chunk with import() (rule
 * ui-render-viewer-static: PixiJS stays out of the startup JS).
 */
import { createContext } from 'preact';
import { useContext, useEffect } from 'preact/hooks';
import type { GameState } from '../../../core/model';
import { watchingMatch } from '../../store/arena';
import { settings } from '../../store/settings';
import type { ArenaViewer, ArenaViewerOptions } from '../../../render/viewer';

export type ViewerFactory = (options: ArenaViewerOptions) => Promise<ArenaViewer>;

export const defaultViewerFactory: ViewerFactory = async (options) => (await import('../../../render/viewer')).createArenaViewer(options);

export const ViewerFactoryContext = createContext<ViewerFactory>(defaultViewerFactory);

export function useViewerFactory(): ViewerFactory {
  return useContext(ViewerFactoryContext);
}

/** What the prefetch needs of the viewer entry (the test passes a stand-in). */
export interface ViewerEntry {
  prefetchViewerChunks?: () => Promise<void>;
}

let warm: Promise<void> | null = null;

/**
 * Warm the viewer's lazy chunks: the entry itself (with the PixiJS core it imports) and, through its
 * `prefetchViewerChunks`, the pieces PixiJS loads when the viewer is created (browser environment, WebGL renderer). All
 * dynamic imports, so none of it is startup JS (tests/build/prefetch.test.ts). Once per page; never throws.
 */
export function prefetchViewer(load: () => Promise<ViewerEntry> = () => import('../../../render/viewer')): void {
  if (warm) return;
  warm = load()
    .then((entry) => entry.prefetchViewerChunks?.())
    .catch(() => {
      warm = null; // a failed fetch (offline, a moved chunk) may be tried again later
    });
}

/** Forget that the chunks were asked for (tests). */
export function resetViewerPrefetch(): void {
  warm = null;
}

/** Not under test: the chunks would load PixiJS into happy-dom. */
const prefetchAllowed = (): boolean => import.meta.env.MODE !== 'test' && typeof window !== 'undefined';

/**
 * Prefetch the viewer chunks at idle whenever a Watch is plausible: Home and Squad while a match is next, the between-round
 * screen of a watched match, so the first open (500 ms budget) is a warm open. Never when the player always simulates.
 */
export function usePrefetchViewer(matchNext: boolean): void {
  const watchable = settings.value.arena.watchPreference !== 'simulate';
  useEffect(() => {
    if (!matchNext || !watchable || !prefetchAllowed()) return undefined;
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 2000));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => prefetchViewer());
    return () => cancel(id);
  }, [matchNext, watchable]);
}

/**
 * Right after a load: a save with a round waiting to be watched opens the arena at once, so its chunks are asked for at once
 * (the arena screen itself loads beside them), not at idle. Any other load lands on Home, which prefetches at idle.
 */
export function prefetchViewerAfterLoad(state: GameState | null): void {
  if (prefetchAllowed() && watchingMatch(state)) prefetchViewer();
}
