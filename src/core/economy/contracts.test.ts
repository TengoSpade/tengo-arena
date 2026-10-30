import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asId, type ClassId, type ClubId, type FighterId, type GameState, type TierId, type TraitId } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import {
  ask,
  agreedRenewal,
  assignHiredBlades,
  capReliefAllowance,
  contractExpiries,
  financialStatus,
  ledgerInvariantViolations,
  makeOffer,
  nextSeasonFinanceSetup,
  releaseFighter,
  releaseTrialsRookies,
  renewContract,
  resolveFreeAgentOffers,
  rosterOf,
  signTrialsRookie,
  wageBill,
  weeklyCosts,
  weeklyIncome,
} from './index';
import { addFighter, addPlayedFixture, clearRoster, resetFighterDoubles, setOpeningBalance, setWeek, tierRecord, toSeasonEnd } from './testing';

vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);

const content = fixtureContent();
const A = asId<ClubId>('varrow-netcasters'); // Banner, prestige 50
const OTHER_BANNER = asId<ClubId>('keelwick-tarhands');
const C = asId<ClubId>('keelwick-bilge-company'); // Muster, prestige 20
const trait = (id: string) => ({ id: asId<TraitId>(id), gainedSeason: 1, source: 'rolled' as const });
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? 'ok' : r.error!.code);

function world(week = 1): GameState {
  const s = buildFixtureWorld({ freeAgents: 0 });
  setWeek(s, content, week);
  for (const club of Object.values(s.clubs)) {
    club.finance.wageBudgetPerWeek = 50_000;
    setOpeningBalance(s, club.id, 100_000);
  }
  return s;
}

function brannocAt(s: GameState, clubId: ClubId, endSeason: number) {
  return addFighter(s, content, {
    values: { rating: 58, potential: 64 },
    clubId,
    wage: 360,
    endSeason,
    overrides: { age: 23, contractProfile: { greedBp: 400 }, traits: [trait('still_water'), trait('hot_blood')] },
  });
}

/** 14 played matches for A in MW1..MW14; Brannoc started the first `started`. */
function playFourteen(s: GameState, fighterId: FighterId, started: number): void {
  for (let i = 0; i < 14; i++) {
    addPlayedFixture(s, content, { weekIndex: 5 + i, home: A, away: OTHER_BANNER, winner: A, homeFighters: i < started ? [fighterId] : [] });
  }
}

beforeEach(() => resetFighterDoubles());

