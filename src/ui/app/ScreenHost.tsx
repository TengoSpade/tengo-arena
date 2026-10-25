/**
 * Lazy screen loading (one chunk per screen), the per-screen error
 * boundary (a broken screen never takes the frame down) and the blocking
 * content-error screen.
 */
import { Component, type ComponentChildren, type ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { formatContentIssues, type ContentIssue } from '../../core/content';
import { Icon } from '../components/Icon';
import { Callout, Empty } from '../components/marks';
import { t } from '../text';
import type { RouteDef, ScreenProps } from './routes';

const loaded = new Map<string, ComponentType<ScreenProps>>();

export function ScreenHost({ route, params }: { route: RouteDef; params: Record<string, string> }) {
  const [Screen, setScreen] = useState<ComponentType<ScreenProps> | null>(() => loaded.get(route.id) ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    const cached = loaded.get(route.id);
    if (cached) {
      setScreen(() => cached);
      return;
    }
    let alive = true;
    setScreen(null);
    route
      .load()
      .then((m) => {
        loaded.set(route.id, m.default);
        if (alive) setScreen(() => m.default);
      })
      .catch((e: unknown) => {
        if (alive) setFailed(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [route]);
  if (failed) return <CrashPanel message={failed} />;
  if (!Screen) {
    return (
      <div class="page" aria-busy="true">
        <div class="skeleton" style={{ height: '2.5rem', width: '18rem', marginBottom: '1.25rem' }} />
        <div class="skeleton" style={{ height: '12rem' }} />
      </div>
    );
  }
  return (
    <ErrorBoundary key={route.id}>
      <Screen params={params} />
    </ErrorBoundary>
  );
}

interface BoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ComponentChildren; onDump?: () => void }, BoundaryState> {
  override state: BoundaryState = { error: null };

  static override getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown): void {
    console.error('Screen crashed', error);
  }

  override render() {
    if (this.state.error) return <CrashPanel message={this.state.error.message} onDump={this.props.onDump} />;
    return this.props.children;
  }
}

export function CrashPanel({ message, onDump }: { message: string; onDump?: () => void }) {
  return (
    <div class="page" data-testid="crash">
      <section class="panel">
        <Empty
          icon="warning"
          title={t('crash.title')}
          text={t('crash.text')}
          actions={
            <>
              <a class="btn btn--primary" href="#/home">
                <Icon name="home" />
                {t('crash.home')}
              </a>
              {onDump && (
                <button class="btn" type="button" onClick={onDump}>
                  <Icon name="save" />
                  {t('crash.dump')}
                </button>
              )}
            </>
          }
        />
        <div class="panel__body">
          <pre class="well u-mono u-xs" style={{ whiteSpace: 'pre-wrap' }}>
            {message}
          </pre>
        </div>
      </section>
    </div>
  );
}

/** Blocking screen while content is invalid (05 §4: no partial load, no fallback content). */
export function ContentErrorScreen({ issues }: { issues: readonly ContentIssue[] }) {
  const errors = issues.filter((i) => i.severity === 'error');
  return (
    <main class="page" data-testid="content-error">
      <header class="page-header">
        <div class="page-header__text">
          <span class="page-header__eyebrow">{t('app.title')}</span>
          <h1 class="page-header__title">{t('contentError.title')}</h1>
          <div class="page-header__meta">{t('contentError.count', { n: errors.length })}</div>
        </div>
      </header>
      <div class="l-stack">
        <Callout kind="bad" title={t('contentError.title')}>
          {t('contentError.text')}
        </Callout>
        <section class="panel">
          <div class="panel__body">
            <pre class="well u-mono u-xs" style={{ whiteSpace: 'pre-wrap', maxHeight: '70vh', overflow: 'auto' }}>
              {formatContentIssues(issues)}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
