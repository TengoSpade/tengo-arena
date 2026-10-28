import type { Seed } from '../rng';
import { StreamHasher, stableStringify } from '../util';
import type { RoundTiebreakStep } from './match';
import type { AbilityId, ClassId, ClubId, FighterId } from './ids';

/**
 * Fight event stream (03-combat sys-match-report): the contract between
 * core/sim (the only producer), match reports (core/game, src/ui) and the M2
 * arena viewer (src/render, a pure consumer).
 *
 * Units in events: positions in integer CENTIMETRES (the sim works in
 * millimetres internally and converts when recording; orchestrator decision
 * 2026-10-25), time in ticks (50 ms), amounts in whole points.
 */

export const FIGHT_LOG_FORMAT = 'arena-league-fight';

/**
 * M2 contract (docs/design/_drafts/05-technical-m2.md, tech-016): the version of the RECORDED SHAPE of
 * events, separate from the sim's ENGINE_VERSION (which covers outcomes). 1 = M1/M1.1 (frames
 * [x, y, hp, stateBits], no `FightHeader.logFormat`). 2 (planned, WP-M2A) = frames also carry shield and
 * focus, and the header names its format. A format bump changes full-level event hashes (goldens are
 * re-pinned) but never a result, a round checksum or the replayability of a stored match, because replays
 * are verified by round checksums, which are identical at every record level.
 */
export const FIGHT_LOG_FORMAT_VERSION = 2;

/**
 * How much the sim records. The OUTCOME must be identical at every level
 * (REQUIRED, T4 / vis-009; tested): recording never draws randomness.
 * - none:    results and checksum only (AI-vs-AI matches, balance runs)
 * - summary: + events marked S below (match reports)
 * - full:    + every event and frames (M2 viewer, determinism tests)
 */
export type RecordLevel = 'none' | 'summary' | 'full';

/** 0 = home side, 1 = away side. */
export type Side = 0 | 1;

/** Index into FightHeader.units: 0-4 home, 5-9 away. */
export type UnitIndex = number;

export interface FightUnitInfo {
  index: UnitIndex;
  side: Side;
  fighterId: FighterId;
  clubId: ClubId;
  classId: ClassId;
  slot: number;
  row: 'front' | 'back';
  isCaptain: boolean;
}

export interface FightHeader {
  format: typeof FIGHT_LOG_FORMAT;
  engineVersion: number;
  contentHash: string;
  /** Round seed. */
  seed: Seed;
  round: number;
  /** 50 (combat.json tick.tickMs). */
  tickMs: number;
  /** A frame every N ticks at 'full' (combat.json events.frameEveryTicks). */
  frameEvery: number;
  /** Arena size in cm. */
  arena: { width: number; height: number };
  units: FightUnitInfo[];
  /** M2 (additive, optional): FIGHT_LOG_FORMAT_VERSION of this log; absent = 1. */
  logFormat?: number;
}

/** Envelope shared by every event. */
export interface SimEvent<T extends string = string, D = unknown> {
  /** 0-based, strictly increasing within one fight. */
  seq: number;
  tick: number;
  type: T;
  /** Acting unit, if any. */
  unit?: UnitIndex;
  /** Target unit, if any. */
  target?: UnitIndex;
  data?: D;
}

export interface UnitSpawn {
  unit: UnitIndex;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  focus: number;
  // ---- M1.1 (engine 2; absent in engine-1 logs) ----
  /** Freshness 0-100 at the round start and the resulting penalty severity (bp). */
  freshness?: number;
  fatigueBp?: number;
  abilityRanks?: { a1: number; a2: number; passive: number };
  perkIds?: string[];
  enteredThisRound?: boolean;
}

/**
 * [x cm, y cm, hp, stateBits, shield, focus]. stateBits: 1 casting, 2 stunned/asleep, 4 rooted, 8 silenced, 16 downed.
 * M2 (log format 2, WP-M2A): `shield` (total shield points) and `focus` (whole points) are appended so the
 * viewer's shield segment and focus bar are exact; format-1 logs have four elements (the viewer then hides both).
 */
export type FrameUnit = [x: number, y: number, hp: number, stateBits: number, shield?: number, focus?: number];

/** Why a rule was skipped (P-22 inspector / recap). */
export type RuleSkipReason =
  | 'condition_false'
  | 'no_target'
  | 'only_filtered_all'
  | 'on_cooldown'
  | 'rule_cooldown'
  | 'no_focus'
  | 'out_of_range'
  | 'blocked';

export interface RuleTraceEntry {
  /** Rule index; the stance is index = rule count. */
  rule: number;
  fired: boolean;
  skip: RuleSkipReason | null;
  // ---- Detail the sim has recorded since engine 1 at 'full' (core/tactics TraceEntry); typed here for the
  // M2 pause inspector (P-22). Additive and optional: summary recaps and hand-built traces omit them. ----
  /**
   * The doc-level reason (03 sys-tactics; core/tactics TraceReason): 'rule_cooldown', 'cond_false', 'cooldown',
   * 'no_focus', 'silenced', 'blocked', 'no_target', 'only_filtered', 'out_of_range'; null on the fired entry.
   */
  reason?: string | null;
  /** Index of the failing condition within the rule (cond_false). */
  cond?: number;
  /** Observed value of the failing check (HP bp, gap mm, a count, focus points, fight ticks), when meaningful. */
  observed?: number | null;
  /** Ticks until the ability is ready (cooldown). */
  readyInTicks?: number;
}

