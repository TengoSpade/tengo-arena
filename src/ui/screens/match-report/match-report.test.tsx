import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../core/testkit';
import type { FixtureId, GameState, MatchReport } from '../../../core/model';
import { engineError, err, ok } from '../../../core/util';
import { buildMatchReport } from '../league/testing/fake-core';
import { createFakeStore } from '../league/testing/fake-store';
import { Providers } from '../league/testing/providers';
import { makeSampleWorld } from '../league/testing/worlds';
import { fillLabel, ruleText } from './rule-sentence';
import { perspective, roundList, selectTraces, fighterInfos } from './analysis';
import MatchReportScreen from './index';

afterEach(cleanup);
beforeEach(() => {
  window.location.hash = '';
});

const kit = { buildFixtureWorld, fixtureContent };

function lastPlayed(state: GameState, opts: { home?: boolean; won?: boolean } = {}): FixtureId {
  const me = state.playerClubId!;
  const list = Object.values(state.fixtures)
    .filter((f) => state.results[f.id] && f.season === state.calendar.season && (f.homeClubId === me || f.awayClubId === me))
    .filter((f) => opts.home === undefined || (f.homeClubId === me) === opts.home)
    .filter((f) => opts.won === undefined || (state.results[f.id]!.winnerClubId === me) === opts.won)
    .sort((a, b) => b.weekIndex - a.weekIndex);
  return list[0]!.id;
}

function renderReport(fixtureId: FixtureId, mutate?: (r: MatchReport) => MatchReport) {
  const world = makeSampleWorld(kit, 'mid');
  const store = createFakeStore({
    game: world.state,
    content: world.content,
    matchReport: (id) => {
      const r = buildMatchReport(world.state, id, world.content);
      return r.ok && mutate ? ok(mutate(r.value)) : r;
    },
  });
  render(
    <Providers store={store}>
      <MatchReportScreen params={{ fixtureId }} />
    </Providers>,
  );
  return world;
}

describe('Match report screen', () => {
  it('shows an empty state without a career', () => {
    render(<MatchReportScreen params={{ fixtureId: 'x' }} />);
    expect(screen.getByTestId('screen-match-report').textContent).toContain('No career loaded');
  });

  it('shows the score, the result line, round pips and the MVP', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state, { home: true, won: true });
    cleanup();
    renderReport(id);
    const board = screen.getByTestId('scoreboard');
    const result = world.state.results[id]!;
    expect(within(board).getByRole('heading', { level: 1 }).textContent).toContain(`${result.score.home},`);
    expect(screen.getByTestId('result-line').textContent).toMatch(/^Won · \+\d pts · gate /);
    expect(board.querySelectorAll('.round-pip')).toHaveLength(result.rounds.length);
    expect(screen.getByTestId('mvp').textContent).toContain(world.state.fighters[result.mvpFighterId!]!.name.full);
  });

  it('explains the result with a summary and 3 to 5 rule traces', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    cleanup();
    renderReport(id);
    expect(screen.getByTestId('why-summary').textContent).toMatch(/(Won|Lost) \d–\d on downs/);
    const traces = screen.getAllByTestId('trace');
    expect(traces.length).toBeGreaterThanOrEqual(3);
    expect(traces.length).toBeLessThanOrEqual(5);
    expect(traces.some((tr) => tr.getAttribute('data-verdict') === 'helped')).toBe(true);
    expect(traces[0]!.querySelector('.rule')).toBeTruthy();
  });

  it('lists both sides in the box score, ours first, and sorts by a column', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    cleanup();
    renderReport(id);
    const table = screen.getByTestId('box-table');
    const groups = table.querySelectorAll('tr.row-group');
    expect(groups).toHaveLength(2);
    expect(groups[0]!.textContent).toContain('· you');
    expect(table.querySelectorAll('tbody tr:not(.row-group)')).toHaveLength(10);
    const downs = within(table).getByRole('button', { name: 'Downs' });
    fireEvent.click(downs);
    expect(downs.closest('th')!.getAttribute('aria-sort')).toBe('descending');
  });

  it('shows rule recaps with fire bars and never-fired warnings, for either side', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    cleanup();
    renderReport(id, (r) => ({
      ...r,
      fighters: r.fighters.map((f) => ({ ...f, rules: f.rules.map((x) => (x.index === 0 ? { ...x, fires: 0, neverFired: true } : x)) })),
    }));
    const panel = screen.getByTestId('panel-recaps');
    expect(within(panel).getAllByTestId('recap-card')).toHaveLength(5);
    expect(within(panel).getAllByTestId('never-fired').length).toBeGreaterThanOrEqual(1);
    expect(panel.querySelectorAll('.meter').length).toBeGreaterThan(5);
    fireEvent.click(within(panel).getByRole('button', { name: 'Theirs' }));
    expect(within(panel).getAllByTestId('recap-card')).toHaveLength(5);
  });

  it('filters by round with the tabs and the number keys', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    cleanup();
    renderReport(id);
    fireEvent.click(screen.getByRole('tab', { name: /Round 2/ }));
    expect(screen.getByTestId('panel-box').textContent).toContain('Round 2 · downs, falls and HP left');
    const momentsPanel = screen.getByTestId('panel-moments');
    expect(momentsPanel.querySelectorAll('.timeline__round')).toHaveLength(1);
    fireEvent.keyDown(window, { key: '0' });
    expect(screen.getByTestId('panel-box').textContent).toContain('Whole match');
    fireEvent.keyDown(window, { key: '1' });
    expect(screen.getByRole('tab', { name: /Round 1/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('highlights a fighter in the box score when a key moment is clicked', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    cleanup();
    renderReport(id);
    const down = screen.getAllByTestId('moment').find((m) => m.getAttribute('data-event') === 'down')!;
    fireEvent.click(down);
    expect(screen.getByTestId('box-table').querySelectorAll('tr[aria-selected="true"]')).toHaveLength(1);
  });

  it('shows downs (death summaries), injuries and XP', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    cleanup();
    renderReport(id, (r) => ({
      ...r,
      aftermath: { ...r.aftermath, injuries: [{ fighterId: r.fighters.find((f) => f.clubId === world.state.playerClubId)!.fighterId, severity: 'minor', weeksOut: 2 }] },
    }));
    expect(screen.getAllByTestId('down-summary').length).toBeGreaterThan(0);
    expect(screen.getByTestId('panel-after').textContent).toMatch(/minor injury · out 2 wk/);
    expect(screen.getByTestId('xp-list').children).toHaveLength(5);
  });

  it('keeps score and box score when the timeline is unavailable', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    cleanup();
    renderReport(id, (r) => ({ ...r, timelineAvailable: false }));
    expect(screen.getByText('Details unavailable for this match')).toBeTruthy();
    expect(screen.getByTestId('panel-box')).toBeTruthy();
    expect(screen.queryByTestId('panel-moments')).toBeNull();
  });

  it('shows an error state when the report cannot be built', () => {
    const world = makeSampleWorld(kit, 'mid');
    const store = createFakeStore({ game: world.state, content: world.content, matchReport: () => err(engineError('report.version', 'Engine changed')) });
    render(
      <Providers store={store}>
        <MatchReportScreen params={{ fixtureId: 'nope' }} />
      </Providers>,
    );
    expect(screen.getByText('This report could not be built')).toBeTruthy();
    expect(screen.getByText(/report.version/)).toBeTruthy();
  });

  it('tells an AI-vs-AI result from the home side', () => {
    const world = makeSampleWorld(kit, 'mid');
    const me = world.state.playerClubId!;
    const other = Object.values(world.state.fixtures).find((f) => world.state.results[f.id] && f.homeClubId !== me && f.awayClubId !== me)!;
    cleanup();
    renderReport(other.id);
    expect(screen.getByTestId('result-line').textContent).toMatch(/ won$/);
  });

  it('moves to the previous report with the left arrow', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    cleanup();
    renderReport(id);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(window.location.hash).toMatch(/^#\/match\/lg%3A2%3A/);
    expect(decodeURIComponent(window.location.hash)).not.toContain(id);
  });
});

