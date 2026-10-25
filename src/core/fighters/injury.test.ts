import { describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent, makeFixtureFighter } from '../testkit';
import type { ClassId, ClubId, Fighter, FighterId, GameState, RaceId, TraitId, WeekId } from '../model';
import { Rng, STREAM } from '../rng';
import { CAREER_ENDING_WEEKS, applyMatchLifecycle, injuryChanceBp, isAtRisk, isFit, offseasonRecovery, pronenessLabel, weeklyLifecycle } from './index';
import { careerEndingChancePerMatchBp, careerEndingGivenSeriousBp, roundInjuryChanceBp, scarChanceBp, severityWeights, weeksOutFor } from './injury';
import { bp } from './fixed';
import { makeResult, withStats } from './testing';

const content = fixtureContent();
const make = (race: string, age: number, stats: Record<string, number> = {}, extra: Partial<Fighter> = {}): Fighter =>
  ({ ...withStats(makeFixtureFighter(1, content, { raceId: race as RaceId, classId: 'oathguard' as ClassId, age }), content, stats), ...extra });

function at(s: GameState, weekIndex: number, season = s.calendar.season): void {
  const w = content.weekByIndex(weekIndex);
  s.calendar = { season, weekIndex, weekId: w.id as WeekId, phase: w.phase };
}

describe('per-round injury chance', () => {
  it('inj-007: human tgh 10, downed, 110% of max HP, human-age 27 → 324 bp', () => {
    expect(roundInjuryChanceBp(make('human', 27), content, { damageRatioBp: 11_000, downed: true })).toBe(324);
  });
  it('worked example: elf aged 50 (33.3), tgh 8, downed at 120% → 5.81%; severity 51/24/17/8; 15 weeks; scar 39%', () => {
    const f = make('elf', 50, { tgh: 8 });
    expect(roundInjuryChanceBp(f, content, { damageRatioBp: 12_000, downed: true })).toBe(580);
    const w = severityWeights(f, content, { damageRatioBp: 12_000, downed: true });
    expect([w.knock, w.minor, w.moderate, w.serious]).toEqual([bp(51), bp(24), bp(17), bp(8)]);
    expect(weeksOutFor(f, 'serious', 11, content)).toBe(15);
    expect(scarChanceBp(f, 'serious', content)).toBe(3900);
    expect(isAtRisk(f, content)).toBe(false);
  });
  it('inj-005: elf at human-age 35, serious, 11 base weeks → 11 × 1.2 × 1.30 = 17 weeks', () => {
    expect(weeksOutFor(make('elf', 53), 'serious', 11, content)).toBe(17);
    expect(weeksOutFor(make('human', 25), 'knock', 1, content)).toBe(1);
  });
  it('durability is clamped 0.6-1.4, the chance is capped at 15%, Still tender multiplies by 1.25', () => {
    const tough = make('human', 25, { tgh: 20 });
    const frail = make('human', 25, { tgh: 1 });
    expect(roundInjuryChanceBp(tough, content, { damageRatioBp: 10_000, downed: true })).toBe(Math.trunc((40 + 140 + 130) * 0.6));
    expect(roundInjuryChanceBp(frail, content, { damageRatioBp: 10_000, downed: true })).toBe(Math.trunc((40 + 140 + 130) * 1.4));
    const elf = make('elf', 70, { tgh: 1 }, { traits: [{ id: 'hollow_bones' as TraitId, gainedSeason: 1, source: 'rolled' }], statuses: [{ id: 'still_tender', remainingWeeks: null, remainingMatches: 2, since: { season: 1, weekIndex: 1 } }] });
    expect(roundInjuryChanceBp(elf, content, { damageRatioBp: 50_000, downed: true })).toBe(1500);
    const tender = make('human', 27, {}, { statuses: [{ id: 'still_tender', remainingWeeks: null, remainingMatches: 2, since: { season: 1, weekIndex: 1 } }] });
    expect(roundInjuryChanceBp(tender, content, { damageRatioBp: 11_000, downed: true })).toBe(405);
  });
  it('long-lived races are more injury-prone, orcs and dwarves more durable (O11)', () => {
    const c = (race: string, age: number) => injuryChanceBp(make(race, age), content);
    const human = c('human', 25);
    expect(c('elf', 37)).toBeGreaterThan(human);
    expect(c('dwarf', 22)).toBeLessThan(human);
    expect(c('orc', 20)).toBeLessThan(human);
    expect(pronenessLabel(make('human', 25), content)).toBe('average');
    expect(pronenessLabel(make('dwarf', 22, { tgh: 14 }), content)).toBe('low');
  });
  it('inj-009: AI and player fighters with identical state get identical odds', () => {
    const a = make('orc', 24, { tgh: 12 }, { clubId: 'a' as ClubId });
    const b = { ...a, id: 'f-99' as FighterId, clubId: 'b' as ClubId };
    expect(roundInjuryChanceBp(a, content, { damageRatioBp: 7000, downed: false })).toBe(roundInjuryChanceBp(b, content, { damageRatioBp: 7000, downed: false }));
  });
});

