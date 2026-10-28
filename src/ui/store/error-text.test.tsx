/**
 * 04: player text never shows an internal id. Every code the core or the store can return has player words, and the
 * toast, the report and the other places that say an error never print the code or the engine's own sentence.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { engineError } from '../../core/util';
import { App } from '../app/App';
import { resetToasts, toasts } from '../components';
import { createTestStore } from '../debug/test-store';
import { hasText } from '../text';
import { MATCH_PAUSED, MATCH_WATCHING, SAVE_ROUND_FAILED, WATCH_MISMATCH, WATCH_NOT_SHOWN } from './index';
import { errorText } from './messages';

/** Every `engineError('<code>'` in production source (not tests, test support or the debug tools). */
function codesInSource(): string[] {
  const out = new Set<string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name === 'testing' || name === 'debug' || name === 'testkit') continue;
        walk(path);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        for (const m of readFileSync(path, 'utf8').matchAll(/engineError\(\s*'([a-z0-9.-]+)'/g)) out.add(m[1]!);
      }
    }
  };
  walk(join(process.cwd(), 'src'));
  return [...out].sort();
}

const FLOW = [MATCH_PAUSED, MATCH_WATCHING, SAVE_ROUND_FAILED, WATCH_MISMATCH, WATCH_NOT_SHOWN];

describe('every error code is mapped to player words', () => {
  const codes = [...new Set([...codesInSource(), ...FLOW])];

  it('finds the codes (the scan itself works)', () => {
    expect(codes.length).toBeGreaterThan(40);
    for (const c of ['engine.busy', 'watch.mismatch', 'save.round-failed', 'inspect.tick', 'offer.cash']) expect(codes).toContain(c);
  });

  it.for(codes)('%s has copy that shows neither the code nor the engine sentence', (code) => {
    expect(hasText(`error.${code}`), `error.${code} is missing from text/en.ts`).toBe(true);
    const shown = errorText(engineError(code, 'RAW ENGINE SENTENCE'));
    expect(shown).not.toContain('RAW ENGINE SENTENCE');
    expect(shown).not.toContain(code);
    expect(shown.length).toBeGreaterThan(8);
  });

  it('a code nobody mapped still shows no code and no engine sentence', () => {
    const shown = errorText(engineError('not.a.real.code', 'RAW ENGINE SENTENCE'));
    expect(shown).not.toContain('RAW ENGINE SENTENCE');
    expect(shown).not.toContain('not.a.real.code');
  });
});

describe('the error toast', () => {
  beforeEach(() => {
    resetToasts();
    location.hash = '#/home';
  });
  afterEach(() => cleanup());

  it('says the words, never the code (a busy store, the case that leaked engine.busy)', async () => {
    const { store } = createTestStore();
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('toast-region')).toBeTruthy());
    (store.lastError as unknown as { value: unknown }).value = engineError('engine.busy', 'busy');
    await waitFor(() => expect(toasts.value).toHaveLength(1));
    const toast = toasts.value[0]!;
    expect(toast.title).toBe('Still processing the last action.');
    expect(toast.sub ?? '').not.toContain('engine.busy');
    expect(screen.getByTestId('toast-region').textContent).not.toContain('engine.busy');
    await new Promise((r) => setTimeout(r, 300)); // the App's lazy dev hook finishes loading before the environment goes
  });
});
