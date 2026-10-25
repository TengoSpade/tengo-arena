/**
 * Rule compilation (03 sys-tactics): content rules -> flat, integer-unit
 * records evaluated every decision interval. Parameters missing from a rule
 * take the vocabulary default (tactics-presets.json vocabulary.*[].params).
 *
 * Units: thresholds in basis points of max HP (pct 40 -> 4000), distances in
 * mm, fight time in ticks, focus in whole points.
 */
import type { AbilityDef, ContentDB, RuleDef, RuleParamSpec } from '../content';
import { InvariantError } from '../util';

export type BandId = 'melee' | 'close' | 'mid' | 'long';
export type RoleId = 'tank' | 'melee' | 'ranged' | 'controller' | 'healer';
export type StanceId = 'aggressive' | 'steady' | 'cautious';
export type TargetPool = 'enemies' | 'allies' | 'self' | 'any';

/** Numeric codes for the closed vocabularies (fast switches in the evaluator). */
export const COND_CODES = [
  'always', 'self_hp_below', 'ally_hp_below', 'allies_hp_below', 'enemy_hp_below', 'enemy_within', 'enemies_within',
  'enemies_clustered', 'allies_clustered', 'self_targeted', 'ally_targeted', 'enemy_casting', 'self_has_status',
  'ally_has_status', 'enemy_has_status', 'fight_time_below', 'focus_at_least', 'outnumbered', 'allies_down',
  'enemy_role_within', 'captain_alive',
] as const;
export const SEL_CODES = [
  'self', 'nearest_enemy', 'furthest_enemy', 'lowest_hp_enemy', 'top_damage_enemy', 'enemy_targeting_me',
  'enemy_targeting_ally', 'casting_enemy', 'densest_enemy', 'captain_target', 'marked_enemy', 'enemy_role',
  'lowest_hp_ally', 'most_targeted_ally', 'ally_role', 'densest_ally', 'captain', 'current_target',
] as const;
export const PRED_CODES = [
  'in_range', 'within', 'hp_below', 'hp_above', 'has_status', 'lacks_status', 'has_buff', 'role', 'not_role',
  'not_targeted_by_ally', 'targeting_me', 'not_self',
] as const;

function codeOf(list: readonly string[], id: string, what: string): number {
  const i = list.indexOf(id);
  if (i < 0) throw new InvariantError(`Unknown ${what} "${id}"`);
  return i;
}

/** One condition with every parameter resolved (unused fields are 0 / null). */
export interface CCond {
  code: number;
  id: string;
  not: boolean;
  /** HP threshold in bp (strictly below). */
  hpBp: number;
  count: number;
  /** Band limit in mm, or -1 when no band is given. */
  bandMm: number;
  radiusMm: number;
  includeSelf: boolean;
  role: RoleId | null;
  status: string | null;
  category: string | null;
  ticks: number;
  amount: number;
}

export interface CSelector {
  code: number;
  id: string;
  /** Candidate pool when the action does not fix one. */
  pool: 'enemies' | 'allies' | 'self';
  /** Primary-key kind for stickiness tolerance: 0 gap, 1 HP, 2 count. */
  keyKind: number;
  includeSelf: boolean;
  /** -1 when not limited. */
  withinMm: number;
  radiusMm: number;
  role: RoleId | null;
}

export interface CPredicate {
  code: number;
  id: string;
  bandMm: number;
  hpBp: number;
  status: string | null;
  category: string | null;
  minStacks: number;
  role: RoleId | null;
}

export interface CAction {
  type: 'attack' | 'ability' | 'kite' | 'hold' | 'protect' | 'regroup';
  slot: 'a1' | 'a2' | null;
  /** Ability range in mm (abilities only; basic-range actions use the view). */
  rangeMm: number;
  approach: boolean;
  focusCost: number;
  /** Candidate pool for the selector. */
  pool: TargetPool;
  /** For ally pools: whether the deciding unit may be picked. */
  selfAllowed: boolean;
  /** Kite band in mm (kite only). */
  bandMm: number;
  band: BandId | null;
}

export interface CRule {
  index: number;
  id: string;
  conds: CCond[];
  action: CAction;
  sel: CSelector;
  only: CPredicate | null;
  prefer: CPredicate | null;
  cooldownTicks: number;
}

