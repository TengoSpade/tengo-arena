import { describe, expect, it, vi } from 'vitest';
import { createLocalTicketStore, type NewTicket, type TicketKv } from './local-store';
import {
  NO_CAREER_KEY,
  TICKET_ID_RE,
  assignNumbers,
  emptyTicketIndex,
  firstLine,
  isTicketId,
  isValidStamp,
  isWindowsSafe,
  nextTicketNumber,
  noteTicket,
  parseTicketId,
  previewNumbers,
  readTicketIndex,
  runForCareer,
  summaryLine,
  ticketId,
  ticketShort,
  ticketStamp,
  weekCode,
} from './naming';

describe('ticket id', () => {
  const at = new Date(2026, 9, 25, 19, 34, 12); // local time, month is 0-based

  it('follows AL-R{run:3}-T{ticket:3}_{YYYYMMDD-HHMMSS} in local time', () => {
    expect(ticketId(4, 12, at)).toBe('AL-R004-T012_20261025-193412');
    expect(ticketStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
    expect(ticketShort('AL-R004-T012_20261025-193412')).toBe('AL-R004-T012');
  });

  it('pads to three digits and grows past 999 instead of wrapping', () => {
    expect(ticketId(1, 1, at)).toBe('AL-R001-T001_20261025-193412');
    expect(ticketId(1234, 5, at)).toBe('AL-R1234-T005_20261025-193412');
    expect(parseTicketId('AL-R1234-T005_20261025-193412')).toEqual({ run: 1234, ticket: 5, stamp: '20261025-193412' });
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

  it('accepts only real timestamps and bounded numbers', () => {
    expect(isValidStamp('20261025-193412')).toBe(true);
    expect(isValidStamp('20240229-000000')).toBe(true);
    for (const bad of ['20250229-000000', '20261345-256199', '20261025-240000', '20261025-196012', '19991231-235959', '2026102-193412', 42]) {
      expect(isValidStamp(bad), String(bad)).toBe(false);
    }
    expect(isTicketId('AL-R001-T001_20261025-193412')).toBe(true);
    expect(isTicketId('AL-R001-T001_20261399-193412')).toBe(false);
    expect(isTicketId('AL-R0000001-T001_20261025-193412')).toBe(false);
    expect(isTicketId(`AL-R001-T001_20261025-193412${'0'.repeat(100)}`)).toBe(false);
  });

  it('codes season, phase letter and week for the metadata', () => {
    expect(weekCode({ season: 2, phase: 'regular', weekId: 'MW5' })).toBe('S02W05');
    expect(weekCode({ season: 1, phase: 'preseason', weekId: 'P3' })).toBe('S01P03');
    expect(weekCode({ season: 3, phase: 'tournament', weekId: 'TW1' })).toBe('S03T01');
    expect(weekCode({ season: 3, phase: 'season-end', weekId: null })).toBe('S03E00');
  });

  it('keeps the first non-empty line for the index and marks what follows', () => {
    expect(firstLine('\n  Lineup lost my captain  \nmore detail')).toBe('Lineup lost my captain');
    expect(firstLine('x'.repeat(200)).length).toBe(120);
    expect(summaryLine('One line')).toBe('One line');
    expect(summaryLine('First\nsecond\n\nthird\nfourth')).toBe('First … (+3 lines)');
    expect(summaryLine('First\nsecond')).toBe('First … (+1 line)');
    expect(summaryLine(`${'x'.repeat(200)}\nmore`)).toMatch(/x… \(\+1 line\)$/);
  });
});

describe('run and ticket counters', () => {
  it('gives a new career the next run and a loaded career its own run again', () => {
    let { index, run, created } = runForCareer(emptyTicketIndex(), 'c-a');
    expect([run, created]).toEqual([1, true]);
    ({ index, run, created } = runForCareer(index, 'c-b'));
    expect([run, created]).toEqual([2, true]);
    const again = runForCareer(index, 'c-a');
    expect([again.run, again.created]).toEqual([1, false]);
    expect(again.index).toBe(index);
  });

  it('numbers tickets max + 1 from the index and from the ids on disk', () => {
    let index = runForCareer(emptyTicketIndex(), 'c-a').index;
    expect(nextTicketNumber(index, 1, [])).toBe(1);
    index = noteTicket(index, 1, 3);
    expect(nextTicketNumber(index, 1, [])).toBe(4);
    // A folder the index missed (written by another session) still counts; other runs do not.
    expect(nextTicketNumber(index, 1, ['AL-R001-T009_20261025-193412', 'AL-R002-T050_20261025-193412', 'notes.md'])).toBe(10);
    expect(noteTicket(index, 1, 2).maxTicket['1']).toBe(3);
  });

  it('files tickets without a career under run 0, so the first career is run 1', () => {
    let index = emptyTicketIndex();
    const a = assignNumbers(index, NO_CAREER_KEY, []);
    expect([a.run, a.ticket]).toEqual([0, 1]);
    index = a.index;
    expect(assignNumbers(index, NO_CAREER_KEY, []).ticket).toBe(2);
    expect(runForCareer(index, 'c-first').run).toBe(1);
    expect(previewNumbers(index, 'c-first', [])).toEqual({ run: 1, ticket: 1 });
    // The preview reserves nothing.
    expect(runForCareer(index, 'c-first').created).toBe(true);
  });

  it('treats prototype-like keys as plain careers (no AL-RNaN)', () => {
    let index = emptyTicketIndex();
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const r = assignNumbers(index, key, []);
      expect(Number.isInteger(r.run), key).toBe(true);
      index = r.index;
    }
    expect(Object.values(index.careers)).toEqual([1, 2, 3, 4]);
    expect(Object.hasOwn(index.careers, '__proto__')).toBe(true);
    const roundTrip = readTicketIndex(JSON.parse(JSON.stringify(index)));
    expect(runForCareer(roundTrip, '__proto__').run).toBe(2);
    expect(runForCareer(roundTrip, 'valueOf')).toMatchObject({ run: 5, created: true });
  });

  it('repairs a malformed stored index instead of failing', () => {
    expect(readTicketIndex({ version: 7 })).toEqual(emptyTicketIndex());
    expect(readTicketIndex(null)).toEqual(emptyTicketIndex());
    expect(readTicketIndex({ version: 1, nextRun: 5, careers: { a: 4 }, maxTicket: { 4: 2 } }).nextRun).toBe(5);
    // Garbage entries are dropped, not trusted.
    expect(readTicketIndex({ version: 1, nextRun: 3, careers: { a: 'x', b: -1, c: 2 }, maxTicket: { 2: 1.5 } })).toEqual({ version: 1, nextRun: 3, careers: { c: 2 }, maxTicket: {} });
  });
});

describe('IndexedDB fallback (fake store)', () => {
  function fakeKv() {
    const data = new Map<string, unknown>();
    const kv = {
      data,
      get: vi.fn(async (k: string) => (data.has(k) ? structuredClone(data.get(k)) : undefined)),
      set: async (k: string, v: unknown) => void data.set(k, structuredClone(v)),
      delete: async (k: string) => void data.delete(k),
      keys: async (p: string) => [...data.keys()].filter((k) => k.startsWith(p)),
    } satisfies TicketKv & { data: Map<string, unknown> };
    return kv;
  }
  const ticket = (careerKey: string, text: string): NewTicket => ({
    careerKey,
    stamp: '20261025-193412',
    text,
    screenshot: 'data:image/png;base64,AAAA',
    state: '{}',
    meta: { screen: 'home', createdLocal: '25/10/2026' },
  });

  it('numbers tickets as it stores them, lists summaries only, deletes and exports', async () => {
    const kv = fakeKv();
    const store = createLocalTicketStore(kv);
    expect(await store.next('c-a')).toEqual({ run: 1, ticket: 1 });
    // Two tickets at once still get different numbers.
    const [a, b] = await Promise.all([store.add(ticket('c-a', 'First\nsecond line')), store.add(ticket('c-a', 'Other'))]);
    expect([a.id, b.id]).toEqual(['AL-R001-T001_20261025-193412', 'AL-R001-T002_20261025-193412']);
    expect(a.meta).toMatchObject({ id: a.id, run: 1, ticket: 1, text: 'First\nsecond line' });
    expect((await store.add(ticket('c-b', 'B'))).id).toBe('AL-R002-T001_20261025-193412');
    expect((await store.add(ticket(NO_CAREER_KEY, 'title screen'))).id).toBe('AL-R000-T001_20261025-193412');
    // A reload (new store over the same data) continues the numbering.
    const reloaded = createLocalTicketStore(kv);
    expect(await reloaded.next('c-a')).toEqual({ run: 1, ticket: 3 });
    kv.get.mockClear();
    const list = await reloaded.list();
    expect(list.map((x) => x.id)).toEqual(['AL-R002-T001_20261025-193412', 'AL-R001-T002_20261025-193412', 'AL-R001-T001_20261025-193412', 'AL-R000-T001_20261025-193412']);
    expect(list[2]).toEqual({ id: a.id, created: '25/10/2026', screen: 'home', firstLine: 'First … (+1 line)' });
    expect(kv.get.mock.calls.every(([k]) => k.startsWith('summary:'))).toBe(true);
    await reloaded.remove(b.id);
    expect((await reloaded.list()).map((x) => x.id)).not.toContain(b.id);
    expect(kv.data.has(`ticket:${b.id}`)).toBe(false);
    const parts = await reloaded.exportParts();
    expect(parts.length).toBeGreaterThan(3); // one part per ticket, no single giant string
    const exported = JSON.parse(parts.join('')) as { format: string; tickets: { id: string; screenshot: string }[] };
    expect(exported.format).toBe('arena-league-tickets');
    expect(exported.tickets.map((x) => x.id)).toEqual(['AL-R000-T001_20261025-193412', 'AL-R001-T001_20261025-193412', 'AL-R002-T001_20261025-193412']);
    expect(exported.tickets[0]!.screenshot).toMatch(/^data:image\/png;base64,/);
  });
});
