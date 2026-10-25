/**
 * Economy on the REAL core/fighters (WP2, merged): world-generation fighters,
 * real ratings and potentials, journeymen and hired blades from
 * fighters.createFighter. No test doubles in this file.
 */
import { describe, expect, it } from 'vitest';
import { createFighter, rating } from '../fighters';
import { asId, type ClubId, type GameState, type RegionId } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import {
  ask,
  assignHiredBlades,
  financialStatus,
  initialFinances,
  ledgerInvariantViolations,
  marketWage,
  poolCounts,
  poolFighters,
  rosterOf,
  topUpFreeAgentPool,
  wageBill,
  weeklyCosts,
  weeklyIncome,
} from './index';
import { addPlayedFixture, clearRoster, setWeek } from './testing';

const content = fixtureContent();

/** A generated world: rosters at 90% of the cap with tier potential shifts, 2.5 free agents per club. */
function generatedWorld(): GameState {
  const s = buildFixtureWorld({ fightersPerClub: 5, freeAgents: 0 });
  setWeek(s, content, 1);
  for (const id of Object.keys(s.clubs)) clearRoster(s, id as ClubId);
  const region = asId<RegionId>(content.regions.list[0]!.id);
  for (const club of Object.values(s.clubs).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const tier = content.tiers.require(club.tierId);
    const size = Math.round((tier.rosterCap * 9) / 10);
    for (let i = 0; i < size; i++) {
      const id = createFighter(s, { kind: 'worldgen', potentialShift: tier.worldGenPotentialShift, regionId: region, ratingTarget: tier.ratingBand.min + ((i * 5) % (tier.ratingBand.max - tier.ratingBand.min)) }, content);
      const f = s.fighters[id]!;
      f.clubId = club.id;
      f.status = 'active';
      f.freeAgency = null;
    }
  }
  for (let i = 0; i < 120; i++) createFighter(s, { kind: 'free-agent', potentialShift: content.leagues.generationShifts.generatedFreeAgent, regionId: region }, content);
  return s;
}

describe('economy with real fighters (WP2)', () => {
  it('new-career finances: contracts at asks, bills within the wage budget, valid asks and market wages', () => {
    const s = generatedWorld();
    initialFinances(s, content);
    expect(ledgerInvariantViolations(s)).toEqual([]);
    for (const club of Object.values(s.clubs)) {
      const roster = rosterOf(s, club.id);
      expect(roster.length).toBeGreaterThanOrEqual(content.economy.ai.rosterMinimum);
      expect(club.finance.wageBudgetPerWeek).toBeGreaterThan(0);
      // World-generation trim: bill <= 95% of WB unless the roster is already at the minimum of 8.
      if (roster.length > content.economy.ai.rosterMinimum) expect(wageBill(s, club.id)).toBeLessThanOrEqual(Math.trunc((club.finance.wageBudgetPerWeek * 9500) / 10000));
      for (const f of roster) {
        expect(f.contract!.wagePerWeek % 5).toBe(0);
        expect(f.contract!.wagePerWeek).toBeGreaterThanOrEqual(content.tierProfile(content.tiers.require(club.tierId).level).tierMinWage);
      }
    }
    for (const f of poolFighters(s).slice(0, 30)) {
      const mw = marketWage(s, f.id, content);
      expect(mw % 5).toBe(0);
      const a = ask(s, f.id, asId<ClubId>('varrow-netcasters'), 2, content);
      expect(a).toBeGreaterThanOrEqual(110);
      expect(a).toBeLessThanOrEqual(4000);
    }
  });

  it('journeymen from createFighter keep the pool at its floors; hired blades are generated at the tier band minimum', () => {
    const s = generatedWorld();
    initialFinances(s, content);
    for (const f of poolFighters(s)) f.status = 'retired';
    setWeek(s, content, 5);
    topUpFreeAgentPool(s, content);
    const counts = poolCounts(s, content);
    expect(counts.total).toBeGreaterThanOrEqual(60);
    for (const fam of ['tank', 'dps', 'controller', 'healer']) expect(counts.byFamily[fam]).toBeGreaterThanOrEqual(5);
    expect(poolFighters(s).every((f) => f.freeAgency !== null && f.contractProfile.greedBp % 100 === 0)).toBe(true);

    const club = asId<ClubId>('varrow-netcasters');
    const roster = rosterOf(s, club);
    for (const f of roster.slice(3)) {
      f.status = 'free-agent';
      f.clubId = null;
      f.contract = null;
    }
    addPlayedFixture(s, content, { weekIndex: 5, home: club, away: asId('keelwick-tarhands'), winner: club, played: false });
    const blades = assignHiredBlades(s, content)[club]!;
    expect(blades.length).toBe(2);
    for (const id of blades) {
      const b = s.fighters[id]!;
      expect(b.status).toBe('hired-blade');
      expect(Math.abs(rating(b, content) - 45)).toBeLessThanOrEqual(3);
    }
    weeklyIncome(s, content);
    weeklyCosts(s, content);
    financialStatus(s, content);
    expect(s.ledger.entries.filter((e) => e.clubId === club && e.category === 'hiredBlades').map((e) => e.amount)).toEqual([-110, -110]);
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });
});
