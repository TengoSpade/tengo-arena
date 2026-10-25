/**
 * ui-save · Save / Load (04 §6.3, not mocked; R7 with the open-016 working
 * assumption): manual slots and rotating autosaves, Save (Ctrl S), Save as,
 * Load (commit dialog; warning when there is unsaved progress), Overwrite,
 * Export, Import and Delete. Every failure states what happened and that
 * nothing was changed (02 §3, 05 §5).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ScreenProps } from '../../app/routes';
import { saveAsRequested } from '../../app/save-intent';
import { useShortcuts } from '../../app/shortcuts';
import { STATE_SCHEMA_VERSION, type SaveError, type SaveMeta } from '../../../core/model';
import { ConfirmButton, DataTable, Icon, Modal, PageHeader, Panel, showToast, type Column } from '../../components';
import { formatDateTime, formatPlaytime } from '../../format';
import { AUTOSAVE_SLOTS, MANUAL_SLOT_IDS, isAutosaveSlot, settings, type AppStore, type GameStore } from '../../store';
import { go, useOptionalStore } from '../league/lib/store';
import { Callout, Empty } from '../league/lib/ui';
import { t } from './text';
import './saves.css';

export default function SavesScreen(_props: ScreenProps) {
  const store = useOptionalStore();
  if (!store) {
    return (
      <section class="page" data-testid="screen-saves">
        <PageHeader eyebrow={t('eyebrow')} title={t('title')} />
      </section>
    );
  }
  return <Saves store={store} />;
}

function slotName(slotId: string): string {
  const n = slotId.replace(/^\D+-/, '');
  return isAutosaveSlot(slotId) ? t('autoSlot', { n }) : t('slot', { n });
}

/** Player-facing text for every SaveError code (05 §3.3), with the version when known. */
export function saveErrorLines(error: SaveError, kind: 'load' | 'save'): { title: string; lines: string[] } {
  const known = `error.code.${error.code}` as const;
  const title = `${t(known)} ${kind === 'load' ? t('error.cannotLoad') : t('error.cannotSave')}`;
  const lines: string[] = [];
  const d = (error.details ?? {}) as Record<string, unknown>;
  const saveVersion = d['schemaVersion'] ?? d['saveVersion'] ?? d['version'];
  if (saveVersion !== undefined) lines.push(t('error.version', { save: String(saveVersion), game: STATE_SCHEMA_VERSION }));
  if (error.message) lines.push(t('error.details', { message: error.message }));
  return { title, lines };
}

