/**
 * Ticket storage without the dev server (preview / production builds): IndexedDB, with the same
 * ids and counters as the dev-server plugin. The logic runs on a tiny key-value interface so tests
 * use an in-memory fake.
 */
import { firstLine, nextTicketNumber, noteTicket, readTicketIndex, runForCareer, type TicketIndex } from './naming';

/** Minimal async key-value store (IndexedDB in the browser, a Map in tests). */
export interface TicketKv {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export interface StoredTicket {
  id: string;
  run: number;
  ticket: number;
  careerKey: string;
  /** PNG as a data URL. */
  screenshot: string;
  /** The save JSON (existing serializer), or null without a career. */
  state: string | null;
  /** ticket.json content. */
  meta: Record<string, unknown>;
}

export interface TicketSummary {
  id: string;
  created: string;
  screen: string;
  firstLine: string;
}

const INDEX_KEY = 'index';
const TICKET_PREFIX = 'ticket:';

export function createLocalTicketStore(kv: TicketKv) {
  const readIndex = async (): Promise<TicketIndex> => readTicketIndex(await kv.get(INDEX_KEY));

  return {
    /** The run# for this career (created for a new one) and the next ticket#. */
    async next(careerKey: string): Promise<{ run: number; ticket: number }> {
      const { index, run, created } = runForCareer(await readIndex(), careerKey);
      if (created) await kv.set(INDEX_KEY, index);
      const ids = (await kv.keys(TICKET_PREFIX)).map((k) => k.slice(TICKET_PREFIX.length));
      return { run, ticket: nextTicketNumber(index, run, ids) };
    },

    /** Store a ticket; refuses an id that is taken. */
    async save(t: StoredTicket): Promise<void> {
      const key = TICKET_PREFIX + t.id;
      if ((await kv.get(key)) !== undefined) throw new Error(`ticket ${t.id} exists`);
      await kv.set(key, t);
      const { index } = runForCareer(await readIndex(), t.careerKey);
      await kv.set(INDEX_KEY, noteTicket(index, t.run, t.ticket));
    },

    async list(): Promise<TicketSummary[]> {
      const out: TicketSummary[] = [];
      for (const key of await kv.keys(TICKET_PREFIX)) {
        const t = (await kv.get(key)) as StoredTicket | undefined;
        if (!t) continue;
        out.push({ id: t.id, created: String(t.meta['createdLocal'] ?? t.meta['created'] ?? ''), screen: String(t.meta['screen'] ?? ''), firstLine: firstLine(String(t.meta['text'] ?? '')) });
      }
      return out.sort((a, b) => (a.id < b.id ? 1 : -1));
    },

    /** Every ticket as one JSON document (screenshots stay data URLs). */
    async exportAll(): Promise<string> {
      const tickets: StoredTicket[] = [];
      for (const key of await kv.keys(TICKET_PREFIX)) {
        const t = (await kv.get(key)) as StoredTicket | undefined;
        if (t) tickets.push(t);
      }
      tickets.sort((a, b) => (a.id < b.id ? -1 : 1));
      return JSON.stringify({ format: 'arena-league-tickets', version: 1, exportedAt: new Date().toISOString(), index: await readIndex(), tickets }, null, 1);
    },
  };
}

export type LocalTicketStore = ReturnType<typeof createLocalTicketStore>;


/** IndexedDB key-value store for tickets (one object store, out-of-line keys). */
export function idbTicketKv(dbName = 'arena-league-tickets'): TicketKv {
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () =>
    (dbp ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
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
    keys: async (prefix) => ((await run('readonly', (s) => s.getAllKeys())) as IDBValidKey[]).map(String).filter((k) => k.startsWith(prefix)),
  };
}
