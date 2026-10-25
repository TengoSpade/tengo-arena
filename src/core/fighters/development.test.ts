import { describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent, makeFixtureFighter } from '../testkit';
import type { ClassId, ClubId, FighterId, GameState, PaceId, RaceId, StatId, TraitId } from '../model';
import { applyMatchLifecycle, effectiveStats, seasonEndDevelopment, trend, usageBpOf } from './index';
import { clockDelta100, developSeason, emphasisMults, type DevelopmentInputs } from './development';
import { roundXp } from './match';
import { tables } from './tables';
import { makeResult, withStats } from './testing';

const content = fixtureContent();
const t = tables(content);
const full: DevelopmentInputs = { seasonXp: 360, mentor: 1, emphasisWeeks: { balanced: 23, body: 0, mind: 0 }, trainingEnabled: true };
const none: DevelopmentInputs = { ...full, seasonXp: 0 };
const fighter = (race: string, age: number, extra = {}) =>
  makeFixtureFighter(1, content, { raceId: race as RaceId, classId: 'oathguard' as ClassId, age, paceId: 'steady' as PaceId, ...extra });

describe('XP (dev-006)', () => {
  it('round started, side won, 1 down credited, survived: 15; Reckoning 18; Glory-Hungry league 17', () => {
    const f = fighter('human', 25);
    expect(roundXp(f, content, { won: true, credits: 1, downed: false }, false)).toBe(15);
    expect(roundXp(f, content, { won: true, credits: 1, downed: false }, true)).toBe(18);
    const g = { ...f, traits: [{ id: 'glory_hungry' as TraitId, gainedSeason: 1, source: 'rolled' as const }] };
    expect(roundXp(g, content, { won: true, credits: 1, downed: false }, false)).toBe(17);
    expect(roundXp(f, content, { won: true, credits: 5, downed: false }, false)).toBe(16); // max 16
    expect(roundXp(f, content, { won: true, credits: 5, downed: false }, true)).toBe(20); // max 20
  });
  it('applyMatchLifecycle credits downs per round and pays only fighters who started (O3)', () => {
    const s = buildFixtureWorld({ clubLimit: 2 });
    const [a, b] = Object.keys(s.clubs) as ClubId[];
    const home = s.clubs[a!]!.lineup.fighters.map((e) => e.fighterId);
    const away = s.clubs[b!]!.lineup.fighters.map((e) => e.fighterId);
    const bench = Object.values(s.fighters).find((f) => f.clubId === a && !home.includes(f.id))!;
    const r = makeResult(s, content, {
      homeClubId: a!,
      awayClubId: b!,
      home,
      away,
      rounds: [{ winner: 'home' }, { winner: 'home' }],
      perRound: { [away[0]!]: [{ downed: true, damage: 100, maxHp: 1000, byFighterId: home[0]! }, {}] },
    });
    const out = applyMatchLifecycle(s, r, content);
    expect(out.xp[home[0]!]).toBe(15 + 14); // round 1: 10 + 3 + 1 + 1; round 2: 10 + 3 + 1
    expect(out.xp[away[0]!]).toBe(10 + 11); // downed in round 1 (no survive bonus), survived round 2
    expect(out.xp[bench.id]).toBeUndefined();
    expect(s.fighters[bench.id]!.season.xp).toBe(0);
    expect(s.fighters[home[0]!]!.season.roundsStarted).toBe(2);
    expect(s.fighters[home[0]!]!.career.downsInflicted).toBe(1);
  });
});

