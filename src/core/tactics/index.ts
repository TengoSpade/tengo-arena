/**
 * core/tactics — rule engine (03-combat sys-tactics, sys-targeting).
 * Owner: WP1 (combat). CONTRACT: the original signatures below are fixed;
 * additions are marked "additive".
 *
 * Flow: resolveTactics (assignment -> RuleList) -> compileTactics (once per
 * fight) -> evaluateTactics (every decision interval, by core/sim).
 * Rules: ordered, first valid rule wins, NOT on every condition, ONLY or
 * PREFER (one per rule), per-rule cooldown, an unremovable stance at the end
 * (01 §7). Deterministic targeting with published tie-breaks; never random.
 */
import type { AbilityDef, ContentDB, PresetDef, RuleDef } from '../content';
import type { ClassId, RuleTraceEntry, Side, TacticsAssignment, TacticsPresetId, UnitIndex } from '../model';
import { asId } from '../model';
import { engineError, err, ok, type EngineError, type Result } from '../util';
import { compileRules, type CompiledInternal } from './compile';
import { describeRuleText } from './describe';
import { evaluate } from './evaluate';

export type Stance = 'aggressive' | 'steady' | 'cautious';
export type Band = 'melee' | 'close' | 'mid' | 'long';
export type Role = 'tank' | 'melee' | 'ranged' | 'controller' | 'healer';

/** A fighter's resolved rule list: ordered rules plus the stance fallback. */
export interface RuleList {
  /** Source preset, or null for custom lists (M3). */
  presetId: string | null;
  stance: Stance;
  rules: readonly RuleDef[];
}

/** Compiled form, built once per fighter per fight. Opaque outside core/tactics. */
export interface CompiledTactics {
  readonly ruleCount: number;
  readonly stance: Stance;
  readonly internal: unknown;
}

/**
 * Read-only view of the fight that rules evaluate against. DECLARED here,
 * IMPLEMENTED by core/sim (tactics never imports sim). Units: distances in
 * mm, HP as basis points of max HP, time in ticks.
 */
export interface BattleView {
  readonly tick: number;
  /** Ticks since round start (fight time). */
  readonly fightTicks: number;
  readonly unitCount: number;
  side(unit: UnitIndex): Side;
  standing(unit: UnitIndex): boolean;
  hpBp(unit: UnitIndex): number;
  /** Focus in whole points (0-100). */
  focus(unit: UnitIndex): number;
  /** Edge-to-edge gap between two units in mm. */
  gapMm(a: UnitIndex, b: UnitIndex): number;
  /** Range band of a gap (combat.json bands). */
  bandOf(gapMm: number): Band;
  roles(unit: UnitIndex): readonly Role[];
  isCaptain(unit: UnitIndex): boolean;
  /** The side's acting captain, if standing. */
  captainOf(side: Side): UnitIndex | null;
  /** The acting captain's current target ("captain's target"). */
  captainTarget(side: Side): UnitIndex | null;
  hasStatus(unit: UnitIndex, status: string): boolean;
  statusStacks(unit: UnitIndex, status: string): number;
  hasStatusCategory(unit: UnitIndex, category: string): boolean;
  hasBuff(unit: UnitIndex): boolean;
  isCasting(unit: UnitIndex): boolean;
  currentTarget(unit: UnitIndex): UnitIndex | null;
  /** Enemies currently targeting the unit. */
  targetersOf(unit: UnitIndex): readonly UnitIndex[];
  /** Damage dealt this round (points). */
  damageDealt(unit: UnitIndex): number;
  /** Standing units of a side within radius of a unit (for clustering). */
  neighboursWithin(unit: UnitIndex, radiusMm: number, side: Side): number;
  downedCount(side: Side): number;
  standingCount(side: Side): number;
  abilityReady(unit: UnitIndex, slot: 'a1' | 'a2'): boolean;
  abilityInRange(unit: UnitIndex, slot: 'a1' | 'a2', target: UnitIndex): boolean;
  basicInRange(unit: UnitIndex, target: UnitIndex): boolean;
  ruleReady(unit: UnitIndex, ruleIndex: number): boolean;
  /** Additive (optional): the unit taunting `unit`, or null. A taunt forces "attack ON the taunter". */
  tauntedBy?(unit: UnitIndex): UnitIndex | null;
  /** Additive (optional): ticks until the ability is off cooldown (trace detail). */
  abilityReadyInTicks?(unit: UnitIndex, slot: 'a1' | 'a2'): number;
  /** Additive (optional): a visible status blocks this ability (e.g. rooted, so no dash). */
  abilityBlocked?(unit: UnitIndex, slot: 'a1' | 'a2'): boolean;
}

