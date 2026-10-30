import { cleanup, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import type { FighterId, GameState } from '../../../core/model';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { coreEngine } from '../../store';
import MatchReportScreen from './index';

afterEach(cleanup);

describe('Match report: squads and swaps (M1.1)', () => {
  it('shows each round’s five with Tired / Spent tags, the auto swap after round 1, and XP from the match', async () => {
    const { store, content } = createTestStore({ weekIndex: 11 });
    let state = store.game.value!;
    const club = state.clubs[state.playerClubId!]!;
    if (store.blockers.value.length > 0) store.dispatch(coreEngine.suggestLineup(state, club.id, content));
    state = store.game.value!;
    const starters = new Set(state.clubs[club.id]!.lineup.fighters.map((e) => e.fighterId as string));
    const bench = Object.values(state.fighters).filter((f) => f.clubId === club.id && !starters.has(f.id) && !(f.injury && f.injury.weeksOut > 0));
    expect(bench.length).toBeGreaterThanOrEqual(2);
    // A Spent starter (20) and two fresh reserves of his class and stats: the auto rule swaps him after round 1.
    const next = structuredClone(state) as GameState;
    const lineup = next.clubs[club.id]!.lineup;
    const spent = lineup.fighters[0]!.fighterId;
    next.fighters[spent]!.freshness10 = 200;
    for (const b of bench.slice(0, 2)) {
      const f = next.fighters[b.id]!;
      const s = next.fighters[spent]!;
      f.classId = s.classId;
      f.train100 = { ...s.train100 };
      f.cap100 = { ...s.cap100 };
      f.wear100 = { ...s.wear100 };
    }
    lineup.reserves = bench.slice(0, 2).map((b) => b.id as FighterId);
    store.replaceWorld(next);
    const res = await store.advance();
    expect(res.ok).toBe(true);
    const fixtureId = res.ok ? res.value.playerFixtureId! : (null as never);
    const result = store.game.value!.results[fixtureId]!;
    expect(result.roundLineups?.length).toBeGreaterThanOrEqual(2);
    render(
      <TestProviders store={store}>
        <MatchReportScreen params={{ fixtureId }} />
      </TestProviders>,
    );
    const panel = await screen.findByTestId('panel-matchday');
    expect(within(panel).getByTestId('md-round-1').textContent).toContain('Spent 20');
    const swaps = within(panel).getByTestId('md-swaps-1');
    expect(swaps.textContent).toContain(next.fighters[spent]!.name.full);
    expect(swaps.textContent).toContain('auto');
    expect(within(panel).getByTestId('md-xp').textContent).toMatch(/swapped out after round 1/);
  }, 20_000);
});
