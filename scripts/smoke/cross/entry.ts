/**
 * Browser entry of the cross-runtime check: bundled to one script by the smoke driver (Vite library build) and
 * injected into a blank page. It loads content/default exactly as the game's content chunk does (the JSON files,
 * validated by core/content) and exposes the cases as window.__smokeCross.run().
 */
import { CONTENT_FILE_NAMES, loadContent, type RawContentFiles } from '../../../src/core/content';
import { runCrossCases } from './cases';

const files = import.meta.glob('../../../content/default/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const raw: RawContentFiles = {};
for (const name of CONTENT_FILE_NAMES) {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}.json`));
  if (key) raw[name] = files[key];
}
const loaded = loadContent('default', raw);
if (!loaded.ok) throw new Error(`content/default did not load in the browser: ${loaded.error.map((i) => i.message).join('; ')}`);
const content = loaded.value;

(globalThis as unknown as { __smokeCross: { run: () => ReturnType<typeof runCrossCases> } }).__smokeCross = { run: () => runCrossCases(content) };
