import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testkit';
import { runBalance } from './index';

describe('balance harness (stub until core/sim)', () => {
  it('is deterministic per seed and counts every fight for both sides', () => {
    const content = fixtureContent();
    const a = runBalance({ seed: 'b1', fights: 500, content });
    expect(a).toEqual(runBalance({ seed: 'b1', fights: 500, content }));
    expect(a.classes.reduce((n, r) => n + r.appearances, 0)).toBe(1000);
    expect(a.classes.reduce((n, r) => n + r.wins, 0)).toBe(500);
    expect(a.classes.map((r) => r.classId).sort()).toEqual(content.classes.list.map((k) => k.id).sort());
    expect(a.contentHash).toBe(content.ref.hash);
  });

  it('rejects a bad fight count', () => {
    expect(() => runBalance({ seed: 'b1', fights: -1, content: fixtureContent() })).toThrow(RangeError);
  });
});
