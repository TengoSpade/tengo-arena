import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asId,
  reckoningCompetitionId,
  type ClubId,
  type Competition,
  type GameState,
  type LedgerCategory,
  type TierId,
  type TraitId,
} from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { stableStringify } from '../util';
import {
  ask,
  contractExpiries,
  currentSeasonBudgetParts,
  financeView,
  initialFinances,
  ledgerInvariantViolations,
  poolCounts,
  poolMaintenance,
  post,
  rollContractProfile,
  rosterOf,
  seasonPrizes,
  sponsorRetainer,
  topUpFreeAgentPool,
  updatePrestige,
  wageBill,
  weeklyCosts,
  weeklyIncome,
} from './index';
import {
  addFighter,
  addPlayedFixture,
  createdFighters,
  resetFighterDoubles,
  setFighterValues,
  setOpeningBalance,
  setWeek,
  tierRecord,
  toSeasonEnd,
} from './testing';

vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);

const content = fixtureContent();
const CROWN = asId<TierId>('saltmarch-crown');
const BANNER = asId<TierId>('saltmarch-banner');
const MUSTER = asId<TierId>('saltmarch-muster');
const clubsOf = (level: number) => content.clubs.list.filter((c) => c.startTierLevel === level).map((c) => asId<ClubId>(c.id));
const sumOf = (s: GameState, clubId: ClubId, category: LedgerCategory) =>
  s.ledger.entries.filter((e) => e.clubId === clubId && e.category === category).reduce((a, e) => a + e.amount, 0);

/** A Reckoning bracket: seeds 1-8; QF winners 1, 4, 7, 3; SF winners 1, 3; champion 3 (seed numbers). */
function addBracket(s: GameState, season: number, tierId: TierId, seeds: ClubId[]): void {
  const sd = (n: number) => seeds[n - 1]!;
  const tie = (slot: number, winner: ClubId) => ({ slot, home: { kind: 'seed' as const, seed: 1 }, away: { kind: 'seed' as const, seed: 2 }, fixtureId: null, winnerClubId: winner });
  const comp: Competition = {
    id: reckoningCompetitionId(season, tierId),
    kind: 'reckoning',
    season,
    tierId,
    clubIds: seeds,
    wings: [],
    seedOrder: [],
    fixtureIds: [],
    bracket: {
      seeds,
      rounds: [
        { roundId: 'quarterfinal', weekId: asId('TW1'), bestOf: 3, ties: [tie(1, sd(1)), tie(2, sd(4)), tie(3, sd(7)), tie(4, sd(3))] },
        { roundId: 'semifinal', weekId: asId('TW2'), bestOf: 3, ties: [tie(1, sd(1)), tie(2, sd(3))] },
        { roundId: 'final', weekId: asId('TW3'), bestOf: 5, ties: [tie(1, sd(3))] },
      ],
      championId: sd(3),
      runnerUpId: sd(1),
    },
    status: 'completed',
  };
  s.competitions[comp.id] = comp;
}

beforeEach(() => resetFighterDoubles());

