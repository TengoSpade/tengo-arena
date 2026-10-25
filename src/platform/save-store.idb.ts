/**
 * IndexedDB SaveStore (tech-008). One record per slot { slotId, meta, json };
 * one readwrite transaction per write, so a failed write never replaces the
 * previous record (05 §5). The meta is stored beside the JSON, so the save
 * list never parses a whole save and unreadable saves stay listed.
 */
import type { SaveMeta } from '../core/model';
import type { SaveStore } from './save-store';

interface SaveRecord {
  slotId: string;
  meta: SaveMeta;
  json: string;
}

const STORE = 'saves';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function createIdbSaveStore(dbName = 'arena-league', factory: IDBFactory = indexedDB): SaveStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = factory.open(dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slotId' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          dbPromise = null;
          reject(req.error ?? new Error('IndexedDB open failed'));
        };
      });
    }
    return dbPromise;
  };

  return {
    async list() {
      const db = await open();
      const tx = db.transaction(STORE, 'readonly');
      const records = await request(tx.objectStore(STORE).getAll() as IDBRequest<SaveRecord[]>);
      return records.map((r) => r.meta);
    },
    async read(slotId) {
      const db = await open();
      const tx = db.transaction(STORE, 'readonly');
      const record = await request(tx.objectStore(STORE).get(slotId) as IDBRequest<SaveRecord | undefined>);
      return record ? record.json : null;
    },
    async write(slotId, json, meta) {
      const db = await open();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ slotId, meta: { ...meta, slotId }, json } satisfies SaveRecord);
      await done(tx);
    },
    async remove(slotId) {
      const db = await open();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(slotId);
      await done(tx);
    },
  };
}
