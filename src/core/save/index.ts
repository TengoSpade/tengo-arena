/**
 * core/save — save envelope, checksum, validation and migrations (R7,
 * open-016). Owner: WP5.
 *
 * Pure: no storage access. src/platform stores the JSON (IndexedDB in the
 * browser, files in the desktop build) and calls these functions.
 *
 * parseSave order (05 §3.3): JSON -> format -> schemaVersion not newer
 * (save.too-new) -> checksum of the state as written, by the rule of the
 * save's schema version (save.checksum; ./encode.ts) ->
 * stepwise migrations (save.migration) -> structure (save.structure) ->
 * content ids (save.content-missing; a different content hash with every id
 * present loads with a warning) -> references and the ledger invariant
 * (save.references). A failed parse never returns a partial state.
 */
import type { ContentDB } from '../content';
import {
  SAVE_FORMAT,
  STATE_SCHEMA_VERSION,
  type CommandLogEntry,
  type GameState,
  type SaveEnvelope,
  type SaveError,
  type SaveErrorCode,
  type SaveKind,
  type SaveMeta,
} from '../model';
import { err, ok, type Result } from '../util';
import { checksumFor, checksumV2, stateText } from './encode';
import { MIGRATIONS, type Migration } from './migrations';
import { EnvelopeHeaderSchema, formatZodPath } from './schema';
import { checkState, type StateIssue } from './validate';

export type { StateIssue } from './validate';
export { GameStateSchema } from './schema';
export { MIGRATIONS, migrateV1ToV2, type Migration } from './migrations';
export { checksumV1 } from './encode';

/** Checksum of a current-version state (v2 rule: the state as written, ./encode.ts). */
export function checksumState(state: GameState): string {
  return checksumV2(state);
}

/** Meta for a save of the current state (clock values come from the platform). */
export function saveMetaFor(
  state: GameState,
  params: { slotId: string; kind: SaveKind; label: string; savedAt: string; playtimeSec: number; gameVersion: string },
): SaveMeta {
  const club = state.playerClubId === null ? undefined : state.clubs[state.playerClubId];
  return {
    slotId: params.slotId,
    kind: params.kind,
    label: params.label,
    savedAt: params.savedAt,
    gameVersion: params.gameVersion,
    season: state.calendar.season,
    weekIndex: state.calendar.weekIndex,
    weekId: state.calendar.weekId,
    phase: state.calendar.phase,
    playerClubId: state.playerClubId,
    playerClubName: club ? club.name : null,
    playtimeSec: Math.max(0, Math.trunc(params.playtimeSec)),
  };
}

export function createSave(
  state: GameState,
  meta: SaveMeta,
  versions: { engineVersion: number },
  commandLog?: readonly CommandLogEntry[],
): SaveEnvelope {
  const envelope: SaveEnvelope = {
    format: SAVE_FORMAT,
    schemaVersion: state.schemaVersion,
    engineVersion: versions.engineVersion,
    content: { id: state.content.id, hash: state.content.hash },
    meta,
    checksum: checksumState(state),
    state,
  };
  if (commandLog !== undefined) envelope.commandLog = [...commandLog];
  return envelope;
}

/**
 * Plain JSON, identical to JSON.stringify(envelope); the state's write-once
 * parts reuse their cached text (./encode.ts), so an autosave costs about the
 * mutable part of the state, not the whole career.
 */
