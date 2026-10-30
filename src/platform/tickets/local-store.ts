/**
 * Ticket storage without the dev server (preview / production builds): IndexedDB, with the same
 * ids and counters as the dev-server plugin. Each ticket is stored twice: the full record
 * (`ticket:<id>`, screenshot and save inside) and a small summary (`summary:<id>`) so the
 * Settings list never loads screenshots. The logic runs on a tiny key-value interface so tests use
 * an in-memory fake.
 */
import { assignNumbers, previewNumbers, readTicketIndex, summaryLine, ticketIdFromStamp, type TicketIndex } from './naming';

/** Minimal async key-value store (IndexedDB in the browser, a Map in tests). */
export interface TicketKv {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

/** A ticket as filed, before it has numbers. */
export interface NewTicket {
  careerKey: string;
  /** Local `YYYYMMDD-HHMMSS` of the F8 press. */
  stamp: string;
  text: string;
  /** PNG as a data URL. */
  screenshot: string;
  /** The save JSON (existing serializer), or null without a career. */
  state: string | null;
  /** ticket.json content (without id / numbers / text). */
  meta: Record<string, unknown>;
}

export interface StoredTicket extends NewTicket {
  id: string;
  run: number;
  ticket: number;
}

export interface TicketSummary {
  id: string;
  created: string;
  screen: string;
  firstLine: string;
}

const INDEX_KEY = 'index';
const TICKET_PREFIX = 'ticket:';
const SUMMARY_PREFIX = 'summary:';

export function createLocalTicketStore(kv: TicketKv) {
  const readIndex = async (): Promise<TicketIndex> => readTicketIndex(await kv.get(INDEX_KEY));
  const ids = async () => (await kv.keys(TICKET_PREFIX)).map((k) => k.slice(TICKET_PREFIX.length));
  // One write at a time within this tab, so two quick tickets never share a number.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    /** What the next ticket of this career would be called (nothing is reserved). */
    async next(careerKey: string): Promise<{ run: number; ticket: number }> {
      return previewNumbers(await readIndex(), careerKey, await ids());
    },

    /** Number and store a ticket; returns it with its final id. */
    add(t: NewTicket): Promise<StoredTicket> {
      return serial(async () => {
        const { index, run, ticket } = assignNumbers(await readIndex(), t.careerKey, await ids());
        const id = ticketIdFromStamp(run, ticket, t.stamp);
        const stored: StoredTicket = { ...t, id, run, ticket, meta: { ...t.meta, id, run, ticket, careerKey: t.careerKey, text: t.text } };
        const summary: TicketSummary = { id, created: String(t.meta['createdLocal'] ?? t.meta['created'] ?? ''), screen: String(t.meta['screen'] ?? ''), firstLine: summaryLine(t.text) };
        await kv.set(TICKET_PREFIX + id, stored);
        await kv.set(SUMMARY_PREFIX + id, summary);
        await kv.set(INDEX_KEY, index);
        return stored;
      });
    },

    /** Summaries only (newest first); the screenshots stay in IndexedDB. */
    async list(): Promise<TicketSummary[]> {
      const out: TicketSummary[] = [];
      for (const key of await kv.keys(SUMMARY_PREFIX)) {
        const s = (await kv.get(key)) as TicketSummary | undefined;
        if (s) out.push(s);
      }
      return out.sort((a, b) => (a.id < b.id ? 1 : -1));
    },

    async remove(id: string): Promise<void> {
      await kv.delete(TICKET_PREFIX + id);
      await kv.delete(SUMMARY_PREFIX + id);
    },

    /**
     * Every ticket as one JSON document, built as one part per ticket (screenshots stay data URLs) so
     * no single giant string is made; `new Blob(parts)` is the export file.
     */
    async exportParts(): Promise<BlobPart[]> {
      const keys = (await kv.keys(TICKET_PREFIX)).sort();
      const head = { format: 'arena-league-tickets', version: 1, exportedAt: new Date().toISOString(), index: await readIndex() };
      const parts: BlobPart[] = [`${JSON.stringify(head).slice(0, -1)},"tickets":[`];
      let first = true;
      for (const key of keys) {
        const t = await kv.get(key);
        if (!t) continue;
        parts.push(first ? '' : ',', JSON.stringify(t));
        first = false;
      }
      parts.push(']}');
      return parts;
    },
  };
}

export type LocalTicketStore = ReturnType<typeof createLocalTicketStore>;

/** IndexedDB key-value store for tickets (one object store, out-of-line keys). Rejects when IndexedDB is unavailable. */
export function idbTicketKv(dbName = 'arena-league-tickets'): TicketKv {
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () =>
    (dbp ??= new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this browser'));
        return;
      }
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB could not be opened'));
    }));
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    db().then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const req = fn(d.transaction('kv', mode).objectStore('kv'));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    set: async (key, value) => {
      await run('readwrite', (s) => s.put(value, key));
    },
    delete: async (key) => {
      await run('readwrite', (s) => s.delete(key));
    },
    keys: async (prefix) => ((await run('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)))) as IDBValidKey[]).map(String),
  };
}
