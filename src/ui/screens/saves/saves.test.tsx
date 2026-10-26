import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../core/testkit';
import type { SaveError, SaveErrorCode, SaveMeta, WeekId, ClubId } from '../../../core/model';
import { resetToasts, toasts } from '../../components';
import { createFakeStore, type FakeStoreOptions } from '../league/testing/fake-store';
import { Providers } from '../league/testing/providers';
import { saveErrorLines } from './index';
import SavesScreen from './index';

afterEach(cleanup);
beforeEach(() => resetToasts());

function meta(slotId: string, over: Partial<SaveMeta> = {}): SaveMeta {
  return {
    slotId,
    kind: slotId.startsWith('auto') ? 'auto' : 'manual',
    label: `Save ${slotId}`,
    savedAt: '2026-10-24T19:02:00.000Z',
    gameVersion: '0.1.0',
    season: 2,
    weekIndex: 11,
    weekId: 'MW7' as WeekId,
    phase: 'regular',
    playerClubId: 'varrow-lanternguard' as ClubId,
    playerClubName: 'Varrow Lanternguard',
    playtimeSec: 5400,
    ...over,
  };
}

const SAVES = [meta('manual-1'), meta('manual-2', { label: 'Before the derby' }), meta('auto-1', { savedAt: '2026-10-25T07:40:00.000Z' }), meta('auto-2')];

function renderSaves(extra: Partial<FakeStoreOptions> = {}, withGame = true) {
  const content = fixtureContent();
  const store = createFakeStore({ game: withGame ? buildFixtureWorld() : null, content, saves: SAVES, ...extra });
  render(
    <Providers store={store}>
      <SavesScreen params={{}} />
    </Providers>,
  );
  return store;
}

const CODES: SaveErrorCode[] = ['save.json', 'save.format', 'save.too-new', 'save.checksum', 'save.migration', 'save.structure', 'save.references', 'save.content-missing', 'save.storage'];

describe('Saves screen', () => {
  it('lists manual saves and autosaves (newest first)', async () => {
    renderSaves();
    const manual = await screen.findByTestId('saves-manual');
    await waitFor(() => expect(within(manual).getAllByRole('row').slice(1)).toHaveLength(2));
    const autos = within(screen.getByTestId('saves-auto')).getAllByRole('row').slice(1);
    expect(autos).toHaveLength(2);
    expect(autos[0]!.textContent).toContain('Autosave 1');
  });

  it('lists ticket reproductions apart: not counted as manual slots, deletable', async () => {
    const ticket = meta('ticket-AL-R001-T001_20261025-193412', { label: 'Ticket AL-R001-T001_20261025-193412' });
    const store = renderSaves({ saves: [...SAVES, ticket] });
    const tickets = await screen.findByTestId('saves-tickets');
    expect(within(tickets).getAllByRole('row').slice(1)).toHaveLength(1);
    expect(within(screen.getByTestId('saves-manual')).getAllByRole('row').slice(1)).toHaveLength(2);
    expect(screen.getByTestId('saves-manual').textContent).toContain('2 of 10 slots');
    // No overwrite for a reproduction; delete removes it.
    expect(within(tickets).queryByTestId(`overwrite-${ticket.slotId}`)).toBeNull();
    fireEvent.click(within(tickets).getByTestId(`delete-${ticket.slotId}`));
    fireEvent.click(await screen.findByTestId(`delete-${ticket.slotId}-confirm`));
    await waitFor(() => expect(store.calls.some((c) => c.method === 'deleteSave' && c.args[0] === ticket.slotId)).toBe(true));
  });

  it('asks for a slot (Save as, first free slot preselected) when the career has none, then saves there', async () => {
    const store = renderSaves();
    await screen.findByText('Before the derby');
    fireEvent.click(screen.getByTestId('save-button'));
    const dialog = await screen.findByTestId('save-as-dialog');
    expect(store.calls.some((c) => c.method === 'save')).toBe(false);
    fireEvent.input(within(dialog).getByRole('textbox'), { target: { value: 'Before the final' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(store.calls.some((c) => c.method === 'save' && c.args[0] === 'manual-3')).toBe(true));
    await waitFor(() => expect(toasts.value.at(-1)?.title).toBe('Saved to Slot 3'));
  });

  it('loads a save after the commit dialog', async () => {
    const store = renderSaves();
    await screen.findByText('Before the derby');
    fireEvent.click(screen.getByTestId('load-manual-2'));
    const dialog = await screen.findByTestId('load-manual-2-dialog');
    expect(dialog.textContent).toContain('Progress since your last save is lost');
    fireEvent.click(screen.getByTestId('load-manual-2-confirm'));
    await waitFor(() => expect(store.calls.some((c) => c.method === 'load' && c.args[0] === 'manual-2')).toBe(true));
  });

  it.each(CODES)('explains a failed load with code %s and says nothing changed', async (code) => {
    const error: SaveError = { code, message: 'dev detail', details: code === 'save.too-new' ? { schemaVersion: 9 } : undefined };
    renderSaves({ loadError: error });
    await screen.findByText('Before the derby');
    fireEvent.click(screen.getByTestId('load-manual-1'));
    fireEvent.click(await screen.findByTestId('load-manual-1-confirm'));
    const box = await screen.findByTestId('save-error');
    expect(box.getAttribute('data-code')).toBe(code);
    expect(box.textContent).toContain('This save cannot be loaded; nothing was changed.');
    expect(box.textContent).toContain(saveErrorLines(error, 'load').title);
    if (code === 'save.too-new') expect(box.textContent).toContain('Save version 9');
  });

  it('deletes and exports a save', async () => {
    const store = renderSaves();
    await screen.findByText('Before the derby');
    fireEvent.click(screen.getByTestId('export-manual-1'));
    await waitFor(() => expect(store.calls.some((c) => c.method === 'exportSave')).toBe(true));
    fireEvent.click(screen.getByTestId('delete-manual-1'));
    fireEvent.click(await screen.findByTestId('delete-manual-1-confirm'));
    await waitFor(() => expect(store.calls.some((c) => c.method === 'deleteSave' && c.args[0] === 'manual-1')).toBe(true));
  });

  it('imports a save file and reports a broken one', async () => {
    const store = renderSaves({ loadError: { code: 'save.checksum', message: 'mismatch' } });
    await screen.findByText('Before the derby');
    const input = screen.getByTestId('import-input') as HTMLInputElement;
    const file = new File(['{}'], 'career.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(store.calls.some((c) => c.method === 'importSave')).toBe(true));
    expect((await screen.findByTestId('save-error')).textContent).toContain('checksum');
  });

  it('cannot save without a career, but can still load', async () => {
    renderSaves({}, false);
    await screen.findByText('Before the derby');
    const save = screen.getByTestId('save-button');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(save.getAttribute('data-tip')).toBe('Start or load a career first');
    expect(screen.getByTestId('load-manual-1').getAttribute('aria-disabled')).toBeNull();
  });
});
