import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../core/testkit';
import { createFakeStore } from '../league/testing/fake-store';
import { Providers } from '../league/testing/providers';
import { fakeEngine } from '../league/testing/fake-core';
import { EngineContext, StoreContext } from '../../store';
import { sampleSeasonEndReport } from '../league/testing/sample-season';
import { makeSampleWorld } from '../league/testing/worlds';
import SeasonReviewScreen from './index';

afterEach(cleanup);
beforeEach(() => {
  window.location.hash = '';
});

const kit = { buildFixtureWorld, fixtureContent };

describe('Season review screen', () => {
  it('shows an empty state without a career', () => {
    render(<SeasonReviewScreen params={{}} />);
    expect(screen.getByTestId('screen-season-review').textContent).toContain('No career loaded');
  });

  it('says no season has finished in a first season', () => {
    const content = fixtureContent();
    const store = createFakeStore({ game: buildFixtureWorld(), content });
    render(
      <Providers store={store}>
        <SeasonReviewScreen params={{}} />
      </Providers>,
    );
    expect(screen.getByText('No season has finished yet')).toBeTruthy();
  });

  it('offers the binding season-end step when the season is over', async () => {
    const world = makeSampleWorld(kit, 'season-over');
    const report = sampleSeasonEndReport({ ...world.state, history: [...world.state.history] });
    const store = createFakeStore({ game: { ...world.state, history: [] }, content: world.content, seasonEndReport: report, seasonEndPending: true });
    render(
      <Providers store={store}>
        <SeasonReviewScreen params={{}} />
      </Providers>,
    );
    fireEvent.click(screen.getByTestId('run-season-end'));
    expect((await screen.findByTestId('run-season-end-dialog')).textContent).toContain('binding');
    fireEvent.click(screen.getByTestId('run-season-end-confirm'));
    await waitFor(() => expect(store.calls.some((c) => c.method === 'finishSeason')).toBe(true));
  });

  it('walks through every step of the review in order', () => {
    const world = makeSampleWorld(kit, 'review');
    render(
      <Providers store={world.store}>
        <SeasonReviewScreen params={{}} />
      </Providers>,
    );
    expect(screen.getByTestId('review-move').textContent).toMatch(/Promoted to|Relegated to|Staying in/);
    expect(within(screen.getByTestId('review-tables')).getAllByTestId('standings-wing')).toHaveLength(2);
    // Honours stack the label above one club per line (no side-by-side overlap at narrow widths).
    const honours = screen.getByTestId('review-honours');
    expect(honours.querySelectorAll('dl.kv--stacked').length).toBe(2);
    const moves = within(screen.getByTestId('review-moves'));
    expect(moves.getAllByText(/^Relegated from /).length).toBeGreaterThan(0);
    for (const dd of honours.querySelectorAll('dd')) expect(dd.querySelectorAll('.review-honour').length + dd.querySelectorAll('.u-faint').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('review-next'));
    expect(within(screen.getByTestId('review-bracket')).getAllByRole('link')).toHaveLength(7);
    fireEvent.click(screen.getByTestId('review-next'));
    expect(screen.getByTestId('review-money').textContent).toContain('+18,750 ts');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(within(screen.getByTestId('review-development')).getAllByRole('row').length).toBeGreaterThan(3);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByTestId('review-retired').textContent).toMatch(/Retired at \d+ after/);
    expect(screen.getByTestId('review-expired').textContent).toContain('Now a free agent');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByTestId('review-next-season').textContent).toContain('Trials Day rookies');
    expect(screen.getByTestId('review-begin').getAttribute('href')).toBe('#/home');
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(window.location.hash).toBe('#/home');
  });

  it('M1.1: the levels step (levels start → end, picks, round + bench XP, Tired starts) and promotion wage raises', () => {
    const world = makeSampleWorld(kit, 'review');
    const state = world.state;
    const clubId = state.playerClubId!;
    const mine = Object.values(state.fighters).filter((f) => f.clubId === clubId);
    const record = state.history[state.history.length - 1]!;
    const row = mine[0]!.history.find((h) => h.season === record.season)!;
    Object.assign(row, { levelStart: 21, levelEnd: 24, benchXp: 12, tiredRoundStarts: 4 });
    const stat = world.content.stats.list[0]!.id;
    const rows = [{ fighterId: mine[0]!.id, picks: [{ level: 22, season: record.season, weekIndex: 5, picked: { kind: 'stat', stat, gain100: 100 }, trait: null, how: 'player' }] }];
    (record as { wageRaises?: unknown[] }).wageRaises = [{ clubId, fighterId: mine[1]!.id, from: 60, to: 120 }];
    const engine = { ...fakeEngine(), developmentSummary: () => rows };
    render(
      <StoreContext.Provider value={world.store}>
        <EngineContext.Provider value={engine as never}>
          <SeasonReviewScreen params={{}} />
        </EngineContext.Provider>
      </StoreContext.Provider>,
    );
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByTestId('review-next'));
    const dev = screen.getByTestId('review-development');
    expect(dev.textContent).toContain('Levels this season');
    const first = within(dev).getAllByRole('row').find((r) => r.textContent!.includes(mine[0]!.name.full))!;
    expect(first.textContent).toContain('21 → 24 (+3)');
    expect(first.textContent).toContain(`+1 ${world.content.stats.require(stat).name}`);
    expect(first.textContent).toContain(`${row.xp - 12} + 12`);
    expect(first.textContent).toContain('4');
    fireEvent.click(screen.getByTestId('review-next'));
    expect(screen.getByTestId('review-raises').textContent).toContain('60 ts → 120 ts per week');
  });
});
