import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Two projects:
//  - "core": pure simulation/engine code, architecture checks, scripts. Node env, no DOM.
//  - "ui":   Preact components and screens. happy-dom env.
//
// Timeouts: Vitest's 5 s default suits an idle machine. The whole suite runs one worker per core, often next
// to other builds and agents, and a test that takes a second alone (architecture scans, every route, ticket
// reproduction) can take ten times that under load. 30 s is the default for every test; known-heavy tests
// ask for more themselves. A hung test still fails, just later.
const TIMEOUTS = { testTimeout: 30_000, hookTimeout: 30_000 };

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'core',
            ...TIMEOUTS,
            environment: 'node',
            include: ['src/core/**/*.test.ts', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'ui',
            ...TIMEOUTS,
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
