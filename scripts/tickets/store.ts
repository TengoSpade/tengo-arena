/**
 * Playtest tickets on disk (dev server only): `<repo>/tickets/<ticket-id>/{screenshot.png,
 * state.json, ticket.json}`, `tickets/index.json` (career -> run#, counters) and a markdown table
 * `tickets/tickets.md`. Every input is validated: strict id, matching run/ticket numbers, size caps,
 * PNG signature, and paths resolved inside the tickets folder only.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { TICKET_ID_RE, firstLine, nextTicketNumber, noteTicket, parseTicketId, readTicketIndex, runForCareer } from '../../src/platform/tickets/naming.ts';

export const LIMITS = {
  /** Decoded screenshot bytes. */
  screenshot: 15 * 1024 * 1024,
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

export interface TicketPayload {
  id: string;
  run: number;
  ticket: number;
  careerKey: string;
  text: string;
  /** PNG, base64 or a `data:image/png;base64,` URL. */
  screenshot: string;
  /** The save JSON, or null when no career was loaded. */
  state: string | null;
  /** Client metadata for ticket.json (screen, week, viewport, logs...). */
  meta: Record<string, unknown>;
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

function mdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

export function createTicketsFs(rootDir: string, build: Record<string, unknown> = {}) {
  const root = resolve(rootDir);
  const inside = (...parts: string[]): string => {
    const p = resolve(root, ...parts);
    if (p !== root && !p.startsWith(root + sep)) throw new TicketError(400, 'path outside the tickets folder');
    return p;
  };
  const checkId = (id: unknown): string => {
    if (typeof id !== 'string' || !TICKET_ID_RE.test(id)) throw new TicketError(400, 'bad ticket id');
    return id;
  };
  const indexPath = () => inside('index.json');
  const readIndex = () => readTicketIndex(existsSync(indexPath()) ? JSON.parse(readFileSync(indexPath(), 'utf8')) : null);
  const writeJson = (path: string, value: unknown) => {
    // Write then rename: a crash never leaves a half-written index or ticket.
    writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2));
    renameSync(`${path}.tmp`, path);
  };
  const ticketDirs = () => (existsSync(root) ? readdirSync(root).filter((n) => TICKET_ID_RE.test(n)) : []);

  return {
    root,

    /** The career's run# (a new career gets the next one, saved at once) and its next ticket#. */
    next(careerKey: string): { run: number; ticket: number } {
      if (typeof careerKey !== 'string' || careerKey.length === 0 || careerKey.length > LIMITS.careerKey) throw new TicketError(400, 'bad career key');
      mkdirSync(root, { recursive: true });
      const { index, run, created } = runForCareer(readIndex(), careerKey);
      if (created) writeJson(indexPath(), index);
      return { run, ticket: nextTicketNumber(index, run, ticketDirs()) };
    },

    /** Validate and write one ticket; returns its folder. */
    write(p: TicketPayload): { id: string; dir: string } {
      const id = checkId(p?.id);
      const nums = parseTicketId(id)!;
      if (nums.run !== p.run || nums.ticket !== p.ticket) throw new TicketError(400, 'id does not match run / ticket');
      if (typeof p.careerKey !== 'string' || p.careerKey.length === 0 || p.careerKey.length > LIMITS.careerKey) throw new TicketError(400, 'bad career key');
      if (typeof p.text !== 'string' || p.text.length > LIMITS.text) throw new TicketError(413, 'text too long');
      if (typeof p.screenshot !== 'string') throw new TicketError(400, 'screenshot missing');
      const png = Buffer.from(p.screenshot.replace(/^data:image\/png;base64,/, ''), 'base64');
      if (png.length > LIMITS.screenshot) throw new TicketError(413, 'screenshot too large');
      if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new TicketError(400, 'screenshot is not a PNG');
      if (p.state !== null && (typeof p.state !== 'string' || p.state.length > LIMITS.state)) throw new TicketError(413, 'state too large');
      if (p.state !== null) JSON.parse(p.state); // must be JSON
      const metaJson = JSON.stringify(p.meta ?? {});
      if (metaJson.length > LIMITS.meta) throw new TicketError(413, 'metadata too large');

      const dir = inside(id);
      if (existsSync(dir)) throw new TicketError(409, 'ticket exists');
      mkdirSync(dir, { recursive: true });
      writeFileSync(inside(id, 'screenshot.png'), png);
      writeFileSync(inside(id, 'state.json'), p.state ?? JSON.stringify({ noCareer: true }));
      const meta: Record<string, unknown> = { ...(p.meta ?? {}), id, run: p.run, ticket: p.ticket, careerKey: p.careerKey, text: p.text, build };
      writeJson(inside(id, 'ticket.json'), meta);

      const { index } = runForCareer(readIndex(), p.careerKey);
      writeJson(indexPath(), noteTicket(index, p.run, p.ticket));

      const md = inside('tickets.md');
      if (!existsSync(md)) writeFileSync(md, '# Playtest tickets\n\n| ID | Time | Screen | Week | Text |\n| --- | --- | --- | --- | --- |\n');
      const created = String(meta['createdLocal'] ?? meta['created'] ?? '');
      appendFileSync(md, `| [${id}](${id}/ticket.json) | ${mdCell(created)} | ${mdCell(String(meta['screen'] ?? ''))} | ${mdCell(String(meta['week'] ?? ''))} | ${mdCell(firstLine(p.text))} |\n`);
      return { id, dir };
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
