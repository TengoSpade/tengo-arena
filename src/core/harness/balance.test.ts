import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testkit';
import { runBalance } from './index';
import { wilson } from './balance';

describe('balance harness', () => {
  const content = fixtureContent();

  it('plays real fights deterministically per seed and counts every fighter-round', () => {
    const a = runBalance({ seed: 'b1', fights: 40, content });
    expect(a.stub).toBe(false);
    expect(a).toEqual(runBalance({ seed: 'b1', fights: 40, content }));
    expect(a.fights).toBe(40);
    expect(a.classes.reduce((n, r) => n + r.appearances, 0)).toBe(400);
    expect(a.classes.reduce((n, r) => n + r.wins, 0)).toBe(200);
    expect(a.classes.map((r) => r.classId).sort()).toEqual(content.classes.list.map((k) => k.id).sort());
    expect(a.contentHash).toBe(content.ref.hash);
    expect(a.fightLength!.rounds).toBe(40);
    expect(a.fightLength!.medianS).toBeGreaterThan(0);
    expect(a.fightLength!.medianS).toBeLessThanOrEqual(75);
    expect(a.archetypes!.reduce((n, r) => n + r.appearances, 0)).toBe(400);
    for (const r of a.classes) {
      expect(r.ciLow!).toBeLessThanOrEqual(r.winRate);
      expect(r.ciHigh!).toBeGreaterThanOrEqual(r.winRate);
    }
    expect(a.outliers).toEqual(a.classes.filter((r) => r.winRate < 0.4 || r.winRate > 0.6).map((r) => r.classId));
  });

  it('mirrors each pair of lineups (sides swapped, same seed)', () => {
    const r = runBalance({ seed: 'm', fights: 30, content, mode: 'mirror' });
    expect(r.mode).toBe('mirror');
    expect(r.fights).toBe(30);
    // A mirror lineup wins exactly half of its own appearances per pair.
    expect(r.classes.reduce((n, c) => n + c.wins, 0)).toBe(150);
  });

  it('preset-vs-default reports the tailored styles against the defaults', () => {
    const r = runBalance({ seed: 'p', fights: 20, content, mode: 'preset-vs-default' });
    const ids = r.styles!.map((s) => s.id);
    expect(ids).toContain('default');
    expect(ids.some((s) => s.startsWith('tailored:'))).toBe(true);
    expect(r.styles!.find((s) => s.id === 'default')!.appearances).toBe(100);
  });

  it('times fights only with an injected clock and flags slow medians', () => {
    let t = 0;
    const r = runBalance({ seed: 'c', fights: 4, content, clock: () => (t += 3) });
    expect(r.timing).toMatchObject({ record: 'none', medianMs: 3 });
    expect(r.flags!.some((f) => f.startsWith('median'))).toBe(true);
    expect(runBalance({ seed: 'c', fights: 4, content }).timing).toBeUndefined();
  });

  it('rejects a bad fight count', () => {
    expect(() => runBalance({ seed: 'b1', fights: -1, content })).toThrow(RangeError);
    expect(runBalance({ seed: 'b1', fights: 0, content }).fights).toBe(0);
  });

  it('Wilson interval', () => {
    const w = wilson(50, 100);
    expect(w.low).toBeCloseTo(0.4038, 3);
    expect(w.high).toBeCloseTo(0.5962, 3);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
});
