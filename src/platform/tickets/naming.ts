/**
 * Playtest tickets: the ID and the run / ticket counters. Pure functions shared by the in-game tool
 * (src/ui/tickets), its IndexedDB fallback (./local-store) and the dev-server plugin
 * (scripts/tickets), so all three name and number tickets the same way.
 *
 * ID: `AL-R{run:3}-T{ticket:3}_{YYYYMMDD-HHMMSS}` in local time, e.g. `AL-R004-T012_20261025-193412`.
 * Windows-safe by construction: ASCII letters, digits, `-` and `_` only.
 * - run#: one per career (keyed by the career id kept in its saves); loading a career reuses its
 *   run#, a new career (even on the same seed) gets the next one. Tickets filed before any career
 *   exists (title screen) are run 0.
 * - ticket#: per run, max(existing) + 1, assigned by whoever stores the ticket (the dev server or
 *   the IndexedDB store) at the moment it is written, so two tabs never get the same number.
 */

/** Ticket ids: run and ticket numbers (3-6 digits) and the local timestamp captured. */
export const TICKET_ID_RE = /^AL-R(\d{3,6})-T(\d{3,6})_(\d{8}-\d{6})$/;
const STAMP_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/;
/** Largest run# / ticket# (6 digits). */
export const MAX_NUMBER = 999_999;
/** Career key of tickets filed with no career loaded (run 0). */
export const NO_CAREER_KEY = 'no-career';

export function pad(n: number, width: number): string {
  const v = Math.max(0, Math.trunc(n));
  return String(v).padStart(width, '0');
}

/** Local time as `YYYYMMDD-HHMMSS`. */
export function ticketStamp(at: Date): string {
  return `${at.getFullYear()}${pad(at.getMonth() + 1, 2)}${pad(at.getDate(), 2)}-${pad(at.getHours(), 2)}${pad(at.getMinutes(), 2)}${pad(at.getSeconds(), 2)}`;
}

/** A real calendar date and time of day in `YYYYMMDD-HHMMSS` form (no 20261345-256199). */
export function isValidStamp(stamp: unknown): stamp is string {
  const m = typeof stamp === 'string' ? STAMP_RE.exec(stamp) : null;
  if (!m) return false;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return y >= 2000 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth && h <= 23 && mi <= 59 && s <= 59;
}

export function ticketIdFromStamp(run: number, ticket: number, stamp: string): string {
  return `AL-R${pad(run, 3)}-T${pad(ticket, 3)}_${stamp}`;
}

export function ticketId(run: number, ticket: number, at: Date): string {
  return ticketIdFromStamp(run, ticket, ticketStamp(at));
}

/** A well-formed id with a real timestamp, or null. */
export function parseTicketId(id: unknown): { run: number; ticket: number; stamp: string } | null {
  const m = typeof id === 'string' ? TICKET_ID_RE.exec(id) : null;
  return m && isValidStamp(m[3]) ? { run: Number(m[1]), ticket: Number(m[2]), stamp: m[3]! } : null;
}

export function isTicketId(id: unknown): id is string {
  return parseTicketId(id) !== null;
}

/** `AL-R001-T001` (toasts); the full id stays for files and Copy ID. */
export function ticketShort(id: string): string {
  return id.split('_')[0]!;
}

/** Safe as a Windows (and POSIX) file or folder name: no reserved characters, no spaces, ASCII. */
export function isWindowsSafe(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name) && name.length <= 120;
}

/**
 * Season / phase / week as one code for ticket metadata: S02W05. Phase letters: P preseason
 * (P1-P4), W matchweek (1-16), T tournament week (TW1-3), E season end / review. 00 when there is
 * no week.
 */
export function weekCode(calendar: { season: number; phase: string; weekId: string | null }): string {
  const letter = calendar.phase === 'preseason' ? 'P' : calendar.phase === 'regular' ? 'W' : calendar.phase === 'tournament' ? 'T' : 'E';
  const digits = calendar.phase === 'season-end' ? 0 : Number(/(\d+)$/.exec(calendar.weekId ?? '')?.[1] ?? 0);
  return `S${pad(calendar.season, 2)}${letter}${pad(digits, 2)}`;
}

// ---- counters ------------------------------------------------------------------------------------------------

