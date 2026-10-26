/**
 * M1.1 levels and Freshness reads implemented in the contracts phase
 * (progression.md lvl-001, lvl-005, frs-009, the labels; the worked examples
 * of "XP per level"). The rest of WP-B's acceptance lives with WP-B.
 */
import { describe, expect, it } from 'vitest';
import type { ClassId, Fighter, PaceId, RaceId, StatId } from '../model';
import { buildFixtureWorld, fixtureContent, fixtureState, fixtureTrain100, makeFixtureFighter } from '../testkit';
import { createFighter } from './index';
import { freshnessInjuryMultBp, freshnessLabel, freshnessOf, initialLevel, physicalWeightShare, trainFromClocks, xpNeededFor } from './levels';

const content = fixtureContent();
const all = (v: number): Record<StatId, number> => Object.fromEntries(content.stats.list.map((s) => [s.id, v])) as Record<StatId, number>;

/** Caps all 13 (potential 65), trained all 11 (55): gap 10, G = 1.0. */
function worked(overrides: Partial<Fighter> = {}): Fighter {
  return makeFixtureFighter(1, content, {
    raceId: 'human' as RaceId,
    classId: 'oathguard' as ClassId,
    age: 25,
    paceId: 'steady' as PaceId,
    cap100: all(1300),
    train100: all(1100),
    traits: [],
    level: 20,
    ...overrides,
  });
}

describe('XP per level (progression.md sys-development)', () => {
  it('uses the class physical weight share, Stamina included (Oathguard 0.71)', () => {
    expect(physicalWeightShare('oathguard', content)).toBeCloseTo(0.71, 10);
  });

  it('lvl-001: human 25, Steady, level 20, gap 10 -> 127 x 1.2065 = 153.2 -> 155', () => {
    expect(xpNeededFor(worked(), content)).toBe(155);
  });

  it('pace divides (Slow 205, Brisk 135, Rapid 120); mentoring divides (x1.08 -> 140)', () => {
    expect(xpNeededFor(worked({ paceId: 'slow' as PaceId }), content)).toBe(205);
    expect(xpNeededFor(worked({ paceId: 'brisk' as PaceId }), content)).toBe(135);
    expect(xpNeededFor(worked({ paceId: 'rapid' as PaceId }), content)).toBe(120);
    expect(xpNeededFor(worked(), content, { mentor: 1.08 })).toBe(140);
  });

  it('one clock (D-B): the same human-age as an elf 225 and as an Ashkin 105', () => {
    expect(xpNeededFor(worked({ raceId: 'elf' as RaceId, age: 37 }), content)).toBe(225);
    expect(xpNeededFor(worked({ raceId: 'ashkin' as RaceId, age: 16 }), content)).toBe(105);
  });

  it('the gap factor slows fighters at their potential (gap 0 -> G 4.0) and the result clamps to 60-2,500', () => {
    const atCap = worked({ train100: all(1300) });
    expect(xpNeededFor(atCap, content)).toBe(5 * Math.round((127 * 1.2065 * 4) / 5));
    expect(xpNeededFor(worked({ age: 18, paceId: 'rapid' as PaceId, level: 1 }), content)).toBeGreaterThanOrEqual(content.levels.xpPerLevel.min);
    expect(xpNeededFor(worked({ age: 39, train100: all(1300), level: 300 }), content)).toBeLessThanOrEqual(content.levels.xpPerLevel.max);
  });
});

describe('initial level', () => {
  it('lvl-005: 13 stats, every cap 1,400 and train 1,000 -> 1 + 39 = level 40', () => {
    expect(initialLevel({ cap100: all(1400), train100: all(1000) }, content)).toBe(40);
  });
  it('a fighter below half of every cap is level 1', () => {
    expect(initialLevel({ cap100: all(1400), train100: all(600) }, content)).toBe(1);
  });
});

describe('generation and fixtures fill the v3 fields', () => {
  it('a generated fighter: train100 = the developed value, the initial level, XP per level, rested, rank 1, no perks', () => {
    const s = fixtureState();
    const id = createFighter(s, { kind: 'rookie', potentialShift: 0, regionId: content.regions.list[0]!.id as never }, content);
    const f = s.fighters[id]!;
    expect(f.train100).toEqual(trainFromClocks(f, content));
    expect(Object.keys(f.train100)).toHaveLength(13);
    expect(f.level).toBe(initialLevel(f, content));
    expect(f.xpNeeded).toBe(xpNeededFor(f, content));
    expect(f.freshness10).toBe(1000);
    expect(f.abilityRanks).toEqual({ a1: 1, a2: 1, passive: 1 });
    expect(f.perkIds).toEqual([]);
    expect(f.pendingLevelUps).toEqual([]);
  });

  it('testkit fixture fighters carry train100 equal to their clocks (switching stats to train100 changes nothing)', () => {
    for (const f of Object.values(buildFixtureWorld({ clubLimit: 3 }).fighters)) {
      expect(f.train100).toEqual(trainFromClocks(f, content));
      expect(fixtureTrain100(content, f)).toEqual(trainFromClocks(f, content));
    }
  });
});

describe('Freshness reads (sys-freshness)', () => {
  it('reads floor(freshness10 / 10), clamped; missing reads 100', () => {
    expect(freshnessOf({ freshness10: 961 })).toBe(96);
    expect(freshnessOf({ freshness10: 1200 })).toBe(100);
    expect(freshnessOf({ freshness10: -5 })).toBe(0);
    expect(freshnessOf({} as Fighter)).toBe(100);
  });

  it('labels: Fresh >= 80, Ready 60-79, Tired 40-59, Spent < 40', () => {
    expect([100, 80, 79, 60, 59, 40, 39, 0].map((v) => freshnessLabel(v, content))).toEqual(['fresh', 'fresh', 'ready', 'ready', 'tired', 'tired', 'spent', 'spent']);
  });

  it('frs-009: injury multiplier x1.09 at 45, x1 at 60, x1.36 at 0 (cap x1.4)', () => {
    expect(freshnessInjuryMultBp(45, content)).toBe(10_900);
    expect(freshnessInjuryMultBp(60, content)).toBe(10_000);
    expect(freshnessInjuryMultBp(0, content)).toBe(13_600);
  });
});
