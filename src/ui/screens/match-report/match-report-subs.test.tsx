/**
 * Match report, QA fixes: reserves who came in have their own row (a "sub" mark with the round) so team totals
 * add up; the bench and unused reserves show their ⅓ XP; Freshness before → after sits in the box score.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../core/testkit';
import type { FighterId, FixtureId, GameState, MatchReport, RoundLineups, RoundSideLineup } from '../../../core/model';
import { buildMatchReport } from '../league/testing/fake-core';
import { createFakeStore } from '../league/testing/fake-store';
import { Providers } from '../league/testing/providers';
import { makeSampleWorld } from '../league/testing/worlds';
import { benchXpOf, fighterInfos, freshAfter, perspective, startedRound, totals } from './analysis';
import MatchReportScreen from './index';

afterEach(cleanup);
beforeEach(() => {
  window.location.hash = '';
});

const kit = { buildFixtureWorld, fixtureContent };

function lastPlayed(state: GameState): FixtureId {
  const me = state.playerClubId!;
  return Object.values(state.fixtures)
    .filter((f) => state.results[f.id] && f.season === state.calendar.season && (f.homeClubId === me || f.awayClubId === me))
    .sort((a, b) => b.weekIndex - a.weekIndex)[0]!.id;
}

/** The sample world with one reserve of ours swapped in for the fifth fighter after round 1 (the M1.1 round record). */
function worldWithSwap() {
  const world = makeSampleWorld(kit, 'mid');
  const state = structuredClone(world.state) as GameState;
  const id = lastPlayed(state);
  const result = state.results[id]!;
  const me = state.playerClubId!;
  const side: 'home' | 'away' = result.homeClubId === me ? 'home' : 'away';
  const input = result.input[side];
  const out = input.fighters[4]!;
  const reserve = Object.values(state.fighters).find((f) => f.clubId === me && !input.fighters.some((x) => x.fighterId === f.id))!;
  const bench = Object.values(state.fighters).filter((f) => f.clubId === me && f.id !== reserve.id && !input.fighters.some((x) => x.fighterId === f.id));
  result.fighterStats[reserve.id] = { ...structuredClone(result.fighterStats[out.fighterId]!), roundsPlayed: result.rounds.length - 1, downsInflicted: 1, downsSuffered: 0, downs: [] };
  result.fighterStats[out.fighterId] = { ...result.fighterStats[out.fighterId]!, roundsPlayed: 1 };
  const lineup = (ids: FighterId[], fresh: number[], entered: boolean[]): RoundSideLineup => ({
    fighterIds: ids,
    rows: ids.map((_, i) => input.fighters[i]!.row),
    captainIndex: input.captainIndex,
    viceCaptainIndex: input.viceCaptainIndex,
    captainQuality: 50,
    freshness: fresh,
    entered,
  });
  const five = input.fighters.map((f) => f.fighterId);
  const withReserve = [...five.slice(0, 4), reserve.id];
  const other = side === 'home' ? 'away' : 'home';
  result.squads = {
    [side]: { starters: five, reserves: [reserve.id, bench[0]!.id], rows: {}, captainId: null, viceCaptainId: null },
    [other]: { starters: result.input[other].fighters.map((f) => f.fighterId), reserves: [], rows: {}, captainId: null, viceCaptainId: null },
  } as NonNullable<typeof result.squads>;
  result.reserveInputs = { home: [], away: [] };
  result.reserveInputs[side] = [{ ...structuredClone(out), fighterId: reserve.id }];
  const theirs = result.input[other].fighters.map((f) => f.fighterId);
  result.roundLineups = result.rounds.map((r): RoundLineups => {
    const mine = r.round === 1 ? lineup(five, [100, 96, 92, 88, 84], [false, false, false, false, false]) : lineup(withReserve, [90, 86, 82, 78, 100], [false, false, false, false, true]);
    const them = lineup(theirs, [100, 100, 100, 100, 100], [false, false, false, false, false]);
    return { round: r.round, home: side === 'home' ? mine : them, away: side === 'home' ? them : mine };
  });
  result.betweenRounds = [
    {
      afterRound: 1,
      home: side === 'home' ? [{ out: out.fighterId, in: reserve.id, row: out.row, reason: 'player', costsSwap: true }] : [],
      away: side === 'away' ? [{ out: out.fighterId, in: reserve.id, row: out.row, reason: 'player', costsSwap: true }] : [],
      injured: [],
      actingCaptain: { home: null, away: null },
      freshness: {},
    },
  ];
  // Freshness after the match: the fighters' current values (what the report reads).
  const fixture = state.fixtures[id]!;
  state.calendar.season = fixture.season;
  state.calendar.weekIndex = fixture.weekIndex + 1;
  for (const [i, f] of withReserve.entries()) state.fighters[f]!.freshness10 = [700, 660, 620, 580, 760][i]!;
  return { world, state, id, out: out.fighterId, reserve: reserve.id, benchIds: bench.map((b) => b.id), side };
}