describe('season prizes (le-028) and the Reckoning money', () => {
  it('table prize floor10(top × (17 − rank) ÷ 16): Banner #3 8,750, Crown #16 1,560, Muster #9 2,000', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    toSeasonEnd(s, content);
    const crown = clubsOf(1);
    const banner = clubsOf(2);
    const muster = clubsOf(3);
    seasonPrizes(s, { season: 1, tiers: [tierRecord(CROWN, crown), tierRecord(BANNER, banner), tierRecord(MUSTER, muster)], retirements: [], rookieIds: [] }, content);
    expect(sumOf(s, banner[2]!, 'tablePrize')).toBe(8_750);
    expect(sumOf(s, crown[15]!, 'tablePrize')).toBe(1_560);
    expect(sumOf(s, muster[8]!, 'tablePrize')).toBe(2_000);
    expect(sumOf(s, crown[0]!, 'tablePrize')).toBe(25_000);
    expect(s.ledger.entries.every((e) => e.season === 1 && e.weekIndex === 24)).toBe(true);
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('Reckoning prize by the furthest round (not cumulative) and the sponsor bonus for every qualifier', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    toSeasonEnd(s, content);
    const banner = clubsOf(2);
    const seeds = banner.slice(0, 8);
    addBracket(s, 1, BANNER, seeds);
    seasonPrizes(s, { season: 1, tiers: [tierRecord(BANNER, banner)], retirements: [], rookieIds: [] }, content);
    const prize = (seed: number) => sumOf(s, seeds[seed - 1]!, 'tournamentPrize');
    expect([3, 1, 4, 7, 2, 5, 6, 8].map(prize)).toEqual([15_000, 7_500, 3_750, 3_750, 1_875, 1_875, 1_875, 1_875]);
    expect(seeds.every((id) => sumOf(s, id, 'sponsorTournamentBonus') === 2_500)).toBe(true);
    expect(sumOf(s, banner[8]!, 'sponsorTournamentBonus')).toBe(0);
  });
});

describe('prestige (le-029)', () => {
  it('Muster club, prestige 26, tier rank 2, wins the Reckoning, promoted: delta 4 + 5 + 8, then 15% reversion to 45 -> 43', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    toSeasonEnd(s, content);
    const muster = clubsOf(3);
    const id = muster[1]!;
    const seeds = [muster[0]!, muster[2]!, id, ...muster.slice(3, 8)];
    addBracket(s, 1, MUSTER, seeds); // seed 3 = id is champion
    s.clubs[id]!.prestige = 26;
    s.clubs[id]!.tierId = BANNER;
    updatePrestige(s, { season: 1, tiers: [tierRecord(MUSTER, muster, { promotedIds: [id], reckoningChampionId: id })], retirements: [], rookieIds: [] }, content);
    expect(s.clubs[id]!.prestige).toBe(43);
  });

  it('relegation −8, table term toward zero, clamp to 0..100', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    toSeasonEnd(s, content);
    const crown = clubsOf(1);
    const down = crown[14]!; // rank 15: (17 − 30) × 3/8 = −4.875 -> −4
    const top = crown[0]!; // rank 1: +5
    s.clubs[down]!.prestige = 62;
    s.clubs[down]!.tierId = BANNER;
    s.clubs[top]!.prestige = 99;
    addBracket(s, 1, CROWN, [crown[1]!, crown[2]!, top, ...crown.slice(3, 8)]);
    updatePrestige(s, { season: 1, tiers: [tierRecord(CROWN, crown, { relegatedIds: [down] })], retirements: [], rookieIds: [] }, content);
    expect(s.clubs[down]!.prestige).toBe(50); // 62 − 4 − 8 = 50; 50 − trunc(5 × 0.15) = 50
    expect(s.clubs[top]!.prestige).toBe(100); // 99 + 5 + 5 = 109 − trunc(39 × 0.15) = 104 -> 100
  });
});

