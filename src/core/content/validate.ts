/**
 * Cross-file content validation: everything a per-file schema cannot check.
 * Ported from the designers' scratch checks (03-combat, 03-fighter-lifecycle,
 * 03-league-economy "Schema notes for the architect").
 *
 * Profiles: 'theme' (default) enforces the full shipped-theme rules (42
 * classes, 6 per archetype, 2 per hybrid pair, club counts per tier);
 * 'fixture' skips those count rules so small test content sets validate.
 */
import { compareNumbers, isReservedName } from '../util';
import { isDocKey } from './doc-keys';
import type { ContentIssue } from './issues';
import {
  AFFINITY_GROUPS,
  ARCHETYPE_IDS,
  AUTO_SWAP_MODES,
  BANDS,
  FRESHNESS_LABELS,
  HYBRID_PAIR_IDS,
  INJURY_SEVERITIES,
  LEVEL_UP_MODES,
  LIFECYCLE_STATUS_IDS,
  PAUSE_BETWEEN_ROUNDS,
  PERK_TAGS,
  RANKABLE_SLOTS,
  RULE_ACTIONS,
  RULE_CONDITIONS,
  RULE_PREDICATES,
  RULE_SELECTORS,
  STATUS_CATEGORIES,
  STATUS_IDS,
  STAT_IDS,
  STAT_MOD_STATS,
  TRAINING_EMPHASES,
  TRAIT_CATEGORIES,
  TRAIT_EFFECT_TYPES,
  type ContentFiles,
  type Effect,
  type RuleParamSpec,
} from './schema';
import { isExact, unitRuleForKey } from './units';

export type ValidationProfile = 'theme' | 'fixture';

/** Shipped-theme count rules (O8, O2, open-014 working structure). */
export const THEME_RULES = {
  classCount: 42,
  baseClassesPerArchetype: 6,
  hybridClassesPerPair: 2,
} as const;

const ARCHETYPE_FAMILY: Record<(typeof ARCHETYPE_IDS)[number], string> = {
  tank: 'tank',
  melee: 'dps',
  ranged: 'dps',
  controller: 'controller',
  healer: 'healer',
};

class Collector {
  readonly issues: ContentIssue[] = [];
  error(file: string, path: string, message: string): void {
    this.issues.push({ file, path, message, severity: 'error' });
  }
  warn(file: string, path: string, message: string): void {
    this.issues.push({ file, path, message, severity: 'warning' });
  }
}

function sameSet(actual: readonly string[], expected: readonly string[]): { missing: string[]; extra: string[] } {
  const a = new Set(actual);
  const e = new Set(expected);
  return { missing: [...e].filter((x) => !a.has(x)), extra: [...a].filter((x) => !e.has(x)) };
}

function checkClosedList(c: Collector, file: string, path: string, actual: readonly string[], expected: readonly string[], what: string): void {
  const { missing, extra } = sameSet(actual, expected);
  if (missing.length) c.error(file, path, `${what}: missing ${missing.join(', ')} (the engine implements exactly this list)`);
  if (extra.length) c.error(file, path, `${what}: unknown ${extra.join(', ')} (adding one is a code change; ask the architect)`);
}

function checkUnique(c: Collector, file: string, path: string, items: readonly { id: string }[], what = 'id'): Set<string> {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id)) c.error(file, `${path}[${i}].id`, `duplicate ${what} "${item.id}"`);
    // Ids index plain objects in GameState: an inherited name (constructor, toString, __proto__) would resolve to a prototype member.
    if (isReservedName(item.id)) c.error(file, `${path}[${i}].id`, `${what} "${item.id}" is a reserved name`);
    seen.add(item.id);
  });
  return seen;
}

function checkUniqueValues(c: Collector, file: string, path: string, values: readonly string[], what: string): void {
  const seen = new Map<string, number>();
  values.forEach((v, i) => {
    const prev = seen.get(v.toLowerCase());
    if (prev !== undefined) c.error(file, `${path}[${i}]`, `duplicate ${what} "${v}" (also at index ${prev})`);
    seen.set(v.toLowerCase(), i);
  });
}

/** Walk every effect, including nested ones (chain, splash, zone, onKill). */
function forEachEffect(effects: readonly Effect[], path: string, visit: (e: Effect, path: string) => void): void {
  effects.forEach((e, i) => {
    const p = `${path}[${i}]`;
    visit(e, p);
    if (e.type === 'damage' && e.onKill) forEachEffect(e.onKill, `${p}.onKill`, visit);
    if (e.type === 'chain' || e.type === 'splash') forEachEffect(e.effects, `${p}.effects`, visit);
    if (e.type === 'zone') {
      forEachEffect(e.zone.allies, `${p}.zone.allies`, visit);
      forEachEffect(e.zone.enemies, `${p}.zone.enemies`, visit);
    }
  });
}

/** Exact unit conversion of every numeric value (03-combat schema note 2). */
function checkUnits(c: Collector, file: string, value: unknown, path: string, key: string, wholeFile: boolean): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkUnits(c, file, v, `${path}[${i}]`, key, wholeFile));
    return;
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      // Documentation keys (`_`-prefixed) are stripped from production builds, so no rule may depend on them:
      // the EXAMPLE blocks are skipped by name (they hold illustrative values, not engine data).
      if (isDocKey(k) || k === 'derived' || k === 'qualityShiftExamples') continue;
      checkUnits(c, file, v, path ? `${path}.${k}` : k, k, wholeFile);
    }
    return;
  }
  if (typeof value !== 'number') return;
  if (wholeFile) {
    if (!Number.isInteger(value)) c.error(file, path, `${value}: every number in this file must be an integer (gold or basis points)`);
    return;
  }
  const rule = unitRuleForKey(key);
  if (rule && !isExact(value, rule.factor)) {
    c.error(file, path, `${value} does not convert exactly to ${rule.unit}`);
  }
}

function checkCurveAscending(c: Collector, file: string, path: string, points: readonly (readonly [number, number])[]): void {
  for (let i = 1; i < points.length; i++) {
    if (points[i]![0] <= points[i - 1]![0]) c.error(file, `${path}[${i}]`, 'curve x values must be strictly ascending');
  }
}

