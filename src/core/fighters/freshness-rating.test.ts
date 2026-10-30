/**
 * R2-T002: effective rating at a given Freshness (freshness-rating.ts). Fixture content: oathguard (Knight),
 * gutterknife (striker), chirurgeon (healer with Support). The Freshness penalty is the stepped tiers of KI-21 (O36): none at F 75+, then
 * Winded 50-74 (-5% attack speed, move, Power, Support; +10% reaction delay), Tired 25-49 (-10%, +20%) and Spent below 25 (-15%, +30%).
 */
import { describe, expect, it } from 'vitest';
import { fixtureContent, makeFixtureFighter } from '../testkit';
import type { ClassId, Fighter, PerkId } from '../model';
import { fatigueResistOf, freshnessSeverityBp, rating, ratingAtFreshness } from './index';
import { withStats } from './testing';

const content = fixtureContent();
const base = (classId: string): Fighter => withStats(makeFixtureFighter(1, content, { classId: classId as ClassId }), content, {});
const knight = base('oathguard');

describe('ratingAtFreshness (R2-T002)', () => {
  it('Freshness 75 and above costs nothing: delta 0, severity 0, no parts', () => {
    for (const cls of ['oathguard', 'gutterknife', 'chirurgeon']) {
      const f = base(cls);
      for (const fresh of [75, 76, 90, 99, 100]) {
        const r = ratingAtFreshness(f, fresh, content);
        expect(r).toMatchObject({ freshness: fresh, severityBp: 0, rating: rating(f, content), effectiveRating: rating(f, content), delta: 0, deltaExact: 0 });
        expect(r.parts).toEqual({ attackSpeed: 0, moveSpeed: 0, power: 0, support: 0, reaction: 0 });
      }
    }
  });

  it('worked example: an all-10 Knight (rating 50) at Freshness 10 (Spent tier) loses 12.19 points: 2.7 AGI-for-speed, 2.625 PAC, 5.06 Power, 1.8 reaction', () => {
    // Spent tier (s = 1): attack speed -15% = 6 AGI points x 5 x w_agi 0.09 = 2.7; move -15% = 7.5 PAC points x 5 x 0.07 = 2.625;
    // Power -15% = 3.75 weighted points, so STR and AGI lose 3.75 each: 5 x (0.18 + 0.09) x 3.75 = 5.0625; no Support;
    // reaction +30% of 0.3 s = 0.09 s = 9 AWR points x 5 x 0.04 = 1.8. Total 12.1875 -> 50 - 12.19 rounds to 38.
    expect(rating(knight, content)).toBe(50);
    const r = ratingAtFreshness(knight, 10, content);
    expect(r.severityBp).toBe(10_000);
    expect(r.parts.attackSpeed).toBeCloseTo(-2.7, 9);
    expect(r.parts.moveSpeed).toBeCloseTo(-2.625, 9);
    expect(r.parts.power).toBeCloseTo(-5.0625, 9);
    expect(r.parts.support).toBe(0);
    expect(r.parts.reaction).toBeCloseTo(-1.8, 9);
    expect(r.deltaExact).toBeCloseTo(-12.1875, 9);
    expect([r.rating, r.effectiveRating, r.delta]).toEqual([50, 38, -12]);
  });

  it('a healer also pays for Support (and reacts on Awareness): -23.5125 at Freshness 10', () => {
    // chirurgeon: agi 0.05, pac 0.08, awr 0.21; Power pre 0.7 + agi 0.3 (1.0 per 2 points); Support spi 0.6 + awr 0.4 (4.1 per 2 points).
    // speed 6 x 5 x 0.05 = 1.5; move 7.5 x 5 x 0.08 = 3.0; Power 3.75 points = 1.875; Support 3.75 points = 7.6875; reaction 9 x 5 x 0.21 = 9.45.
    const r = ratingAtFreshness(base('chirurgeon'), 10, content);
    expect(r.parts.attackSpeed).toBeCloseTo(-1.5, 9);
    expect(r.parts.moveSpeed).toBeCloseTo(-3.0, 9);
    expect(r.parts.power).toBeCloseTo(-1.875, 9);
    expect(r.parts.support).toBeCloseTo(-7.6875, 9);
    expect(r.parts.reaction).toBeCloseTo(-9.45, 9);
    expect(r.deltaExact).toBeCloseTo(-23.5125, 9);
    expect([r.effectiveRating, r.delta]).toEqual([26, -24]);
  });

  it('in the Spent tier (Freshness below 25) the delta is clearly negative for every class, and does not grow below it', () => {
    for (const k of content.classes.list) {
      const f = base(k.id);
      const at10 = ratingAtFreshness(f, 10, content);
      expect(at10.delta, k.id).toBeLessThanOrEqual(-6);
      expect(at10.effectiveRating).toBeLessThan(rating(f, content));
      for (const fresh of [24, 9, 5, 0]) expect(ratingAtFreshness(f, fresh, content)).toMatchObject({ severityBp: 10_000, effectiveRating: at10.effectiveRating, deltaExact: at10.deltaExact });
    }
  });

  it('steps with the same tiers as the sim: Tired (25-49) costs a flat 8.125 whatever the value inside it; the loss never shrinks as Freshness falls', () => {
    const tired = ratingAtFreshness(knight, 35, content);
    expect(tired.severityBp).toBe(6_666);
    // attack 4 AGI x 5 x 0.09 = 1.8; move 5 PAC x 5 x 0.07 = 1.75; Power 2.5 points = 3.375; reaction 6 AWR x 5 x 0.04 = 1.2.
    expect(tired.deltaExact).toBeCloseTo(-8.125, 9);
    expect([tired.effectiveRating, tired.delta]).toEqual([42, -8]);
    for (const fresh of [25, 49]) expect(ratingAtFreshness(knight, fresh, content).deltaExact).toBeCloseTo(-8.125, 9);
    let prev = Number.NEGATIVE_INFINITY;
    for (let fresh = 0; fresh <= 100; fresh++) {
      const r = ratingAtFreshness(knight, fresh, content);
      expect(r.effectiveRating).toBeGreaterThanOrEqual(prev);
      expect(r.effectiveRating).toBeLessThanOrEqual(r.rating);
      expect(r.delta).toBeLessThanOrEqual(0);
      prev = r.effectiveRating;
    }
  });

  it('Winded (50-74) costs a flat 4.06 points, from 74 down to 50; Fresh at 75 costs nothing', () => {
    for (const fresh of [74, 60, 50]) {
      expect(ratingAtFreshness(knight, fresh, content)).toMatchObject({ severityBp: 3_333, delta: -4 });
      expect(ratingAtFreshness(knight, fresh, content).deltaExact).toBeCloseTo(-4.0625, 9);
    }
    expect(ratingAtFreshness(knight, 75, content)).toMatchObject({ severityBp: 0, delta: 0 });
  });

  it('reads Freshness as the sim does: truncated to a whole point, clamped 0-100, non-numbers as 100', () => {
    expect(ratingAtFreshness(knight, 74.9, content).freshness).toBe(74);
    expect(ratingAtFreshness(knight, 74.9, content).severityBp).toBe(3_333);
    expect(ratingAtFreshness(knight, 49.9, content).severityBp).toBe(6_666);
    expect(ratingAtFreshness(knight, -20, content).freshness).toBe(0);
    expect(ratingAtFreshness(knight, 250, content)).toMatchObject({ freshness: 100, delta: 0 });
    expect(ratingAtFreshness(knight, Number.NaN, content)).toMatchObject({ freshness: 100, delta: 0 });
  });

  it('fatigueResist (the Long Wind perk, +40%) scales the penalty by 0.6 like the sim', () => {
    const tough: Fighter = { ...knight, perkIds: ['g_long_wind' as PerkId] };
    expect(fatigueResistOf(tough, content)).toBeCloseTo(0.4, 9);
    expect(fatigueResistOf(knight, content)).toBe(0);
    const r = ratingAtFreshness(tough, 10, content);
    expect(r.severityBp).toBe(6_000);
    expect(r.deltaExact).toBeCloseTo(-12.1875 * 0.6, 9);
    expect([r.effectiveRating, r.delta]).toEqual([43, -7]);
    expect(freshnessSeverityBp(10, 1, content)).toBe(0); // full resist: no penalty at all
    expect(freshnessSeverityBp(10, 5, content)).toBe(0); // clamped to the content's [0, 1]
    expect(freshnessSeverityBp(10, -1, content)).toBe(10_000);
  });

  it('prices the loss at the fighter\'s own weights: a striker loses more than a Knight with the same stats; effective rating stays within the scale', () => {
    const striker = ratingAtFreshness(base('gutterknife'), 10, content);
    expect(striker.delta).toBeLessThan(ratingAtFreshness(knight, 10, content).delta);
    // A fighter on the floor of the scale cannot drop below ratingMin.
    const weak = withStats(makeFixtureFighter(2, content, { classId: 'gutterknife' as ClassId }), content, {}, 1);
    const r = ratingAtFreshness(weak, 0, content);
    expect(r.rating).toBe(5);
    expect(r.effectiveRating).toBe(content.development.scale.ratingMin);
    expect(r.delta).toBe(r.effectiveRating - r.rating);
  });

  it('uses his effective stats: a quicker reactor (high Awareness) loses less to the +30% reaction delay', () => {
    const slow = ratingAtFreshness(withStats(base('oathguard'), content, { awr: 4 }), 10, content);
    const quick = ratingAtFreshness(withStats(base('oathguard'), content, { awr: 16 }), 10, content);
    // Reaction time is 0.36 s at AWR 4 and 0.24 s at AWR 16: 30% of it is 10.8 vs 7.2 AWR points, at the Knight's 0.04 weight (before the stat itself moves the rating).
    expect(slow.parts.reaction).toBeCloseTo(-5 * 0.04 * 10.8, 9);
    expect(quick.parts.reaction).toBeCloseTo(-5 * 0.04 * 7.2, 9);
  });
});

describe('ratingAtFreshness: a Freshness below every tier minimum', () => {
  it('falls to the last (harshest) tier, as the sim does, not to the penalty-free one', () => {
    const content = fixtureContent();
    const fr = content.combat.freshness;
    const noZeroTier = { ...content, combat: { ...content.combat, freshness: { ...fr, tiers: fr.tiers.filter((t) => t.minFreshness > 0) } } };
    expect(freshnessSeverityBp(10, 0, content)).toBe(10000);
    expect(freshnessSeverityBp(10, 0, noZeroTier)).toBe(10000);
    expect(freshnessSeverityBp(90, 0, noZeroTier)).toBe(0);
  });
});
