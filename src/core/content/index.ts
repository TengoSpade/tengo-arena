/**
 * core/content — public API (phase A placeholder; implemented in phase B).
 *
 * Planned API (see README.md and docs/design 05 §4):
 *   loadContent(themeId, raw: RawContentFiles): Result<ContentDB, ContentIssue[]>
 *   hashContent(raw): string
 *   formatContentIssues(issues): string
 *
 * Content types are inferred from zod schemas here (`z.infer<typeof ClassSchema>`),
 * so the schema is the single source of truth for both validation and types.
 */
import type { ContentRef } from '../model';

/** The content files every theme must provide (content/<theme>/<name>.json). */
export const CONTENT_FILE_NAMES = [
  'combat',
  'classes',
  'abilities',
  'tactics-presets',
  'races',
  'traits',
  'names',
  'development',
  'leagues',
  'clubs',
  'economy',
] as const;

export type ContentFileName = (typeof CONTENT_FILE_NAMES)[number];

/** Parsed-but-unvalidated JSON per file, as read by a platform loader (Vite glob in the browser, fs in Node). */
export type RawContentFiles = Partial<Record<ContentFileName, unknown>>;

/** One validation problem, precise enough for a designer to fix without reading code. */
export interface ContentIssue {
  file: ContentFileName | string;
  /** JSON path inside the file, e.g. "classes[12].abilities[1]". */
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validated, indexed content. PLACEHOLDER: phase B replaces this with typed
 * registries (classes, abilities, races, ...) inferred from the schemas.
 */
export interface ContentDB {
  readonly ref: ContentRef;
}
