/**
 * R2-T006: renewals are judged on next season's wage room. The owner's playtest: "if I am not going to re-sign Garus or
 * Rhoald, I should be able to afford the 110 ts increase for Rhagar" (wage room 15 ts/week, wages 70, 80 and 235).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asId, type ClubId, type Fighter, type GameState } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import {
  ask,
  agreedRenewal,
  checkOffer,
  financeDetails,
  financeView,
  makeOffer,
  nextSeasonWage,
  renewContract,
} from './index';
import { addFighter, clearRoster, resetFighterDoubles, setOpeningBalance, setWeek, toSeasonEnd } from './testing';

vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);

const content = fixtureContent();
const C = asId<ClubId>('keelwick-bilge-company'); // Muster
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? 'ok' : r.error!.code);

interface Scenario {
  s: GameState;
  garus: Fighter;
  rhoald: Fighter;
  rhagar: Fighter;
  /** The four contracts that run on into next season. */
  continuing: Fighter[];
}

/** The owner's squad: Garus 70, Rhoald 80 and Rhagar 235 end this season; 710 a week continues; wage room today 15. */
function ownerScenario(wageBudget = 1_110): Scenario {
  const s = buildFixtureWorld({ freeAgents: 0 });
  setWeek(s, content, 19); // the renewal window: MW15, season 1
  for (const club of Object.values(s.clubs)) club.finance.wageBudgetPerWeek = 50_000;
  s.playerClubId = C;
  clearRoster(s, C);
  const mk = (wage: number, endSeason: number, rating: number, age = 25) =>
    addFighter(s, content, { values: { rating, potential: rating + 6 }, clubId: C, wage, endSeason, overrides: { age, contractProfile: { greedBp: 0 } } });
  const garus = mk(70, 1, 42, 36);
  const rhoald = mk(80, 1, 45, 37);
  const rhagar = mk(235, 1, 53, 16);
  const continuing = [mk(200, 3, 50), mk(200, 3, 50), mk(160, 2, 50), mk(150, 2, 50)];
  s.clubs[C]!.finance.wageBudgetPerWeek = wageBudget;
  setOpeningBalance(s, C, 100_000);
  return { s, garus, rhoald, rhagar, continuing };
}

beforeEach(() => resetFighterDoubles());

