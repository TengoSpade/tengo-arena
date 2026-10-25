import { describe, expect, it } from 'vitest';
import { FIXTURE_CONTENT_RAW, fixtureContent } from '../testkit';
import { cloneJson } from '../util';
import {
  CONTENT_FILE_NAMES,
  fractionToBp,
  formatContentIssues,
  hashContent,
  loadContent,
  metresToCm,
  metresToMm,
  secondsToTicks,
  type ContentIssue,
  type RawContentFiles,
} from './index';

type Mutable = Record<string, unknown>;
const raw = (): Record<string, Mutable> => cloneJson(FIXTURE_CONTENT_RAW) as Record<string, Mutable>;
const list = (file: Mutable, key: string): Mutable[] => file[key] as Mutable[];

function errorsOf(files: Record<string, Mutable>, profile: 'theme' | 'fixture' = 'fixture'): ContentIssue[] {
  const result = loadContent('t', files as RawContentFiles, { profile });
  return result.ok ? [] : result.error.filter((i) => i.severity === 'error');
}

describe('loadContent: fixture content', () => {
  it('loads and indexes every registry', () => {
    const db = fixtureContent();
    expect(db.ref.id).toBe('fixture');
    expect(db.ref.hash).toMatch(/^[0-9a-f]{32}$/);
    expect(db.classes.list.length).toBe(6);
    expect(db.stats.list.map((s) => s.id)).toHaveLength(12);
    expect(db.tierByLevel(1).level).toBe(1);
    expect(db.weekByIndex(1).index).toBe(1);
    const k = db.classes.list[0]!;
    expect(db.classAbility(k.id, 'a1').classId).toBe(k.id);
    expect(() => db.classes.require('nope')).toThrow();
  });

  it('freezes the validated files', () => {
    const db = fixtureContent();
    expect(Object.isFrozen(db.files.classes.classes[0])).toBe(true);
  });

  it('hashContent is deterministic and changes with any value', () => {
    const a = raw();
    expect(hashContent(a as RawContentFiles)).toBe(hashContent(raw() as RawContentFiles));
    (list(a['clubs']!, 'clubs')[0]!)['startPrestige'] = 13;
    expect(hashContent(a as RawContentFiles)).not.toBe(hashContent(raw() as RawContentFiles));
  });
});

describe('loadContent: errors are precise and collected', () => {
  it('reports a missing file', () => {
    const files = raw();
    delete files['traits'];
    expect(errorsOf(files)).toContainEqual(expect.objectContaining({ file: 'traits.json', message: 'file is missing' }));
  });

  it('reports schema errors with a JSON path', () => {
    const files = raw();
    (list(files['classes']!, 'classes')[1]!)['complexity'] = 9;
    const issues = errorsOf(files);
    expect(issues.some((i) => i.file === 'classes.json' && i.path === 'classes[1].complexity')).toBe(true);
  });

  it('rejects a reference to an unknown ability', () => {
    const files = raw();
    const k = list(files['classes']!, 'classes')[0]!;
    (k['abilities'] as Mutable)['a1'] = 'no_such_ability';
    const issues = errorsOf(files);
    expect(issues.some((i) => i.path === 'classes[0].abilities.a1' && i.message.includes('unknown ability'))).toBe(true);
  });

  it('rejects a rule condition outside the closed vocabulary', () => {
    const files = raw();
    const preset = list(files['tactics-presets']!, 'presets')[0]!;
    ((preset['rules'] as Mutable[])[0]!['if'] as Mutable[])[0] = { cond: 'moon_is_full' };
    expect(errorsOf(files).some((i) => i.file === 'tactics-presets.json' && i.path.startsWith('presets[0].rules[0].if[0]'))).toBe(true);
  });

  it('checks rule parameters against the vocabulary (range and step)', () => {
    const files = raw();
    const presets = list(files['tactics-presets']!, 'presets');
    let found = false;
    for (const p of presets) {
      for (const rule of p['rules'] as Mutable[]) {
        for (const cond of rule['if'] as Mutable[]) {
          if (cond['cond'] === 'ally_hp_below' && !found) {
            cond['pct'] = 35;
            found = true;
          }
        }
      }
    }
    expect(found).toBe(true);
    expect(errorsOf(files).some((i) => i.message.includes('steps of 10'))).toBe(true);
  });

  it('requires trait opposites to be mutual', () => {
    const files = raw();
    const traits = list(files['traits']!, 'traits');
    const t = traits.find((x) => (x['opposites'] as string[]).length > 0)!;
    const other = traits.find((x) => x['id'] === (t['opposites'] as string[])[0])!;
    other['opposites'] = [];
    expect(errorsOf(files).some((i) => i.message.includes('as its opposite'))).toBe(true);
  });

  it('rejects duplicate club ids', () => {
    const files = raw();
    const clubs = list(files['clubs']!, 'clubs');
    clubs[1]!['id'] = clubs[0]!['id'];
    expect(errorsOf(files).some((i) => i.message.includes('duplicate club id'))).toBe(true);
  });

  it('rejects inherited names (constructor, __proto__) as ids', () => {
    // "constructor" passes the id pattern, so the cross-file check names it; the others fail the pattern.
    const files = raw();
    list(files['clubs']!, 'clubs')[0]!['id'] = 'constructor';
    expect(errorsOf(files).some((i) => i.message.includes('club id "constructor" is a reserved name'))).toBe(true);
    for (const name of ['__proto__', 'toString', 'hasOwnProperty']) {
      const other = raw();
      list(other['clubs']!, 'clubs')[0]!['id'] = name;
      expect(errorsOf(other).length).toBeGreaterThan(0);
    }
  });

  it('requires integers everywhere in economy.json', () => {
    const files = raw();
    (files['economy']!['season'] as Mutable)['homeFixturesPerClub'] = 8.5;
    expect(errorsOf(files).some((i) => i.file === 'economy.json' && i.message.includes('integer'))).toBe(true);
  });

  it('rejects values that do not convert exactly to engine units', () => {
    const files = raw();
    const ability = list(files['abilities']!, 'abilities').find((a) => a['kind'] === 'active')!;
    ability['cooldownS'] = 6.03;
    expect(errorsOf(files).some((i) => i.message.includes('does not convert exactly to ticks'))).toBe(true);
  });

  it('enforces the shipped-theme class counts only in the theme profile', () => {
    expect(errorsOf(raw(), 'fixture')).toEqual([]);
    const issues = errorsOf(raw(), 'theme');
    expect(issues.some((i) => i.message.includes('expected 42 classes'))).toBe(true);
    expect(issues.some((i) => i.message.includes('base classes, expected 6'))).toBe(true);
  });

  it('formats issues one per line, errors first', () => {
    const text = formatContentIssues([
      { file: 'a.json', path: '', message: 'w', severity: 'warning' },
      { file: 'b.json', path: 'x[1]', message: 'e', severity: 'error' },
    ]);
    expect(text.split('\n')).toEqual(['ERROR b.json › x[1]: e', 'warn  a.json: w']);
  });
});

describe('units', () => {
  it('convert exactly or throw', () => {
    expect(secondsToTicks(1.5)).toBe(30);
    expect(metresToCm(0.5)).toBe(50);
    expect(metresToMm(1.2)).toBe(1200);
    expect(fractionToBp(0.04)).toBe(400);
    expect(() => secondsToTicks(0.03)).toThrow(RangeError);
  });

  it('every content file name has a schema', () => {
    expect(CONTENT_FILE_NAMES).toHaveLength(11);
  });
});
