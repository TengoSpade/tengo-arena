/**
 * In-memory SaveStore: tests, and the fallback when IndexedDB is unavailable
 * (private windows). `failNextWrite` simulates an interrupted write.
 */
import type { SaveMeta } from '../core/model';
import type { SaveStore } from './save-store';

export interface MemorySaveStore extends SaveStore {
  /** Make the next write reject (the previous record stays). */
  failNextWrite(error?: Error): void;
  /** Raw records for assertions. */
  readonly records: Map<string, { meta: SaveMeta; json: string }>;
}

export function createMemorySaveStore(): MemorySaveStore {
  const records = new Map<string, { meta: SaveMeta; json: string }>();
  let failWith: Error | null = null;
  return {
    records,
    failNextWrite(error = new Error('simulated write failure')) {
      failWith = error;
    },
    async list() {
      return [...records.values()].map((r) => r.meta);
    },
    async read(slotId) {
      return records.get(slotId)?.json ?? null;
    },
    async write(slotId, json, meta) {
      if (failWith) {
        const e = failWith;
        failWith = null;
        throw e;
      }
      records.set(slotId, { meta: { ...meta, slotId }, json });
    },
    async remove(slotId) {
      records.delete(slotId);
    },
  };
}
