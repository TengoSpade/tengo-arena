/**
 * Convenience wiring for WP7 tests and the preview: a sample season plus a
 * fake store. The core testkit can be imported only from test files
 * (tests/architecture), so callers pass its two builders in as `kit`.
 * Never import from production code.
 */
import type { ContentDB } from '../../../../core/content';
import type { FixtureId, GameState, MatchReport } from '../../../../core/model';
import type { EngineError, Result } from '../../../../core/util';
import { buildMatchReport } from './fake-core';
import { createFakeStore, type FakeStore, type FakeStoreOptions } from './fake-store';
import { buildSampleSeason, sampleSeasonEndReport, type SampleStage } from './sample-season';

export interface Kit {
  buildFixtureWorld(options?: { freeAgents?: number; fightersPerClub?: number }): GameState;
  fixtureContent(): ContentDB;
}

export interface SampleWorld {
  state: GameState;
  content: ContentDB;
  store: FakeStore;
}

export function buildFakeMatchReportFor(state: GameState, content: ContentDB, fixtureId: FixtureId): Result<MatchReport, EngineError> {
  return buildMatchReport(state, fixtureId, content);
}

export function makeSampleWorld(kit: Kit, stage: SampleStage, extra: Partial<FakeStoreOptions> = {}): SampleWorld {
  const content = kit.fixtureContent();
  const state = buildSampleSeason(kit.buildFixtureWorld({ freeAgents: 30, fightersPerClub: 9 }), content, { stage });
  const store = createFakeStore({
    game: state,
    content,
    matchReport: (id) => buildMatchReport(store.game.value ?? state, id, content),
    seasonEndReport: stage === 'review' ? sampleSeasonEndReport(state) : null,
    ...extra,
  });
  return { state, content, store };
}
