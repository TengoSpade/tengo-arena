import type { Seed } from '../rng';
import { isValidSeed } from '../rng';
import type { ContentRef, GameState } from './game-state';
import { STATE_SCHEMA_VERSION } from './game-state';
import { emptyIdCounters } from './ids';

/**
 * Minimal valid GameState with no world: season 1, preseason, no clubs.
 * World generation (core/game createWorld) starts from this; tests use it as
 * a fixture base.
 */
export function createEmptyGameState(params: { rootSeed: Seed; content: ContentRef }): GameState {
  if (!isValidSeed(params.rootSeed)) throw new RangeError(`Invalid root seed ${JSON.stringify(params.rootSeed)}`);
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    content: { id: params.content.id, hash: params.content.hash },
    rng: { root: params.rootSeed, counters: {} },
    ids: emptyIdCounters(),
    calendar: { season: 1, week: 1, phase: 'preseason' },
    options: {},
    playerClubId: null,
    clubs: {},
    fighters: {},
    competitions: {},
    fixtures: {},
    results: {},
    ledger: { nextSeq: 1, openingBalances: {}, entries: [] },
    news: [],
    history: [],
  };
}
