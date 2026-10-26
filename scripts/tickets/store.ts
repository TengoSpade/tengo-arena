/**
 * Playtest tickets on disk (dev server only): `<repo>/tickets/<ticket-id>/{screenshot.png,
 * state.json, ticket.json}`, `tickets/index.json` (career -> run#, counters) and a markdown table
 * `tickets/tickets.md`.
 *
 * The server owns the numbers: `write()` is synchronous, so the run# and ticket# it assigns from
 * the career key (and the folders already on disk) are unique even when two tabs file at once; the
 * client sends only its timestamp. Every input is validated: career key, timestamp, size caps, a
 * structurally valid PNG (strict base64, every chunk's CRC), JSON state, and paths resolved inside
 * the tickets folder only.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { assignNumbers, isTicketId, isValidStamp, previewNumbers, readTicketIndex, summaryLine, ticketIdFromStamp } from '../../src/platform/tickets/naming.ts';

export const LIMITS = {
  /** Decoded screenshot bytes. */
  screenshot: 15 * 1024 * 1024,
  /** Screenshot width / height in pixels. */
  screenshotSide: 16_384,
  /** Save JSON characters (late careers reach ~10 MB). */
  state: 30 * 1024 * 1024,
  /** ticket.json metadata characters. */
  meta: 2 * 1024 * 1024,
  text: 20_000,
  careerKey: 200,
  /** Whole request body. */
  body: 64 * 1024 * 1024,
} as const;

export const TICKET_FILES = ['screenshot.png', 'state.json', 'ticket.json'] as const;
export type TicketFile = (typeof TICKET_FILES)[number];

/** What the client sends; the server adds the id, run# and ticket#. */
export interface TicketPayload {
  careerKey: string;
  /** Local `YYYYMMDD-HHMMSS` of the F8 press. */
  stamp: string;
  text: string;
  /** PNG, base64 or a `data:image/png;base64,` URL. */
  screenshot: string;
  /** The save JSON, or null when no career was loaded. */
  state: string | null;
  /** Client metadata for ticket.json (screen, week, viewport, logs...). */
  meta: Record<string, unknown>;
}

export interface WrittenTicket {
  id: string;
  run: number;
  ticket: number;
  dir: string;
}

export class TicketError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
// Any text without control characters: career keys are JSON data, never paths.
// eslint-disable-next-line no-control-regex
const CAREER_KEY_RE = /^[^\u0000-\u001f\u007f]+$/;

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Strict base64 (optionally a PNG data URL) to bytes; anything else is refused. */
export function decodePngBase64(s: string): Buffer {
  const b64 = s.startsWith('data:image/png;base64,') ? s.slice('data:image/png;base64,'.length) : s;
  if (b64.length > Math.ceil(LIMITS.screenshot / 3) * 4) throw new TicketError(413, 'screenshot too large');
  if (b64.length === 0 || b64.length % 4 !== 0 || !BASE64_RE.test(b64)) throw new TicketError(400, 'screenshot is not base64');
  return Buffer.from(b64, 'base64');
}

/** A whole PNG: signature, IHDR first (sane size), every chunk's CRC, at least one IDAT, IEND last. */
export function checkPng(png: Buffer): void {
  const bad = (why: string) => new TicketError(400, `screenshot is not a PNG (${why})`);
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) throw bad('signature');
  let off = 8;
  let first = true;
  let idat = false;
  for (;;) {
    if (off + 12 > png.length) throw bad('truncated');
    const len = png.readUInt32BE(off);
    const type = png.toString('latin1', off + 4, off + 8);
    if (!/^[A-Za-z]{4}$/.test(type) || off + 12 + len > png.length) throw bad('chunk');
    if (crc32(png.subarray(off + 4, off + 8 + len)) !== png.readUInt32BE(off + 8 + len)) throw bad(`CRC of ${type}`);
    if (first) {
      if (type !== 'IHDR' || len !== 13) throw bad('IHDR');
      const w = png.readUInt32BE(off + 8);
      const h = png.readUInt32BE(off + 12);
      if (w < 1 || h < 1 || w > LIMITS.screenshotSide || h > LIMITS.screenshotSide) throw bad('size');
      first = false;
    }
    if (type === 'IDAT') idat = true;
    off += 12 + len;
    if (type === 'IEND') {
      if (len !== 0 || off !== png.length || !idat) throw bad('IEND');
      return;
    }
  }
}

function mdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function checkCareerKey(key: unknown): string {
  if (typeof key !== 'string' || key.length === 0 || key.length > LIMITS.careerKey || !CAREER_KEY_RE.test(key)) throw new TicketError(400, 'bad career key');
  return key;
}

