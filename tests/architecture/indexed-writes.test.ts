import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, listSourceFiles } from './rules';

/**
 * Roster membership and the fighters / results / fixtures maps are indexed on
 * transition drafts (core/model/indexes.ts). Production code changes them only
 * through the model helpers (setMembership, putFighter, removeFighter,
 * putResult, removeResult, putFixture, removeFixture), so the indexes can never
 * go stale. Tests, fixtures and the helpers themselves are exempt.
 */
const PATTERNS: { rule: string; re: RegExp }[] = [
  { rule: 'map-write', re: /\.(fighters|results|fixtures)\[[^\]]+\]\s*=(?!=)/ },
  { rule: 'map-delete', re: /delete\s+[\w.]*\.(fighters|results|fixtures)\[/ },
  { rule: 'club-write', re: /\.clubId\s*=(?!=)/ },
  { rule: 'status-write', re: /\.status\s*=\s*'(active|free-agent|retired|hired-blade|academy)'/ },
];

const EXEMPT = [/\.test\.ts$/, /\/testkit\//, /\/testing\.ts$/, /\/test-support\.ts$/, /\/testing\//, /^src\/core\/model\/indexes\.ts$/];

function indexedWriteViolations(path: string, text: string): string[] {
  if (EXEMPT.some((re) => re.test(path))) return [];
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    for (const p of PATTERNS) if (p.re.test(code)) out.push(`${path}:${i + 1} ${p.rule}: ${line.trim()}`);
  });
  return out;
}

describe('architecture: indexed state is written through the model helpers', () => {
  it('src/core has no direct membership or indexed-map writes', () => {
    const files = listSourceFiles('src/core');
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((f) => indexedWriteViolations(f, readFileSync(join(ROOT, f), 'utf8')));
    expect(violations).toEqual([]);
  });

  it('the checker catches each kind of write', () => {
    const p = 'src/core/economy/a.ts';
    expect(indexedWriteViolations(p, 'draft.fighters[id] = f;')).toHaveLength(1);
    expect(indexedWriteViolations(p, 'delete draft.results[id];')).toHaveLength(1);
    expect(indexedWriteViolations(p, 'f.clubId = club.id;')).toHaveLength(1);
    expect(indexedWriteViolations(p, "f.status = 'retired';")).toHaveLength(1);
    expect(indexedWriteViolations(p, 'if (f.clubId === club.id) x();')).toEqual([]);
    expect(indexedWriteViolations(p, "fx.status = 'played';")).toEqual([]);
    expect(indexedWriteViolations('src/core/economy/a.test.ts', 'f.clubId = null;')).toEqual([]);
  });
});
