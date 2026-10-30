/** The journeys' verdict-relevant decisions, on a fake page: a pass must mean the thing happened. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../../src/core/content';
import { sideInput, simulateRound } from '../../../src/core/sim';
import { loadRawContentFromDisk } from '../../lib/node-content';
import { CROSS_CASES } from '../cross/cases';
import type { PageDriver } from '../lib/page';
import { SmokeFailure } from '../lib/page';
import { Recorder } from '../lib/recorder';
import { buildFightKey } from '../vis003/key';
import { finishMatch } from './arena-steps';
import type { JourneyEnv } from './env';
import { resolveDecideFirst } from './career';
import { assertKeyIsOnScreen } from './vis003-capture';

interface FakeOptions {
  /** The hash over time: each eval of location.hash takes the next entry (the last one repeats). */
  hashes: string[];
  /** Whether the "Open report" toast is on screen at Home. */
  toast: boolean;
}

/** A page that is only a location.hash and a toast; clicking the toast opens the report. */
function fakePage(o: FakeOptions): { page: PageDriver; clicks: number } {
  const state = { i: 0, clicks: 0, opened: false };
  const page = {
    viewport: { width: 1280, height: 720 },
    eval: async (expr: string) => {
      if (expr === 'location.hash') {
        if (state.opened) return '#/match/f-1';
        return o.hashes[Math.min(state.i++, o.hashes.length - 1)];
      }
      return undefined;
    },
    locate: async () => (o.toast ? { x: 1, y: 1, width: 1, height: 1, text: 'Open report', testId: null, disabled: false, tag: 'button' } : null),
    mouseClick: async () => {
      state.clicks++;
      state.opened = true;
    },
    waitForHash: async () => undefined,
    screenshot: async () => Buffer.alloc(0),
    click: async () => undefined,
  } as unknown as PageDriver;
  return { page, get clicks() { return state.clicks; } } as { page: PageDriver; clicks: number };
}

describe('the end of the watched match', () => {
  let dir = '';
  let rec: Recorder;
  let env: JourneyEnv;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'journeys-'));
    rec = new Recorder();
    env = { rec, outDir: dir } as unknown as JourneyEnv;
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('passes when the report opens', async () => {
    const { page } = fakePage({ hashes: ['#/match/f-1'], toast: false });
    await finishMatch(page, env, 50);
    expect(rec.checks.find((c) => c.id === 'career.watch-flow')?.status).toBe('pass');
  });

  it('passes at Home when the result toast opens the report', async () => {
    const f = fakePage({ hashes: ['#/home'], toast: true });
    await finishMatch(f.page, env, 50);
    expect(f.clicks).toBe(1);
    expect(rec.checks.find((c) => c.id === 'career.watch-flow')?.status).toBe('pass');
  });

  it('does not pass at Home with neither the report nor the toast', async () => {
    const { page } = fakePage({ hashes: ['#/home'], toast: false });
    await expect(finishMatch(page, env, 50)).rejects.toMatchObject({ code: 'career.no-report' });
    await expect(finishMatch(page, env, 50)).rejects.toThrow(/neither the report nor the result toast/);
    expect(rec.checks.find((c) => c.id === 'career.watch-flow')).toBeUndefined();
  });
});

describe('the vis-003 key must be the key of the fight on screen', () => {
  const loaded = loadContent('default', loadRawContentFromDisk('default').raw);
  if (!loaded.ok) throw new Error('content/default is invalid');
  const c = CROSS_CASES[0]!;
  const log = simulateRound({ round: c.round, home: sideInput(loaded.value, 'home', c.home, 0, 1), away: sideInput(loaded.value, 'away', c.away, 1, 0) }, c.seed, loaded.value, { record: 'full' }).log!;
  const key = buildFightKey(log, loaded.value, { fight: 1 });

  it('accepts the hash of the log the key came from', () => {
    expect(() => assertKeyIsOnScreen(log.hash, key, 'IndexedDB auto-round')).not.toThrow();
  });

  it('refuses a stale save: a different log on screen, or none', () => {
    for (const viewed of ['0123456789abcdef0123456789abcdef', null]) {
      try {
        assertKeyIsOnScreen(viewed, key, 'IndexedDB auto-round saved 10:00');
        throw new Error('did not refuse');
      } catch (e) {
        expect(e).toBeInstanceOf(SmokeFailure);
        expect((e as SmokeFailure).code).toBe('vis003.stale-key');
        expect((e as SmokeFailure).blocked).toBe(false);
        expect((e as SmokeFailure).message).toContain(key.logHash);
        expect((e as SmokeFailure).message).toContain('IndexedDB auto-round saved 10:00');
      }
    }
  });
});

describe('"Decide first": the one decision the smoke makes', () => {
  const found = { x: 5, y: 6, width: 1, height: 1, text: 'Auto-pick', testId: null, disabled: false, tag: 'button' };
  const fake = (auto: boolean): { page: PageDriver; log: string[] } => {
    const log: string[] = [];
    const page = {
      click: async (_spec: unknown, what: string) => void log.push(`click: ${what}`),
      locate: async () => (auto ? found : null),
      mouseClick: async (x: number, y: number) => void log.push(`mouse ${x},${y}`),
    } as unknown as PageDriver;
    return { page, log };
  };

  it('opens what needs deciding with Continue and presses Auto-pick', async () => {
    const { page, log } = fake(true);
    await resolveDecideFirst(page, 'Solae Sootstep is unfit to play', 0);
    expect(log).toEqual(['click: Continue (opens what needs deciding)', 'mouse 5,6']);
  });

  it('is blocked, not failed, when the screen has no Auto-pick', async () => {
    const { page } = fake(false);
    await expect(resolveDecideFirst(page, 'something odd', 0)).rejects.toMatchObject({ code: 'career.blocked-by-game', blocked: true });
    await expect(resolveDecideFirst(page, 'something odd', 0)).rejects.toThrow(/no Auto-pick/);
  });

  it('gives up, blocked, after four attempts that did not clear it', async () => {
    const { page, log } = fake(true);
    await expect(resolveDecideFirst(page, 'still unfit', 4)).rejects.toMatchObject({ code: 'career.blocked-by-game', blocked: true });
    expect(log).toEqual([]);
  });
});
