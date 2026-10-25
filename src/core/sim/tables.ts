/**
 * Content -> sim tables in integer engine units, built once per ContentDB and
 * cached (03-combat schema notes 2 and 10; 05 tech-014).
 *
 * Units: distances mm, time ticks, fractions/chances basis points (bp),
 * amounts centipoints, focus millipoints. Stat-mod values use the unit of
 * their stat kind (combat.json statModStats): fraction/chance/fraction_per_s
 * -> bp, flat/points/flag -> whole units, hp_per_s -> centipoints.
 */
import type { AbilityDef, Amount, ClassDef, ContentDB, Effect, EffectPredicate, StatMod, StatusDef, TraitDef, Trigger } from '../content';
import { STATUS_IDS, STAT_MOD_STATS } from '../content';
import { InvariantError } from '../util';

export const BP = 10_000;

// ---- Indices --------------------------------------------------------------------------------

/** Attribute indices (combat.json attributes order). */
export const ATTR = { str: 0, agi: 1, pac: 2, tgh: 3, pre: 4, arc: 5, spi: 6, wil: 7, cmp: 8, ldr: 9, awr: 10, dis: 11 } as const;
export const ATTR_IDS = ['str', 'agi', 'pac', 'tgh', 'pre', 'arc', 'spi', 'wil', 'cmp', 'ldr', 'awr', 'dis'] as const;

/** Stat-mod indices; must equal the content's closed STAT_MOD_STATS order (checked at build). */
export const ST = {
  maxHp: 0,
  armor: 1,
  ward: 2,
  moveSpeed: 3,
  attackSpeed: 4,
  power: 5,
  support: 6,
  crit: 7,
  evade: 8,
  tenacity: 9,
  resolve: 10,
  composure: 11,
  reactionDelay: 12,
  damageDealt: 13,
  damageTaken: 14,
  healingDealt: 15,
  healingReceived: 16,
  thorns: 17,
  lifesteal: 18,
  hpRegenPct: 19,
  hpRegenFlat: 20,
  ccDurationDealt: 21,
  debuffDurationDealt: 22,
  focusRegen: 23,
  cooldownRate: 24,
  windup: 25,
  displaceImmune: 26,
} as const;
export const STAT_COUNT = 27;

/** Status codes: index in the closed STATUS_IDS vocabulary (stable, code-owned). */
export const STATUS_CODE = new Map<string, number>(STATUS_IDS.map((id, i) => [id, i]));
const code = (id: (typeof STATUS_IDS)[number]): number => STATUS_IDS.indexOf(id);
export const SC_STUN = code('stun');
export const SC_SLEEP = code('sleep');
export const SC_ROOT = code('root');
export const SC_SILENCE = code('silence');
export const SC_TAUNT = code('taunt');
export const SC_ANCHORED = code('anchored');
export const SC_RALLIED = code('rallied');

export const DT_PHYSICAL = 0;
export const DT_ARCANE = 1;
export const DT_TRUE = 2;

// ---- Compiled shapes ------------------------------------------------------------------------

export type AmountStat = 'power' | 'support' | 'maxHp' | 'missingHp' | 'armor' | 'ward' | 'targetMaxHp' | 'targetMissingHp' | 'triggerAmount' | 'lastDamage';

export interface CAmount {
  baseCenti: number;
  scale: { stat: AmountStat; coefBp: number }[];
}

export interface CPred {
  p: EffectPredicate['p'];
  hpBp: number;
  statuses: string[];
  gapMm: number;
  ticks: number;
  count: number;
  of: CPred[];
  /** What the predicate reads: the holder only, the hit's target, or the attacker. */
  kind: 'self' | 'target' | 'attacker';
}

export interface CStatMod {
  stat: number;
  value: number;
  amount: CAmount | null;
  per: { source: 'selfMissingHpPct' | 'alliesWithin' | 'enemiesWithin' | 'attackersOnSelf'; radiusMm: number; coef: number; max: number } | null;
  pred: CPred | null;
  /** Sourced from a trait (summed and capped per stat). */
  trait: boolean;
  /** Conditioned on ally_downed_within (suppressed while Rallied when negative; scaled by shakenImmune). */
  allyDown: boolean;
}

export interface CStatus {
  id: string;
  index: number;
  /** STATUS_IDS index (statusCount slot). */
  code: number;
  category: StatusDef['category'];
  polarity: 'buff' | 'debuff';
  dr: 'control' | 'displace' | null;
  stacking: StatusDef['stacking'];
  /** Stat index modified, or -1. */
  stat: number;
  sign: number;
  /** Cap of the total magnitude in stat units (or bp for stat-less statuses), or -1. */
  cap: number;
  blocksMove: boolean;
  blocksAttack: boolean;
  blocksAbility: boolean;
  blocksRules: boolean;
  interrupts: boolean;
  breakOnDamageBp: number;
  hardCc: boolean;
}

