/**
 * Browser content loader: bundles content/<theme>/*.json at build time with
 * Vite's import.meta.glob (works offline, hashed into the bundle, hot-reloads
 * when a designer edits a JSON file). Validation is core/content's job.
 */
import { CONTENT_FILE_NAMES, type ContentFileName, type RawContentFiles } from '../core/content';

const FILES = import.meta.glob('/content/*/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export interface ThemeFiles {
  themeId: string;
  raw: RawContentFiles;
  found: ContentFileName[];
  missing: ContentFileName[];
  /** JSON files in the theme folder that are not part of the content contract. */
  extra: string[];
}

export function listThemes(): string[] {
  const themes = new Set<string>();
  for (const path of Object.keys(FILES)) {
    const theme = path.split('/')[2];
    if (theme) themes.add(theme);
  }
  return [...themes].sort();
}

export function loadThemeFiles(themeId: string, files: Record<string, unknown> = FILES): ThemeFiles {
  const raw: RawContentFiles = {};
  const found: ContentFileName[] = [];
  const extra: string[] = [];
  const known = new Set<string>(CONTENT_FILE_NAMES);
  const prefix = `/content/${themeId}/`;
  for (const [path, value] of Object.entries(files)) {
    if (!path.startsWith(prefix)) continue;
    const name = path.slice(prefix.length).replace(/\.json$/, '');
    if (known.has(name)) {
      raw[name as ContentFileName] = value;
      found.push(name as ContentFileName);
    } else {
      extra.push(`${name}.json`);
    }
  }
  const missing = CONTENT_FILE_NAMES.filter((n) => !found.includes(n));
  return { themeId, raw, found: CONTENT_FILE_NAMES.filter((n) => found.includes(n)), missing, extra: extra.sort() };
}