describe('usage and clocks (D-A)', () => {
  it('dev-001: 0 rounds started → usage 0 → ΔD 0 on both clocks; wear and age still apply', () => {
    const f = withStats(fighter('human', 33), content, { str: 16 });
    f.dev100 = { physical: 2000, mental: 2000 };
    const d = developSeason(f, content, none);
    expect(d.usageBp).toBe(0);
    expect(d.dPhysical).toBe(0);
    expect(d.dMental).toBe(0);
    expect(f.wear100['str' as StatId]).toBe(50); // human-age 33 → 0.5
  });
  it('dev-003: D 18 → 19 at full usage; STR 960 → 1,040', () => {
    const f = withStats(fighter('human', 18), content, { str: 16 });
    f.dev100 = { physical: 1800, mental: 1800 };
    expect(effectiveStats(f, content)['str' as StatId]).toBe(9);
    developSeason(f, content, full);
    expect(f.dev100.physical).toBe(1900);
    expect(effectiveStats(f, content)['str' as StatId]).toBe(10);
  });
  it('dev-004: no growth past the cap', () => {
    const f = withStats(fighter('human', 30), content, { str: 16 });
    f.dev100 = { physical: 2900, mental: 2900 };
    developSeason(f, content, full);
    expect(effectiveStats(f, content)['str' as StatId]).toBe(16);
  });
  it('dev-005: orc at human-age 21, Early Spark, Rapid → ΔD 2.13; with Burns Fast 2.34 (under the 2.5 cap)', () => {
    const f = fighter('orc', 17, { paceId: 'rapid' as PaceId, traits: [{ id: 'early_spark' as TraitId, gainedSeason: 1, source: 'rolled' }] });
    expect(clockDelta100(f, content, 'physical', full)).toBe(213);
    f.traits.push({ id: 'burns_fast' as TraitId, gainedSeason: 1, source: 'rolled' });
    expect(clockDelta100(f, content, 'physical', full)).toBe(234);
  });
  it('ΔD is capped at 2.5 per season and D at human-age + 4', () => {
    const f = fighter('ashkin', 16, { paceId: 'rapid' as PaceId, traits: [{ id: 'early_spark' as TraitId, gainedSeason: 1, source: 'rolled' }] });
    expect(clockDelta100(f, content, 'physical', { ...full, mentor: 1.15 })).toBeLessThanOrEqual(250);
    f.dev100 = { physical: 2800, mental: 2800 }; // human-age 24.61 + 4 = 28.61
    developSeason(f, content, full);
    expect(f.dev100.physical).toBeLessThanOrEqual(2461 + 400);
  });
  it('dev-009: usage is concave in XP (split rounds beat concentration)', () => {
    expect(usageBpOf(260, content)).toBe(7222);
    expect(usageBpOf(520, content)).toBe(10_000);
    expect(usageBpOf(260, content) * 2).toBeGreaterThan(usageBpOf(520, content) + usageBpOf(0, content));
  });
});

describe('training emphasis routes earned growth only (D-A, dev-010)', () => {
  it('human under Body all season: physical 1.30, mental 0.70; Regimented clamps a at 2: 1.40 / 0.60', () => {
    const f = fighter('human', 20);
    const body = { balanced: 0, body: 23, mind: 0 };
    const m = emphasisMults(f, content, body, true);
    expect(m.physical).toBeCloseTo(1.3, 10);
    expect(m.mental).toBeCloseTo(0.7, 10);
    expect(m.physical + m.mental).toBeCloseTo(2, 10);
    expect(m.wear).toBe(1);
    const r = { ...f, traits: [{ id: 'regimented' as TraitId, gainedSeason: 1, source: 'rolled' as const }] };
    const m2 = emphasisMults(r, content, body, true);
    expect(m2.physical).toBeCloseTo(1.4, 10);
    expect(m2.mental).toBeCloseTo(0.6, 10);
  });
  it('total growth is unchanged by the emphasis (equal growth multipliers); with no XP there is nothing to route', () => {
    const f = fighter('human', 18);
    const bal = clockDelta100(f, content, 'physical', full) + clockDelta100(f, content, 'mental', full);
    const body: DevelopmentInputs = { ...full, emphasisWeeks: { balanced: 0, body: 23, mind: 0 } };
    const routed = clockDelta100(f, content, 'physical', body) + clockDelta100(f, content, 'mental', body);
    expect(Math.abs(routed - bal)).toBeLessThanOrEqual(1);
    expect(clockDelta100(f, content, 'physical', { ...body, seasonXp: 0 })).toBe(0);
    expect(clockDelta100(f, content, 'physical', body)).toBeGreaterThan(clockDelta100(f, content, 'physical', full));
    const set = { ...f, traits: [{ id: 'set_in_ways' as TraitId, gainedSeason: 1, source: 'rolled' as const }] };
    expect(emphasisMults(set, content, body.emphasisWeeks, true).physical).toBe(1);
  });
  it('disabled emphasis equals all Balanced (dev-007 at unit level)', () => {
    const f = fighter('human', 20);
    expect(emphasisMults(f, content, { balanced: 0, body: 23, mind: 0 }, false)).toEqual(emphasisMults(f, content, { balanced: 23, body: 0, mind: 0 }, true));
  });
});