export type CEffect =
  | {
      type: 'damage';
      amount: CAmount;
      dtype: number;
      canCrit: boolean;
      evadable: boolean;
      bonus: { pred: CPred; multBp: number }[];
      lifestealBp: number;
      perTargetStack: { status: string; multBp: number; consume: boolean } | null;
      onKill: CEffect[];
    }
  | { type: 'heal'; amount: CAmount; bonus: { pred: CPred; multBp: number }[]; to: { withinMm: number; includeSelf: boolean } | null }
  | { type: 'shield'; amount: CAmount; durationTicks: number }
  | {
      type: 'status';
      status: CStatus;
      durationTicks: number;
      /** In the status stat's unit (bp for stat-less statuses). */
      magnitude: number;
      maxStacks: number;
      tick: { intervalTicks: number; amount: CAmount; dtype: number } | null;
      resetOnTargetChange: boolean;
      wardHeal: CAmount | null;
    }
  | { type: 'knockback'; distanceMm: number; fromCaster: boolean }
  | { type: 'pull'; distanceMm: number; towardCaster: boolean; stopGapMm: number }
  | { type: 'dash'; mode: 'away_from_target' | 'toward_target' | 'behind_target'; distanceMm: number }
  | { type: 'cleanse'; categories: string[]; statuses: string[]; count: number }
  | { type: 'dispel'; categories: string[]; count: number }
  | { type: 'interrupt' }
  | { type: 'guard'; pctBp: number; durationTicks: number; radiusMm: number }
  | {
      type: 'zone';
      centerSelf: boolean;
      follow: boolean;
      radiusMm: number;
      durationTicks: number;
      intervalTicks: number;
      trap: { armTicks: number; consume: boolean } | null;
      maxActive: number;
      allies: CEffect[];
      enemies: CEffect[];
    }
  | { type: 'chain'; bounces: number; radiusMm: number; falloffBp: number; includeInitial: boolean; effects: CEffect[] }
  | { type: 'splash'; radiusMm: number; affects: 'enemies' | 'allies' | 'allies_incl_self' | 'both'; excludePrimary: boolean; effects: CEffect[] }
  | { type: 'cooldown'; slot: 'self' | 'a1' | 'a2'; reset: boolean; ticks: number }
  | { type: 'focus'; milli: number }
  | { type: 'heal_recent_damage'; windowTicks: number; pctBp: number; min: CAmount };

export interface CArea {
  shape: 'circle' | 'cone' | 'line';
  centerSelf: boolean;
  radiusMm: number;
  cosBp: number;
  lengthMm: number;
  halfWidthMm: number;
  affects: 'enemies' | 'allies' | 'allies_incl_self' | 'both';
}

export interface CTrigger {
  on: Trigger['on'];
  n: number;
  hpBp: number;
  radiusMm: number;
  status: string | null;
  statuses: string[] | null;
  oncePerTarget: boolean;
  target: 'self' | 'trigger_target' | 'trigger_source' | { withinMm: number; includeSelf: boolean };
  icdTicks: number;
  effects: CEffect[];
}

export interface CAbility {
  id: string;
  def: AbilityDef;
  slot: AbilityDef['slot'];
  cooldownTicks: number;
  startCooldownTicks: number;
  focusMilli: number;
  castTicks: number;
  channel: { durationTicks: number; intervalTicks: number; mobile: boolean; speedMultBp: number } | null;
  rangeMm: number;
  target: AbilityDef['target'];
  approach: boolean;
  selfFirst: boolean;
  delivery: 'instant' | 'projectile' | 'dash' | 'leap';
  deliverySpeedMm: number;
  endBehind: boolean;
  area: CArea | null;
  effects: CEffect[];
  allyEffects: CEffect[];
  selfEffects: CEffect[];
  passive: { statMods: CStatMod[]; aura: { radiusMm: number; affects: 'allies' | 'allies_incl_self' | 'enemies'; statMods: CStatMod[] } | null; triggers: CTrigger[] } | null;
  /** A cast of at least castingTelegraphMinS, or a channel: visible to enemy_casting / casting_enemy. */
  telegraph: boolean;
  /** The ability moves its caster (dash or leap): blocked while rooted or anchored. */
  movesCaster: boolean;
  /** Ranged basic attack (windup fraction). */
  ranged: boolean;
  /** Contains a hard-control status or displacement (for the cc_applied trigger and recaps). */
}

export interface CClass {
  id: string;
  def: ClassDef;
  roles: ('tank' | 'melee' | 'ranged' | 'controller' | 'healer')[];
  powerW: [number, number][];
  supportW: [number, number][];
  basic: CAbility;
  a1: CAbility;
  a2: CAbility;
  passive: CAbility;
}

export interface CTrait {
  id: string;
  mods: CStatMod[];
  enemyAura: { bandMm: number; composure: number } | null;
  shakenMultBp: number | null;
  rallyMultBp: number | null;
}

