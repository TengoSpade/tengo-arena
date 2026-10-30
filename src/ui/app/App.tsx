/**
 * App root: providers (store, engine), settings on <html>, error toasts,
 * the content-error gate and the route decision:
 *  - no career: title (#/new-game), plus Save / Load, Settings and the codex;
 *  - career without a club: club select;
 *  - otherwise the hub frame with the routed screen.
 * Dev builds add the component gallery (#/dev/components); the debug
 * overlay opens with backtick (dev) or ?debug=1.
 */
import { effect } from '@preact/signals';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
// Direct module imports (not the components barrel) keep screen-only components out of the main bundle.
import { ToastRegion, showToast } from '../components/Toast';
import { TooltipLayer } from '../components/Tooltip';
import type * as DebugOverlayModule from '../debug/DebugOverlay';
import { StoreContext, type AppStore } from '../store';
import { EngineContext } from '../store/engine';
import { errorText } from '../store/messages';
import { applySettingsToDocument } from '../store/settings';
import { t } from '../text';
import { Frame } from './Frame';
import { installTicketKey } from '../tickets/launcher';
import { navigate, useRoute } from './router';
import { ROUTES, type RouteId } from './routes';
import { ContentErrorScreen, ScreenHost } from './ScreenHost';

export interface AppProps {
  store: AppStore;
}

/** Routes reachable before a career exists. */
const PRE_CAREER: readonly RouteId[] = ['new-game', 'saves', 'settings', 'codex'];
/** Full-page routes without the hub frame (flow-state-001 / 002). */
const BARE: readonly RouteId[] = ['new-game', 'club-select'];

function debugRequested(): boolean {
  try {
    return new URLSearchParams(location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

export function App({ store }: AppProps) {
  const [debug, setDebug] = useState(debugRequested);
  const debugAllowed = import.meta.env.DEV || debugRequested();
  // The debug overlay is a lazy chunk: loaded the first time it is opened.
  const [DebugOverlay, setDebugOverlay] = useState<typeof DebugOverlayModule.DebugOverlay | null>(null);
  useEffect(() => {
    if (debug && debugAllowed && !DebugOverlay) void import('../debug/DebugOverlay').then((m) => setDebugOverlay(() => m.DebugOverlay));
  }, [debug, debugAllowed, DebugOverlay]);

  useEffect(() => applySettingsToDocument(), []);
  // F8 files a playtest ticket from any screen (the tool itself is a lazy chunk).
  useEffect(() => installTicketKey(store), [store]);
  useEffect(
    () =>
      effect(() => {
        const e = store.lastError.value;
        if (!e) return;
        showToast({ title: errorText(e), kind: 'bad', sub: e.code });
        store.clearError();
      }),
    [store],
  );

  const issues = store.contentIssues.value;
  if (issues.length > 0) return <ContentErrorScreen issues={issues} />;
  if (!store.content.value) return <main class="page" aria-busy="true" />;

  return (
    <StoreContext.Provider value={store}>
      <EngineContext.Provider value={store.engine}>
        <AppRoutes store={store} onToggleDebug={debugAllowed ? () => setDebug((d) => !d) : undefined} />
        {debug && debugAllowed && DebugOverlay && <DebugOverlay store={store} onClose={() => setDebug(false)} />}
      </EngineContext.Provider>
    </StoreContext.Provider>
  );
}

function AppRoutes({ store, onToggleDebug }: { store: AppStore; onToggleDebug?: () => void }) {
  const { route, params, hash } = useRoute();
  const game = store.game.value;
  const hasCareer = !!game;
  const hasClub = !!game?.playerClubId;

  // Redirects (kept out of render to avoid loops).
  let target: string | null = null;
  if (import.meta.env.DEV && hash.startsWith('#/dev/components')) target = null;
  else if (!route) target = hasClub ? '#/home' : '#/new-game';
  else if (!hasCareer && !PRE_CAREER.includes(route.id)) target = '#/new-game';
  else if (hasCareer && !hasClub && route.id !== 'club-select' && route.id !== 'new-game' && !PRE_CAREER.includes(route.id)) target = '#/club-select';
  else if (hasClub && route.id === 'club-select') target = '#/home';
  useEffect(() => {
    if (target) navigate(target);
  }, [target]);

  if (import.meta.env.DEV && hash.startsWith('#/dev/components')) {
    return (
      <Frame onToggleDebug={onToggleDebug}>
        <LazyGallery />
      </Frame>
    );
  }
  if (!route || target) return <main class="page" aria-busy="true" />;
  if (BARE.includes(route.id)) {
    return (
      <>
        <ScreenHost route={route} params={params} />
        <TooltipLayer />
        <ToastRegion />
      </>
    );
  }
  return (
    <Frame onToggleDebug={onToggleDebug}>
      <ScreenHost route={route} params={params} />
    </Frame>
  );
}

function LazyGallery() {
  const [Gallery, setGallery] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void import('../debug/Gallery').then((m) => setGallery(() => m.default));
  }, []);
  return Gallery ? <Gallery /> : <main class="page" aria-busy="true">{t('common.loading')}</main>;
}

export { ROUTES };
