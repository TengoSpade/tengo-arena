import { CONTENT_FILE_NAMES } from '../../core/content';
import { STATE_SCHEMA_VERSION } from '../../core/model';
import { Rng } from '../../core/rng';
import { ENGINE_VERSION } from '../../core/sim';
import type { ThemeFiles } from '../../platform/content-loader';
import { t } from '../text';

export interface AppProps {
  content: ThemeFiles;
}

/** Same seed twice must give the same numbers; shown so testers can spot a broken build at a glance. */
function rngSelfCheck(): boolean {
  const a = Rng.create('shell-self-check', 'ui');
  const b = Rng.create('shell-self-check', 'ui');
  for (let i = 0; i < 8; i++) if (a.nextU32() !== b.nextU32()) return false;
  return true;
}

/**
 * Phase A app shell: proves the toolchain, the designer's CSS and the core
 * imports work in the browser. Replaced by the real app frame (topbar,
 * sidenav, router) in M1.
 */
export function App({ content }: AppProps) {
  const rngOk = rngSelfCheck();
  return (
    <main class="page" data-testid="app-shell">
      <header class="page-header">
        <div class="page-header__text">
          <div class="page-header__eyebrow">{t('shell.eyebrow')}</div>
          <h1 class="page-header__title">{t('app.title')}</h1>
          <div class="page-header__meta">{t('shell.subtitle')}</div>
        </div>
      </header>

      <div class="shell-grid">
        <section class="panel" aria-labelledby="shell-content-title">
          <div class="panel__header">
            <h2 class="panel__title" id="shell-content-title">
              {t('shell.content.title')} ({content.found.length}/{CONTENT_FILE_NAMES.length})
            </h2>
          </div>
          <div class="panel__body">
            <dl class="kv" data-testid="content-files">
              {CONTENT_FILE_NAMES.map((name) => {
                const found = content.found.includes(name);
                return (
                  <div key={name}>
                    <dt>{name}.json</dt>
                    <dd>
                      <span class={found ? 'tag tag--good' : 'tag tag--warn'}>
                        {found ? t('shell.content.found') : t('shell.content.missing')}
                      </span>
                    </dd>
                  </div>
                );
              })}
              {content.extra.length > 0 && (
                <div>
                  <dt>{t('shell.content.extra')}</dt>
                  <dd>{content.extra.join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        <section class="panel" aria-labelledby="shell-build-title">
          <div class="panel__header">
            <h2 class="panel__title" id="shell-build-title">
              {t('shell.build.title')}
            </h2>
          </div>
          <div class="panel__body">
            <dl class="kv">
              <div>
                <dt>{t('shell.build.theme')}</dt>
                <dd>{content.themeId}</dd>
              </div>
              <div>
                <dt>{t('shell.build.engine')}</dt>
                <dd>{ENGINE_VERSION}</dd>
              </div>
              <div>
                <dt>{t('shell.build.schema')}</dt>
                <dd>{STATE_SCHEMA_VERSION}</dd>
              </div>
              <div>
                <dt>{t('shell.build.rng')}</dt>
                <dd>
                  <span class={rngOk ? 'tag tag--good' : 'tag tag--bad'} data-testid="rng-check">
                    {rngOk ? t('shell.build.rng.ok') : t('shell.build.rng.fail')}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