export interface SimTables {
  content: ContentDB;
  tps: number;
  arena: { widthMm: number; heightMm: number; radiusMm: number; homeFront: number; homeBack: number; awayFront: number; awayBack: number; laneCenterMm: number; laneSpacingMm: number };
  bands: { melee: number; close: number; mid: number; long: number };
  derived: {
    hpPerTghBp: number;
    hpPerStrBp: number;
    hpMinFactorBp: number;
    armorPerTghCenti: number;
    wardPerWilCenti: number;
    movePerPacBp: number;
    atkPerAgiBp: number;
    minIntervalTicks: number;
    powerPerPointBp: number;
    supportPerPointBp: number;
    critBaseBp: number;
    critPerPreBp: number;
    critMaxBp: number;
    critMultBp: number;
    evadePerAgiBp: number;
    evadeMaxBp: number;
    tenPerCmpBp: number;
    tenMinBp: number;
    tenMaxBp: number;
    resPerWilBp: number;
    resMinBp: number;
    resMaxBp: number;
    focusMaxMilli: number;
    focusRegenMilliPerTick: number;
    focusPerDisBp: number;
    reactBaseUs: number;
    reactPerAwrUs: number;
    reactPerCmpUs: number;
    reactMinUs: number;
    reactMaxUs: number;
    pressureHpBp: number;
    pressureMaxUs: number;
    jitterMax: number;
    cmpMin: number;
    cmpMax: number;
    speedClamp: [number, number];
    dealtClamp: [number, number];
    takenClamp: [number, number];
    healRecvClamp: [number, number];
    traitCapBp: number;
    traitCapComposure: number;
  };
  combatModsDefaults: { hpMultBp: number; armorFlat: number; wardFlat: number; moveSpeedMultBp: number; tenacityFlatBp: number };
  timing: {
    decisionInterval: number;
    windupMeleeBp: number;
    windupRangedBp: number;
    leewayMm: number;
    staggerMax: number;
    triggerDelay: number;
    regenInterval: number;
    auraRecalc: number;
    telegraphMin: number;
  };
  movement: {
    insetMm: number;
    passes: number;
    dashMm: number;
    leapMm: number;
    displaceMm: number;
    lookAheadMm: number;
    corridorMm: number;
    sidestepBp: number;
    cautiousFracBp: number;
    cautiousFloorMm: number;
    protectOffsetMm: number;
    regroupGapMm: number;
    steadyLeadMm: number;
    stickGapMm: number;
  };
  damage: { varianceBp: number; minDamage: number; mitigation: number; thornsGapMm: number; riposteGapMm: number; assistTicks: number; recentMaxTicks: number };
  shieldCapBp: number;
  cc: { windowTicks: number; steps: number[]; maxHardTicks: number; minTicks: number };
  overtime: { start: number; cap: number; step: number; dmgPerStepBp: number; healPerStepBp: number; healFloorBp: number };
  tiebreaks: readonly ('fighters_standing' | 'hp_fraction_sum' | 'damage_dealt' | 'first_down' | 'seeded_coin')[];
  captain: { rallyTicks: number; shakenComposure: number; shakenTicks: number; actingPenalty: number; grades: { minCq: number; aura: number; rally: number }[] };
  frameEvery: number;
  statKindFactor: number[];
  statuses: Map<string, CStatus>;
  statusList: CStatus[];
  classes: Map<string, CClass>;
  abilities: Map<string, CAbility>;
  traits: Map<string, CTrait>;
}

// ---- Builders -------------------------------------------------------------------------------

const cache = new WeakMap<ContentDB, SimTables>();

export function simTables(content: ContentDB): SimTables {
  const hit = cache.get(content);
  if (hit) return hit;
  const built = build(content);
  cache.set(content, built);
  return built;
}

const toBp = (x: number): number => Math.round(x * BP);
const toMm = (m: number): number => Math.round(m * 1000);

