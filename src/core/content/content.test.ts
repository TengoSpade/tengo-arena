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
  SAVE_BOUNDS,
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
    expect(db.stats.list.map((s) => s.id)).toHaveLength(13);
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

  it('hashContent ignores leagues.matchRecords (it changes only how soon a save compacts a match), so tuning it keeps every stored match re-simulable', () => {
    const without = hashContent(raw() as RawContentFiles);
    const withIt = raw();
    withIt['leagues']!['matchRecords'] = { _doc: 'x', compactAiMatchesAfterWeeks: 3 };
    expect(hashContent(withIt as RawContentFiles)).toBe(without);
    (withIt['leagues']!['matchRecords'] as Mutable)['compactAiMatchesAfterWeeks'] = 1;
    expect(hashContent(withIt as RawContentFiles)).toBe(without);
    expect(loadContent('t', withIt as RawContentFiles, { profile: 'fixture' }).ok).toBe(true);
    // Anything else in the file still counts.
    (withIt['leagues']!['calendar'] as Mutable)['weekProcessingOrder'] = ['x'];
    expect(hashContent(withIt as RawContentFiles)).not.toBe(without);
  });

  it('leagues.matchRecords: whole weeks from 1 to 99; absent is allowed (the frozen fixture); the validator warns when no match would be compacted in season', () => {
    const base = raw();
    const with_ = (value: unknown): Record<string, Mutable> => {
      const f = raw();
      f['leagues']!['matchRecords'] = value;
      return f;
    };
    expect(errorsOf(base)).toEqual([]);
    expect(errorsOf(with_({ compactAiMatchesAfterWeeks: 3 }))).toEqual([]);
    for (const bad of [0, -1, 2.5, 100, '3']) expect(errorsOf(with_({ compactAiMatchesAfterWeeks: bad })).length).toBeGreaterThan(0);
    expect(errorsOf(with_({}))).not.toEqual([]);
    const warns = (n: number): boolean => {
      const r = loadContent('t', with_({ compactAiMatchesAfterWeeks: n }) as RawContentFiles, { profile: 'fixture' });
      return r.ok && r.value.warnings.some((w) => w.path === 'matchRecords.compactAiMatchesAfterWeeks');
    };
    // Matches run from week 5 (MW1) to week 23 (the final): a match of week w compacts at processing week w + N, so N = 18 still
    // compacts the first matchweek (processed in week 23) and N = 19 compacts nothing.
    const weeks = (base['leagues']!['calendar'] as { weeks: { index: number; phase: string }[] }).weeks;
    const matchWeeks = weeks.filter((w) => w.phase !== 'preseason').map((w) => w.index);
    expect([Math.min(...matchWeeks), Math.max(...matchWeeks)]).toEqual([5, 23]);
    expect([1, 3, 18].map(warns)).toEqual([false, false, false]);
    expect([19, 23, 99].map(warns)).toEqual([true, true, true]);
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

  it('refuses content whose counts exceed the save format (SAVE_BOUNDS), with the offending path and the bound', () => {
    expect(errorsOf(raw())).toEqual([]);
    const cases: { file: string; path: string; name: string; set: (files: Record<string, Mutable>, value: number) => void; value: number }[] = [
      { file: 'levels.json', path: 'offers.pending.maxQueued', name: 'queued level-ups', value: SAVE_BOUNDS.pendingLevelUps + 1, set: (f, v) => (((f['levels']!['offers'] as Mutable)['pending'] as Mutable)['maxQueued'] = v) },
      { file: 'combat.json', path: 'match.swaps.maxPerMatch', name: 'swaps per match', value: SAVE_BOUNDS.swapsPerMatch + 1, set: (f, v) => (((f['combat']!['match'] as Mutable)['swaps'] as Mutable)['maxPerMatch'] = v) },
      { file: 'combat.json', path: 'match.squad.reservesMax', name: 'reserves per squad', value: SAVE_BOUNDS.squadReserves + 1, set: (f, v) => (((f['combat']!['match'] as Mutable)['squad'] as Mutable)['reservesMax'] = v) },
      { file: 'combat.json', path: 'match.squad.starters', name: 'squad size', value: SAVE_BOUNDS.squadStarters + 1, set: (f, v) => (((f['combat']!['match'] as Mutable)['squad'] as Mutable)['starters'] = v) },
      { file: 'levels.json', path: 'offers.optionsPerLevelUp', name: 'options per level-up offer', value: SAVE_BOUNDS.levelUpOptions + 1, set: (f, v) => (((f['levels']!['offers'] as Mutable)['optionsPerLevelUp'] = v)) },
      { file: 'perks.json', path: 'rules.perkCap', name: 'perks per fighter', value: SAVE_BOUNDS.perksPerFighter + 1, set: (f, v) => (((f['perks']!['rules'] as Mutable)['perkCap'] = v)) },
    ];
    for (const k of cases) {
      const files = raw();
      k.set(files, k.value);
      const hit = errorsOf(files).find((i) => i.file === k.file && i.path === k.path);
      expect(hit, `${k.file} ${k.path}`).toBeDefined();
      expect(hit!.message).toContain(k.name);
      expect(hit!.message).toContain('SAVE_BOUNDS');
      expect(hit!.message).toContain(`${k.value}`);
    }
  });

  it('accepts content at or below the save format bounds, also a smaller squad of reserves and fewer queued level-ups', () => {
    const files = raw();
    (((files['levels']!['offers'] as Mutable)['pending'] as Mutable)['maxQueued']) = 1;
    (((files['combat']!['match'] as Mutable)['squad'] as Mutable)['reservesMax']) = 1;
    (((files['combat']!['match'] as Mutable)['squad'] as Mutable)['reservesMin']) = 0;
    (((files['combat']!['match'] as Mutable)['swaps'] as Mutable)['maxPerMatch']) = 1;
    (((files['levels']!['matchSquad'] as Mutable)['reserves'])) = 1;
    (((files['levels']!['matchSquad'] as Mutable)['maxSwapsPerMatch'])) = 1;
    expect(errorsOf(files)).toEqual([]);
  });

  it('refuses a rank step that changes a control duration, hard or soft (control never grows with rank)', () => {
    expect(errorsOf(raw())).toEqual([]);
    const rankRow = (files: Record<string, Mutable>, abilityId: string): Mutable => list(files['ability-ranks']!, 'ranks').find((r) => r['abilityId'] === abilityId)!;
    // soft control: Hamstring's Slowed (effects[1]) 2.5 s -> 3 s at rank 3
    const soft = raw();
    ((rankRow(soft, 'gutterknife_hamstring')['ranks'] as Mutable[])[1]!['changes'] as Mutable[]).push({ path: '/effects/1/durationS', from: 2.5, to: 3, kind: 'duration', label: 'Slowed 2.5 → 3 s' });
    const softIssue = errorsOf(soft).find((i) => i.file === 'ability-ranks.json' && i.message.includes('control duration'));
    expect(softIssue).toBeDefined();
    expect(softIssue!.message).toContain('effects[1]=2.5');
    expect(softIssue!.message).toContain('effects[1]=3');
    // hard control: Shield Bash's Stun (effects[?]) is still checked
    const hard = raw();
    const bash = list(hard['abilities']!, 'abilities').find((a) => a['id'] === 'oathguard_shield_bash')!;
    const at = (bash['effects'] as Mutable[]).findIndex((e) => e['status'] === 'stun');
    const ranksOfBash = rankRow(hard, 'oathguard_shield_bash')['ranks'] as Mutable[];
    (ranksOfBash[0]!['changes'] as Mutable[]).push({ path: `/effects/${at}/durationS`, from: 0.8, to: 1, kind: 'duration', label: 'Stunned 0.8 → 1 s' });
    expect(errorsOf(hard).some((i) => i.file === 'ability-ranks.json' && i.message.includes('control duration'))).toBe(true);
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
    expect(CONTENT_FILE_NAMES).toHaveLength(14);
  });
});
