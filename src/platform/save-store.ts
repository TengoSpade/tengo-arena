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

/**
 * Autosave slots rotate over these ids (TUNABLE (tech): 3), one write per week boundary (after a week is
 * processed, after the season-end step, and when a career starts), so three of them cover the last
 * three weeks and a bad week can be rolled back.
 */
export const AUTOSAVE_SLOTS = ['auto-1', 'auto-2', 'auto-3'] as const;
/**
 * The match in progress: its own slot, overwritten after every round of the player's match (a reload resumes
 * on the same between-round screen without rerolling a round). It never takes a weekly slot.
 */
export const AUTOSAVE_ROUND_SLOT = 'auto-round';
/** Manual slots (TUNABLE (tech): 10). */
export const MANUAL_SLOT_COUNT = 10;