function renderReport(state: GameState, content: ReturnType<typeof fixtureContent>, id: FixtureId, mutate?: (r: MatchReport) => MatchReport) {
  const store = createFakeStore({
    game: state,
    content,
    matchReport: (fid) => {
      const r = buildMatchReport(state, fid, content);
      return r.ok && mutate ? { ok: true as const, value: mutate(r.value) } : r;
    },
  });
  render(
    <Providers store={store}>
      <MatchReportScreen params={{ fixtureId: id }} />
    </Providers>,
  );
}

describe('Match report: reserves who came in', () => {
  it('lists the swapped-in reserve with the round he started and keeps the totals whole', () => {
    const { world, state, id, out, reserve } = worldWithSwap();
    const built = buildMatchReport(state, id, world.content);
    if (!built.ok) throw new Error('no report');
    const persp = perspective(built.value, state.playerClubId);
    const infos = fighterInfos(built.value, state.results[id]!, persp);
    const ours = infos.filter((f) => f.us);
    expect(ours).toHaveLength(6);
    expect(ours.slice(0, 5).every((f) => f.enteredRound === null)).toBe(true);
    const sub = ours[5]!;
    expect(sub.id).toBe(reserve);
    expect(sub.enteredRound).toBe(2);
    expect(sub.entry).toEqual({ out, reason: 'player' });
    expect(sub.freshBefore).toBe(100);
    expect([...sub.units.keys()]).toEqual([2, 3].slice(0, state.results[id]!.rounds.length - 1));
    const replaced = ours.find((f) => f.id === out)!;
    expect(startedRound(replaced, 1)).toBe(true);
    expect(startedRound(replaced, 2)).toBe(false);
    // The side's downs are the sum of everyone who fought, the reserve included.
    const stats = state.results[id]!.fighterStats;
    const mySide = persp.usSide;
    expect(totals(infos)[mySide].downs).toBe(ours.reduce((n, f) => n + (stats[f.id]?.downsInflicted ?? 0), 0));
  });

  it('shows a "sub R2" mark, Freshness before → after and a row for every player in the box score', () => {
    const { world, state, id, reserve } = worldWithSwap();
    renderReport(state, world.content, id);
    const table = screen.getByTestId('box-table');
    expect(table.querySelectorAll('tbody tr:not(.row-group)')).toHaveLength(11);
    const subRow = screen.getByTestId('sub-mark').closest('tr')!;
    expect(subRow.textContent).toContain(state.fighters[reserve]!.name.full);
    expect(subRow.textContent).toMatch(/sub R2/);
    // Freshness: the value at his first round start → the value he ended on.
    expect(within(subRow as HTMLElement).getByTestId('cell-fresh').textContent).toMatch(/100\s*→\s*76/);
    // His rounds only: the round 1 tab leaves him out, the round 2 tab has him and not the fighter he replaced.
    fireEvent.click(screen.getByRole('tab', { name: /Round 1/ }));
    expect(screen.queryByTestId('sub-mark')).toBeNull();
    expect(table.querySelectorAll('tbody tr:not(.row-group)')).toHaveLength(10);
    fireEvent.click(screen.getByRole('tab', { name: /Round 2/ }));
    expect(screen.getByTestId('sub-mark').closest('tr')!.textContent).toContain(state.fighters[reserve]!.name.full);
    expect(table.querySelectorAll('tbody tr:not(.row-group)')).toHaveLength(10);
  });

  it('lists the reserve in the XP gained panel too, and reports the Freshness as unknown once a later week passed', () => {
    const { world, state, id, reserve } = worldWithSwap();
    renderReport(state, world.content, id);
    const rows = screen.getAllByTestId('xp-row');
    expect(rows).toHaveLength(6);
    expect(rows.some((r) => r.textContent!.includes(state.fighters[reserve]!.name.full) && /sub R2/.test(r.textContent!))).toBe(true);
    const built = buildMatchReport(state, id, world.content);
    if (!built.ok) throw new Error('no report');
    expect(freshAfter(state, built.value, reserve)).toBe(76);
    state.calendar.weekIndex += 1; // a further week was processed: his Freshness now is not this match's
    expect(freshAfter(state, built.value, reserve)).toBeNull();
  });
});

