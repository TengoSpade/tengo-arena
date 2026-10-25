import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asId, type ClubId, type GameState, type TierId } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import {
  currentSeasonBudgetParts,
  financeDetails,
  financeView,
  financialStatus,
  ledgerInvariantViolations,
  nextSeasonFinanceSetup,
  reserveContribution,
  updatePrestige,
  weeklyIncome,
} from './index';
import { addFighter, clearRoster, resetFighterDoubles, setOpeningBalance, setWeek, tierRecord, toSeasonEnd } from './testing';

vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);

const content = fixtureContent();
const CROWN = asId<TierId>('saltmarch-crown');
const BANNER = asId<TierId>('saltmarch-banner');
const MUSTER = asId<TierId>('saltmarch-muster');
const BANNER_P50 = asId<ClubId>('varrow-netcasters');
const MUSTER_P20 = asId<ClubId>('keelwick-bilge-company');

function seasonEndWorld(): GameState {
  const s = buildFixtureWorld({ freeAgents: 0 });
  toSeasonEnd(s, content);
  return s;
}

const entries = (s: GameState, clubId: ClubId, category: string) => s.ledger.entries.filter((e) => e.clubId === clubId && e.category === category);

beforeEach(() => resetFighterDoubles());

describe('season budget and wage budget (sys-finance)', () => {
  it('Banner worked example: prestige 50, balance 30,000 at setup -> SB 85,008, WB 3,257', () => {
    const s = seasonEndWorld();
    setOpeningBalance(s, BANNER_P50, 30_000);
    nextSeasonFinanceSetup(s, [], content);
    const club = s.clubs[BANNER_P50]!;
    const parts = currentSeasonBudgetParts(s, club, content);
    expect(parts).toMatchObject({ grantDue: 34_000, sponsorRetainer: 19_928, projectedGate: 31_080, parachute: 0, promotionGrant: 0 });
    expect(club.finance.seasonBudget).toBe(85_008);
    expect(reserveContribution(85_008, 30_000, content)).toBe(8_624);
    expect(club.finance.wageBudgetPerWeek).toBe(3_257);
    // Opening balance is the pre-setup balance; grant installment 1 is the first entry.
    expect(s.ledger.openingBalances[BANNER_P50]).toBe(30_000);
    expect(entries(s, BANNER_P50, 'centralGrant').map((e) => [e.season, e.weekIndex, e.amount])).toEqual([[2, 0, 17_000]]);
    expect(club.finance.balance).toBe(47_000);
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('par prestige SB 202,000 / 82,400 / 32,400 and WB at the default starting balance 7,454 / 2,960 / 1,138', () => {
    const s = seasonEndWorld();
    const ids = { 1: asId<ClubId>('saltcrag-brinehounds'), 2: asId<ClubId>('ropesend-anchorfists'), 3: MUSTER_P20 } as const;
    for (const level of [1, 2, 3] as const) {
      const club = s.clubs[ids[level]]!;
      club.prestige = content.tierByLevel(level).basePrestige;
      setOpeningBalance(s, club.id, content.tierProfile(level).startingBalanceBase);
    }
    nextSeasonFinanceSetup(s, [], content);
    expect([1, 2, 3].map((l) => s.clubs[ids[l as 1 | 2 | 3]]!.finance.seasonBudget)).toEqual([202_000, 82_400, 32_400]);
    expect([1, 2, 3].map((l) => s.clubs[ids[l as 1 | 2 | 3]]!.finance.wageBudgetPerWeek)).toEqual([7_454, 2_960, 1_138]);
  });

  it('le-021: Muster club promoted to Banner at prestige 30 with balance 12,000 -> SB 83,076 incl. 8,500 grant, reserve 0, WB 3,106', () => {
    const s = seasonEndWorld();
    const id = asId<ClubId>('varrow-dockjacks');
    const others = content.clubs.list.filter((c) => c.startTierLevel === 3 && c.id !== id).map((c) => asId<ClubId>(c.id));
    s.history.push({ season: 1, tiers: [tierRecord(MUSTER, [id, ...others], { promotedIds: [id] })], retirements: [], rookieIds: [] });
    const club = s.clubs[id]!;
    club.tierId = BANNER;
    club.prestige = 30;
    setOpeningBalance(s, id, 12_000);
    const cheap = addFighter(s, content, { values: { rating: 40, potential: 40 }, clubId: id, wage: 60, endSeason: 2 });
    nextSeasonFinanceSetup(s, [], content);
    expect(cheap.contract!.wagePerWeek).toBe(110);
    expect(club.finance.seasonBudget).toBe(83_076);
    expect(reserveContribution(83_076, 12_000, content)).toBe(0);
    expect(club.finance.wageBudgetPerWeek).toBe(3_106);
    expect(club.finance.ascensionSeasonsLeft).toBe(1);
    expect(entries(s, id, 'promotionGrant').map((e) => e.amount)).toEqual([8_500]);
    // Promotion does not inflate existing wages (fixture contracts at 120 stay); the 60 contract was raised to the minimum.
    for (const f of Object.values(s.fighters)) if (f.clubId === id && f.id !== cheap.id) expect(f.contract!.wagePerWeek).toBe(120);
    // The next season has no ascension bonus any more.
    toSeasonEnd(s, content);
    s.calendar.season = 2;
    nextSeasonFinanceSetup(s, [], content);
    expect(club.finance.ascensionSeasonsLeft).toBe(0);
    expect(entries(s, id, 'promotionGrant')).toEqual([]);
  });

  it('le-020: relegated Crown club: drop clause 721 -> 575, parachute 24,000 now and 12,000 next season, WB in Banner', () => {
    const s = seasonEndWorld();
    const id = asId<ClubId>('glassdune-mirages');
    clearRoster(s, id);
    const f = addFighter(s, content, { values: { rating: 60, potential: 60 }, clubId: id, wage: 721, endSeason: 3 });
    const crown = content.clubs.list.filter((c) => c.startTierLevel === 1).map((c) => asId<ClubId>(c.id));
    s.history.push({ season: 1, tiers: [tierRecord(CROWN, crown, { relegatedIds: [id] })], retirements: [], rookieIds: [] });
    const club = s.clubs[id]!;
    club.tierId = BANNER;
    nextSeasonFinanceSetup(s, [], content);
    expect(f.contract!.wagePerWeek).toBe(575);
    expect(f.contract!.dropClauseApplied).toBe(true);
    expect(entries(s, id, 'parachute').map((e) => e.amount)).toEqual([24_000]);
    expect(club.finance.parachuteSeasonsLeft).toBe(2);
    const parts = currentSeasonBudgetParts(s, club, content);
    expect(parts.parachute).toBe(24_000);
    expect(club.finance.seasonBudget).toBe(parts.grantDue + 24_000 + parts.sponsorRetainer + parts.projectedGate);
    // Season 3 setup in Banner again: 25% of the grant gap, and the drop clause is not applied twice.
    toSeasonEnd(s, content);
    s.calendar.season = 2;
    nextSeasonFinanceSetup(s, [], content);
    expect(entries(s, id, 'parachute').map((e) => e.amount)).toEqual([12_000]);
    expect(f.contract!.wagePerWeek).toBe(575);
    toSeasonEnd(s, content);
    s.calendar.season = 3;
    nextSeasonFinanceSetup(s, [], content);
    expect(entries(s, id, 'parachute')).toEqual([]);
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });
});

describe('Registry advance (le-019) and grant installments', () => {
  it('8th consecutive debt week: advance 6,000, balance 0; prestige −5 at season end; next grant 9,800 in two halves; 1,800 carried', () => {
    const s = buildFixtureWorld({ freeAgents: 0 });
    setWeek(s, content, 15);
    const club = s.clubs[MUSTER_P20]!;
    club.finance.debtWeeks = 7;
    club.finance.seasonBudget = 0;
    setOpeningBalance(s, MUSTER_P20, -6_000);
    const news = financialStatus(s, content);
    expect(news).toEqual([]); // AI club: no digest items
    expect(club.finance.balance).toBe(0);
    expect(club.finance.registryDebt).toBe(6_000);
    expect(club.finance.debtWeeks).toBe(0);
    expect(club.finance.status).not.toBe('embargo');
    expect(entries(s, MUSTER_P20, 'registryAdvance').map((e) => e.amount)).toEqual([6_000]);
    // Season end: the prestige update applies the −5 penalty (tier rank 8 gives a table term of 0).
    toSeasonEnd(s, content);
    const muster = content.clubs.list.filter((c) => c.startTierLevel === 3 && c.id !== MUSTER_P20).map((c) => asId<ClubId>(c.id));
    const order = [...muster.slice(0, 7), MUSTER_P20, ...muster.slice(7)];
    updatePrestige(s, { season: 1, tiers: [tierRecord(MUSTER, order)], retirements: [], rookieIds: [] }, content);
    expect(club.prestige).toBe(15);
    club.prestige = 20;
    nextSeasonFinanceSetup(s, [], content);
    expect(club.finance.registryDebt).toBe(1_800);
    expect(financeDetails(s, MUSTER_P20, content).nextSeasonDeduction).toBe(1_800);
    expect(entries(s, MUSTER_P20, 'centralGrant').map((e) => e.amount)).toEqual([4_900]);
    expect(currentSeasonBudgetParts(s, club, content).grantDue).toBe(9_800);
    // Second installment at the processing that ends MW8 (week index 12).
    setWeek(s, content, 11, 2);
    weeklyIncome(s, content);
    expect(entries(s, MUSTER_P20, 'centralGrant').length).toBe(1);
    setWeek(s, content, 12, 2);
    weeklyIncome(s, content);
    expect(entries(s, MUSTER_P20, 'centralGrant').map((e) => e.amount)).toEqual([4_900, 4_900]);
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('sponsor retainer parts sum exactly to the retainer over the season', () => {
    const s = seasonEndWorld();
    nextSeasonFinanceSetup(s, [], content);
    for (let w = 1; w <= 23; w++) {
      setWeek(s, content, w, 2);
      weeklyIncome(s, content);
    }
    const club = s.clubs[BANNER_P50]!;
    const total = entries(s, BANNER_P50, 'sponsorRetainer').reduce((a, e) => a + e.amount, 0);
    expect(total).toBe(currentSeasonBudgetParts(s, club, content).sponsorRetainer);
    expect(entries(s, BANNER_P50, 'centralGrant').reduce((a, e) => a + e.amount, 0)).toBe(34_000);
    expect(financeView(s, BANNER_P50, content).byCategory.sponsorRetainer).toBe(total);
  });

  it('a club still in debt at setup keeps its debt-week counter and stays under embargo', () => {
    const s = seasonEndWorld();
    const club = s.clubs[MUSTER_P20]!;
    setOpeningBalance(s, MUSTER_P20, -20_000);
    club.finance.debtWeeks = 3;
    club.finance.status = 'embargo';
    nextSeasonFinanceSetup(s, [], content);
    expect(club.finance.balance).toBe(-20_000 + 7_000);
    expect(club.finance.status).toBe('embargo');
    expect(club.finance.debtWeeks).toBe(3);
    expect(financeView(s, MUSTER_P20, content).statusReason).toBe('balance-below-zero');
  });
});
