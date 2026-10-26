/**
 * Settings › Tickets: the playtest ticket tool (F8). Dev builds write tickets to the project's
 * tickets/ folder (the dev-server plugin) and link its index; other builds keep them in this
 * browser (IndexedDB: listed from small summaries, deleted one by one, exported as one JSON file
 * built ticket by ticket). "Playtest tools" hides the tool in non-dev builds (default on for now).
 */
import { useEffect, useState } from 'preact/hooks';
import { createLocalTicketStore, idbTicketKv, type TicketSummary } from '../../../platform/tickets/local-store';
import { ticketShort } from '../../../platform/tickets/naming';
import { Icon, Kbd, Panel, showToast } from '../../components';
import { settings, updateSettings } from '../../store';
import { t } from './text';

export function TicketsPanel() {
  const dev = import.meta.env.DEV;
  const [list, setList] = useState<TicketSummary[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [info, setInfo] = useState<{ dir: string; md: string } | null>(null);
  const [store] = useState(() => createLocalTicketStore(idbTicketKv()));

  const refresh = () =>
    store.list().then(setList, () => {
      setUnavailable(true);
      setList([]);
    });
  useEffect(() => {
    void refresh();
  }, [store]);
  useEffect(() => {
    if (!dev) return;
    void fetch('/__tickets/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((v: { dir: string; md: string } | null) => setInfo(v))
      .catch(() => setInfo(null));
  }, [dev]);

  const exportAll = async () => {
    if (!list?.length) return;
    const url = URL.createObjectURL(new Blob(await store.exportParts(), { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `arena-league-tickets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast({ title: t('tickets.exported', { n: list.length }), kind: 'good' });
  };
  const remove = async (id: string) => {
    await store.remove(id);
    showToast({ title: t('tickets.deleted', { id: ticketShort(id) }), kind: 'accent' });
    await refresh();
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
        {unavailable ? (
          <p class="u-sm u-warn" role="status" data-testid="tickets-unavailable">
            {t('tickets.unavailable')}
          </p>
        ) : (
          <div class="l-row">
            <span class="u-sm u-muted">{list === null ? t('tickets.loading') : t('tickets.local', { n: list.length })}</span>
            <button class="btn btn--sm l-push" type="button" onClick={() => void exportAll()} aria-disabled={!list?.length ? 'true' : undefined} data-testid="tickets-export">
              <Icon name="load" />
              {t('tickets.export')}
            </button>
          </div>
        )}
        {list && list.length > 0 && (
          <ul class="checklist" role="list" data-testid="tickets-list">
            {list.slice(0, 20).map((x) => (
              <li key={x.id} class="l-row">
                <span>
                  <span class="u-num">{x.id}</span> · {x.screen} · {x.firstLine || '—'}
                </span>
                <button class="btn btn--sm btn--ghost l-push" type="button" data-tip={t('tickets.deleteTip', { id: x.id })} onClick={() => void remove(x.id)} data-testid={`ticket-delete-${x.id}`}>
                  <Icon name="close" label={t('tickets.delete')} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
