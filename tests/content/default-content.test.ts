import { describe, expect, it } from 'vitest';
import { formatContentIssues, loadContent } from '../../src/core/content';
import { loadRawContentFromDisk } from '../../scripts/lib/node-content';

/**
 * The shipped theme must always load with zero errors under the full theme
 * rules (O8 class structure, O2 caps, 3 × 16 clubs, closed vocabularies,
 * exact units). Designers: run `npm run validate-content` for a readable report.
 */
describe('content/default', () => {
  const disk = loadRawContentFromDisk('default');
  const result = loadContent('default', disk.raw);

  it('has every file and valid JSON', () => {
    expect(disk.missing).toEqual([]);
    expect(disk.errors).toEqual([]);
  });

  it('passes schema and cross-file validation', () => {
    if (!result.ok) throw new Error(`content/default has errors:\n${formatContentIssues(result.error)}`);
    expect(result.ok).toBe(true);
  });

  it('matches the M1 structure', () => {
    if (!result.ok) return;
    const db = result.value;
    expect(db.classes.list).toHaveLength(42);
    expect(db.abilities.list).toHaveLength(42 * 4);
    expect(db.clubs.list).toHaveLength(48);
    expect(db.tiers.list.map((t) => t.clubCount)).toEqual([16, 16, 16]);
    expect(db.weeks.list).toHaveLength(db.economy.season.wageWeeksPerSeason);
    expect(db.development.decline.mentalDeclineScalesWithLifespan).toBe(true);
  });
});