describe('report analysis', () => {
  it('fills vocabulary labels, dropping optional parts without a value', () => {
    const content = fixtureContent();
    expect(fillLabel(content, 'An enemy is below {pct}% HP [within {band}]', { pct: 40 }, 'oathguard')).toBe('An enemy is below 40% HP');
    expect(fillLabel(content, 'An enemy is below {pct}% HP [within {band}]', { pct: 40, band: 'close' }, 'oathguard')).toBe('An enemy is below 40% HP within close');
    expect(fillLabel(content, 'Use {slot}', { slot: 'a1' }, 'oathguard')).toBe(`Use ${content.classAbility('oathguard', 'a1').name}`);
  });

  it('renders a preset rule as a sentence', () => {
    const content = fixtureContent();
    const rule = content.presets.require('oathguard_balanced').rules[0]!;
    expect(ruleText(content, rule, 'oathguard')).toMatch(/^If .+ then Use .+ on .+ only in range now$/);
  });

  it('names rounds in plain English', () => {
    expect(roundList([2])).toBe('round 2');
    expect(roundList([3, 1])).toBe('rounds 1 and 3');
    expect(roundList([1, 2, 3])).toBe('rounds 1, 2 and 3');
  });

  it('flags never-fired rules of our starters as traces', () => {
    const world = makeSampleWorld(kit, 'mid');
    const id = lastPlayed(world.state);
    const built = buildMatchReport(world.state, id, world.content);
    if (!built.ok) throw new Error('no report');
    const report: MatchReport = {
      ...built.value,
      fighters: built.value.fighters.map((f) => ({ ...f, rules: f.rules.map((r) => ({ ...r, neverFired: !r.isStance && r.index === 1 ? true : r.neverFired, fires: !r.isStance && r.index === 1 ? 0 : r.fires })) })),
    };
    const persp = perspective(report, world.state.playerClubId);
    const infos = fighterInfos(report, world.state.results[id]!, persp);
    const traces = selectTraces(report, infos, persp, world.state, world.content);
    expect(traces.some((t) => t.verdict === 'idle')).toBe(true);
    expect(traces.length).toBeLessThanOrEqual(5);
  });
});
