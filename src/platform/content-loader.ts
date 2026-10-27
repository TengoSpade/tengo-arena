/**
 * Browser content loader. The theme files (content/<theme>/*.json) are a separate chunk of the build
 * (./content-bundle.ts, reached through a dynamic import only), so they stay out of the main bundle that
 * the first paint waits for: startup renders a loading state, awaits `loadBundledTheme`, then validates
 * (core/content's job) and mounts. The chunk is a same-origin file of dist/, hashed and cached like the
 * rest, so it works offline and inside a desktop shell that serves dist/ over its own scheme; there is no
 * other network access. In dev the same module hot-reloads when a designer edits a JSON file.
 */
import { CONTENT_FILE_NAMES, type ContentFileName, type RawContentFiles } from '../core/content';

export interface ThemeFiles {
  themeId: string;
  raw: RawContentFiles;
  found: ContentFileName[];
  missing: ContentFileName[];
  /** JSON files in the theme folder that are not part of the content contract. */
  extra: string[];
  /** Hash of the source files, when `raw` was shipped without its `_` doc keys (production build); otherwise unset. */
  hash?: string;
}

/** Theme folders present in a glob result (keys like `/content/<theme>/<file>.json`). */
export function listThemes(files: Record<string, unknown>): string[] {
  const themes = new Set<string>();
  for (const path of Object.keys(files)) {
    const theme = path.split('/')[2];
    if (theme) themes.add(theme);
  }
  return [...themes].sort();
}

/** Group a glob result (keys like `/content/<theme>/<file>.json`) into one theme's raw files. */
export function loadThemeFiles(themeId: string, files: Record<string, unknown>): ThemeFiles {
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

/**
 * Fetch the content chunk and return one theme's files. Rejects when the chunk cannot be loaded (the caller
 * turns that into the content-error screen). Call it as early as possible; it resolves once per page.
 */
export async function loadBundledTheme(themeId: string): Promise<ThemeFiles> {
  const { CONTENT_FILES, CONTENT_HASHES } = await import('./content-bundle');
  const theme = loadThemeFiles(themeId, CONTENT_FILES);
  const hash = CONTENT_HASHES?.[themeId];
  return hash === undefined ? theme : { ...theme, hash };
}
