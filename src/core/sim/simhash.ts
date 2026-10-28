/**
 * simContentHash (05-technical-m2 §A4, tech-026; owner answer to Q56): a hash of exactly the content a fight reads, so a
 * stored match stays replayable across updates that change nothing the fight reads (names, clubs, economy, calendar)
 * and stops being replayable when anything it reads changes.
 *
 * It is the hash of a canonical serialization of what the sim COMPILES, not of a list of content keys:
 * - the whole SimTables(content): constants, statuses, every ability, class (with its combat base), trait and perk
 *   compiled to integer units, the Freshness penalty and its labels, the captain grades and the acting-captain penalty,
 *   the fight header's tick length, the opening focus and the perk cap. Source definitions (`def`) and caches are left
 *   out: names, descriptions and icons live only there, and the compiled tables hold everything the fight uses;
 * - every ranked ability (ranks 2 and 3 of each rankable one), compiled the way a ranked kit compiles it;
 * - every preset compiled by core/tactics against every rank combination of its two actives (a rule reads the
 *   ability's range, cost and target), rule ids left out (the events number rules);
 * - what core/tactics validates a custom rule list against: the vocabulary ids and the rule and condition limits.
 * A content key reaches the hash only by being compiled, so a key the fight reads but nothing compiles cannot exist:
 * the read-set guard (simhash.test.ts) runs a corpus of rounds on a ContentDB that records every property path it
 * reads, fails when the fight reads a path the hash computation does not, and a sweep over the read leaves checks that
 * changing each one moves the hash.
 *
 * The career content hash (core/content hashContent, saves, GameState.content) is unchanged. Cached per ContentDB.
 */
import type { ContentDB } from '../content';
import { StreamHasher } from '../util';
import { compileTactics, resolveTactics } from '../tactics';
import { rankedAbility, simTables, type CAbility, type CClass, type SimTables } from './tables';

const cache = new WeakMap<ContentDB, string>();

/** Keys of compiled structures that are not compiled content: the source definitions, the ContentDB itself, the compile context and the lazy kit cache. */
const NOT_COMPILED: ReadonlySet<string> = new Set(['content', 'def', 'buildCtx', 'kits']);

/** Canonical text of a value: sorted keys and map entries, typed arrays as arrays, repeated objects by first-visit index. */
class Canon {
  private readonly seen = new Map<object, number>();
  private out = '';

  constructor(private readonly skip: ReadonlySet<string>) {}

  text(v: unknown): string {
    this.out = '';
    this.write(v);
    return this.out;
  }

  private write(v: unknown): void {
    switch (typeof v) {
      case 'number':
        this.out += Number.isFinite(v) ? String(v) : JSON.stringify(String(v));
        return;
      case 'string':
        this.out += JSON.stringify(v);
        return;
      case 'boolean':
        this.out += v ? 'true' : 'false';
        return;
      case 'undefined':
        this.out += 'null';
        return;
      case 'object':
        if (v === null) this.out += 'null';
        else this.writeObject(v);
        return;
      default:
        throw new Error(`simContentHash: cannot serialize a ${typeof v} in the compiled tables`);
    }
  }

