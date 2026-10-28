/**
 * simContentHash (05-technical-m2 §A4, A11, tech-026; WP-M2A). Three guards the architect specified, plus a sweep:
 * 1. Read-set guard: a corpus of seeded rounds runs on a ContentDB whose objects record every property path the fight
 *    touches; a path the replay hash does not read fails the test (the hash is of what the sim compiles, so a content
 *    key it never compiles can never reach it).
 * 2. Keys that must move the hash (captaincy grades, acting-captain penalty, Freshness labels, an ability coefficient,
 *    a preset rule, a combat constant, and more).
 * 3. Excluded keys (names, descriptions, icons, economy, leagues, calendar, development outside captaincy ...) leave
 *    the hash and every round checksum of the corpus unchanged.
 * Sweep: every distinct kind of leaf the fight reads, changed one at a time, moves the hash.
 */
import { describe, expect, it } from 'vitest';
import { buildContentDB, loadContent, type ContentDB, type ContentFileName, type ContentFiles, type RawContentFiles } from '../content';
import { corpusRound } from './corpus';
import { inspectRoundAt, simContentHash, simulateRound } from './index';

const rawFiles = import.meta.glob('../../../content/default/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

function loadDefault(): ContentDB {
  const raw: RawContentFiles = {};
  for (const [path, json] of Object.entries(rawFiles)) raw[path.split('/').pop()!.replace(/\.json$/, '') as ContentFileName] = json;
  const r = loadContent('default', raw);
  if (!r.ok) throw new Error(`content/default invalid: ${r.error.map((e) => e.message).join('; ')}`);
  return r.value;
}

const content = loadDefault();
const corpus = Array.from({ length: 24 }, (_, i) => corpusRound(content, i));

// ---- Helpers: content files as editable JSON ------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const cloneFiles = (): Record<string, Json> => structuredClone(content.files) as unknown as Record<string, Json>;
const dbOf = (files: Record<string, Json>): ContentDB => buildContentDB(content.ref, files as unknown as ContentFiles, []);

/** A path is segments joined by '/' ('abilities/abilities/3/effects/0/amount/scale/0/coef'). */
function at(files: Record<string, Json>, path: string): { parent: Record<string, Json> | Json[]; key: string; value: Json } {
  const parts = path.split('/');
  let node: Json = files;
  for (const p of parts.slice(0, -1)) node = (node as Record<string, Json>)[p]!;
  const key = parts[parts.length - 1]!;
  return { parent: node as Record<string, Json>, key, value: (node as Record<string, Json>)[key]! };
}

const shapeOf = (path: string): string => path.replace(/\/\d+(?=\/|$)/g, '/#');
const lastKey = (shape: string): string => shape.slice(shape.lastIndexOf('/') + 1);

/** Every value the content gives each kind of path (array positions folded). */
function valuesByShape(files: Record<string, Json>): Map<string, Map<string, Json>> {
  const out = new Map<string, Map<string, Json>>();
  const walk = (node: Json, path: string): void => {
    const shape = shapeOf(path);
    const seen = out.get(shape) ?? new Map<string, Json>();
    seen.set(JSON.stringify(node), node);
    out.set(shape, seen);
    if (node !== null && typeof node === 'object') {
      if (Array.isArray(node)) node.forEach((x, i) => walk(x, `${path}/${i}`));
      else for (const [k, x] of Object.entries(node)) walk(x, path === '' ? k : `${path}/${k}`);
    }
  };
  walk(files, '');
  return out;
}

/**
 * Values to try in place of a leaf: a number moved by 1 and by more, a flag flipped; a string or null becomes another
 * value the content has at that kind of path, then at any path with the same last key (the other enumerated values),
 * then an unknown value.
 */
function replacements(v: Json, path: string, shapes: Map<string, Map<string, Json>>): Json[] {
  if (typeof v === 'number') return [v + 1, v * 2 + 1];
  if (typeof v === 'boolean') return [!v];
  const exact = [...(shapes.get(shapeOf(path))?.values() ?? [])];
  const family = [...shapes.entries()].filter(([shape]) => lastKey(shape) === lastKey(shapeOf(path))).flatMap(([, vs]) => [...vs.values()]);
  const out = new Map<string, Json>();
  for (const x of [...exact, ...family]) if (JSON.stringify(x) !== JSON.stringify(v) && (v === null || x === null || typeof x !== 'object')) out.set(JSON.stringify(x), structuredClone(x));
  out.set('fallback', v === null ? 'set~' : `${String(v)}~`);
  return [...out.values()].slice(0, 8);
}

/** A cheap change for sweeps over thousands of leaves: a number plus one, a flag flipped, a string with a suffix. */
function bump(files: Record<string, Json>, path: string): void {
  const { parent, key, value } = at(files, path);
  (parent as Record<string, Json>)[key] = typeof value === 'number' ? value + 1 : typeof value === 'boolean' ? !value : `${String(value)}~`;
}

/** Change a leaf to its first replacement (for the tests that name their leaves). */
function edit(files: Record<string, Json>, path: string): void {
  const { parent, key, value } = at(files, path);
  (parent as Record<string, Json>)[key] = replacements(value, path, valuesByShape(files))[0]!;
}

/** Every leaf path under `root` (a path or '' for all), in document order. */
function leaves(files: Record<string, Json>, root: string, keep: (path: string, value: Json) => boolean = () => true): string[] {
  const out: string[] = [];
  const walk = (node: Json, path: string): void => {
    if (node !== null && typeof node === 'object') {
      if (Array.isArray(node)) node.forEach((x, i) => walk(x, `${path}/${i}`));
      else for (const [k, x] of Object.entries(node)) walk(x, path === '' ? k : `${path}/${k}`);
    } else if (node !== null && keep(path, node)) out.push(path);
  };
  walk(root === '' ? files : at(files, root).value, root);
  return out;
}

/** The first leaf under a root whose path matches. */
function firstLeaf(root: string, match: RegExp, keep: (v: Json) => boolean = () => true): string {
  const found = leaves(cloneFiles(), root, (p, v) => match.test(p) && keep(v))[0];
  if (!found) throw new Error(`no leaf under ${root} matching ${String(match)}`);
  return found;
}

const baseline = simContentHash(content);
const baselineRounds = corpus.map(({ input, seed }) => simulateRound(input, seed, content, { record: 'none' }).result);
const baselineFull = corpus.slice(0, 4).map(({ input, seed }) => simulateRound(input, seed, content, { record: 'full' }).log!.hash);

// ---- 1. The read-set guard -------------------------------------------------------------------------

const OBJ = Symbol('object');

interface Recorder {
  db: ContentDB;
  reads: Map<string, unknown>;
  record(on: boolean): void;
}

/**
 * A ContentDB over a deep proxy of a copy of the content files, recording every property path read while on:
 * a value read as its path, an object read as its path too, `in` as `path/key?`, key listing as `path/*`.
 * JSON.stringify of a content object (rankedAbilityDef copies the whole definition) is not a use of its names, so
 * `toJSON` hands back the raw copy and records nothing for the bulk read.
 */
function recorder(): Recorder {
  const raw = structuredClone(content.files) as unknown as object;
  const reads = new Map<string, unknown>();
  let on = false;
  const proxies = new WeakMap<object, object>();
  const wrap = (target: object, path: string): object => {
    const known = proxies.get(target);
    if (known) return known;
    const proxy = new Proxy(target, {
      get(t, key) {
        if (typeof key === 'symbol') return Reflect.get(t, key);
        const v: unknown = Reflect.get(t, key);
        if (v === undefined && key === 'toJSON') return () => t;
        if (typeof v === 'function') return v;
        const p = `${path}/${key}`;
        const isObject = v !== null && typeof v === 'object';
        if (on) reads.set(p, isObject ? OBJ : v);
        return isObject ? wrap(v, p) : v;
      },
      has(t, key) {
        const has = Reflect.has(t, key);
        if (on && typeof key === 'string') reads.set(`${path}/${key}?`, has);
        return has;
      },
      ownKeys(t) {
        if (on) reads.set(`${path}/*`, OBJ);
        return Reflect.ownKeys(t);
      },
    });
    proxies.set(target, proxy);
    return proxy;
  };
  const files = wrap(raw, '') as ContentFiles;
  return { db: buildContentDB(content.ref, files, []), reads, record: (v) => (on = v) };
}

// What simContentHash reads on its own instrumented copy, and what the corpus of rounds (and probes) reads on another.
const hashRun = recorder();
hashRun.record(true);
const hashed = simContentHash(hashRun.db);
hashRun.record(false);

const fightRun = recorder();
fightRun.record(true);
for (const { input, seed } of corpus) {
  simulateRound(input, seed, fightRun.db, { record: 'full' });
  simulateRound(input, seed, fightRun.db, { record: 'none' });
}
for (const { input, seed } of corpus.slice(0, 6)) for (const tick of [0, 60, 200, 5000]) inspectRoundAt(input, seed, fightRun.db, tick);
fightRun.record(false);

/** The first numeric leaf the corpus read whose path matches. */
function readNumber(match: RegExp): string {
  for (const [p, v] of fightRun.reads) if (typeof v === 'number' && match.test(p)) return p.slice(1);
  throw new Error(`the corpus read no number matching ${String(match)}`);
}

describe('read-set guard: the fight reads no content that the replay hash does not read', () => {
  it('the instrumented content gives the same hash as the plain content (recording is inert)', () => {
    expect(hashed).toBe(baseline);
  });

  it('every path the corpus of rounds touches is read by simContentHash', () => {
    const missing = [...fightRun.reads.keys()].filter((p) => !hashRun.reads.has(p));
    expect(missing.slice(0, 25)).toEqual([]);
    // The corpus must have touched a good part of the content for this to mean anything.
    expect(fightRun.reads.size).toBeGreaterThan(5000);
    const sections = new Set([...fightRun.reads.keys()].map((p) => p.split('/')[1]));
    for (const s of ['combat', 'classes', 'abilities', 'traits', 'perks', 'ability-ranks', 'tactics-presets', 'development', 'levels']) expect(sections.has(s), s).toBe(true);
    // And it must not have touched what the hash is documented not to depend on.
    for (const s of ['economy', 'leagues', 'names', 'clubs', 'races']) expect(sections.has(s), s).toBe(false);
  });

  it('reads outside simTables are few and listed: ranked kits and compiled rules (ability-ranks, tactics-presets, the ability definitions they use)', () => {
    // Tables compile before the first fight; run again with recording off for the build and on for the fights only.
    const direct = recorder();
    inspectRoundAt(corpus[0]!.input, corpus[0]!.seed, direct.db, 1);
    direct.record(true);
    for (const { input, seed } of corpus) simulateRound(input, seed, direct.db, { record: 'none' });
    direct.record(false);
    const sections = new Set([...direct.reads.keys()].map((p) => p.split('/')[1]));
    expect([...sections].sort()).toEqual(['abilities', 'ability-ranks', 'classes', 'combat', 'tactics-presets'].filter((s) => sections.has(s)));
    for (const p of direct.reads.keys()) expect(hashRun.reads.has(p), p).toBe(true);
  });

  // Kinds of leaf the fight reads that cannot move the hash, and why. Every other kind must.
  const INERT: Record<string, string> = {
    '/tactics-presets/presets/#/rules/#/id': 'a rule id only labels the rule; events number rules by index',
  };

  it('every kind of leaf the fight reads moves the hash when changed (sweep; SIM_HASH_SWEEP=all runs every kind)', () => {
    const shapes = valuesByShape(cloneFiles());
    const byShape = new Map<string, string[]>();
    for (const [p, v] of fightRun.reads) {
      if (v === OBJ || v === undefined || p.endsWith('?') || p.endsWith('/length') || p.endsWith('/*')) continue;
      byShape.set(shapeOf(p), [...(byShape.get(shapeOf(p)) ?? []), p]);
    }
    const kinds = [...byShape.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    expect(kinds.length).toBeGreaterThan(150);
    const step = import.meta.env['SIM_HASH_SWEEP'] === 'all' ? 1 : 6;
    const unmoved: string[] = [];
    let tried = 0;
    let loud = 0;
    kinds.forEach(([shape, paths], i) => {
      if (i % step !== 0) return;
      tried++;
      // A kind can be dead for one member (a basic attack's cast time) and live for another: try a few spread members,
      // each with a few replacement values, until one moves the hash.
      const members = [...new Set(Array.from({ length: 24 }, (_, k) => paths[Math.floor(((paths.length - 1) * k) / 23)]!))];
      let moved = false;
      for (const path of members) {
        const value = at(cloneFiles(), path.slice(1)).value;
        for (const replacement of replacements(value, path.slice(1), shapes)) {
          const files = cloneFiles();
          const { parent, key } = at(files, path.slice(1));
          (parent as Record<string, Json>)[key] = replacement;
          try {
            moved = simContentHash(dbOf(files)) !== baseline;
          } catch {
            // A value the compile cannot resolve fails loudly instead of hashing: not silent either.
            moved = true;
            loud++;
          }
          if (moved) break;
        }
        if (moved) break;
      }
      if (!moved) unmoved.push(shape);
    });
    expect(unmoved.filter((shape) => !(shape in INERT))).toEqual([]);
    expect(tried).toBeGreaterThan(25);
    expect(loud).toBeLessThan(tried / 3);
    // The list above is not a place to hide leaves: a listed kind that is read must really be inert in the sweep.
    if (step === 1) expect(unmoved.sort()).toEqual(Object.keys(INERT).sort());
  }, 300_000);
});

// ---- 2. Keys that must move the hash ---------------------------------------------------------------

describe('changing what the fight reads changes the hash', () => {
  const firstNumber = (root: string, match: RegExp): string => firstLeaf(root, match, (v) => typeof v === 'number');
  const cases: [string, () => string][] = [
    ['captaincy grade threshold', () => 'development/captaincy/grades/0/minCq'],
    ['captaincy grade aura', () => 'development/captaincy/grades/0/auraComposure'],
    ['captaincy grade rally', () => 'development/captaincy/grades/1/rallyComposure'],
    ['actingCaptainCqPenalty', () => 'development/captaincy/actingCaptainCqPenalty'],
    ['Freshness label minimum (levels.json)', () => 'levels/freshness/labels/1/min'],
    ['Freshness label id', () => 'levels/freshness/labels/0/id'],
    ['an ability coefficient', () => firstNumber('abilities/abilities', /\/amount\/scale\/0\/coef$/)],
    ['an ability start cooldown', () => readNumber(/^\/abilities\/abilities\/\d+\/startCooldownS$/)],
    ['an ability range', () => firstNumber('abilities/abilities', /\/rangeM$/)],
    ['a preset rule parameter (condition threshold)', () => firstNumber('tactics-presets/presets', /\/rules\/\d+\/if\/\d+\/pct$/)],
    ['a preset rule cooldown', () => 'tactics-presets/presets/0/rules/0/cooldownS'],
    ['a preset stance', () => 'tactics-presets/presets/0/stance'],
    ['a combat constant (mitigation)', () => 'combat/damage/mitigationConstant'],
    ['a combat constant (ticks per second)', () => 'combat/tick/ticksPerSecond'],
    ['a derived stat constant', () => 'combat/derived/maxHp/perTgh'],
    ['the tick length of the header', () => 'combat/tick/tickMs'],
    ['opening focus', () => 'combat/derived/focus/startFull'],
    ['the recorded frame interval', () => 'combat/events/frameEveryTicks'],
    ['a status stacking rule', () => 'combat/statuses/3/stacking'],
    ['a class base value', () => 'classes/classes/2/base/hp'],
    ['a class power attribute weight', () => firstNumber('classes/classes', /\/powerAttrs\/\w+$/)],
    ['an ability rank change', () => firstNumber('ability-ranks/ranks', /\/changes\/0\/to$/)],
    ['the perk cap', () => 'perks/rules/perkCap'],
    ['a perk passive value', () => readNumber(/^\/perks\/perks\/\d+\/passive\/.*\/(value|baseCenti|coefBp|amount)\w*$/)],
    ['a trait effect the sim applies', () => readNumber(/^\/traits\/traits\/\d+\/effects\/\d+\/\w+$/)],
    ['a vocabulary parameter default', () => firstNumber('tactics-presets/vocabulary/conditions', /\/params\/\d+\/default$/)],
    ['the custom rule limit', () => 'tactics-presets/limits/maxRules'],
  ];

  it.each(cases)('%s', (_name, pathOf) => {
    const files = cloneFiles();
    const path = pathOf();
    const before = at(files, path).value;
    edit(files, path);
    expect(at(files, path).value, path).not.toEqual(before);
    expect(simContentHash(dbOf(files)), path).not.toBe(baseline);
  });

  it('is a pure function of the content: the same content again gives the same hash, and the cache returns it', () => {
    expect(simContentHash(dbOf(cloneFiles()))).toBe(baseline);
    expect(simContentHash(content)).toBe(baseline);
    expect(baseline).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ---- 3. Excluded keys ---------------------------------------------------------------------------------

describe('changing what the fight does not read changes neither the hash nor any round checksum', () => {
  /** Hash, and the corpus (results at none; event hashes at full for the first few) on the edited content. */
  function unaffected(files: Record<string, Json>, rounds = 24): void {
    const db = dbOf(files);
    expect(simContentHash(db)).toBe(baseline);
    corpus.slice(0, rounds).forEach(({ input, seed }, i) => expect(simulateRound(input, seed, db, { record: 'none' }).result).toEqual(baselineRounds[i]));
    corpus.slice(0, Math.min(4, rounds / 3)).forEach(({ input, seed }, i) => expect(simulateRound(input, seed, db, { record: 'full' }).log!.hash).toBe(baselineFull[i]));
  }

  const keys: [string, string][] = [
    ['a class name', 'classes/classes/0/name'],
    ['a class flavor text', 'classes/classes/1/flavor'],
    ['a class description', 'classes/classes/2/description'],
    ['a class icon', 'classes/classes/3/iconId'],
    ['an ability name', 'abilities/abilities/0/name'],
    ['an ability description', 'abilities/abilities/4/description'],
    ['an ability icon', 'abilities/abilities/9/iconId'],
    ['a status name', 'combat/statuses/0/name'],
    ['a status description', 'combat/statuses/2/description'],
    ['a status icon', 'combat/statuses/4/iconId'],
    ['a perk name', 'perks/perks/0/name'],
    ['a perk text', 'perks/perks/3/text'],
    ['a trait name', 'traits/traits/0/name'],
    ['a trait flavor', 'traits/traits/1/flavor'],
    ['a race name', 'races/races/0/name'],
    ['a preset name', 'tactics-presets/presets/0/name'],
    ['a preset summary', 'tactics-presets/presets/1/summary'],
    ['a rule id', 'tactics-presets/presets/0/rules/0/id'],
    ['a vocabulary label', 'tactics-presets/vocabulary/conditions/0/label'],
    ['a vocabulary description', 'tactics-presets/vocabulary/actions/0/description'],
    ['a Freshness label text and icon', 'levels/freshness/labels/0/label'],
    ['a captaincy grade label (name, not the numbers)', 'development/captaincy/grades/0/label'],
    ['a captaincy grade mentoring multiplier', 'development/captaincy/grades/0/mentorDevMult'],
    ['captaincy weights (development outside the grades)', firstLeaf('development/captaincy/weights', /./)],
  ];

  it.each(keys)('%s', (_name, path) => {
    const files = cloneFiles();
    const before = at(files, path).value;
    edit(files, path);
    expect(at(files, path).value, path).not.toEqual(before);
    unaffected(files, 6);
  });

  const sections: [string, (path: string) => boolean][] = [
    ['economy.json (wages, prices, budgets)', (p) => p.startsWith('economy/')],
    ['leagues.json (calendar, tiers, venues, match records)', (p) => p.startsWith('leagues/')],
    ['names.json and clubs.json', (p) => p.startsWith('names/') || p.startsWith('clubs/')],
    ['development.json outside captaincy.grades and actingCaptainCqPenalty', (p) => p.startsWith('development/') && !p.startsWith('development/captaincy/grades/') && p !== 'development/captaincy/actingCaptainCqPenalty'],
    ['levels.json outside the Freshness labels ids and minimums', (p) => p.startsWith('levels/') && !/^levels\/freshness\/labels\/\d+\/(id|min)$/.test(p)],
    ['races.json', (p) => p.startsWith('races/')],
    ['every presentation field (name, description, flavor, text, summary, label, icon) of classes, abilities, statuses, perks, traits and presets', (p) => /^(classes\/classes|abilities\/abilities|combat\/statuses|perks\/perks|traits\/traits|tactics-presets\/presets)\/.*\/(name|plural|description|flavor|text|summary|iconId|icon|effectText|tradeoff)$|^tactics-presets\/vocabulary\/.*\/(label|description|note)$/.test(p)],
  ];

  it.each(sections)('%s', (_name, inSection) => {
    const files = cloneFiles();
    const paths = leaves(files, '', (p) => inSection(p));
    expect(paths.length).toBeGreaterThan(10);
    for (const p of paths) bump(files, p);
    unaffected(files);
  });

  it('a changed career content hash (ContentDB.ref.hash) is not a sim input either: the replay hash ignores it', () => {
    const other = buildContentDB({ ...content.ref, hash: 'ffffffffffffffffffffffffffffffff' }, cloneFiles() as unknown as ContentFiles, []);
    expect(simContentHash(other)).toBe(baseline);
    // The fight header records the career hash, so its event hash differs; the outcome does not.
    const { input, seed } = corpus[0]!;
    expect(simulateRound(input, seed, other, { record: 'none' }).result).toEqual(baselineRounds[0]);
  });
});
