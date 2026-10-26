import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installShortcuts } from '../app/shortcuts';
import { resetToasts } from '../components';
import { TicketDialog, fixClone } from './tool';

const draft = {
  careerKey: 'seed-a',
  numbers: { run: 4, ticket: 12 },
  server: true,
  at: new Date(2026, 9, 25, 19, 34, 12),
  screenshot: 'data:image/png;base64,AAAA',
  meta: { screen: 'squad' },
  state: '{}',
};

let uninstall: (() => void) | null = null;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));
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
  it('focuses the text, keeps Shift+Enter as a new line and files on Enter', async () => {
    const done = vi.fn();
    render(<TicketDialog draft={draft} onDone={done} />);
    const field = screen.getByTestId('ticket-text') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(field);
    expect(screen.getByTestId('ticket-id').textContent).toBe('AL-R004-T012_20261025-193412');
    fireEvent.input(field, { target: { value: 'Captain vanished' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(done).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith({ id: 'AL-R004-T012_20261025-193412', where: 'server' }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ id: 'AL-R004-T012_20261025-193412', run: 4, ticket: 12, text: 'Captain vanished', careerKey: 'seed-a' });
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
});

describe('screenshot clone fixes', () => {
  it('keeps the chosen <select> option, gives fill cells their 100% back and colours placeholders', () => {
    const root = document.createElement('div');
    root.innerHTML = `<select data-ticket-sel="2"><option>Balanced</option><option>Body</option><option>Mind</option></select>
      <table><tr><td style="width: 275px; max-width: 0px">Name</td><td style="width: 54px">48</td></tr></table>`;
    fixClone(root, '#65615a');
    const options = root.querySelectorAll('option');
    expect([...options].map((o) => o.hasAttribute('selected'))).toEqual([false, false, true]);
    expect(root.querySelector('select')!.hasAttribute('data-ticket-sel')).toBe(false);
    const [fill, num] = root.querySelectorAll('td');
    expect(fill!.style.width).toBe('100%');
    expect(num!.style.width).toBe('54px');
    expect(root.querySelector('style')!.textContent).toBe('::placeholder{color:#65615a;-webkit-text-fill-color:#65615a}');
  });
});
