import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asId, type ClubId, type GameState, type TraitId } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import {
  ask,
  checkOffer,
  ledgerInvariantViolations,
  makeOffer,
  pendingSigningCosts,
  pendingWages,
  releaseFighter,
  resolveFreeAgentOffers,
  rivalOfferCount,
  validCounter,
  wageBill,
  weeklyCosts,
  withdrawOffer,
} from './index';
import { addFighter, clearRoster, resetFighterDoubles, setFighterValues, setOpeningBalance, setWeek } from './testing';

vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);

const content = fixtureContent();
const A = asId<ClubId>('varrow-netcasters'); // Banner, prestige 50
const B = asId<ClubId>('wrackholt-salvagers'); // Crown, prestige 60
const C = asId<ClubId>('keelwick-bilge-company'); // Muster, prestige 20
const trait = (id: string) => ({ id: asId<TraitId>(id), gainedSeason: 1, source: 'rolled' as const });

function world(week = 1): GameState {
  const s = buildFixtureWorld({ freeAgents: 0 });
  setWeek(s, content, week);
  for (const club of Object.values(s.clubs)) {
    club.finance.wageBudgetPerWeek = 50_000;
    setOpeningBalance(s, club.id, 100_000);
  }
  return s;
}

/** Roster ratings of a club, all set to `rating`. */
function rateRoster(s: GameState, clubId: ClubId, rating: number): void {
  for (const f of Object.values(s.fighters)) if (f.clubId === clubId) setFighterValues(f.id, { rating, potential: rating });
}

function brannoc(s: GameState) {
  return addFighter(s, content, {
    values: { rating: 58, potential: 64 },
    overrides: { age: 23, contractProfile: { greedBp: 400 }, traits: [trait('still_water'), trait('hot_blood')] },
  });
}

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? 'ok' : r.error!.code);

beforeEach(() => resetFighterDoubles());

