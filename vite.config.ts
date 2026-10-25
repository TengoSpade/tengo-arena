import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The app is a static, offline-capable bundle. `base: './'` keeps asset URLs
// relative so the same dist/ works from a file server, a desktop shell (M7)
// or a sub-path.
export default defineConfig({
  base: './',
  plugins: [preact()],
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
