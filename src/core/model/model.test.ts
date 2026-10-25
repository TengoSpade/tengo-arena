import { describe, expect, it } from 'vitest';
import { cloneJson, stableStringify } from '../util';
import {
  FIGHT_LOG_FORMAT,
  STATE_SCHEMA_VERSION,
  allocateId,
  createEmptyGameState,
  emptyIdCounters,
  formatId,
  hashEventStream,
  type ClubId,
  type FightHeader,
  type GameState,
  type SimEvent,
} from './index';

const content = { id: 'test', hash: '0'.repeat(32) };

describe('ids', () => {
  it('allocates sequential, deterministic ids per kind', () => {
    const counters = emptyIdCounters();
    expect(allocateId(counters, 'fighter')).toBe('f-1');
    expect(allocateId(counters, 'fighter')).toBe('f-2');
    expect(allocateId(counters, 'club')).toBe('c-1');
    expect(allocateId(counters, 'fixture')).toBe('fx-1');
    expect(counters.fighter).toBe(3);
    expect(() => formatId('news', 0)).toThrow(RangeError);
  });
});

describe('GameState', () => {
  it('createEmptyGameState() is valid, JSON-safe and stable', () => {
    const state = createEmptyGameState({ rootSeed: 'seed-1', content });
    expect(state.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(state.calendar).toEqual({ season: 1, week: 1, phase: 'preseason' });
    expect(cloneJson(state)).toEqual(state);
    expect(stableStringify(state)).toBe(stableStringify(createEmptyGameState({ rootSeed: 'seed-1', content })));
  });

  it('rejects an invalid root seed', () => {
    expect(() => createEmptyGameState({ rootSeed: '', content })).toThrow(RangeError);
  });

  it('id maps return undefined for unknown ids (noUncheckedIndexedAccess)', () => {
    const state: GameState = createEmptyGameState({ rootSeed: 'seed-1', content });
    const club = state.clubs['c-404' as ClubId];
    expect(club).toBeUndefined();
  });
});

describe('hashEventStream', () => {
  const header: FightHeader = {
    format: FIGHT_LOG_FORMAT,
    engineVersion: 1,
    contentHash: 'h',
    seed: 'abc',
    tickMs: 50,
    frameEvery: 2,
    arena: { width: 100, height: 60 },
    units: [],
  };
  const events: SimEvent[] = [
    { seq: 0, tick: 0, type: 'fight.start', data: { units: [] } },
    { seq: 1, tick: 120, type: 'fight.end', data: { winner: 0, reason: 'elimination' } },
  ];

  it('is deterministic and sensitive to any change', () => {
    const h = hashEventStream(header, events);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(hashEventStream(header, cloneJson(events))).toBe(h);
    expect(hashEventStream({ ...header, seed: 'abd' }, events)).not.toBe(h);
    const changed = cloneJson(events);
    changed[1]!.tick = 121;
    expect(hashEventStream(header, changed)).not.toBe(h);
  });
});