/** What a fighter decided to do. `rule` = ruleCount means the stance; -1 a forced decision (taunt). */
export interface Decision {
  rule: number;
  action: 'attack' | 'ability' | 'kite' | 'hold' | 'protect' | 'regroup' | 'stance';
  slot: 'a1' | 'a2' | null;
  target: UnitIndex | null;
  band: Band | null;
}

/** Doc-level skip reasons (03 sys-tactics), next to the model's RuleSkipReason. */
export type TraceReason =
  | 'rule_cooldown'
  | 'cond_false'
  | 'cooldown'
  | 'no_focus'
  | 'silenced'
  | 'blocked'
  | 'no_target'
  | 'only_filtered'
  | 'out_of_range';

/** Additive: a RuleTraceEntry with the details the M2 inspector and recaps show. */
export interface TraceEntry extends RuleTraceEntry {
  reason: TraceReason | null;
  /** Index of the failing condition (cond_false). */
  cond?: number;
  /** Observed value of the failing check (HP bp, gap mm, count, focus), when meaningful. */
  observed?: number | null;
  /** Ticks until the ability is ready (cooldown). */
  readyInTicks?: number;
}

export interface Evaluation {
  decision: Decision;
  /** Why each rule before the chosen one was skipped (P-22). The chosen rule (or stance) is the last entry, fired. */
  trace: TraceEntry[];
  /** Additive: set when a status forced the decision instead of the rules. */
  forced?: 'taunted' | null;
}

/** Resolve a TacticsAssignment for a fighter of `classId` (preset must belong to the class). */
export function resolveTactics(assignment: TacticsAssignment, classId: ClassId, content: ContentDB): Result<RuleList, EngineError> {
  const klass = content.classes.get(classId);
  if (!klass) return err(engineError('tactics.unknown-class', `Unknown class "${classId}"`, { classId }));
  if (assignment.kind === 'preset') {
    const preset = content.presets.get(assignment.presetId);
    if (!preset) {
      return err(engineError('tactics.unknown-preset', `Unknown preset "${assignment.presetId}"`, { presetId: assignment.presetId }));
    }
    if (preset.classId !== classId) {
      return err(
        engineError('tactics.wrong-class', `Preset "${preset.id}" belongs to ${preset.classId}, not ${classId}`, {
          presetId: preset.id,
          classId,
        }),
      );
    }
    return ok({ presetId: preset.id, stance: preset.stance, rules: preset.rules });
  }
  const problem = checkCustomRules(assignment.rules, assignment.stance, content);
  if (problem) return err(problem);
  return ok({ presetId: null, stance: assignment.stance, rules: assignment.rules as RuleDef[] });
}

