import { describe, expect, it } from 'vitest';
import { formatContentIssues, hashContent, loadContent, parseContentFiles, stripDocKeys } from '../../src/core/content';
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

  // The production build ships the files without their `_` documentation keys (scripts/vite/strip-doc-keys.ts).
  // The game must behave exactly as with the source files: same validation, same data.
  it('loads the same without its documentation keys (what the production build ships)', () => {
    const stripped = stripDocKeys(disk.raw);
    expect(JSON.stringify(stripped).length).toBeLessThan(JSON.stringify(disk.raw).length);
    const sourceHash = hashContent(disk.raw);
    const shipped = loadContent('default', stripped, { hash: sourceHash });
    if (!shipped.ok || !result.ok) throw new Error(`stripped content has errors:
${formatContentIssues(shipped.ok ? [] : shipped.error)}`);
    expect(shipped.value.ref).toEqual(result.value.ref); // same content identity: saves and match reports stay valid
    expect(shipped.value.warnings).toEqual(result.value.warnings);
    // Nothing but the keys differs: strip the parsed source and it equals the parsed stripped files.
    const parsedSource = parseContentFiles(disk.raw);
    const parsedShipped = parseContentFiles(stripped);
    if (!parsedSource.ok || !parsedShipped.ok) throw new Error('parse failed');
    expect(parsedShipped.value).toEqual(stripDocKeys(parsedSource.value));
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

  // Owner rule: control durations never grow with rank. The validator checks hard and soft control for every
  // rank row (cc_hard and cc_soft); this pins the row that used to lengthen Slowed / Sluggish at rank 3.
  it('Torpor Field: Slowed and Sluggish keep their 3 s at every rank; rank 3 is a shorter cooldown instead', () => {
    if (!result.ok) return;
    const db = result.value;
    const ability = db.abilities.require('hourglass_sage_torpor_field');
    const row = db.files['ability-ranks'].ranks.find((r) => r.abilityId === 'hourglass_sage_torpor_field')!;
    const durations = ability.effects.flatMap((e) => (e.type === 'status' ? [e.durationS] : []));
    expect(durations).toEqual([3, 3]);
    for (const rank of row.ranks) for (const change of rank.changes) expect(change.path).not.toMatch(/durationS$/);
    const rank3 = row.ranks.find((r) => r.rank === 3)!;
    expect(rank3.changes).toEqual([expect.objectContaining({ path: '/cooldownS', from: ability.kind === 'active' ? ability.cooldownS : -1, to: 10.5, kind: 'cooldown' })]);
  });
});
