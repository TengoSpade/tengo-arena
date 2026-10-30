import { describe, expect, it } from 'vitest';
import { cloneJson, stableStringify } from '../util';
import {
  DEFAULT_GAME_OPTIONS,
  FIGHT_LOG_FORMAT,
  STATE_SCHEMA_VERSION,
  allocateId,
  asId,
  createEmptyGameState,
  emptyIdCounters,
  formatId,
  hashEventStream,
  idNumber,
  leagueCompetitionId,
  leagueFixtureId,
  reckoningFixtureId,
  type ClubId,
  type FightHeader,
  type GameState,
  type SimEvent,
  type TierId,
  type WeekId,
} from './index';

const content = { id: 'test', hash: '0'.repeat(32) };

describe('ids', () => {
  it('allocates sequential, deterministic ids per kind', () => {
    const counters = emptyIdCounters();
    expect(allocateId(counters, 'fighter')).toBe('f-1');
    expect(allocateId(counters, 'fighter')).toBe('f-2');
    expect(allocateId(counters, 'news')).toBe('n-1');
    expect(counters.fighter).toBe(3);
    expect(idNumber('f-12')).toBe(12);
    expect(() => formatId('news', 0)).toThrow(RangeError);
  });

  it('builds identity ids for competitions and fixtures', () => {
    const tier = asId<TierId>('saltmarch-crown');
    expect(leagueCompetitionId(2, tier)).toBe('lg:2:saltmarch-crown');
    expect(leagueFixtureId(2, tier, asId<WeekId>('MW3'), asId<ClubId>('a'), asId<ClubId>('b'))).toBe(
      'lg:2:saltmarch-crown:MW3:a:b',
    );
    expect(reckoningFixtureId(2, tier, 'final', 1)).toBe('rk:2:saltmarch-crown:final:1');
  });
});

describe('GameState', () => {
  it('createEmptyGameState() is valid, JSON-safe and stable', () => {
    const state = createEmptyGameState({ rootSeed: 'seed-1', content });
    expect(state.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(state.calendar).toEqual({ season: 1, weekIndex: 1, weekId: null, phase: 'preseason' });
    expect(state.options).toEqual(DEFAULT_GAME_OPTIONS);
    expect(state.options.patronGoals).toBe(false);
    expect(state.knowledge).toBeNull();
    expect(cloneJson(state)).toEqual(state);
    expect(stableStringify(state)).toBe(stableStringify(createEmptyGameState({ rootSeed: 'seed-1', content })));
  });

  it('rejects an invalid root seed', () => {
    expect(() => createEmptyGameState({ rootSeed: '', content })).toThrow(RangeError);
  });

  it('id maps return undefined for unknown ids (noUncheckedIndexedAccess)', () => {
    const state: GameState = createEmptyGameState({ rootSeed: 'seed-1', content });
    expect(state.clubs[asId<ClubId>('nope')]).toBeUndefined();
  });
});

describe('hashEventStream', () => {
  const header: FightHeader = {
    format: FIGHT_LOG_FORMAT,
    engineVersion: 1,
    contentHash: 'h',
    seed: 'abc',
    round: 1,
    tickMs: 50,
    frameEvery: 2,
    arena: { width: 3200, height: 1800 },
    units: [],
  };
  const events: SimEvent[] = [
    { seq: 0, tick: 0, type: 'fight.start', data: { units: [] } },
    { seq: 1, tick: 120, type: 'fight.end', data: { winner: 0, reason: 'elimination', tiebreakStep: null } },
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