export function createTicketsFs(rootDir: string, build: Record<string, unknown> = {}) {
  const root = resolve(rootDir);
  const inside = (...parts: string[]): string => {
    const p = resolve(root, ...parts);
    if (p !== root && !p.startsWith(root + sep)) throw new TicketError(400, 'path outside the tickets folder');
    return p;
  };
  const checkId = (id: unknown): string => {
    if (!isTicketId(id)) throw new TicketError(400, 'bad ticket id');
    return id;
  };
  const indexPath = () => inside('index.json');
  const readIndex = () => {
    try {
      return readTicketIndex(existsSync(indexPath()) ? JSON.parse(readFileSync(indexPath(), 'utf8')) : null);
    } catch {
      return readTicketIndex(null);
    }
  };
  const writeJson = (path: string, value: unknown) => {
    // Write then rename: a crash never leaves a half-written index or ticket.
    writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2));
    renameSync(`${path}.tmp`, path);
  };
  const ticketDirs = () => (existsSync(root) ? readdirSync(root).filter((n) => isTicketId(n)) : []);

  return {
    root,

    /** Preview of the next ticket of a career (the dialog shows it). Reads only; nothing is reserved. */
    next(careerKey: unknown): { run: number; ticket: number } {
      return previewNumbers(readIndex(), checkCareerKey(careerKey), ticketDirs());
    },

    /** Validate, number (run# and ticket# from the career key) and write one ticket. Synchronous on purpose. */
    write(p: TicketPayload): WrittenTicket {
      if (!p || typeof p !== 'object') throw new TicketError(400, 'bad ticket');
      const careerKey = checkCareerKey(p.careerKey);
      if (!isValidStamp(p.stamp)) throw new TicketError(400, 'bad timestamp');
      if (typeof p.text !== 'string' || p.text.length > LIMITS.text) throw new TicketError(413, 'text too long');
      if (typeof p.screenshot !== 'string') throw new TicketError(400, 'screenshot missing');
      const png = decodePngBase64(p.screenshot);
      if (png.length > LIMITS.screenshot) throw new TicketError(413, 'screenshot too large');
      checkPng(png);
      if (p.state !== null && (typeof p.state !== 'string' || p.state.length > LIMITS.state)) throw new TicketError(413, 'state too large');
      if (p.state !== null) JSON.parse(p.state); // must be JSON
      if (p.meta !== undefined && (typeof p.meta !== 'object' || p.meta === null || Array.isArray(p.meta))) throw new TicketError(400, 'bad metadata');
      const metaJson = JSON.stringify(p.meta ?? {});
      if (metaJson.length > LIMITS.meta) throw new TicketError(413, 'metadata too large');

      mkdirSync(root, { recursive: true });
      let { index, run, ticket } = assignNumbers(readIndex(), careerKey, ticketDirs());
      let id = ticketIdFromStamp(run, ticket, p.stamp);
      // Another process may have taken the folder meanwhile: take the next number.
      for (let tries = 0; ; tries++) {
        try {
          mkdirSync(inside(id));
          break;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || tries > 50) throw e;
          ({ index, run, ticket } = assignNumbers(index, careerKey, [...ticketDirs(), id]));
          id = ticketIdFromStamp(run, ticket, p.stamp);
        }
      }
      writeFileSync(inside(id, 'screenshot.png'), png);
      writeFileSync(inside(id, 'state.json'), p.state ?? JSON.stringify({ noCareer: true }));
      const meta: Record<string, unknown> = { ...(p.meta ?? {}), id, run, ticket, careerKey, text: p.text, build };
      writeJson(inside(id, 'ticket.json'), meta);
      writeJson(indexPath(), index);

      const md = inside('tickets.md');
      if (!existsSync(md)) writeFileSync(md, '# Playtest tickets\n\n| ID | Time | Screen | Week | Text |\n| --- | --- | --- | --- | --- |\n');
      const created = String(meta['createdLocal'] ?? meta['created'] ?? '');
      appendFileSync(md, `| [${id}](${id}/ticket.json) | ${mdCell(created)} | ${mdCell(String(meta['screen'] ?? ''))} | ${mdCell(String(meta['week'] ?? ''))} | ${mdCell(summaryLine(p.text))} |\n`);
      return { id, run, ticket, dir: inside(id) };
    },

    /** One file of a ticket (reproduction: state.json and ticket.json; the screenshot). */
    read(id: string, file: string): Buffer {
      checkId(id);
      if (!(TICKET_FILES as readonly string[]).includes(file)) throw new TicketError(404, 'no such ticket file');
      const p = inside(id, file);
      if (!existsSync(p)) throw new TicketError(404, 'ticket not found');
      return readFileSync(p);
    },

    readMarkdown(): string {
      const p = inside('tickets.md');
      return existsSync(p) ? readFileSync(p, 'utf8') : '# Playtest tickets\n\nNo tickets yet.\n';
    },
  };
}

export type TicketsFs = ReturnType<typeof createTicketsFs>;
