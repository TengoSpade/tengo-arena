import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { hashContent, loadContent, stripDocKeys } from '../../src/core/content';
import { loadThemeFiles } from '../../src/platform/content-loader';
import { loadRawContentFromDisk } from '../../scripts/lib/node-content';
import { ROOT } from '../architecture/rules';

/**
 * Startup bundle budget (docs/design 05 section 8): the JS a launch must load before the first paint,
 * the entry chunk plus everything it imports statically (the modulepreload list of dist/index.html), is
 * at most 250 KB gzip. The content JSON is a chunk of its own (src/platform/content-bundle.ts), loaded
 * right after, and ships without its `_` documentation keys but with the source's content hash. This test
 * builds the project in memory (nothing is written) with the real vite.config.ts and checks all of it.
 */
const BUDGET_BYTES = 250 * 1000; // Vite reports kB as 1000 bytes: the stricter reading of "250 KB"
/** M2 arena viewer: the lazy chunks holding PixiJS and src/render/{viewer,skins}, loaded on the first Watch or Replay (tech-025, TUNABLE (tech)). */
const VIEWER_BUDGET_BYTES = 250 * 1000;

type Chunk = Rollup.OutputChunk;

async function productionBuild(): Promise<Chunk[]> {
  const result = await build({ root: ROOT, configFile: `${ROOT}/vite.config.ts`, logLevel: 'silent', build: { write: false, sourcemap: false, reportCompressedSize: false } });
  const outputs = (Array.isArray(result) ? result : [result as Rollup.RollupOutput]).flatMap((r) => r.output);
  return outputs.filter((o): o is Chunk => o.type === 'chunk');
}

/** The entry chunk and its static imports, transitively. */
function startupChunks(chunks: Chunk[]): Chunk[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const entry = chunks.find((c) => c.isEntry);
  if (!entry) throw new Error('the build has no entry chunk');
  const seen = new Map<string, Chunk>();
  const visit = (c: Chunk): void => {
    if (seen.has(c.fileName)) return;
    seen.set(c.fileName, c);
    for (const name of c.imports) {
      const next = byName.get(name);
      if (next) visit(next);
    }
  };
  visit(entry);
  return [...seen.values()];
}

const gzipBytes = (c: Chunk): number => gzipSync(c.code).length;
/** Module ids with forward slashes (Windows paths). */
const slash = (id: string): string => id.replaceAll('\\', '/');

describe('production bundle', () => {
  it('keeps the content out of the startup JS, within the 250 KB gzip budget', async () => {
    const chunks = await productionBuild();
    const startup = startupChunks(chunks);
    const content = chunks.filter((c) => c.moduleIds.some((id) => /\/content\/[^/]+\/[^/]+\.json$/.test(slash(id))));

    // Every content file lives in one chunk that startup does not import statically.
    expect(content).toHaveLength(1);
    expect(startup).not.toContain(content[0]);
    const entry = startup.find((c) => c.isEntry)!;
    expect(entry.dynamicImports).toContain(content[0]!.fileName); // fetched by import(), awaited before the app mounts

    const startupGzip = startup.reduce((sum, c) => sum + gzipBytes(c), 0);
    expect(startupGzip, `startup JS ${(startupGzip / 1000).toFixed(1)} kB gzip`).toBeLessThanOrEqual(BUDGET_BYTES);

    // M2 (05-technical-m2 §A8, tech-025): PixiJS and the PixiJS half of src/render are lazy chunks, never startup JS,
    // and together stay within the viewer budget (TUNABLE (tech)) once they exist.
    const isViewerModule = (id: string): boolean => /\/node_modules\/pixi\.js\/|\/src\/render\/(viewer|skins)\//.test(slash(id));
    const startupViewer = startup.flatMap((c) => c.moduleIds.filter(isViewerModule));
    expect(startupViewer, 'PixiJS / viewer modules in the startup JS').toEqual([]);
    const viewerGzip = chunks.filter((c) => c.moduleIds.some(isViewerModule)).reduce((sum, c) => sum + gzipBytes(c), 0);
    expect(viewerGzip, `viewer chunks ${(viewerGzip / 1000).toFixed(1)} kB gzip`).toBeLessThanOrEqual(VIEWER_BUDGET_BYTES);
  }, 120_000);

  it('ships the content without documentation keys, valid, with the hash of the source files', async () => {
    const chunks = await productionBuild();
    const chunk = chunks.find((c) => c.moduleIds.some((id) => slash(id).endsWith('/src/platform/content-bundle.ts')));
    expect(chunk, 'the content chunk').toBeDefined();
    expect(chunk!.imports).toEqual([]); // self-contained: it can be evaluated on its own

    // Run the built chunk as the browser would, and compare it with the files on disk.
    const dir = mkdtempSync(join(tmpdir(), 'arena-content-'));
    try {
      const file = join(dir, 'content-bundle.mjs');
      writeFileSync(file, chunk!.code);
      const shipped = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { CONTENT_FILES: Record<string, unknown>; CONTENT_HASHES?: Record<string, string> };
      const source = loadRawContentFromDisk('default');
      expect(source.missing).toEqual([]);

      const theme = loadThemeFiles('default', shipped.CONTENT_FILES);
      expect(theme.missing).toEqual([]);
      expect(JSON.stringify(theme.raw).length).toBeLessThan(JSON.stringify(source.raw).length);
      expect(theme.raw).toEqual(stripDocKeys(source.raw)); // exactly the source minus its documentation keys
      expect(shipped.CONTENT_HASHES).toEqual({ default: hashContent(source.raw) });

      const loaded = loadContent('default', theme.raw, { hash: shipped.CONTENT_HASHES!['default'] });
      expect(loaded.ok, JSON.stringify(loaded.ok ? [] : loaded.error.slice(0, 3))).toBe(true);
      const asWritten = loadContent('default', source.raw);
      if (loaded.ok && asWritten.ok) expect(loaded.value.ref).toEqual(asWritten.value.ref); // same id and hash as the source
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
