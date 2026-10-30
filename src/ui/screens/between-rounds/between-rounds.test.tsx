import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentDB } from '../../../core/content';
import { asId, type ClubId, type FighterId, type FighterMatchStats, type GameState, type MatchState, type RoundResult, type WeekReport } from '../../../core/model';
import { buildFixtureWorld, fixtureContent, fixtureMatchState } from '../../../core/testkit';
import { ok } from '../../../core/util';
import { installShortcuts } from '../../app/shortcuts';
import { resetToasts } from '../../components';
import { createDevEngine } from '../../debug/dev-engine';
import { TestProviders, createTestStore } from '../../debug/test-store';
import type { GameEngine } from '../../store/engine';
import { resetViewerPrefetch } from '../arena/viewer-factory';
import BetweenRoundsScreen from './index';

// The viewer entry is a stand-in: PixiJS never loads into happy-dom (the prefetch test below only counts the calls).
const viewerEntry = vi.hoisted(() => ({ prefetchViewerChunks: vi.fn(async () => undefined), createArenaViewer: vi.fn() }));
vi.mock('../../../render/viewer', () => viewerEntry);

let dispose: (() => void) | null = null;
beforeEach(() => {
  resetToasts();
  location.hash = '#/between-rounds';
});
afterEach(() => {
  cleanup();
  dispose?.();
  dispose = null;
});

/** A complete FighterMatchStats with nothing done yet. */
function blankStats(clubId: ClubId): FighterMatchStats {
  return {
    clubId,
    roundsPlayed: 0,
    roundsSurvived: 0,
    ticksOnArena: 0,
    damageDealt: 0,
    damageToShields: 0,
    damageTaken: 0,
    healingDone: 0,
    healingReceived: 0,
    shieldingDone: 0,
    overheal: 0,
    ccAppliedTicks: 0,
    ccReceivedTicks: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    assists: 0,
    focusSpent: 0,
    casts: {},
    ruleFires: [],
    ruleCommittedTicks: [],
    rulesNeverFired: [],
    downs: [],
    opponentIds: [],
  };
}

function round(n: number, winner: 'home' | 'away'): RoundResult {
  return {
    round: n,
    seed: `r${n}`,
    winner,
    endReason: 'elimination',
    tiebreakStep: null,
    durationTicks: 720,
    survivors: { home: winner === 'home' ? 3 : 0, away: winner === 'away' ? 2 : 0 },
    downs: { home: 2, away: 5 },
    finalHp: [],
    checksum: 'x',
    eventHash: null,
  } as unknown as RoundResult;
}

/** The player's (home) match waiting after round 1, his first starter Spent. */
function liveWorld(content: ContentDB, opts: { spentFirst?: boolean; prepare?: (state: GameState, ms: MatchState) => void } = {}): { state: GameState; ms: MatchState; home: ClubId } {
  const state = buildFixtureWorld({ squadReserves: 2 });
  const [home, away] = Object.keys(state.clubs) as ClubId[];
  state.playerClubId = home!;
  const ms = fixtureMatchState(state, home!, away!, content);
  ms.phase = 'between_rounds';
  ms.rounds = [round(1, 'home')];
  ms.score = { home: 1, away: 0 };
  const lineup = (side: 'home' | 'away') => ({
    fighterIds: [...ms[side].active],
    rows: [...ms[side].rows],
    captainIndex: 0,
    viceCaptainIndex: 1,
    captainQuality: 50,
    freshness: ms[side].active.map(() => 100),
    entered: ms[side].active.map(() => false),
  });
  ms.roundLineups = [{ round: 1, home: lineup('home'), away: lineup('away') }];
  if (opts.spentFirst) state.fighters[ms.home.active[0]!]!.freshness10 = 300;
  opts.prepare?.(state, ms);
  state.liveMatch = ms;
  return { state, ms, home: home! };
}

function setup(opts: { spentFirst?: boolean; pauseAgain?: boolean; prepare?: (state: GameState, ms: MatchState) => void } = {}) {
  const content = fixtureContent();
  const { state, ms, home } = liveWorld(content, opts);
  const report = { season: 1, weekIndex: 1, playerFixtureId: null } as unknown as WeekReport;
  const advance = vi.fn((s: GameState) => {
    if (opts.pauseAgain && s.liveMatch && s.liveMatch.rounds.length === 1) {
      const next = structuredClone(s);
      next.liveMatch!.rounds.push(round(2, 'away'));
      next.liveMatch!.score = { home: 1, away: 1 };
      next.liveMatch!.roundLineups.push(structuredClone(next.liveMatch!.roundLineups[0]!));
      next.liveMatch!.playerDecisions = null;
      return ok({ state: next, week: null, pause: null });
    }
    return ok({ state: { ...s, liveMatch: null }, week: report, pause: null });
  });
  const engine: GameEngine = { ...createDevEngine(), advance: advance as unknown as GameEngine['advance'] };
  const t = createTestStore({ world: 'none', engine });
  t.store.replaceWorld(state, content);
  dispose = installShortcuts(() => ({}));
  render(
    <TestProviders store={t.store}>
      <BetweenRoundsScreen params={{}} />
    </TestProviders>,
  );
  return { ...t, ms, home, advance };
}

