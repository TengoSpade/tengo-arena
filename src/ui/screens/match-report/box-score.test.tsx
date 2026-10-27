/**
 * AL-R002-T001: the box score carries damage done and received, healing done and received and shielding, grouped
 * Offense / Defense / Support, per match with a per-round toggle; each side's team total is the sum of its column.
 * One test plays a real match through core (counters, healing received, per-round lines); the others feed the
 * screen reports shaped like core's (FighterRecap.box) to pin the layout rules.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixtureId, GameState, MatchReport } from '../../../core/model';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { coreEngine } from '../../store';
import MatchReportScreen from './index';

beforeEach(() => {
  window.location.hash = '';
  // A wide window: every box score column shows (the lower-value ones wait for room on a narrow one).
  (window as unknown as { happyDOM?: { setViewport(v: { width: number; height: number }): void } }).happyDOM?.setViewport({ width: 2200, height: 1000 });
});
afterEach(cleanup);

type Store = ReturnType<typeof createTestStore>['store'];

async function playedMatch(): Promise<{ store: Store; fixtureId: FixtureId; state: GameState }> {
  const { store } = createTestStore({ engine: coreEngine, pauseBetweenRounds: 'never' });
  const res = await store.advance();
  if (!res.ok) throw new Error(`advance failed: ${res.error.message}`);
  const state = store.game.value!;
  const me = state.playerClubId!;
  const fixture = Object.values(state.fixtures).find((f) => state.results[f.id] && (f.homeClubId === me || f.awayClubId === me) && f.weekIndex === 11)!;
  return { store, fixtureId: fixture.id, state };
}

function mount(store: Store, fixtureId: FixtureId) {
  return render(
    <TestProviders store={store}>
      <MatchReportScreen params={{ fixtureId }} />
    </TestProviders>,
  );
}

/** The sum of a column over the rows above a team total row, side by side (rows come in club order, ours first). */
function columnSums(table: HTMLElement, col: string): { us: number | null; them: number | null; totals: { us: string; them: string } } {
  const sums = [0, 0];
  const seenDash = [false, false];
  let side = 0;
  const totals = ['', ''];
  for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
    if (row.classList.contains('row-total')) {
      totals[side] = row.querySelector(`td[data-col="${col}"]`)?.textContent ?? '';
      side++;
      continue;
    }
    if (row.classList.contains('row-group') || row.classList.contains('is-bench') || side > 1) continue;
    const cell = row.querySelector(`td[data-col="${col}"]`);
    if (!cell) continue;
    const text = cell.textContent ?? '';
    if (text === '—') seenDash[side] = true;
    else sums[side]! += Number(text.replace(/,/g, ''));
  }
  return { us: seenDash[0] ? null : sums[0]!, them: seenDash[1] ? null : sums[1]!, totals: { us: totals[0]!, them: totals[1]! } };
}

const COLS = ['downs', 'damageDone', 'damageReceived', 'healingDone', 'healingReceived', 'shielding'] as const;
const fmt = (n: number) => n.toLocaleString('en-US');

