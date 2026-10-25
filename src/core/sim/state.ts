/**
 * Fight runtime state (03 sys-fight-sim "Entities and state"). Lives only
 * inside one simulateFight call. Integer units throughout: positions mm,
 * HP points, focus millipoints, accumulators bp-ticks, time ticks.
 */
import type { FightFighterInput } from '../model';
import type { Rng } from '../rng';
import type { CompiledTactics, Decision, TraceEntry } from '../tactics';
import type { CAbility, CClass, CEffect, CStatMod, CStatus, CTrigger } from './tables';
import { STAT_COUNT } from './tables';

export const ACT_NONE = 0;
export const ACT_WINDUP = 1;
export const ACT_CAST = 2;
export const ACT_CHANNEL = 3;

export interface StatusInst {
  st: CStatus;
  /** Applying unit, or -1 for the captain system. */
  source: number;
  ability: string | null;
  /** Active on ticks appliedAt+1 .. end inclusive. */
  appliedAt: number;
  end: number;
  magnitude: number;
  stacks: number;
  maxStacks: number;
  /** Damage or heal over time: per-stack amount in centipoints. */
  tick: { interval: number; next: number; centi: number; dtype: number; heal: boolean } | null;
  resetOnTargetChange: boolean;
  /** Deathward heal (centipoints, healing pipeline applied at the save). */
  wardHealCenti: number;
  /** Guarded: guardian and radius. */
  guardRadiusMm: number;
  seq: number;
}

export interface ShieldInst {
  source: number;
  ability: string | null;
  amount: number;
  end: number;
  createdAt: number;
  seq: number;
}

/** Caster values frozen at release (projectiles, zones and DoTs keep them). */
export interface Snap {
  power: number;
  support: number;
  maxHp: number;
  hp: number;
  armor: number;
  ward: number;
}

/** One release (or trigger firing): the context every effect it creates shares. */
export interface Release {
  id: number;
  source: number;
  ability: CAbility | null;
  snap: Snap;
  /** Triggered effects never trigger thorns, lifesteal or triggers of the same fighter (03 sys-abilities). */
  fromTrigger: boolean;
  /** Reflected damage (thorns) never reflects, steals or triggers. */
  reflect: boolean;
  isBasic: boolean;
  triggerAmount: number;
  /** Post-mitigation damage dealt to each target by the preceding damage effect (Amount stat lastDamage). */
  lastDamage: Map<number, number> | null;
}

export interface Zone {
  owner: number;
  ability: string | null;
  rel: Release;
  x: number;
  y: number;
  radiusMm: number;
  follow: boolean;
  end: number;
  interval: number;
  next: number;
  trap: { armAt: number; consume: boolean } | null;
  allies: CEffect[];
  enemies: CEffect[];
  createdAt: number;
  seq: number;
  dead: boolean;
  /** At most this many live zones of the ability per caster (0 = unlimited); the oldest goes. */
  maxActive: number;
}

export interface Projectile {
  rel: Release;
  ability: CAbility;
  target: number;
  land: number;
  seq: number;
}

export interface Displacement {
  kind: 'dash' | 'leap' | 'knockback' | 'pull';
  tx: number;
  ty: number;
  speed: number;
  /** Stop when the gap to this unit is at most stopGapMm (-1: none). */
  stopUnit: number;
  stopGapMm: number;
  /** Ability effects to resolve on arrival (dash and leap deliveries). */
  arrive: { rel: Release; ability: CAbility; target: number } | null;
  fromX: number;
  fromY: number;
  startedAt: number;
}

export interface Pending {
  decision: Decision;
  trace: TraceEntry[];
  createdAt: number;
  commitAt: number;
  causes: string[];
}

export interface DownInfo {
  tick: number;
  by: number;
  ability: string | null;
  hit: number;
  overkill: number;
  damageTakenRound: number;
}

/** Per-round recap counters (RoundRecap, FighterMatchStats). */
export interface Tally {
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
  casts: Map<string, number>;
  ruleFires: number[];
  ruleTicks: number[];
  ruleSkips: Map<string, number>[];
  forcedCommits: number;
  ticksStanding: number;
}

export class Unit {
  readonly index: number;
  readonly side: 0 | 1;
  readonly slot: number;
  readonly input: FightFighterInput;
  readonly cls: CClass;
  readonly tactics: CompiledTactics;
  readonly ruleCount: number;
  readonly attrs: number[];

  // ---- Static derived values ------------------------------------------------
  maxHp = 1;
  armor0 = 0;
  ward0 = 0;
  power0 = 1;
  support0 = 0;
  /** Move speed in mm/tick x 10,000 before the speed multiplier. */
  speedE4 = 0;
  intervalTicks = 1;
  swingThreshold = 1;
  atkSpeed0 = 10_000;
  atkSpeedMax = 10_000;
  crit0 = 0;
  evade0 = 0;
  tenacity0 = 0;
  resolve0 = 0;
  focusRegen0 = 0;
  basicRangeMm = 0;
  cq = 50;
  /** Unconditional passive stat mods. */
  staticMods: Int32Array = new Int32Array(STAT_COUNT);
  /** Passive mods with a self predicate or a `per` scale. */
  condMods: CStatMod[] = [];
  /** Passive and trait mods evaluated per hit against the target (as dealer). */
  hitDealtMods: CStatMod[] = [];
  /** Passive mods evaluated per hit against the attacker (as recipient). */
  hitTakenMods: CStatMod[] = [];
  /** Trait mods with self / time / ally-down predicates. */
  traitMods: CStatMod[] = [];
  enemyAura: { bandMm: number; composure: number } | null = null;
  shakenMultBp = 10_000;
  rallyMultBp = 10_000;
  triggers: CTrigger[] = [];

