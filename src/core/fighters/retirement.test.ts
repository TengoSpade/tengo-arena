import { describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent, makeFixtureFighter } from '../testkit';
import type { ClassId, ClubId, Fighter, FighterId, GameState, RaceId, RetirementRecord, StatId, TraitId, WeekId } from '../model';
import {
  CAREER_ENDING_WEEKS,
  announceFinalSeasons,
  generateRookies,
  rating,
  retirementChanceBp,
  rookieCount,
  seasonEndDevelopment,
  seasonEndRetirements,
} from './index';
import { retirementChanceWith } from './retirement';
import { tables } from './tables';

const content = fixtureContent();
const contract = (endSeason: number, clubId = 'c' as ClubId) => ({ clubId, wagePerWeek: 100, startSeason: 1, endSeason, signedAt: { season: 1, weekIndex: 1 }, dropClauseApplied: false });
const vet = (race: string, age: number, extra: Partial<Fighter> = {}): Fighter =>
  makeFixtureFighter(1, content, { raceId: race as RaceId, classId: 'oathguard' as ClassId, age, ...extra });
const chance = (f: Fighter, usageBp = 6000, season = 1) => retirementChanceWith(f, content, { age: f.age, usageBp, season, enabled: true });

/** Set the career peak `drop` points above the current rating. */
function withDrop(f: Fighter, drop: number): Fighter {
  f.career.peakRating = rating(f, content) + drop;
  return f;
}

describe('retirement chance (D-T: effectiveness, not a fixed age)', () => {
  it('precomputes the age hazard 1 − (1 − h)^k per race on the human-years past the physical peak (30)', () => {
    const t = tables(content);
    expect(t.ageHazardBp.get('human')![41]).toBe(80); // 11 years past: 0.8%
    expect(t.ageHazardBp.get('human')![50]).toBe(300);
    expect(t.ageHazardBp.get('elf')![41]).toBe(53); // k = 80 / 120
    expect(t.ageHazardBp.get('dwarf')![55]).toBe(1979); // k = 80 / 72
  });
  it('a fighter still at his peak rating plays on at human-age 45; 16 points below it he retires far more often', () => {
    const f = vet('human', 45, { classId: 'chirurgeon' as ClassId, contract: contract(3) });
    expect(chance(withDrop(f, 0))).toBe(90); // 1.5% age hazard × 0.6 (contract running)
    expect(chance(withDrop(f, 16))).toBe(1212); // 1 − (1 − 0.19)(1 − 0.015) = 20.2%, × 0.6
  });
  it('worked example: dwarf 32 at his peak, usage 0.6, expiring contract, 1 scar → 3.3%', () => {
    const f = vet('dwarf', 32, { contract: contract(1), traits: [{ id: 'stiff_shoulder' as TraitId, gainedSeason: 1, source: 'scar' }] });
    expect(chance(withDrop(f, 0))).toBe(333); // 0.22% age hazard × 1.5 + 3 points per scar
  });
  it('modifiers: usage ≥ 0.75 ×0.8, ≤ 0.30 ×1.5, contract running ×0.6, traits; heavy wear adds nothing (the rating drop carries it)', () => {
    const f = withDrop(vet('human', 34, { contract: contract(3) }), 12);
    const base = 10_000 - ((10_000 - 800) * (10_000 - 20)) / 10_000; // drop 12: 8%; 4 years past the peak: 0.2%
    expect(chance(f, 10_000)).toBe(Math.trunc(base * 0.8 * 0.6));
    expect(chance(f, 2000)).toBe(Math.trunc(base * 1.5 * 0.6));
    expect(chance(f, 6000)).toBe(491);
    const g = { ...f, traits: [{ id: 'glory_hungry' as TraitId, gainedSeason: 1, source: 'rolled' as const }] };
    expect(chance(g, 6000)).toBe(Math.trunc(base * 0.6 * 0.8));
    const worn = { ...f, wear100: { ...f.wear100 } };
    for (const id of tables(content).physicalIds) worn.wear100[id as StatId] = 240;
    expect(retirementChanceWith(worn, content, { age: 34, usageBp: 6000, season: 1, enabled: true }) - chance(withDrop(worn, f.career.peakRating - rating(worn, content)), 6000)).toBe(0);
  });
  it('ret-001: below human-age 31 the chance is 0 (elf 46 = 30.67)', () => {
    expect(chance(vet('elf', 46))).toBe(0);
    expect(chance(vet('elf', 47))).toBeGreaterThan(0);
  });
  it('ret-002: human-age 58 retires for certain (race-scaled); disabled retirement keeps only career-ending', () => {
    expect(chance(vet('human', 58))).toBe(10_000);
    expect(chance(vet('orc', 47))).toBe(10_000); // 58.75
    expect(chance(vet('human', 57))).toBeLessThan(10_000);
    expect(chance(vet('human', 41))).toBeLessThan(1000); // the old fixed cap is gone
    const f = vet('human', 38);
    expect(retirementChanceWith(f, content, { age: 38, usageBp: 0, season: 1, enabled: false })).toBe(0);
    const ce = { ...f, injury: { severity: 'serious' as const, weeksOut: CAREER_ENDING_WEEKS, fixtureId: null, round: 1, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 10 } } };
    expect(retirementChanceWith(ce, content, { age: 38, usageBp: 0, season: 1, enabled: false })).toBe(10_000);
  });
});