describe('Match report: bench XP', () => {
  const benchXp = (ids: FighterId[]): Record<string, number> => Object.fromEntries(ids.slice(0, 3).map((b, i) => [b, 4 - i]));

  it('shows the bench and the unused reserve with their ⅓ XP, and a total that adds up', () => {
    const { world, state, id, benchIds } = worldWithSwap();
    const xp = benchXp(benchIds);
    renderReport(state, world.content, id, (r) => ({ ...r, aftermath: { ...r.aftermath, benchXp: xp } as MatchReport['aftermath'] }));
    const rows = screen.getAllByTestId('bench-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain('bench ⅓');
    expect(rows[0]!.textContent).toContain('reserve'); // the second named reserve never came in
    expect(screen.getAllByTestId('bench-xp').map((c) => c.textContent!.replace(/\D/g, ''))).toEqual(['4', '3', '2']);
    const panel = screen.getByTestId('panel-after');
    expect(within(panel).getAllByTestId('xp-bench-row')).toHaveLength(3);
    expect(within(panel).getByTestId('xp-total').textContent).toMatch(/9 bench ⅓/);
    const total = Number(/XP this match: (\d+)/.exec(within(panel).getByTestId('xp-total').textContent!)![1]);
    const starters = within(panel)
      .getAllByTestId('xp-row')
      .reduce((n, r) => n + Number(/(\d+) XP/.exec(r.textContent!)![1]), 0);
    expect(total).toBe(starters + 9);
  });

  it('accepts a list of { fighterId, xp } and leaves a report without bench XP as it was', () => {
    const { world, state, id, benchIds } = worldWithSwap();
    const built = buildMatchReport(state, id, world.content);
    if (!built.ok) throw new Error('no report');
    const persp = perspective(built.value, state.playerClubId);
    expect(benchXpOf(built.value, persp, state)).toEqual([]);
    const listed = { ...built.value, aftermath: { ...built.value.aftermath, benchXp: [{ fighterId: benchIds[1], xp: 5 }] } } as MatchReport;
    expect(benchXpOf(listed, persp, state)).toEqual([{ id: benchIds[1], xp: 5, reserve: false }]);
    // Never for the other club's fighters, and never in a match we did not play.
    const foreign = Object.values(state.fighters).find((f) => f.clubId !== state.playerClubId && f.clubId)!;
    const mixed = { ...built.value, aftermath: { ...built.value.aftermath, benchXp: { [foreign.id]: 3 } } } as MatchReport;
    expect(benchXpOf(mixed, persp, state)).toEqual([]);
    expect(benchXpOf(listed, { ...persp, involved: false }, state)).toEqual([]);
    cleanup();
    renderReport(state, world.content, id);
    expect(screen.queryAllByTestId('bench-row')).toHaveLength(0);
    expect(screen.getByTestId('xp-total').textContent).not.toContain('bench');
  });

  it('shows bench XP in the squads and swaps list for a reserve who never came in', () => {
    const { world, state, id, benchIds, side } = worldWithSwap();
    const xp = benchXp(benchIds);
    const result = state.results[id]!;
    const squad = result.squads![side];
    const fighters = Object.fromEntries(
      [...squad.starters.map((f) => [f, 'starter'] as const), ...squad.reserves.map((f) => [f, 'reserve'] as const)].map(([f, role]) => [
        f,
        { side, role, rounds: result.roundLineups!.filter((r) => r[side].fighterIds.includes(f)).map((r) => r.round), enteredAfter: null, enteredHow: null, withdrawnAfter: null, injuredInRound: null },
      ]),
    );
    renderReport(state, world.content, id, (r) => ({
      ...r,
      aftermath: { ...r.aftermath, benchXp: xp } as MatchReport['aftermath'],
      timeline: { squads: result.squads!, rounds: result.roundLineups!, steps: result.betweenRounds!, emergencyEntrants: [], fighters },
    } as MatchReport));
    const rows = within(screen.getByTestId('md-xp')).getAllByRole('listitem');
    // The reserve who never came in (second named) has no round XP: only his bench ⅓.
    const unused = rows.find((r) => r.textContent!.includes(state.fighters[benchIds[0]!]!.name.full))!;
    expect(unused.textContent).toContain('reserve, did not enter');
    expect(unused.textContent).toContain('+4 XP');
    expect(unused.textContent).toContain('bench ⅓');
    // The rest of the bench follows.
    const other = rows.find((r) => r.textContent!.includes(state.fighters[benchIds[1]!]!.name.full))!;
    expect(other.textContent).toMatch(/\+3 XP.*bench ⅓/);
  });
});