export function validateContentFiles(f: ContentFiles, profile: ValidationProfile = 'theme'): ContentIssue[] {
  const c = new Collector();
  const { combat, classes, abilities, races, traits, names, development, leagues, clubs, economy } = f;
  const tactics = f['tactics-presets'];

  // ---- units -----------------------------------------------------------------------------
  for (const [name, data] of Object.entries(f)) {
    checkUnits(c, `${name}.json`, data, '', '', name === 'economy');
  }

  // ---- combat.json ------------------------------------------------------------------------
  const CF = 'combat.json';
  checkClosedList(c, CF, 'attributes', combat.attributes.map((a) => a.id), STAT_IDS, 'stat ids');
  checkClosedList(c, CF, 'archetypes', combat.archetypes.map((a) => a.id), ARCHETYPE_IDS, 'archetypes');
  checkClosedList(c, CF, 'hybridPairs', combat.hybridPairs.map((a) => a.id), HYBRID_PAIR_IDS, 'hybrid pairs');
  checkClosedList(c, CF, 'affinityGroups', combat.affinityGroups, AFFINITY_GROUPS, 'affinity groups');
  checkClosedList(c, CF, 'bands', combat.bands.map((b) => b.id), BANDS, 'bands');
  checkClosedList(c, CF, 'statuses', combat.statuses.map((s) => s.id), STATUS_IDS, 'statuses');
  checkClosedList(c, CF, 'statusCategories', combat.statusCategories.map((s) => s.id), STATUS_CATEGORIES, 'status categories');
  checkClosedList(c, CF, 'statModStats', combat.statModStats.map((s) => s.id), STAT_MOD_STATS, 'stat-mod stats');
  checkClosedList(c, CF, 'coneHalfAngleCos', Object.keys(combat.coneHalfAngleCos), ['60', '90', '120', '180'], 'cone angles');
  combat.hybridPairs.forEach((h, i) => {
    const expected = h.id.split('_');
    if ([...h.families].sort().join() !== [...expected].sort().join()) {
      c.error(CF, `hybridPairs[${i}].families`, `families must be ${expected.join(' + ')}`);
    }
  });
  const statusById = new Map(combat.statuses.map((s) => [s.id, s]));
  combat.statuses.forEach((s, i) => {
    if (s.category === 'cc_hard' && s.dr === null && s.id !== 'taunt') {
      c.warn(CF, `statuses[${i}].dr`, `hard-control status "${s.id}" has no DR track`);
    }
  });
  const bandMax = combat.bands.map((b) => b.maxGapM);
  if (bandMax.some((v, i) => i > 0 && v <= bandMax[i - 1]!)) c.error(CF, 'bands', 'band maxGapM must increase melee < close < mid < long');

  // ---- abilities.json ---------------------------------------------------------------------------
  const AF = 'abilities.json';
  checkUnique(c, AF, 'abilities', abilities.abilities, 'ability id');
  const abilityById = new Map(abilities.abilities.map((a) => [a.id, a]));
  const classIds = new Set(classes.classes.map((x) => x.id));
  const maxHardS = combat.cc.maxHardDurationS;
  abilities.abilities.forEach((a, i) => {
    const p = `abilities[${i}]`;
    if (!classIds.has(a.classId)) c.error(AF, `${p}.classId`, `unknown class "${a.classId}"`);
    const kindForSlot = a.slot === 'basic' ? 'basic' : a.slot === 'passive' ? 'passive' : 'active';
    if (a.kind !== kindForSlot) c.error(AF, `${p}.kind`, `slot "${a.slot}" requires kind "${kindForSlot}"`);
    if ((a.kind === 'passive') !== (a.passive !== null)) c.error(AF, `${p}.passive`, 'passive block must be set exactly for passive abilities');
    if (a.kind === 'active' && (a.cooldownS <= 0 || a.focusCost <= 0)) {
      c.error(AF, p, 'active abilities need cooldownS > 0 and focusCost > 0');
    }
    if (a.target === 'self' && a.approach) c.error(AF, `${p}.approach`, 'self-target abilities never approach');
    if (a.area) {
      if (a.area.shape === 'cone' && a.area.angleDeg === undefined) c.error(AF, `${p}.area.angleDeg`, 'cone needs angleDeg');
      if (a.area.shape !== 'line' && a.area.radiusM === undefined) c.error(AF, `${p}.area.radiusM`, `${a.area.shape} needs radiusM`);
      if (a.area.shape === 'line' && (a.area.lengthM === undefined || a.area.widthM === undefined)) {
        c.error(AF, `${p}.area`, 'line needs lengthM and widthM');
      }
      if (a.area.affects === 'both' && a.allyEffects.length === 0) c.error(AF, `${p}.allyEffects`, '"both" areas need allyEffects');
    }
    const visit = (e: Effect, ep: string): void => {
      if (e.type !== 'status') return;
      const st = statusById.get(e.status);
      if (!st) return;
      if (st.category === 'cc_hard' && e.durationS > maxHardS) {
        c.error(AF, `${ep}.durationS`, `hard control lasts at most ${maxHardS} s`);
      }
      if (e.magnitude !== undefined && st.cap !== null && Math.abs(e.magnitude) > st.cap + 1e-9) {
        c.error(AF, `${ep}.magnitude`, `exceeds the "${st.id}" cap ${st.cap}`);
      }
    };
    forEachEffect(a.effects, `${p}.effects`, visit);
    forEachEffect(a.allyEffects, `${p}.allyEffects`, visit);
    forEachEffect(a.selfEffects, `${p}.selfEffects`, visit);
    a.passive?.triggers.forEach((t, ti) => forEachEffect(t.effects, `${p}.passive.triggers[${ti}].effects`, visit));
  });

  // ---- classes.json ---------------------------------------------------------------------------------
  const KF = 'classes.json';
  checkUnique(c, KF, 'classes', classes.classes, 'class id');
  checkUniqueValues(c, KF, 'classes[].name', classes.classes.map((x) => x.name), 'class name');
  const presetById = new Map(tactics.presets.map((x) => [x.id, x]));
  const baseCount = new Map<string, number>();
  const hybridCount = new Map<string, number>();
  classes.classes.forEach((k, i) => {
    const p = `classes[${i}]`;
    if (k.archetypes.length === 1) {
      if (k.hybridPair !== null) c.error(KF, `${p}.hybridPair`, 'base classes have hybridPair null');
      baseCount.set(k.archetypes[0]!, (baseCount.get(k.archetypes[0]!) ?? 0) + 1);
    } else {
      if (k.hybridPair === null) {
        c.error(KF, `${p}.hybridPair`, 'hybrid classes (two archetypes) need a hybridPair');
      } else {
        const fams = k.archetypes.map((a) => ARCHETYPE_FAMILY[a]).sort().join();
        const expected = k.hybridPair.split('_').sort().join();
        if (fams !== expected) c.error(KF, `${p}.archetypes`, `archetypes do not match hybrid pair "${k.hybridPair}"`);
        hybridCount.set(k.hybridPair, (hybridCount.get(k.hybridPair) ?? 0) + 1);
      }
      if (k.archetypes[0] === k.archetypes[1]) c.error(KF, `${p}.archetypes`, 'hybrid archetypes must differ');
    }
    for (const [slot, abilityId] of Object.entries(k.abilities)) {
      const ab = abilityById.get(abilityId);
      if (!ab) c.error(KF, `${p}.abilities.${slot}`, `unknown ability "${abilityId}"`);
      else {
        if (ab.classId !== k.id) c.error(KF, `${p}.abilities.${slot}`, `ability "${abilityId}" belongs to class "${ab.classId}"`);
        if (ab.slot !== slot) c.error(KF, `${p}.abilities.${slot}`, `ability "${abilityId}" is a "${ab.slot}" ability`);
      }
    }
    k.presetIds.forEach((pid, pi) => {
      const preset = presetById.get(pid);
      if (!preset) c.error(KF, `${p}.presetIds[${pi}]`, `unknown preset "${pid}"`);
      else if (preset.classId !== k.id) c.error(KF, `${p}.presetIds[${pi}]`, `preset "${pid}" belongs to class "${preset.classId}"`);
    });
    if (!k.presetIds.includes(k.defaultPresetId)) c.error(KF, `${p}.defaultPresetId`, 'must be one of presetIds');
    const weightSum = Object.values(k.ratingWeights).reduce((s, w) => s + w, 0);
    if (Math.abs(weightSum - 1) > 0.011) c.warn(KF, `${p}.ratingWeights`, `weights sum to ${weightSum.toFixed(3)}, expected about 1`);
  });
  abilities.abilities.forEach((a, i) => {
    const k = classes.classes.find((x) => x.id === a.classId);
    if (k && k.abilities[a.slot] !== a.id) c.error(AF, `abilities[${i}]`, `class "${k.id}" does not list this ability in slot "${a.slot}"`);
  });
  if (profile === 'theme') {
    if (classes.classes.length !== THEME_RULES.classCount) {
      c.error(KF, 'classes', `expected ${THEME_RULES.classCount} classes (O8), found ${classes.classes.length}`);
    }
    for (const arch of ARCHETYPE_IDS) {
      const n = baseCount.get(arch) ?? 0;
      if (n !== THEME_RULES.baseClassesPerArchetype) {
        c.error(KF, 'classes', `archetype "${arch}" has ${n} base classes, expected ${THEME_RULES.baseClassesPerArchetype} (O8)`);
      }
    }
    for (const pair of HYBRID_PAIR_IDS) {
      const n = hybridCount.get(pair) ?? 0;
      if (n !== THEME_RULES.hybridClassesPerPair) {
        c.error(KF, 'classes', `hybrid pair "${pair}" has ${n} classes, expected ${THEME_RULES.hybridClassesPerPair} (O8)`);
      }
    }
  }

  // ---- tactics-presets.json --------------------------------------------------------------------------
  const TF = 'tactics-presets.json';
  const vocab = tactics.vocabulary;
  checkClosedList(c, TF, 'vocabulary.conditions', vocab.conditions.map((x) => x.id), RULE_CONDITIONS, 'rule conditions');
  checkClosedList(c, TF, 'vocabulary.selectors', vocab.selectors.map((x) => x.id), RULE_SELECTORS, 'rule selectors');
  checkClosedList(c, TF, 'vocabulary.predicates', vocab.predicates.map((x) => x.id), RULE_PREDICATES, 'rule predicates');
  checkClosedList(c, TF, 'vocabulary.actions', vocab.actions.map((x) => x.id), RULE_ACTIONS, 'rule actions');
  checkClosedList(c, TF, 'vocabulary.roles', vocab.roles.map((x) => x.id), ARCHETYPE_IDS, 'roles');
  checkClosedList(c, TF, 'vocabulary.bands', vocab.bands, BANDS, 'bands');
  checkUnique(c, TF, 'presets', tactics.presets, 'preset id');
  const condSpec = new Map(vocab.conditions.map((x) => [x.id as string, x.params]));
  const selSpec = new Map(vocab.selectors.map((x) => [x.id as string, x]));
  const predSpec = new Map(vocab.predicates.map((x) => [x.id as string, x.params]));
  const actSpec = new Map(vocab.actions.map((x) => [x.id as string, x]));
  const statusSet = new Set<string>(STATUS_IDS);
  const categorySet = new Set<string>(STATUS_CATEGORIES);

  const checkParams = (
    path: string,
    part: Record<string, unknown>,
    discriminator: string,
    specs: readonly RuleParamSpec[] | undefined,
    extraAllowed: readonly string[] = [],
  ): void => {
    if (!specs) return;
    const byName = new Map(specs.map((s) => [s.name, s]));
    for (const [key, value] of Object.entries(part)) {
      if (key === discriminator || extraAllowed.includes(key)) continue;
      const spec = byName.get(key);
      if (!spec) {
        c.error(TF, `${path}.${key}`, `unknown parameter "${key}" for "${String(part[discriminator])}"`);
        continue;
      }
      const bad = (msg: string): void => c.error(TF, `${path}.${key}`, msg);
      switch (spec.type) {
        case 'int':
          if (typeof value !== 'number' || !Number.isInteger(value)) bad('must be a whole number');
          else {
            if (value < spec.min || value > spec.max) bad(`must be within ${spec.min}..${spec.max}`);
            if (spec.step && (value - spec.min) % spec.step !== 0 && value % spec.step !== 0) bad(`must be in steps of ${spec.step}`);
          }
          break;
        case 'metres':
          if (typeof value !== 'number') bad('must be a number of metres');
          else if ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) {
            bad(`must be within ${spec.min ?? '-'}..${spec.max ?? '-'} m`);
          }
          break;
        case 'bool':
          if (typeof value !== 'boolean') bad('must be true or false');
          break;
        case 'band':
          if (typeof value !== 'string' || !(BANDS as readonly string[]).includes(value)) bad(`must be one of ${BANDS.join(', ')}`);
          break;
        case 'role':
          if (typeof value !== 'string' || !(ARCHETYPE_IDS as readonly string[]).includes(value)) {
            bad(`must be one of ${ARCHETYPE_IDS.join(', ')}`);
          }
          break;
        case 'status':
          if (typeof value !== 'string' || !statusSet.has(value)) bad('must be a status id');
          break;
        case 'statusCategory':
          if (typeof value !== 'string' || !categorySet.has(value)) bad('must be a status category');
          break;
        case 'slot':
          if (typeof value !== 'string' || !(spec.values as readonly string[]).includes(value)) bad(`must be one of ${spec.values.join(', ')}`);
          break;
      }
    }
    for (const spec of specs) {
      const optional = ('optional' in spec && spec.optional === true) || ('default' in spec && spec.default !== undefined);
      if (!optional && !(spec.name in part)) c.error(TF, path, `missing required parameter "${spec.name}"`);
    }
    if (specs.some((s) => s.name === 'status') && specs.some((s) => s.name === 'category')) {
      if (('status' in part) === ('category' in part)) c.error(TF, path, 'set exactly one of "status" or "category"');
    }
  };

  const classById = new Map(classes.classes.map((k) => [k.id, k]));
  tactics.presets.forEach((preset, pi) => {
    const p = `presets[${pi}]`;
    const k = classById.get(preset.classId);
    if (!k) c.error(TF, `${p}.classId`, `unknown class "${preset.classId}"`);
    else if (!k.presetIds.includes(preset.id)) c.error(TF, p, `class "${k.id}" does not list this preset`);
    const { min, max } = tactics.limits.m1RulesPerPreset;
    if (preset.rules.length < min || preset.rules.length > max) c.error(TF, `${p}.rules`, `M1 presets have ${min}-${max} rules`);
    if (preset.rules.length > tactics.limits.maxRules) c.error(TF, `${p}.rules`, `at most ${tactics.limits.maxRules} rules`);
    checkUnique(c, TF, `${p}.rules`, preset.rules, 'rule id');
    preset.rules.forEach((rule, ri) => {
      const rp = `${p}.rules[${ri}]`;
      if (rule.if.length > tactics.limits.maxConditionsPerRule) c.error(TF, `${rp}.if`, `at most ${tactics.limits.maxConditionsPerRule} conditions`);
      rule.if.forEach((cond, ci) => checkParams(`${rp}.if[${ci}]`, cond, 'cond', condSpec.get(cond.cond), ['not']));
      checkParams(`${rp}.then`, rule.then, 'type', actSpec.get(rule.then.type)?.params);
      const sel = selSpec.get(rule.on.sel);
      checkParams(`${rp}.on`, rule.on, 'sel', sel?.params);
      if (rule.only) checkParams(`${rp}.only`, rule.only, 'pred', predSpec.get(rule.only.pred));
      if (rule.prefer) checkParams(`${rp}.prefer`, rule.prefer, 'pred', predSpec.get(rule.prefer.pred));
      if (rule.only && rule.prefer && tactics.limits.onlyOrPreferPerRule <= 1) c.error(TF, rp, 'a rule has ONLY or PREFER, not both');
      // selector pool vs action / ability target
      const action = actSpec.get(rule.then.type);
      if (sel && action) {
        let allowed: readonly string[] = ['self', 'enemies', 'allies'];
        if (action.targetPool === 'enemies') allowed = ['enemies'];
        if (action.targetPool === 'allies_not_self') allowed = ['allies'];
        if (action.targetPool === 'ability' && k) {
          const slot = rule.then['slot'];
          const abilityId = typeof slot === 'string' ? k.abilities[slot as 'a1' | 'a2'] : undefined;
          const ab = abilityId ? abilityById.get(abilityId) : undefined;
          if (!ab) c.error(TF, `${rp}.then.slot`, 'ability action needs a valid slot');
          else {
            allowed =
              ab.target === 'enemy' ? ['enemies'] : ab.target === 'ally' ? ['allies'] : ab.target === 'self' ? ['self'] : ['allies', 'self'];
          }
        }
        if (!allowed.includes(sel.pool)) {
          c.error(TF, `${rp}.on.sel`, `selector "${sel.id}" picks from ${sel.pool}, but the action needs ${allowed.join(' or ')}`);
        }
      }
    });
  });

  // ---- races.json + names.json -----------------------------------------------------------------------
  const RF = 'races.json';
  checkClosedList(c, RF, 'stats.ids', races.stats.ids, STAT_IDS, 'stat ids');
  checkClosedList(c, RF, 'classArchetypes.archetypes', races.classArchetypes.archetypes, AFFINITY_GROUPS, 'affinity groups');
  const raceIds = checkUnique(c, RF, 'races', races.races, 'race id');
  races.races.forEach((r, i) => {
    const p = `races[${i}]`;
    for (const [stat, v] of Object.entries(r.statTendencies)) {
      if (Math.abs(v) > races.stats.tendencyCapPerStat) c.error(RF, `${p}.statTendencies.${stat}`, `|${v}| exceeds the cap ${races.stats.tendencyCapPerStat}`);
    }
    if (r.debutAge.min > r.debutAge.max) c.error(RF, `${p}.debutAge`, 'min > max');
    if (!names.races[r.namesKey]) c.error(RF, `${p}.namesKey`, `names.json has no race "${r.namesKey}"`);
  });
  const NF = 'names.json';
  for (const [key, set] of Object.entries(names.races)) {
    set.patterns.forEach((pat, i) => {
      for (const m of pat.format.matchAll(/\{([A-Za-z0-9]+)\}/g)) {
        const ph = m[1]!;
        if (['given', 'given2', 'family', 'familyA', 'familyB'].includes(ph)) continue;
        if (!Array.isArray((set as Record<string, unknown>)[ph])) c.error(NF, `races.${key}.patterns[${i}]`, `placeholder {${ph}} has no list`);
      }
    });
  }

  // ---- traits.json --------------------------------------------------------------------------------------
  const XF = 'traits.json';
  checkClosedList(c, XF, 'categories', traits.categories.map((x) => x.id), TRAIT_CATEGORIES, 'trait categories');
  checkClosedList(c, XF, 'effectTypes', traits.effectTypes.map((x) => x.id), TRAIT_EFFECT_TYPES, 'trait effect types');
  const traitIds = checkUnique(c, XF, 'traits', traits.traits, 'trait id');
  const traitById = new Map(traits.traits.map((t) => [t.id, t]));
  traits.traits.forEach((t, i) => {
    const p = `traits[${i}]`;
    t.opposites.forEach((o, oi) => {
      const other = traitById.get(o);
      if (!other) c.error(XF, `${p}.opposites[${oi}]`, `unknown trait "${o}"`);
      else if (o === t.id) c.error(XF, `${p}.opposites[${oi}]`, 'a trait cannot oppose itself');
      else if (!other.opposites.includes(t.id)) c.error(XF, `${p}.opposites[${oi}]`, `"${o}" does not list "${t.id}" as its opposite`);
    });
    t.excludes.forEach((o, oi) => {
      if (!traitIds.has(o)) c.error(XF, `${p}.excludes[${oi}]`, `unknown trait "${o}"`);
    });
    for (const race of Object.keys(t.raceWeight)) if (!raceIds.has(race)) c.error(XF, `${p}.raceWeight.${race}`, `unknown race "${race}"`);
    t.effects.forEach((e, ei) => {
      if ((e.type === 'chemistryClash' || e.type === 'chemistryPair') && !traitIds.has(e.withTrait)) {
        c.error(XF, `${p}.effects[${ei}].withTrait`, `unknown trait "${e.withTrait}"`);
      }
      if (e.type === 'stat' && Math.abs(e.add) > traits.statAddCapPerTrait) {
        c.error(XF, `${p}.effects[${ei}].add`, `|${e.add}| exceeds statAddCapPerTrait ${traits.statAddCapPerTrait}`);
      }
    });
    if (t.loss?.trait && !traitIds.has(t.loss.trait)) c.error(XF, `${p}.loss.trait`, `unknown trait "${t.loss.trait}"`);
    if (t.polarity === 'positive' && (t.kind === 'burden' || t.kind === 'flaw')) c.error(XF, `${p}.kind`, 'positive traits are boon or edge');
    if (t.polarity === 'negative' && (t.kind === 'boon' || t.kind === 'edge')) c.error(XF, `${p}.kind`, 'negative traits are burden or flaw');
  });

  // ---- development.json -----------------------------------------------------------------------------------
  const DF = 'development.json';
  checkClosedList(c, DF, 'injury.severityLadder', development.injury.severityLadder.map((s) => s.id), INJURY_SEVERITIES, 'injury severities');
  checkClosedList(c, DF, 'training.options', development.training.options.map((s) => s.id), TRAINING_EMPHASES, 'training emphases');
  checkClosedList(c, DF, 'statuses', development.statuses.map((s) => s.id), LIFECYCLE_STATUS_IDS, 'lifecycle statuses');
  development.injury.scar.pool.forEach((s, i) => {
    if (!traitIds.has(s)) c.error(DF, `injury.scar.pool[${i}]`, `unknown trait "${s}"`);
  });
  checkClosedList(c, DF, 'injury.scar.poolWeights', Object.keys(development.injury.scar.poolWeights), development.injury.scar.pool, 'scar pool weights');
  checkUnique(c, DF, 'potential.bands', development.potential.bands, 'band id');
  checkUnique(c, DF, 'pace.levels', development.pace.levels, 'pace id');
  const grades = development.captaincy.grades.map((g) => g.minCq);
  if (grades.some((v, i) => i > 0 && v >= grades[i - 1]!)) c.error(DF, 'captaincy.grades', 'grades must be ordered by descending minCq');
  checkCurveAscending(c, DF, 'maturityCurve.physical', development.maturityCurve.physical);
  checkCurveAscending(c, DF, 'maturityCurve.mental', development.maturityCurve.mental);
  checkCurveAscending(c, DF, 'decline.physicalPerHumanYear', development.decline.physicalPerHumanYear);
  checkCurveAscending(c, DF, 'decline.mentalPerHumanYear', development.decline.mentalPerHumanYear);
  checkCurveAscending(c, DF, 'retirement.hazardByRatingDrop', development.retirement.hazardByRatingDrop);
  checkCurveAscending(c, DF, 'retirement.hazardPerHumanYearPastPeak', development.retirement.hazardPerHumanYearPastPeak);
  if (development.retirement.forcedHumanAge <= development.retirement.minHumanAge) c.error(DF, 'retirement.forcedHumanAge', 'must be above minHumanAge');
  for (const race of Object.keys(development.soakTargets.injuriesPer40RoundsByRace)) {
    if (!raceIds.has(race)) c.error(DF, `soakTargets.injuriesPer40RoundsByRace.${race}`, `unknown race "${race}"`);
  }

  // ---- leagues.json -------------------------------------------------------------------------------------------
  const LF = 'leagues.json';
  const regionIds = checkUnique(c, LF, 'regions', leagues.regions, 'region id');
  const districtIds = new Set(leagues.regions.flatMap((r) => (r.districts ?? []).map((d) => d.id)));
  checkUnique(c, LF, 'tiers', leagues.tiers, 'tier id');
  const levels = leagues.tiers.map((t) => t.level).sort(compareNumbers);
  if (levels.some((l, i) => l !== i + 1)) c.error(LF, 'tiers', 'tier levels must be 1..N without gaps (1 = top)');
  const bottomLevel = levels.length;
  leagues.tiers.forEach((t, i) => {
    const p = `tiers[${i}]`;
    if (!regionIds.has(t.regionId)) c.error(LF, `${p}.regionId`, `unknown region "${t.regionId}"`);
    if (t.clubCount !== 2 * leagues.wings.size) c.error(LF, `${p}.clubCount`, `must be 2 × wing size (${2 * leagues.wings.size})`);
    const expectedCap = 10 + 2 * (bottomLevel - t.level);
    if (t.rosterCap !== expectedCap) c.error(LF, `${p}.rosterCap`, `O2: tier ${t.level} cap is ${expectedCap}`);
    if (t.academyCapacity !== t.rosterCap) c.error(LF, `${p}.academyCapacity`, 'O2: academy capacity equals the roster cap');
    if (t.ratingBand.min > t.ratingBand.max) c.error(LF, `${p}.ratingBand`, 'min > max');
  });
  const wingIds = checkUnique(c, LF, 'wings.list', leagues.wings.list, 'wing id');
  leagues.wings.serpentinePattern.forEach((w, i) => {
    if (!wingIds.has(w)) c.error(LF, `wings.serpentinePattern[${i}]`, `unknown wing "${w}"`);
  });
  const rs = leagues.regularSeason;
  const mws = [...rs.wingRoundMatchweeks, ...rs.crossWingMatchweeks].sort(compareNumbers);
  if (mws.length !== rs.matchesPerClub || mws.some((m, i) => m !== i + 1)) {
    c.error(LF, 'regularSeason', `wing and cross-wing matchweeks must cover 1..${rs.matchesPerClub} exactly once`);
  }
  if (rs.wingRounds !== 2 * (leagues.wings.size - 1) || rs.wingRoundMatchweeks.length !== rs.wingRounds) {
    c.error(LF, 'regularSeason.wingRounds', `double round-robin in a wing of ${leagues.wings.size} has ${2 * (leagues.wings.size - 1)} rounds`);
  }
  const weeks = leagues.calendar.weeks;
  checkUnique(c, LF, 'calendar.weeks', weeks, 'week id');
  if (weeks.some((w, i) => w.index !== i + 1)) c.error(LF, 'calendar.weeks', 'week indexes must be 1..N in order');
  const regularWeeks = weeks.filter((w) => w.phase === 'regular');
  const weekMws = regularWeeks.map((w) => w.matchweek ?? 0).sort(compareNumbers);
  if (weekMws.length !== rs.matchesPerClub || weekMws.some((m, i) => m !== i + 1)) {
    c.error(LF, 'calendar.weeks', `regular weeks must carry matchweek 1..${rs.matchesPerClub}`);
  }
  const phaseOrder = weeks.map((w) => w.phase);
  const firstRegular = phaseOrder.indexOf('regular');
  const firstTournament = phaseOrder.indexOf('tournament');
  if (phaseOrder.lastIndexOf('preseason') > firstRegular || phaseOrder.lastIndexOf('regular') > firstTournament) {
    c.error(LF, 'calendar.weeks', 'phases must run preseason, then regular, then tournament');
  }
  const weekById = new Map(weeks.map((w) => [w.id, w]));
  const venueIds = checkUnique(c, LF, 'venues', leagues.venues, 'venue id');
  leagues.venues.forEach((v, i) => {
    if (!regionIds.has(v.regionId)) c.error(LF, `venues[${i}].regionId`, `unknown region "${v.regionId}"`);
  });
  leagues.tournament.rounds.forEach((r, i) => {
    const w = weekById.get(r.week);
    if (!w) c.error(LF, `tournament.rounds[${i}].week`, `unknown week "${r.week}"`);
    else if (w.phase !== 'tournament' || w.round !== r.id) c.error(LF, `tournament.rounds[${i}].week`, `week "${r.week}" is not the ${r.id} week`);
    if (r.venueId && !venueIds.has(r.venueId)) c.error(LF, `tournament.rounds[${i}].venueId`, `unknown venue "${r.venueId}"`);
    if (r.bestOf % 2 === 0) c.error(LF, `tournament.rounds[${i}].bestOf`, 'best-of must be odd (no drawn matches)');
  });
  if (rs.matchBestOf % 2 === 0) c.error(LF, 'regularSeason.matchBestOf', 'best-of must be odd (no drawn matches)');
  if (weeks.length !== economy.season.wageWeeksPerSeason) {
    c.error(LF, 'calendar.weeks', `calendar has ${weeks.length} weeks but economy.season.wageWeeksPerSeason is ${economy.season.wageWeeksPerSeason}`);
  }

  // ---- clubs.json -----------------------------------------------------------------------------------------------
  const CL = 'clubs.json';
  checkUnique(c, CL, 'clubs', clubs.clubs, 'club id');
  checkUniqueValues(c, CL, 'clubs[].code', clubs.clubs.map((x) => x.code), 'club code');
  checkUniqueValues(c, CL, 'clubs[].name', clubs.clubs.map((x) => x.name), 'club name');
  checkUniqueValues(c, CL, 'clubs[].colors.primary', clubs.clubs.map((x) => x.colors.primary), 'primary colour');
  const personalityIds = new Set(economy.aiPersonalities.map((x) => x.id));
  const clubsPerLevel = new Map<number, number>();
  clubs.clubs.forEach((club, i) => {
    const p = `clubs[${i}]`;
    if (!regionIds.has(club.regionId)) c.error(CL, `${p}.regionId`, `unknown region "${club.regionId}"`);
    if (!districtIds.has(club.districtId)) c.error(CL, `${p}.districtId`, `unknown district "${club.districtId}"`);
    if (club.startTierLevel > bottomLevel) c.error(CL, `${p}.startTierLevel`, `no tier level ${club.startTierLevel}`);
    if (!personalityIds.has(club.aiPersonality)) c.error(CL, `${p}.aiPersonality`, `unknown AI personality "${club.aiPersonality}"`);
    clubsPerLevel.set(club.startTierLevel, (clubsPerLevel.get(club.startTierLevel) ?? 0) + 1);
  });
  if (profile === 'theme') {
    for (const t of leagues.tiers) {
      const n = clubsPerLevel.get(t.level) ?? 0;
      if (n !== t.clubCount) c.error(CL, 'clubs', `tier ${t.level} starts with ${n} clubs, expected ${t.clubCount}`);
    }
  }

  // ---- economy.json ---------------------------------------------------------------------------------------------
  const EF = 'economy.json';
  checkUnique(c, EF, 'aiPersonalities', economy.aiPersonalities, 'personality id');
  const profileLevels = new Set(economy.tierProfiles.map((t) => t.tierLevel));
  for (const t of leagues.tiers) if (!profileLevels.has(t.level)) c.error(EF, 'tierProfiles', `no profile for tier level ${t.level}`);
  const shareSum = economy.income.grantInstallments.reduce((s, g) => s + g.shareBp, 0);
  if (shareSum !== 10_000) c.error(EF, 'income.grantInstallments', `shares sum to ${shareSum} bp, expected 10000`);
  economy.income.grantInstallments.forEach((g, i) => {
    if (!weekById.has(g.atWeek)) c.error(EF, `income.grantInstallments[${i}].atWeek`, `unknown week "${g.atWeek}"`);
  });
  if (!weekById.has(economy.ai.renewalWeeksFrom)) c.error(EF, 'ai.renewalWeeksFrom', `unknown week "${economy.ai.renewalWeeksFrom}"`);
  checkCurveAscending(c, EF, 'wage.curveAnchors', economy.wage.curveAnchors);
  for (let i = 1; i < economy.wage.curveAnchors.length; i++) {
    if (economy.wage.curveAnchors[i]![1] < economy.wage.curveAnchors[i - 1]![1]) {
      c.error(EF, `wage.curveAnchors[${i}]`, 'wage curve must not decrease');
    }
  }
  checkCurveAscending(c, EF, 'wage.potentialWeightBpByHumanAge', economy.wage.potentialWeightBpByHumanAge);
  checkCurveAscending(c, EF, 'wage.ageAdjBpByHumanAge', economy.wage.ageAdjBpByHumanAge);
  for (const level of Object.keys(economy.ai.replacementRatingByTier)) {
    if (!profileLevels.has(Number(level))) c.error(EF, `ai.replacementRatingByTier.${level}`, `no tier level ${level}`);
  }

  validateM11(c, f, { abilityById, statusById, traitById });
  return c.issues;
}