function Saves({ store }: { store: GameStore }) {
  const app = store as Partial<AppStore> & GameStore;
  const [list, setList] = useState<SaveMeta[] | null>(null);
  const [error, setError] = useState<{ error: SaveError; kind: 'load' | 'save' } | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const game = store.game.value;
  const busy = store.busy.value;
  const current = app.currentSlot?.value ?? null;
  const dirty = app.dirty?.value ?? true;

  const refresh = async () => setList(await store.listSaves());
  useEffect(() => {
    void refresh();
  }, [store]);

  const manual = (list ?? []).filter((m) => !isAutosaveSlot(m.slotId)).sort((a, b) => MANUAL_SLOT_IDS.indexOf(a.slotId) - MANUAL_SLOT_IDS.indexOf(b.slotId));
  const autos = (list ?? []).filter((m) => isAutosaveSlot(m.slotId)).sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  const freeSlot = MANUAL_SLOT_IDS.find((id) => !manual.some((m) => m.slotId === id)) ?? null;
  // Save (and Ctrl S) writes only to this career's own manual slot; otherwise Save as asks for one.
  const target = current && !isAutosaveSlot(current) ? current : null;
  useEffect(() => {
    if (saveAsRequested.value) {
      saveAsRequested.value = false;
      if (game?.playerClubId) setSaveAsOpen(true);
    }
  }, []);

  const doSave = async (slotId: string, label?: string) => {
    setError(null);
    const r = await store.save(slotId, label);
    if (!r.ok) setError({ error: r.error, kind: 'save' });
    else showToast({ kind: 'good', title: t('toast.saved', { slot: slotName(slotId) }), sub: r.value.label });
    await refresh();
  };
  const doLoad = async (meta: SaveMeta) => {
    setError(null);
    const r = await store.load(meta.slotId);
    if (!r.ok) {
      setError({ error: r.error, kind: 'load' });
      return;
    }
    showToast({ kind: 'good', title: t('toast.loaded', { label: meta.label }) });
    go('home');
  };
  const doDelete = async (meta: SaveMeta) => {
    setError(null);
    const r = await store.deleteSave(meta.slotId);
    if (!r.ok) setError({ error: r.error, kind: 'save' });
    else showToast({ kind: 'accent', title: t('toast.deleted', { label: meta.label }) });
    await refresh();
  };
  const doExport = async (meta: SaveMeta) => {
    const r = await store.exportSave(meta.slotId);
    if (!r.ok) setError({ error: r.error, kind: 'load' });
    else showToast({ kind: 'good', title: t('toast.exported', { label: meta.label }) });
  };
  const doImport = async (file: File) => {
    setError(null);
    const r = await store.importSave(file);
    if (!r.ok) setError({ error: r.error, kind: 'load' });
    else showToast({ kind: 'good', title: t('toast.imported', { slot: slotName(r.value.slotId) }), sub: r.value.label });
    await refresh();
  };

  // Ctrl S on this screen saves too (the frame also maps it globally).
  useShortcuts({ 'ctrl+s': () => (game && !busy ? (target ? void doSave(target) : setSaveAsOpen(true)) : false) });

  const saveBlocked = !game ? t('noCareer') : busy ? t('busy') : null;
  const columns = (auto: boolean): Column<SaveMeta>[] => [
    {
      id: 'name',
      header: t('col.name'),
      fill: true,
      sortValue: (m) => m.label,
      firstDir: 'asc',
      cell: (m) => (
        <span class="entity saves-name">
          <span class="entity__stack">
            <span class="entity__name">{auto ? slotName(m.slotId) : m.label}</span>
            <span class="entity__sub">{auto ? (/^autosave$/i.test(m.label) ? m.playerClubName : m.label) : slotName(m.slotId)}</span>
          </span>
          {m.slotId === current && <span class="tag tag--accent">{t('current')}</span>}
        </span>
      ),
    },
    { id: 'club', header: t('col.club'), class: 'col-mid', sortValue: (m) => m.playerClubName ?? '', cell: (m) => m.playerClubName ?? '—' },
    {
      id: 'when',
      header: t('col.when'),
      sortValue: (m) => m.season * 100 + m.weekIndex,
      cell: (m) => t('when', { season: m.season, week: m.weekId ?? t('seasonEnd') }),
    },
    { id: 'saved', header: t('col.saved'), sortValue: (m) => m.savedAt, cell: (m) => <span class="u-muted">{formatDateTime(m.savedAt)}</span> },
    { id: 'playtime', header: t('col.playtime'), align: 'num', class: 'col-mid', sortValue: (m) => m.playtimeSec, cell: (m) => formatPlaytime(m.playtimeSec) },
    { id: 'version', header: t('col.version'), class: 'col-wide', cell: (m) => <span class="u-faint">{m.gameVersion}</span> },
    {
      id: 'actions',
      header: <span class="u-sr-only">{t('col.actions')}</span>,
      class: 'cell-tight',
      cell: (m) => {
        const consequences = [
          { label: t('c.club'), value: m.playerClubName ?? '—' },
          { label: t('c.when'), value: t('when', { season: m.season, week: m.weekId ?? t('seasonEnd') }) },
          { label: t('c.saved'), value: formatDateTime(m.savedAt) },
        ];
        return (
          <span class="l-row saves-actions">
            <ConfirmButton
              size="sm"
              title={t('loadTitle', { label: m.label })}
              confirmLabel={t('loadConfirm')}
              description={dirty && game ? undefined : t('loadClean')}
              warning={dirty && game ? t('loadDirty') : undefined}
              consequences={consequences}
              onConfirm={() => doLoad(m)}
              disabled={busy}
              disabledReason={t('busy')}
              testId={`load-${m.slotId}`}
            >
              {t('load')}
            </ConfirmButton>
            {!auto && (
              <ConfirmButton
                size="sm"
                variant="ghost"
                title={t('overwriteTitle', { label: m.label })}
                confirmLabel={t('overwriteConfirm')}
                warning={t('overwriteWarn')}
                consequences={consequences}
                onConfirm={() => doSave(m.slotId)}
                disabled={Boolean(saveBlocked)}
                disabledReason={saveBlocked ?? undefined}
                testId={`overwrite-${m.slotId}`}
              >
                {t('overwrite')}
              </ConfirmButton>
            )}
            <button class="btn btn--sm btn--ghost" type="button" data-tip={t('exportTip')} onClick={() => void doExport(m)} data-testid={`export-${m.slotId}`}>
              {t('export')}
            </button>
            <ConfirmButton
              size="sm"
              variant="ghost"
              title={t('deleteTitle', { label: m.label })}
              confirmLabel={t('deleteConfirm')}
              confirmVariant="danger"
              warning={t('deleteWarn')}
              consequences={consequences}
              onConfirm={() => doDelete(m)}
              disabled={busy}
              disabledReason={t('busy')}
              testId={`delete-${m.slotId}`}
            >
              <Icon name="close" label={t('delete')} />
            </ConfirmButton>
          </span>
        );
      },
    },
  ];

  const lines = error ? saveErrorLines(error.error, error.kind) : null;
  return (
    <section class="page" data-testid="screen-saves">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        meta={[t('meta.manual', { used: manual.length, max: MANUAL_SLOT_IDS.length }), settings.value.autosave ? t('meta.auto', { n: AUTOSAVE_SLOTS.length }) : t('meta.autoOff')]}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              class="u-sr-only"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="import-input"
              onChange={(e) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                if (file) void doImport(file);
                input.value = '';
              }}
            />
            <button class="btn" type="button" data-tip={t('importTip')} onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="load" />
              {t('import')}
            </button>
            <button class="btn" type="button" onClick={() => setSaveAsOpen(true)} aria-disabled={saveBlocked ? 'true' : undefined} data-tip={saveBlocked ?? undefined}>
              {t('saveAs')}
            </button>
            <button
              class="btn btn--primary"
              type="button"
              aria-disabled={saveBlocked || !target ? 'true' : undefined}
              data-tip={saveBlocked ?? (target ? t('saveTip', { slot: slotName(target) }) : freeSlot ? t('saveTipChoose') : t('saveAs.full'))}
              onClick={() => {
                if (!saveBlocked && target) void doSave(target);
                else if (!saveBlocked) setSaveAsOpen(true);
              }}
              data-testid="save-button"
            >
              <Icon name="save" />
              {t('save')} <kbd>Ctrl S</kbd>
            </button>
          </>
        }
      />
      {lines && (
        <div class="saves-error" data-testid="save-error" data-code={error!.error.code}>
          <Callout kind="bad" title={lines.title}>
            {lines.lines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </Callout>
        </div>
      )}
      <div class="l-stack">
        <Panel title={t('manual.title')} icon="save" subtitle={t('manual.subtitle', { used: manual.length, max: MANUAL_SLOT_IDS.length })} body="flush" testId="saves-manual">
          <DataTable
            label={t('manual.title')}
            columns={columns(false)}
            rows={manual}
            rowKey={(m) => m.slotId}
            variant={[]}
            rowClass={(m) => (m.slotId === current ? 'is-us' : undefined)}
            testId="manual-table"
            empty={<Empty compact icon="save" title={t('manual.empty')} text={t('manual.emptyText', { max: MANUAL_SLOT_IDS.length })} />}
          />
        </Panel>
        <Panel title={t('auto.title')} icon="refresh" subtitle={t('auto.subtitle')} body="flush" testId="saves-auto">
          <DataTable
            label={t('auto.title')}
            columns={columns(true)}
            rows={autos}
            rowKey={(m) => m.slotId}
            variant={[]}
            empty={<Empty compact icon="refresh" title={t('auto.empty')} text={t('auto.emptyText')} />}
          />
        </Panel>
      </div>
      <SaveAsDialog
        open={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
        manual={manual}
        freeSlot={freeSlot}
        defaultLabel={app.defaultSaveLabel?.() ?? ''}
        onSave={async (slotId, label) => {
          setSaveAsOpen(false);
          await doSave(slotId, label);
        }}
        disabled={Boolean(saveBlocked)}
      />
    </section>
  );
}

