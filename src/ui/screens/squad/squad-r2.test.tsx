/**
 * AL-R002-T002 and T005: the roster table has a Freshness column in every view (meter and number, with the Tired and
 * Spent words), sortable, and the rating shows what it is worth at his Freshness ("45 → 41", core's effective rating,
 * with a tooltip) in the table and on the lineup cards and reserve cards. The # column reads 1-5 for the five and R1 /
 * R2 for the two match reserves.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Fighter, GameState } from '../../../core/model';
import { installShortcuts } from '../../app/shortcuts';
import { resetToasts } from '../../components';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { coreEngine } from '../../store';
import SquadScreen, { squadSelection } from './index';

let dispose: (() => void) | null = null;
beforeEach(() => resetToasts());
afterEach(() => {
  cleanup();
  dispose?.();
  dispose = null;
  squadSelection.value = null;
});

function world(tweak?: (state: GameState, club: GameState['clubs'][keyof GameState['clubs']], bench: Fighter[]) => void) {
  const made = createTestStore();
  const state = structuredClone(made.store.game.value!) as GameState;
  const club = state.clubs[state.playerClubId!]!;
  const starters = new Set(club.lineup.fighters.map((e) => e.fighterId as string));
  const bench = Object.values(state.fighters).filter((f) => f.clubId === club.id && !starters.has(f.id) && !(f.injury && f.injury.weeksOut > 0)) as Fighter[];
  for (const f of Object.values(state.fighters)) if (f.clubId === club.id) f.freshness10 = 1000;
  club.lineup.reserves = [bench[1]!.id, bench[0]!.id];
  tweak?.(state, club, bench);
  made.store.replaceWorld(state);
  dispose = installShortcuts(() => ({}));
  render(
    <TestProviders store={made.store}>
      <SquadScreen params={{}} />
    </TestProviders>,
  );
  return { ...made, state, club, bench };
}

const rowIds = () => Array.from(screen.getByTestId('roster-table').querySelectorAll('tbody tr')).map((tr) => tr.getAttribute('data-fighter'));

describe('Squad roster: R1 / R2 in the # column (AL-R002-T005)', () => {
  it('shows 1-5 for the five, R1 and R2 for the two match reserves in the order they were named, and nothing for the bench', () => {
    const { club, bench } = world();
    const table = screen.getByTestId('roster-table');
    const cell = (id: string) => table.querySelector(`tr[data-fighter="${id}"] td`)!.textContent;
    club.lineup.fighters.forEach((e, i) => expect(cell(e.fighterId)).toBe(String(i + 1)));
    // Named second-from-the-bench first: he is R1.
    expect(cell(bench[1]!.id)).toBe('R1');
    expect(cell(bench[0]!.id)).toBe('R2');
    expect(screen.getByTestId(`slot-r-${bench[1]!.id}`).getAttribute('data-tip')).toMatch(/Match reserve 1 of 2/);
    for (const f of bench.slice(2)) expect(cell(f.id)).toBe('');
    // The # sort puts the five first, then R1, R2, then the bench.
    const ids = rowIds();
    expect(ids.slice(0, 5)).toEqual(club.lineup.fighters.map((e) => e.fighterId));
    expect(ids.slice(5, 7)).toEqual([bench[1]!.id, bench[0]!.id]);
  });

  it('shows it in every view (the owner was on Attributes)', async () => {
    const { bench } = world();
    for (const view of ['Attributes', 'Contracts', 'Season stats', 'Overview']) {
      await act(() => {
        fireEvent.click(screen.getByRole('button', { name: view }));
      });
      expect(screen.getByTestId(`slot-r-${bench[1]!.id}`).textContent).toBe('R1');
    }
  });
});

describe('Squad roster: Freshness and the effective rating (AL-R002-T002)', () => {
  it('has a Freshness column in the Attributes view with the Tired and Spent words, and it sorts', async () => {
    const w = world((s, c) => {
      s.fighters[c.lineup.fighters[0]!.fighterId]!.freshness10 = 520; // Tired
      s.fighters[c.lineup.fighters[1]!.fighterId]!.freshness10 = 330; // Spent
      s.fighters[c.lineup.fighters[2]!.fighterId]!.freshness10 = 880;
    });
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Attributes' }));
    });
    const table = screen.getByTestId('roster-table');
    const [tired, spent, rested] = [w.club.lineup.fighters[0]!.fighterId, w.club.lineup.fighters[1]!.fighterId, w.club.lineup.fighters[2]!.fighterId];
    const cell = (id: string) => within(table).getByTestId(`fresh-col-${id}`);
    expect(cell(tired).textContent).toMatch(/52\s*Tired/);
    expect(cell(spent).textContent).toMatch(/33\s*Spent/);
    expect(cell(rested).textContent).toMatch(/88/);
    expect(cell(rested).textContent).not.toMatch(/Fresh|Tired|Spent/);
    expect(cell(tired).querySelector('.meter')).toBeTruthy();
    // Sortable: lowest first, then reversed.
    const header = within(table).getByRole('button', { name: 'Freshness' });
    await act(() => {
      fireEvent.click(header);
    });
    const order = rowIds();
    const fresh = (id: string | null) => w.state.fighters[id as keyof typeof w.state.fighters]!.freshness10;
    const values = order.map(fresh);
    expect(header.closest('th')!.getAttribute('aria-sort')).toBe('ascending');
    expect(values).toEqual([...values].sort((a, b) => a - b));
    await act(() => {
      fireEvent.click(header);
    });
    expect(header.closest('th')!.getAttribute('aria-sort')).toBe('descending');
    const down = rowIds().map(fresh);
    expect(down).toEqual([...down].sort((a, b) => b - a));
  });

  it('shows the rating as “45 → 41” for a tired fighter (core’s effective rating) with a tooltip that explains the penalty; a rested one shows the plain rating', async () => {
    const w = world((s, c) => {
      s.fighters[c.lineup.fighters[0]!.fighterId]!.freshness10 = 330;
      s.fighters[c.lineup.fighters[3]!.fighterId]!.freshness10 = 1000;
    });
    const tired = w.club.lineup.fighters[0]!.fighterId;
    const rested = w.club.lineup.fighters[3]!.fighterId;
    const view = coreEngine.fighterView(w.store.game.value!, tired, w.content);
    expect(view.effectiveRating).toBeLessThan(view.rating);
    const table = screen.getByTestId('roster-table');
    const eff = within(table).getByTestId(`rating-${tired}`);
    expect(eff.classList.contains('rating-eff')).toBe(true);
    expect(eff.querySelector('.rating-eff__base')!.textContent).toBe(String(view.rating));
    expect(eff.querySelector('.rating')!.textContent).toBe(String(view.effectiveRating));
    const tip = JSON.parse(eff.getAttribute('data-tip-rich')!) as { title: string; body: string; rows: { label: string; value: string }[] };
    expect(tip.title).toBe(`${view.rating} → ${view.effectiveRating}`);
    expect(tip.body).toMatch(/Freshness 33 \(Spent\)/);
    expect(tip.rows.some((r) => r.label === 'Effective rating now' && r.value === String(view.effectiveRating))).toBe(true);
    // A rested fighter: the plain rating pill, no arrow.
    expect(within(table).queryByTestId(`rating-${rested}`)).toBeNull();
    expect(within(table).getAllByText(String(coreEngine.fighterView(w.store.game.value!, rested, w.content).rating)).length).toBeGreaterThan(0);
    // The lineup card carries the same figure.
    const card = screen.getByTestId(`lineup-card-${tired}`);
    expect(within(card).getByTestId(`rating-${tired}`).textContent).toContain(String(view.effectiveRating));
    // The table sorts by what he is worth now.
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Attributes' }));
    });
    const header = within(screen.getByTestId('roster-table')).getByRole('button', { name: 'Rating' });
    await act(() => {
      fireEvent.click(header);
    });
    const effs = rowIds().map((id) => coreEngine.fighterView(w.store.game.value!, id as never, w.content).effectiveRating!);
    expect(effs).toEqual([...effs].sort((a, b) => (header.closest('th')!.getAttribute('aria-sort') === 'ascending' ? a - b : b - a)));
  });

  it('a match reserve who is tired shows his effective rating beside his rating on his reserve card', () => {
    const w = world((s, c, bench) => {
      s.fighters[bench[1]!.id]!.freshness10 = 300;
      void c;
    });
    const card = screen.getByTestId(`reserve-card-${w.bench[1]!.id}`);
    expect(within(card).getByTestId(`rating-${w.bench[1]!.id}`).classList.contains('rating-eff')).toBe(true);
  });
});
