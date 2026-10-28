/**
 * DEV and `smoke` builds only (tech-027): a fixed round of the dev world, simulated at record 'full' in the browser,
 * for the test hook's `loadFixtureRound()` and the headless-browser smoke (WP-M2F): seek to fixed ticks, take
 * screenshots, compare the event-stream hash with Node's golden. Lives in src/ui/debug (it may use the dev world).
 */
import { prepareMatchInput, type RoundPlayback } from '../../core/game';
import type { FixtureId, RoundInput } from '../../core/model';
import { deriveSeed } from '../../core/rng';
import { simulateRound } from '../../core/sim';
import type { AppStore } from '../store';
import { buildDevWorld } from './dev-world';

/** The id the replay route uses for the fixture round (`#/replay/__fixture__`). */
export const FIXTURE_ROUND_ID = '__fixture__' as FixtureId;

export function buildFixtureRound(store: AppStore): RoundPlayback {
  const content = store.content.value;
  if (!content) throw new Error('content is not loaded');
  let state = store.game.value;
  if (!state?.playerClubId) {
    state = buildDevWorld(content, { playerClubId: content.clubs.list[0]!.id, weekIndex: 11 });
    store.replaceWorld(state, content);
  }
  const clubId = state.playerClubId!;
  const fixture = store.engine.clubFixture(state, clubId, state.calendar.weekIndex) ?? Object.values(state.fixtures).find((f) => f.status === 'scheduled');
  if (!fixture) throw new Error('the dev world has no fixture to build a round from');
  const input = prepareMatchInput(state, fixture.id, content);
  if (!input.ok) throw new Error(`fixture round: ${input.error.code} ${input.error.message}`);
  const roundInput: RoundInput = { round: 1, home: input.value.home, away: input.value.away };
  const out = simulateRound(roundInput, deriveSeed(input.value.seed, 'round', 1), content, { record: 'full' });
  if (!out.log) throw new Error('the sim returned no log at record full');
  return { fixtureId: FIXTURE_ROUND_ID, round: 1, kind: 'replay', log: out.log, startTick: 0, scoreBefore: { home: 0, away: 0 }, lineups: null, calls: null, result: null };
}