/** The opaque `internal` of CompiledTactics. */
export interface CompiledInternal {
  rules: CRule[];
  stance: StanceId;
  /** Per rule: may the deciding unit be its own target? */
  selfAllowed: boolean[];
  bandMm: Record<BandId, number>;
  stickGapMm: number;
  stickHpBp: number;
}

type ParamBag = Readonly<Record<string, unknown>>;

function specDefault(specs: readonly RuleParamSpec[] | undefined, name: string): unknown {
  const spec = specs?.find((s) => s.name === name);
  return spec && 'default' in spec ? spec.default : undefined;
}

function param(bag: ParamBag, specs: readonly RuleParamSpec[] | undefined, name: string): unknown {
  const v = bag[name];
  return v === undefined ? specDefault(specs, name) : v;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function bandTable(content: ContentDB): Record<BandId, number> {
  const out: Record<BandId, number> = { melee: 0, close: 0, mid: 0, long: 0 };
  for (const b of content.combat.bands) out[b.id] = Math.round(b.maxGapM * 1000);
  return out;
}

function bandMm(bands: Record<BandId, number>, v: unknown): number {
  const id = str(v);
  if (id === null) return -1;
  const mm = bands[id as BandId];
  if (mm === undefined) throw new InvariantError(`Unknown band "${id}"`);
  return mm;
}

function poolOfAbility(target: AbilityDef['target']): { pool: TargetPool; selfAllowed: boolean } {
  switch (target) {
    case 'enemy':
      return { pool: 'enemies', selfAllowed: false };
    case 'ally':
      return { pool: 'allies', selfAllowed: false };
    case 'ally_or_self':
      return { pool: 'allies', selfAllowed: true };
    case 'self':
      return { pool: 'self', selfAllowed: true };
  }
}

export function compileRules(
  rules: readonly RuleDef[],
  stance: StanceId,
  kit: { a1: AbilityDef; a2: AbilityDef },
  content: ContentDB,
): CompiledInternal {
  const vocab = content.vocabulary;
  const bands = bandTable(content);
  const condSpecs = new Map(vocab.conditions.map((c) => [c.id as string, c.params]));
  const selSpecs = new Map(vocab.selectors.map((s) => [s.id as string, s.params]));
  const predSpecs = new Map(vocab.predicates.map((p) => [p.id as string, p.params]));
  const actSpecs = new Map(vocab.actions.map((a) => [a.id as string, a.params]));

  const compilePred = (raw: ParamBag & { pred: string }): CPredicate => {
    const specs = predSpecs.get(raw.pred);
    if (!specs) throw new InvariantError(`Unknown rule predicate "${raw.pred}"`);
    return {
      code: codeOf(PRED_CODES, raw.pred, 'rule predicate'),
      id: raw.pred,
      bandMm: bandMm(bands, param(raw, specs, 'band')),
      hpBp: num(param(raw, specs, 'pct')) * 100,
      status: str(raw['status']),
      category: str(raw['category']),
      minStacks: Math.max(1, num(param(raw, specs, 'minStacks'), 1)),
      role: str(param(raw, specs, 'role')) as RoleId | null,
    };
  };

  const out: CRule[] = rules.map((rule, index) => {
    const conds: CCond[] = rule.if.map((raw) => {
      const specs = condSpecs.get(raw.cond);
      if (!specs) throw new InvariantError(`Unknown rule condition "${raw.cond}"`);
      const bag = raw as ParamBag;
      return {
        code: codeOf(COND_CODES, raw.cond, 'rule condition'),
        id: raw.cond,
        not: raw.not === true,
        hpBp: num(param(bag, specs, 'pct')) * 100,
        count: num(param(bag, specs, 'count'), 1),
        // Optional band params apply only when the rule sets them (sys-tactics: "[within {band}]").
        bandMm: bandMm(bands, isOptional(specs, 'band') ? bag['band'] : param(bag, specs, 'band')),
        radiusMm: Math.round(num(param(bag, specs, 'radiusM')) * 1000),
        includeSelf: bool(param(bag, specs, 'includeSelf'), false),
        role: (isOptional(specs, 'role') ? str(bag['role']) : str(param(bag, specs, 'role'))) as RoleId | null,
        status: str(bag['status']),
        category: str(bag['category']),
        ticks: num(param(bag, specs, 'seconds')) * content.combat.tick.ticksPerSecond,
        amount: num(param(bag, specs, 'amount')),
      };
    });

    const thenBag = rule.then as ParamBag;
    const actSpec = actSpecs.get(rule.then.type);
    const type = rule.then.type;
    let action: CAction;
    if (type === 'ability') {
      const slot = str(thenBag['slot']);
      if (slot !== 'a1' && slot !== 'a2') throw new InvariantError(`Rule ${rule.id}: ability slot must be a1 or a2`);
      const ab = kit[slot];
      const { pool, selfAllowed } = poolOfAbility(ab.target);
      action = {
        type,
        slot,
        rangeMm: Math.round(ab.rangeM * 1000),
        approach: ab.approach,
        focusCost: ab.focusCost,
        pool,
        selfAllowed,
        bandMm: -1,
        band: null,
      };
    } else {
      const band = type === 'kite' ? (str(param(thenBag, actSpec, 'band')) as BandId | null) : null;
      action = {
        type,
        slot: null,
        rangeMm: -1,
        approach: true,
        focusCost: 0,
        pool: type === 'protect' || type === 'regroup' ? 'allies' : type === 'hold' ? 'any' : 'enemies',
        selfAllowed: false,
        bandMm: band ? bands[band] : -1,
        band,
      };
    }

    const onBag = rule.on as ParamBag;
    const sSpecs = selSpecs.get(rule.on.sel);
    if (!sSpecs) throw new InvariantError(`Unknown selector "${rule.on.sel}"`);
    const withinRaw = onBag['withinM'];
    const selCode = codeOf(SEL_CODES, rule.on.sel, 'selector');
    const sel: CSelector = {
      code: selCode,
      id: rule.on.sel,
      pool: poolOfSelector(rule.on.sel),
      keyKind: keyKindOf(rule.on.sel),
      includeSelf: bool(param(onBag, sSpecs, 'includeSelf'), false),
      withinMm: typeof withinRaw === 'number' ? Math.round(withinRaw * 1000) : -1,
      radiusMm: Math.round(num(param(onBag, sSpecs, 'radiusM')) * 1000),
      role: (isOptional(sSpecs, 'role') ? str(onBag['role']) : str(param(onBag, sSpecs, 'role'))) as RoleId | null,
    };

    return {
      index,
      id: rule.id,
      conds,
      action,
      sel,
      only: rule.only ? compilePred(rule.only as ParamBag & { pred: string }) : null,
      prefer: rule.prefer ? compilePred(rule.prefer as ParamBag & { pred: string }) : null,
      cooldownTicks: Math.round(rule.cooldownS * content.combat.tick.ticksPerSecond),
    };
  });

  return {
    rules: out,
    stance,
    selfAllowed: out.map((r) => allowsSelf(r.sel, r.action)),
    bandMm: bands,
    stickGapMm: Math.round(content.combat.movement.stickiness.gapM * 1000),
    stickHpBp: Math.round(content.combat.movement.stickiness.hpPct * 100),
  };
}

function poolOfSelector(id: string): 'enemies' | 'allies' | 'self' {
  if (id === 'self') return 'self';
  if (id === 'lowest_hp_ally' || id === 'most_targeted_ally' || id === 'ally_role' || id === 'densest_ally' || id === 'captain') return 'allies';
  return 'enemies';
}

function keyKindOf(id: string): number {
  switch (id) {
    case 'nearest_enemy':
    case 'furthest_enemy':
    case 'enemy_targeting_me':
    case 'casting_enemy':
    case 'marked_enemy':
    case 'enemy_role':
    case 'ally_role':
      return 0;
    case 'lowest_hp_enemy':
    case 'lowest_hp_ally':
    case 'enemy_targeting_ally':
      return 1;
    default:
      return 2;
  }
}

/** Ally pools exclude the deciding unit unless the selector's includeSelf allows it (protect / regroup never). */
function allowsSelf(sel: CSelector, action: CAction): boolean {
  if (action.type === 'protect' || action.type === 'regroup') return false;
  if (action.type === 'ability' && !action.selfAllowed) return false;
  switch (sel.id) {
    case 'lowest_hp_ally':
    case 'most_targeted_ally':
      return sel.includeSelf;
    case 'captain':
      return action.type === 'ability' ? action.selfAllowed : true;
    case 'self':
      return true;
    default:
      return false;
  }
}

function isOptional(specs: readonly RuleParamSpec[] | undefined, name: string): boolean {
  const spec = specs?.find((s) => s.name === name);
  return spec !== undefined && 'optional' in spec && spec.optional === true;
}
