import { describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent, makeFixtureFighter } from '../testkit';
import type { ClassId, ClubId, Fighter, FighterId, GameState, RaceId, TraitId, WeekId } from '../model';
import { captainChangeConsequences, captaincy, captaincyBreakdown, effectiveStats, gradeFor, lineupCaptain, lineupChemistry, lineupLock, weeklyLifecycle } from './index';
import { mentorMultiplier } from './season';
import { withStats } from './testing';

const content = fixtureContent();
const trait = (id: string) => ({ id: id as TraitId, gainedSeason: 1, source: 'rolled' as const });

function at(s: GameState, weekIndex: number, season = 1): void {
  const w = content.weekByIndex(weekIndex);
  s.calendar = { season, weekIndex, weekId: w.id as WeekId, phase: w.phase };
}

/** One club of 8 plain fighters (all stats 10, human, aged 25) and a second club. */
function world(): { s: GameState; club: ClubId; ids: FighterId[] } {
  const s = buildFixtureWorld({ clubLimit: 2 });
  const club = Object.keys(s.clubs)[0] as ClubId;
  const ids = Object.values(s.fighters)
    .filter((f) => f.clubId === club)
    .map((f) => f.id);
  for (const id of ids) {
    const f = s.fighters[id]!;
    Object.assign(f, withStats({ ...f, raceId: 'human' as RaceId, classId: 'oathguard' as ClassId, age: 25 }, content, {}));
    f.career.matchweeksAtClub = 30;
  }
  const c = s.clubs[club]!;
  c.captainId = ids[0]!;
  c.viceCaptainId = ids[1]!;
  c.captainAtLastLock = ids[0]!;
  c.captainSince = { season: 1, weekIndex: 5 };
  c.lineup.fighters = ids.slice(0, 5).map((fighterId) => ({ fighterId, row: 'front' as const }));
  return { s, club, ids };
}

const veteran = (): Fighter => {
  const f = withStats(makeFixtureFighter(1, content, { raceId: 'human' as RaceId, classId: 'oathguard' as ClassId, age: 33 }), content, { str: 14, tgh: 14, ldr: 13, cmp: 12 }, 13);
  f.traits = [trait('quiet_steel'), { id: 'wore_the_armband' as TraitId, gainedSeason: 1, source: 'event' }];
  f.career.roundsStarted = 350;
  f.career.matchweeksAtClub = 60;
  return f;
};

describe('captaincy rating and grades (O6)', () => {
  it('cap-001: the worked-example veteran scores 76, grade B', () => {
    const f = veteran();
    const b = captaincyBreakdown(f, content, 66);
    expect(b.cq).toBe(76);
    expect(b.grade.letter).toBe('B');
    expect(b.leadership).toBe(65);
    expect(b.composure).toBe(65);
    expect(b.traits).toBe(12);
  });
  it('the young Hot Blood orc scores 27, grade E', () => {
    const f = withStats(makeFixtureFighter(2, content, { raceId: 'orc' as RaceId, classId: 'gutterknife' as ClassId, age: 22 }), content, { ldr: 8, cmp: 8 });
    f.traits = [trait('hot_blood')];
    f.career.roundsStarted = 120;
    f.career.matchweeksAtClub = 19;
    const own = captaincyBreakdown(f, content, null);
    expect(effectiveStats(f, content)['cmp' as never]).toBe(6);
    expect(own.cq).toBe(27);
    expect(own.grade.letter).toBe('E');
  });
  it('youth penalty below human-age 22 and grade thresholds 85/70/55/40', () => {
    const f = veteran();
    const young = { ...f, age: 21 };
    expect(captaincyBreakdown(young, content, 66).cq).toBe(66);
    expect([85, 84, 70, 69, 55, 54, 40, 39, 1].map((c) => gradeFor(c, content).letter)).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E']);
  });
});

