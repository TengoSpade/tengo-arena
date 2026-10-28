import { describe, expect, it } from 'vitest';
import { asId, type ClubId, type GameState, type WeekId } from '../model';
import { fixtureContent } from '../testkit';
import { hashString, stableStringify } from '../util';
import { createGameEngine, createStandInPorts, type GamePorts } from './index';

const checksumState = (state: unknown): string => hashString(stableStringify(state));
const content = fixtureContent();

/** Wrap every port function so calls are logged as "module.fn" in call order. */
function spied(): { ports: GamePorts; calls: string[]; aiWrites: string[]; watch: { on: boolean } } {
  const calls: string[] = [];
  const aiWrites: string[] = [];
  const watch = { on: false };
  const inner = createStandInPorts();
  const wrap = <T extends object>(name: string, mod: T): T => {
    const out = {} as Record<string, unknown>;
    for (const [k, v] of Object.entries(mod)) {
      out[k] =
        typeof v === 'function'
          ? (...args: unknown[]) => {
              calls.push(`${name}.${k}`);
              // AI acts only through commands: planning must not change the state it reads.
              if (watch.on && name === 'ai' && (k === 'planWeek' || k === 'planSeasonEnd')) {
                const state = args[0] as GameState;
                const before = checksumState(state);
                const result = (v as (...a: unknown[]) => unknown)(...args);
                if (checksumState(state) !== before) aiWrites.push(`${k}:${String(args[1])}`);
                return result;
              }
              return (v as (...a: unknown[]) => unknown)(...args);
            }
          : v;
    }
    return out as T;
  };
  const ports: GamePorts = {
    sim: wrap('sim', inner.sim),
    tactics: wrap('tactics', inner.tactics),
    fighters: wrap('fighters', inner.fighters),
    league: wrap('league', inner.league),
    economy: wrap('economy', inner.economy),
    ai: wrap('ai', inner.ai),
  };
  return { ports, calls, aiWrites, watch };
}

/** Indexes of the first call of each name, which must be strictly increasing. */
function expectOrder(calls: readonly string[], names: readonly string[]): void {
  const at = names.map((n) => calls.indexOf(n));
  for (let i = 0; i < names.length; i++) expect(at[i], `${names[i]} was called`).toBeGreaterThanOrEqual(0);
  for (let i = 1; i < names.length; i++) expect(at[i]!, `${names[i - 1]} before ${names[i]}`).toBeGreaterThan(at[i - 1]!);
}

function advanceTo(engine: ReturnType<typeof createGameEngine>, state: GameState, weekId: string): GameState {
  let s = state;
  while (s.calendar.weekId !== weekId) {
    const r = engine.advanceWeek(s, content);
    if (!r.ok) throw new Error(r.error.message);
    s = r.value.state;
  }
  return s;
}