describe('At risk and career-ending (C-8)', () => {
  it('inj-003: human-age 33 with one scar is not At risk', () => {
    expect(isAtRisk(make('human', 33, {}, { traits: [{ id: 'rebuilt_knee' as TraitId, gainedSeason: 1, source: 'scar' }] }), content)).toBe(false);
    expect(isAtRisk(make('human', 30, {}, { traits: [{ id: 'rebuilt_knee' as TraitId, gainedSeason: 1, source: 'scar' }, { id: 'clouded_eye' as TraitId, gainedSeason: 1, source: 'scar' }] }), content)).toBe(true);
  });
  it('inj-004: human-age 35 is At risk: 8% given a serious injury, per-match odds shown are ≤ 0.5%', () => {
    const f = make('human', 35);
    expect(isAtRisk(f, content)).toBe(true);
    expect(careerEndingGivenSeriousBp(10, content)).toBe(800);
    expect(careerEndingGivenSeriousBp(200, content)).toBe(800);
    expect(careerEndingGivenSeriousBp(1000, content)).toBe(500); // cap: 50 bp per match ÷ 10% serious this match
    const shown = careerEndingChancePerMatchBp(f, content);
    expect(shown).toBeGreaterThanOrEqual(0);
    expect(shown).toBeLessThanOrEqual(50);
    expect(careerEndingChancePerMatchBp(make('human', 25), content)).toBe(0);
  });
  it('ret-004: a career-ending injury makes the fighter unavailable and never counts down', () => {
    const s = buildFixtureWorld({ clubLimit: 1 });
    at(s, 14);
    const id = Object.keys(s.fighters)[0] as FighterId;
    s.fighters[id]!.injury = { severity: 'serious', weeksOut: CAREER_ENDING_WEEKS, fixtureId: null, round: 1, causeFighterId: null, damageBp: 12_000, since: { season: 1, weekIndex: 14 } };
    for (let w = 15; w <= 23; w++) {
      at(s, w);
      weeklyLifecycle(s, content);
      expect(isFit(s.fighters[id]!)).toBe(false);
    }
    offseasonRecovery(s, content);
    expect(s.fighters[id]!.injury!.weeksOut).toBe(CAREER_ENDING_WEEKS);
  });
});

describe('recovery timing', () => {
  it('inj-001: a knock in MW5 misses MW6 and is available at MW7', () => {
    const s = buildFixtureWorld({ clubLimit: 1 });
    const id = Object.keys(s.fighters)[0] as FighterId;
    at(s, 9); // MW5
    s.fighters[id]!.injury = { severity: 'knock', weeksOut: 1, fixtureId: null, round: 1, causeFighterId: null, damageBp: 5000, since: { season: 1, weekIndex: 9 } };
    weeklyLifecycle(s, content); // same week: no countdown
    at(s, 10); // MW6 lock
    expect(isFit(s.fighters[id]!)).toBe(false);
    weeklyLifecycle(s, content);
    at(s, 11); // MW7 lock
    expect(isFit(s.fighters[id]!)).toBe(true);
    expect(s.fighters[id]!.injury).toBeNull();
  });
  it('inj-006: 10 weeks out at the end of TW3 → 2 after the off-season: out P1-P2, available P3', () => {
    const s = buildFixtureWorld({ clubLimit: 1 });
    const id = Object.keys(s.fighters)[0] as FighterId;
    at(s, 23);
    s.fighters[id]!.injury = { severity: 'serious', weeksOut: 10, fixtureId: null, round: 2, causeFighterId: null, damageBp: 12_000, since: { season: 1, weekIndex: 23 } };
    weeklyLifecycle(s, content);
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    offseasonRecovery(s, content);
    expect(s.fighters[id]!.injury!.weeksOut).toBe(2);
    at(s, 1, 2);
    expect(isFit(s.fighters[id]!)).toBe(false);
    weeklyLifecycle(s, content);
    at(s, 2, 2);
    expect(isFit(s.fighters[id]!)).toBe(false);
    weeklyLifecycle(s, content);
    at(s, 3, 2);
    expect(isFit(s.fighters[id]!)).toBe(true);
  });
});

