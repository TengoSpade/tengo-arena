import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { ticketsPlugin } from './scripts/tickets/plugin.ts';

// The app is a static, offline-capable bundle. `base: './'` keeps asset URLs
// relative so the same dist/ works from a file server, a desktop shell (M7)
// or a sub-path.
// ticketsPlugin: playtest tickets (F8) written to ./tickets/ by the dev server only (`npm run dev`).
export default defineConfig({
  base: './',
  plugins: [preact(), ticketsPlugin()],
  server: {
    port: 5173,
    strictPort: true,
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
