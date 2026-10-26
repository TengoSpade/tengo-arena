/**
 * Playtest tickets: the ID and the run / ticket counters. Pure functions shared by the in-game tool
 * (src/ui/tickets), its IndexedDB fallback (./local-store) and the dev-server plugin
 * (scripts/tickets), so all three name and number tickets the same way.
 *
 * ID: `AL-R{run:3}-T{ticket:3}_{YYYYMMDD-HHMMSS}` in local time, e.g. `AL-R004-T012_20261025-193412`.
 * Windows-safe by construction: ASCII letters, digits, `-` and `_` only.
 * - run#: one per career (keyed by the career's root seed); loading a career reuses its run#.
 * - ticket#: per run, max(existing) + 1, so it stays unique across reloads.
 */

/** Ticket ids, with the run and ticket numbers captured. Numbers grow past 3 digits if ever needed. */
export const TICKET_ID_RE = /^AL-R(\d{3,})-T(\d{3,})_(\d{8})-(\d{6})$/;

export function pad(n: number, width: number): string {
  const v = Math.max(0, Math.trunc(n));
  return String(v).padStart(width, '0');
}

/** Local time as `YYYYMMDD-HHMMSS`. */
export function ticketStamp(at: Date): string {
  return `${at.getFullYear()}${pad(at.getMonth() + 1, 2)}${pad(at.getDate(), 2)}-${pad(at.getHours(), 2)}${pad(at.getMinutes(), 2)}${pad(at.getSeconds(), 2)}`;
}

export function ticketId(run: number, ticket: number, at: Date): string {
  return `AL-R${pad(run, 3)}-T${pad(ticket, 3)}_${ticketStamp(at)}`;
}

export function parseTicketId(id: string): { run: number; ticket: number } | null {
  const m = TICKET_ID_RE.exec(id);
  return m ? { run: Number(m[1]), ticket: Number(m[2]) } : null;
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
  /** Career key (root seed) -> run#. */
  careers: Record<string, number>;
  /** run# -> highest ticket# filed in that run. */
  maxTicket: Record<string, number>;
}

export function emptyTicketIndex(): TicketIndex {
  return { version: 1, nextRun: 1, careers: {}, maxTicket: {} };
}

/** A stored index, repaired: anything malformed starts from an empty index rather than failing a ticket. */
export function readTicketIndex(raw: unknown): TicketIndex {
  const r = raw as Partial<TicketIndex> | null;
  if (!r || r.version !== 1 || typeof r.nextRun !== 'number' || typeof r.careers !== 'object' || typeof r.maxTicket !== 'object') return emptyTicketIndex();
  return { version: 1, nextRun: Math.max(1, Math.trunc(r.nextRun)), careers: { ...r.careers }, maxTicket: { ...r.maxTicket } };
}

/** The career's run#: its existing one, or the next free one for a new career. */
export function runForCareer(index: TicketIndex, careerKey: string): { index: TicketIndex; run: number; created: boolean } {
  const existing = index.careers[careerKey];
  if (existing !== undefined) return { index, run: existing, created: false };
  const used = Object.values(index.careers);
  const run = Math.max(index.nextRun, used.length ? Math.max(...used) + 1 : 1);
  return { index: { ...index, nextRun: run + 1, careers: { ...index.careers, [careerKey]: run } }, run, created: true };
}

/** Next ticket# of a run: one past the highest known, from the index and from the ids already on disk. */
export function nextTicketNumber(index: TicketIndex, run: number, existingIds: Iterable<string>): number {
  let max = index.maxTicket[String(run)] ?? 0;
  for (const id of existingIds) {
    const p = parseTicketId(id);
    if (p && p.run === run && p.ticket > max) max = p.ticket;
  }
  return max + 1;
}

export function noteTicket(index: TicketIndex, run: number, ticket: number): TicketIndex {
  const key = String(run);
  return { ...index, maxTicket: { ...index.maxTicket, [key]: Math.max(index.maxTicket[key] ?? 0, ticket) } };
}

/** The first line of a ticket's text, trimmed for an index row. */
export function firstLine(text: string, max = 120): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
