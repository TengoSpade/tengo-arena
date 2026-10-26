/**
 * M1.1 contract (WP-A): simulateRound. With the defaults (freshness 100,
 * ranks 1, no perks, not entering) a round is bit-identical to simulateFight;
 * WP-A keeps this while it adds the freshness penalty, ranks and perks.
 */
import { describe, expect, it } from 'vitest';
import type { RoundInput } from '../model';
import { fixtureContent } from '../testkit';
import { sideInput, simulateFight, simulateRound } from './index';

const content = fixtureContent();
const HOME = ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon'];
const AWAY = ['siegebreaker', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon'];

function round(n: number): RoundInput {
  return { round: n, home: sideInput(content, 'home', HOME, 0, 1), away: sideInput(content, 'away', AWAY, 1, 0) };
}

describe('simulateRound (M1.1 contract)', () => {
  it('with default per-round fields equals simulateFight: same result, checksum and event hash', () => {
    for (const n of [1, 2, 3]) {
      const input = round(n);
      const a = simulateRound(input, `seed-${n}`, content, { record: 'full' });
      const b = simulateFight({ seed: `seed-${n}`, round: n, home: input.home, away: input.away }, content, { record: 'full' });
      expect(a.result).toEqual(b.result);
      expect(a.fighterStats).toEqual(b.fighterStats);
      expect(a.log?.hash).toBe(b.log?.hash);
    }
  });

  it('explicit defaults (freshness 100, ranks 1, no perks, not entering) change nothing', () => {
    const plain = round(1);
    const explicit = round(1);
    for (const s of [explicit.home, explicit.away]) {
      s.fighters = s.fighters.map((f) => ({ ...f, freshness: 100, abilityRanks: { a1: 1, a2: 1, passive: 1 }, perkIds: [], enteredThisRound: false }));
    }
    expect(simulateRound(explicit, 'x', content).result.checksum).toBe(simulateRound(plain, 'x', content).result.checksum);
  });

  it('reports one aftermath per fighter who started, with damage, max HP and downs', () => {
    const out = simulateRound(round(1), 'aftermath', content);
    expect(out.aftermath).toHaveLength(10);
    expect(out.aftermath.slice(0, 5).every((a) => a.side === 'home')).toBe(true);
    for (const a of out.aftermath) {
      expect(a.maxHp).toBeGreaterThan(0);
      expect(a.damageTaken).toBe(out.fighterStats[a.fighterId]!.damageTaken);
      expect(a.downed).toBe(out.fighterStats[a.fighterId]!.downsSuffered > 0);
      if (a.downed) expect(a.largestHit).toBe(a.downCause!.hit);
    }
    const downs = out.aftermath.filter((a) => a.downed).length;
    expect(downs).toBe(out.result.downs.home + out.result.downs.away);
  });
});