describe('injuries from a match', () => {
  function brittleWorld(): { s: GameState; home: FighterId[]; away: FighterId[]; a: ClubId; b: ClubId } {
    const s = buildFixtureWorld({ clubLimit: 2 });
    at(s, 9);
    const [a, b] = Object.keys(s.clubs) as ClubId[];
    const home = s.clubs[a!]!.lineup.fighters.map((e) => e.fighterId);
    const away = s.clubs[b!]!.lineup.fighters.map((e) => e.fighterId);
    const f = s.fighters[home[0]!]!;
    Object.assign(f, withStats(f, content, { tgh: 1 }), { raceId: 'elf' as RaceId, age: 70 });
    return { s, home, away, a: a!, b: b! };
  }
  it('inj-002: rolls that would succeed in rounds 1 and 3 give exactly one injury (round 1), applied at match end', () => {
    const { s, home, away, a, b } = brittleWorld();
    const fid = home[0]!;
    const exposure = { damageRatioBp: 20_000, downed: true };
    const p = roundInjuryChanceBp(s.fighters[fid]!, content, exposure, 1);
    expect(p).toBe(1102);
    let fixtureId = '';
    for (let i = 0; i < 5000 && !fixtureId; i++) {
      const fx = `fx-${i}`;
      const ok = (r: number) => Rng.create(s.rng.root, STREAM.injury, 1, fx, r, fid).chanceBp(p);
      if (ok(1) && ok(3)) fixtureId = fx;
    }
    expect(fixtureId).not.toBe('');
    const r = makeResult(s, content, {
      fixtureId,
      homeClubId: a,
      awayClubId: b,
      home,
      away,
      rounds: [{ winner: 'away' }, { winner: 'home' }, { winner: 'away' }],
      perRound: { [fid]: [{ downed: true, damage: 2000, maxHp: 1000, byFighterId: away[0]! }, { downed: true, damage: 2000, maxHp: 1000 }, { downed: true, damage: 2000, maxHp: 1000 }] },
    });
    const out = applyMatchLifecycle(s, r, content);
    const mine = out.injuries.filter((x) => x.fighterId === fid);
    expect(mine).toHaveLength(1);
    expect(s.fighters[fid]!.injury!.round).toBe(1);
    expect(s.fighters[fid]!.injury!.causeFighterId).toBe(away[0]);
    expect(s.fighters[fid]!.season.roundsStarted).toBe(3); // played out the match
    expect(s.fighters[fid]!.season.injuries).toBe(1);
  });
  it('injury rates are identical for the same inputs (determinism)', () => {
    const run = () => {
      const { s, home, away, a, b } = brittleWorld();
      const r = makeResult(s, content, { homeClubId: a, awayClubId: b, home, away, rounds: [{ winner: 'home' }, { winner: 'home' }], perRound: Object.fromEntries(home.concat(away).map((id) => [id, [{ downed: true, damage: 1500, maxHp: 1000 }, { damage: 600 }]])) });
      applyMatchLifecycle(s, r, content);
      return JSON.stringify(s.fighters);
    };
    expect(run()).toBe(run());
  });
});

describe('scars', () => {
  it('scar chance by severity, veteran age and trait multipliers', () => {
    const f = make('human', 25);
    expect(scarChanceBp(f, 'knock', content)).toBe(0);
    expect(scarChanceBp(f, 'moderate', content)).toBe(400);
    expect(scarChanceBp(make('human', 33), 'serious', content)).toBe(3900);
    const granite = make('dwarf', 25, {}, { traits: [{ id: 'granite_bones' as TraitId, gainedSeason: 1, source: 'rolled' }] });
    expect(scarChanceBp(granite, 'serious', content)).toBe(1890);
  });
});
