import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ticketsHandler, writeAllowed } from './plugin';
import { LIMITS, checkPng, createTicketsFs, decodePngBase64, type TicketPayload } from './store';

// A valid 1x1 PNG (signature, IHDR, IDAT, IEND, all CRCs right).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'al-tickets-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function payload(over: Partial<TicketPayload> = {}): TicketPayload {
  return {
    careerKey: 'c-career-a',
    stamp: '20261025-193412',
    text: 'Lineup lost my captain | twice\nsecond line\n\nthird line',
    screenshot: `data:image/png;base64,${PNG}`,
    state: JSON.stringify({ format: 'arena-league-save' }),
    meta: { screen: 'squad', week: 'S01W05', createdLocal: '25/10/2026, 19:34:12' },
    ...over,
  };
}

describe('tickets on disk', () => {
  it('numbers each ticket itself, then writes the three files, the index and a markdown row', () => {
    const fs = createTicketsFs(join(dir, 'tickets'), { commit: 'abc1234', dirty: false });
    expect(fs.next('c-career-a')).toEqual({ run: 1, ticket: 1 });
    // The preview reserves nothing.
    expect(existsSync(join(dir, 'tickets', 'index.json'))).toBe(false);
    const out = fs.write(payload());
    expect(out).toMatchObject({ id: 'AL-R001-T001_20261025-193412', run: 1, ticket: 1 });
    expect(readdirSync(out.dir).sort()).toEqual(['screenshot.png', 'state.json', 'ticket.json']);
    expect(readFileSync(join(out.dir, 'screenshot.png')).subarray(1, 4).toString()).toBe('PNG');
    const meta = JSON.parse(readFileSync(join(out.dir, 'ticket.json'), 'utf8')) as Record<string, unknown>;
    expect(meta).toMatchObject({ id: out.id, run: 1, ticket: 1, careerKey: 'c-career-a', screen: 'squad', build: { commit: 'abc1234', dirty: false } });
    const md = readFileSync(join(dir, 'tickets', 'tickets.md'), 'utf8');
    expect(md).toContain('| ID | Time | Screen | Week | Text |');
    expect(md).toContain(`| [${out.id}](${out.id}/ticket.json) | 25/10/2026, 19:34:12 | squad | S01W05 | Lineup lost my captain \\| twice … (+2 lines) |`);
    expect(fs.next('c-career-a')).toEqual({ run: 1, ticket: 2 });
    expect(fs.next('c-career-b')).toEqual({ run: 2, ticket: 1 });
  });

  it('gives two tickets filed back to back different numbers and ignores numbers sent by the client', () => {
    const fs = createTicketsFs(join(dir, 'tickets'));
    const forged = { ...payload(), id: 'AL-R099-T099_20261025-193412', run: 99, ticket: 99 } as TicketPayload;
    const a = fs.write(forged);
    const b = fs.write(payload());
    expect([a.id, b.id]).toEqual(['AL-R001-T001_20261025-193412', 'AL-R001-T002_20261025-193412']);
    // A second career: the next run; a ticket without a career: run 0.
    expect(fs.write(payload({ careerKey: 'c-career-b' })).id).toBe('AL-R002-T001_20261025-193412');
    expect(fs.write(payload({ careerKey: 'no-career', state: null })).id).toBe('AL-R000-T001_20261025-193412');
    expect(fs.write(payload({ careerKey: 'c-career-c' })).id).toBe('AL-R003-T001_20261025-193412');
    // Seeds named like Object.prototype members are ordinary career keys.
    expect(fs.write(payload({ careerKey: 'constructor' })).id).toBe('AL-R004-T001_20261025-193412');
    expect(fs.write(payload({ careerKey: '__proto__' })).id).toBe('AL-R005-T001_20261025-193412');
    expect(fs.write(payload({ careerKey: '__proto__' })).id).toBe('AL-R005-T002_20261025-193412');
    const index = JSON.parse(readFileSync(join(dir, 'tickets', 'index.json'), 'utf8')) as { careers: Record<string, number> };
    expect(Object.hasOwn(index.careers, '__proto__')).toBe(true);
  });

  it('rejects bad stamps and keys, non-base64, broken PNGs, oversize input and traversal, writing nothing outside the folder', () => {
    const fs = createTicketsFs(join(dir, 'tickets'));
    for (const stamp of ['20261345-256199', '20260231-120000', '2026-10-25', '../x', '']) expect(() => fs.write(payload({ stamp })), stamp).toThrow(/bad timestamp/);
    expect(() => fs.write(payload({ careerKey: 'a\u0000b' }))).toThrow(/career key/);
    expect(() => fs.write(payload({ careerKey: 'k'.repeat(LIMITS.careerKey + 1) }))).toThrow(/career key/);
    expect(() => fs.write(payload({ screenshot: 'data:image/png;base64,iVBOR*w0K' }))).toThrow(/not base64/);
    expect(() => fs.write(payload({ screenshot: Buffer.from('GIF89a....').toString('base64') }))).toThrow(/not a PNG/);
    const png = Buffer.from(PNG, 'base64');
    const badCrc = Buffer.from(png);
    badCrc[20] = badCrc[20]! ^ 0xff; // the IHDR height, so its CRC no longer matches
    expect(() => checkPng(badCrc)).toThrow(/CRC of IHDR/);
    expect(() => checkPng(png.subarray(0, png.length - 12))).toThrow(/not a PNG/); // no IEND
    expect(() => checkPng(Buffer.concat([png, Buffer.from('trailing')]))).toThrow(/not a PNG/);
    expect(() => checkPng(decodePngBase64(PNG))).not.toThrow();
    expect(() => fs.write(payload({ text: 'x'.repeat(LIMITS.text + 1) }))).toThrow(/too long/);
    expect(() => fs.write(payload({ state: 'x'.repeat(LIMITS.state + 1) }))).toThrow(/too large/);
    expect(() => fs.write(payload({ state: '{not json' }))).toThrow(SyntaxError);
    expect(() => fs.write(payload({ meta: [] as unknown as Record<string, unknown> }))).toThrow(/metadata/);
    expect(() => fs.read('../../etc', 'state.json')).toThrow(/bad ticket id/);
    expect(() => fs.read('AL-R0000001-T001_20261025-193412', 'state.json')).toThrow(/bad ticket id/);
    expect(() => fs.read('AL-R001-T001_20261025-193412', '../index.json')).toThrow(/no such ticket file/);
    expect(existsSync(join(dir, 'tickets'))).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });
});