describe('lineup captain (cap-002)', () => {
  it('club captain benched → vice-captain leads at CQ − 10', () => {
    const { s, club, ids } = world();
    const fielded = ids.slice(1, 6);
    const lc = lineupCaptain(s, club, fielded, content)!;
    expect(lc.fighterId).toBe(ids[1]);
    expect(lc.isClubCaptain).toBe(false);
    expect(lc.cqForFight).toBe(captaincy(s, ids[1]!, club, content).cq - 10);
    const own = lineupCaptain(s, club, ids.slice(0, 5), content)!;
    expect(own.fighterId).toBe(ids[0]);
    expect(own.cqForFight).toBe(captaincy(s, ids[0]!, club, content).cq);
    expect(own.viceIndex).toBe(1);
  });
  it('neither fielded → highest CQ (ties: seniority, rating, id)', () => {
    const { s, club, ids } = world();
    s.fighters[ids[4]!]!.traits = [trait('rallying_voice')];
    expect(lineupCaptain(s, club, ids.slice(2, 7), content)!.fighterId).toBe(ids[4]);
  });
});

describe('captain changes at lineup lock', () => {
  it('cap-003: A → B → A between two locks costs nothing', () => {
    const { s, club, ids } = world();
    at(s, 12);
    lineupLock(s, club, content);
    s.clubs[club]!.captainId = ids[2]!;
    s.clubs[club]!.captainId = ids[0]!;
    at(s, 13);
    lineupLock(s, club, content);
    for (const id of ids) expect(s.fighters[id]!.statuses.filter((x) => x.id === 'snubbed' || x.id === 'passed_over')).toHaveLength(0);
  });
  it('cap-004: a fit captain replaced at the MW8 lock is Snubbed for 6 matchweeks (−2 chemistry when fielded)', () => {
    const { s, club, ids } = world();
    at(s, 12); // MW8; captain since MW1 → 7 matchweeks
    s.clubs[club]!.captainId = ids[2]!;
    s.clubs[club]!.viceCaptainId = ids[3]!;
    lineupLock(s, club, content);
    const st = s.fighters[ids[0]!]!.statuses.find((x) => x.id === 'snubbed');
    expect(st?.remainingWeeks).toBe(6);
    const withPrev = lineupChemistry(s, club, ids.slice(0, 5), ids[2]!, content);
    const without = lineupChemistry(s, club, ids.slice(1, 6), ids[2]!, content);
    expect(withPrev - without).toBe(-2);
    for (let w = 12; w < 18; w++) {
      at(s, w);
      weeklyLifecycle(s, content);
    }
    expect(s.fighters[ids[0]!]!.statuses.some((x) => x.id === 'snubbed')).toBe(false);
  });
  it('cap-005: no Snubbed when the captain is injured for 5 weeks; none in preseason or at MW1 either', () => {
    const { s, club, ids } = world();
    at(s, 12);
    s.fighters[ids[0]!]!.injury = { severity: 'moderate', weeksOut: 5, fixtureId: null, round: 1, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 11 } };
    s.clubs[club]!.captainId = ids[2]!;
    lineupLock(s, club, content);
    expect(s.fighters[ids[0]!]!.statuses.some((x) => x.id === 'snubbed')).toBe(false);
    const w2 = world();
    at(w2.s, 5, 2); // MW1 of season 2: the change was made before MW1
    w2.s.clubs[w2.club]!.captainSince = { season: 1, weekIndex: 5 };
    w2.s.clubs[w2.club]!.captainId = w2.ids[2]!;
    lineupLock(w2.s, w2.club, content);
    expect(w2.s.fighters[w2.ids[0]!]!.statuses.some((x) => x.id === 'snubbed')).toBe(false);
  });
  it('cap-006: a senior club-mate with CQ ≥ new CQ + 15 is Passed Over; making him vice-captain clears it', () => {
    const { s, club, ids } = world();
    at(s, 12);
    const senior = s.fighters[ids[5]!]!;
    Object.assign(senior, withStats({ ...senior, age: 31 }, content, { ldr: 18, cmp: 14 }));
    senior.career.roundsStarted = 400;
    const weak = s.fighters[ids[2]!]!;
    Object.assign(weak, withStats(weak, content, { ldr: 6 }));
    s.clubs[club]!.captainId = weak.id;
    lineupLock(s, club, content);
    expect(captaincy(s, senior.id, club, content).cq).toBeGreaterThanOrEqual(captaincy(s, weak.id, club, content).cq + 15);
    expect(s.fighters[senior.id]!.statuses.some((x) => x.id === 'passed_over')).toBe(true);
    s.clubs[club]!.viceCaptainId = senior.id;
    at(s, 13);
    lineupLock(s, club, content);
    expect(s.fighters[senior.id]!.statuses.some((x) => x.id === 'passed_over')).toBe(false);
  });
  it('captainChangeConsequences previews exactly what the next lock applies (Snubbed, then Passed Over)', () => {
    const { s, club, ids } = world();
    at(s, 12);
    const senior = s.fighters[ids[5]!]!;
    Object.assign(senior, withStats({ ...senior, age: 31 }, content, { ldr: 18, cmp: 14 }));
    senior.career.roundsStarted = 400;
    const weak = s.fighters[ids[2]!]!;
    Object.assign(weak, withStats(weak, content, { ldr: 6 }));
    const c = s.clubs[club]!;
    const preview = captainChangeConsequences(s, club, c.captainAtLastLock, weak.id, ids[3]!, c.captainSince, content);
    expect(captainChangeConsequences(s, club, c.captainAtLastLock, c.captainAtLastLock, ids[1]!, c.captainSince, content)).toEqual({ snubbedId: null, snubExemption: null, passedOverIds: [] });
    c.captainId = weak.id;
    c.viceCaptainId = ids[3]!;
    lineupLock(s, club, content);
    const has = (id: FighterId, status: string) => s.fighters[id]!.statuses.some((x) => x.id === status);
    expect(preview.snubbedId).toBe(ids[0]);
    expect(preview.snubExemption).toBeNull();
    expect(has(ids[0]!, 'snubbed')).toBe(true);
    expect(preview.passedOverIds).toContain(senior.id);
    for (const id of ids) expect(has(id, 'passed_over')).toBe(preview.passedOverIds.includes(id));
  });
  it('cap-007: a captain of 25+ matchweeks released at MW12 → Captain Departed 4 weeks and an interim captain', () => {
    const { s, club, ids } = world();
    at(s, 16); // MW12
    s.clubs[club]!.captainSince = { season: 0, weekIndex: 9 };
    const cap = s.fighters[ids[0]!]!;
    cap.clubId = null;
    cap.status = 'free-agent';
    weeklyLifecycle(s, content);
    const c = s.clubs[club]!;
    expect(c.statuses.find((x) => x.id === 'captain_departed')?.remainingWeeks).toBe(4);
    expect(c.captainId).not.toBeNull();
    expect(c.captainId).not.toBe(cap.id);
    const chem = lineupChemistry(s, club, ids.slice(1, 6), c.captainId, content);
    expect(chem).toBe(-1 + captaincy(s, c.captainId!, club, content).grade.chemistry);
  });
  it('cap-008: a fit captain not fielded in MW5-MW8 is Losing the Room at the MW9 lock (−10 CQ), cleared when fielded', () => {
    const { s, club, ids } = world();
    const c = s.clubs[club]!;
    c.lineup.fighters = ids.slice(1, 6).map((fighterId) => ({ fighterId, row: 'front' as const }));
    const before = captaincy(s, ids[0]!, club, content).cq;
    for (let w = 9; w <= 12; w++) {
      at(s, w);
      lineupLock(s, club, content);
      expect(s.fighters[ids[0]!]!.statuses.some((x) => x.id === 'losing_the_room')).toBe(false);
    }
    at(s, 13);
    lineupLock(s, club, content);
    expect(s.fighters[ids[0]!]!.statuses.some((x) => x.id === 'losing_the_room')).toBe(true);
    expect(captaincy(s, ids[0]!, club, content).cq).toBe(before - 10);
    c.lineup.fighters = ids.slice(0, 5).map((fighterId) => ({ fighterId, row: 'front' as const }));
    at(s, 14);
    lineupLock(s, club, content);
    expect(s.fighters[ids[0]!]!.statuses.some((x) => x.id === 'losing_the_room')).toBe(false);
  });
});

