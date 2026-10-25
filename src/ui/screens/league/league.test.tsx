import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../core/testkit';
import { StoreContext } from '../../store';
import LeagueScreen from './index';
import { createFakeStore } from './testing/fake-store';
import { makeSampleWorld } from './testing/worlds';
import type { SampleStage } from './testing/sample-season';

vi.mock('../../../core/league', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/league')>();
  const fake = await import('./testing/fake-core');
  return { ...actual, standings: fake.standings };
});

afterEach(cleanup);

const kit = { buildFixtureWorld, fixtureContent };

function renderAt(stage: SampleStage) {
  const world = makeSampleWorld(kit, stage);
  render(
    <StoreContext.Provider value={world.store}>
      <LeagueScreen params={{}} />
    </StoreContext.Provider>,
  );
  return world;
}

describe('League screen', () => {
  it('shows an empty state without a career', () => {
    render(<LeagueScreen params={{}} />);
    expect(screen.getByTestId('screen-league').textContent).toContain('No career loaded');
  });

  it("shows both wing tables of the player's tier with zones and our row", () => {
    const { state, content } = renderAt('mid');
    const club = state.clubs[state.playerClubId!]!;
    const tier = content.tiers.get(club.tierId)!;
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(tier.name);
    const tables = screen.getAllByTestId('standings-wing');
    expect(tables).toHaveLength(2);
    const rows = tables.flatMap((t) => within(t).getAllByRole('row').slice(1));
    expect(rows).toHaveLength(16);
    expect(rows.filter((r) => r.getAttribute('data-zone') === 'qualify')).toHaveLength(8);
    expect(rows.filter((r) => r.getAttribute('data-zone') === 'relegate')).toHaveLength(2);
    expect(rows.filter((r) => r.classList.contains('is-us'))).toHaveLength(1);
    expect(screen.getByText('After matchweek 7 of 16', { exact: false })).toBeTruthy();
  });

  it('switches to the tier table with the button and the T key, and sorts by points', () => {
    renderAt('mid');
    fireEvent.click(screen.getByRole('button', { name: 'Tier table' }));
    const table = screen.getByTestId('standings-tier');
    expect(within(table).getAllByRole('row')).toHaveLength(17);
    fireEvent.keyDown(window, { key: 'w' });
    expect(screen.getAllByTestId('standings-wing')).toHaveLength(2);
    fireEvent.keyDown(window, { key: 't' });
    const tierTable = screen.getByTestId('standings-tier');
    const ptsHeader = within(tierTable).getByRole('button', { name: 'Pts' });
    fireEvent.click(ptsHeader);
    expect(ptsHeader.closest('th')!.getAttribute('aria-sort')).toBe('descending');
  });

  it('switches tiers', () => {
    const { content } = renderAt('mid');
    const other = content.tiers.list.find((x) => x.level === 3)!;
    fireEvent.click(screen.getByRole('button', { name: `Tier 3 · ${other.shortName}` }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(other.name);
    // The lowest tier relegates no one.
    const rows = screen.getAllByTestId('standings-wing').flatMap((t) => within(t).getAllByRole('row').slice(1));
    expect(rows.filter((r) => r.getAttribute('data-zone') === 'relegate')).toHaveLength(0);
  });

  it('explains the bracket before matchweek 13 and projects it afterwards', () => {
    renderAt('mid');
    expect(screen.getByTestId('panel-bracket').textContent).toContain('Projection from matchweek 13');
    cleanup();
    renderAt('late');
    const panel = screen.getByTestId('panel-bracket');
    expect(panel.textContent).toContain('not a forecast');
    expect(within(panel).getAllByText(/Winner QF/)).toHaveLength(4);
  });

  it('shows the live bracket during the Reckoning with links to played reports', () => {
    renderAt('tournament');
    const panel = screen.getByTestId('panel-bracket');
    expect(within(panel).getByText('Live')).toBeTruthy();
    const links = within(panel).getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(4);
    expect(links[0]!.getAttribute('href')).toMatch(/^#\/match\/rk%3A/);
  });

  it("offers last season's result", () => {
    renderAt('late');
    fireEvent.click(screen.getByRole('button', { name: 'Season 1 result' }));
    expect(within(screen.getByTestId('bracket')).getAllByRole('link').length).toBe(7);
  });

  it('degrades to an inline message when the standings view is unavailable', () => {
    const world = makeSampleWorld(kit, 'mid');
    const store = createFakeStore({ game: { ...world.state, competitions: {} }, content: world.content });
    render(
      <StoreContext.Provider value={store}>
        <LeagueScreen params={{}} />
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('panel-standings').textContent).toContain('No league table for this tier yet');
  });
});
