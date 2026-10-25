/**
 * core/save — save envelope, checksum, validation and migrations (R7,
 * open-016). Owner: WP5. CONTRACT: signatures fixed; bodies are stubs
 * except the pure helpers already implemented below.
 *
 * Pure: no storage access. src/platform stores the JSON (IndexedDB in the
 * browser, files in the desktop build) and calls these functions.
 */
import type { ContentDB } from '../content';
import type { CommandLogEntry, GameState, SaveEnvelope, SaveError, SaveKind, SaveMeta } from '../model';
import { hashString, notImplemented, stableStringify, type Result } from '../util';

/** One migration step of the GameState shape. */
export interface Migration {
  from: number;
  to: number;
  migrate(state: unknown): unknown;
}

/** Ordered migrations; empty while STATE_SCHEMA_VERSION is 1. */
export const MIGRATIONS: readonly Migration[] = [];

/** hashString(stableStringify(state)). */
export function checksumState(state: GameState): string {
  return hashString(stableStringify(state));
}

/** Meta for a save of the current state (clock values come from the platform). */
export function saveMetaFor(
  state: GameState,
  params: { slotId: string; kind: SaveKind; label: string; savedAt: string; playtimeSec: number; gameVersion: string },
): SaveMeta {
  return notImplemented('save.saveMetaFor', state, params);
}

export function createSave(
  state: GameState,
  meta: SaveMeta,
  versions: { engineVersion: number },
  commandLog?: readonly CommandLogEntry[],
): SaveEnvelope {
  return notImplemented('save.createSave', state, meta, versions, commandLog);
}

export function serializeSave(envelope: SaveEnvelope): string {
  return notImplemented('save.serializeSave', envelope);
}

export interface ParsedSave {
  envelope: SaveEnvelope;
  /** Schema version the save had before migration, or null when current. */
  migratedFrom: number | null;
  warnings: string[];
}

/** Parse untrusted JSON: format, version, checksum, migrations, structure, references, content compatibility. */
export function parseSave(json: string, content: ContentDB): Result<ParsedSave, SaveError> {
  return notImplemented('save.parseSave', json, content);
}

export interface StateIssue {
  path: string;
  message: string;
}

/** Structural and referential checks of a state (also used by the soak harness after every season). */
export function validateState(state: GameState, content: ContentDB): StateIssue[] {
  return notImplemented('save.validateState', state, content);
}