export function serializeSave(envelope: SaveEnvelope): string {
  const parts: string[] = [];
  const env = envelope as unknown as Record<string, unknown>;
  for (const key of Object.keys(env)) {
    const v = env[key];
    if (v === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${key === 'state' && v !== null && typeof v === 'object' ? stateText(v) : JSON.stringify(v)}`);
  }
  return `{${parts.join(',')}}`;
}

export interface ParsedSave {
  envelope: SaveEnvelope;
  /** Schema version the save had before migration, or null when current. */
  migratedFrom: number | null;
  warnings: string[];
}

/** Parse untrusted JSON: format, version, checksum, migrations, structure, references, content compatibility. */
export function parseSave(json: string, content: ContentDB): Result<ParsedSave, SaveError> {
  return parseSaveWith(json, content, { migrations: MIGRATIONS, currentVersion: STATE_SCHEMA_VERSION });
}

/** parseSave with an explicit migration list and current version (tests of the migration runner). */
export function parseSaveWith(
  json: string,
  content: ContentDB,
  options: { migrations: readonly Migration[]; currentVersion: number },
): Result<ParsedSave, SaveError> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return fail('save.json', `Save is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== SAVE_FORMAT) {
    return fail('save.format', `Not an ${SAVE_FORMAT} file`);
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version === 'number' && Number.isInteger(version) && version > options.currentVersion) {
    return fail('save.too-new', `Save schema version ${version} is newer than this build (${options.currentVersion})`, {
      saveVersion: version,
      buildVersion: options.currentVersion,
    });
  }
  const header = EnvelopeHeaderSchema.safeParse(raw);
  if (!header.success) {
    const first = header.error.issues[0];
    return fail('save.format', `Malformed save envelope at ${first ? formatZodPath(first.path) : '?'}: ${first?.message ?? ''}`);
  }
  const env = header.data;
  if (typeof env.state !== 'object' || env.state === null) return fail('save.structure', 'Save has no state');

  let actual: string;
  try {
    actual = checksumFor(env.schemaVersion, env.state);
  } catch (e) {
    return fail('save.structure', `State is not plain JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (actual !== env.checksum) {
    return fail('save.checksum', 'Save checksum does not match its contents (corrupted or edited)', { expected: env.checksum, actual });
  }

  // Stepwise migrations (pure functions vN -> vN+1).
  let state: unknown = env.state;
  let v = env.schemaVersion;
  const migratedFrom = v < options.currentVersion ? v : null;
  while (v < options.currentVersion) {
    const step = options.migrations.find((m) => m.from === v);
    if (!step || step.to !== v + 1) return fail('save.migration', `No migration from schema version ${v}`, { from: v });
    try {
      state = step.migrate(state);
    } catch (e) {
      return fail('save.migration', `Migration ${step.from} -> ${step.to} failed: ${e instanceof Error ? e.message : String(e)}`, { from: v });
    }
    v = step.to;
    if (typeof state === 'object' && state !== null) (state as { schemaVersion: number }).schemaVersion = v;
  }

  const check = checkState(state, content);
  if (check.structure.length > 0) {
    return fail('save.structure', `Save state is malformed: ${describe(check.structure)}`, { issues: check.structure });
  }
  const gs = state as GameState;
  const warnings: string[] = [];
  if (gs.content.id !== content.ref.id || env.content.id !== content.ref.id) {
    return fail('save.content-missing', `Save uses theme "${gs.content.id}", the game loaded "${content.ref.id}"`, {
      saveTheme: gs.content.id,
      loadedTheme: content.ref.id,
    });
  }
  if (check.content.length > 0) {
    return fail('save.content-missing', `Save refers to content that no longer exists: ${describe(check.content)}`, { issues: check.content });
  }
  if (gs.content.hash !== content.ref.hash) {
    warnings.push(`Save was made with different content (hash ${gs.content.hash}, loaded ${content.ref.hash}); every referenced id exists`);
  }
  if (check.references.length > 0) {
    return fail('save.references', `Save has broken references: ${describe(check.references)}`, { issues: check.references });
  }
  if (gs.schemaVersion !== options.currentVersion) {
    return fail('save.structure', `State schemaVersion ${gs.schemaVersion} does not match ${options.currentVersion}`);
  }

  const envelope: SaveEnvelope = {
    format: SAVE_FORMAT,
    schemaVersion: options.currentVersion,
    engineVersion: env.engineVersion,
    content: { id: env.content.id, hash: env.content.hash },
    meta: env.meta as SaveMeta,
    checksum: migratedFrom === null ? env.checksum : checksumState(gs),
    state: gs,
  };
  if (env.commandLog !== undefined) envelope.commandLog = env.commandLog as CommandLogEntry[];
  return ok({ envelope, migratedFrom, warnings });
}

/** Structural and referential checks of a state (also used by the soak harness after every season). */
export function validateState(state: GameState, content: ContentDB): StateIssue[] {
  const check = checkState(state, content);
  return [...check.structure, ...check.content, ...check.references];
}

function describe(issues: readonly StateIssue[]): string {
  const shown = issues.slice(0, 3).map((i) => `${i.path}: ${i.message}`);
  return issues.length > 3 ? `${shown.join('; ')} (+${issues.length - 3} more)` : shown.join('; ');
}

function fail(code: SaveErrorCode, message: string, details?: Record<string, unknown>): Result<never, SaveError> {
  return err(details === undefined ? { code, message } : { code, message, details });
}
