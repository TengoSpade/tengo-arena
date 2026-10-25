import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../core/testkit';
import type { GameState } from '../../../core/model';
import { ok } from '../../../core/util';
import { resetToasts, toasts } from '../../components';
import { createFakeStore, type FakeStoreOptions } from '../league/testing/fake-store';
import { Providers } from '../league/testing/providers';
import { makeSampleWorld } from '../league/testing/worlds';
import type { SampleStage } from '../league/testing/sample-season';
import { termsCheck, willingLevel } from './model';
import MarketScreen from './index';

afterEach(cleanup);
beforeEach(() => resetToasts());

const kit = { buildFixtureWorld, fixtureContent };

function renderMarket(stage: SampleStage = 'mid', mutate?: (s: GameState) => void, extra: Partial<FakeStoreOptions> = {}) {
  const world = makeSampleWorld(kit, stage);
  if (mutate) mutate(world.state);
  const store = createFakeStore({ game: world.state, content: world.content, ...extra });
  render(
    <Providers store={store}>
      <MarketScreen params={{}} />
    </Providers>,
  );
  return { ...world, store };
}

function agentRows() {
  return within(screen.getByTestId('market-agents')).getAllByRole('row').slice(1);
}

describe('Market screen', () => {
  it('shows an empty state without a career', () => {
    render(<MarketScreen params={{}} />);
    expect(screen.getByTestId('screen-market').textContent).toContain('No career loaded');
  });

  it('lists free agents with asks, rivals and willingness, and the wage room in the header', () => {
    const { state } = renderMarket();
    const free = Object.values(state.fighters).filter((f) => f.status === 'free-agent').length;
    expect(agentRows()).toHaveLength(free);
    expect(screen.getByTestId('wage-room').textContent).toMatch(/^Wage room [\d,−]+ ts \/ week$/);
    expect(screen.getByTestId('market-agents').querySelectorAll('.willing')).toHaveLength(free);
    expect(screen.getByTestId('market-agents').textContent).toContain('Last chance');
  });

  it('filters by role, search and resets', () => {
    const { content } = renderMarket();
    const all = agentRows().length;
    const healer = content.vocabulary.roles.find((r) => r.id === 'healer')!;
    fireEvent.click(screen.getByRole('button', { name: healer.name }));
    const healers = agentRows().length;
    expect(healers).toBeLessThan(all);
    expect(healers).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(agentRows()).toHaveLength(all);
    fireEvent.input(screen.getByRole('searchbox', { name: 'Search free agents' }), { target: { value: 'zzz-nobody' } });
    expect(screen.getByText('No free agents match')).toBeTruthy();
  });

  it('opens the offer dialog with the terms check and sends an offer', () => {
    const { store } = renderMarket();
    const row = agentRows().find((r) => !r.classList.contains('is-dimmed'))!;
    fireEvent.click(within(row).getByTestId('offer-button'));
    const dialog = screen.getByTestId('offer-dialog');
    expect(within(dialog).getByTestId('offer-terms').textContent).toContain('Meets his ask');
    const wage = within(dialog).getByLabelText('Wage per week') as HTMLInputElement;
    const ask = Number(wage.value);
    fireEvent.input(wage, { target: { value: String(Math.floor(ask * 0.5)) } });
    expect(within(dialog).getByTestId('offer-terms').textContent).toContain('Too low');
    fireEvent.input(wage, { target: { value: String(ask) } });
    fireEvent.click(within(dialog).getByRole('button', { name: '3 seasons' }));
    fireEvent.click(within(dialog).getByTestId('offer-send'));
    const cmd = store.commands.at(-1)!;
    expect(cmd.type).toBe('offer.make');
    if (cmd.type === 'offer.make') expect(cmd.seasons).toBe(3);
    expect(toasts.value.at(-1)?.title).toMatch(/^Offer sent to /);
  });

  it('blocks offers over the wage room with the excess as the reason', () => {
    renderMarket('mid', (s) => {
      s.clubs[s.playerClubId!]!.finance.wageBudgetPerWeek = 1000;
    });
    const row = agentRows()[0]!;
    const btn = within(row).getByTestId('offer-button');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('data-tip')).toMatch(/^Over the wage room by /);
    fireEvent.click(btn);
    expect(screen.queryByTestId('offer-dialog')?.hasAttribute('open') ?? false).toBe(false);
  });

  it('shows the embargo banner', () => {
    renderMarket('mid', (s) => {
      s.clubs[s.playerClubId!]!.finance.status = 'embargo';
      s.clubs[s.playerClubId!]!.finance.balance = -2300;
    });
    expect(screen.getByText(/^Spending embargo · balance −2,300 ts/)).toBeTruthy();
  });

  it('lists pending offers and withdraws one', () => {
    const { store } = renderMarket();
    fireEvent.click(screen.getByRole('button', { name: /^Pending/ }));
    const table = screen.getByTestId('market-pending');
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(1);
    fireEvent.click(within(table).getByTestId('withdraw'));
    expect(store.commands.at(-1)?.type).toBe('offer.withdraw');
  });

  it('renews a contract and shows a counter', () => {
    const { store } = renderMarket('mid', undefined, {
      reduce: (state) => ok({ state, response: { kind: 'countered', counterWage: 999, validUntilWeek: 13 } }),
    });
    fireEvent.click(screen.getByRole('button', { name: /^Renewals/ }));
    const table = screen.getByTestId('market-renewals');
    fireEvent.click(within(table).getAllByTestId('renew-button')[0]!);
    const dialog = screen.getByTestId('offer-dialog');
    const send = within(dialog).getByTestId('offer-send');
    expect(send.textContent).toMatch(/^Renew for /);
    fireEvent.click(send);
    expect(store.commands.at(-1)?.type).toBe('contract.renew');
    expect(within(dialog).getByTestId('offer-terms').textContent).toContain('He counters at 999 ts/wk');
  });

  it('closes trials-day rookies outside P1 and signs them in P1', () => {
    renderMarket('mid');
    fireEvent.click(screen.getByRole('button', { name: /^Rookies/ }));
    expect(screen.getByText('Trials-day rookies are available in week P1 only')).toBeTruthy();
    cleanup();
    const { store } = renderMarket('trials');
    fireEvent.click(screen.getByRole('button', { name: /^Rookies/ }));
    const table = screen.getByTestId('market-rookies');
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(3);
    fireEvent.click(within(table).getAllByRole('button', { name: 'Sign' })[0]!);
    fireEvent.click(within(screen.getByTestId('offer-dialog')).getByTestId('offer-send'));
    expect(store.commands.at(-1)?.type).toBe('trials.sign');
  });

  it('keeps a shortlist and compares fighters', () => {
    const { store } = renderMarket();
    fireEvent.click(screen.getByRole('button', { name: /^Shortlist/ }));
    expect(within(screen.getByTestId('market-shortlist-table')).getAllByRole('row').slice(1)).toHaveLength(3);
    fireEvent.click(within(screen.getByTestId('market-shortlist-table')).getAllByRole('button', { name: 'Remove from shortlist' })[0]!);
    expect(store.commands.at(-1)?.type).toBe('shortlist.toggle');
    fireEvent.click(screen.getByRole('button', { name: 'Free agents' }));
    const boxes = within(screen.getByTestId('market-agents')).getAllByRole('checkbox');
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[1]!);
    expect(screen.getByTestId('compare-tray').textContent).toContain('2');
    fireEvent.click(within(screen.getByTestId('compare-tray')).getByRole('button', { name: /Compare/ }));
    const dialog = screen.getByTestId('compare-dialog');
    expect(dialog.querySelectorAll('.compare__head')).toHaveLength(3);
    expect(dialog.querySelectorAll('.is-best').length).toBeGreaterThan(0);
  });
});

describe('terms check', () => {
  it('accepts at the ask, counters within the greed flex and refuses below it', () => {
    const content = fixtureContent();
    const f = buildFixtureWorld().fighters['f-1' as never]!;
    const fair = { ...f, contractProfile: { greedBp: 0 } };
    expect(termsCheck(content, fair, 360, 360).verdict).toBe('acceptable');
    const counter = termsCheck(content, fair, 340, 360);
    expect(counter.verdict).toBe('counter');
    expect(counter.counter).toBe(350);
    expect(termsCheck(content, fair, 320, 360).verdict).toBe('refused');
  });

  it('maps patience to willingness pips', () => {
    expect(willingLevel(3, 3)).toBe(3);
    expect(willingLevel(2, 3)).toBe(2);
    expect(willingLevel(1, 3)).toBe(1);
    expect(willingLevel(0, 3)).toBe(0);
  });
});