/** Structural check of an M3 custom list against the closed vocabulary and limits. */
function checkCustomRules(rules: readonly unknown[], stance: unknown, content: ContentDB): EngineError | null {
  const v = content.vocabulary;
  const limits = content.tacticsLimits;
  if (!v.stances.some((s) => s.id === stance)) return engineError('tactics.invalid', `Unknown stance "${String(stance)}"`);
  if (rules.length > limits.maxRules) return engineError('tactics.invalid', `At most ${limits.maxRules} rules`);
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i] as Partial<RuleDef> | null;
    const at = { rule: i };
    if (!r || typeof r !== 'object' || !Array.isArray(r.if) || !r.then || !r.on) {
      return engineError('tactics.invalid', `Rule ${i} is malformed`, at);
    }
    if (r.if.length < 1 || r.if.length > limits.maxConditionsPerRule) {
      return engineError('tactics.invalid', `Rule ${i} needs 1-${limits.maxConditionsPerRule} conditions`, at);
    }
    for (const c of r.if) if (!v.conditions.some((x) => x.id === c.cond)) return engineError('tactics.invalid', `Rule ${i}: unknown condition`, at);
    if (!v.actions.some((x) => x.id === r.then!.type)) return engineError('tactics.invalid', `Rule ${i}: unknown action`, at);
    if (!v.selectors.some((x) => x.id === r.on!.sel)) return engineError('tactics.invalid', `Rule ${i}: unknown selector`, at);
    if (r.only && r.prefer) return engineError('tactics.invalid', `Rule ${i}: ONLY or PREFER, not both`, at);
    for (const p of [r.only, r.prefer]) {
      if (p && !v.predicates.some((x) => x.id === p.pred)) return engineError('tactics.invalid', `Rule ${i}: unknown predicate`, at);
    }
    if (r.then.type === 'ability' && r.then['slot'] !== 'a1' && r.then['slot'] !== 'a2') {
      return engineError('tactics.invalid', `Rule ${i}: ability slot must be a1 or a2`, at);
    }
    if (typeof r.cooldownS !== 'number' || r.cooldownS < 0) return engineError('tactics.invalid', `Rule ${i}: bad cooldown`, at);
  }
  return null;
}

/** The class's presets, default first. */
export function presetsForClass(classId: ClassId, content: ContentDB): PresetDef[] {
  const klass = content.classes.get(classId);
  if (!klass) return [];
  const ids = [klass.defaultPresetId, ...klass.presetIds.filter((id) => id !== klass.defaultPresetId)];
  return ids.map((id) => content.presets.get(id)).filter((p): p is PresetDef => p !== undefined);
}

/** The class's default preset as an assignment. */
export function defaultTactics(classId: ClassId, content: ContentDB): TacticsAssignment {
  const klass = content.classes.require(classId);
  return { kind: 'preset', presetId: asId<TacticsPresetId>(klass.defaultPresetId) };
}

/**
 * Additive: the preset an AI club picks for a style (03 sys-tactics "Preset
 * selection in M1"): tacticsStyle aggressive -> style aggressive, steady ->
 * balanced, cautious -> protective; first match in presetIds order, else the default.
 */
export function presetForStyle(classId: ClassId, tacticsStyle: string, content: ContentDB): TacticsAssignment {
  const klass = content.classes.require(classId);
  const style = tacticsStyle === 'aggressive' ? 'aggressive' : tacticsStyle === 'cautious' ? 'protective' : 'balanced';
  for (const id of klass.presetIds) {
    const p = content.presets.get(id);
    if (p && p.style === style) return { kind: 'preset', presetId: asId<TacticsPresetId>(p.id) };
  }
  return defaultTactics(classId, content);
}

/** Compile once per fighter per fight; `kit` is the fighter's a1/a2 abilities. */
export function compileTactics(list: RuleList, kit: { a1: AbilityDef; a2: AbilityDef }, content: ContentDB): CompiledTactics {
  const internal: CompiledInternal = compileRules(list.rules, list.stance, kit, content);
  return { ruleCount: list.rules.length, stance: list.stance, internal };
}

/** Evaluate top-down; first valid rule wins; falls back to the stance. Pure; never draws randomness. */
export function evaluateTactics(compiled: CompiledTactics, view: BattleView, unit: UnitIndex): Evaluation {
  return evaluate(compiled.internal as CompiledInternal, view, unit);
}

/** Human-readable sentence of a rule for UI ("IF an ally is below 40% HP THEN use Mend ON the lowest-HP ally"), from vocabulary labels. */
export function describeRule(rule: RuleDef, classId: ClassId, content: ContentDB): string {
  return describeRuleText(rule, classId, content);
}

/** Additive: the stance line ("Stance: Cautious — <description>") from content. */
export function describeStance(stance: Stance, content: ContentDB): string {
  const s = content.vocabulary.stances.find((x) => x.id === stance);
  return s ? `${s.name}: ${s.description}` : stance;
}
