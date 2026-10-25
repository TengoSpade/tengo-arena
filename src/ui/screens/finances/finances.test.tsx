import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../core/testkit';
import type { GameState } from '../../../core/model';
import { EngineContext, StoreContext, coreEngine } from '../../store';
import { createFakeStore } from '../league/testing/fake-store';
import { Providers } from '../league/testing/providers';
import { makeSampleWorld } from '../league/testing/worlds';
import FinancesScreen from './index';

afterEach(cleanup);

const kit = { buildFixtureWorld, fixtureContent };

function renderAt(mutate?: (s: GameState) => void) {
  const world = makeSampleWorld(kit, 'mid');
  if (mutate) mutate(world.state);
  const store = createFakeStore({ game: world.state, content: world.content });
  render(
    <Providers store={store}>
      <FinancesScreen params={{}} />
    </Providers>,
  );
  return world;
}

describe('Finances screen', () => {
  it('shows an empty state without a career', () => {
    render(<FinancesScreen params={{}} />);
    expect(screen.getByTestId('screen-finances').textContent).toContain('No career loaded');
  });

  it('shows the tiles, budget, wage bill, charts and ledger', () => {
    const { state } = renderAt();
    const club = state.clubs[state.playerClubId!]!;
    expect(screen.getByTestId('tile-balance').textContent).toBe(`${club.finance.balance.toLocaleString('en-US')} ts`);
    expect(screen.getByTestId('finance-budget').textContent).toContain('Season budget (SB)');
    expect(within(screen.getByTestId('finance-wages')).getAllByRole('row').length).toBeGreaterThan(5);
    expect(screen.getByTestId('chart-weekly').querySelectorAll('.chart__bar--us').length).toBeGreaterThan(3);
    expect(screen.getByTestId('chart-balance').querySelector('polyline')).toBeTruthy();
    const ledgerRows = within(screen.getByTestId('ledger-table')).getAllByRole('row').slice(1);
    expect(ledgerRows.length).toBe(state.ledger.entries.length);
  });

  it('filters the ledger to income or costs', () => {
    renderAt();
    const ledger = screen.getByTestId('finance-ledger');
    fireEvent.click(within(ledger).getByRole('button', { name: 'Costs' }));
    const rows = within(screen.getByTestId('ledger-table')).getAllByRole('row').slice(1);
    expect(rows.every((r) => r.textContent!.includes('−'))).toBe(true);
    fireEvent.click(within(ledger).getByRole('button', { name: 'Income' }));
    expect(within(screen.getByTestId('ledger-table')).getAllByRole('row').slice(1).every((r) => r.textContent!.includes('+'))).toBe(true);
  });

  it('explains watch and embargo states with their reasons', () => {
    renderAt((s) => {
      const c = s.clubs[s.playerClubId!]!;
      c.finance.status = 'embargo';
      c.finance.balance = -2300;
    });
    expect(screen.getByText(/^Spending embargo · balance −2,300 ts · new contracts above/)).toBeTruthy();
    cleanup();
    renderAt((s) => {
      s.clubs[s.playerClubId!]!.finance.status = 'watch';
    });
    expect(screen.getByText('Watch: the balance may go below 0 within 4 weeks')).toBeTruthy();
  });

  it('degrades when the finance view is not implemented yet', () => {
    const world = makeSampleWorld(kit, 'mid');
    render(
      <StoreContext.Provider value={world.store}>
        <EngineContext.Provider value={coreEngine}>
          <FinancesScreen params={{}} />
        </EngineContext.Provider>
      </StoreContext.Provider>,
    );
    expect(screen.getByTestId('screen-finances').textContent).toContain('Not available yet');
  });
});
