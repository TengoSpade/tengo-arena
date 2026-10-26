import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ticketsHandler } from './plugin';
import { LIMITS, createTicketsFs, type TicketPayload } from './store';

// A 1x1 PNG.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'al-tickets-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function payload(over: Partial<TicketPayload> = {}): TicketPayload {
  return {
    id: 'AL-R001-T001_20261025-193412',
    run: 1,
    ticket: 1,
    careerKey: 'seed-a',
    text: 'Lineup lost my captain | twice\nsecond line',
    screenshot: `data:image/png;base64,${PNG}`,
    state: JSON.stringify({ format: 'arena-league-save' }),
    meta: { screen: 'squad', week: 'S01W05', createdLocal: '25/10/2026, 19:34:12' },
    ...over,
  };
}

describe('tickets on disk', () => {
  it('numbers, then writes the three files, the index and a markdown row', () => {
    const fs = createTicketsFs(join(dir, 'tickets'), { commit: 'abc1234', dirty: false });
    expect(fs.next('seed-a')).toEqual({ run: 1, ticket: 1 });
    const out = fs.write(payload());
    expect(readdirSync(out.dir).sort()).toEqual(['screenshot.png', 'state.json', 'ticket.json']);
    expect(readFileSync(join(out.dir, 'screenshot.png')).subarray(1, 4).toString()).toBe('PNG');
    const meta = JSON.parse(readFileSync(join(out.dir, 'ticket.json'), 'utf8')) as Record<string, unknown>;
    expect(meta).toMatchObject({ id: 'AL-R001-T001_20261025-193412', run: 1, ticket: 1, screen: 'squad', build: { commit: 'abc1234', dirty: false } });
    const md = readFileSync(join(dir, 'tickets', 'tickets.md'), 'utf8');
    expect(md).toContain('| ID | Time | Screen | Week | Text |');
    expect(md).toContain('| [AL-R001-T001_20261025-193412](AL-R001-T001_20261025-193412/ticket.json) | 25/10/2026, 19:34:12 | squad | S01W05 | Lineup lost my captain \\| twice |');
    // The next ticket of the run and a new career's run.
    expect(fs.next('seed-a')).toEqual({ run: 1, ticket: 2 });
    expect(fs.next('seed-b')).toEqual({ run: 2, ticket: 1 });
    const index = JSON.parse(readFileSync(join(dir, 'tickets', 'index.json'), 'utf8')) as { careers: Record<string, number> };
    expect(index.careers).toEqual({ 'seed-a': 1, 'seed-b': 2 });
  });

  it('rejects bad ids, mismatched numbers, traversal, non-PNG and oversize input, and never overwrites', () => {
    const fs = createTicketsFs(join(dir, 'tickets'));
    for (const id of ['../evil', 'AL-R001-T001_20261025-19:34:12', 'AL-R001-T001_20261025-193412/../../x', 'C:\\x', '']) {
      expect(() => fs.write(payload({ id })), id).toThrow(/bad ticket id/);
    }
    expect(() => fs.write(payload({ ticket: 2 }))).toThrow(/does not match/);
    expect(() => fs.write(payload({ screenshot: Buffer.from('GIF89a....').toString('base64') }))).toThrow(/not a PNG/);
    expect(() => fs.write(payload({ text: 'x'.repeat(LIMITS.text + 1) }))).toThrow(/too long/);
    expect(() => fs.write(payload({ state: 'x'.repeat(LIMITS.state + 1) }))).toThrow(/too large/);
    expect(() => fs.write(payload({ careerKey: 'k'.repeat(LIMITS.careerKey + 1) }))).toThrow(/career key/);
    expect(() => fs.read('../../etc', 'state.json')).toThrow(/bad ticket id/);
    expect(() => fs.read('AL-R001-T001_20261025-193412', '../index.json')).toThrow(/no such ticket file/);
    fs.write(payload());
    expect(() => fs.write(payload())).toThrow(/exists/);
    // Nothing was written outside the tickets folder.
    expect(readdirSync(dir)).toEqual(['tickets']);
    expect(existsSync(join(dir, 'evil'))).toBe(false);
  });
});

function call(handler: ReturnType<typeof ticketsHandler>, method: string, url: string, body?: string): Promise<{ status: number; body: string }> {
  const req = Readable.from(body ? [Buffer.from(body)] : []) as unknown as IncomingMessage;
  Object.assign(req, { method, url });
  return new Promise((resolve) => {
    let status = 200;
    const res = {
      set statusCode(v: number) {
        status = v;
      },
      setHeader() {},
      end(b: string | Buffer) {
        resolve({ status, body: b.toString() });
      },
    } as unknown as ServerResponse;
    void handler(req, res);
  });
}

describe('tickets dev-server handler', () => {
  it('serves next numbers, accepts a ticket, serves its files and rejects bad requests', async () => {
    const fs = createTicketsFs(join(dir, 'tickets'));
    const handle = ticketsHandler(fs, { commit: 'abc1234', dirty: true });
    expect(JSON.parse((await call(handle, 'GET', '/next?career=seed-a')).body)).toEqual({ run: 1, ticket: 1 });
    const posted = await call(handle, 'POST', '/', JSON.stringify(payload()));
    expect(posted.status).toBe(201);
    const state = await call(handle, 'GET', '/AL-R001-T001_20261025-193412/state.json');
    expect(JSON.parse(state.body)).toEqual({ format: 'arena-league-save' });
    expect((await call(handle, 'GET', '/tickets.md')).body).toContain('AL-R001-T001_20261025-193412');
    expect((await call(handle, 'GET', '/..%2F..%2Fsecret/state.json')).status).toBe(400);
    expect((await call(handle, 'POST', '/', '{not json')).status).toBe(400);
    expect((await call(handle, 'POST', '/', JSON.stringify(payload({ id: '../x' })))).status).toBe(400);
    expect((await call(handle, 'GET', '/nope')).status).toBe(404);
  });
});