describe('mentoring (cap-009)', () => {
  it('grade-A captain all season × Shares the Craft = 1.1232; capped at 1.15; only young fighters', () => {
    const young = makeFixtureFighter(5, content, { raceId: 'human' as RaceId, age: 21 });
    const info = { captains: [{ fighterId: 'f-1' as FighterId, weeks: 19, mult: 1.08, letter: 'A' }], traitMentors: [{ fighterId: 'f-2' as FighterId, mult: 1.04 }] };
    expect(mentorMultiplier(young, info, content)).toBeCloseTo(1.1232, 10);
    const more = { ...info, traitMentors: [...info.traitMentors, { fighterId: 'f-3' as FighterId, mult: 1.04 }, { fighterId: 'f-4' as FighterId, mult: 1.02 }] };
    expect(mentorMultiplier(young, more, content)).toBeCloseTo(1.15, 10);
    expect(mentorMultiplier({ ...young, age: 24 }, info, content)).toBe(1);
    const half = { captains: [{ fighterId: 'f-1' as FighterId, weeks: 19, mult: 0.97, letter: 'E' }], traitMentors: [] };
    expect(mentorMultiplier(young, half, content)).toBeCloseTo(0.97, 10);
  });
});

describe('chemistry (D-D: trait and captain lineup modifiers only)', () => {
  function chemWorld() {
    const { s, club, ids } = world();
    const [f1, f2, f3, f4, f5, f6, f7] = ids.map((id) => s.fighters[id]!);
    f1!.traits = [trait('good_company')];
    f2!.raceId = 'dwarf' as RaceId;
    f2!.traits = [trait('kin_bound')];
    f3!.raceId = 'dwarf' as RaceId;
    f3!.traits = [trait('glory_hungry')];
    f4!.traits = [trait('glory_hungry')];
    f5!.statuses = [{ id: 'snubbed', remainingWeeks: 6, remainingMatches: null, since: { season: 1, weekIndex: 12 } }];
    // Benched grade-B club captain (the cap-001 veteran).
    const v = veteran();
    Object.assign(f7!, { ...v, id: f7!.id, clubId: club, status: 'active', contract: f7!.contract });
    expect(captaincy(s, f7!.id, club, content).grade.letter).toBe('B');
    void f6;
    return { s, club, ids, captain: f7!.id };
  }
  it('chem-001: worked-example lineup totals 0; benching the Snubbed fighter gives +2 → +1 composure each', () => {
    const { s, club, ids, captain } = chemWorld();
    expect(lineupChemistry(s, club, ids.slice(0, 5), captain, content)).toBe(0);
    const benched = [ids[0]!, ids[1]!, ids[2]!, ids[3]!, ids[5]!];
    const chem = lineupChemistry(s, club, benched, captain, content);
    expect(chem).toBe(2);
    expect((effectiveStats(s.fighters[ids[5]!]!, content, { chemistry: chem }) as Record<string, number>)['cmp']).toBe(11);
  });
  it('Kin-Bound without a same-race team-mate is −1; the captain’s own trait terms count double', () => {
    const { s, club, ids } = chemWorld();
    s.fighters[ids[2]!]!.raceId = 'human' as RaceId;
    expect(lineupChemistry(s, club, [ids[1]!], null, content)).toBe(-1);
    s.clubs[club]!.captainId = ids[0]!;
    expect(lineupChemistry(s, club, [ids[0]!], ids[0]!, content)).toBe(2 + captaincy(s, ids[0]!, club, content).grade.chemistry);
  });
  it('plain lineups have 0 chemistry under a grade C/D captain; the result is clamped to ±5', () => {
    const { s, club, ids } = world();
    const g = captaincy(s, ids[0]!, club, content).grade;
    expect(lineupChemistry(s, club, ids.slice(0, 5), ids[0]!, content)).toBe(g.chemistry);
    for (const id of ids.slice(0, 5)) s.fighters[id]!.statuses = [{ id: 'snubbed', remainingWeeks: 6, remainingMatches: null, since: { season: 1, weekIndex: 1 } }];
    expect(lineupChemistry(s, club, ids.slice(0, 5), null, content)).toBe(-5);
  });
});