function world(): GameState {
  const s = buildFixtureWorld();
  const w = content.weekByIndex(1);
  s.calendar = { season: 1, weekIndex: 1, weekId: w.id as WeekId, phase: w.phase };
  return s;
}

describe('final season and season-end retirements', () => {
  it('ret-003: P1 chance ≥ 60% with usage 1.0 announces a final season; it retires at season end without a roll', () => {
    const s = world();
    const id = Object.keys(s.fighters)[0] as FighterId;
    const f = s.fighters[id]!;
    Object.assign(f, { raceId: 'human', age: 39, contract: contract(1, f.clubId!) });
    withDrop(f, 30); // far below his peak (D-T): the chance with usage 1.0 is above 60%
    expect(retirementChanceBp(s, id, content)).toBeGreaterThan(0);
    const news = announceFinalSeasons(s, content);
    expect(s.fighters[id]!.finalSeason).toBe(true);
    expect(s.fighters[id]!.statuses.some((x) => x.id === 'final_season')).toBe(true);
    expect(news.length).toBeGreaterThan(0);
    // final_season status: +1 composure
    // the chance "falls" (renewed long contract) — still retires
    s.fighters[id]!.contract = contract(5, f.clubId!);
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    s.history.push({ season: 1, tiers: [], retirements: [], rookieIds: [] });
    seasonEndDevelopment(s, content);
    const retired = seasonEndRetirements(s, content);
    const rec = retired.find((r) => r.fighterId === id)!;
    expect(rec.cause).toBe('age');
    expect(rec.age).toBe(39);
    expect(s.fighters[id]!.status).toBe('retired');
    expect(s.fighters[id]!.clubId).toBeNull();
    expect(s.fighters[id]!.contract).toBeNull();
    expect(s.history[0]!.retirements.some((r) => r.fighterId === id)).toBe(true);
  });
  it('ret-004: a career-ending injury retires at season end, not rolled', () => {
    const s = world();
    const id = Object.keys(s.fighters)[1] as FighterId;
    Object.assign(s.fighters[id]!, { age: 22, injury: { severity: 'serious', weeksOut: CAREER_ENDING_WEEKS, fixtureId: null, round: 1, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 14 } } });
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    seasonEndDevelopment(s, content);
    const retired = seasonEndRetirements(s, content);
    expect(retired.find((r) => r.fighterId === id)?.cause).toBe('career-ending-injury');
  });
  it('young fighters never retire; the roll uses the pre-increment age', () => {
    const s = world();
    for (const f of Object.values(s.fighters)) Object.assign(f, { raceId: 'human', age: 30 });
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    seasonEndDevelopment(s, content); // ages become 31
    expect(seasonEndRetirements(s, content)).toHaveLength(0);
  });
});

describe('rookie intake (D-H)', () => {
  const rec = (n: number, cause: RetirementRecord['cause']): RetirementRecord[] =>
    Array.from({ length: n }, (_, i) => ({ fighterId: `f-${9000 + i}` as FighterId, age: 30, lastClubId: null, proSeasons: 5, peakRating: 60, cause }));
  it('intake-001: 48 clubs, 40 retirements + 1 career-ending, 6 leavers → 70 rookies (within 24-77)', () => {
    const s = world();
    expect(Object.keys(s.clubs)).toHaveLength(48);
    s.history.push({ season: 1, tiers: [], retirements: [...rec(40, 'age'), ...rec(1, 'career-ending-injury'), ...rec(6, 'left-unsigned')], rookieIds: [] });
    expect(rookieCount(s, content)).toBe(70);
    s.history[0]!.retirements.push(...rec(30, 'age'));
    expect(rookieCount(s, content)).toBe(77);
    s.history[0]!.retirements = [];
    expect(rookieCount(s, content)).toBe(29);
  });
  it('ret-005: leavers are not counted; rookies are generated as free agents and recorded', () => {
    const s = world();
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    s.history.push({ season: 1, tiers: [], retirements: rec(6, 'left-unsigned'), rookieIds: [] });
    const ids = generateRookies(s, content);
    expect(ids).toHaveLength(29);
    expect(s.history[0]!.rookieIds).toEqual(ids);
    for (const id of ids) {
      const f = s.fighters[id]!;
      expect(f.status).toBe('free-agent');
      expect(f.clubId).toBeNull();
      expect(f.debutSeason).toBe(2);
      expect(f.career.proSeasons).toBe(0);
    }
  });
});
