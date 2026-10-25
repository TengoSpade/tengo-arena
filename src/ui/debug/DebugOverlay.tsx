/**
 * Debug overlay (05 §8 diagnostics): backtick or ?debug=1. Season / week /
 * phase, root seed, content id and hash, versions, last advance time, state
 * size, the last 20 commands, the last error; state dump download. Dev
 * builds also offer the dev world and the component gallery. Seeds and
 * hashes are developer-only (P-05): never shown elsewhere.
 */
import { STATE_SCHEMA_VERSION } from '../../core/model';
import { ENGINE_VERSION } from '../../core/sim';
import { Icon } from '../components';
import type { AppStore } from '../store';
import { errorText } from '../store/messages';
import { t } from '../text';
import './debug.css';

export function DebugOverlay({ store, onClose }: { store: AppStore; onClose: () => void }) {
  const g = store.game.value;
  const c = store.content.value;
  const size = g ? Math.round(JSON.stringify(g).length / 1024) : 0;
  const err = store.lastError.value;
  const loadDevWorld = async () => {
    if (!import.meta.env.DEV || !c) return;
    const { buildDevWorld } = await import('./dev-world');
    const club = c.clubs.list.find((x) => x.startTierLevel === c.leagues.tiers.length) ?? c.clubs.list[0]!;
    store.replaceWorld(buildDevWorld(c, { playerClubId: club.id, weekIndex: 11 }));
    location.hash = '#/home';
  };
  return (
    <aside class="panel debug-overlay" aria-label={t('debug.title')} data-testid="debug-overlay">
      <header class="panel__header">
        <h2 class="panel__title">
          <Icon name="bolt" />
          {t('debug.title')}
        </h2>
        <div class="panel__actions">
          <button class="icon-btn" type="button" aria-label={t('common.close')} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div class="panel__body panel__body--tight l-stack l-stack--sm">
        <dl class="kv">
          <div>
            <dt>Season / week / phase</dt>
            <dd>{g ? `${g.calendar.season} / ${g.calendar.weekId ?? g.calendar.weekIndex} / ${g.calendar.phase}` : '—'}</dd>
          </div>
          <div>
            <dt>Root seed</dt>
            <dd class="u-mono">{g?.rng.root ?? '—'}</dd>
          </div>
          <div>
            <dt>Content</dt>
            <dd class="u-mono">{c ? `${c.ref.id} · ${c.ref.hash.slice(0, 10)}` : '—'}</dd>
          </div>
          <div>
            <dt>Engine / schema / game</dt>
            <dd>
              {ENGINE_VERSION} / {STATE_SCHEMA_VERSION} / {store.platform.gameVersion}
            </dd>
          </div>
          <div>
            <dt>Last advance</dt>
            <dd>{store.lastAdvanceMs.value === null ? '—' : `${store.lastAdvanceMs.value} ms`}</dd>
          </div>
          <div>
            <dt>State size</dt>
            <dd>{size} KB</dd>
          </div>
          <div>
            <dt>Last error</dt>
            <dd class="debug-overlay__wrap">{err ? `${err.code}: ${errorText(err)}` : '—'}</dd>
          </div>
        </dl>
        <div>
          <div class="panel-section__title">Last commands</div>
          <ol class="debug-overlay__log u-mono u-xs">
            {store.recentCommands.value.length === 0 ? <li class="u-faint">—</li> : null}
            {store.recentCommands.value.map((e) => (
              <li key={e.seq}>
                #{e.seq} S{e.season}W{e.weekIndex} {e.command.type}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <footer class="panel__footer">
        <button class="btn btn--sm" type="button" onClick={() => store.dumpState()} disabled={!g}>
          <Icon name="save" />
          State dump
        </button>
        {import.meta.env.DEV && (
          <>
            <button class="btn btn--sm" type="button" onClick={() => void loadDevWorld()} title={t('debug.devWorldTip')}>
              <Icon name="refresh" />
              {t('debug.devWorld')}
            </button>
            <a class="btn btn--sm btn--ghost" href="#/dev/components">
              Gallery
            </a>
          </>
        )}
      </footer>
    </aside>
  );
}