describe('commitment rule, cap and cash at submission', () => {
  it('le-015: Muster WB 1,138, bill 1,000: an offer at 150 is over budget by 12, 135 is accepted as pending', () => {
    const s = world();
    clearRoster(s, C);
    addFighter(s, content, { values: { rating: 40, potential: 40 }, clubId: C, wage: 1_000, endSeason: 2 });
    s.clubs[C]!.finance.wageBudgetPerWeek = 1_138;
    const fa = addFighter(s, content, { values: { rating: 44, potential: 44 }, overrides: { age: 28 } });
    const over = makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 150, seasons: 2, acceptCounter: false }, content);
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.error.code).toBe('budget.wage');
      expect(over.error.message).toBe('Over wage budget by 12 per week');
    }
    expect(s.market.offers).toEqual([]);
    const fits = makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 135, seasons: 2, acceptCounter: false }, content);
    expect(fits).toEqual({ ok: true, value: { kind: 'pending' } });
    expect(pendingWages(s, C)).toBe(135);
    expect(wageBill(s, C)).toBe(1_000);
  });

  it('le-014: Muster roster 9 with 1 pending offer: a second offer is refused, nothing changes', () => {
    const s = world();
    addFighter(s, content, { values: { rating: 40, potential: 40 }, clubId: C, wage: 100 });
    const f1 = addFighter(s, content, { values: { rating: 40, potential: 40 }, overrides: { age: 28 } });
    const f2 = addFighter(s, content, { values: { rating: 40, potential: 40 }, overrides: { age: 28 } });
    expect(code(makeOffer(s, { clubId: C, fighterId: f1.id, wagePerWeek: 120, seasons: 2, acceptCounter: false }, content))).toBe('ok');
    const before = JSON.stringify(s);
    const r = makeOffer(s, { clubId: C, fighterId: f2.id, wagePerWeek: 120, seasons: 2, acceptCounter: false }, content);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe('Roster full with pending offers (9 + 1 of 10)');
    expect(JSON.stringify(s)).toBe(before);
  });

  it('le-016: Banner club with balance 1,500 at P1: Brannoc at 360 for 2 seasons is refused (signing cost 1,620)', () => {
    const s = world();
    setOpeningBalance(s, A, 1_500);
    const f = brannoc(s);
    const check = checkOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2, kind: 'free-agent' }, content);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.error.details).toMatchObject({ signingCost: 1_620, available: 1_500 });
    setOpeningBalance(s, A, 1_620);
    const fits = checkOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2, kind: 'free-agent' }, content);
    expect(fits.ok && fits.value.signingCost).toBe(1_620);
  });

  it('pending offers reserve wage room and signing costs; a replaced offer is not counted twice; withdraw frees them', () => {
    const s = world();
    const f = brannoc(s);
    const g = brannoc(s);
    s.clubs[A]!.finance.wageBudgetPerWeek = wageBill(s, A) + 720;
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content))).toBe('ok');
    expect(pendingSigningCosts(s, A, content)).toBe(1_620);
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 365, seasons: 2, acceptCounter: false }, content))).toBe('ok');
    expect(s.market.offers.length).toBe(1);
    expect(code(makeOffer(s, { clubId: A, fighterId: g.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content))).toBe('budget.wage');
    expect(code(withdrawOffer(s, A, f.id))).toBe('ok');
    expect(code(withdrawOffer(s, A, f.id))).toBe('offer.not-found');
    expect(code(makeOffer(s, { clubId: A, fighterId: g.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content))).toBe('ok');
  });

  it('offers above 1.5 × ask are capped; at most 6 pending; length and minimum wage are checked', () => {
    const s = world();
    const f = brannoc(s);
    makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 1_000, seasons: 2, acceptCounter: false }, content);
    expect(s.market.offers[0]!.wagePerWeek).toBe(540);
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 300, seasons: 4, acceptCounter: false }, content))).toBe('offer.length');
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 100, seasons: 2, acceptCounter: false }, content))).toBe('offer.below-minimum');
    const crown = asId<ClubId>('varrow-ninth-oar');
    for (let i = 0; i < 6; i++) {
      const x = brannoc(s);
      expect(code(makeOffer(s, { clubId: crown, fighterId: x.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('ok');
    }
    expect(code(makeOffer(s, { clubId: crown, fighterId: f.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('offer.max-pending');
    expect(rivalOfferCount(s, f.id, crown)).toBe(1);
  });

  it('only free agents in the pool can receive offers', () => {
    const s = world();
    const rostered = Object.values(s.fighters).find((x) => x.clubId === B)!;
    expect(code(makeOffer(s, { clubId: A, fighterId: rostered.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('offer.not-free-agent');
  });
});

describe('free-agent decisions at week processing (le-013)', () => {
  function auction() {
    const s = world();
    rateRoster(s, A, 50); // he would start at A
    rateRoster(s, B, 70); // not at B
    rateRoster(s, C, 40);
    const f = brannoc(s);
    return { s, f };
  }

  it('A (Banner p50, starter) 360 beats B (Crown p60) 375: scores 10,500 vs 10,416; B is told he signed with A', () => {
    const { s, f } = auction();
    s.playerClubId = B;
    makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content);
    makeOffer(s, { clubId: B, fighterId: f.id, wagePerWeek: 375, seasons: 2, acceptCounter: false }, content);
    expect(rivalOfferCount(s, f.id, A)).toBe(1);
    const news = resolveFreeAgentOffers(s, content);
    expect(f.clubId).toBe(A);
    expect(f.status).toBe('active');
    expect(f.contract).toMatchObject({ clubId: A, wagePerWeek: 360, startSeason: 1, endSeason: 2 });
    expect(s.market.offers).toEqual([]);
    expect(s.ledger.entries.filter((e) => e.category === 'signingCost')).toMatchObject([{ clubId: A, amount: -1_620, fighterId: f.id }]);
    expect(news.length).toBe(1);
    const item = s.news.find((n) => n.id === news[0])!;
    expect(item).toMatchObject({ key: 'offer.lost', clubId: B, refs: { fighterId: f.id, otherClubId: A } });
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('a Muster club can outbid both by paying the premium and offering a start: 430 vs ask 420 scores 10,738', () => {
    const { s, f } = auction();
    makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content);
    makeOffer(s, { clubId: B, fighterId: f.id, wagePerWeek: 375, seasons: 2, acceptCounter: false }, content);
    makeOffer(s, { clubId: C, fighterId: f.id, wagePerWeek: 430, seasons: 2, acceptCounter: false }, content);
    resolveFreeAgentOffers(s, content);
    expect(f.clubId).toBe(C);
  });

  it('ties go to the higher prestige, then the higher tier, then a seeded lot (deterministic)', () => {
    const run = (prestigeA: number, prestigeX: number) => {
      const s = world();
      const X = asId<ClubId>('gullhaven-ropebinders'); // Banner, prestige 52
      rateRoster(s, A, 50);
      rateRoster(s, X, 50);
      s.clubs[A]!.prestige = prestigeA;
      s.clubs[X]!.prestige = prestigeX;
      const f = brannoc(s);
      // His ask is 360 at both Banner clubs for prestige 50-51, so equal offers give equal scores.
      makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content);
      makeOffer(s, { clubId: X, fighterId: f.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content);
      resolveFreeAgentOffers(s, content);
      return f.clubId;
    };
    expect(run(50, 50)).toBe(run(50, 50));
    expect(run(51, 50)).toBe(A);
    expect(run(50, 51)).toBe(asId<ClubId>('gullhaven-ropebinders'));
  });

  it('equal score and prestige: the higher tier wins', () => {
    const s = world();
    rateRoster(s, A, 50);
    rateRoster(s, B, 50);
    s.clubs[B]!.prestige = 50;
    const f = brannoc(s);
    const askA = ask(s, f.id, A, 2, content);
    const askB = ask(s, f.id, B, 2, content); // Crown at prestige 50: −500 tier discount, +600 prestige (cap), +400 greed
    expect([askA, askB]).toEqual([360, 370]);
    makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: askA, seasons: 2, acceptCounter: false }, content);
    makeOffer(s, { clubId: B, fighterId: f.id, wagePerWeek: askB, seasons: 2, acceptCounter: false }, content);
    resolveFreeAgentOffers(s, content);
    expect(f.clubId).toBe(B);
  });

  it('counter within the flex, valid through the next processing; accepting it signs at the counter price', () => {
    const s = world();
    s.playerClubId = A;
    const f = brannoc(s);
    makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 340, seasons: 2, acceptCounter: false }, content);
    const news = resolveFreeAgentOffers(s, content);
    expect(s.news.find((n) => n.id === news[0])).toMatchObject({ key: 'offer.countered', params: { counterWage: 350, validUntilWeek: 2 } });
    expect(f.clubId).toBeNull();
    setWeek(s, content, 2);
    expect(validCounter(s, { clubId: A, fighterId: f.id }, 'free-agent', { season: 1, weekIndex: 2 })).toBe(350);
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 0, seasons: 2, acceptCounter: true }, content))).toBe('ok');
    expect(s.market.offers[0]).toMatchObject({ wagePerWeek: 350, isCounterAcceptance: true });
    resolveFreeAgentOffers(s, content);
    expect(f.contract).toMatchObject({ clubId: A, wagePerWeek: 350 });
  });

  it('an expired counter cannot be accepted; offers below the flex are refused and patience runs out after 3', () => {
    const s = world();
    const f = brannoc(s);
    makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 340, seasons: 2, acceptCounter: false }, content);
    resolveFreeAgentOffers(s, content);
    setWeek(s, content, 3);
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 0, seasons: 2, acceptCounter: true }, content))).toBe('offer.no-counter');
    for (let i = 0; i < 3; i++) {
      expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 300, seasons: 2, acceptCounter: false }, content))).toBe('ok');
      resolveFreeAgentOffers(s, content);
    }
    expect(s.market.refusalsThisSeason[A]).toBe(3);
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('offer.will-not-deal');
    // Other clubs may still deal with him.
    expect(code(makeOffer(s, { clubId: B, fighterId: f.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('ok');
  });

  it('the winner is re-checked at resolution: a failing offer is void and the next acceptable one signs', () => {
    const { s, f } = auction();
    s.playerClubId = A;
    makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content);
    makeOffer(s, { clubId: B, fighterId: f.id, wagePerWeek: 375, seasons: 2, acceptCounter: false }, content);
    // A spends its cash before processing (a release payout may push it below the signing cost).
    setOpeningBalance(s, A, 1_000);
    const news = resolveFreeAgentOffers(s, content);
    expect(s.news.find((n) => n.id === news[0])).toMatchObject({ key: 'offer.void', params: { reason: 'budget.cash' } });
    expect(f.clubId).toBe(B);
  });

  it('free agents decide in market-wage order (higher first), fighter id breaking ties', () => {
    const s = world();
    const cheap = addFighter(s, content, { values: { rating: 50, potential: 50 }, overrides: { age: 28 } });
    const dear = addFighter(s, content, { values: { rating: 70, potential: 70 }, overrides: { age: 28 } });
    makeOffer(s, { clubId: A, fighterId: cheap.id, wagePerWeek: 300, seasons: 2, acceptCounter: false }, content);
    makeOffer(s, { clubId: A, fighterId: dear.id, wagePerWeek: 900, seasons: 2, acceptCounter: false }, content);
    resolveFreeAgentOffers(s, content);
    expect(s.ledger.entries.filter((e) => e.category === 'signingCost').map((e) => e.fighterId)).toEqual([dear.id, cheap.id]);
  });

  it('le-023: MW6 offer at ask 150 for one season: signed at MW6 processing, cost 190, first paid at MW7', () => {
    const s = world(10);
    const f = addFighter(s, content, { values: { rating: 41, potential: 51 }, overrides: { age: 20 } });
    expect(code(makeOffer(s, { clubId: C, fighterId: f.id, wagePerWeek: 150, seasons: 1, acceptCounter: false }, content))).toBe('ok');
    const bill = wageBill(s, C);
    weeklyCosts(s, content);
    expect(s.ledger.entries.find((e) => e.clubId === C && e.category === 'wages')!.amount).toBe(-bill);
    resolveFreeAgentOffers(s, content);
    expect(f.contract).toMatchObject({ clubId: C, wagePerWeek: 150, endSeason: 1, signedAt: { season: 1, weekIndex: 10 } });
    expect(s.ledger.entries.find((e) => e.category === 'signingCost')!.amount).toBe(-190);
    setWeek(s, content, 11);
    weeklyCosts(s, content);
    expect(s.ledger.entries.filter((e) => e.clubId === C && e.category === 'wages').map((e) => e.amount)).toEqual([-bill, -(bill + 150)]);
    expect(ledgerInvariantViolations(s)).toEqual([]);
  });

  it('pending offers to a fighter who left the pool are void', () => {
    const s = world();
    const f = brannoc(s);
    makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 360, seasons: 2, acceptCounter: false }, content);
    f.status = 'retired';
    resolveFreeAgentOffers(s, content);
    expect(s.market.offers).toEqual([]);
    expect(f.clubId).toBeNull();
  });
});

describe('released fighters', () => {
  it('cannot re-sign with the releasing club this season', () => {
    const s = world(10);
    const f = addFighter(s, content, { values: { rating: 58, potential: 58 }, clubId: A, wage: 360, endSeason: 2 });
    expect(code(releaseFighter(s, A, f.id, content))).toBe('ok');
    expect(code(makeOffer(s, { clubId: A, fighterId: f.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('offer.released-by-club');
    expect(code(makeOffer(s, { clubId: B, fighterId: f.id, wagePerWeek: 400, seasons: 2, acceptCounter: false }, content))).toBe('ok');
  });
});