// ---- M1.1: levels.json, perks.json, ability-ranks.json, stamina, squads and Freshness -------------------------

interface M11Ctx {
  abilityById: ReadonlyMap<string, ContentFiles['abilities']['abilities'][number]>;
  statusById: ReadonlyMap<string, ContentFiles['combat']['statuses'][number]>;
  traitById: ReadonlyMap<string, ContentFiles['traits']['traits'][number]>;
}

/** Resolve a JSON pointer (RFC 6901) to its parent container and key; null when a step is missing. */
function pointerParent(root: unknown, path: string): { parent: Record<string, unknown> | unknown[]; key: string } | null {
  const steps = path.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node: unknown = root;
  for (let i = 0; i < steps.length - 1; i++) {
    if (node === null || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[steps[i]!];
  }
  if (node === null || typeof node !== 'object') return null;
  return { parent: node as Record<string, unknown>, key: steps[steps.length - 1]! };
}

/** The unit key of a pointer: its last non-index step ("/effects/0/durationS" -> "durationS"). */
function pointerUnitKey(path: string): string {
  const steps = path.split('/').filter((s) => s !== '' && !/^\d+$/.test(s));
  return steps[steps.length - 1] ?? '';
}

type AbilityLike = ContentFiles['abilities']['abilities'][number];

function hardControlDurations(a: AbilityLike, statusById: M11Ctx['statusById']): string {
  const out: string[] = [];
  const visit = (e: Effect, p: string): void => {
    if (e.type === 'status' && statusById.get(e.status)?.category === 'cc_hard') out.push(`${p}=${e.durationS}`);
  };
  forEachEffect(a.effects, 'effects', visit);
  forEachEffect(a.allyEffects, 'allyEffects', visit);
  forEachEffect(a.selfEffects, 'selfEffects', visit);
  a.passive?.triggers.forEach((t, ti) => forEachEffect(t.effects, `passive.triggers[${ti}].effects`, visit));
  return out.join();
}

function validateM11(c: Collector, f: ContentFiles, ctx: M11Ctx): void {
  const { combat, classes, abilities, traits, levels, perks, economy } = f;
  const ranks = f['ability-ranks'];
  const { abilityById, statusById, traitById } = ctx;

  // ---- combat.json M1.1 blocks (squad, swaps, auto-swap, Freshness penalty) ----
  const CF = 'combat.json';
  const m = combat.match;
  checkClosedList(c, CF, 'match.autoSwapModes', m.autoSwapModes, AUTO_SWAP_MODES, 'auto-swap modes');
  checkClosedList(c, CF, 'match.pauseBetweenRounds.options', m.pauseBetweenRounds.options, PAUSE_BETWEEN_ROUNDS, 'pause options');
  if (m.squad.reservesMin > m.squad.reservesMax) c.error(CF, 'match.squad', 'reservesMin > reservesMax');
  if (m.swaps.maxPerMatch > m.squad.reservesMax) c.warn(CF, 'match.swaps.maxPerMatch', 'more swaps than reserves (only injuries could use them)');
  const fz = combat.freshness;
  if (fz.fullPenaltyAtOrBelow >= fz.thresholdBelow) c.error(CF, 'freshness.fullPenaltyAtOrBelow', 'must be below thresholdBelow');
  if (fz.resistClamp[0] > fz.resistClamp[1]) c.error(CF, 'freshness.resistClamp', 'min > max');
  if (fz.default < fz.thresholdBelow) c.error(CF, 'freshness.default', 'the default freshness must carry no penalty');

  // ---- classes.json: 13 weights summing to 1, stamina weight and emphasis ----
  const KF = 'classes.json';
  classes.classes.forEach((k, i) => {
    const p = `classes[${i}]`;
    const sum = Object.values(k.ratingWeights).reduce((s, w) => s + w, 0);
    if (Math.abs(sum - 1) > 1e-6) c.error(KF, `${p}.ratingWeights`, `weights sum to ${sum.toFixed(4)}, expected exactly 1 (M1.1)`);
    if (k.ratingWeights.stamina !== 0.02) c.error(KF, `${p}.ratingWeights.stamina`, 'stamina weighs 0.02 in every class (progression sys-stamina)');
    const se = k.statEmphasis.stamina;
    if (se < 0.5 || se > 2) c.error(KF, `${p}.statEmphasis.stamina`, `${se} outside 0.5-2.0`);
  });

  // ---- ability-ranks.json ----
  const AR = 'ability-ranks.json';
  checkClosedList(c, AR, 'eligibility.rankableSlots', ranks.eligibility.rankableSlots, RANKABLE_SLOTS, 'rankable slots');
  const rowIds = new Set<string>();
  ranks.ranks.forEach((row, i) => {
    const p = `ranks[${i}]`;
    if (rowIds.has(row.abilityId)) c.error(AR, `${p}.abilityId`, `duplicate rank row for "${row.abilityId}"`);
    rowIds.add(row.abilityId);
    const ab = abilityById.get(row.abilityId);
    if (!ab) {
      c.error(AR, `${p}.abilityId`, `unknown ability "${row.abilityId}"`);
      return;
    }
    if (row.classId !== ab.classId) c.error(AR, `${p}.classId`, `ability "${ab.id}" belongs to class "${ab.classId}"`);
    if (row.slot !== ab.slot) c.error(AR, `${p}.slot`, `ability "${ab.id}" is a "${ab.slot}" ability`);
    if (row.rankable !== (ab.kind !== 'basic')) c.error(AR, `${p}.rankable`, 'exactly the non-basic abilities rank');
    if (!row.rankable) {
      if (row.ranks.length) c.error(AR, `${p}.ranks`, 'basic attacks have no ranks');
      return;
    }
    if (row.ranks.map((r) => r.rank).join() !== '2,3') {
      c.error(AR, `${p}.ranks`, 'rankable abilities list rank 2 then rank 3');
      return;
    }
    const hard = hardControlDurations(ab, statusById);
    const work = structuredClone(ab) as AbilityLike;
    row.ranks.forEach((r, ri) => {
      r.changes.forEach((ch, ci) => {
        const cp = `${p}.ranks[${ri}].changes[${ci}]`;
        const at = pointerParent(work, ch.path);
        const cur = at ? (at.parent as Record<string, unknown>)[at.key] : undefined;
        if (typeof cur !== 'number') {
          c.error(AR, `${cp}.path`, `"${ch.path}" is not a number in "${ab.id}"`);
          return;
        }
        if (Math.abs(cur - ch.from) > 1e-9) c.error(AR, `${cp}.from`, `${ch.from} but "${ab.id}${ch.path}" is ${cur} at this rank`);
        (at!.parent as Record<string, unknown>)[at!.key] = ch.to;
        const rule = unitRuleForKey(pointerUnitKey(ch.path));
        if (rule && !isExact(ch.to, rule.factor)) c.error(AR, `${cp}.to`, `${ch.to} does not convert exactly to ${rule.unit}`);
      });
      const rp = `${p}.ranks[${ri}]`;
      if (hardControlDurations(work, statusById) !== hard) c.error(AR, rp, 'ranks never change hard-control durations');
      if (work.kind === 'active') {
        if (work.cooldownS < 1) c.error(AR, rp, `rank ${r.rank} cooldown ${work.cooldownS} s is below 1 s`);
        if (work.focusCost < 10) c.error(AR, rp, `rank ${r.rank} focus cost ${work.focusCost} is below 10`);
      }
      const capCheck = (e: Effect, ep: string): void => {
        if (e.type !== 'status' || e.magnitude === undefined) return;
        const st = statusById.get(e.status);
        if (st && st.cap !== null && Math.abs(e.magnitude) > st.cap + 1e-9) c.error(AR, rp, `rank ${r.rank} ${ep}.magnitude exceeds the "${st.id}" cap ${st.cap}`);
      };
      forEachEffect(work.effects, 'effects', capCheck);
      forEachEffect(work.allyEffects, 'allyEffects', capCheck);
      forEachEffect(work.selfEffects, 'selfEffects', capCheck);
    });
  });
  for (const a of abilities.abilities) if (!rowIds.has(a.id)) c.error(AR, 'ranks', `no rank row for ability "${a.id}"`);

  // ---- perks.json ----
  const PF = 'perks.json';
  checkClosedList(c, PF, 'tags', perks.tags, PERK_TAGS, 'perk tags');
  checkUnique(c, PF, 'perks', perks.perks, 'perk id');
  checkUniqueValues(c, PF, 'perks[].name', perks.perks.map((x) => x.name), 'perk name');
  const perkById = new Map(perks.perks.map((x) => [x.id, x]));
  const simEffectTypes = new Set(traits.effectTypes.filter((t) => t.owner === 'sim').map((t) => t.id));
  perks.perks.forEach((pk, i) => {
    const p = `perks[${i}]`;
    const tierRule = perks.rules.tiers[String(pk.tier) as '1' | '2' | '3'];
    if (tierRule && pk.requires.minPerksHeld < tierRule.minPerksHeld) {
      c.error(PF, `${p}.requires.minPerksHeld`, `tier ${pk.tier} needs at least ${tierRule.minPerksHeld} perks held`);
    }
    if (pk.tier === 3 && pk.requires.anyPerks.length === 0) c.error(PF, `${p}.requires.anyPerks`, 'tier III perks list a lower-tier prerequisite');
    pk.requires.anyPerks.forEach((q, qi) => {
      const pre = perkById.get(q);
      if (!pre) c.error(PF, `${p}.requires.anyPerks[${qi}]`, `unknown perk "${q}"`);
      else {
        if (pre.tier >= pk.tier) c.error(PF, `${p}.requires.anyPerks[${qi}]`, `"${q}" is not a lower tier`);
        if (pre.archetype !== pk.archetype && pre.archetype !== 'general') c.error(PF, `${p}.requires.anyPerks[${qi}]`, `"${q}" is neither ${pk.archetype} nor general`);
      }
    });
    pk.exclusiveWith.forEach((q, qi) => {
      const other = perkById.get(q);
      if (!other) c.error(PF, `${p}.exclusiveWith[${qi}]`, `unknown perk "${q}"`);
      else if (q === pk.id) c.error(PF, `${p}.exclusiveWith[${qi}]`, 'a perk cannot exclude itself');
      else if (!other.exclusiveWith.includes(pk.id)) c.error(PF, `${p}.exclusiveWith[${qi}]`, `"${q}" does not exclude "${pk.id}" (exclusions are symmetric)`);
    });
    pk.tags.forEach((t, ti) => {
      if (!perks.tags.includes(t)) c.error(PF, `${p}.tags[${ti}]`, `tag "${t}" is not in the file's tags`);
    });
    pk.traitEffects.forEach((e, ei) => {
      if (!simEffectTypes.has(e.type)) c.error(PF, `${p}.traitEffects[${ei}]`, `"${e.type}" is not a sim-owned trait effect (management effects belong in lifecycleEffects)`);
    });
    const noHard = (e: Effect, ep: string): void => {
      if (e.type === 'status' && statusById.get(e.status)?.category === 'cc_hard') c.error(PF, `${p}.${ep}`, `perks never apply hard control ("${e.status}")`);
      if (e.type === 'status') {
        const st = statusById.get(e.status);
        if (st && e.magnitude !== undefined && st.cap !== null && Math.abs(e.magnitude) > st.cap + 1e-9) c.error(PF, `${p}.${ep}.magnitude`, `exceeds the "${st.id}" cap ${st.cap}`);
      }
    };
    pk.passive?.triggers.forEach((t, ti) => forEachEffect(t.effects, `passive.triggers[${ti}].effects`, noHard));
  });
  for (const key of Object.keys(perks.aiPreferences.tagWeights)) {
    if (!(ARCHETYPE_IDS as readonly string[]).includes(key)) c.error(PF, `aiPreferences.tagWeights.${key}`, `unknown archetype "${key}"`);
  }
  if (perks.rules.maxTier3 > perks.rules.perkCap) c.error(PF, 'rules.maxTier3', 'exceeds perkCap');

  // ---- levels.json ----
  const LV = 'levels.json';
  const x = levels.xpPerLevel;
  checkCurveAscending(c, LV, 'xpPerLevel.ageFactorPhysical', x.ageFactorPhysical);
  checkCurveAscending(c, LV, 'xpPerLevel.ageFactorMental', x.ageFactorMental);
  checkCurveAscending(c, LV, 'xpPerLevel.gapFactor', x.gapFactor);
  checkCurveAscending(c, LV, 'autoPick.staminaBonusByStamina', levels.autoPick.staminaBonusByStamina);
  checkCurveAscending(c, LV, 'freshness.recoveryAgeMult', levels.freshness.recoveryAgeMult);
  if (x.min > x.max) c.error(LV, 'xpPerLevel', 'min > max');
  checkClosedList(c, LV, 'autoPick.playerModes', levels.autoPick.playerModes.map((p) => p.id), LEVEL_UP_MODES, 'level-up modes');
  const fr = levels.freshness;
  checkClosedList(c, LV, 'freshness.labels', fr.labels.map((l) => l.id), FRESHNESS_LABELS, 'freshness labels');
  const mins = fr.labels.map((l) => l.min);
  if (mins.some((v, i) => i > 0 && v >= mins[i - 1]!) || mins[mins.length - 1] !== 0) {
    c.error(LV, 'freshness.labels', 'labels are ordered by descending min and the last starts at 0');
  }
  if (fr.threshold !== fz.thresholdBelow) c.error(LV, 'freshness.threshold', `must equal combat.json freshness.thresholdBelow (${fz.thresholdBelow})`);
  if (fr.start !== fz.default) c.error(LV, 'freshness.start', `must equal combat.json freshness.default (${fz.default})`);
  if (fr.drainMin > fr.drainMax || fr.intensityMin > fr.intensityMax) c.error(LV, 'freshness', 'drain and intensity clamps need min <= max');
  // matchSquad repeats combat.json match (combat owns it).
  const sq = levels.matchSquad;
  const sameAs = (path: string, mine: unknown, theirs: unknown, theirPath: string): void => {
    if (mine !== theirs) c.error(LV, path, `${String(mine)} differs from combat.json ${theirPath} (${String(theirs)}); combat owns this value`);
  };
  sameAs('matchSquad.starters', sq.starters, m.squad.starters, 'match.squad.starters');
  sameAs('matchSquad.reserves', sq.reserves, m.squad.reservesMax, 'match.squad.reservesMax');
  sameAs('matchSquad.maxSwapsPerMatch', sq.maxSwapsPerMatch, m.swaps.maxPerMatch, 'match.swaps.maxPerMatch');
  sameAs('matchSquad.swappedOutMayReturn', sq.swappedOutMayReturn, m.swaps.returnAllowed, 'match.swaps.returnAllowed');
  const as = levels.aiSubstitution;
  const d = m.autoSwapDefaults;
  sameAs('aiSubstitution.freshnessBelow', as.freshnessBelow, d.freshnessBelow, 'match.autoSwapDefaults.freshnessBelow');
  sameAs('aiSubstitution.playerAutoDefault', as.playerAutoDefault, d.freshnessBelow, 'match.autoSwapDefaults.freshnessBelow');
  sameAs('aiSubstitution.reserveMargin', as.reserveMargin, d.reserveMargin, 'match.autoSwapDefaults.reserveMargin');
  sameAs('aiSubstitution.maxRatingGap', as.maxRatingGap, d.maxRatingGap, 'match.autoSwapDefaults.maxRatingGap');
  sameAs('aiSubstitution.keepOneForInjury', as.keepOneForInjury, d.keepOneForInjury, 'match.autoSwapDefaults.keepOneForInjury');
  sameAs('aiSubstitution.sameRoleFamilyFirst', as.sameRoleFamilyFirst, d.sameRoleFamilyFirst, 'match.autoSwapDefaults.sameRoleFamilyFirst');
  checkClosedList(
    c,
    LV,
    'aiSubstitution.freshnessBelowByPersonality',
    Object.keys(as.freshnessBelowByPersonality),
    economy.aiPersonalities.map((p) => p.id),
    'AI personalities (economy.json)',
  );
  // Trait offers: never physique, acquired or flaw; positives are boons or edges, burdens are burdens.
  const learned = traits.rollRules.learned;
  sameAs('offers.traitOffer.maxRolledAndLearned', levels.offers.traitOffer.maxRolledAndLearned, learned.maxRolledAndLearned, 'traits.json rollRules.learned');
  const checkOffer = (list: readonly { id: string }[], path: string, kinds: readonly string[]): void => {
    const seen = new Set<string>();
    list.forEach((e, i) => {
      const t = traitById.get(e.id);
      if (seen.has(e.id)) c.error(LV, `${path}[${i}].id`, `duplicate trait "${e.id}"`);
      seen.add(e.id);
      if (!t) {
        c.error(LV, `${path}[${i}].id`, `unknown trait "${e.id}"`);
        return;
      }
      if (t.category === 'physique' || t.category === 'acquired') c.error(LV, `${path}[${i}].id`, `"${e.id}" is a ${t.category} trait (never offered)`);
      if (!kinds.includes(t.kind)) c.error(LV, `${path}[${i}].id`, `"${e.id}" is a ${t.kind}; this list takes ${kinds.join(' or ')}`);
    });
  };
  checkOffer(levels.traitOfferPool.positive, 'traitOfferPool.positive', ['boon', 'edge']);
  checkOffer(levels.traitOfferPool.burdens, 'traitOfferPool.burdens', ['burden']);
}
