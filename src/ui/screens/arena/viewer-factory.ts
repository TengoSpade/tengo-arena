/**
 * The factory seam for the PixiJS viewer (05-technical-m2 §A11 "UI"): the arena screens ask for a viewer here, so
 * tests inject a fake and production loads src/render/viewer as a lazy chunk with import() (rule
 * ui-render-viewer-static: PixiJS stays out of the startup JS).
 */
import { createContext } from 'preact';
import { useContext, useEffect } from 'preact/hooks';
import { settings } from '../../store/settings';
import type { ArenaViewer, ArenaViewerOptions } from '../../../render/viewer';

export type ViewerFactory = (options: ArenaViewerOptions) => Promise<ArenaViewer>;

export const defaultViewerFactory: ViewerFactory = async (options) => (await import('../../../render/viewer')).createArenaViewer(options);

export const ViewerFactoryContext = createContext<ViewerFactory>(defaultViewerFactory);

export function useViewerFactory(): ViewerFactory {
  return useContext(ViewerFactoryContext);
}

/** Warm the viewer chunk at idle (Squad and Home in a matchweek; tech-025). Never throws. */
export function prefetchViewer(): void {
  void import('../../../render/viewer').catch(() => undefined);
}

/**
 * Prefetch the viewer chunk at idle while a match is next and the player may watch it (Home and Squad in a matchweek),
 * so the first Watch opens within the 500 ms budget. Not under test (the chunk would load PixiJS into happy-dom).
 */
export function usePrefetchViewer(matchNext: boolean): void {
  const watchable = settings.value.arena.watchPreference !== 'simulate';
  useEffect(() => {
    if (!matchNext || !watchable || import.meta.env.MODE === 'test' || typeof window === 'undefined') return undefined;
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 2000));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(prefetchViewer);
    return () => cancel(id);
  }, [matchNext, watchable]);
}
