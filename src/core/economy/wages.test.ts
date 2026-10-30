import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asId, type ClubId, type FighterId, type TraitId } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { ask, askDetails, calibreLevel, greedLabel, marketWage, marketWageDetails, preferredLength } from './index';
import { addFighter, addPlayedFixture, resetFighterDoubles, setWeek } from './testing';

vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);

const content = fixtureContent();
const BANNER_P50 = asId<ClubId>('varrow-netcasters');
const MUSTER_P20 = asId<ClubId>('keelwick-bilge-company');
const CROWN_P70 = asId<ClubId>('saltcrag-brinehounds');
const CROWN_P84 = asId<ClubId>('varrow-lanternguard');
const trait = (id: string) => ({ id: asId<TraitId>(id), gainedSeason: 1, source: 'rolled' as const });

function world() {
  const s = buildFixtureWorld({ freeAgents: 0 });
  setWeek(s, content, 1);
  return s;
}

/** EXAMPLE Brannoc: human 23, rating 58, potential 64, Fair greed +400, one positive and one negative trait. */
function brannoc(s = world(), clubId: ClubId | null = null, wage = 360) {
  const f = addFighter(s, content, {
    values: { rating: 58, potential: 64 },
    clubId,
    wage,
    overrides: { age: 23, contractProfile: { greedBp: 400 }, traits: [trait('still_water'), trait('hot_blood')] },
  });
  return { s, f };
}

beforeEach(() => resetFighterDoubles());

describe('market wage (03 sys-contracts)', () => {
  it('Brannoc: EQ 60, curve 355, market wage 355', () => {
    const { s, f } = brannoc();
    const d = marketWageDetails(f, content);
    expect(d.humanAge).toBe(23);
    expect(d.eq).toBe(60);
    expect(d.curve).toBe(355);
    expect(d.traitAdjBp).toBe(0);
    expect(marketWage(s, f.id, content)).toBe(355);
  });

  it('veteran elf aged 50 (human-age 33), rating 70: 635 after -1,200 bp -> 555', () => {
    const s = world();
    const elf = addFighter(s, content, { values: { rating: 70, potential: 70 }, overrides: { age: 50, raceId: asId('elf') } });
    const d = marketWageDetails(elf, content);
    expect(d.humanAge).toBe(33);
    expect(d.ageAdjBp).toBe(-1200);
    expect(d.marketWage).toBe(555);
  });

  it('fan appeal and the trait clamp enter the market wage; role demand is 0 at start', () => {
    const s = world();
    const showman = addFighter(s, content, { values: { rating: 60, potential: 60 }, overrides: { age: 30, traits: [trait('crowd_darling')] } });
    const d = marketWageDetails(showman, content);
    expect(d.traitAdjBp).toBe(150);
    expect(d.fanAppealAdjBp).toBe(300);
    expect(d.roleDemandAdjBp).toBe(0);
    expect(d.marketWage).toBe(370); // floor5(355 × 1.045 = 370.97)
  });
});

