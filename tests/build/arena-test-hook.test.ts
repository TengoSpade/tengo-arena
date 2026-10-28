import { build, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../architecture/rules';

/**
 * The arena test hook (05-technical-m2 §A7, §A8, tech-027): `window.__arena.viewer` and the dev world's fixture round
 * are compiled into dev builds and the `smoke` build mode (the visual smoke runs on a built bundle), and into no
 * production chunk. App imports the hook behind `import.meta.env.DEV || import.meta.env.MODE === 'smoke'`, which a
 * production build folds to false. Builds in memory with the real vite.config.ts (nothing is written).
 */
type Chunk = Rollup.OutputChunk;

async function buildChunks(mode: string): Promise<Chunk[]> {
  // Vitest runs with NODE_ENV=test, under which Vite would keep import.meta.env.DEV true: build as `vite build` does.
  const before = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  try {
    const result = await build({ root: ROOT, mode, configFile: `${ROOT}/vite.config.ts`, logLevel: 'silent', build: { write: false, sourcemap: false, reportCompressedSize: false } });
    const outputs = (Array.isArray(result) ? result : [result as Rollup.RollupOutput]).flatMap((r) => r.output);
    return outputs.filter((o): o is Chunk => o.type === 'chunk');
  } finally {
    if (before === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = before;
  }
}

const slash = (id: string): string => id.replaceAll('\\', '/');
const hookModules = (chunks: Chunk[]) => chunks.flatMap((c) => c.moduleIds).filter((id) => /\/screens\/arena\/test-hook\.ts$|\/debug\/arena-fixture\.ts$/.test(slash(id)));

describe('arena test hook in builds', () => {
  it('the production build contains no test hook and no fixture round', async () => {
    const chunks = await buildChunks('production');
    expect(hookModules(chunks)).toEqual([]);
    for (const c of chunks) {
      expect(c.code, c.fileName).not.toContain('loadFixtureRound');
      expect(c.code, c.fileName).not.toContain('__fixture__');
    }
  }, 240_000);

  it('the smoke build mode compiles it in (lazy, outside the startup chunk)', async () => {
    const chunks = await buildChunks('smoke');
    expect(hookModules(chunks).length).toBe(2);
    const withHook = chunks.filter((c) => c.code.includes('loadFixtureRound'));
    expect(withHook.length).toBeGreaterThan(0);
    // It is a dynamic import: no entry chunk holds it.
    expect(withHook.some((c) => c.isEntry)).toBe(false);
  }, 240_000);
});
