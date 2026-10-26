import { describe, expect, it } from 'vitest';
import { createLocalTicketStore, type StoredTicket, type TicketKv } from './local-store';
import {
  TICKET_ID_RE,
  emptyTicketIndex,
  firstLine,
  isWindowsSafe,
  nextTicketNumber,
  noteTicket,
  parseTicketId,
  readTicketIndex,
  runForCareer,
  ticketId,
  ticketStamp,
  weekCode,
} from './naming';

describe('ticket id', () => {
  const at = new Date(2026, 9, 25, 19, 34, 12); // local time, month is 0-based

  it('follows AL-R{run:3}-T{ticket:3}_{YYYYMMDD-HHMMSS} in local time', () => {
    expect(ticketId(4, 12, at)).toBe('AL-R004-T012_20261025-193412');
    expect(ticketStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
  });

  it('pads to three digits and grows past 999 instead of wrapping', () => {
    expect(ticketId(1, 1, at)).toBe('AL-R001-T001_20261025-193412');
    expect(ticketId(1234, 5, at)).toBe('AL-R1234-T005_20261025-193412');
    expect(parseTicketId('AL-R1234-T005_20261025-193412')).toEqual({ run: 1234, ticket: 5 });
  });

  it('is Windows-safe: ASCII, no colons or spaces, matches the strict pattern', () => {
    const id = ticketId(4, 12, at);
    expect(isWindowsSafe(id)).toBe(true);
    expect(TICKET_ID_RE.test(id)).toBe(true);
    for (const bad of ['AL-R004-T012_20261025-19:34:12', 'AL R004', '../AL-R004-T012_20261025-193412', 'AL-R004-T012_20261025-193412/..', 'AL-R04-T012_20261025-193412']) {
      expect(TICKET_ID_RE.test(bad), bad).toBe(false);
    }
    expect(isWindowsSafe('con')).toBe(false);
    expect(isWindowsSafe('a:b')).toBe(false);
    expect(isWindowsSafe('Ünicode')).toBe(false);
  });

  it('codes season, phase letter and week for the metadata', () => {
    expect(weekCode({ season: 2, phase: 'regular', weekId: 'MW5' })).toBe('S02W05');
    expect(weekCode({ season: 1, phase: 'preseason', weekId: 'P3' })).toBe('S01P03');
    expect(weekCode({ season: 3, phase: 'tournament', weekId: 'TW1' })).toBe('S03T01');
    expect(weekCode({ season: 3, phase: 'season-end', weekId: null })).toBe('S03E00');
  });

  it('keeps the first non-empty line for the index', () => {
    expect(firstLine('\n  Lineup lost my captain  \nmore detail')).toBe('Lineup lost my captain');
    expect(firstLine('x'.repeat(200)).length).toBe(120);
  });
});

describe('run and ticket counters', () => {
  it('gives a new career the next run and a loaded career its own run again', () => {
    let { index, run, created } = runForCareer(emptyTicketIndex(), 'seed-a');
    expect([run, created]).toEqual([1, true]);
    ({ index, run, created } = runForCareer(index, 'seed-b'));
    expect([run, created]).toEqual([2, true]);
    const again = runForCareer(index, 'seed-a');
    expect([again.run, again.created]).toEqual([1, false]);
    expect(again.index).toBe(index);
  });

  it('numbers tickets max + 1 from the index and from the ids on disk', () => {
    let index = runForCareer(emptyTicketIndex(), 'seed-a').index;
    expect(nextTicketNumber(index, 1, [])).toBe(1);
    index = noteTicket(index, 1, 3);
    expect(nextTicketNumber(index, 1, [])).toBe(4);
    // A folder the index missed (written by another session) still counts; other runs do not.
    expect(nextTicketNumber(index, 1, ['AL-R001-T009_20261025-193412', 'AL-R002-T050_20261025-193412', 'notes.md'])).toBe(10);
    expect(noteTicket(index, 1, 2).maxTicket['1']).toBe(3);
  });

  it('repairs a malformed stored index instead of failing', () => {
    expect(readTicketIndex({ version: 7 })).toEqual(emptyTicketIndex());
    expect(readTicketIndex(null)).toEqual(emptyTicketIndex());
    expect(readTicketIndex({ version: 1, nextRun: 5, careers: { a: 4 }, maxTicket: { 4: 2 } }).nextRun).toBe(5);
  });
});

describe('IndexedDB fallback (fake store)', () => {
  function fakeKv(): TicketKv & { data: Map<string, unknown> } {
    const data = new Map<string, unknown>();
    return {
      data,
      get: async (k) => (data.has(k) ? structuredClone(data.get(k)) : undefined),
      set: async (k, v) => void data.set(k, structuredClone(v)),
      keys: async (p) => [...data.keys()].filter((k) => k.startsWith(p)),
    };
  }
  const ticket = (id: string, run: number, n: number, careerKey: string, text: string): StoredTicket => ({
    id,
    run,
    ticket: n,
    careerKey,
    screenshot: 'data:image/png;base64,AAAA',
    state: '{}',
    meta: { text, screen: 'home', createdLocal: '25/10/2026' },
  });

  it('numbers, stores, lists and exports tickets with the same ids and counters', async () => {
    const kv = fakeKv();
    const store = createLocalTicketStore(kv);
    expect(await store.next('seed-a')).toEqual({ run: 1, ticket: 1 });
    await store.save(ticket('AL-R001-T001_20261025-193412', 1, 1, 'seed-a', 'First\nsecond line'));
    expect(await store.next('seed-a')).toEqual({ run: 1, ticket: 2 });
    expect(await store.next('seed-b')).toEqual({ run: 2, ticket: 1 });
    // A reload (new store over the same data) continues the numbering.
    const reloaded = createLocalTicketStore(kv);
    expect(await reloaded.next('seed-a')).toEqual({ run: 1, ticket: 2 });
    await expect(reloaded.save(ticket('AL-R001-T001_20261025-193412', 1, 1, 'seed-a', 'dup'))).rejects.toThrow(/exists/);
    expect(await reloaded.list()).toEqual([{ id: 'AL-R001-T001_20261025-193412', created: '25/10/2026', screen: 'home', firstLine: 'First' }]);
    const exported = JSON.parse(await reloaded.exportAll()) as { format: string; tickets: StoredTicket[] };
    expect(exported.format).toBe('arena-league-tickets');
    expect(exported.tickets[0]!.screenshot).toMatch(/^data:image\/png;base64,/);
  });
});