function build(content: ContentDB): SimTables {
  const c = content.combat;
  if (STAT_MOD_STATS.length !== STAT_COUNT || STAT_MOD_STATS.some((s, i) => (ST as Record<string, number>)[s] !== i)) {
    throw new InvariantError('sim: stat-mod index table differs from the content vocabulary');
  }
  const tps = c.tick.ticksPerSecond;
  const ticks = (s: number): number => Math.round(s * tps);
  const statKindFactor = new Array<number>(STAT_COUNT).fill(BP);
  for (const s of c.statModStats) {
    const idx = (ST as Record<string, number>)[s.id];
    if (idx === undefined) continue;
    statKindFactor[idx] = s.kind === 'flat' || s.kind === 'points' || s.kind === 'flag' ? 1 : s.kind === 'hp_per_s' ? 100 : BP;
  }

  const statuses = new Map<string, CStatus>();
  const statusList: CStatus[] = [];
  c.statuses.forEach((s, index) => {
    const stat = s.stat ? ((ST as Record<string, number>)[s.stat] ?? -1) : -1;
    const factor = stat >= 0 ? statKindFactor[stat]! : BP;
    const blocks = s.blocks ?? [];
    const cs: CStatus = {
      id: s.id,
      index,
      code: STATUS_CODE.get(s.id) ?? -1,
      category: s.category,
      polarity: s.polarity,
      dr: s.dr,
      stacking: s.stacking,
      stat,
      sign: s.sign ?? 1,
      cap: s.cap === null ? -1 : Math.round(s.cap * factor),
      blocksMove: blocks.includes('move'),
      blocksAttack: blocks.includes('attack'),
      blocksAbility: blocks.includes('ability'),
      blocksRules: blocks.includes('rules'),
      interrupts: s.interrupts === true,
      breakOnDamageBp: s.breakOnDamagePct === undefined ? 0 : toBp(s.breakOnDamagePct),
      hardCc: s.category === 'cc_hard',
    };
    statuses.set(s.id, cs);
    statusList.push(cs);
  });
  const statusOf = (id: string): CStatus => {
    const s = statuses.get(id);
    if (!s) throw new InvariantError(`sim: unknown status "${id}"`);
    return s;
  };

  const cos = c.coneHalfAngleCos;
  const ctx: BuildCtx = { ticks, statusOf, statKindFactor, cos: { 60: toBp(cos['60']), 90: toBp(cos['90']), 120: toBp(cos['120']), 180: toBp(cos['180']) }, tps };

  const abilities = new Map<string, CAbility>();
  for (const a of content.abilities.list) abilities.set(a.id, compileAbility(a, ctx, content));
  const classes = new Map<string, CClass>();
  for (const k of content.classes.list) {
    const ab = (slot: 'basic' | 'a1' | 'a2' | 'passive'): CAbility => {
      const x = abilities.get(k.abilities[slot]);
      if (!x) throw new InvariantError(`sim: class ${k.id} lacks ${slot}`);
      return x;
    };
    classes.set(k.id, {
      id: k.id,
      def: k,
      roles: [...k.archetypes],
      powerW: weights(k.powerAttrs),
      supportW: k.supportAttrs ? weights(k.supportAttrs) : [],
      basic: ab('basic'),
      a1: ab('a1'),
      a2: ab('a2'),
      passive: ab('passive'),
    });
  }

  const traits = new Map<string, CTrait>();
  for (const t of content.traits.list) traits.set(t.id, compileTrait(t, ctx, content));

  const d = c.derived;
  const grades = [...content.development.captaincy.grades]
    .map((g) => ({ minCq: g.minCq, aura: g.auraComposure, rally: g.rallyComposure }))
    .sort((a, b) => b.minCq - a.minCq);

  return {
    content,
    tps,
    arena: {
      widthMm: toMm(c.arena.widthM),
      heightMm: toMm(c.arena.heightM),
      radiusMm: toMm(c.arena.fighterRadiusM),
      homeFront: toMm(c.arena.spawn.home.frontXM),
      homeBack: toMm(c.arena.spawn.home.backXM),
      awayFront: toMm(c.arena.spawn.away.frontXM),
      awayBack: toMm(c.arena.spawn.away.backXM),
      laneCenterMm: toMm(c.arena.spawn.laneCenterYM),
      laneSpacingMm: toMm(c.arena.spawn.laneSpacingM),
    },
    bands: {
      melee: toMm(c.bands.find((b) => b.id === 'melee')!.maxGapM),
      close: toMm(c.bands.find((b) => b.id === 'close')!.maxGapM),
      mid: toMm(c.bands.find((b) => b.id === 'mid')!.maxGapM),
      long: toMm(c.bands.find((b) => b.id === 'long')!.maxGapM),
    },
    derived: {
      hpPerTghBp: toBp(d.maxHp.perTgh),
      hpPerStrBp: toBp(d.maxHp.perStr),
      hpMinFactorBp: toBp(d.maxHp.minFactor),
      armorPerTghCenti: Math.round(d.armor.perTgh * 100),
      wardPerWilCenti: Math.round(d.ward.perWil * 100),
      movePerPacBp: toBp(d.moveSpeed.perPac),
      atkPerAgiBp: toBp(d.attackSpeed.perAgi),
      minIntervalTicks: ticks(d.attackSpeed.minIntervalS),
      powerPerPointBp: toBp(d.power.perWeightedPoint),
      supportPerPointBp: toBp(d.support.perWeightedPoint),
      critBaseBp: toBp(d.crit.base),
      critPerPreBp: toBp(d.crit.perPre),
      critMaxBp: toBp(d.crit.max),
      critMultBp: toBp(d.crit.multiplier),
      evadePerAgiBp: toBp(d.evade.perAgiAbove10),
      evadeMaxBp: toBp(d.evade.max),
      tenPerCmpBp: toBp(d.tenacity.perCmp),
      tenMinBp: toBp(d.tenacity.min),
      tenMaxBp: toBp(d.tenacity.max),
      resPerWilBp: toBp(d.resolve.perWil),
      resMinBp: toBp(d.resolve.min),
      resMaxBp: toBp(d.resolve.max),
      focusMaxMilli: Math.round(d.focus.max * 1000),
      focusRegenMilliPerTick: Math.round((d.focus.regenPerSec * 1000) / tps),
      focusPerDisBp: toBp(d.focus.regenPerDis),
      reactBaseUs: Math.round(d.reaction.baseS * 1e6),
      reactPerAwrUs: Math.round(d.reaction.perAwrS * 1e6),
      reactPerCmpUs: Math.round(d.reaction.perCmpS * 1e6),
      reactMinUs: Math.round(d.reaction.minS * 1e6),
      reactMaxUs: Math.round(d.reaction.maxS * 1e6),
      pressureHpBp: toBp(d.reaction.pressureHpBelow),
      pressureMaxUs: Math.round(d.reaction.pressureMaxS * 1e6),
      jitterMax: d.reaction.jitterTicksMax,
      cmpMin: d.composureInFight.min,
      cmpMax: d.composureInFight.max,
      speedClamp: [toBp(d.speedMultClamp[0]), toBp(d.speedMultClamp[1])],
      dealtClamp: [toBp(d.damageDealtClamp[0]), toBp(d.damageDealtClamp[1])],
      takenClamp: [toBp(d.damageTakenClamp[0]), toBp(d.damageTakenClamp[1])],
      healRecvClamp: [toBp(d.healingReceivedClamp[0]), toBp(d.healingReceivedClamp[1])],
      traitCapBp: toBp(d.traitModCaps.fractionPerStat),
      traitCapComposure: d.traitModCaps.composurePoints,
    },
    combatModsDefaults: {
      hpMultBp: toBp(c.combatModsDefaults.hpMult),
      armorFlat: c.combatModsDefaults.armorFlat,
      wardFlat: c.combatModsDefaults.wardFlat,
      moveSpeedMultBp: toBp(c.combatModsDefaults.moveSpeedMult),
      tenacityFlatBp: toBp(c.combatModsDefaults.tenacityFlat),
    },
    timing: {
      decisionInterval: c.timing.decisionIntervalTicks,
      windupMeleeBp: toBp(c.timing.basicWindupFraction.melee),
      windupRangedBp: toBp(c.timing.basicWindupFraction.ranged),
      leewayMm: toMm(c.timing.rangeLeewayM),
      staggerMax: c.timing.openingStaggerTicksMax,
      triggerDelay: c.timing.triggeredEffectsDelayTicks,
      regenInterval: ticks(c.timing.regenTickIntervalS),
      auraRecalc: c.timing.auraRecalcTicks,
      telegraphMin: ticks(c.timing.castingTelegraphMinS),
    },
    movement: {
      insetMm: toMm(c.movement.approachInsetM),
      passes: c.movement.separationPasses,
      dashMm: Math.round((c.movement.dashSpeedMps * 1000) / tps),
      leapMm: Math.round((c.movement.leapSpeedMps * 1000) / tps),
      displaceMm: Math.round((c.movement.displaceSpeedMps * 1000) / tps),
      lookAheadMm: toMm(c.movement.sidestep.lookAheadM),
      corridorMm: toMm(c.movement.sidestep.corridorM),
      sidestepBp: toBp(c.movement.sidestep.weight),
      cautiousFracBp: toBp(c.movement.cautiousMinGapFraction),
      cautiousFloorMm: toMm(c.movement.cautiousMinGapFloorM),
      protectOffsetMm: toMm(c.movement.protectOffsetM),
      regroupGapMm: toMm(c.movement.regroupGapM),
      steadyLeadMm: toMm(c.movement.steadyLeadAllowanceM),
      stickGapMm: toMm(c.movement.stickiness.gapM),
    },
    damage: {
      varianceBp: toBp(c.damage.variance),
      minDamage: c.damage.minDamage,
      mitigation: c.damage.mitigationConstant,
      thornsGapMm: toMm(c.damage.thornsMaxAttackerGapM),
      riposteGapMm: toMm(c.damage.riposteMaxAttackerGapM),
      assistTicks: ticks(c.damage.assistWindowS),
      recentMaxTicks: ticks(c.damage.recentDamageWindowMaxS),
    },
    shieldCapBp: toBp(c.shields.maxTotalPctOfMaxHp),
    cc: {
      windowTicks: ticks(c.cc.drWindowS),
      steps: c.cc.drSteps.map(toBp),
      maxHardTicks: ticks(c.cc.maxHardDurationS),
      minTicks: ticks(c.cc.minAppliedDurationS),
    },
    overtime: {
      start: ticks(c.overtime.startS),
      cap: ticks(c.overtime.hardCapS),
      step: ticks(c.overtime.stepS),
      dmgPerStepBp: toBp(c.overtime.damagePerStep),
      healPerStepBp: toBp(c.overtime.healingPerStep),
      healFloorBp: toBp(c.overtime.healingFloor),
    },
    tiebreaks: c.roundEnd.tiebreaks,
    captain: {
      rallyTicks: ticks(c.captain.rally.durationS),
      shakenComposure: c.captain.down.shakenComposure,
      shakenTicks: ticks(c.captain.down.shakenDurationS),
      actingPenalty: content.development.captaincy.actingCaptainCqPenalty,
      grades,
    },
    frameEvery: c.events.frameEveryTicks,
    statKindFactor,
    statuses,
    statusList,
    classes,
    abilities,
    traits,
  };
}

