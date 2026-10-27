/**
 * R2-T002: effective rating at a given Freshness (freshness-rating.ts). Fixture content: oathguard (Knight),
 * gutterknife (striker), chirurgeon (healer with Support). Its Freshness penalty at full is attack speed -10%,
 * move -6%, Power -8%, Support -8%, reaction delay +25% (the shipped content has -8 / -4.8 / -6.4 / -6.4 / +20).
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
  it('Freshness 60 and above costs nothing: delta 0, severity 0, no parts', () => {
    for (const cls of ['oathguard', 'gutterknife', 'chirurgeon']) {
      const f = base(cls);
      for (const fresh of [60, 61, 75, 99, 100]) {
        const r = ratingAtFreshness(f, fresh, content);
        expect(r).toMatchObject({ freshness: fresh, severityBp: 0, rating: rating(f, content), effectiveRating: rating(f, content), delta: 0, deltaExact: 0 });
        expect(r.parts).toEqual({ attackSpeed: 0, moveSpeed: 0, power: 0, support: 0, reaction: 0 });
      }
    }
  });

  it('worked example: an all-10 Knight (rating 50) at Freshness 10 loses 7.05 points: 1.8 AGI-for-speed, 1.05 PAC, 2.7 Power, 1.5 reaction', () => {
    // Full penalty (s = 1): attack speed -10% = 4 AGI points x 5 x w_agi 0.09 = 1.8; move -6% = 3 PAC points x 5 x 0.07 = 1.05;
    // Power -8% = 2 weighted points, so STR and AGI lose 2 each: 5 x (0.18 + 0.09) x 2 = 2.7; no Support;
    // reaction +25% of 0.3 s = 0.075 s = 7.5 AWR points x 5 x 0.04 = 1.5. Total 7.05 -> 50 - 7.05 rounds to 43.
    expect(rating(knight, content)).toBe(50);
    const r = ratingAtFreshness(knight, 10, content);
    expect(r.severityBp).toBe(10_000);
    expect(r.parts.attackSpeed).toBeCloseTo(-1.8, 9);
    expect(r.parts.moveSpeed).toBeCloseTo(-1.05, 9);
    expect(r.parts.power).toBeCloseTo(-2.7, 9);
    expect(r.parts.support).toBe(0);
    expect(r.parts.reaction).toBeCloseTo(-1.5, 9);
    expect(r.deltaExact).toBeCloseTo(-7.05, 9);
    expect([r.rating, r.effectiveRating, r.delta]).toEqual([50, 43, -7]);
  });

  it('a healer also pays for Support (and reacts on Awareness): -15.175 at Freshness 10', () => {
    // chirurgeon: agi 0.05, pac 0.08, awr 0.21; Power pre 0.7 + agi 0.3 (weights 0.05 + 0.05 x 2 pts x 5 = 1.0); Support spi 0.6 + awr 0.4
    // (5 x (0.20 + 0.21) x 2 = 4.1); speed 4 x 5 x 0.05 = 1.0; move 3 x 5 x 0.08 = 1.2; reaction 7.5 x 5 x 0.21 = 7.875.
    const r = ratingAtFreshness(base('chirurgeon'), 10, content);
    expect(r.parts.attackSpeed).toBeCloseTo(-1.0, 9);
    expect(r.parts.moveSpeed).toBeCloseTo(-1.2, 9);
    expect(r.parts.power).toBeCloseTo(-1.0, 9);
    expect(r.parts.support).toBeCloseTo(-4.1, 9);
    expect(r.parts.reaction).toBeCloseTo(-7.875, 9);
    expect(r.deltaExact).toBeCloseTo(-15.175, 9);
    expect([r.effectiveRating, r.delta]).toEqual([35, -15]);
  });

  it('at full penalty (Freshness 10 and below) the delta is clearly negative for every class, and does not grow past 10', () => {
    for (const k of content.classes.list) {
      const f = base(k.id);
      const at10 = ratingAtFreshness(f, 10, content);
      expect(at10.delta, k.id).toBeLessThanOrEqual(-4);
      expect(at10.effectiveRating).toBeLessThan(rating(f, content));
      for (const fresh of [9, 5, 0]) expect(ratingAtFreshness(f, fresh, content)).toMatchObject({ severityBp: 10_000, effectiveRating: at10.effectiveRating, deltaExact: at10.deltaExact });
    }
  });

  it('ramps with the same curve as the sim: half way (Freshness 35) is half the loss; the loss never shrinks as Freshness falls', () => {
    const half = ratingAtFreshness(knight, 35, content);
    expect(half.severityBp).toBe(5_000);
    expect(half.deltaExact).toBeCloseTo(-3.525, 9);
    expect([half.effectiveRating, half.delta]).toEqual([46, -4]); // half away from zero
    let prev = Number.NEGATIVE_INFINITY;
    for (let fresh = 0; fresh <= 100; fresh++) {
      const r = ratingAtFreshness(knight, fresh, content);
      expect(r.effectiveRating).toBeGreaterThanOrEqual(prev);
      expect(r.effectiveRating).toBeLessThanOrEqual(r.rating);
      expect(r.delta).toBeLessThanOrEqual(0);
      prev = r.effectiveRating;
    }
  });

  it('a small penalty is whole points too: Freshness 58 (s = 4%) rounds to no change, 55 (s = 10%) to -1', () => {
    expect(ratingAtFreshness(knight, 58, content)).toMatchObject({ severityBp: 400, delta: 0 });
    expect(ratingAtFreshness(knight, 55, content)).toMatchObject({ severityBp: 1_000, delta: -1 });
    expect(ratingAtFreshness(knight, 55, content).deltaExact).toBeCloseTo(-0.705, 9);
  });

  it('reads Freshness as the sim does: truncated to a whole point, clamped 0-100, non-numbers as 100', () => {
    expect(ratingAtFreshness(knight, 59.9, content).freshness).toBe(59);
    expect(ratingAtFreshness(knight, 59.9, content).severityBp).toBe(200);
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
    expect(r.deltaExact).toBeCloseTo(-7.05 * 0.6, 9);
    expect([r.effectiveRating, r.delta]).toEqual([46, -4]);
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

  it('uses his effective stats: a quicker reactor (high Awareness) loses less to the +25% reaction delay', () => {
    const slow = ratingAtFreshness(withStats(base('oathguard'), content, { awr: 4 }), 10, content);
    const quick = ratingAtFreshness(withStats(base('oathguard'), content, { awr: 16 }), 10, content);
    // Reaction time is 0.36 s at AWR 4 and 0.24 s at AWR 16: 25% of it is 9 vs 6 AWR points, at the Knight's 0.04 weight (before the stat itself moves the rating).
    expect(slow.parts.reaction).toBeCloseTo(-5 * 0.04 * 9, 9);
    expect(quick.parts.reaction).toBeCloseTo(-5 * 0.04 * 6, 9);
  });
});
