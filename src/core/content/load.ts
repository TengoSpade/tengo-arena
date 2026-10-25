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
}

/** Content hash stored in saves, fight headers and GameState.content: hash of the raw files. */
export function hashContent(raw: RawContentFiles): string {
  return hashString(stableStringify(raw));
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
  return ok(buildContentDB({ id: themeId, hash: hashContent(raw) }, files, issues));
}