function weights(w: Partial<Record<string, number>>): [number, number][] {
  const out: [number, number][] = [];
  for (const id of ATTR_IDS) {
    const v = w[id];
    if (v !== undefined && v !== 0) out.push([ATTR[id], toBp(v)]);
  }
  return out;
}

interface BuildCtx {
  ticks: (s: number) => number;
  statusOf: (id: string) => CStatus;
  statKindFactor: number[];
  cos: Record<60 | 90 | 120 | 180, number>;
  tps: number;
}

export function compileAmount(a: Amount): CAmount {
  return { baseCenti: Math.round((a.base ?? 0) * 100), scale: a.scale.map((s) => ({ stat: s.stat, coefBp: toBp(s.coef) })) };
}

const SELF_PREDS = new Set(['self_hp_below', 'self_targeted_by', 'fight_time_below', 'fight_time_at_least', 'ally_downed_within']);

export function compilePred(p: EffectPredicate, tps: number): CPred {
  const base: CPred = { p: p.p, hpBp: 0, statuses: [], gapMm: 0, ticks: 0, count: 0, of: [], kind: 'target' };
  switch (p.p) {
    case 'target_hp_below':
    case 'target_hp_above':
    case 'self_hp_below':
      base.hpBp = Math.round(p.pct * 100);
      break;
    case 'target_has_status':
      base.statuses = Array.isArray(p.status) ? [...p.status] : [p.status];
      break;
    case 'target_distance_above':
    case 'attacker_distance_above':
      base.gapMm = toMm(p.gapM);
      break;
    case 'self_targeted_by':
      base.count = p.count;
      break;
    case 'fight_time_below':
    case 'fight_time_at_least':
    case 'ally_downed_within':
      base.ticks = Math.round(p.seconds * tps);
      break;
    case 'any':
      base.of = p.of.map((x) => compilePred(x, tps));
      break;
    default:
      break;
  }
  if (p.p === 'any') {
    base.kind = base.of.some((x) => x.kind === 'attacker') ? 'attacker' : base.of.every((x) => x.kind === 'self') ? 'self' : 'target';
  } else if (p.p === 'attacker_distance_above') base.kind = 'attacker';
  else if (SELF_PREDS.has(p.p)) base.kind = 'self';
  return base;
}

