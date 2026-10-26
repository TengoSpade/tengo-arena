import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installShortcuts } from '../app/shortcuts';
import { resetToasts, toasts } from '../components';
import { TicketDialog, fixClone, type Draft } from './tool';
import { T } from './tool-text';

const draft: Draft = {
  careerKey: 'c-career-a',
  preview: { run: 4, ticket: 12 },
  server: true,
  at: new Date(2026, 9, 25, 19, 34, 12),
  screenshot: 'data:image/png;base64,AAAA',
  meta: { screen: 'squad' },
  state: '{}',
};

let uninstall: (() => void) | null = null;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  // The server assigns the final number (here one more than the preview).
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'AL-R004-T013_20261025-193412', run: 4, ticket: 13 }), { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  resetToasts();
  uninstall?.();
  uninstall = null;
  vi.unstubAllGlobals();
});

describe('ticket dialog keyboard', () => {
  it('focuses the text, keeps Shift+Enter as a new line and files on Enter with the id the server assigns', async () => {
    const done = vi.fn();
    render(<TicketDialog draft={draft} onDone={done} />);
    const field = screen.getByTestId('ticket-text') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(field);
    expect(screen.getByTestId('ticket-id').textContent).toContain('AL-R004-T012');
    fireEvent.input(field, { target: { value: 'Captain vanished' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(done).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith({ id: 'AL-R004-T013_20261025-193412', where: 'server' }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
    // The client sends its timestamp, never numbers.
    expect(body).toMatchObject({ careerKey: 'c-career-a', stamp: '20261025-193412', text: 'Captain vanished' });
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('run');
  });

  it('asks once on an empty note, then files without one on the second Enter', async () => {
    const done = vi.fn();
    render(<TicketDialog draft={draft} onDone={done} />);
    const field = screen.getByTestId('ticket-text');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByTestId('ticket-empty').textContent).toBe('Add a note, or press Enter again to file without one.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({ text: '' });
  });

  it('cancels with Esc and never lets keys reach the game shortcuts', () => {
    const shortcut = vi.fn();
    uninstall = installShortcuts(() => ({ s: shortcut, Space: shortcut, '1': shortcut }));
    const done = vi.fn();
    render(<TicketDialog draft={draft} onDone={done} />);
    const field = screen.getByTestId('ticket-text');
    for (const key of ['s', ' ', '1']) fireEvent.keyDown(field, { key });
    expect(shortcut).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(done).toHaveBeenCalledWith(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an error toast when neither the server nor the browser can store the ticket', async () => {
    fetchMock.mockImplementation(async () => new Response('down', { status: 500 }));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const done = vi.fn();
    render(<TicketDialog draft={draft} onDone={done} />);
    fireEvent.input(screen.getByTestId('ticket-text'), { target: { value: 'x' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('ticket-text'), { key: 'Enter' });
    });
    // happy-dom has no IndexedDB: the fallback fails visibly.
    await vi.waitFor(() => expect(toasts.value.at(-1)?.title).toBe('Ticket not saved'));
    expect(toasts.value.at(-1)?.kind).toBe('bad');
    expect(screen.getByRole('alert').textContent).toContain('IndexedDB');
    expect(done).not.toHaveBeenCalled();
  });

  it('names the ticket in the toast by its short id', () => {
    expect(T.saved('AL-R001-T001_20261025-193412')).toBe('Ticket AL-R001-T001 saved');
  });
});

describe('screenshot clone fixes', () => {
  it('moves a scrolled full-page screen up by the document scroll, leaving fixed layers alone', () => {
    const root = document.createElement('div');
    root.innerHTML = '<main style="transform: scale(1)">page</main><div style="position: fixed">toasts</div>';
    fixClone(root, '#000', { x: 0, y: 600 });
    const [page, toasts] = [...root.children] as HTMLElement[];
    expect(page!.style.transform).toBe('translate(0px, -600px) scale(1)');
    expect(toasts!.style.transform).toBe('');
  });

  it('keeps the chosen <select> option and ticked boxes, puts stuck sticky elements back, fills cells and colours placeholders', () => {
    const root = document.createElement('div');
    root.innerHTML = `<select data-ticket-sel="2"><option>Balanced</option><option>Body</option><option>Mind</option></select>
      <table><tr><td style="width: 275px; max-width: 0px">Name</td><td style="width: 54px">48</td></tr></table>
      <input type="checkbox" data-ticket-checked><input type="checkbox">
      <aside data-ticket-stuck="0,1484" style="position: sticky; top: 16px">rail</aside>`;
    fixClone(root, '#65615a');
    const options = root.querySelectorAll('option');
    expect([...options].map((o) => o.hasAttribute('selected'))).toEqual([false, false, true]);
    expect(root.querySelector('select')!.hasAttribute('data-ticket-sel')).toBe(false);
    const [fill, num] = root.querySelectorAll('td');
    expect(fill!.style.width).toBe('100%');
    expect(num!.style.width).toBe('54px');
    const boxes = root.querySelectorAll('input');
    expect([boxes[0]!.hasAttribute('checked'), boxes[1]!.hasAttribute('checked')]).toEqual([true, false]);
    // A sticky element stuck while its column scrolled stays where it was on screen.
    const rail = root.querySelector('aside')!;
    expect([rail.style.position, rail.style.top, rail.style.left]).toEqual(['relative', '1484px', '0px']);
    expect(rail.hasAttribute('data-ticket-stuck')).toBe(false);
    expect(root.querySelector('style')!.textContent).toBe('::placeholder{color:#65615a;-webkit-text-fill-color:#65615a}');
  });
});
