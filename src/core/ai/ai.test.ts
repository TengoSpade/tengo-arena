import { describe, expect, it } from 'vitest';
import type { ContentDB } from '../content';
import { asId, type AiPersonalityId, type ClubId, type Command, type Fighter, type FighterId, type GameState, type WeekId } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { cloneJson, ok, stableStringify } from '../util';
import { PRESET_STYLE_FOR_TACTICS_STYLE, createAi, emphasisFor, type AiPorts } from './index';

const content: ContentDB = fixtureContent();
const fid = (n: number): FighterId => asId<FighterId>(`f-${n}`);

/** Test doubles for the read-only module functions the AI uses. */
function fakePorts(opts: { ratings?: Map<string, number>; cqs?: Map<string, number>; ask?: (id: FighterId) => number; checks?: Command[] } = {}): AiPorts {
  const grade = content.development.captaincy.grades[2]!;
  return {
    fighters: {
      rating: (f) => opts.ratings?.get(f.id) ?? 50,
      potential: (f) => f.potentialRoll,
      humanAge100: (f) => Math.trunc((f.age * 8000) / content.races.require(f.raceId).lifespan),
      isFit: (f) => f.injury === null || f.injury.weeksOut === 0,
      captaincy: (_s, id) => ({ cq: opts.cqs?.get(id) ?? 50, grade }),
    },
    economy: {
      ask: (_s, id) => opts.ask?.(id) ?? 100,
      checkOffer: () => ok({ signingCost: 0, wageRoomAfter: 0 }),
      wageBill: (s, clubId) => Object.values(s.fighters).reduce((sum, f) => sum + (f.clubId === clubId && f.contract ? f.contract.wagePerWeek : 0), 0),
      pendingWages: (s, clubId) => s.market.offers.filter((o) => o.clubId === clubId).reduce((sum, o) => sum + o.wagePerWeek, 0),
      agreedRenewal: () => null,
      preferredLength: () => 2,
    },
  };
}

function world(): GameState {
  const state = buildFixtureWorld({ clubLimit: 4, fightersPerClub: 8, freeAgents: 6 });
  for (const c of Object.values(state.clubs)) {
    c.finance.seasonBudget = 100_000;
    c.finance.wageBudgetPerWeek = 5000;
    c.finance.balance = 50_000;
  }
  return state;
}

const NINTH_OAR = asId<ClubId>('varrow-ninth-oar'); // balanced, steady; fighters f-9..f-16
const SEALBEARERS = asId<ClubId>('varrow-sealbearers'); // veteran, cautious; fighters f-17..f-24

function rosterIds(state: GameState, clubId: ClubId): FighterId[] {
  return Object.values(state.fighters).filter((f) => f.clubId === clubId).map((f) => f.id);
}

describe('chooseLineup (03 sys-ai-manager procedure 8)', () => {
  // f-9 rimebinder, f-10 chirurgeon, f-11 siegebreaker (tank+melee), f-12 oathguard, f-13 gutterknife,
  // f-14 longeye, f-15 rimebinder, f-16 chirurgeon.
  const ratings = new Map<string, number>([
    ['f-9', 50],
    ['f-10', 44],
    ['f-11', 41],
    ['f-12', 48],
    ['f-13', 47],
    ['f-14', 46],
    ['f-15', 45],
    ['f-16', 30],
  ]);

  it('le-025: best Tank, best Healer, then the three highest-rated; rows by class; presets by tacticsStyle', () => {
    const ai = createAi(fakePorts({ ratings }));
    const choice = ai.chooseLineup(world(), NINTH_OAR, content);
    expect(new Set(choice.fighters.map((e) => e.fighterId))).toEqual(new Set([fid(12), fid(10), fid(9), fid(13), fid(14)]));
    // Front row first (oathguard 48, gutterknife 47), then the back row by rating.
    expect(choice.fighters).toEqual([
      { fighterId: fid(12), row: 'front' },
      { fighterId: fid(13), row: 'front' },
      { fighterId: fid(9), row: 'back' },
      { fighterId: fid(14), row: 'back' },
      { fighterId: fid(10), row: 'back' },
    ]);
    expect(choice.matchCaptainId).toBeNull();
    for (const e of choice.fighters) expect(content.presets.require((choice.tactics[e.fighterId] as { presetId: string }).presetId).style).toBe('balanced');
  });

  it('skips unfit fighters and returns fewer than 5 when the club is short (hired blades fill the rest)', () => {
    const state = world();
    for (const n of [9, 10, 11, 12]) state.fighters[fid(n)]!.injury = { severity: 'minor', weeksOut: 2, fixtureId: null, round: null, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 1 } };
    const ai = createAi(fakePorts({ ratings }));
    const ids = ai.chooseLineup(state, NINTH_OAR, content).fighters.map((e) => e.fighterId);
    expect(ids).not.toContain(fid(12));
    expect(ids).toHaveLength(4);
    for (const n of [13, 14, 15, 16]) state.fighters[fid(n)]!.injury = state.fighters[fid(9)]!.injury;
    expect(ai.chooseLineup(state, NINTH_OAR, content).fighters).toEqual([]);
  });

  it('cmb-013: a cautious club fields the first protective preset of the class', () => {
    expect(PRESET_STYLE_FOR_TACTICS_STYLE.cautious).toBe('protective');
    const choice = createAi(fakePorts()).chooseLineup(world(), SEALBEARERS, content);
    const oathguard = choice.fighters.find((e) => world().fighters[e.fighterId]!.classId === 'oathguard');
    expect(oathguard).toBeDefined();
    expect(choice.tactics[oathguard!.fighterId]).toEqual({ kind: 'preset', presetId: 'oathguard_protective' });
  });

  it('is a pure function of the state (same state, same lineup; input untouched)', () => {
    const state = world();
    const before = stableStringify(state);
    const ai = createAi(fakePorts({ ratings }));
    expect(ai.chooseLineup(state, NINTH_OAR, content)).toEqual(ai.chooseLineup(cloneJson(state), NINTH_OAR, content));
    expect(stableStringify(state)).toBe(before);
  });
});