function compileStatMod(m: StatMod, ctx: BuildCtx, trait: boolean): CStatMod {
  const stat = (ST as Record<string, number>)[m.stat];
  if (stat === undefined) throw new InvariantError(`sim: unknown stat "${m.stat}"`);
  const f = ctx.statKindFactor[stat]!;
  const isAmount = typeof m.value !== 'number';
  const pred = m.if ? compilePred(m.if, ctx.tps) : null;
  return {
    stat,
    value: typeof m.value === 'number' ? Math.round(m.value * f) : 0,
    amount: isAmount ? compileAmount(m.value as Amount) : null,
    per: m.per
      ? {
          source: m.per.source,
          radiusMm: m.per.radiusM === undefined ? 0 : toMm(m.per.radiusM),
          coef: Math.round(m.per.coef * f),
          max: Math.round(m.per.max * f),
        }
      : null,
    pred,
    trait,
    allyDown: pred !== null && containsPred(pred, 'ally_downed_within'),
  };
}

function containsPred(p: CPred, id: string): boolean {
  return p.p === id || p.of.some((x) => containsPred(x, id));
}

function compileEffects(list: readonly Effect[], ctx: BuildCtx): CEffect[] {
  return list.map((e) => compileEffect(e, ctx));
}

function dtypeOf(t: 'physical' | 'arcane' | 'true' | undefined): number {
  return t === 'arcane' ? DT_ARCANE : t === 'true' ? DT_TRUE : DT_PHYSICAL;
}