  // ---- Dynamic state ------------------------------------------------------
  hp = 1;
  focus = 0;
  x = 0;
  y = 0;
  standing = true;
  downTick = -1;
  mods = new Int32Array(STAT_COUNT);
  auraMods = new Int32Array(STAT_COUNT);
  auraTraitComposure = 0;
  /** Aura entries conditioned on the attacker (e.g. Cover), evaluated per hit. */
  auraHitTaken: CStatMod[] = [];
  cmpEff = 10;
  statuses: StatusInst[] = [];
  shields: ShieldInst[] = [];
  cdA1 = 0;
  cdA2 = 0;
  swingAcc = 0;
  act = ACT_NONE;
  actLeft = 0;
  actAbility: CAbility | null = null;
  actTarget = -1;
  actStart = 0;
  channelNext = 0;
  channelEnd = 0;
  disp: Displacement | null = null;
  committed: Decision | null = null;
  committedTrace: TraceEntry[] | null = null;
  forced = false;
  pending: Pending | null = null;
  nextEval = 0;
  firstDecision = true;
  ruleCdEnd: number[];
  critAcc = 0;
  evadeAcc = 0;
  rngVariance: Rng;
  rngReact: Rng;
  stagger = 0;
  basicHits = 0;
  lastBasicTarget = -1;
  momentumReset = false;
  healsCast = 0;
  triggerReadyAt: number[] = [];
  lamplightDone = 0;
  /** Post-mitigation damage taken per tick, ring buffer over the recent-damage window. */
  dmgRing: Int32Array;
  dmgRingTick: Int32Array;
  lastHitBy: Int32Array;
  lastHits: { tick: number; by: number; ability: string | null; amount: number }[] = [];
  lastSupportTick = -1_000_000;
  /** Anti-stuck sampling (sys-fight-ai). */
  stuckSampleTick = 0;
  stuckSampleGap = -1;
  sidestepFlipUntil = -1;
  /** The enemy this unit swings at in hold / protect / regroup. */
  subTarget = -1;
  /** Movement flags set in the movement phase, read by the next actions phase. */
  retreatBlocked = false;
  inPosition = false;
  protectAttacker = -1;
  /** The rule whose movement action was last committed (for movement-rule cooldowns). */
  tally: Tally;
  down: DownInfo | null = null;
  roundDamageTaken = 0;

  constructor(
    index: number,
    side: 0 | 1,
    slot: number,
    input: FightFighterInput,
    cls: CClass,
    tactics: CompiledTactics,
    attrs: number[],
    rngVariance: Rng,
    rngReact: Rng,
    ringSize: number,
  ) {
    this.index = index;
    this.side = side;
    this.slot = slot;
    this.input = input;
    this.cls = cls;
    this.tactics = tactics;
    this.ruleCount = tactics.ruleCount;
    this.attrs = attrs;
    this.rngVariance = rngVariance;
    this.rngReact = rngReact;
    this.ruleCdEnd = new Array<number>(tactics.ruleCount).fill(0);
    this.dmgRing = new Int32Array(ringSize);
    this.dmgRingTick = new Int32Array(ringSize).fill(-1);
    this.lastHitBy = new Int32Array(10).fill(-1_000_000);
    this.tally = newTally(tactics.ruleCount);
  }
}

export function newTally(ruleCount: number): Tally {
  return {
    damageDealt: 0,
    damageToShields: 0,
    damageTaken: 0,
    healingDone: 0,
    shieldingDone: 0,
    overheal: 0,
    ccAppliedTicks: 0,
    ccReceivedTicks: 0,
    downsInflicted: 0,
    assists: 0,
    focusSpent: 0,
    casts: new Map(),
    ruleFires: new Array<number>(ruleCount + 1).fill(0),
    ruleTicks: new Array<number>(ruleCount + 1).fill(0),
    ruleSkips: Array.from({ length: ruleCount + 1 }, () => new Map<string, number>()),
    forcedCommits: 0,
    ticksStanding: 0,
  };
}

/** A unit of work in the resolution phase, processed by source in order(t), then by creation sequence. */
export type Job =
  | { kind: 'release'; seq: number; source: number; rel: Release; ability: CAbility; target: number }
  | { kind: 'effects'; seq: number; source: number; rel: Release; effects: CEffect[]; target: number; cx: number; cy: number }
  | { kind: 'dot'; seq: number; source: number; inst: StatusInst; holder: number }
  | { kind: 'regen'; seq: number; source: number }
  | { kind: 'zone'; seq: number; source: number; zone: Zone }
  | { kind: 'reflect'; seq: number; source: number; rel: Release; target: number; centi: number }
  | { kind: 'fixedHeal'; seq: number; source: number; rel: Release; target: number; centi: number; ability: string | null }
  | { kind: 'riposte'; seq: number; source: number; rel: Release; target: number; centi: number };

/** Effects queued during resolution that apply at commit (03 sys-fight-sim step 6). */
export interface QueuedStatus {
  rel: Release;
  target: number;
  eff: Extract<CEffect, { type: 'status' }>;
  guardian: number;
  guardPct: number;
  guardRadiusMm: number;
}