describe('gates and win bonuses', () => {
  function gateWorld(): GameState {
    const s = buildFixtureWorld({ freeAgents: 0 });
    return s;
  }
  const A = asId<ClubId>('varrow-netcasters'); // Banner, prestige 50
  const B = asId<ClubId>('keelwick-tarhands');

  it('regular gate with prestige and form; QF/SF ×1.5; the final ×2.0 split evenly (odd unit to the higher seed)', () => {
    const s = gateWorld();
    s.clubs[A]!.prestige = 45;
    for (let w = 5; w < 9; w++) addPlayedFixture(s, content, { weekIndex: w, home: B, away: A, winner: w === 8 ? B : A });
    addPlayedFixture(s, content, { weekIndex: 9, home: A, away: B, winner: A });
    setWeek(s, content, 9);
    weeklyIncome(s, content);
    expect(sumOf(s, A, 'gate')).toBe(3_885); // 3 wins in 4: formAdj +500
    expect(sumOf(s, A, 'sponsorWinBonus')).toBe(500);
    const t = gateWorld();
    addPlayedFixture(t, content, { weekIndex: 21, home: A, away: B, winner: B, stage: 'quarterfinal' });
    setWeek(t, content, 21);
    weeklyIncome(t, content);
    expect(sumOf(t, A, 'gate')).toBe(5_827); // 3,700 × 1.05 × 1.5
    expect(sumOf(t, B, 'sponsorWinBonus')).toBe(500);
    const u = gateWorld();
    u.clubs[A]!.prestige = 46;
    addPlayedFixture(u, content, { weekIndex: 23, home: A, away: B, winner: A, stage: 'final' });
    setWeek(u, content, 23);
    weeklyIncome(u, content);
    expect([sumOf(u, A, 'gate'), sumOf(u, B, 'gate')]).toEqual([3_737, 3_737]); // 3,700 × 1.01 × 2 = 7,474
    const v = gateWorld();
    const X = asId<ClubId>('saltcrag-brinehounds');
    const Y = asId<ClubId>('varrow-ninth-oar');
    v.clubs[X]!.prestige = 71;
    addPlayedFixture(v, content, { weekIndex: 23, home: X, away: Y, winner: Y, stage: 'final' });
    setWeek(v, content, 23);
    weeklyIncome(v, content);
    expect([sumOf(v, X, 'gate'), sumOf(v, Y, 'gate')]).toEqual([9_343, 9_342]); // 9,250 × 1.01 × 2 = 18,685
  });

  it('fan appeal: +200 bp per point in the home lineup that played', () => {
    const s = gateWorld();
    s.clubs[A]!.prestige = 45;
    const star = addFighter(s, content, { values: { rating: 60, potential: 60 }, clubId: A, overrides: { traits: [{ id: asId<TraitId>('crowd_darling'), gainedSeason: 1, source: 'rolled' }] } });
    addPlayedFixture(s, content, { weekIndex: 5, home: A, away: B, winner: B, homeFighters: [star.id] });
    setWeek(s, content, 5);
    weeklyIncome(s, content);
    expect(sumOf(s, A, 'gate')).toBe(3_774); // 3,700 × 1.02
  });
});

describe('expiries, pool maintenance and pool floors', () => {
  it('contract expiries at season end; retirement ends a contract with no payout and no free agency', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    toSeasonEnd(s, content);
    const club = asId<ClubId>('varrow-netcasters');
    const before = rosterOf(s, club).length;
    const retiring = rosterOf(s, club).find((f) => f.contract!.endSeason > 1)!;
    retiring.status = 'retired';
    const expired = contractExpiries(s, content);
    const fromClub = expired.filter((id) => s.fighters[id]!.freeAgency!.formerClubId === club);
    expect(rosterOf(s, club).length).toBe(before - 1 - fromClub.length);
    expect(fromClub.length).toBeGreaterThan(0);
    expect(retiring).toMatchObject({ contract: null, clubId: null, freeAgency: null });
    expect(s.ledger.entries).toEqual([]);
  });

  it('free agents unsigned at 2 consecutive season ends leave; their pending offers are void', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    const f = addFighter(s, content, { values: { rating: 40, potential: 40 } });
    toSeasonEnd(s, content);
    expect(poolMaintenance(s, content)).toEqual([]);
    expect(f.freeAgency!.unsignedSeasonEnds).toBe(1);
    s.market.offers.push({ clubId: asId('varrow-netcasters'), fighterId: f.id, wagePerWeek: 200, seasons: 1, madeAt: { season: 2, weekIndex: 1 }, isCounterAcceptance: false });
    expect(poolMaintenance(s, content)).toEqual([f.id]);
    expect(f.status).toBe('retired');
    expect(s.market.offers).toEqual([]);
  });

  it('tops the pool up with journeymen to 60 and 5 per role family; nothing when the floors are met', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    setWeek(s, content, 6);
    topUpFreeAgentPool(s, content);
    const counts = poolCounts(s, content);
    expect(counts.total).toBe(60);
    for (const fam of ['tank', 'dps', 'controller', 'healer']) expect(counts.byFamily[fam]).toBeGreaterThanOrEqual(5);
    const made = createdFighters();
    expect(made.length).toBe(60);
    expect(made.every((m) => m.spec.kind === 'journeyman' && m.spec.potentialShift === -3)).toBe(true);
    expect(made.every((m) => m.spec.ratingTarget! >= 30 && m.spec.ratingTarget! <= 50 && m.spec.humanAge!.min === 26)).toBe(true);
    expect(made.every((m) => s.fighters[m.id]!.freeAgency !== null)).toBe(true);
    topUpFreeAgentPool(s, content);
    expect(createdFighters().length).toBe(60);
  });

  it('greed is rolled once per fighter on the market stream: −1,000..+1,500 in steps of 100, order-independent', () => {
    const s = buildFixtureWorld({ freeAgents: 200 });
    const ids = Object.keys(s.fighters) as (keyof typeof s.fighters)[];
    for (const id of ids) rollContractProfile(s, id, content);
    const greed = ids.map((id) => s.fighters[id]!.contractProfile.greedBp);
    expect(greed.every((g) => g >= -1000 && g <= 1500 && g % 100 === 0)).toBe(true);
    expect(Math.min(...greed)).toBe(-1000);
    expect(Math.max(...greed)).toBe(1500);
    const t = buildFixtureWorld({ freeAgents: 200 });
    for (const id of [...ids].reverse()) rollContractProfile(t, id, content);
    expect(ids.map((id) => t.fighters[id]!.contractProfile.greedBp)).toEqual(greed);
  });
});