describe('Match report: the fleshed-out box score (AL-R002-T001)', () => {
  it('has damage done, damage received, healing done, healing received and shielding, grouped Offense / Defense / Support, and every column sorts', async () => {
    const { store, fixtureId } = await playedMatch();
    mount(store, fixtureId);
    const table = screen.getByTestId('box-table');
    const head = within(table.querySelector('thead')!);
    for (const g of ['Offense', 'Defense', 'Support']) expect(head.getByText(g)).toBeTruthy();
    for (const name of ['Damage done', 'Damage received', 'Healing done', 'Healing received', 'Shielding', 'Downs', 'Downed']) {
      const button = head.getByRole('button', { name });
      fireEvent.click(button);
      // Damage done is the default sort (descending), so its first click reverses it.
      expect(button.closest('th')!.getAttribute('aria-sort')).toBe(name === 'Damage done' ? 'ascending' : 'descending');
    }
    // Freshness before → after and XP stay.
    expect(table.querySelector('thead')!.textContent).toMatch(/Fresh/);
    expect(table.querySelector('thead')!.textContent).toMatch(/XP/);
    expect(screen.getAllByTestId('cell-fresh').length).toBeGreaterThan(0);
  });

  it('a real match: each side’s team total is the sum of its column and matches core’s report totals; the other side’s damage taken is ours dealt', async () => {
    const { store, fixtureId, state } = await playedMatch();
    mount(store, fixtureId);
    const table = screen.getByTestId('box-table');
    const report = store.matchReport(fixtureId);
    if (!report.ok) throw new Error('no report');
    const r: MatchReport = report.value;
    const persp = r.home.clubId === state.playerClubId ? 'home' : 'away';
    const other = persp === 'home' ? 'away' : 'home';
    for (const col of COLS) {
      const s = columnSums(table, col);
      if (s.us !== null) expect(s.totals.us, `ours ${col}`).toBe(fmt(s.us));
      if (s.them !== null) expect(s.totals.them, `theirs ${col}`).toBe(fmt(s.them));
    }
    const num = (v: string) => Number(v.replace(/,/g, ''));
    const ours = (col: string) => num(within(screen.getByTestId('box-total-us')).getByText(/.*/, { selector: `td[data-col="${col}"]` }).textContent!);
    const theirs = (col: string) => num(within(screen.getByTestId('box-total-them')).getByText(/.*/, { selector: `td[data-col="${col}"]` }).textContent!);
    expect(ours('damageDone')).toBe(r.totals![persp].damageDealt);
    expect(theirs('damageDone')).toBe(r.totals![other].damageDealt);
    expect(ours('healingDone')).toBe(r.totals![persp].healingDone);
    // What one side dealt the other took (shield absorption aside: both columns count HP).
    expect(ours('damageDone')).toBe(theirs('damageReceived'));
    expect(theirs('damageDone')).toBe(ours('damageReceived'));
    // Healing a team did is healing it received (nobody heals the other side).
    expect(ours('healingReceived')).toBe(ours('healingDone'));
    expect(theirs('healingReceived')).toBe(theirs('healingDone'));
    expect(r.totals![persp].healingReceived).toBe(ours('healingReceived'));
  });

  it('the toggle switches to one round: the same columns for that round, a total that adds up, and back to the whole match', async () => {
    const { store, fixtureId } = await playedMatch();
    mount(store, fixtureId);
    const report = store.matchReport(fixtureId);
    if (!report.ok) throw new Error('no report');
    const r = report.value;
    expect(r.timelineAvailable).toBe(true);
    const toggle = within(screen.getByTestId('box-toggle'));
    await act(() => {
      fireEvent.click(toggle.getByRole('button', { name: 'R1' }));
    });
    const panel = screen.getByTestId('panel-box');
    expect(panel.textContent).toContain('Round 1');
    const table = screen.getByTestId('box-table');
    const persp = r.home.clubId === store.game.value!.playerClubId ? 'home' : 'away';
    const sums = columnSums(table, 'damageDone');
    expect(sums.totals.us).toBe(fmt(sums.us!));
    expect(sums.totals.us).toBe(fmt(r.rounds[0]!.totals![persp].damageDone));
    const healed = columnSums(table, 'healingReceived');
    expect(healed.totals.us).toBe(fmt(r.rounds[0]!.totals![persp].healingReceived!));
    // Round 1 has the five who started it; the Match button brings the whole match back.
    expect(table.querySelectorAll('tbody tr:not(.row-group):not(.row-total)')).toHaveLength(10);
    await act(() => {
      fireEvent.click(toggle.getByRole('button', { name: 'Match' }));
    });
    expect(screen.getByTestId('panel-box').textContent).toContain('Whole match');
    // The page's round tabs and the toggle are one control.
    await act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Round 2/ }));
    });
    expect(toggle.getByRole('button', { name: 'R2' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('sorts by a new column in a round too (damage received) and falls back to damage done for a match-only column', async () => {
    const { store, fixtureId } = await playedMatch();
    mount(store, fixtureId);
    const toggle = within(screen.getByTestId('box-toggle'));
    const table = screen.getByTestId('box-table');
    const head = within(table.querySelector('thead')!);
    // XP is a match column: sort by it, then go to one round: the table sorts by damage done instead of breaking.
    fireEvent.click(head.getByRole('button', { name: 'XP' }));
    await act(() => {
      fireEvent.click(toggle.getByRole('button', { name: 'R1' }));
    });
    const damage = Array.from(table.querySelectorAll('tbody tr')).filter((tr) => !tr.classList.contains('row-group') && !tr.classList.contains('row-total'));
    const ours = damage.slice(0, 5).map((tr) => Number(tr.querySelector('td[data-col="damageDone"]')!.textContent!.replace(/,/g, '')));
    expect(ours).toEqual([...ours].sort((a, b) => b - a));
    fireEvent.click(head.getByRole('button', { name: 'Damage received' }));
    const taken = Array.from(table.querySelectorAll('tbody tr'))
      .filter((tr) => !tr.classList.contains('row-group') && !tr.classList.contains('row-total'))
      .slice(0, 5)
      .map((tr) => Number(tr.querySelector('td[data-col="damageReceived"]')!.textContent!.replace(/,/g, '')));
    expect(taken).toEqual([...taken].sort((a, b) => b - a));
  });

  it('a narrow panel draws only the stat columns (no Row, Shielding, Class, Control, Rules); a wider one adds them in that order; headers and rows always line up', async () => {
    const widthPx = { value: 800 };
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const w = this.getAttribute('data-testid') === 'panel-box' ? widthPx.value : 0;
      return { width: w, height: 0, top: 0, left: 0, right: w, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    try {
      const { store, fixtureId } = await playedMatch();
      const cases: { px: number; extra: string[] }[] = [
        { px: 800, extra: [] },
        { px: 1050, extra: ['Row'] },
        { px: 1150, extra: ['Row', 'Shielding'] },
        { px: 1400, extra: ['Row', 'Shielding', 'Class'] },
        { px: 1800, extra: ['Row', 'Shielding', 'Class', 'Control', 'Rules fired'] },
      ];
      for (const c of cases) {
        cleanup();
        widthPx.value = c.px;
        mount(store, fixtureId);
        const table = screen.getByTestId('box-table');
        const head = table.querySelector('thead')!;
        const label = (name: string) => Array.from(head.querySelectorAll('th')).some((th) => th.textContent?.trim() === name);
        for (const name of ['Row', 'Shielding', 'Class', 'Control', 'Rules fired']) expect(label(name), name + ' at ' + c.px + ' px').toBe(c.extra.includes(name));
        // The four columns the owner asked for stay at every width.
        for (const kept of ['Damage done', 'Damage received', 'Healing done', 'Healing received']) expect(label(kept)).toBe(true);
        // Columns: fighter + the extras + 6 stat columns + Freshness + XP; every player row and total row has that many cells.
        const width = 1 + c.extra.length + 6 + 1 + 1;
        const body = Array.from(table.querySelectorAll('tbody tr')).filter((tr) => !tr.classList.contains('row-group') && !tr.classList.contains('is-bench'));
        expect(body.length).toBeGreaterThan(10);
        for (const tr of body) expect(tr.children.length, (tr.textContent ?? '') + ' at ' + c.px + ' px').toBe(width);
        // Group headers span exactly the columns shown (Support is 3 wide with Shielding).
        const spans = Array.from(table.querySelectorAll('thead th.box-group')).map((th) => th.getAttribute('colspan'));
        expect(spans).toEqual(['2', '2', c.extra.includes('Shielding') ? '3' : '2']);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('a result played before healing received was counted shows “—” for it and no total, never a guess', async () => {
    const { store, fixtureId } = await playedMatch();
    const report = store.matchReport(fixtureId);
    if (!report.ok) throw new Error('no report');
    const stripped: MatchReport = {
      ...report.value,
      fighters: report.value.fighters.map((f) => {
        const { healingReceived: _h, ...stats } = f.stats;
        const box = f.box ? (({ healingReceived: _b, ...rest }) => rest)(f.box) : undefined;
        return { ...f, stats, ...(box ? { box: { ...box, rounds: box.rounds.map(({ healingReceived: _r, ...x }) => x) } } : {}) };
      }),
    };
    const store2 = { ...store, matchReport: () => ({ ok: true as const, value: stripped }) } as unknown as Store;
    mount(store2, fixtureId);
    const table = screen.getByTestId('box-table');
    const cells = Array.from(table.querySelectorAll('td[data-col="healingReceived"]'));
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.textContent === '—')).toBe(true);
    expect(within(screen.getByTestId('box-total-us')).getByText('—', { selector: 'td[data-col="healingReceived"]' })).toBeTruthy();
    // The rest still adds up.
    const s = columnSums(table, 'damageDone');
    expect(s.totals.us).toBe(fmt(s.us!));
  });
});