  private writeObject(v: object): void {
    const at = this.seen.get(v);
    if (at !== undefined) {
      this.out += `@${at}`;
      return;
    }
    this.seen.set(v, this.seen.size);
    if (Array.isArray(v) || ArrayBuffer.isView(v)) {
      const items = Array.from(v as ArrayLike<unknown>);
      this.out += '[';
      items.forEach((x, i) => {
        if (i > 0) this.out += ',';
        this.write(x);
      });
      this.out += ']';
    } else if (v instanceof Map) {
      const entries = [...v.entries()].map(([k, x]) => [typeof k === 'string' ? k : JSON.stringify(k), x] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      this.out += 'M{';
      entries.forEach(([k, x], i) => {
        if (i > 0) this.out += ',';
        this.out += JSON.stringify(k) + ':';
        this.write(x);
      });
      this.out += '}';
    } else if (v instanceof Set) {
      this.out += 'S[';
      [...v].map((x) => JSON.stringify(x)).sort().forEach((x, i) => (this.out += (i > 0 ? ',' : '') + x));
      this.out += ']';
    } else {
      const rec = v as Record<string, unknown>;
      const keys = Object.keys(rec)
        .filter((k) => !this.skip.has(k) && rec[k] !== undefined)
        .sort();
      this.out += '{';
      keys.forEach((k, i) => {
        if (i > 0) this.out += ',';
        this.out += JSON.stringify(k) + ':';
        this.write(rec[k]);
      });
      this.out += '}';
    }
  }
}

/** The fields of a compiled rule list that are behaviour; rule, condition, selector and predicate ids are labels of the codes next to them. */
function ruleListSurface(compiled: ReturnType<typeof compileTactics>): unknown {
  const internal = compiled.internal as {
    rules: { index: number; conds: { id: string }[]; action: unknown; sel: { id: string }; only: { id: string } | null; prefer: { id: string } | null; cooldownTicks: number }[];
    [k: string]: unknown;
  };
  const noId = <T extends { id: string }>(x: T | null): unknown => {
    if (x === null) return null;
    const { id: _id, ...rest } = x;
    return rest;
  };
  return {
    ruleCount: compiled.ruleCount,
    stance: compiled.stance,
    internal: {
      ...internal,
      rules: internal.rules.map((r) => ({ index: r.index, conds: r.conds.map(noId), action: r.action, sel: noId(r.sel), only: noId(r.only), prefer: noId(r.prefer), cooldownTicks: r.cooldownTicks })),
    },
  };
}

function compute(content: ContentDB): string {
  const tb: SimTables = simTables(content);
  const hasher = new StreamHasher();
  const canon = new Canon(NOT_COMPILED);

  // 1. Everything simTables compiled.
  hasher.update(canon.text(tb));

  // 2. Ranked abilities, compiled once each (ranks 2 and 3 of every rankable ability).
  const ranked = new Map<string, CAbility>();
  const abilityIds = [...tb.abilities.keys()].sort();
  for (const id of abilityIds) {
    const row = content.abilityRanks(id);
    if (!row || !row.rankable) continue;
    for (const rank of [2, 3]) ranked.set(`${id}@${rank}`, rankedAbility(tb, tb.abilities.get(id)!, rank));
  }
  hasher.update(canon.text(Object.fromEntries([...ranked.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)))));

  // 3. Presets compiled against every rank combination of the class's two actives.
  const ranksOf = (ab: CAbility): number[] => (ranked.has(`${ab.id}@2`) ? [1, 2, 3] : [1]);
  const abilityAt = (ab: CAbility, rank: number): CAbility => (rank === 1 ? ab : ranked.get(`${ab.id}@${rank}`)!);
  const presets: Record<string, unknown> = {};
  for (const preset of [...content.presets.list].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const cls: CClass | undefined = tb.classes.get(preset.classId);
    const list = resolveTactics({ kind: 'preset', presetId: preset.id as never }, preset.classId as never, content);
    if (!cls || !list.ok) {
      presets[preset.id] = `unresolved:${list.ok ? 'class' : list.error.code}`;
      continue;
    }
    const byRanks: Record<string, unknown> = {};
    for (const r1 of ranksOf(cls.a1)) {
      for (const r2 of ranksOf(cls.a2)) {
        const kit = { a1: abilityAt(cls.a1, r1).def, a2: abilityAt(cls.a2, r2).def };
        byRanks[`${r1}${r2}`] = ruleListSurface(compileTactics(list.value, kit, content));
      }
    }
    presets[preset.id] = byRanks;
  }
  hasher.update(canon.text(presets));

  // 4. What a custom rule list is checked against (M3): the closed vocabulary's ids and the list limits.
  const v = content.vocabulary;
  hasher.update(
    canon.text({
      conditions: v.conditions.map((x) => [x.id, x.params.map((p) => [p.name, p.type, 'default' in p ? p.default : null, 'optional' in p ? p.optional === true : false])]),
      selectors: v.selectors.map((x) => [x.id, x.params.map((p) => [p.name, p.type, 'default' in p ? p.default : null, 'optional' in p ? p.optional === true : false])]),
      predicates: v.predicates.map((x) => [x.id, x.params.map((p) => [p.name, p.type, 'default' in p ? p.default : null, 'optional' in p ? p.optional === true : false])]),
      actions: v.actions.map((x) => [x.id, x.params.map((p) => [p.name, p.type, 'default' in p ? p.default : null, 'optional' in p ? p.optional === true : false])]),
      stances: v.stances.map((s) => s.id),
      limits: { maxRules: content.tacticsLimits.maxRules, maxConditionsPerRule: content.tacticsLimits.maxConditionsPerRule },
    }),
  );
  return hasher.digest();
}

/** See the file header. */
export function simContentHash(content: ContentDB): string {
  let h = cache.get(content);
  if (h === undefined) {
    h = compute(content);
    cache.set(content, h);
  }
  return h;
}