describe('captains (D-I)', () => {
  const ratings = new Map<string, number>([['f-9', 60], ['f-10', 59], ['f-12', 58], ['f-13', 57], ['f-14', 56]]);

  it('cap-010: season-end keeps an incumbent unless a challenger exceeds him by the hysteresis', () => {
    const state = world();
    state.clubs[NINTH_OAR]!.captainId = fid(9);
    const close = createAi(fakePorts({ ratings, cqs: new Map([['f-9', 70], ['f-10', 74]]) }));
    expect(close.chooseCaptains(state, NINTH_OAR, content, 'season-end').captainId).toBe(fid(9));
    const clear = createAi(fakePorts({ ratings, cqs: new Map([['f-9', 70], ['f-10', 75]]) }));
    expect(clear.chooseCaptains(state, NINTH_OAR, content, 'season-end')).toEqual({ captainId: fid(10), viceCaptainId: fid(9) });
  });

  it('mid-season the AI changes captain only on a vacancy or an injury of 4+ weeks', () => {
    const state = world();
    state.clubs[NINTH_OAR]!.captainId = fid(9);
    const ai = createAi(fakePorts({ ratings, cqs: new Map([['f-9', 40], ['f-10', 90]]) }));
    expect(ai.chooseCaptains(state, NINTH_OAR, content, 'week').captainId).toBe(fid(9));
    state.fighters[fid(9)]!.injury = { severity: 'moderate', weeksOut: 6, fixtureId: null, round: null, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 1 } };
    expect(ai.chooseCaptains(state, NINTH_OAR, content, 'week').captainId).toBe(fid(10));
    state.clubs[NINTH_OAR]!.captainId = null;
    state.fighters[fid(9)]!.injury = null;
    expect(ai.chooseCaptains(state, NINTH_OAR, content, 'week').captainId).toBe(fid(10));
  });
});

describe('training emphasis (03 §5.2, D-A)', () => {
  it('follows the first matching rule', () => {
    const state = world();
    const f = state.fighters[fid(9)]!;
    expect(emphasisFor({ ...f, traits: [{ id: asId('wandering_mind'), gainedSeason: 1, source: 'rolled' }] }, content)).toBe('mind');
    expect(emphasisFor({ ...f, dev100: { physical: 2800, mental: 0 } }, content)).toBe('mind');
    const physicalClass = state.fighters[fid(12)]!; // oathguard: rating weights mostly physical
    expect(emphasisFor({ ...physicalClass, dev100: { physical: 2000, mental: 2000 } }, content)).toBe('body');
  });
});

