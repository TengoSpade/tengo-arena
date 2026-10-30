/**
 * Round XP (dev-006), the M1 whole-match path with M1.1 bench XP, and aging (wear per race, D-B).
 * M1.1 retired dev-001, dev-003 to dev-005, dev-008 to dev-010 (season-end development and the
 * trend); levels and offers are in progression.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent, makeFixtureFighter } from '../testkit';
import type { ClassId, ClubId, FighterId, GameState, PaceId, RaceId, StatId, TraitId } from '../model';
import { applyMatchLifecycle, effectiveStats, seasonEndDevelopment, trend, usageBpOf } from './index';
import { applySeasonWear, seasonWear100 } from './development';
import { roundXp } from './match';
import { tables } from './tables';
import { makeResult, withStats } from './testing';

const content = fixtureContent();
const t = tables(content);
const fighter = (race: string, age: number, extra = {}) =>
  makeFixtureFighter(1, content, { raceId: race as RaceId, classId: 'oathguard' as ClassId, age, paceId: 'steady' as PaceId, ...extra });

describe('round XP (dev-006)', () => {
  it('round started, side won, 1 down credited, survived: 15; Reckoning 18; Glory-Hungry league 17', () => {
    const f = fighter('human', 25);
    expect(roundXp(f, content, { won: true, credits: 1, downed: false }, false)).toBe(15);
    expect(roundXp(f, content, { won: true, credits: 1, downed: false }, true)).toBe(18);
    const g = { ...f, traits: [{ id: 'glory_hungry' as TraitId, gainedSeason: 1, source: 'rolled' as const }] };
    expect(roundXp(g, content, { won: true, credits: 1, downed: false }, false)).toBe(17);
    expect(roundXp(f, content, { won: true, credits: 5, downed: false }, false)).toBe(16); // max 16
    expect(roundXp(f, content, { won: true, credits: 5, downed: false }, true)).toBe(20); // max 20
  });
  it('the M1 whole-match path credits downs per round, fills the level bar, and pays the bench ⅓ of a lineup slot (T004)', () => {
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
    expect(s.fighters[home[0]!]!.season.roundXp).toBe(29);
    // clubMatchXp = 5 × (14 + 14) + 1 credit = 141 -> floor(141 × 0.3333 ÷ 5) = 9.
    expect(s.fighters[bench.id]!.season.benchXp).toBe(9);
    expect(s.fighters[bench.id]!.season.roundXp).toBe(0);
    expect(s.fighters[home[0]!]!.season.roundsStarted).toBe(2);
    expect(s.fighters[home[0]!]!.career.downsInflicted).toBe(1);
  });
  it('retirement usage reads round XP only (bench XP does not count)', () => {
    expect(usageBpOf(260, content)).toBe(7222);
    expect(usageBpOf(520, content)).toBe(10_000);
    expect(usageBpOf(0, content)).toBe(0);
  });
});

describe('aging per race (O11, D-B)', () => {
  const wear = (race: string, age: number, extra = {}) => {
    const f = fighter(race, age, extra);
    return { physical: seasonWear100(f, content, 'physical'), mental: seasonWear100(f, content, 'mental') };
  };
  it('age-001: human-age 31 -> the first physical step on every physical stat (Stamina included), mental 0', () => {
    const f = withStats(fighter('human', 31), content, {});
    const d = applySeasonWear(f, content);
    expect(d.wearPhysical).toBe(Math.round(content.development.decline.physicalPerHumanYear.find(([y]) => y === 31)![1] * 100));
    expect(d.wearMental).toBe(0);
    for (const id of t.physicalIds) expect(f.wear100[id]).toBe(d.wearPhysical);
    expect(t.physicalIds).toContain('stamina');
  });
  it('age-002: Weathers Well looks up two human-years earlier (31 -> 29 -> 0)', () => {
    expect(wear('human', 31, { traits: [{ id: 'weathers_well' as TraitId, gainedSeason: 1, source: 'rolled' }] }).physical).toBe(0);
  });
  it('age-003: dwarf aged 54 (human-age 60.0): mental wear 0.1 × 1.111 = 0.11', () => {
    expect(wear('dwarf', 54).mental).toBe(11);
  });
  it('physical decline starts at human-age 31: human 31, elf 47, dwarf 28, orc 25, Ashkin 21', () => {
    const expected: Record<string, number> = { human: 31, elf: 47, dwarf: 28, orc: 25, ashkin: 21 };
    for (const [race, age] of Object.entries(expected)) {
      expect(wear(race, age - 1).physical).toBe(0);
      expect(wear(race, age).physical).toBeGreaterThan(0);
    }
  });
  it('mental decline starts at human-age 60, scaled by lifespan: human 60, elf 90, dwarf 54, orc 48, Ashkin 39', () => {
    const expected: Record<string, number> = { human: 60, elf: 90, dwarf: 54, orc: 48, ashkin: 39 };
    for (const [race, age] of Object.entries(expected)) {
      expect(wear(race, age - 1).mental).toBe(0);
      expect(wear(race, age).mental).toBeGreaterThan(0);
    }
  });
});

describe('season-end Aging on a world (life-002; progression.md step 6)', () => {
  it('uses the age held during the season, then +1; no growth; history row; counters reset', () => {
    const s: GameState = buildFixtureWorld({ clubLimit: 1 });
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    const id = Object.keys(s.fighters)[0] as FighterId;
    const f = s.fighters[id]!;
    f.raceId = 'human' as RaceId;
    f.age = 30;
    f.season.xp = 450;
    f.season.roundXp = 400;
    f.season.benchXp = 50;
    const before = { ...f.train100 };
    const dev = { ...f.dev100 };
    seasonEndDevelopment(s, content);
    const g = s.fighters[id]!;
    expect(g.age).toBe(31);
    for (const sid of t.physicalIds) expect(g.wear100[sid]).toBe(0);
    expect(g.train100).toEqual(before); // no season-end growth
    expect(g.dev100).toEqual(dev); // clocks frozen
    expect(g.history).toHaveLength(1);
    expect(g.history[0]!.age).toBe(30);
    expect(g.history[0]!.usageBp).toBe(10_000);
    expect(g.history[0]!.benchXp).toBe(50);
    expect(g.season.xp).toBe(0);
    expect(effectiveStats(g, content)['stamina' as StatId]).toBeGreaterThan(0);
  });
  it('the trend is retired (always holding)', () => {
    expect(trend(fighter('human', 18), content)).toBe('holding');
  });
});
