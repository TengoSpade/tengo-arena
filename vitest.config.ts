import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Two projects:
//  - "core": pure simulation/engine code, architecture checks, scripts. Node env, no DOM.
//  - "ui":   Preact components and screens. happy-dom env.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'core',
            environment: 'node',
            include: ['src/core/**/*.test.ts', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'ui',
            environment: 'happy-dom',
            include: [
              'src/ui/**/*.test.{ts,tsx}',
              'src/platform/**/*.test.{ts,tsx}',
              'src/render/**/*.test.{ts,tsx}',
            ],
          },
        },
      ],
    },
  }),
);
