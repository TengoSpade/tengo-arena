/**
 * core/tactics — rule engine (03-combat sys-tactics, sys-targeting).
 * Owner: WP1 (combat). CONTRACT: signatures below are fixed; bodies are stubs.
 *
 * Flow: resolveTactics (assignment -> RuleList) -> compileTactics (once per
 * fight) -> evaluateTactics (every decision interval, by core/sim).
 * Rules: ordered, first valid rule wins, NOT on every condition, ONLY or
 * PREFER (one per rule), per-rule cooldown, an unremovable stance at the end
 * (01 §7). Deterministic targeting with published tie-breaks; never random.
 */
import type { AbilityDef, ContentDB, PresetDef, RuleDef } from '../content';
import type { ClassId, RuleTraceEntry, Side, TacticsAssignment, UnitIndex } from '../model';
import { notImplemented, type EngineError, type Result } from '../util';

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
}

/** What a fighter decided to do. `rule` = ruleCount means the stance. */
export interface Decision {
  rule: number;
  action: 'attack' | 'ability' | 'kite' | 'hold' | 'protect' | 'regroup' | 'stance';
  slot: 'a1' | 'a2' | null;
  target: UnitIndex | null;
  band: Band | null;
}

export interface Evaluation {
  decision: Decision;
  /** Why each rule before the chosen one was skipped (P-22). */
  trace: RuleTraceEntry[];
}

/** Resolve a TacticsAssignment for a fighter of `classId` (preset must belong to the class). */
export function resolveTactics(assignment: TacticsAssignment, classId: ClassId, content: ContentDB): Result<RuleList, EngineError> {
  return notImplemented('tactics.resolveTactics', assignment, classId, content);
}

/** The class's presets, default first. */
export function presetsForClass(classId: ClassId, content: ContentDB): PresetDef[] {
  return notImplemented('tactics.presetsForClass', classId, content);
}

/** The class's default preset as an assignment. */
export function defaultTactics(classId: ClassId, content: ContentDB): TacticsAssignment {
  return notImplemented('tactics.defaultTactics', classId, content);
}

/** Compile once per fighter per fight; `kit` is the fighter's a1/a2 abilities. */
export function compileTactics(list: RuleList, kit: { a1: AbilityDef; a2: AbilityDef }, content: ContentDB): CompiledTactics {
  return notImplemented('tactics.compileTactics', list, kit, content);
}

/** Evaluate top-down; first valid rule wins; falls back to the stance. Pure; never draws randomness. */
export function evaluateTactics(compiled: CompiledTactics, view: BattleView, unit: UnitIndex): Evaluation {
  return notImplemented('tactics.evaluateTactics', compiled, view, unit);
}

/** Human-readable sentence of a rule for UI ("When an ally is below 40% → Mend → lowest-HP ally"), from vocabulary labels. */
export function describeRule(rule: RuleDef, classId: ClassId, content: ContentDB): string {
  return notImplemented('tactics.describeRule', rule, classId, content);
}