describe('next-season wage room (the owner scenario)', () => {
  it('today there are 15 ts of room, but 400 next season: the expiring contracts are not counted', () => {
    const { s, garus, rhoald, rhagar } = ownerScenario();
    const d = financeDetails(s, C, content);
    expect(d.wageRoom).toBe(15); // 1,110 - (385 + 710)
    expect(d.nextSeasonWageRoom).toBe(400); // 1,110 - 710
    expect(d.nextSeason).toMatchObject({
      season: 2,
      projectedWageBudget: 1_110,
      continuing: 710,
      agreedRenewals: 0,
      pendingOffers: 0,
      commitments: 710,
      wageRoom: 400,
      assumesNoTierChange: true,
    });
    expect([...d.nextSeason.expiring.fighterIds].sort()).toEqual([garus.id, rhoald.id, rhagar.id].sort());
    expect(d.nextSeason.expiring.wagePerWeek).toBe(385);
    const v = financeView(s, C, content);
    expect(v.nextSeasonWageRoom).toBe(400);
    expect(v.nextSeason).toEqual(d.nextSeason);
    expect(nextSeasonWage(s, C)).toEqual(d.nextSeason);
  });

  it('the +110 raise for Rhagar fits next season (not this one) and is accepted; Garus and Rhoald are left to go', () => {
    const { s, rhagar } = ownerScenario();
    const wage = ask(s, rhagar.id, C, 2, content);
    // A real raise: it does not fit this season's 15 ts of room, it does fit next season's 400.
    expect(wage - rhagar.contract!.wagePerWeek).toBeGreaterThan(15);
    expect(wage).toBeLessThanOrEqual(400);
    const check = checkOffer(s, { clubId: C, fighterId: rhagar.id, wagePerWeek: wage, seasons: 2, kind: 'renewal' }, content);
    expect(check).toMatchObject({ ok: true, value: { basis: 'next-season', wageRoomAfter: 400 - wage } });
    const answer = renewContract(s, { clubId: C, fighterId: rhagar.id, wagePerWeek: wage, seasons: 2 }, content);
    expect(answer).toEqual({ ok: true, value: { kind: 'accepted', wagePerWeek: wage, seasons: 2 } });
    expect(agreedRenewal(s, rhagar.id)).toMatchObject({ clubId: C, wagePerWeek: wage });
    // The old wage keeps being paid until setup, so this season's room is unchanged by the new terms except the commitment rule's raise.
    expect(rhagar.contract).toMatchObject({ wagePerWeek: 235, endSeason: 3 });
  });

  it('a renewal that does not fit even next season is refused, with the next-season room in the error', () => {
    const { s, rhagar } = ownerScenario(1_000); // next season: 290 of room
    const wage = ask(s, rhagar.id, C, 2, content);
    expect(wage).toBeGreaterThan(290);
    const r = renewContract(s, { clubId: C, fighterId: rhagar.id, wagePerWeek: wage, seasons: 2 }, content);
    expect(r).toMatchObject({ ok: false, error: { code: 'budget.wage', details: { basis: 'next-season', wageBudget: 1_000, nextSeasonWageRoom: 290, over: wage - 290, committed: 710 + wage } } });
    expect(checkOffer(s, { clubId: C, fighterId: rhagar.id, wagePerWeek: wage, seasons: 2, kind: 'renewal' }, content)).toMatchObject({ ok: false, error: { code: 'budget.wage' } });
    expect(agreedRenewal(s, rhagar.id)).toBeNull();
    expect(s.ledger.entries.filter((e) => e.category === 'signingCost')).toEqual([]);
  });

  it('agreed renewals reduce next-season room: Rhagar at his ask leaves less for Garus and Rhoald', () => {
    const { s, garus, rhoald, rhagar } = ownerScenario();
    const rhagarWage = ask(s, rhagar.id, C, 2, content);
    expect(renewContract(s, { clubId: C, fighterId: rhagar.id, wagePerWeek: rhagarWage, seasons: 2 }, content)).toMatchObject({ ok: true, value: { kind: 'accepted' } });
    const after = nextSeasonWage(s, C);
    expect(after).toMatchObject({ continuing: 710, agreedRenewals: rhagarWage, commitments: 710 + rhagarWage, wageRoom: 400 - rhagarWage });
    expect([...after.expiring.fighterIds].sort()).toEqual([garus.id, rhoald.id].sort());
    expect(after.expiring.wagePerWeek).toBe(150);
    // What is left decides the next renewal: refuse the one that no longer fits, accept one that does.
    const garusWage = ask(s, garus.id, C, 1, content);
    const room = 400 - rhagarWage;
    const fits = garusWage <= room;
    const garusCheck = checkOffer(s, { clubId: C, fighterId: garus.id, wagePerWeek: garusWage, seasons: 1, kind: 'renewal' }, content);
    expect(garusCheck.ok).toBe(fits);
    // Free the room by shrinking the budget requirement: raise the WB just enough for exactly one more renewal and see it land.
    s.clubs[C]!.finance.wageBudgetPerWeek = 710 + rhagarWage + garusWage;
    expect(nextSeasonWage(s, C).wageRoom).toBe(garusWage);
    expect(checkOffer(s, { clubId: C, fighterId: garus.id, wagePerWeek: garusWage, seasons: 1, kind: 'renewal' }, content)).toMatchObject({ ok: true, value: { wageRoomAfter: 0, basis: 'next-season' } });
    expect(renewContract(s, { clubId: C, fighterId: garus.id, wagePerWeek: garusWage, seasons: 1 }, content)).toMatchObject({ ok: true, value: { kind: 'accepted' } });
    expect(nextSeasonWage(s, C).wageRoom).toBe(0);
    // Now Rhoald cannot be kept at any price above the tier minimum: nothing is left.
    const rhoaldWage = ask(s, rhoald.id, C, 1, content);
    expect(code(renewContract(s, { clubId: C, fighterId: rhoald.id, wagePerWeek: rhoaldWage, seasons: 1 }, content))).toBe('budget.wage');
  });

  it('a renewal that does not raise the fighter\'s wage is still allowed when the club is over budget (the old exemption)', () => {
    const { s, rhagar } = ownerScenario(0);
    expect(code(renewContract(s, { clubId: C, fighterId: rhagar.id, wagePerWeek: 235, seasons: 2 }, content))).not.toBe('budget.wage');
  });

  it('under embargo only the tier minimum is allowed, whatever the room', () => {
    const { s, rhagar } = ownerScenario(5_000);
    s.clubs[C]!.finance.status = 'embargo';
    expect(code(renewContract(s, { clubId: C, fighterId: rhagar.id, wagePerWeek: 300, seasons: 2 }, content))).toBe('embargo.wage');
  });
});

