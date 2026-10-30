import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testkit';
import { START_FRESHNESS10, runSquadMatch } from './squad-match';

describe('squad-match harness (KI-21)', () => {
  const content = fixtureContent();

  it('mirrors clubs and sides; the off row is the shared off-against-off matches, each played once, and 50% by construction', { timeout: 120_000 }, () => {
    const r = runSquadMatch({ seed: 'ki21', fights: 36, content });
    const off = r.rows.find((x) => x.id === 'off')!;
    const t50 = r.rows.find((x) => x.id === 'threshold50')!;
    expect(r.matchups).toBe(2);
    // Per matchup: 2 distinct off-against-off matches; every other row plays 4 (policy on either club, home and away).
    expect(off.matches).toBe(4);
    expect(t50.matches).toBe(8);
    expect(r.matches).toBe(2 * (2 + 4 * 4));
    // Each off match is seen from both clubs, so exactly half the perspectives win: a tautology, not a measurement.
    expect(off.winRate).toBe(0.5);
    for (const row of r.rows) expect(row.offComebackRate).toBe(off.comebackRate);
  });

  it('the policies play the shipped lost-round threshold bonus (D-V), not zero', () => {
    expect(content.levels.aiSubstitution.lostRoundThresholdBonus).toBeGreaterThan(0);
  });

  it('Spent must be reachable inside a match, or the threshold never fires; when it is, threshold 75 swaps more than off', { timeout: 120_000 }, () => {
    expect(START_FRESHNESS10.min).toBeLessThan(250);
    const low = runSquadMatch({ seed: 'ki21', fights: 400, content, startFreshness10: { min: 0, max: 1000 } });
    const t75 = low.rows.find((x) => x.id === 'threshold75')!;
    const off = low.rows.find((x) => x.id === 'off')!;
    expect(t75.swapsPerMatch).toBeGreaterThan(off.swapsPerMatch);
  });
});
