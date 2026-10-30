import type { SeasonPhase } from './calendar';
import type { CommandLogEntry } from './commands';
import type { ContentRef, GameState } from './game-state';
import type { ClubId, WeekId } from './ids';

export const SAVE_FORMAT = 'arena-league-save';

/**
 * A save file / storage record. Plain JSON. core/save serializes, validates
 * and migrates it; src/platform stores it (IndexedDB in the browser, files in
 * the desktop build) and handles export/import.
 */
export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  /** GameState schema version of `state` (STATE_SCHEMA_VERSION when written). */
  schemaVersion: number;
  /** Sim ENGINE_VERSION at write time (replays need the same engine). */
  engineVersion: number;
  content: ContentRef;
  meta: SaveMeta;
  /** hashString(stableStringify(state)); detects corruption and hand edits. */
  checksum: string;
  state: GameState;
  /** Diagnostics only (state dumps): commands applied since the previous save. */
  commandLog?: CommandLogEntry[];
}

/** Summary shown in the load screen without parsing the whole state. */
export interface SaveMeta {
  slotId: string;
  kind: SaveKind;
  /** Player-visible label (club name + season by default). */
  label: string;
  /** ISO 8601 wall-clock time supplied by the platform layer (core has no clock). */
  savedAt: string;
  /** App version (package.json version) that wrote the save. */
  gameVersion: string;
  season: number;
  weekIndex: number;
  weekId: WeekId | null;
  phase: SeasonPhase;
  playerClubId: ClubId | null;
  playerClubName: string | null;
  /** Accumulated play time in seconds, supplied by the platform layer. */
  playtimeSec: number;
  /**
   * Optional (additive): one id per career, made by the platform layer when a new career starts and
   * kept in every save of it (playtest tickets number runs by it). Older saves have none.
   */
  careerId?: string;
}

export type SaveKind = 'manual' | 'auto';

/** Stable error codes of save parsing (UI maps them to text). */
export type SaveErrorCode =
  | 'save.json'
  | 'save.format'
  | 'save.too-new'
  | 'save.checksum'
  | 'save.migration'
  | 'save.structure'
  | 'save.references'
  | 'save.content-missing'
  | 'save.storage';

export interface SaveError {
  code: SaveErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