describe('aging per race (O11, D-B)', () => {
  it('age-001: human-age 31 → +0.3 wear on physical stats, mental 0', () => {
    const f = fighter('human', 31);
    const d = developSeason(f, content, full);
    expect(d.wearPhysical).toBe(30);
    expect(d.wearMental).toBe(0);
  });
  it('age-002: Weathers Well looks up two human-years earlier (31 → 29 → 0)', () => {
    const f = fighter('human', 31, { traits: [{ id: 'weathers_well' as TraitId, gainedSeason: 1, source: 'rolled' }] });
    expect(developSeason(f, content, full).wearPhysical).toBe(0);
  });
  it('age-003: dwarf aged 54 (human-age 60.0): mental wear 0.1 × 1.111 = 0.11', () => {
    const f = fighter('dwarf', 54);
    expect(developSeason(f, content, full).wearMental).toBe(11);
  });
  it('physical decline starts at human-age 31: human 31, elf 47, dwarf 28, orc 25, Ashkin 21', () => {
    const expected: Record<string, number> = { human: 31, elf: 47, dwarf: 28, orc: 25, ashkin: 21 };
    for (const [race, age] of Object.entries(expected)) {
      expect(developSeason(fighter(race, age - 1), content, full).wearPhysical).toBe(0);
      expect(developSeason(fighter(race, age), content, full).wearPhysical).toBeGreaterThan(0);
    }
  });
  it('mental decline starts at human-age 60, scaled by lifespan: human 60, elf 90, dwarf 54, orc 48, Ashkin 39', () => {
    const expected: Record<string, number> = { human: 60, elf: 90, dwarf: 54, orc: 48, ashkin: 39 };
    for (const [race, age] of Object.entries(expected)) {
      expect(developSeason(fighter(race, age - 1), content, full).wearMental).toBe(0);
      expect(developSeason(fighter(race, age), content, full).wearMental).toBeGreaterThan(0);
    }
  });
  it('the physical peak scales with lifespan: human 28 and elf 42 share human-age 28.0 and the same maturity', () => {
    const h = withStats(fighter('human', 28), content, { str: 16 });
    const e = withStats(fighter('elf', 42), content, { str: 16 });
    const dh = developSeason(h, content, full);
    const de = developSeason(e, content, full);
    expect(dh.wearPhysical).toBe(0);
    expect(de.wearPhysical).toBe(0);
    expect(effectiveStats(h, content)['str' as StatId]).toBe(16);
    expect(effectiveStats(e, content)['str' as StatId]).toBe(16);
  });
  it('a long-lived race takes 1.5x the seasons per phase: elf ΔD is 2/3 of a human ΔD', () => {
    const h = fighter('human', 20);
    const e = fighter('elf', 30);
    expect(clockDelta100(h, content, 'physical', full)).toBe(100);
    expect(clockDelta100(e, content, 'physical', full)).toBe(66);
  });
});

describe('season-end development on a world (life-002)', () => {
  it('uses the age held during the season, then +1, writes a history row and resets counters', () => {
    const s: GameState = buildFixtureWorld({ clubLimit: 1 });
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    const id = Object.keys(s.fighters)[0] as FighterId;
    const f = s.fighters[id]!;
    f.raceId = 'human' as RaceId;
    f.age = 30;
    f.season.xp = 400;
    seasonEndDevelopment(s, content);
    const g = s.fighters[id]!;
    expect(g.age).toBe(31);
    for (const sid of t.physicalIds) expect(g.wear100[sid]).toBe(0);
    expect(g.history).toHaveLength(1);
    expect(g.history[0]!.age).toBe(30);
    expect(g.history[0]!.usageBp).toBe(10_000);
    expect(g.season.xp).toBe(0);
  });
});

describe('trend (dev-008)', () => {
  it('projects the XP rate to season end and labels the rating change', () => {
    const f = withStats(fighter('human', 18), content, { str: 16, agi: 16, pac: 16, tgh: 16, pre: 16, wil: 16, cmp: 16, awr: 16, dis: 16 });
    f.dev100 = { physical: 1800, mental: 1800 };
    f.season.emphasisWeeks = { balanced: 11, body: 0, mind: 0 }; // P1-P4 + MW1-MW7
    f.season.xp = 0;
    expect(['slipping', 'holding']).toContain(trend(f, content));
    f.season.xp = 200;
    expect(trend(f, content)).toBe('surging');
  });
});