interface Call {
  method: string;
  url: string;
  body?: string | Buffer[];
  headers?: Record<string, string>;
}

function call(handler: ReturnType<typeof ticketsHandler>, c: Call): Promise<{ status: number; body: string }> {
  const chunks = c.body === undefined ? [] : Array.isArray(c.body) ? c.body : [Buffer.from(c.body)];
  const req = Readable.from(chunks) as unknown as IncomingMessage;
  Object.assign(req, { method: c.method, url: c.url, headers: { host: 'localhost:5173', ...(c.headers ?? {}) } });
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

const sameOrigin = { 'content-type': 'application/json', origin: 'http://localhost:5173' };

describe('tickets dev-server handler', () => {
  it('files a ticket from the game page, serves its files and answers bad requests with 4xx', async () => {
    const fs = createTicketsFs(join(dir, 'tickets'));
    const handle = ticketsHandler(fs, { commit: 'abc1234', dirty: true });
    expect(JSON.parse((await call(handle, { method: 'GET', url: '/next?career=c-career-a' })).body)).toEqual({ run: 1, ticket: 1 });
    const posted = await call(handle, { method: 'POST', url: '/', body: JSON.stringify(payload()), headers: sameOrigin });
    expect(posted.status).toBe(201);
    expect(JSON.parse(posted.body)).toMatchObject({ id: 'AL-R001-T001_20261025-193412', run: 1, ticket: 1 });
    const state = await call(handle, { method: 'GET', url: '/AL-R001-T001_20261025-193412/state.json' });
    expect(JSON.parse(state.body)).toEqual({ format: 'arena-league-save' });
    expect((await call(handle, { method: 'GET', url: '/tickets.md' })).body).toContain('AL-R001-T001_20261025-193412');
    expect((await call(handle, { method: 'GET', url: '/..%2F..%2Fsecret/state.json' })).status).toBe(400);
    expect((await call(handle, { method: 'GET', url: '/%E0%A4%A/state.json' })).status).toBe(400); // bad % escape
    expect((await call(handle, { method: 'POST', url: '/', body: '{not json', headers: sameOrigin })).status).toBe(400);
    expect((await call(handle, { method: 'GET', url: '/nope' })).status).toBe(404);
  });

  it('accepts writes only as JSON from the same origin (403 otherwise)', async () => {
    const fs = createTicketsFs(join(dir, 'tickets'));
    const handle = ticketsHandler(fs, {});
    const body = JSON.stringify(payload());
    const variants: Record<string, string>[] = [
      { 'content-type': 'text/plain', origin: 'https://evil.example' },
      { 'content-type': 'text/plain', origin: 'http://localhost:5173' },
      { 'content-type': 'application/json', origin: 'https://evil.example' },
      { 'content-type': 'application/json', origin: 'null' },
      { 'content-type': 'application/json' },
      { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
    ];
    for (const headers of variants) {
      expect((await call(handle, { method: 'POST', url: '/', body, headers })).status, JSON.stringify(headers)).toBe(403);
    }
    // Nothing was written and no run was used up.
    expect(existsSync(join(dir, 'tickets'))).toBe(false);
    expect((await call(handle, { method: 'POST', url: '/', body, headers: { 'content-type': 'application/json; charset=utf-8', 'sec-fetch-site': 'same-origin' } })).status).toBe(201);
    expect(writeAllowed({ headers: { host: 'localhost:5173', ...sameOrigin } } as unknown as IncomingMessage)).toBe(true);
  });

  it('answers 413 to an oversize body instead of resetting the connection', async () => {
    const fs = createTicketsFs(join(dir, 'tickets'));
    const handle = ticketsHandler(fs, {}, 1000);
    const big = JSON.stringify(payload({ text: 'x'.repeat(5000) }));
    expect((await call(handle, { method: 'POST', url: '/', body: big, headers: { ...sameOrigin, 'content-length': String(big.length) } })).status).toBe(413);
    // No Content-Length (chunked): counted while reading.
    const chunks = Array.from({ length: 10 }, () => Buffer.from('x'.repeat(500)));
    expect((await call(handle, { method: 'POST', url: '/', body: chunks, headers: sameOrigin })).status).toBe(413);
    expect(existsSync(join(dir, 'tickets'))).toBe(false);
  });
});
