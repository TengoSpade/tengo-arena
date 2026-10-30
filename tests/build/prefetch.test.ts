import { build, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../architecture/rules';

/**
 * The viewer prefetch (A10: the first open within 500 ms) in the production bundle: src/ui asks for the viewer entry and,
 * through its `prefetchViewerChunks`, for PixiJS's own lazy chunks (browser environment, WebGL renderer) at idle. This checks
 * the bundle side: all of it stays out of the startup chunks (the 250 KB budget is tests/build/bundle.test.ts), and the two
 * PixiJS chunks the prefetch names are the very chunks PixiJS itself imports at init (one chunk each, no copy), reached
 * lazily from the viewer chunk. Builds in memory with the real vite.config.ts.
 */
type Chunk = Rollup.OutputChunk;

async function buildChunks(): Promise<Chunk[]> {
  const before = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  try {
    const result = await build({ root: ROOT, mode: 'production', configFile: `${ROOT}/vite.config.ts`, logLevel: 'silent', build: { write: false, sourcemap: false, reportCompressedSize: false } });
    const outputs = (Array.isArray(result) ? result : [result as Rollup.RollupOutput]).flatMap((r) => r.output);
    return outputs.filter((o): o is Chunk => o.type === 'chunk');
  } finally {
    if (before === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = before;
  }
}

const slash = (id: string): string => id.replaceAll('\\', '/');
const has = (c: Chunk, re: RegExp): boolean => c.moduleIds.some((id) => re.test(slash(id)));

/** The chunks a launch loads before the first paint: the entry and everything it imports statically. */
function startupClosure(chunks: Chunk[]): Chunk[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Set<string>();
  const walk = (c: Chunk): void => {
    if (seen.has(c.fileName)) return;
    seen.add(c.fileName);
    for (const name of c.imports) {
      const dep = byName.get(name);
      if (dep) walk(dep);
    }
  };
  for (const c of chunks) if (c.isEntry) walk(c);
  return [...seen].map((n) => byName.get(n)!);
}

describe('the viewer prefetch in the production bundle', () => {
  it('keeps the viewer, PixiJS and its renderers out of the startup chunks, and names PixiJS\'s own lazy chunks', async () => {
    const chunks = await buildChunks();
    const startup = startupClosure(chunks);
    expect(startup.length).toBeGreaterThan(5);
    for (const c of startup) {
      expect(has(c, /\/node_modules\/pixi\.js\//), `${c.fileName} holds PixiJS`).toBe(false);
      expect(has(c, /\/src\/render\/viewer\//), `${c.fileName} holds the viewer`).toBe(false);
    }
    const viewer = chunks.find((c) => has(c, /\/src\/render\/viewer\/index\.ts$/));
    expect(viewer, 'the viewer entry is a chunk of its own').toBeTruthy();
    expect(startup).not.toContain(viewer);

    // The two PixiJS chunks the prefetch names: one chunk each (the alias is the same module PixiJS imports), lazy from the viewer.
    for (const [what, re] of [
      ['the WebGL renderer', /\/renderers\/gl\/WebGLRenderer\.mjs$/],
      ['the browser environment', /\/environment-browser\/browserAll\.mjs$/],
    ] as const) {
      const holders = chunks.filter((c) => has(c, re));
      expect(holders, `${what} is in exactly one chunk`).toHaveLength(1);
      const holder = holders[0]!;
      expect(startup, `${what} is not startup JS`).not.toContain(holder);
      const reachable = viewer!.dynamicImports.some((name) => name === holder.fileName || chunks.find((c) => c.fileName === name)?.imports.includes(holder.fileName));
      expect(reachable, `${what} is a lazy dependency of the viewer entry`).toBe(true);
      expect(viewer!.imports, `${what} is not a static import of the viewer entry (the prefetch is the extra)`).not.toContain(holder.fileName);
    }
    // The alias is resolved at build time: no chunk keeps its name.
    for (const c of chunks) expect(c.code, c.fileName).not.toContain('pixi-webgl-renderer');
    // The viewer entry carries the prefetch the UI calls.
    expect(viewer!.exports).toContain('prefetchViewerChunks');
    expect(viewer!.exports).toContain('createArenaViewer');
  }, 240_000);
});
