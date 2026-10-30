import type { Seed } from '../rng';
import { isValidSeed } from '../rng';
import type { ContentRef, GameOptions, GameState } from './game-state';
import { DEFAULT_GAME_OPTIONS, STATE_SCHEMA_VERSION } from './game-state';
import { emptyIdCounters } from './ids';

/**
 * Minimal valid GameState with no world: season 1, week 1, preseason, no
 * clubs. createWorld (core/game) starts from this; tests use it as a base.
 */
export function createEmptyGameState(params: { rootSeed: Seed; content: ContentRef; options?: Partial<GameOptions> }): GameState {
  if (!isValidSeed(params.rootSeed)) throw new RangeError(`Invalid root seed ${JSON.stringify(params.rootSeed)}`);
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    content: { id: params.content.id, hash: params.content.hash },
    rng: { root: params.rootSeed, counters: {} },
    ids: emptyIdCounters(),
    calendar: { season: 1, weekIndex: 1, weekId: null, phase: 'preseason' },
    options: { ...DEFAULT_GAME_OPTIONS, ...params.options },
    playerClubId: null,
    clubs: {},
    fighters: {},
    competitions: {},
    fixtures: {},
    results: {},
    market: { offers: [], negotiations: [], trialsRookies: {}, refusalsThisSeason: {}, releasedThisSeason: [] },
    ai: {},
    ledger: { nextSeq: 1, openingBalances: {}, entries: [] },
    news: [],
    history: [],
    knowledge: null,
    alumni: {},
    liveMatch: null,
  };
}