function compileEffect(e: Effect, ctx: BuildCtx): CEffect {
  const bonus = (b: { if: EffectPredicate; mult: number }[] | undefined): { pred: CPred; multBp: number }[] =>
    (b ?? []).map((x) => ({ pred: compilePred(x.if, ctx.tps), multBp: toBp(x.mult) }));
  switch (e.type) {
    case 'damage':
      return {
        type: 'damage',
        amount: compileAmount(e.amount),
        dtype: dtypeOf(e.damageType),
        canCrit: e.canCrit,
        evadable: e.evadable,
        bonus: bonus(e.bonus),
        lifestealBp: e.lifesteal === undefined ? 0 : toBp(e.lifesteal),
        perTargetStack: e.perTargetStack ? { status: e.perTargetStack.status, multBp: toBp(e.perTargetStack.mult), consume: e.perTargetStack.consume } : null,
        onKill: compileEffects(e.onKill ?? [], ctx),
      };
    case 'heal':
      return { type: 'heal', amount: compileAmount(e.amount), bonus: bonus(e.bonus), to: e.to ? { withinMm: toMm(e.to.withinM), includeSelf: e.to.includeSelf } : null };
    case 'shield':
      return { type: 'shield', amount: compileAmount(e.amount), durationTicks: ctx.ticks(e.durationS) };
    case 'status': {
      const status = ctx.statusOf(e.status);
      const factor = status.stat >= 0 ? ctx.statKindFactor[status.stat]! : BP;
      return {
        type: 'status',
        status,
        durationTicks: ctx.ticks(e.durationS),
        magnitude: e.magnitude === undefined ? 0 : Math.round(e.magnitude * factor),
        maxStacks: e.maxStacks ?? 1,
        tick: e.tick ? { intervalTicks: ctx.ticks(e.tick.intervalS), amount: compileAmount(e.tick.amount), dtype: dtypeOf(e.tick.damageType) } : null,
        resetOnTargetChange: e.resetOnTargetChange === true,
        wardHeal: e.amount ? compileAmount(e.amount) : null,
      };
    }
    case 'knockback':
      return { type: 'knockback', distanceMm: toMm(e.distanceM), fromCaster: e.from === 'caster' };
    case 'pull':
      return { type: 'pull', distanceMm: toMm(e.distanceM), towardCaster: e.toward === 'caster', stopGapMm: toMm(e.stopGapM) };
    case 'dash':
      return { type: 'dash', mode: e.mode, distanceMm: toMm(e.distanceM) };
    case 'cleanse':
      return { type: 'cleanse', categories: [...e.categories], statuses: [...e.statuses], count: e.count ?? 99 };
    case 'dispel':
      return { type: 'dispel', categories: [...e.categories], count: e.count ?? 99 };
    case 'interrupt':
      return { type: 'interrupt' };
    case 'guard':
      return { type: 'guard', pctBp: toBp(e.pct), durationTicks: ctx.ticks(e.durationS), radiusMm: toMm(e.radiusM) };
    case 'zone':
      return {
        type: 'zone',
        centerSelf: e.zone.center === 'self',
        follow: e.zone.follow === 'caster',
        radiusMm: toMm(e.zone.radiusM),
        durationTicks: ctx.ticks(e.zone.durationS),
        intervalTicks: e.zone.tickIntervalS === null ? 0 : ctx.ticks(e.zone.tickIntervalS),
        trap: e.zone.trigger ? { armTicks: ctx.ticks(e.zone.trigger.armTimeS), consume: e.zone.trigger.consume } : null,
        maxActive: e.zone.maxActive ?? 0,
        allies: compileEffects(e.zone.allies, ctx),
        enemies: compileEffects(e.zone.enemies, ctx),
      };
    case 'chain':
      return { type: 'chain', bounces: e.bounces, radiusMm: toMm(e.radiusM), falloffBp: toBp(e.falloff), includeInitial: e.includeInitial, effects: compileEffects(e.effects, ctx) };
    case 'splash':
      return { type: 'splash', radiusMm: toMm(e.radiusM), affects: e.affects, excludePrimary: e.excludePrimary, effects: compileEffects(e.effects, ctx) };
    case 'cooldown':
      return { type: 'cooldown', slot: e.slot, reset: e.mode === 'reset', ticks: e.seconds === null ? 0 : ctx.ticks(e.seconds) };
    case 'focus':
      return { type: 'focus', milli: Math.round(e.amount * 1000) };
    case 'heal_recent_damage':
      return { type: 'heal_recent_damage', windowTicks: ctx.ticks(e.windowS), pctBp: toBp(e.pct), min: compileAmount(e.min) };
  }
}

function compileTrigger(t: Trigger, ctx: BuildCtx): CTrigger {
  const target = typeof t.target === 'string' ? t.target : { withinMm: toMm(t.target.withinM), includeSelf: t.target.includeSelf };
  return {
    on: t.on,
    n: t.n ?? 1,
    hpBp: t.pct === undefined ? 0 : Math.round(t.pct * 100),
    radiusMm: t.radiusM === undefined ? 0 : toMm(t.radiusM),
    status: t.status ?? null,
    statuses: t.statuses ? [...t.statuses] : null,
    oncePerTarget: t.oncePerTarget === true,
    target,
    icdTicks: ctx.ticks(t.internalCooldownS),
    effects: compileEffects(t.effects, ctx),
  };
}

function hasMover(list: readonly Effect[]): boolean {
  return list.some((e) => e.type === 'dash');
}