export interface RoundRecap {
  unit: UnitIndex;
  damageDealt: number;
  damageToShields: number;
  damageTaken: number;
  healingDone: number;
  shieldingDone: number;
  overheal: number;
  ccAppliedTicks: number;
  ccReceivedTicks: number;
  downsInflicted: number;
  assists: number;
  focusSpent: number;
  casts: Record<AbilityId, number>;
  ruleFires: number[];
  ruleCommittedTicks: number[];
  ruleSkips: Partial<Record<RuleSkipReason, number>>[];
  stanceTicks: number;
  // ---- M1.1 (engine 2; absent in engine-1 logs) ----
  freshness?: number;
  /** levels.json freshness label id at the round start. */
  freshnessLabel?: string;
  /** 'tired' / 'spent' when the round started below the threshold (report tag "Tired (52)"). */
  fatigueTag?: 'tired' | 'spent' | null;
  fatigueBp?: number;
  /** Trigger fires per perk this round. */
  perkProcs?: Record<string, number>;
  enteredThisRound?: boolean;
}

/** Every event type, keyed by `type`, with its data. Level: S = summary and full, F = full only. */
export interface FightEventData {
  /** S */ 'fight.start': { units: UnitSpawn[] };
  /** F */ frame: { u: FrameUnit[] };
  /** F (counted at S) */ 'unit.decide': {
    rule: number;
    action: string;
    targetUnit: UnitIndex | null;
    reactTicks: number;
    reactCauses: string[];
    commitTick: number;
    trace: RuleTraceEntry[];
  };
  /** F */ 'attack.start': { windupTicks: number };
  /** F */ 'attack.cancel': { reason: string };
  /** F */ 'cast.start': { ability: AbilityId; castTicks: number };
  /** S for actives, F for basics */ 'cast.release': { ability: AbilityId; focusSpent: number; cooldownTicks: number };
  /** S */ 'cast.interrupt': { ability: AbilityId; by: UnitIndex | null; cause: string };
  /** F */ 'projectile.launch': { ability: AbilityId; landTick: number };
  /** F (aggregated at S) */ hit: {
    ability: AbilityId | null;
    amount: number;
    toShield: number;
    overkill: number;
    damageType: 'physical' | 'arcane' | 'true';
    crit: boolean;
    guardRedirect: boolean;
    preMitigation: number;
  };
  /** F */ evade: { ability: AbilityId | null };
  /** F */ heal: { ability: AbilityId | null; amount: number; overheal: number };
  /** F */ 'shield.gain': { ability: AbilityId | null; amount: number; expiresTick: number };
  /** F */ 'shield.break': Record<string, never>;
  /** F (CC at S) */ 'status.apply': {
    status: string;
    ability: AbilityId | null;
    durationTicks: number;
    magnitude: number;
    stacks: number;
    drStep: number | null;
  };
  /** F */ 'status.expire': { status: string };
  /** F */ 'status.resist': { status: string; reason: 'dr_immune' | 'below_min' | 'immune' };
  /** F */ displace: { kind: 'dash' | 'leap' | 'knockback' | 'pull'; from: [number, number]; to: [number, number]; ticks: number };
  /** F */ 'zone.spawn': { ability: AbilityId; x: number; y: number; radius: number };
  /** F */ 'zone.trigger': Record<string, never>;
  /** F */ 'zone.expire': Record<string, never>;
  /** S */ 'deathward.save': { by: UnitIndex | null; healed: number };
  /** S */ 'captain.rally': { composure: number };
  /** S */ 'captain.down': Record<string, never>;
  /** S */ 'captain.handover': { newCaptain: UnitIndex; cq: number };
  /** S (M1.1) A perk's trigger fired (unit = holder, target = the effect target). */ 'perk.proc': { perk: string };
  /** S */ 'overtime.start': Record<string, never>;
  /** S */ 'unit.down': { by: UnitIndex | null; ability: AbilityId | null; hit: number; overkill: number; assists: UnitIndex[] };
  /** S */ 'fight.end': { winner: Side; reason: 'elimination' | 'time-limit'; tiebreakStep: RoundTiebreakStep | null };
  /** S */ 'round.summary': { units: RoundRecap[] };
  /**
   * S, RESERVED for the calls package (P-01, sys-calls; 05-technical-m2 §A6): a call took effect at the start of
   * this tick. unit = the acting captain who relays it. Never emitted before that package (no hash changes).
   */
  'call.issue': { side: Side; kind: string; target: UnitIndex | null; index: number };
}

export type FightEventType = keyof FightEventData;

/** Discriminated union of every fight event. */
export type FightEvent = { [K in FightEventType]: SimEvent<K, FightEventData[K]> }[FightEventType];

/** Event types recorded at 'summary' level (the rest only at 'full'). */
export const SUMMARY_EVENT_TYPES: readonly FightEventType[] = [
  'fight.start',
  'cast.interrupt',
  'deathward.save',
  'captain.rally',
  'captain.down',
  'captain.handover',
  'perk.proc',
  'overtime.start',
  'unit.down',
  'fight.end',
  'round.summary',
];

export interface FightLog {
  header: FightHeader;
  events: FightEvent[];
  /** hashEventStream(header, events). */
  hash: string;
}

/** Canonical hash of a fight's header and event stream (replays and determinism tests compare it). */
export function hashEventStream(header: FightHeader, events: readonly SimEvent[]): string {
  const hasher = new StreamHasher();
  hasher.update(stableStringify(header));
  for (const event of events) hasher.update(stableStringify(event));
  return hasher.digest();
}
