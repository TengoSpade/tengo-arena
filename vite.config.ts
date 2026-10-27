import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { stripDocKeysPlugin } from './scripts/vite/strip-doc-keys.ts';
import { ticketsPlugin } from './scripts/tickets/plugin.ts';

// The app is a static, offline-capable bundle. `base: './'` keeps asset URLs
// relative so the same dist/ works from a file server, a desktop shell (M7)
// or a sub-path.
// ticketsPlugin: playtest tickets (F8) written to ./tickets/ by the dev server only (`npm run dev`).
// stripDocKeysPlugin: production builds ship content/*/*.json without its `_` documentation keys (build only).
// The content itself is a separate chunk (src/platform/content-bundle.ts, a dynamic import), not part of the main bundle.
export default defineConfig({
  base: './',
  plugins: [preact(), ticketsPlugin(), stripDocKeysPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    // DevTools skips these frames: console messages link to their caller, not the ticket tool's
    // console wrapper (src/ui/tickets/console-capture.ts).
    sourcemapIgnoreList: (sourcePath) => sourcePath.includes('node_modules') || sourcePath.endsWith('console-capture.ts'),
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
  },
});