/** tickets/index.json (dev server) and the IndexedDB index (fallback). */
export interface TicketIndex {
  version: 1;
  /** The run# the next new career gets. */
  nextRun: number;
  /** Career key -> run#. Read with Object.hasOwn: keys are player data ("constructor" is a fine seed). */
  careers: Record<string, number>;
  /** run# -> highest ticket# filed in that run. */
  maxTicket: Record<string, number>;
}

export function emptyTicketIndex(): TicketIndex {
  return { version: 1, nextRun: 1, careers: {}, maxTicket: {} };
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_NUMBER;
const own = (rec: Record<string, number>, key: string): number | undefined => (Object.hasOwn(rec, key) && isCount(rec[key]) ? rec[key] : undefined);
/** Own, valid entries only (Object.fromEntries defines "__proto__" as a plain key). */
const cleanMap = (raw: unknown): Record<string, number> =>
  raw && typeof raw === 'object' ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, number] => isCount(e[1]))) : {};

/** A stored index, repaired: anything malformed starts from an empty index rather than failing a ticket. */
export function readTicketIndex(raw: unknown): TicketIndex {
  const r = raw as Partial<TicketIndex> | null;
  if (!r || typeof r !== 'object' || r.version !== 1 || !isCount(r.nextRun)) return emptyTicketIndex();
  return { version: 1, nextRun: Math.max(1, r.nextRun), careers: cleanMap(r.careers), maxTicket: cleanMap(r.maxTicket) };
}

/** The career's run#: its existing one, run 0 with no career, or the next free one for a new career. */
export function runForCareer(index: TicketIndex, careerKey: string): { index: TicketIndex; run: number; created: boolean } {
  if (careerKey === NO_CAREER_KEY) return { index, run: 0, created: false };
  const existing = own(index.careers, careerKey);
  if (existing !== undefined) return { index, run: existing, created: false };
  const used = Object.values(index.careers).filter(isCount);
  const run = Math.max(index.nextRun, used.length ? Math.max(...used) + 1 : 1);
  if (run > MAX_NUMBER) throw new Error('ticket run numbers exhausted');
  // Computed key: an own property even for "__proto__".
  return { index: { ...index, nextRun: run + 1, careers: { ...index.careers, [careerKey]: run } }, run, created: true };
}

/** Next ticket# of a run: one past the highest known, from the index and from the ids already stored. */
export function nextTicketNumber(index: TicketIndex, run: number, existingIds: Iterable<string>): number {
  let max = own(index.maxTicket, String(run)) ?? 0;
  for (const id of existingIds) {
    const p = parseTicketId(id);
    if (p && p.run === run && p.ticket > max) max = p.ticket;
  }
  if (max + 1 > MAX_NUMBER) throw new Error('ticket numbers exhausted');
  return max + 1;
}

export function noteTicket(index: TicketIndex, run: number, ticket: number): TicketIndex {
  const key = String(run);
  return { ...index, maxTicket: { ...index.maxTicket, [key]: Math.max(own(index.maxTicket, key) ?? 0, ticket) } };
}

/** What the next ticket of this career would be called, without reserving anything (dialog preview). */
export function previewNumbers(index: TicketIndex, careerKey: string, existingIds: Iterable<string>): { run: number; ticket: number } {
  const { index: next, run } = runForCareer(index, careerKey);
  return { run, ticket: nextTicketNumber(next, run, existingIds) };
}

/** Assign the run# and ticket# of a ticket being stored now; returns the index to persist with it. */
export function assignNumbers(index: TicketIndex, careerKey: string, existingIds: Iterable<string>): { index: TicketIndex; run: number; ticket: number } {
  const { index: withCareer, run } = runForCareer(index, careerKey);
  const ticket = nextTicketNumber(withCareer, run, existingIds);
  return { index: noteTicket(withCareer, run, ticket), run, ticket };
}

/** The first line of a ticket's text, trimmed for an index row. */
export function firstLine(text: string, max = 120): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** First line plus a marker when the text goes on: "Lineup lost my captain … (+3 lines)". */
export function summaryLine(text: string, max = 120): string {
  const first = firstLine(text, max);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  const more = Math.max(0, lines - 1);
  if (more === 0) return first;
  return `${first}${first.endsWith('…') ? '' : ' …'} (+${more} ${more === 1 ? 'line' : 'lines'})`;
}