describe('asks with every adjustment', () => {
  it('Brannoc asks 360 at a Banner club (p50), 420 at a Muster club (p20), 350 at a Crown club (p70)', () => {
    const { s, f } = brannoc();
    const banner = askDetails(s, f, BANNER_P50, 2, content);
    expect(banner).toMatchObject({ calibreLevel: 2, preferredLength: 2, tierGapBp: 0, prestigeBp: -150, lengthBp: 0, greedBp: 400, totalBp: 250, ask: 360 });
    expect(ask(s, f.id, MUSTER_P20, 2, content)).toBe(420);
    expect(askDetails(s, f, MUSTER_P20, 2, content).tierGapBp).toBe(1500);
    expect(ask(s, f.id, CROWN_P70, 2, content)).toBe(350);
    expect(askDetails(s, f, CROWN_P70, 2, content).tierGapBp).toBe(-500);
  });

  it('length mismatch costs +500 bp per season', () => {
    const { s, f } = brannoc();
    expect(askDetails(s, f, BANNER_P50, 1, content).lengthBp).toBe(500);
    expect(askDetails(s, f, BANNER_P50, 3, content).lengthBp).toBe(500);
  });

  it('trials rookie (human 18, rating 34, potential 66) at a Muster club: market 140, ask 150 for 3 seasons', () => {
    const s = world();
    const r = addFighter(s, content, { values: { rating: 34, potential: 66 }, overrides: { age: 18 } });
    expect(marketWageDetails(r, content).eq).toBe(44);
    expect(marketWage(s, r.id, content)).toBe(140);
    expect(preferredLength(s, r.id, content)).toBe(1);
    expect(ask(s, r.id, MUSTER_P20, 3, content)).toBe(150);
    // The draft lists 135 for length 1; the formula gives the market wage 140 (greed 0). Reported as an open question.
    expect(ask(s, r.id, MUSTER_P20, 1, content)).toBe(140);
  });

  it('veteran elf at a Crown club: 610 for one season, 555 for three (preferred 3)', () => {
    const s = world();
    const elf = addFighter(s, content, { values: { rating: 70, potential: 70 }, overrides: { age: 50, raceId: asId('elf') } });
    expect(ask(s, elf.id, CROWN_P70, 1, content)).toBe(610);
    expect(ask(s, elf.id, CROWN_P70, 3, content)).toBe(555);
  });

  it('star (rating 78, two positive traits, fan appeal 1, Grasping +1,200) at a Crown club with prestige 84: 1,155', () => {
    const s = world();
    const star = addFighter(s, content, {
      values: { rating: 78, potential: 78 },
      overrides: { age: 30, contractProfile: { greedBp: 1200 }, traits: [trait('crowd_darling'), trait('still_water')] },
    });
    expect(marketWage(s, star.id, content)).toBe(1075);
    const d = askDetails(s, star, CROWN_P84, 2, content);
    expect(d.prestigeBp).toBe(-420);
    expect(d.lengthBp).toBe(0);
    expect(d.ask).toBe(1155);
  });

  it('wageDemandMult adds (mult − 1) × 10,000 bp; asks clamp to the tier minimum and the 4,000 maximum', () => {
    const s = world();
    const coins = addFighter(s, content, { values: { rating: 58, potential: 58 }, overrides: { age: 28, traits: [trait('counts_every_coin')] } });
    expect(askDetails(s, coins, BANNER_P50, 2, content).wageDemandBp).toBe(1500);
    const weak = addFighter(s, content, { values: { rating: 5, potential: 5 }, overrides: { age: 28 } });
    expect(ask(s, weak.id, CROWN_P70, 2, content)).toBe(content.tierProfile(1).tierMinWage);
    const great = addFighter(s, content, { values: { rating: 100, potential: 100 }, overrides: { age: 28, contractProfile: { greedBp: 1500 } } });
    expect(ask(s, great.id, MUSTER_P20, 2, content)).toBe(4000);
  });

  it('calibre thresholds 62 / 47 and greed labels with their flex', () => {
    expect([calibreLevel(62, content), calibreLevel(61, content), calibreLevel(47, content), calibreLevel(46, content)]).toEqual([1, 2, 2, 3]);
    expect(greedLabel(-400, content)).toMatchObject({ id: 'modest', flexBp: 1500 });
    expect(greedLabel(400, content)).toMatchObject({ id: 'fair', flexBp: 1000 });
    expect(greedLabel(1200, content)).toMatchObject({ id: 'grasping', flexBp: 500 });
  });
});

describe('renewal situation (le-011)', () => {
  it('started 12 of 14 matches: −500 bp, ask 345 at his Banner club', () => {
    const { s, f } = brannoc(world(), BANNER_P50, 360);
    const opponent = asId<ClubId>('keelwick-tarhands');
    for (let i = 0; i < 14; i++) {
      addPlayedFixture(s, content, {
        weekIndex: 5 + i,
        home: BANNER_P50,
        away: opponent,
        winner: BANNER_P50,
        homeFighters: i < 12 ? [f.id] : ([] as FighterId[]),
      });
    }
    setWeek(s, content, 19);
    const d = askDetails(s, f, BANNER_P50, 2, content);
    expect(d.isRenewal).toBe(true);
    expect(d.situationBp).toBe(-500);
    expect(d.ask).toBe(345);
  });

  it('low usage +1,000, three seasons at the club −300, loyalty −200 per point', () => {
    const { s, f } = brannoc(world(), BANNER_P50, 360);
    addPlayedFixture(s, content, { weekIndex: 5, home: BANNER_P50, away: asId('keelwick-tarhands'), winner: BANNER_P50 });
    f.history = [1, 2, 3].map((season) => ({ season, age: 20, clubId: BANNER_P50, rating: 50, potential: 60, stats: {}, xp: 0, usageBp: 0, injuries: 0, traitsGained: [], traitsLost: [], levelStart: null, levelEnd: null, stamina: null, benchXp: null, tiredRoundStarts: null }));
    f.traits.push(trait('wore_the_armband'));
    setWeek(s, content, 6);
    expect(askDetails(s, f, BANNER_P50, 2, content).situationBp).toBe(1000 - 300 - 200);
    // The same fighter asked by another club gets no situation term.
    expect(askDetails(s, f, MUSTER_P20, 2, content).situationBp).toBe(0);
  });
});