describe('Between-round screen', () => {
  it('shows the round, score, the five with Freshness, reserves, swaps left and the rules; a routine round is one click', async () => {
    const { ms, advance, store } = setup();
    expect(screen.getByTestId('br-score').textContent).toContain('1–0');
    expect(screen.getByTestId('br-result').textContent).toContain('Won round 1');
    for (const id of ms.home.active) expect(screen.getByTestId(`br-row-${id}`)).toBeTruthy();
    for (const id of ms.home.unusedReserves) expect(screen.getByTestId(`br-reserve-${id}`)).toBeTruthy();
    expect(screen.getByTestId('screen-between-rounds').textContent).toContain('2 swaps left');
    expect(screen.getByTestId('br-rules').textContent).toContain('below 50');
    expect(screen.getByTestId('br-cover').textContent).toMatch(/Cover:|No role cover/);
    // No suggestion (everyone fresh): one click plays on, with no swap command.
    await act(async () => {
      fireEvent.click(screen.getByTestId('br-continue'));
    });
    await vi.waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(store.recentCommands.value.find((c) => c.command.type === 'match.swap')?.command).toMatchObject({ swaps: [] });
    expect(store.game.value!.liveMatch).toBeNull();
  });

  it('pre-fills the auto-swap suggestion for a Spent starter: accepting it is one click; a swap of your own asks once (cannot return)', async () => {
    const { ms, advance, store } = setup({ spentFirst: true });
    const out = ms.home.active[0]!;
    const select = screen.getByTestId(`br-swap-${out}`) as HTMLSelectElement;
    expect(select.value).not.toBe('');
    expect(within(screen.getByTestId(`br-row-${out}`)).getByText('suggested')).toBeTruthy();
    expect(screen.getByTestId('br-suggested').textContent).toContain('cannot return');
    // Changing the plan (no swaps, then a swap of your own) needs the confirmation…
    await act(() => {
      fireEvent.keyDown(document.body, { key: 'n' });
    });
    await act(() => {
      fireEvent.keyDown(document.body, { key: '2' });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('br-continue'));
    });
    expect(screen.getByTestId('br-continue-dialog').textContent).toContain('cannot return');
    fireEvent.click(within(screen.getByTestId('br-continue-dialog')).getByText(/Cancel/));
    // …accepting the rules' suggestion as it stands does not: one click plays on.
    await act(() => {
      fireEvent.keyDown(document.body, { key: 'a' });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('br-continue'));
    });
    await vi.waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
    expect(store.recentCommands.value.find((c) => c.command.type === 'match.swap')?.command).toMatchObject({ swaps: [{ out }] });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  it('is keyboard-first: 1 swaps slot 1 for a reserve, N clears, Enter plays on; the next step resets from its suggestions', async () => {
    const { ms, advance, store } = setup({ pauseAgain: true });
    const out = ms.home.active[0]!;
    await act(() => {
      fireEvent.keyDown(document.body, { key: '1' });
    });
    const select = screen.getByTestId(`br-swap-${out}`) as HTMLSelectElement;
    expect(select.value).toBe(ms.home.unusedReserves[0]);
    await act(() => {
      fireEvent.keyDown(document.body, { key: 'n' });
    });
    expect(select.value).toBe('');
    await act(() => {
      fireEvent.keyDown(document.body, { key: '1' });
    });
    // Enter with a swap opens the confirmation; confirming records the player's decision.
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Enter' });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('br-continue-confirm'));
    });
    const swap = store.recentCommands.value.find((c) => c.command.type === 'match.swap');
    expect(swap?.command).toMatchObject({ type: 'match.swap', afterRound: 1, swaps: [{ out, in: ms.home.unusedReserves[0] }] });
    await vi.waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    // Paused again after round 2: the screen shows the new step.
    expect(screen.getByTestId('br-score').textContent).toContain('1–1');
    expect(screen.getByTestId('br-result').textContent).toContain('Lost round 2');
    expect((screen.getByTestId(`br-swap-${out}`) as HTMLSelectElement).value).toBe('');
  });

  it('AL-R002-T004: each starter shows his rating (and what it is worth at his Freshness) and this match’s stats so far; the reserves show rating, Freshness and the effective rating', () => {
    const { ms, content } = setup({
      spentFirst: true,
      prepare: (state, live) => {
        const [a, b] = [live.home.active[0]!, live.home.active[1]!];
        live.fighterStats[a] = { ...blankStats(state.fighters[a]!.clubId!), roundsPlayed: 1, damageDealt: 1234, damageTaken: 2051, healingDone: 321, healingReceived: 654, shieldingDone: 90, downsInflicted: 2, downsSuffered: 1 };
        live.fighterStats[b] = { ...blankStats(state.fighters[b]!.clubId!), roundsPlayed: 2, damageDealt: 99, damageTaken: 12, healingDone: 0, healingReceived: 0, shieldingDone: 0, downsInflicted: 0, downsSuffered: 0 };
        // A tired reserve: his effective rating shows beside his rating.
        state.fighters[live.home.unusedReserves[0]!]!.freshness10 = 350;
      },
    });
    const [a, b] = [ms.home.active[0]!, ms.home.active[1]!];
    const head = screen.getByTestId('br-table').querySelector('thead')!.textContent!;
    for (const word of ['Rating', 'Freshness', 'Damage', 'Healing', 'Done', 'Taken', 'Downs', 'Rds', 'XP']) expect(head).toContain(word);
    // Numbers so far in this match.
    expect(screen.getByTestId(`br-dmg-${a}`).textContent).toBe('1,234');
    expect(screen.getByTestId(`br-taken-${a}`).textContent).toBe('2,051');
    expect(screen.getByTestId(`br-heal-${a}`).textContent).toBe('321');
    expect(screen.getByTestId(`br-healed-${a}`).textContent).toBe('654');
    expect(screen.getByTestId(`br-downs-${a}`).textContent).toMatch(/^2\s*\/\s*1$/);
    expect(screen.getByTestId(`br-rounds-${a}`).textContent).toBe('1');
    expect(screen.getByTestId(`br-rounds-${b}`).textContent).toBe('2');
    expect(screen.getByTestId(`br-healed-${b}`).textContent).toBe('0');
    // Rating: a Spent starter reads "rating → effective" (core's effective rating), a rested one just the rating.
    const spent = screen.getByTestId(`br-eff-${a}`);
    const base = Number(spent.querySelector('.rating-eff__base')!.textContent);
    const effective = Number(spent.querySelector('.rating')!.textContent);
    expect(effective).toBeLessThan(base);
    expect(spent.getAttribute('data-tip-rich')).toContain('Freshness penalty');
    expect(screen.queryByTestId(`br-eff-${b}`)).toBeNull();
    expect(within(screen.getByTestId(`br-rating-${b}`)).getByText(/^\d+$/)).toBeTruthy();
    // Reserves: rating, Freshness and the effective rating of a tired one.
    const reserve = ms.home.unusedReserves[0]!;
    const card = screen.getByTestId(`br-reserve-${reserve}`);
    expect(within(card).getByTestId(`br-reserve-eff-${reserve}`)).toBeTruthy();
    expect(card.textContent).toMatch(/Tired|Spent/);
    const other = ms.home.unusedReserves[1]!;
    expect(within(screen.getByTestId(`br-reserve-${other}`)).getByLabelText(/^Freshness \d+/)).toBeTruthy();
    void content;
  });

  it('keeps Enter = play with the wider table', async () => {
    const { advance } = setup();
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Enter' });
    });
    await vi.waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  it('says so when no match waits', () => {
    const t = createTestStore();
    render(
      <TestProviders store={t.store}>
        <BetweenRoundsScreen params={{}} />
      </TestProviders>,
    );
    expect(screen.getByText('No match is waiting')).toBeTruthy();
  });
});

