/**
 * WP4 acceptance (05 §9.2): a 1-season finance simulation over the fixture
 * world keeps the ledger invariant after every operation and matches the
 * tier money flows of 03-league-economy §8 within ±5%.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ContentDB } from '../content';
import type { ClubId, GameState } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { stableStringify } from '../util';
import { simulateFinanceSeason, type SimResult, type TierFlows } from './finance-sim';
import { initialFinances, ledgerInvariantViolations, reserveContribution, wageBudgetOf } from './index';
import { addFighter, resetFighterDoubles, setFighterValues, setWeek } from './testing';

vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);

const content = fixtureContent();

/** The typical roster of the §8 reference situation, per tier: 5 starters and reserves (ratings), roster size. */
const TYPICAL: Record<number, { starter: number; reserve: number; size: number }> = {
  1: { starter: 73, reserve: 65, size: 12 },
  2: { starter: 58, reserve: 50, size: 11 },
  3: { starter: 43, reserve: 35, size: 9 },
};

function buildWorld(): GameState {
  resetFighterDoubles();
  const s = buildFixtureWorld({ fightersPerClub: 5, freeAgents: 120 });
  setWeek(s, content, 1);
  for (const club of Object.values(s.clubs)) {
    const level = content.tiers.require(club.tierId).level;
    const t = TYPICAL[level]!;
    const roster = Object.values(s.fighters).filter((f) => f.clubId === club.id);
    for (const f of roster) f.contract = null;
    while (roster.length < t.size) roster.push(addFighter(s, content, { values: { rating: 1, potential: 1 }, clubId: club.id, overrides: { contract: null } }));
    roster.forEach((f, i) => {
      const r = i < 5 ? t.starter : t.reserve;
      setFighterValues(f.id, { rating: r, potential: r, humanAge100: 2_800 });
    });
  }
  let i = 0;
  for (const f of Object.values(s.fighters)) {
    if (f.clubId !== null) continue;
    const band = [[60, 75], [45, 60], [30, 45]][i % 3]!;
    const r = band[0]! + ((i * 7) % (band[1]! - band[0]!));
    setFighterValues(f.id, { rating: r, potential: r + (i % 5), humanAge100: 2_800 });
    i += 1;
  }
  initialFinances(s, content);
  return s;
}

/**
 * The §8 money flows of a par-prestige club in an average season, from content:
 * grant + retainer + 8 home gates + 8 win bonuses + mean table prize + mean Reckoning money
 * (prize, qualifier bonus, tournament win bonuses and gates); wages = WB × 23 (full use of the
 * wage budget, as the §8 reference assumes); costs = wages + operating cost + contract turnover
 * (a third of the bill signed or renewed each season for two seasons at the 10% signing cost,
 * which is what reconciles the reference costs of 84,800 with wages 68,080 + operations 12,190).
 */
function expectedFlows(c: ContentDB, level: number) {
  const p = c.tierProfile(level);
  const tier = c.tierByLevel(level);
  const n = tier.clubCount;
  const w = c.economy.season.wageWeeksPerSeason;
  const gate = p.gateBase;
  let table = 0;
  for (let r = 1; r <= n; r++) table += Math.trunc((p.tablePrizeTop * (n + 1 - r)) / n / 10) * 10;
  const tp = p.tournamentPrize;
  const reckoning =
    (4 * tp.quarterfinal + 2 * tp.semifinal + tp.finalist + tp.champion + 8 * p.sponsorTournamentBonus + 7 * p.sponsorWinBonus + (6 * gate * 3) / 2 + 2 * gate) / n;
  const income = p.centralGrant + p.sponsorRetainerBase + 8 * gate + 8 * p.sponsorWinBonus + table / n + reckoning;
  const sb = p.centralGrant + p.sponsorRetainerBase + c.economy.season.homeFixturesPerClub * gate;
  const wb = wageBudgetOf(sb, p.wageRatioBp, reserveContribution(sb, p.startingBalanceBase, c), c);
  const wages = wb * w;
  const turnover = (c.economy.contracts.signingCostBp * (wb / 3) * 2 * w) / 10_000;
  return { sb, wb, income, wages, costs: wages + p.opsCostPerWeek * w + turnover };
}

const within = (actual: number, expected: number, tol = 0.05) => Math.abs(actual - expected) <= Math.abs(expected) * tol;

let result: SimResult;
let state: GameState;

beforeAll(() => {
  state = buildWorld();
  result = simulateFinanceSeason(state, content, (label) => {
    const v = ledgerInvariantViolations(state);
    if (v.length > 0) throw new Error(`ledger invariant broken after ${label}: ${v.slice(0, 3).join('; ')}`);
  });
});