describe('valueFighter and planWeek', () => {
  it('adds the need bonus for a missing role family and the starter bonus', () => {
    const state = world();
    const ai = createAi(fakePorts());
    const fa = Object.values(state.fighters).find((f) => f.status === 'free-agent')!;
    const v = ai.valueFighter(state, NINTH_OAR, fa.id, content);
    const ha = Math.trunc((fa.age * 80) / content.races.require(fa.raceId).lifespan);
    expect(v).toBeGreaterThanOrEqual(50 - Math.max(0, ha - 31) * 2);
    expect(Number.isInteger(v)).toBe(true);
  });

  it('le-026: no offer when the wage room under wageUse is below the cheapest ask', () => {
    const state = world();
    const club = state.clubs[NINTH_OAR]!;
    club.aiPersonalityId = asId<AiPersonalityId>('thrifty');
    club.finance.wageBudgetPerWeek = 1138;
    const bill = rosterIds(state, NINTH_OAR).length;
    for (const id of rosterIds(state, NINTH_OAR)) state.fighters[id]!.contract!.wagePerWeek = Math.trunc(950 / bill);
    const ratings = new Map(Object.values(state.fighters).filter((f) => f.status === 'free-agent').map((f) => [f.id, 90] as const));
    const offers = createAi(fakePorts({ ratings, ask: () => 60 })).planWeek(state, NINTH_OAR, content).filter((c) => c.type === 'offer.make');
    expect(offers).toEqual([]);
    // With room, the same club bids for the best value.
    club.finance.wageBudgetPerWeek = 3000;
    const some = createAi(fakePorts({ ratings, ask: () => 60 })).planWeek(state, NINTH_OAR, content).filter((c) => c.type === 'offer.make');
    expect(some.length).toBeGreaterThan(0);
    expect(some.length).toBeLessThanOrEqual(content.aiPersonalities.require('thrifty').maxNewOffersPerWeek);
  });

  it('never reads another club\'s pending offers (the player\'s offers do not change the plan)', () => {
    const state = world();
    const ratings = new Map(Object.values(state.fighters).filter((f) => f.status === 'free-agent').map((f) => [f.id, 90] as const));
    const ai = createAi(fakePorts({ ratings }));
    const plan = ai.planWeek(state, NINTH_OAR, content);
    const withPlayerOffers = cloneJson(state);
    for (const f of Object.values(withPlayerOffers.fighters).filter((x) => x.status === 'free-agent')) {
      withPlayerOffers.market.offers.push({ clubId: state.playerClubId!, fighterId: f.id, wagePerWeek: 999, seasons: 2, madeAt: { season: 1, weekIndex: 1 }, isCounterAcceptance: false });
    }
    expect(ai.planWeek(withPlayerOffers, NINTH_OAR, content)).toEqual(plan);
  });

  it('renews expiring fighters only from the renewal week on', () => {
    const state = world();
    const ai = createAi(fakePorts());
    const renewals = (s: GameState): Command[] => ai.planWeek(s, NINTH_OAR, content).filter((c) => c.type === 'contract.renew');
    expect(renewals(state)).toEqual([]);
    const mw4 = content.weeks.require(content.economy.ai.renewalWeeksFrom);
    state.calendar = { season: 1, weekIndex: mw4.index, weekId: asId<WeekId>(mw4.id), phase: mw4.phase };
    const expiring = rosterIds(state, NINTH_OAR).filter((id) => state.fighters[id]!.contract!.endSeason === 1);
    expect(expiring.length).toBeGreaterThan(0);
    expect(renewals(state).map((c) => (c as { fighterId: FighterId }).fighterId).sort()).toEqual([...expiring].sort());
  });

  it('cap relief: an over-cap club releases its lowest-value fighters in preseason', () => {
    const state = world();
    const cap = content.tiers.require(state.clubs[NINTH_OAR]!.tierId).rosterCap;
    const extra = Object.values(state.fighters).filter((f: Fighter) => f.status === 'free-agent').slice(0, cap - 8 + 2);
    for (const f of extra) {
      f.clubId = NINTH_OAR;
      f.status = 'active';
      f.freeAgency = null;
      f.contract = { clubId: NINTH_OAR, wagePerWeek: 100, startSeason: 1, endSeason: 2, signedAt: { season: 1, weekIndex: 1 }, dropClauseApplied: false };
    }
    const ratings = new Map(extra.map((f) => [f.id, 10] as const));
    const releases = createAi(fakePorts({ ratings })).planWeek(state, NINTH_OAR, content).filter((c) => c.type === 'roster.release');
    expect(releases).toHaveLength(2);
    for (const r of releases) expect(extra.map((f) => f.id)).toContain((r as { fighterId: FighterId }).fighterId);
  });

  it('every command names the acting club', () => {
    const state = world();
    const plan = createAi(fakePorts()).planSeasonEnd(state, NINTH_OAR, content);
    for (const c of plan) expect((c as { clubId?: ClubId }).clubId).toBe(NINTH_OAR);
  });
});
