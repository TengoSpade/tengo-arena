import { describe, expect, it } from 'vitest';
import { loadContent } from '../../../src/core/content';
import { loadRawContentFromDisk } from '../../lib/node-content';
import { CROSS_CASES, compareCrossRuns, runCrossCases, type CrossRun } from './cases';

const loaded = loadContent('default', loadRawContentFromDisk('default').raw);
if (!loaded.ok) throw new Error('content/default is invalid');
const content = loaded.value;

describe('cross-runtime cases', () => {
  const a = runCrossCases(content);

  it('cover six rounds with different seeds', () => {
    expect(CROSS_CASES).toHaveLength(6);
    expect(new Set(CROSS_CASES.map((c) => c.seed)).size).toBe(6);
    expect(a.results).toHaveLength(6);
  });

  it('are deterministic: a second run gives the same checksums and hashes', () => {
    const b = runCrossCases(content);
    expect(compareCrossRuns(a, b)).toEqual({ equal: true, differences: [] });
  });

  it('the incremental log hash equals the one recomputed over the finished log', () => {
    for (const r of a.results) {
      expect(r.hash).toBe(r.recomputedHash);
      expect(r.events).toBeGreaterThan(500);
    }
  });

  it('different rounds give different hashes', () => {
    expect(new Set(a.results.map((r) => r.hash)).size).toBe(6);
  });

  it('a difference in any hash, checksum, engine or content is reported with its round', () => {
    const tampered: CrossRun = JSON.parse(JSON.stringify(a)) as CrossRun;
    tampered.results[2]!.hash = 'deadbeef';
    tampered.results[4]!.checksum = '0000';
    tampered.engineVersion += 1;
    const c = compareCrossRuns(a, tampered);
    expect(c.equal).toBe(false);
    expect(c.differences.some((d) => d.startsWith('engine version'))).toBe(true);
    expect(c.differences.some((d) => d.startsWith(`${CROSS_CASES[2]!.id}: hash`))).toBe(true);
    expect(c.differences.some((d) => d.startsWith(`${CROSS_CASES[4]!.id}: checksum`))).toBe(true);
  });

  it('a missing round is reported', () => {
    const short: CrossRun = { ...a, results: a.results.slice(0, 5) };
    expect(compareCrossRuns(a, short).differences.join('\n')).toMatch(/missing in the browser/);
  });
});
