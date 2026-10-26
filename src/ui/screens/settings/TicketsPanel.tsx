/**
 * Settings › Tickets: the playtest ticket tool (F8). Dev builds write tickets to the project's
 * tickets/ folder (the dev-server plugin) and link its index; other builds keep them in this
 * browser (IndexedDB) and export them all as one JSON file. "Playtest tools" hides the tool in
 * non-dev builds (default on for now).
 */
import { useEffect, useState } from 'preact/hooks';
import { createLocalTicketStore, idbTicketKv, type TicketSummary } from '../../../platform/tickets/local-store';
import { Icon, Kbd, Panel, showToast } from '../../components';
import { settings, updateSettings } from '../../store';
import { t } from './text';

export function TicketsPanel() {
  const dev = import.meta.env.DEV;
  const [list, setList] = useState<TicketSummary[] | null>(null);
  const [info, setInfo] = useState<{ dir: string; md: string } | null>(null);
  const store = useLocalStore();

  useEffect(() => {
    if (!store) return;
    void store.list().then(setList, () => setList([]));
  }, [store]);
  useEffect(() => {
    if (!dev) return;
    void fetch('/__tickets/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((v: { dir: string; md: string } | null) => setInfo(v))
      .catch(() => setInfo(null));
  }, [dev]);

  const exportAll = async () => {
    if (!store) return;
    const json = await store.exportAll();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `arena-league-tickets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast({ title: t('tickets.exported', { n: list?.length ?? 0 }), kind: 'good' });
  };

  return (
    <Panel title={t('tickets.title')} icon="bug" subtitle={t('tickets.subtitle')} class="span-12" testId="settings-tickets">
      <div class="l-stack">
        {dev ? (
          <p class="u-sm">
            {t('tickets.devText')} <Kbd>F8</Kbd>
            {info && (
              <>
                {' '}
                {t('tickets.devFolder')} <code class="u-num">{info.dir}</code> ·{' '}
                <a href="/__tickets/tickets.md" target="_blank" rel="noreferrer">
                  {t('tickets.devIndex')}
                </a>
              </>
            )}
          </p>
        ) : (
          <label class="l-row u-sm">
            <input
              class="switch"
              type="checkbox"
              role="switch"
              checked={settings.value.playtestTools}
              onChange={(e) => updateSettings({ playtestTools: (e.target as HTMLInputElement).checked })}
              data-testid="playtest-tools"
            />
            <span class="l-stack l-stack--xs">
              <span class="u-strong">{t('tickets.toggle')}</span>
              <span class="u-xs u-muted">{t('tickets.toggleText')}</span>
            </span>
          </label>
        )}
        <div class="l-row">
          <span class="u-sm u-muted">{list === null ? t('tickets.loading') : t('tickets.local', { n: list.length })}</span>
          <button class="btn btn--sm l-push" type="button" onClick={() => void exportAll()} aria-disabled={!list?.length ? 'true' : undefined} data-testid="tickets-export">
            <Icon name="load" />
            {t('tickets.export')}
          </button>
        </div>
        {list && list.length > 0 && (
          <ul class="checklist" role="list" data-testid="tickets-list">
            {list.slice(0, 20).map((x) => (
              <li key={x.id}>
                <span class="u-num">{x.id}</span> · {x.screen} · {x.firstLine || '—'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function useLocalStore() {
  const [store] = useState(() => (typeof indexedDB === 'undefined' ? null : createLocalTicketStore(idbTicketKv())));
  return store;
}
