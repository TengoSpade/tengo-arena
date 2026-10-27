/**
 * Vite build plugin: ships content/<theme>/*.json without its documentation keys.
 *
 * Every key that starts with "_" (`_doc`, `_note`, `_label`, ...) is prose for designers; no code reads
 * it (src/core/content/doc-keys.ts). About a sixth of the gzipped content is such prose, and it is
 * fetched on every launch. The source files stay untouched; `npm run validate-content` and the tests
 * read them as written, and the shipped files pass the same validation.
 *
 * The content hash is part of the content's identity (saves, fight headers; a stored match result
 * re-simulates for its report only under the same hash), and it is computed over the files as written.
 * So the plugin also computes it from the source files at build time and defines `__CONTENT_HASHES__`
 * (theme id -> hash) for src/platform/content-bundle.ts, which hands it to loadContent.
 *
 * `apply: 'build'`: the dev server and Vitest keep serving the files as written (designers see their
 * notes' effects, hot reload is unchanged) and hash them as they are. `enforce: 'pre'`: runs on the JSON
 * text, before Vite's own JSON-to-module step. Only files under <root>/content/ are touched (not the
 * test fixture in core/testkit).
 */
import { tsImport } from 'tsx/esm/api';
import type { Plugin } from 'vite';
import { normalizePath } from 'vite';
import type * as NodeContent from '../lib/node-content.ts';
import { stripDocKeys } from '../../src/core/content/doc-keys.ts';

/** True for `<root>/content/<theme>/<file>.json` (id as Vite gives it, query already removed). */
export function isContentJson(id: string, contentDir: string): boolean {
  return id.startsWith(contentDir) && id.endsWith('.json');
}

/** The JSON text without documentation keys (compact). Throws on invalid JSON. */
export function stripDocKeysFromJson(text: string): string {
  return JSON.stringify(stripDocKeys(JSON.parse(text)));
}

/**
 * Content hash of every theme folder of content/, over the source files as written (scripts/lib/node-content.ts).
 * The core is loaded through tsx, not imported, so it stays out of the config bundle that Vite builds (and
 * Vitest and the dev server read); only a production build calls this.
 */
export async function sourceContentHashes(): Promise<Record<string, string>> {
  const nodeContent = (await tsImport('../lib/node-content.ts', import.meta.url)) as typeof NodeContent;
  return nodeContent.sourceContentHashes();
}

export function stripDocKeysPlugin(): Plugin {
  let contentDir = '';
  return {
    name: 'arena-strip-doc-keys',
    apply: 'build',
    enforce: 'pre',
    async config() {
      return { define: { __CONTENT_HASHES__: JSON.stringify(await sourceContentHashes()) } };
    },
    configResolved(config) {
      contentDir = `${normalizePath(config.root)}/content/`;
    },
    transform(code, id) {
      const file = normalizePath(id.split('?')[0]!);
      if (!isContentJson(file, contentDir)) return null;
      return { code: stripDocKeysFromJson(code), map: null };
    },
  };
}