void asId<FighterId>;

describe('the viewer prefetch from the between-round screen (A10: the next round opens warm)', () => {
  const idle: (() => void)[] = [];
  const realIdle = window.requestIdleCallback;
  beforeEach(() => {
    viewerEntry.prefetchViewerChunks.mockClear();
    resetViewerPrefetch();
    idle.length = 0;
    vi.stubEnv('MODE', 'development');
    window.requestIdleCallback = ((fn: () => void) => idle.push(fn)) as unknown as typeof window.requestIdleCallback;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    window.requestIdleCallback = realIdle;
  });
  const watchMode = (mode: 'watch' | 'simulate') => (_s: GameState, ms: MatchState) => {
    (ms as { watch?: unknown }).watch = { mode, round: null, cursorTick: 0, calls: [] };
  };

  it('a watched match warms the viewer chunks at idle while the player decides his swaps', async () => {
    setup({ prepare: watchMode('watch') });
    expect(viewerEntry.prefetchViewerChunks).not.toHaveBeenCalled();
    await act(async () => {
      idle.splice(0).forEach((fn) => fn());
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(viewerEntry.prefetchViewerChunks).toHaveBeenCalledTimes(1);
  });

  it('a simulated match does not', async () => {
    setup({ prepare: watchMode('simulate') });
    expect(idle).toHaveLength(0);
  });
});