describe('new career finances', () => {
  it('starting balance from prestige; contracts of 1/2/3 seasons; budgets; bills rescaled into 82-92% of WB (tuning CR-1)', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    const star = asId<ClubId>('varrow-lanternguard'); // Crown, prestige 84
    const small = asId<ClubId>('brightskerry-puffin-lancers'); // Muster, prestige 12
    for (const f of Object.values(s.fighters)) if (f.clubId === star) f.contract = null;
    // An expensive Muster roster: 10 fighters rated 49, unsigned.
    for (const f of Object.values(s.fighters)) if (f.clubId === small) f.status = 'retired';
    for (const f of Object.values(s.fighters)) if (f.clubId === small) f.clubId = null;
    for (let i = 0; i < 10; i++) addFighter(s, content, { values: { rating: 49, potential: 49 }, clubId: small, overrides: { contract: null, age: 28 } });
    initialFinances(s, content);
    expect(s.ledger.openingBalances[star]).toBe(57_000);
    expect(s.ledger.openingBalances[small]).toBe(7_360);
    const band = content.economy.budget.worldGenBillBandBp;
    expect(band).toEqual({ minBp: 8200, maxBp: 9200 });
    const edge = (id: ClubId, bp: number) => Math.trunc((s.clubs[id]!.finance.wageBudgetPerWeek * bp) / 10_000);
    const signed = rosterOf(s, star);
    expect(wageBill(s, star)).toBeGreaterThanOrEqual(edge(star, band.minBp));
    expect(wageBill(s, star)).toBeLessThanOrEqual(edge(star, band.maxBp));
    // The rescale keeps each wage's place: a higher ask never gets a lower wage.
    const asks = signed.map((f) => ask(s, f.id, star, f.contract!.endSeason, content));
    signed.forEach((f, i) => {
      expect(f.contract!.wagePerWeek % 5).toBe(0);
      signed.forEach((g, j) => {
        if (asks[i]! > asks[j]!) expect(f.contract!.wagePerWeek).toBeGreaterThanOrEqual(g.contract!.wagePerWeek);
      });
    });
    const lengths = signed.map((f) => f.contract!.endSeason).sort();
    expect(new Set(lengths)).toEqual(new Set([1, 2, 3]));
    const club = s.clubs[small]!;
    expect(club.finance.wageBudgetPerWeek).toBeGreaterThan(0);
    // Asks of about 220 against a WB near 1,100: the wages are scaled down into the band and nobody is dropped.
    expect(rosterOf(s, small)).toHaveLength(10);
    expect(wageBill(s, small)).toBeGreaterThanOrEqual(edge(small, band.minBp));
    expect(wageBill(s, small)).toBeLessThanOrEqual(edge(small, band.maxBp));
    const min = content.tierProfile(content.tiers.require(club.tierId).level).tierMinWage;
    for (const f of rosterOf(s, small)) expect(f.contract!.wagePerWeek).toBeGreaterThanOrEqual(min);
    expect(Object.values(s.fighters).filter((f) => f.status === 'free-agent')).toHaveLength(0);
    expect(currentSeasonBudgetParts(s, s.clubs[star]!, content).grantDue).toBe(82_000);
    expect(s.ledger.entries.filter((e) => e.category === 'centralGrant').length).toBe(48);
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });
});