describe('week processing order (leagues.json calendar.weekProcessingOrder)', () => {
  it('runs the steps in order in a matchweek, the compaction of aged matches last (step 12)', { timeout: 60_000 }, () => {
    const { ports, calls } = spied();
    const engine = createGameEngine(ports);
    const w = engine.createWorld(content, { rootSeed: 'pipe-1' });
    if (!w.ok) throw new Error(w.error.message);
    const mw1 = advanceTo(engine, w.value, 'MW1');
    calls.length = 0;
    const r = engine.advanceWeek(mw1, content);
    expect(r.ok).toBe(true);
    expectOrder(calls, [
      'league.fixturesForWeek',
      'fighters.lineupLock',
      'economy.assignHiredBlades',
      'sim.simulateRound',
      'fighters.freshnessAfterRound',
      'fighters.xpAfterRound',
      'fighters.injuriesAfterRound',
      'league.recordResult',
      'fighters.matchEndProgression',
      'fighters.weeklyLifecycle',
      'economy.weeklyIncome',
      'economy.weeklyCosts',
      'economy.financialStatus',
      'economy.resolveFreeAgentOffers',
      'ai.planWeek',
      'economy.topUpFreeAgentPool',
      'league.nextCalendar',
      'league.compactAgedResults',
    ]);
    // Every result is recorded after every match of the week is simulated (step 1 before step 2); M1.1: round by round.
    expect(calls.lastIndexOf('sim.simulateRound')).toBeLessThan(calls.indexOf('league.recordResult'));
    expect(calls).not.toContain('economy.releaseTrialsRookies');
    expect(calls).not.toContain('sim.simulateMatch');
    expect(calls).not.toContain('fighters.applyMatchLifecycle');
    expect(calls.filter((c) => c === 'fighters.matchEndProgression')).toHaveLength(24);
    expect(calls.filter((c) => c === 'sim.simulateRound').length).toBeGreaterThanOrEqual(48);
    expect(calls.filter((c) => c === 'ai.planWeek')).toHaveLength(48);
  });

  it('P1 releases unsigned trials rookies after the money steps and before free-agent decisions; season 1 opens with the AI season-start phase', () => {
    const { ports, calls } = spied();
    const engine = createGameEngine(ports);
    const w = engine.createWorld(content, { rootSeed: 'pipe-2' });
    if (!w.ok) throw new Error(w.error.message);
    calls.length = 0;
    expect(engine.advanceWeek(w.value, content).ok).toBe(true);
    expectOrder(calls, ['ai.planSeasonEnd', 'economy.financialStatus', 'economy.releaseTrialsRookies', 'economy.resolveFreeAgentOffers', 'ai.planWeek']);
    expect(calls).not.toContain('sim.simulateRound');
  });

  it('seeds the Reckoning when the regular season ends', { timeout: 60_000 }, () => {
    const { ports, calls } = spied();
    const engine = createGameEngine(ports);
    const w = engine.createWorld(content, { rootSeed: 'pipe-3' });
    if (!w.ok) throw new Error(w.error.message);
    const mw16 = advanceTo(engine, w.value, 'MW16');
    calls.length = 0;
    const r = engine.advanceWeek(mw16, content);
    expect(r.ok).toBe(true);
    // core/league: seed after the last regular week is processed, then move the calendar.
    expectOrder(calls, ['ai.planWeek', 'league.seedReckonings', 'league.nextCalendar']);
    if (r.ok) expect(r.value.state.calendar.weekId).toBe('TW1');
  });

  it('season end follows calendar.seasonEndOrder and AI clubs never write state while planning', { timeout: 60_000 }, () => {
    const { ports, calls, aiWrites, watch } = spied();
    const engine = createGameEngine(ports);
    const w = engine.createWorld(content, { rootSeed: 'pipe-4' });
    if (!w.ok) throw new Error(w.error.message);
    let s = w.value;
    while (s.calendar.phase !== 'season-end') {
      const r = engine.advanceWeek(s, content);
      if (!r.ok) throw new Error(r.error.message);
      s = r.value.state;
    }
    calls.length = 0;
    watch.on = true;
    const end = engine.runSeasonEnd(s, content);
    expect(end.ok).toBe(true);
    expectOrder(calls, [
      'league.promotionRelegation',
      'league.archiveSeason',
      'economy.seasonPrizes',
      'league.applyTierMoves',
      'economy.updatePrestige',
      'fighters.seasonEndDevelopment',
      'fighters.seasonEndRetirements',
      'economy.contractExpiries',
      'fighters.offseasonRecovery',
      'economy.poolMaintenance',
      'league.setupSeason',
      'league.seasonStartCalendar',
      'fighters.generateRookies',
      'economy.nextSeasonFinanceSetup',
      'ai.planSeasonEnd',
      'league.compactHistory', // retention last, after every step has read the ending season (05 §5)
    ]);
    expect(calls).not.toContain('economy.weeklyCosts'); // the season end is not a week
    expect(aiWrites).toEqual([]);
  });
});

describe('phase guards', () => {
  it('advanceWeek refuses the season-end phase and runSeasonEnd refuses any other', () => {
    const engine = createGameEngine(createStandInPorts());
    const w = engine.createWorld(content, { rootSeed: 'pipe-5' });
    if (!w.ok) throw new Error(w.error.message);
    const r = engine.runSeasonEnd(w.value, content);
    expect(r.ok ? null : r.error.code).toBe('phase.not-season-end');
    const s: GameState = { ...w.value, calendar: { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' } };
    const a = engine.advanceWeek(s, content);
    expect(a.ok ? null : a.error.code).toBe('phase.season-end');
  });

  it('a failing module returns err and no state', () => {
    const ports = createStandInPorts();
    const broken: GamePorts = { ...ports, economy: { ...ports.economy, weeklyCosts: () => { throw new Error('boom'); } } };
    const engine = createGameEngine(broken);
    const w = engine.createWorld(content, { rootSeed: 'pipe-6' });
    if (!w.ok) throw new Error(w.error.message);
    const before = checksumState(w.value);
    const r = engine.advanceWeek(w.value, content);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'engine.failure' });
    expect(checksumState(w.value)).toBe(before);
  });

  it('the club id order of the AI phase is tier level, then id', () => {
    const { ports, calls } = spied();
    const order: ClubId[] = [];
    const plan = ports.ai.planWeek;
    ports.ai = { ...ports.ai, planWeek: (s, c, k) => (order.push(c), plan(s, c, k)) };
    const engine = createGameEngine(ports);
    const w = engine.createWorld(content, { rootSeed: 'pipe-7' });
    if (!w.ok) throw new Error(w.error.message);
    const p2 = { ...w.value, calendar: { season: 1, weekIndex: 2, weekId: asId<WeekId>('P2'), phase: 'preseason' as const } };
    calls.length = 0;
    expect(engine.advanceWeek(p2, content).ok).toBe(true);
    const level = (c: ClubId) => content.tiers.require(w.value.clubs[c]!.tierId).level;
    const sorted = [...order].sort((a, b) => level(a) - level(b) || (a < b ? -1 : 1));
    expect(order).toEqual(sorted);
  });
});
