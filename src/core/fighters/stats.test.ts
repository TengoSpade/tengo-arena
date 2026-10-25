import { describe, expect, it } from 'vitest';
import { combatRating } from '../content';
import { fixtureContent, makeFixtureFighter } from '../testkit';
import type { ClassId, RaceId, StatId, TraitId } from '../model';
import { effectiveStats, humanAge100, potential, rating, ratingFromStats } from './index';
import { maturityBp } from './stats';
import { tables } from './tables';
import { withStats } from './testing';

const content = fixtureContent();
const base = (overrides = {}) => makeFixtureFighter(1, content, { raceId: 'human' as RaceId, classId: 'oathguard' as ClassId, ...overrides });

describe('human-age (life-001)', () => {
  it('elf 42 = 28.0, orc 26 = 32.5, Ashkin 16 = 24.6', () => {
    expect(humanAge100(base({ raceId: 'elf' as RaceId, age: 42 }), content)).toBe(2800);
    expect(humanAge100(base({ raceId: 'orc' as RaceId, age: 26 }), content)).toBe(3250);
    expect(Math.floor(humanAge100(base({ raceId: 'ashkin' as RaceId, age: 16 }), content) / 10) / 10).toBe(24.6);
  });
});

describe('rating is the combat formula (sys-combat-stats, cs-001, cs-002)', () => {
  it('worked-example Oathguard rates 60', () => {
    const f = withStats(base(), content, { str: 12, agi: 9, pac: 11, tgh: 14, pre: 9, arc: 6, spi: 5, wil: 10, cmp: 13, ldr: 11, awr: 8, dis: 10 });
    expect(rating(f, content)).toBe(60);
  });
  it('all attributes 10 rate 50 for every class', () => {
    for (const k of content.classes.list) expect(rating(withStats(base({ classId: k.id as ClassId }), content, {}), content)).toBe(50);
  });
  it('equals round(5 × Σ w × stat) on the effective stats for arbitrary fighters', () => {
    for (let n = 1; n < 60; n++) {
      const f = makeFixtureFighter(n, content);
      const s = effectiveStats(f, content) as Record<string, number>;
      const k = content.classes.require(f.classId);
      const w = k.ratingWeights as Record<string, number>;
      let sum = 0;
      for (const id of Object.keys(w)) sum += (w[id] ?? 0) * (s[id] ?? 0);
      expect(rating(f, content)).toBe(Math.round(5 * sum + 1e-9));
      expect(ratingFromStats(f.classId, s, content)).toBe(rating(f, content));
      // D-Q: one function: the displayed rating is core/content combatRating of the integer stats combat receives.
      expect(combatRating(content, f.classId, s)).toBe(rating(f, content));
    }
  });
});