function compileAbility(a: AbilityDef, ctx: BuildCtx, content: ContentDB): CAbility {
  const castTicks = a.castTimeS === null ? 0 : ctx.ticks(a.castTimeS);
  const channel = a.channel
    ? { durationTicks: ctx.ticks(a.channel.durationS), intervalTicks: ctx.ticks(a.channel.tickIntervalS), mobile: a.channel.mobile, speedMultBp: toBp(a.channel.moveSpeedMult) }
    : null;
  const area: CArea | null = a.area
    ? {
        shape: a.area.shape,
        centerSelf: a.area.center === 'self',
        radiusMm: a.area.radiusM === undefined ? 0 : toMm(a.area.radiusM),
        cosBp: a.area.angleDeg === undefined ? 0 : ctx.cos[a.area.angleDeg],
        lengthMm: a.area.lengthM === undefined ? 0 : toMm(a.area.lengthM),
        halfWidthMm: a.area.widthM === undefined ? 0 : Math.round((a.area.widthM * 1000) / 2),
        affects: a.area.affects,
      }
    : null;
  const telegraphMin = ctx.ticks(content.combat.timing.castingTelegraphMinS);
  return {
    id: a.id,
    def: a,
    slot: a.slot,
    cooldownTicks: ctx.ticks(a.cooldownS),
    startCooldownTicks: ctx.ticks(a.startCooldownS),
    focusMilli: a.focusCost * 1000,
    castTicks,
    channel,
    rangeMm: toMm(a.rangeM),
    target: a.target,
    approach: a.approach,
    selfFirst: a.order === 'self_first',
    delivery: a.delivery.type,
    deliverySpeedMm: a.delivery.speedMps === undefined ? 0 : Math.round((a.delivery.speedMps * 1000) / ctx.tps),
    endBehind: a.delivery.endAt === 'behind',
    area,
    effects: compileEffects(a.effects, ctx),
    allyEffects: compileEffects(a.allyEffects, ctx),
    selfEffects: compileEffects(a.selfEffects, ctx),
    passive: a.passive
      ? {
          statMods: a.passive.statMods.map((m) => compileStatMod(m, ctx, false)),
          aura: a.passive.aura
            ? { radiusMm: toMm(a.passive.aura.radiusM), affects: a.passive.aura.affects, statMods: a.passive.aura.statMods.map((m) => compileStatMod(m, ctx, false)) }
            : null,
          triggers: a.passive.triggers.map((t) => compileTrigger(t, ctx)),
        }
      : null,
    telegraph: (a.kind === 'active' && castTicks >= telegraphMin) || channel !== null,
    movesCaster: a.delivery.type === 'dash' || a.delivery.type === 'leap' || hasMover(a.selfEffects),
    ranged: a.delivery.type === 'projectile',
  };
}

function compileTrait(t: TraitDef, ctx: BuildCtx, content: ContentDB): CTrait {
  const out: CTrait = { id: t.id, mods: [], enemyAura: null, shakenMultBp: null, rallyMultBp: null };
  const adapter = content.combat.traitEffectAdapter;
  for (const e of t.effects) {
    if (e.type === 'combat') {
      let pred: EffectPredicate | undefined;
      switch (e.when) {
        case 'always':
          pred = undefined;
          break;
        case 'selfHpBelow':
          pred = { p: 'self_hp_below', pct: (e.value ?? 0) * adapter.when.selfHpBelow.scale };
          break;
        case 'targetHpBelow':
          pred = { p: 'target_hp_below', pct: (e.value ?? 0) * adapter.when.targetHpBelow.scale };
          break;
        case 'openingSeconds':
          pred = { p: 'fight_time_below', seconds: (e.seconds ?? 0) * adapter.when.openingSeconds.scale };
          break;
        case 'afterSeconds':
          pred = { p: 'fight_time_at_least', seconds: (e.seconds ?? 0) * adapter.when.afterSeconds.scale };
          break;
        case 'allyDown':
          pred = { p: 'ally_downed_within', seconds: (e.seconds ?? 0) * adapter.when.allyDown.scale };
          break;
      }
      const add = (stat: StatMod['stat'], value: number): void => {
        out.mods.push(compileStatMod(pred ? { stat, value, if: pred } : { stat, value }, ctx, true));
      };
      // traitEffectAdapter.mods: xMult m -> stat + (m - 1); composureAdd -> composure.
      if (e.mods.damageDealtMult !== undefined) add('damageDealt', e.mods.damageDealtMult - 1);
      if (e.mods.damageTakenMult !== undefined) add('damageTaken', e.mods.damageTakenMult - 1);
      if (e.mods.reactionDelayMult !== undefined) add('reactionDelay', e.mods.reactionDelayMult - 1);
      if (e.mods.composureAdd !== undefined) add('composure', e.mods.composureAdd);
    } else if (e.type === 'enemyComposureAura') {
      out.enemyAura = { bandMm: toMm(content.combat.bands.find((b) => b.id === e.rangeBand)?.maxGapM ?? 0), composure: e.add };
    } else if (e.type === 'shakenImmune') {
      out.shakenMultBp = toBp(e.mult);
    } else if (e.type === 'captainRally') {
      out.rallyMultBp = toBp(e.mult);
    }
  }
  return out;
}