describe('ledger', () => {
  it('post() records one entry per movement and is the only balance writer; rejects bad input', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    const id = asId<ClubId>('varrow-netcasters');
    const before = s.clubs[id]!.finance.balance;
    post(s, { clubId: id, amount: -250, category: 'operations' });
    post(s, { clubId: id, amount: 0, category: 'gate' });
    expect(s.ledger.entries.length).toBe(1);
    expect(s.clubs[id]!.finance.balance).toBe(before - 250);
    expect(() => post(s, { clubId: id, amount: 1.5, category: 'gate' })).toThrow();
    expect(() => post(s, { clubId: id, amount: 1, category: 'bribes' as LedgerCategory })).toThrow();
    expect(() => post(s, { clubId: asId('nowhere'), amount: 1, category: 'gate' })).toThrow();
    expect(ledgerInvariantViolations(s)).toEqual([]);
    s.clubs[id]!.finance.balance += 1;
    expect(ledgerInvariantViolations(s).length).toBe(1);
  });

  it('financeView: parts, bill, projected season-end balance from the remaining scheduled flows', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    const id = asId<ClubId>('varrow-netcasters');
    setWeek(s, content, 20);
    setOpeningBalance(s, id, 10_000);
    const club = s.clubs[id]!;
    const v = financeView(s, id, content);
    const retainer = sponsorRetainer(club, content);
    const part = Math.trunc(retainer / 23);
    const remaining = part * 3 + (retainer - part * 22);
    expect(v.projectedSeasonEndBalance).toBe(10_000 + remaining - 4 * (wageBill(s, id) + 530));
    expect(v.seasonBudgetParts.map((p) => p.label)).toEqual(['centralGrant', 'parachute', 'promotionGrant', 'sponsorRetainer', 'projectedGate']);
    expect(v.status).toBe('healthy');
    const weeks = v.weeklyProjection ?? [];
    expect(weeks.map((w) => w.weekIndex)).toEqual([20, 21, 22, 23]);
    expect(weeks.map((w) => w.weekId)).toEqual([20, 21, 22, 23].map((k) => content.weekByIndex(k).id));
    for (const w of weeks) {
      expect(w.costs).toBe(wageBill(s, id) + 530);
      expect(w.net).toBe(w.income - w.costs);
    }
    expect(weeks.at(-1)!.balance).toBe(v.projectedSeasonEndBalance);
    weeklyCosts(s, content);
    expect(financeView(s, id, content).byCategory).toEqual({ wages: -wageBill(s, id), operations: -530 });
  });
});

describe('determinism', () => {
  it('the same seed and inputs give an identical state', () => {
    const run = () => {
      resetFighterDoubles();
      const s = buildFixtureWorld({ freeAgents: 30 });
      for (const f of Object.values(s.fighters)) setFighterValues(f.id, { rating: 30 + (Number(f.id.slice(2)) % 40), potential: 60 });
      initialFinances(s, content);
      for (let w = 1; w <= 6; w++) {
        setWeek(s, content, w);
        topUpFreeAgentPool(s, content);
        weeklyIncome(s, content);
        weeklyCosts(s, content);
      }
      return stableStringify(s);
    };
    expect(run()).toBe(run());
  });
});
