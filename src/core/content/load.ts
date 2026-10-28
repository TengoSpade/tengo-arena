import { deepFreeze, err, hashString, ok, stableStringify, type Result } from '../util';
import { buildContentDB, type ContentDB } from './db';
import { formatPath, type ContentIssue } from './issues';
import { CONTENT_SCHEMAS, type ContentFileName, type ContentFiles } from './schema';
import { validateContentFiles, type ValidationProfile } from './validate';

/** The content files every theme must provide (content/<theme>/<name>.json). */
export const CONTENT_FILE_NAMES = Object.keys(CONTENT_SCHEMAS) as ContentFileName[];

/** Parsed-but-unvalidated JSON per file, as read by a platform loader (Vite glob in the browser, fs in Node). */
export type RawContentFiles = Partial<Record<ContentFileName, unknown>>;

export interface LoadContentOptions {
  /** 'theme' (default) enforces the shipped-theme count rules; 'fixture' is for small test sets. */
  profile?: ValidationProfile;
  /**
   * The content hash to record, when `raw` is not the source as written: a production build ships
   * the files without their `_` doc keys (core/content/doc-keys.ts) and carries the hash of the
   * source files from build time. Defaults to hashContent(raw).
   */
  hash?: string;
}

/**
 * Content hash stored in saves, fight headers and GameState.content: hash of the raw files as written, doc
 * keys included. It is part of the content's identity (a stored match result re-simulates for its report
 * only under the same hash), so every way of loading the same files must give the same value; the
 * production build, which ships the files without their doc keys, passes the source hash in
 * `LoadContentOptions.hash`.
 */
export function hashContent(raw: RawContentFiles): string {
  return hashString(stableStringify(withoutHashExcluded(raw)));
}

/**
 * Content keys left out of the hash because no result, replay or save depends on their value: `leagues.json
 * matchRecords` only decides how soon a match between other clubs is compacted to keep a save small, and the game
 * is identical either way (core/game compaction.test.ts). Were it hashed, tuning it would change the content
 * identity and every stored match of a loaded career would lose its rebuilt timeline ("the content changed since
 * the match"). A content set without the key hashes exactly as it did before the key existed.
 */
const HASH_EXCLUDED: readonly (readonly [file: ContentFileName, key: string])[] = [['leagues', 'matchRecords']];

function withoutHashExcluded(raw: RawContentFiles): RawContentFiles {
  let out = raw;
  for (const [file, key] of HASH_EXCLUDED) {
    const content = raw[file];
    if (content === null || typeof content !== 'object' || !(key in content)) continue;
    const rest: Record<string, unknown> = { ...(content as Record<string, unknown>) };
    delete rest[key];
    out = { ...out, [file]: rest };
  }
  return out;
}

/** Schema-validate every file; collects every issue across all files. */
export function parseContentFiles(raw: RawContentFiles): Result<ContentFiles, ContentIssue[]> {
  const issues: ContentIssue[] = [];
  const parsed: Partial<Record<ContentFileName, unknown>> = {};
  for (const name of CONTENT_FILE_NAMES) {
    const file = `${name}.json`;
    const value = raw[name];
    if (value === undefined) {
      issues.push({ file, path: '', message: 'file is missing', severity: 'error' });
      continue;
    }
    const result = CONTENT_SCHEMAS[name].safeParse(value);
    if (result.success) parsed[name] = result.data;
    else {
      for (const i of result.error.issues) {
        issues.push({ file, path: formatPath(i.path), message: i.message, severity: 'error' });
      }
    }
  }
  if (issues.length > 0) return err(issues);
  return ok(parsed as ContentFiles);
}

/**
 * Validate raw content and build the ContentDB. Fails with every error found
 * (schema errors first; cross-file errors only when all files parse).
 * Warnings do not fail loading; they are kept on ContentDB.warnings.
 */
export function loadContent(
  themeId: string,
  raw: RawContentFiles,
  options: LoadContentOptions = {},
): Result<ContentDB, ContentIssue[]> {
  const parsed = parseContentFiles(raw);
  if (!parsed.ok) return parsed;
  const issues = validateContentFiles(parsed.value, options.profile ?? 'theme');
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) return err(issues);
  const files = deepFreeze(parsed.value);
  return ok(buildContentDB({ id: themeId, hash: options.hash ?? hashContent(raw) }, files, issues));
}
