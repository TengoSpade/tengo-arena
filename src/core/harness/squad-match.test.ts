import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testkit';
import { START_FRESHNESS10, runSquadMatch } from './squad-match';

describe('squad-match harness (KI-21)', () => {
  const content = fixtureContent();

  it('mirrors clubs and sides, so the off row is exactly 50% and every row shares the off-against-off pair', { timeout: 120_000 }, () => {
    const r = runSquadMatch({ seed: 'ki21', fights: 40, content });
    const off = r.rows.find((x) => x.id === 'off')!;
    expect(r.matchups).toBe(2);
    expect(off.matches).toBe(8);
    expect(off.winRate).toBe(0.5);
    for (const row of r.rows) expect(row.offComebackRate).toBe(off.comebackRate);
    expect(r.matches).toBe(40);
  });

  it('the policies play the shipped lost-round threshold bonus (D-V), not zero', () => {
    expect(content.levels.aiSubstitution.lostRoundThresholdBonus).toBeGreaterThan(0);
  });

  it('Spent must be reachable inside a match, or threshold 40 never fires; when it is, threshold 60 swaps more than off', { timeout: 120_000 }, () => {
    expect(START_FRESHNESS10.min).toBeLessThan(400);
    const low = runSquadMatch({ seed: 'ki21', fights: 400, content, startFreshness10: { min: 0, max: 1000 } });
    const t40 = low.rows.find((x) => x.id === 'threshold60')!;
    const off = low.rows.find((x) => x.id === 'off')!;
    expect(t40.swapsPerMatch).toBeGreaterThan(off.swapsPerMatch);
  });
});
