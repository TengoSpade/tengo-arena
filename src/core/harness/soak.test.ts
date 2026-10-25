import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testkit';
import { SOAK_CHECKS, runSoak } from './index';

describe('soak harness (stub until core/game)', () => {
  it('reports every catalogue check', () => {
    const report = runSoak({ seed: 's1', seasons: 3, content: fixtureContent() });
    expect(report.checks.map((c) => c.id)).toEqual(SOAK_CHECKS.map((c) => c.id));
    expect(report.seasonsRequested).toBe(3);
  });
});