function SaveAsDialog({
  open,
  onClose,
  manual,
  freeSlot,
  defaultLabel,
  onSave,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  manual: SaveMeta[];
  freeSlot: string | null;
  defaultLabel: string;
  onSave: (slotId: string, label: string) => void;
  disabled: boolean;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const [slot, setSlot] = useState<string>(freeSlot ?? manual[0]?.slotId ?? MANUAL_SLOT_IDS[0]!);
  useEffect(() => {
    if (open) {
      setLabel(defaultLabel);
      setSlot(freeSlot ?? manual[0]?.slotId ?? MANUAL_SLOT_IDS[0]!);
    }
  }, [open]);
  const overwriting = manual.some((m) => m.slotId === slot);
  const submit = () => {
    if (!disabled && label.trim()) onSave(slot, label.trim());
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="narrow"
      icon="save"
      title={t('saveAs.title')}
      onEnter={submit}
      testId="save-as-dialog"
      footer={
        <>
          <button type="button" class="btn btn--ghost" onClick={onClose}>
            {t('cancel')} <kbd>Esc</kbd>
          </button>
          <button type="button" class="btn btn--primary" onClick={submit} disabled={disabled || !label.trim()}>
            {overwriting ? t('overwrite') : t('saveAs.save')} <kbd>Enter</kbd>
          </button>
        </>
      }
    >
      <div class="l-stack">
        <div class="field">
          <label class="field__label" for="save-as-name">
            {t('saveAs.name')}
          </label>
          <input id="save-as-name" class="input" value={label} data-autofocus maxLength={60} onInput={(e) => setLabel((e.target as HTMLInputElement).value)} />
        </div>
        <div class="field">
          <label class="field__label" for="save-as-slot">
            {t('saveAs.slot')}
          </label>
          <span class="select-wrap">
            <select id="save-as-slot" class="select" value={slot} onChange={(e) => setSlot((e.target as HTMLSelectElement).value)}>
              {MANUAL_SLOT_IDS.map((id) => {
                const m = manual.find((x) => x.slotId === id);
                return (
                  <option key={id} value={id}>
                    {slotName(id)} · {m ? m.label : '—'}
                  </option>
                );
              })}
            </select>
          </span>
          {!freeSlot && <span class="field__hint">{t('saveAs.full')}</span>}
        </div>
        {overwriting && <Callout kind="warn" title={t('overwriteWarn')} />}
      </div>
    </Modal>
  );
}
