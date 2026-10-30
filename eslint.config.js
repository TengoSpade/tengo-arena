// ESLint flat config. Editor feedback for the architecture rules; the
// authoritative check is tests/architecture (run by `npm test`).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CORE_MSG = 'src/core must stay pure and deterministic (docs/design/_drafts/05-technical.md section 2).';

const CORE_BANNED_GLOBALS = [
  'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'indexedDB',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'alert', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'setImmediate', 'queueMicrotask', 'requestAnimationFrame',
  'cancelAnimationFrame', 'requestIdleCallback', 'performance', 'process', 'require', 'module',
  '__dirname', '__filename', 'globalThis', 'self', 'global', 'Buffer', 'Date', 'crypto', 'console', 'Intl',
];

const BANNED_MATH = [
  'random', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh',
  'acosh', 'atanh', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt', 'hypot',
];

const LOCALE_METHODS = [
  'localeCompare', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'toLocaleUpperCase', 'toLocaleLowerCase',
];

export default defineConfig(
  {
    // `.claude/` holds agent worktrees (full sibling checkouts with their own eslint.config.js); linting into them
    // fails with "multiple candidate TSConfigRootDirs" parse errors.
    ignores: ['dist/', 'coverage/', 'reports/', 'node_modules/', 'content/', 'docs/', 'src/ui/styles/', '.claude/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', '*.config.{ts,js}', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': ['error', ...CORE_BANNED_GLOBALS.map((name) => ({ name, message: CORE_MSG }))],
      'no-restricted-properties': [
        'error',
        ...BANNED_MATH.map((property) => ({ object: 'Math', property, message: `${CORE_MSG} Use core/rng or core/util/math.` })),
        ...LOCALE_METHODS.map((property) => ({ property, message: `${CORE_MSG} Locale-dependent.` })),
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: `${CORE_MSG} Use sq()/powi().` },
        { selector: "AssignmentExpression[operator='**=']", message: `${CORE_MSG} Use sq()/powi().` },
        { selector: "NewExpression[callee.name='Date']", message: CORE_MSG },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['pixi.js', 'pixi.js/*', 'preact', 'preact/*', '@preact/*', 'node:*', 'fs', 'path', 'os', 'url'],
              message: CORE_MSG,
            },
            { group: ['**/ui', '**/ui/**', '**/render', '**/render/**', '**/platform', '**/platform/**'], message: CORE_MSG },
          ],
        },
      ],
    },
  },
  {
    // M2: the pure half of src/render (docs/design/_drafts/05-technical-m2.md §A8). tests/architecture decides.
    files: ['src/render/**/*.ts'],
    ignores: ['src/render/viewer/**', 'src/render/skins/**', 'src/render/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['pixi.js', 'pixi.js/*', '**/viewer', '**/viewer/**', '**/skins/**'], message: 'The pure half of src/render imports no PixiJS (05-technical-m2 §A8).' }] },
      ],
    },
  },
);
