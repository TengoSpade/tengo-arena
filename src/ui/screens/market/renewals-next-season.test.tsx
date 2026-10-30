/**
 * AL-R002-T006: renewals are judged against next season's wage room. The owner's case: this season's room is 15 ts
 * a week, Rhagar's renewal is +110 on his wage, and Garus and Rhoald are not going to be renewed. Their contracts end
 * this season, so they are not counted next season, and the +110 fits. The panel and the dialog say so (and that the
 * projection assumes no promotion or relegation); every number is core's (FinanceView.nextSeason, checkOffer).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Fighter, GameState } from '../../../core/model';
import { resetToasts } from '../../components';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { coreEngine } from '../../store';
import MarketScreen from './index';

afterEach(cleanup);
beforeEach(() => resetToasts());

type Who = { garus: Fighter; rhagar: Fighter; rhoald: Fighter };

/**
 * The dev world's club, reshaped to the owner's numbers: three contracts end this season (Garus 70, Rhagar 235,
 * Rhoald 80), the rest run on at 100; this season's wage room is 15, next season's 400.
 */
function ownerCase(tweak?: (state: GameState, who: Who) => void) {
  const made = createTestStore({ engine: coreEngine, weekIndex: 11 });
  const state = structuredClone(made.store.game.value!) as GameState;
  const clubId = state.playerClubId!;
  const club = state.clubs[clubId]!;
  const season = state.calendar.season;
  const roster = Object.values(state.fighters).filter((f) => f.clubId === clubId && f.status === 'active' && f.contract);
  const who: Who = { garus: roster[0]!, rhagar: roster[1]!, rhoald: roster[2]! };
  for (const f of roster) {
    f.contract!.next = null;
    f.contract!.endSeason = season + 2;
    f.contract!.wagePerWeek = 100;
  }
  for (const [f, wage] of [[who.garus, 70], [who.rhagar, 235], [who.rhoald, 80]] as const) {
    f.contract!.endSeason = season;
    f.contract!.wagePerWeek = wage;
  }
  club.finance.wageBudgetPerWeek = roster.reduce((n, f) => n + f.contract!.wagePerWeek, 0) + 15;
  state.market.offers = state.market.offers.filter((o) => o.clubId !== clubId);
  tweak?.(state, who);
  made.store.replaceWorld(state, made.content);
  render(
    <TestProviders store={made.store}>
      <MarketScreen params={{ view: 'renewals' }} />
    </TestProviders>,
  );
  return { ...made, state, clubId, ...who, season };
}

const money = (n: number) => `${n.toLocaleString('en-US')} ts`;

async function openRenewal(f: Fighter, wage: number) {
  const row = screen.getByRole('link', { name: f.name.full }).closest('tr')!;
  await act(() => {
    fireEvent.click(within(row as HTMLElement).getByTestId('renew-button'));
  });
  const dialog = screen.getByTestId('offer-dialog');
  await act(() => {
    fireEvent.input(within(dialog).getByLabelText('Wage per week'), { target: { value: String(wage) } });
  });
  return dialog;
}

describe('Market › Renewals: next season’s wage room (AL-R002-T006)', () => {
  it('shows the projected budget, minus the contracts continuing, minus the agreed renewals, and the room; it names what is not counted and says it assumes no promotion or relegation', () => {
    const { state, clubId, content, garus, rhagar, rhoald } = ownerCase();
    const next = coreEngine.financeView(state, clubId, content).nextSeason!;
    expect(next.wageRoom).toBe(400);
    const panel = screen.getByTestId('market-next-room');
    expect(within(panel).getByTestId('next-room-budget').textContent).toBe(money(next.projectedWageBudget));
    expect(within(panel).getByTestId('next-room-continuing').textContent).toBe(`−${money(next.continuing)}`);
    expect(within(panel).getByTestId('next-room-agreed').textContent).toBe(`−${money(0)}`);
    expect(within(panel).getByTestId('next-room-total').textContent).toBe(`${money(400)} / wk`);
    // The three contracts that end are named as not counted, with this season's wages.
    const not = within(panel).getByTestId('next-room-notcounted').textContent!;
    for (const f of [garus, rhagar, rhoald]) expect(not).toContain(f.name.full);
    expect(not).toContain(money(385));
    expect(panel.textContent).toMatch(/assumes no promotion or relegation/);
    // Each row says on its own whether his ask fits; all three together are over (345 + 75 + 85 against 400).
    expect(screen.getAllByTestId('renewal-fit')).toHaveLength(3);
    expect(within(panel).getByTestId('next-room-all').getAttribute('data-fits')).toBe('no');
  });

  it('the owner’s case: Rhagar’s +110 is far over this season’s 15 ts room but fits next season’s, with Garus and Rhoald named as not counted', async () => {
    const { rhagar, rhoald, garus, state, clubId, content } = ownerCase();
    const raise = rhagar.contract!.wagePerWeek + 110;
    // Core's check: under this season's room the +110 would be refused; the renewal is judged on next season's.
    const check = coreEngine.checkOffer(state, { clubId, fighterId: rhagar.id, wagePerWeek: raise, seasons: 1, kind: 'renewal' }, content);
    expect(check.ok && check.value.basis).toBe('next-season');
    const dialog = await openRenewal(rhagar, raise);
    const room = within(dialog).getByTestId('offer-next-room');
    const verdict = within(room).getByTestId('offer-next-verdict');
    expect(verdict.getAttribute('data-fits')).toBe('yes');
    expect(verdict.textContent).toMatch(/Fits next season’s wage room · 55 ts \/ wk left/);
    // What continues plus the new 345, against the projected budget.
    expect(within(room).getByTestId('offer-next-bill').textContent).toBe(money(coreEngine.financeView(state, clubId, content).nextSeason!.continuing + raise));
    const not = within(room).getByTestId('offer-next-notcounted').textContent!;
    expect(not).toContain(garus.name.full);
    expect(not).toContain(rhoald.name.full);
    expect(not).not.toContain(rhagar.name.full);
    expect(within(room).getByTestId('offer-next-assumes').textContent).toMatch(/no promotion or relegation/);
    expect(within(dialog).getByTestId('offer-send').getAttribute('aria-disabled')).toBeNull();
  });

  it('renewing Garus first (an agreed renewal) takes from the room: Rhagar’s raise is then over it, the dialog says by how much and Renew is blocked', async () => {
    const { rhagar, garus } = ownerCase((s, who) => {
      who.garus.contract!.endSeason = s.calendar.season + 1;
      who.garus.contract!.next = { wagePerWeek: 75, endSeason: s.calendar.season + 1 };
    });
    const panel = screen.getByTestId('market-next-room');
    // His agreed 75 counts, his old contract is no longer "ending": the room is 400 − 75 + 100 (his continuing 70 → 75 is not double counted).
    expect(within(panel).getByTestId('next-room-agreed').textContent).toBe(`−${money(75)}`);
    expect(within(panel).getByTestId('next-room-notcounted').textContent).not.toContain(garus.name.full);
    const room = Number(within(panel).getByTestId('next-room-total').textContent!.replace(/[^\d]/g, ''));
    const dialog = await openRenewal(rhagar, rhagar.contract!.wagePerWeek + room); // far more than the room allows
    const verdict = within(dialog).getByTestId('offer-next-verdict');
    expect(verdict.getAttribute('data-fits')).toBe('no');
    expect(verdict.textContent).toMatch(/Over next season’s wage room by .+ \/ wk/);
    expect(within(dialog).getByTestId('offer-send').getAttribute('aria-disabled')).toBe('true');
    expect(dialog.textContent).toMatch(/Over next season’s wage room/);
  });
});
