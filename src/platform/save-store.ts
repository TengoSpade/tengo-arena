/**
 * Platform contracts used by the UI store. Owner: WP6 (UI foundation)
 * implements them (IndexedDB, file download/upload, clock, entropy); the
 * desktop build (M7) provides file-system versions. CONTRACT: fixed.
 */
import type { SaveMeta } from '../core/model';

/** Durable save slots. One write = one atomic record (IndexedDB transaction / temp file + rename). */
export interface SaveStore {
  list(): Promise<SaveMeta[]>;
  /** The serialized SaveEnvelope, or null when the slot is empty. */
  read(slotId: string): Promise<string | null>;
  write(slotId: string, json: string, meta: SaveMeta): Promise<void>;
  remove(slotId: string): Promise<void>;
}

/** Wall-clock access (core has none). */
export interface Clock {
  nowIso(): string;
  nowMs(): number;
}

/** Files leaving or entering the app (export / import / state dump). */
export interface FileIO {
  download(fileName: string, text: string): void;
  readText(file: Blob): Promise<string>;
}

/** Autosave slots rotate over these ids (TUNABLE (tech): 3). */
export const AUTOSAVE_SLOTS = ['auto-1', 'auto-2', 'auto-3'] as const;
/** Manual slots (TUNABLE (tech): 10). */
export const MANUAL_SLOT_COUNT = 10;
