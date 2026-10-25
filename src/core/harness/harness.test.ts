import { describe, expect, it } from 'vitest';
import { runBalance, runSoak } from './index';
import { SOAK_CHECKS } from './soak';

describe('balance harness (stub)', () => {
  it('is deterministic per seed and counts every fight twice (two sides)', () => {
    const a = runBalance({ seed: 'b1', fights: 500, classIds: ['x', 'y', 'z'] });
    const b = runBalance({ seed: 'b1', fights: 500, classIds: ['x', 'y', 'z'] });
    expect(a).toEqual(b);
    expect(a.classes.reduce((n, r) => n + r.appearances, 0)).toBe(1000);
    expect(a.classes.reduce((n, r) => n + r.wins, 0)).toBe(500);
    expect(a.stub).toBe(true);
  });

  it('rejects a bad fight count', () => {
    expect(() => runBalance({ seed: 'b1', fights: -1, classIds: [] })).toThrow(RangeError);
  });
});

describe('soak harness (stub)', () => {
  it('reports every catalogue check', () => {
    const report = runSoak({ seed: 's1', seasons: 3 });
    expect(report.checks.map((c) => c.id)).toEqual(SOAK_CHECKS.map((c) => c.id));
    expect(report.seasonsRequested).toBe(3);
  });
});