describe('effectiveStats composition', () => {
  it('caps × maturity − wear, clamped and floored (dev-003 shape)', () => {
    const f = withStats(base(), content, { str: 16 });
    f.dev100 = { physical: 1800, mental: 4000 };
    expect(effectiveStats(f, content)['str' as StatId]).toBe(9); // 1600 × 0.60 = 960
    f.dev100.physical = 1900;
    expect(effectiveStats(f, content)['str' as StatId]).toBe(10); // 1600 × 0.65 = 1040
    f.dev100.physical = 2800;
    f.wear100 = { ...f.wear100, ['str' as StatId]: 120 };
    expect(effectiveStats(f, content)['str' as StatId]).toBe(14); // 1600 − 120 = 1480
  });
  it('base never drops below 1 point; display clamps to 1-20', () => {
    const f = withStats(base(), content, { str: 3 });
    f.wear100 = { ...f.wear100, ['str' as StatId]: 900 };
    expect(effectiveStats(f, content)['str' as StatId]).toBe(1);
    const g = withStats(base(), content, { cmp: 20 });
    g.traits = [{ id: 'still_water' as TraitId, gainedSeason: 1, source: 'rolled' }];
    expect(effectiveStats(g, content)['cmp' as StatId]).toBe(20);
  });
  it('bloom shifts the clock per stat', () => {
    const f = withStats(base(), content, { str: 16, agi: 16 });
    f.dev100 = { physical: 2000, mental: 4000 };
    f.bloom = { ...f.bloom, ['str' as StatId]: 200 };
    expect(effectiveStats(f, content)['str' as StatId]).toBe(12); // M(22) = 0.79
    expect(effectiveStats(f, content)['agi' as StatId]).toBe(11); // M(20) = 0.70
  });
  it('adds trait stat mods (whole points), statuses and context', () => {
    const f = withStats(base(), content, {});
    f.traits = [
      { id: 'still_water' as TraitId, gainedSeason: 1, source: 'rolled' }, // cmp +2
      { id: 'big_stage' as TraitId, gainedSeason: 1, source: 'rolled' }, // tournament cmp +2
      { id: 'broad_frame' as TraitId, gainedSeason: 1, source: 'rolled' }, // str +2 tgh +1 pac −1
    ];
    f.statuses = [{ id: 'final_season', remainingWeeks: null, remainingMatches: null, since: { season: 1, weekIndex: 1 } }];
    const league = effectiveStats(f, content) as Record<string, number>;
    expect(league['cmp']).toBe(13);
    expect(league['str']).toBe(12);
    expect(league['tgh']).toBe(11);
    expect(league['pac']).toBe(9);
    expect((effectiveStats(f, content, { matchType: 'tournament' }) as Record<string, number>)['cmp']).toBe(15);
  });
  it('chemistry adds chemistry ÷ 2 (toward zero) to composure, never for Walks Alone', () => {
    const f = withStats(base(), content, {});
    expect((effectiveStats(f, content, { chemistry: 3 }) as Record<string, number>)['cmp']).toBe(11);
    expect((effectiveStats(f, content, { chemistry: -3 }) as Record<string, number>)['cmp']).toBe(9);
    expect((effectiveStats(f, content, { chemistry: 4 }) as Record<string, number>)['cmp']).toBe(12);
    const loner = { ...f, traits: [{ id: 'walks_alone' as TraitId, gainedSeason: 1, source: 'rolled' as const }] };
    expect((effectiveStats(loner, content, { chemistry: 4 }) as Record<string, number>)['cmp']).toBe(11); // +1 trait only
  });
  it('a trait whose only effects are sim-applied leaves the stats unchanged (trait-008)', () => {
    const f = withStats(base(), content, {});
    const g = { ...f, traits: [{ id: 'thunder_opener' as TraitId, gainedSeason: 1, source: 'rolled' as const }] };
    expect(effectiveStats(g, content)).toEqual(effectiveStats(f, content));
  });
});

describe('potential', () => {
  it('uses caps, ignores wear and non-permanent traits, drops with a scar (inj-008)', () => {
    const f = withStats(base(), content, { str: 14, agi: 12, pac: 12, tgh: 15, cmp: 12 });
    f.dev100 = { physical: 1800, mental: 1800 };
    const p = potential(f, content);
    expect(p).toBe(rating(withStats(base(), content, { str: 14, agi: 12, pac: 12, tgh: 15, cmp: 12 }), content));
    f.traits = [{ id: 'still_water' as TraitId, gainedSeason: 1, source: 'rolled' }];
    expect(potential(f, content)).toBe(p);
    f.traits.push({ id: 'rebuilt_knee' as TraitId, gainedSeason: 1, source: 'scar' });
    expect(potential(f, content)).toBeLessThan(p);
    const g = withStats(base(), content, {});
    g.traits = [{ id: 'rebuilt_knee' as TraitId, gainedSeason: 1, source: 'scar' }];
    expect((effectiveStats(g, content) as Record<string, number>)['pac']).toBe(8);
  });
});

describe('maturity curves', () => {
  it('interpolates and clamps (development.json maturityCurve)', () => {
    expect(maturityBp(content, 'physical', 1400)).toBe(4000);
    expect(maturityBp(content, 'physical', 1000)).toBe(4000);
    expect(maturityBp(content, 'physical', 2850)).toBe(10000);
    expect(maturityBp(content, 'physical', 2150)).toBe(7675);
    expect(maturityBp(content, 'mental', 2800)).toBe(8400);
    expect(maturityBp(content, 'mental', 4500)).toBe(10000);
  });
  it('class offsets are recentred on the rating weights (Oathguard worked example)', () => {
    const off = tables(content).classOffset100.get('oathguard')!;
    expect(off['tgh']!).toBeGreaterThan(130);
    expect(off['tgh']!).toBeLessThan(145);
    expect(off['arc']!).toBeLessThan(-155);
    const w = tables(content).ratingWeightsBp.get('oathguard')!;
    let s = 0;
    for (const id of Object.keys(w)) s += (w[id] ?? 0) * (off[id] ?? 0);
    expect(Math.abs(s)).toBeLessThan(1e-6);
  });
});