describe('renewals (answered at once, final season only)', () => {
  it('le-011: offer 320 -> ask 345, counter 330; accepting renews at 330 from next season, signing cost 1,510', () => {
    const s = world(19);
    s.playerClubId = A;
    const f = brannocAt(s, A, 1);
    playFourteen(s, f.id, 12);
    const first = renewContract(s, { clubId: A, fighterId: f.id, wagePerWeek: 320, seasons: 2 }, content);
    expect(first).toEqual({ ok: true, value: { kind: 'countered', counterWage: 330, validUntilWeek: 19 } });
    const second = renewContract(s, { clubId: A, fighterId: f.id, wagePerWeek: 330, seasons: 2 }, content);
    expect(second).toEqual({ ok: true, value: { kind: 'accepted', wagePerWeek: 330, seasons: 2 } });
    expect(s.ledger.entries.filter((e) => e.category === 'signingCost')).toMatchObject([{ clubId: A, amount: -1_510, fighterId: f.id }]);
    // The old wage continues this season; the contract now runs to the end of season 3.
    expect(f.contract).toMatchObject({ wagePerWeek: 360, endSeason: 3 });
    expect(agreedRenewal(s, f.id)).toMatchObject({ clubId: A, wagePerWeek: 330 });
    const bill = wageBill(s, A);
    weeklyCosts(s, content);
    expect(s.ledger.entries.find((e) => e.clubId === A && e.category === 'wages')!.amount).toBe(-bill);
    expect(code(renewContract(s, { clubId: A, fighterId: f.id, wagePerWeek: 400, seasons: 1 }, content))).toBe('renewal.not-final-season');
    // Season end: not expired; the new terms start at setup.
    toSeasonEnd(s, content);
    expect(contractExpiries(s, content)).not.toContain(f.id);
    nextSeasonFinanceSetup(s, [], content);
    expect(f.contract).toMatchObject({ clubId: A, wagePerWeek: 330, startSeason: 2, endSeason: 3 });
    expect(agreedRenewal(s, f.id)).toBeNull();
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('le-012 / le-010: three refusals at 300 end the talks; he becomes a free agent at season end with formerClubId', () => {
    const s = world(19);
    const f = brannocAt(s, A, 1);
    playFourteen(s, f.id, 12);
    const answers = [1, 2, 3].map(() => renewContract(s, { clubId: A, fighterId: f.id, wagePerWeek: 300, seasons: 2 }, content));
    expect(answers.map((a) => a.ok && a.value.kind === 'refused' && a.value.reason)).toEqual(['low-offer', 'low-offer', 'will-not-renew']);
    expect(code(renewContract(s, { clubId: A, fighterId: f.id, wagePerWeek: 345, seasons: 2 }, content))).toBe('renewal.will-not-renew');
    toSeasonEnd(s, content);
    expect(contractExpiries(s, content)).toContain(f.id);
    expect(f).toMatchObject({ status: 'free-agent', clubId: null, contract: null, freeAgency: { formerClubId: A, unsignedSeasonEnds: 0 } });
    nextSeasonFinanceSetup(s, [], content);
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('ok');
  });

  it('only the holding club, only in the final season, never for a fighter in his final season', () => {
    const s = world(10);
    const f = brannocAt(s, A, 2);
    expect(code(renewContract(s, { clubId: A, fighterId: f.id, wagePerWeek: 400, seasons: 1 }, content))).toBe('renewal.not-final-season');
    expect(code(renewContract(s, { clubId: OTHER_BANNER, fighterId: f.id, wagePerWeek: 400, seasons: 1 }, content))).toBe('renewal.not-own');
    const g = brannocAt(s, A, 1);
    g.finalSeason = true;
    expect(code(renewContract(s, { clubId: A, fighterId: g.id, wagePerWeek: 400, seasons: 1 }, content))).toBe('renewal.retiring');
  });

  it('a renewal that does not raise the bill is allowed even with no wage room', () => {
    const s = world(19);
    const f = brannocAt(s, A, 1);
    s.clubs[A]!.finance.wageBudgetPerWeek = 0;
    expect(code(renewContract(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2 }, content))).toBe('ok');
    const g = brannocAt(s, A, 1);
    expect(code(renewContract(s, { clubId: A, fighterId: g.id, wagePerWeek: 400, seasons: 2 }, content))).toBe('budget.wage');
  });
});

describe('releases', () => {
  it('le-017: Brannoc on 360 to the end of next season, released while MW6 is current: payout 6,660 at once', () => {
    const s = world(10);
    const f = brannocAt(s, A, 2);
    const before = s.clubs[A]!.finance.balance;
    expect(releaseFighter(s, A, f.id, content)).toEqual({ ok: true, value: { payout: 6_660 } });
    expect(s.clubs[A]!.finance.balance).toBe(before - 6_660);
    expect(f).toMatchObject({ status: 'free-agent', clubId: null, contract: null, freeAgency: { releasedByClubId: A, releasedSeason: 1, formerClubId: A } });
    expect(s.market.releasedThisSeason).toEqual([{ fighterId: f.id, clubId: A }]);
    expect(code(releaseFighter(s, A, f.id, content))).toBe('release.not-own');
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('a release may push the balance below 0; the status changes at the next processing', () => {
    const s = world(10);
    const f = brannocAt(s, A, 2);
    setOpeningBalance(s, A, 100);
    expect(code(releaseFighter(s, A, f.id, content))).toBe('ok');
    expect(s.clubs[A]!.finance.balance).toBe(100 - 6_660);
    expect(s.clubs[A]!.finance.status).toBe('healthy');
    financialStatus(s, content);
    expect(s.clubs[A]!.finance.status).toBe('embargo');
  });

  it('le-009: a relegated Banner club with 12 fighters has a cap-relief allowance of 2 at payout 0 during P1-P4', () => {
    const s = world();
    clearRoster(s, A);
    const ids = Array.from({ length: 12 }, () => addFighter(s, content, { values: { rating: 50, potential: 50 }, clubId: A, wage: 200, endSeason: 3 }).id);
    toSeasonEnd(s, content);
    const banner = content.clubs.list.filter((c) => c.startTierLevel === 2).map((c) => asId<ClubId>(c.id));
    s.history.push({ season: 1, tiers: [tierRecord(asId<TierId>('saltmarch-banner'), banner, { relegatedIds: [A] })], retirements: [], rookieIds: [] });
    s.clubs[A]!.tierId = asId<TierId>('saltmarch-muster');
    nextSeasonFinanceSetup(s, [], content);
    setWeek(s, content, 1, 2);
    expect(rosterOf(s, A).length).toBe(12);
    expect(capReliefAllowance(s, A, content)).toBe(2);
    // Over the cap: no new fighters.
    const fa = addFighter(s, content, { values: { rating: 40, potential: 40 } });
    expect(code(makeOffer(s, { clubId: A, fighterId: fa.id, wagePerWeek: 100, seasons: 1, acceptCounter: false }, content))).toBe('roster.full');
    expect(releaseFighter(s, A, ids[0]!, content)).toEqual({ ok: true, value: { payout: 0 } });
    setWeek(s, content, 4, 2);
    expect(releaseFighter(s, A, ids[1]!, content)).toEqual({ ok: true, value: { payout: 0 } });
    expect(capReliefAllowance(s, A, content)).toBe(0);
    const third = releaseFighter(s, A, ids[2]!, content);
    expect(third.ok && third.value.payout).toBeGreaterThan(0);
  });
});

describe('embargo ladder (le-018)', () => {
  it('Muster club, balance 300, bill 900: MW10 away -> −497 embargo; MW11 home win -> 306, lifted', () => {
    const s = world(14);
    s.playerClubId = C;
    clearRoster(s, C);
    addFighter(s, content, { values: { rating: 40, potential: 40 }, clubId: C, wage: 900, endSeason: 2 });
    const club = s.clubs[C]!;
    club.finance.seasonBudget = 0;
    const rival = asId<ClubId>('skerrow-driftblades');
    // MW1..MW10 (weeks 5..14): 5 wins; MW10 is an away loss.
    for (let i = 0; i < 10; i++) {
      const week = 5 + i;
      const home = week === 14 ? rival : i % 2 === 0 ? C : rival;
      const away = home === C ? rival : C;
      addPlayedFixture(s, content, { weekIndex: week, home, away, winner: week === 14 ? rival : i < 5 ? C : rival });
    }
    setOpeningBalance(s, C, 300);
    weeklyIncome(s, content);
    weeklyCosts(s, content);
    const news = financialStatus(s, content);
    expect(club.finance.balance).toBe(-497);
    expect(club.finance.status).toBe('embargo');
    expect(club.finance.debtWeeks).toBe(1);
    expect(s.news.find((n) => n.id === news[0])).toMatchObject({ key: 'finance.embargo', params: { balance: -497 } });
    setWeek(s, content, 15);
    const fa = addFighter(s, content, { values: { rating: 40, potential: 40 } });
    expect(code(makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 150, seasons: 1, acceptCounter: false }, content))).toBe('embargo.wage');
    expect(code(makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 60, seasons: 2, acceptCounter: false }, content))).toBe('embargo.length');
    expect(code(makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 60, seasons: 1, acceptCounter: false }, content))).toBe('ok');
    addPlayedFixture(s, content, { weekIndex: 15, home: C, away: rival, winner: C });
    weeklyIncome(s, content);
    expect(s.ledger.entries.filter((e) => e.clubId === C && e.weekIndex === 15).map((e) => [e.category, e.amount])).toEqual([
      ['sponsorRetainer', 313],
      ['gate', 1_400],
      ['sponsorWinBonus', 200],
    ]);
    weeklyCosts(s, content);
    const lifted = financialStatus(s, content);
    expect(club.finance.balance).toBe(306);
    expect(club.finance.status).not.toBe('embargo');
    expect(club.finance.debtWeeks).toBe(0);
    expect(lifted.map((id) => s.news.find((n) => n.id === id)!.key)).toContain('finance.embargo-lifted');
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('under embargo a free-agent offer needs fewer than 5 fit roster fighters and costs no signing fee', () => {
    const s = world(10);
    // A fighter whose ask is the tier minimum (rating 20: curve 35, clamped to 60).
    const fa = addFighter(s, content, { values: { rating: 20, potential: 20 } });
    s.clubs[C]!.finance.status = 'embargo';
    expect(code(makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 60, seasons: 1, acceptCounter: false }, content))).toBe('embargo.roster');
    clearRoster(s, C);
    setOpeningBalance(s, C, -500);
    expect(code(makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 60, seasons: 1, acceptCounter: false }, content))).toBe('ok');
    resolveFreeAgentOffers(s, content);
    expect(fa.clubId).toBe(C);
    expect(s.ledger.entries.filter((e) => e.category === 'signingCost')).toEqual([]);
  });

  it('under embargo: renewals only at the tier minimum, no trials signings; non-conforming pending offers are void', () => {
    const s = world(19);
    s.playerClubId = A;
    const f = brannocAt(s, A, 1);
    const fa = addFighter(s, content, { values: { rating: 58, potential: 58 }, overrides: { age: 28 } });
    expect(code(makeOffer(s, { clubId: A, fighterId: fa.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('ok');
    setOpeningBalance(s, A, -1);
    financialStatus(s, content);
    expect(s.clubs[A]!.finance.status).toBe('embargo');
    expect(code(renewContract(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 1 }, content))).toBe('embargo.wage');
    const news = resolveFreeAgentOffers(s, content);
    expect(s.news.find((n) => n.id === news[0])).toMatchObject({ key: 'offer.void', params: { reason: 'embargo.wage' } });
    expect(fa.clubId).toBeNull();
  });
});

describe('Trials Day (le-022, D-H)', () => {
  function trialsWorld() {
    const s = world(1);
    s.playerClubId = C;
    const r1 = addFighter(s, content, { values: { rating: 34, potential: 66 }, overrides: { age: 18 } });
    const r2 = addFighter(s, content, { values: { rating: 34, potential: 66 }, overrides: { age: 18 } });
    s.market.trialsRookies = { [C]: [r1.id, r2.id] };
    return { s, r1, r2 };
  }

  it('signs one at its Trials Day ask (rookie scale) for 3 seasons at once with no signing cost, paid from the P1 processing', () => {
    const { s, r1, r2 } = trialsWorld();
    // le-022's rookie asks 150 on the open market; on Trials Day (D-P) his club pays at most the rookie scale:
    // floor5(tier minimum 60 × 1.25) = 75.
    expect(ask(s, r1.id, C, 3, content)).toBe(75);
    expect(ask(s, r1.id, A, 3, content)).toBeGreaterThan(75); // the cap is only his own club's
    expect(code(makeOffer(s, { clubId: A, fighterId: r2.id, wagePerWeek: 200, seasons: 1, acceptCounter: false }, content))).toBe('offer.trials-exclusive');
    expect(code(signTrialsRookie(s, { clubId: A, fighterId: r1.id, wagePerWeek: 150, seasons: 3 }, content))).toBe('trials.not-yours');
    const r = signTrialsRookie(s, { clubId: C, fighterId: r1.id, wagePerWeek: 75, seasons: 3 }, content);
    expect(r).toEqual({ ok: true, value: { kind: 'accepted', wagePerWeek: 75, seasons: 3 } });
    expect(r1.contract).toMatchObject({ clubId: C, wagePerWeek: 75, startSeason: 1, endSeason: 3 });
    expect(s.ledger.entries.filter((e) => e.category === 'signingCost')).toEqual([]);
    expect(s.market.trialsRookies[C]).toEqual([r2.id]);
    const bill = wageBill(s, C);
    weeklyCosts(s, content);
    expect(s.ledger.entries.find((e) => e.clubId === C && e.category === 'wages')!.amount).toBe(-bill);
    expect(bill).toBeGreaterThanOrEqual(75);
    // Step 7: the unsigned rookie enters the pool before the AI acts; from P2 he is a normal free agent.
    releaseTrialsRookies(s, content);
    expect(s.market.trialsRookies).toEqual({});
    setWeek(s, content, 2);
    expect(code(signTrialsRookie(s, { clubId: C, fighterId: r2.id, wagePerWeek: 150, seasons: 3 }, content))).toBe('trials.not-yours');
    expect(code(makeOffer(s, { clubId: A, fighterId: r2.id, wagePerWeek: 130, seasons: 1, acceptCounter: false }, content))).toBe('ok');
    resolveFreeAgentOffers(s, content);
    expect(r2.clubId).toBe(A);
    expect(s.ledger.entries.filter((e) => e.category === 'signingCost').map((e) => e.amount)).toEqual([-270]); // ask 130 at A; floor10(130 × 21 × 10%)
  });

  it('trials signings answer with a counter or a refusal like any negotiation, and are blocked under embargo', () => {
    const { s, r1 } = trialsWorld();
    // Ask 75 (rookie scale); 70 is within his flex: counter at floor5((70 + 75) / 2) = 70.
    const low = signTrialsRookie(s, { clubId: C, fighterId: r1.id, wagePerWeek: 70, seasons: 3 }, content);
    expect(low).toEqual({ ok: true, value: { kind: 'countered', counterWage: 70, validUntilWeek: 1 } });
    s.clubs[C]!.finance.status = 'embargo';
    expect(code(signTrialsRookie(s, { clubId: C, fighterId: r1.id, wagePerWeek: 75, seasons: 3 }, content))).toBe('embargo.trials');
  });

  it('intake-001: 70 rookies over 48 clubs: 1 each and 22 by lot, deterministic', () => {
    const run = () => {
      const s = world(1);
      toSeasonEnd(s, content);
      const ids = Array.from({ length: 70 }, () => addFighter(s, content, { values: { rating: 30, potential: 60 }, overrides: { age: 17 } }).id);
      nextSeasonFinanceSetup(s, ids, content);
      return s.market.trialsRookies;
    };
    const t = run();
    const counts = Object.values(t).map((l) => l!.length);
    expect(counts.length).toBe(48);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(70);
    expect(counts.filter((c) => c === 2).length).toBe(22);
    expect(counts.every((c) => c === 1 || c === 2)).toBe(true);
    expect(run()).toEqual(t);
  });
});

describe('hired blades (le-024, open-006)', () => {
  function shortWorld(classes: string[]) {
    const s = world(10);
    clearRoster(s, A);
    for (const k of classes) addFighter(s, content, { values: { rating: 50, potential: 50 }, clubId: A, wage: 200, endSeason: 2, overrides: { classId: asId<ClassId>(k) } });
    addPlayedFixture(s, content, { weekIndex: 10, home: A, away: OTHER_BANNER, winner: A, played: false });
    return s;
  }

  it('a Banner club with 4 fit fighters gets one blade, paid 110 at that processing, gone afterwards', () => {
    const s = shortWorld(['oathguard', 'chirurgeon', 'longeye', 'rimebinder']);
    const blades = assignHiredBlades(s, content);
    expect(Object.keys(blades)).toEqual([A]);
    const [bladeId] = blades[A]!;
    const blade = s.fighters[bladeId!]!;
    expect(blade).toMatchObject({ status: 'hired-blade', clubId: A, classId: 'gutterknife' });
    expect(rosterOf(s, A).length).toBe(4);
    expect(assignHiredBlades(s, content)[A]).toEqual([bladeId]); // idempotent
    const bill = wageBill(s, A);
    weeklyCosts(s, content);
    expect(s.ledger.entries.filter((e) => e.clubId === A && e.category === 'hiredBlades')).toMatchObject([{ amount: -110, fighterId: bladeId }]);
    expect(s.ledger.entries.find((e) => e.clubId === A && e.category === 'wages')!.amount).toBe(-bill);
    expect(blade.clubId).toBeNull();
    expect(blade.contract).toBeNull();
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('covers a missing Tank, then a missing Healer, then Melee DPS; clubs without a fixture get none', () => {
    const s = shortWorld(['longeye', 'rimebinder']);
    const blades = assignHiredBlades(s, content)[A]!;
    expect(blades.map((id) => s.fighters[id]!.classId)).toEqual(['oathguard', 'chirurgeon', 'gutterknife']);
    const t = buildFixtureWorld({ freeAgents: 0 });
    setWeek(t, content, 10);
    clearRoster(t, A);
    expect(assignHiredBlades(t, content)).toEqual({});
  });
});