describe('what counts as a next-season commitment', () => {
  it('contracts that run on count at their current wage; a contract ending this season does not, whatever its wage', () => {
    const { s, continuing } = ownerScenario();
    expect(nextSeasonWage(s, C).continuing).toBe(continuing.reduce((n, f) => n + f.contract!.wagePerWeek, 0));
    expect(nextSeasonWage(s, C).expiring.fighterIds).toHaveLength(3);
  });

  it('pending offers count only when they would run into next season (2+ seasons now, anything while the season-end step is pending)', () => {
    const { s, rhagar } = ownerScenario(50_000);
    const a = addFighter(s, content, { values: { rating: 40, potential: 40 } });
    const b = addFighter(s, content, { values: { rating: 40, potential: 40 } });
    expect(makeOffer(s, { clubId: C, fighterId: a.id, wagePerWeek: 100, seasons: 1, acceptCounter: false }, content)).toMatchObject({ ok: true });
    expect(nextSeasonWage(s, C).pendingOffers).toBe(0);
    expect(makeOffer(s, { clubId: C, fighterId: b.id, wagePerWeek: 120, seasons: 2, acceptCounter: false }, content)).toMatchObject({ ok: true });
    expect(nextSeasonWage(s, C)).toMatchObject({ pendingOffers: 120, commitments: 710 + 120 });
    // Both offers sit in this season's pending wages.
    expect(financeDetails(s, C, content).wageRoom).toBe(50_000 - (385 + 710) - 220);
    // A pending multi-season signing is a commitment a renewal has to leave room for.
    s.clubs[C]!.finance.wageBudgetPerWeek = 710 + 120 + 60;
    const c = ask(s, rhagar.id, C, 2, content);
    expect(c).toBeGreaterThan(60);
    expect(code(renewContract(s, { clubId: C, fighterId: rhagar.id, wagePerWeek: c, seasons: 2 }, content))).toBe('budget.wage');
  });
});

describe('signings that start this season keep this season\'s wage room', () => {
  it('a free-agent offer made in-season is judged on the current bill, even with 400 of room next season', () => {
    const { s } = ownerScenario();
    const fa = addFighter(s, content, { values: { rating: 40, potential: 40 } });
    const r = makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 100, seasons: 2, acceptCounter: false }, content);
    expect(r).toMatchObject({ ok: false, error: { code: 'budget.wage', details: { basis: 'this-season', over: 85 } } });
    // Even the tier minimum (60) is over the 15 ts of room this season has left.
    expect(checkOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 60, seasons: 1, kind: 'free-agent' }, content)).toMatchObject({ ok: false, error: { code: 'budget.wage', details: { basis: 'this-season', over: 45 } } });
  });

  it('while the season-end step is pending, a signing for next season is judged on next season\'s room', () => {
    const { s } = ownerScenario();
    toSeasonEnd(s, content);
    const fa = addFighter(s, content, { values: { rating: 40, potential: 40 } });
    // The expiring wages (385) are about to go: 100 fits the 400 of next-season room though not this season's 15.
    expect(checkOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 100, seasons: 2, kind: 'free-agent' }, content)).toMatchObject({ ok: true, value: { basis: 'next-season', wageRoomAfter: 300 } });
    expect(code(makeOffer(s, { clubId: C, fighterId: fa.id, wagePerWeek: 100, seasons: 2, acceptCounter: false }, content))).toBe('ok');
    expect(nextSeasonWage(s, C)).toMatchObject({ pendingOffers: 100, wageRoom: 300, season: 2 });
  });
});
