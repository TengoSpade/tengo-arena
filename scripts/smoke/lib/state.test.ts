/** Reading the game state the smoke compares against: the page's saves parsed by core/save, and the headless round hash. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '../../../src/core/content';
import type { FightLog, GameState } from '../../../src/core/model';
import { sideInput, simulateRound } from '../../../src/core/sim';
import { REPO_ROOT, loadRawContentFromDisk } from '../../lib/node-content';
import { CROSS_CASES } from '../cross/cases';
import { headlessRoundHash } from './headless';
import type { PageDriver } from './page';
import { readGameState, readSavedState, ROUND_SLOT } from './saves';

const mocks = vi.hoisted(() => ({ live: vi.fn(), round: vi.fn() }));
vi.mock('../../../src/core/game', () => ({
  liveRoundPlayback: (...args: unknown[]) => mocks.live(...args),
  roundPlayback: (...args: unknown[]) => mocks.round(...args),
}));

const loaded = loadContent('default', loadRawContentFromDisk('default').raw);
if (!loaded.ok) throw new Error('content/default is invalid');
const content = loaded.value;
const saveJson = gunzipSync(readFileSync(join(REPO_ROOT, 'tests', 'fixtures', 'saves', 'r001-t001.json.gz'))).toString('utf8');

const page = (rec: unknown, hookState: unknown = null): PageDriver =>
  ({
    probe: async () => rec,
    eval: async () => hookState,
  }) as unknown as PageDriver;

describe('the page\'s saves', () => {
  it('parses the round autosave of the page into a state', async () => {
    const r = await readSavedState(page({ slotId: ROUND_SLOT, savedAt: '2026-10-28T10:00:00Z', json: saveJson }), content);
    if (!r.state) throw new Error(r.problem);
    expect(r.state.calendar.season).toBeGreaterThanOrEqual(1);
    expect(r.source).toContain('IndexedDB auto-round');
  });

  it('says so when the page has no saves yet', async () => {
    const r = await readSavedState(page(null), content);
    expect(r.state).toBeNull();
    expect(r.state === null && r.problem).toMatch(/no saves/);
  });

  it('says so when a save does not load, with the core/save code', async () => {
    const r = await readSavedState(page({ slotId: ROUND_SLOT, savedAt: null, json: '{"format":"nope"}' }), content);
    expect(r.state).toBeNull();
    expect(r.state === null && r.problem).toMatch(/does not load in Node: save\./);
  });

  it('falls back to the hook\'s state() only when there is no usable save and the build has one', async () => {
    const fake = { calendar: { season: 9 } } as unknown as GameState;
    const withHook = await readGameState(page(null, fake), content, true);
    expect(withHook.state).toBe(fake);
    expect(withHook.state && withHook.source).toBe('window.__arena.state()');
    const withoutHook = await readGameState(page(null, fake), content, false);
    expect(withoutHook.state).toBeNull();
    const saved = await readGameState(page({ slotId: ROUND_SLOT, savedAt: null, json: saveJson }, fake), content, true);
    expect(saved.state && saved.source).toContain('IndexedDB');
  });
});

function log(): FightLog {
  const c = CROSS_CASES[0]!;
  const input = { round: c.round, home: sideInput(content, 'home', c.home, 0, 1), away: sideInput(content, 'away', c.away, 1, 0) };
  return simulateRound(input, c.seed, content, { record: 'full' }).log!;
}

describe('the headless reference', () => {
  const watching = { liveMatch: { watch: { round: 1 } } } as unknown as GameState;
  const idle = { liveMatch: null } as unknown as GameState;

  it('has no round to play when the state is not watching and no fixture is named', () => {
    const r = headlessRoundHash(idle, content);
    expect(r.hash).toBeNull();
    expect(r.problem?.kind).toBe('no-round');
  });

  it('names the stub when core/game\'s playback is not implemented yet (blocked, not failed)', async () => {
    const { NotImplementedError } = await import('../../../src/core/util');
    mocks.live.mockImplementation(() => {
      throw new NotImplementedError('game.liveRoundPlayback');
    });
    const r = headlessRoundHash(watching, content);
    expect(r.problem?.kind).toBe('stub');
    expect(r.problem?.message).toMatch(/WP-M2B/);
  });

  it('hashes the live round: the log hash and the one recomputed over its events', () => {
    const l = log();
    mocks.live.mockReturnValue({ ok: true, value: { log: l } });
    const r = headlessRoundHash(watching, content);
    expect(r.problem).toBeNull();
    expect(r.hash).toBe(l.hash);
    expect(r.recomputed).toBe(l.hash);
    expect(r.source).toBe('liveRoundPlayback');
  });

  it('uses roundPlayback when a fixture round is named, and passes engine errors through', () => {
    mocks.round.mockReturnValue({ ok: false, error: { code: 'replay.unavailable', message: 'compacted' } });
    const r = headlessRoundHash(idle, content, { fixtureId: 'f-1', round: 2 });
    expect(mocks.round).toHaveBeenCalledWith(idle, 'f-1', 2, content);
    expect(r.problem).toEqual({ kind: 'error', message: 'replay.unavailable: compacted' });
    expect(r.source).toBe('roundPlayback');
  });
});
