/**
 * The shipped content, as a module of its own. Nothing may import this file statically: it is reached only
 * through `import('./content-bundle')` in content-loader.ts, so the bundler emits all of content/<theme>/*.json
 * as one separate chunk (a same-origin file of the build, no network beyond that) instead of folding it
 * into the main bundle. Vite's import.meta.glob keeps dev hot reload.
 *
 * The production build strips the `_` documentation keys from these files and defines
 * `__CONTENT_HASHES__` (scripts/vite/strip-doc-keys.ts): per theme, the content hash of the files as
 * written, so a shipped build has the same content identity as the source files, the tests and the
 * headless harnesses. Dev and tests do not define it; the loader then hashes the files it has.
 */
declare const __CONTENT_HASHES__: Record<string, string> | undefined;

export const CONTENT_FILES = import.meta.glob('/content/*/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export const CONTENT_HASHES: Record<string, string> | undefined = typeof __CONTENT_HASHES__ === 'undefined' ? undefined : __CONTENT_HASHES__;
