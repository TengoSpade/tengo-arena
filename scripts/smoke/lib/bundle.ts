/**
 * Bundle a TypeScript entry into one self-contained script (an IIFE) with Vite's library build, in memory, so the
 * smoke can inject code that shares its source with the Node side into a browser page.
 */
import { build } from 'vite';

export async function bundleIife(repoRoot: string, entry: string, name: string): Promise<string> {
  const result = await build({
    root: repoRoot,
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      sourcemap: false,
      target: 'es2022',
      lib: { entry, name, formats: ['iife'], fileName: () => 'bundle.js' },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  for (const o of outputs) {
    if (!('output' in o)) continue;
    const chunk = o.output.find((c) => c.type === 'chunk');
    if (chunk && chunk.type === 'chunk') return chunk.code;
  }
  throw new Error(`vite produced no script for ${entry}`);
}