describe('1-season finance simulation (fixture world, 48 clubs)', () => {
  it('keeps the ledger invariant after every operation and ends in a valid next-season setup', () => {
    expect(result.checks).toBeGreaterThan(23 * 6);
    expect(ledgerInvariantViolations(state)).toEqual([]);
    expect(state.calendar.phase).toBe('season-end');
    for (const club of Object.values(state.clubs)) {
      expect(club.finance.seasonBudget).toBeGreaterThan(0);
      expect(club.finance.wageBudgetPerWeek).toBeGreaterThan(0);
      expect(state.ledger.openingBalances[club.id as ClubId]).toBeDefined();
    }
    expect(result.record.tiers.map((t) => [t.promotedIds.length, t.relegatedIds.length])).toEqual([[0, 2], [2, 2], [2, 0]]);
  });

  it('the analytic §8 flows match the reference figures (Banner income ~100,300, costs ~84,800, wages 68,080; wage/income 0.66-0.70)', () => {
    const banner = expectedFlows(content, 2);
    expect([expectedFlows(content, 1).sb, banner.sb, expectedFlows(content, 3).sb]).toEqual([202_000, 82_400, 32_400]);
    expect([expectedFlows(content, 1).wb, banner.wb, expectedFlows(content, 3).wb]).toEqual([7_454, 2_960, 1_138]);
    expect(banner.wages).toBe(68_080);
    expect(within(banner.income, 100_300)).toBe(true);
    expect(within(banner.costs, 84_800)).toBe(true);
    for (const level of [1, 2, 3]) {
      const e = expectedFlows(content, level);
      expect(within(e.wages / e.income, 0.68)).toBe(true);
    }
  });

  it.each([1, 2, 3])('tier %i: simulated income, wages, costs and wage/income within ±5% of the §8 flows', (level) => {
    const sim = result.flows.find((f: TierFlows) => f.tierLevel === level)!;
    const e = expectedFlows(content, level);
    expect(sim.clubs).toBe(16);
    expect({ level, income: sim.income, ok: within(sim.income, e.income) }).toEqual({ level, income: sim.income, ok: true });
    expect({ level, wages: sim.wages, ok: within(sim.wages, e.wages) }).toEqual({ level, wages: sim.wages, ok: true });
    expect({ level, costs: sim.costs, ok: within(sim.costs, e.costs) }).toEqual({ level, costs: sim.costs, ok: true });
    expect({ level, ratio: sim.wageToIncomeBp, ok: within(sim.wageToIncomeBp, 6_800) }).toEqual({ level, ratio: sim.wageToIncomeBp, ok: true });
    expect(within(sim.seasonBudget, e.sb)).toBe(true);
  });

  it('is deterministic: the same world and seed give the same flows', () => {
    const again = buildWorld();
    const second = simulateFinanceSeason(again, content, () => undefined);
    expect(second.flows).toEqual(result.flows);
  });

  it('every club ends the season solvent with a surplus near the §8 reference (+19% of SB, here 10-30% per tier)', () => {
    for (const f of result.flows) expect(f.surplusToSbBp >= 1_000 && f.surplusToSbBp <= 3_000).toBe(true);
    const negative = Object.values(state.clubs).filter((c) => c.finance.balance < 0);
    expect(negative).toEqual([]);
  });
});

describe('three seasons headless (le-027 economy part, le-030)', () => {
  function threeSeasons() {
    const s = buildWorld();
    const flows: TierFlows[][] = [];
    for (let season = 1; season <= 3; season++) {
      if (season > 1) setWeek(s, content, 1, season);
      const r = simulateFinanceSeason(s, content, (label) => {
        const v = ledgerInvariantViolations(s);
        if (v.length > 0) throw new Error(`season ${season}, ${label}: ${v[0]}`);
      });
      flows.push(r.flows);
    }
    return { s, flows };
  }

  it('keeps the invariant across season boundaries, never pays a patron bonus, and is identical when run twice', () => {
    const a = threeSeasons();
    expect(a.s.ledger.entries.some((e) => e.category === 'patronBonus')).toBe(false);
    for (const season of a.flows) for (const f of season) expect(f.wageToIncomeBp).toBeGreaterThan(5_000);
    const relegatedOnce = Object.values(a.s.clubs).filter((c) => c.finance.parachuteSeasonsLeft > 0);
    expect(relegatedOnce.length).toBeGreaterThan(0);
    const b = threeSeasons();
    expect(stableStringify(b.s)).toBe(stableStringify(a.s));
  }, 30_000);
});
